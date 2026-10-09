import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FolderFan from '../effects/FolderFan.jsx';
import Cover from '../components/Cover.jsx';
import Icon from '../components/Icon.jsx';
import { useShelf } from '../lib/useShelf.js';
import { classics, useLibrary } from '../lib/library.js';
import { removeFromShelf } from '../lib/shelf.js';
import { useUIActions } from '../lib/ui.jsx';
import * as local from '../plugins/local/index.js';
import { ContinueCard, StatsCard, NotesPanel, ForYou, isFinished, isReading } from '../components/ShelfPanels.jsx';
import { acctKey } from '../lib/accounts.js';
import { haptic, onBackButton } from '../lib/native.js';
import { usePageActive } from '../lib/pageActive.js';

// 书架的排序 / 筛选：记在本机（跟账户走），下次打开还是这样
const VIEW_KEY = acctKey('librarium.shelfView');
const SORTS = [['recent', '最近阅读'], ['added', '最近加入'], ['title', '书名'], ['progress', '读得最多']];
const FILTERS = [['all', '全部'], ['reading', '在读'], ['unread', '未读'], ['done', '读完']];

const fmtSize = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const ago = (t) => {
  if (!t) return '';
  const d = (Date.now() - t) / 1000;
  if (d < 3600) return Math.max(1, Math.round(d / 60)) + ' 分钟前';
  if (d < 86400) return Math.round(d / 3600) + ' 小时前';
  return Math.round(d / 86400) + ' 天前';
};

export default function Shelf() {
  const { items, ready } = useShelf();
  const { openReader, openBook, toast } = useUIActions();
  const lib = useLibrary();
  const picks = classics(lib.books, 5);
  const [drag, setDrag] = useState(false);
  // 管理（删书）：点「管理」或在手机上长按一本书进入；点书勾选，底部「删除 N 本」要再点一次确认
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [armed, setArmed] = useState(false);
  const fileInput = useRef(null);
  const press = useRef(null);
  const recent = items.slice(0, 5);
  const [view, setView] = useState(() => { try { return { sort: 'recent', filter: 'all', ...JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') }; } catch { return { sort: 'recent', filter: 'all' }; } });
  const [q, setQ] = useState('');
  const setV = (patch) => setView(v => { const next = { ...v, ...patch }; try { localStorage.setItem(VIEW_KEY, JSON.stringify(next)); } catch {} return next; });
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    let list = items.filter(it => (view.filter === 'all' || (view.filter === 'reading' ? isReading(it) : view.filter === 'done' ? isFinished(it) : !(it.progress?.percent > 0)))
      && (!k || `${it.title} ${it.author || ''}`.toLowerCase().includes(k)));
    const by = {
      recent: (a, b) => (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt),
      added: (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
      title: (a, b) => a.title.localeCompare(b.title, 'zh-CN'),
      progress: (a, b) => (b.progress?.percent || 0) - (a.progress?.percent || 0),
    }[view.sort] || (() => 0);
    return [...list].sort(by);
  }, [items, view, q]);
  const counts = useMemo(() => ({ all: items.length, reading: items.filter(isReading).length, done: items.filter(isFinished).length, unread: items.filter(it => !(it.progress?.percent > 0)).length }), [items]);
  // 「最近划线」点进来：留一个一次性的跳转位置给阅读器
  const openAt = (it, cfi) => { try { sessionStorage.setItem('librarium.jump', JSON.stringify({ id: it.id, cfi })); } catch {} openReader(it, null, it.cover); };

  const doImport = async (fileList) => {
    // 先拷一份：调用方紧接着会清空 <input> 的值，FileList 是活的，await 之后就空了
    const files = [...(fileList || [])];
    if (!files.length) return;
    // ZIP（蓝奏云常打包成「合集.zip」）解开，里面的 EPUB / TXT 一起导入
    const { expandFile } = await import('../lib/downloads.js');
    const list = [];
    for (const f of files) list.push(...(/\.zip$/i.test(f.name) ? await expandFile(f.name, new Uint8Array(await f.arrayBuffer()), f.lastModified) : [f]));
    if (!list.length) { toast('压缩包里没有 EPUB 或 TXT', { tone: 'error' }); return; }
    const { ok, failed } = await local.importFiles(list);
    if (ok.length) toast(`导入了 ${ok.length} 本`, { tone: 'ok' });
    failed.forEach(f => toast(`${f.name}：${f.reason}`, { tone: 'error', ms: 4000 }));
  };
  const open = (it, el) => openReader(it, el, it.cover);

  const stopEditing = () => { setEditing(false); setPicked(new Set()); setArmed(false); };
  const pick = (id) => { setArmed(false); setPicked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  // 切到别的页（书架留在后台）就退出管理，不然后台的它还占着返回键
  const active = usePageActive();
  useEffect(() => { if (!active && editing) stopEditing(); }, [active]);
  // 书删光了、或者选中的书被别处删掉了：跟着收
  useEffect(() => {
    if (!editing) return;
    if (!items.length) { stopEditing(); return; }
    setPicked(s => { const live = new Set(items.map(it => it.id)); const n = new Set([...s].filter(id => live.has(id))); return n.size === s.size ? s : n; });
  }, [items, editing]);
  // Esc / 安卓返回键先退出管理
  useEffect(() => {
    if (!editing) return;
    const onKey = (e) => { if (e.key === 'Escape') stopEditing(); };
    window.addEventListener('keydown', onKey);
    const offBack = onBackButton(() => { stopEditing(); return true; });
    return () => { window.removeEventListener('keydown', onKey); offBack(); };
  }, [editing]);
  const allPicked = shown.length > 0 && shown.every(it => picked.has(it.id));
  const pickAll = () => { setArmed(false); setPicked(allPicked ? new Set() : new Set(shown.map(it => it.id))); };
  const removePicked = async () => {
    if (!picked.size) return;
    if (!armed) { setArmed(true); return; }
    const gone = items.filter(it => picked.has(it.id));
    for (const it of gone) await removeFromShelf(it.id);
    toast(gone.length === 1 ? `已删除《${gone[0].title}》` : `已删除 ${gone.length} 本`, { tone: 'ok' });
    stopEditing();
  };
  // 长按（手机）进入管理并选中这本；松手后那一下点击不算打开
  const holdStart = (it) => (e) => {
    if (editing || e.pointerType === 'mouse') return;
    clearTimeout(press.current?.timer);
    press.current = { fired: false, x: e.clientX, y: e.clientY, timer: setTimeout(() => {
      press.current.fired = true; haptic('medium'); setEditing(true); setPicked(new Set([it.id])); setArmed(false);
    }, 480) };
  };
  const holdMove = (e) => { const p = press.current; if (p && !p.fired && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) clearTimeout(p.timer); };
  const holdEnd = () => clearTimeout(press.current?.timer);
  const onCover = (it) => (e) => {
    if (press.current?.fired) { press.current = null; return; }
    if (editing) pick(it.id); else open(it, e.currentTarget.querySelector('.cover'));
  };

  return (
    <div className={`page shelf-page ${drag ? 'is-drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); doImport(e.dataTransfer.files); }}>
      <header className="shelf-head">
        <div>
          <p className="eyebrow">MY SHELF</p>
          <h1 className="serif page-title">书架</h1>
          <p className="muted">{ready ? (items.length ? `${items.length} 本，存在这台设备上，离线也能读` : '还是空的。去探索页挑一本，或者把手里的 EPUB / TXT 拖进来。') : ''}</p>
        </div>
        <div className="shelf-actions">
          <input ref={fileInput} type="file" accept={local.accept} multiple hidden onChange={(e) => { doImport(e.target.files); e.target.value = ''; }} />
          <button className="btn" onClick={() => fileInput.current?.click()}><Icon name="upload" size={18} />导入本地书</button>
          {items.length > 0 && <button className={`btn ${editing ? 'btn-gold' : 'btn-ghost'}`} onClick={() => editing ? stopEditing() : setEditing(true)}>{editing ? '完成' : <><Icon name="edit" size={17} />管理</>}</button>}
        </div>
      </header>

      {recent.length > 0 ? (
        <div className="shelf-top">
          <div className="shelf-top-side">
            <ContinueCard items={items} onOpen={open} />
            <StatsCard items={items} />
          </div>
        <FolderFan label="最近在读" note={`${recent.length} 本`} word="reading"
          cards={recent.map((it, i) => ({
            key: it.id, title: it.title,
            tag: i === 0 ? '上次读到 ' + Math.round((it.progress?.percent || 0) * 100) + '%' : i === recent.length - 1 ? ago(it.lastReadAt || it.addedAt) : undefined,
            thumb: <Cover book={it} eager alt="" />,
          }))}
          onOpenCard={(k, el) => { const it = items.find(x => x.id === k); if (it) open(it, el); }}
          onOpen={() => document.querySelector('.shelf-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        </div>
      ) : ready && picks.length === 5 ? (
        <FolderFan label="从这几本开始" note="书架还是空的" word="start"
          cards={picks.map((b, i) => ({ key: b.id, title: b.title, tag: i === 0 ? '先读这本' : undefined, thumb: <Cover book={b} eager alt="" /> }))}
          onOpenCard={(k, el) => { const b = lib.books.find(x => x.id === k); if (b) openBook(b, el); }}
          onOpen={() => openBook(picks[0])} />
      ) : ready && (
        <div className="shelf-empty glass">
          <Icon name="book" size={36} />
          <p className="serif">一本都还没有</p>
          <div className="row"><Link className="btn btn-gold" to="/explore">去探索</Link><button className="btn" onClick={() => fileInput.current?.click()}>导入本地书</button></div>
        </div>
      )}

      {items.length > 0 && (
        <div className="shelf-tools">
          <h2 className="serif">我的书 <small className="muted num">{items.length}</small></h2>
          <div className="seg" role="radiogroup" aria-label="筛选">
            {FILTERS.map(([id, label]) => (
              <button key={id} className="chip" role="radio" aria-checked={view.filter === id} aria-pressed={view.filter === id} onClick={() => setV({ filter: id })}>
                {label}<span className="chip-count num">{counts[id]}</span>
              </button>
            ))}
          </div>
          <label className="shelf-search"><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="在书架里找书名、作者" aria-label="在书架里找" /></label>
          <label className="shelf-sort"><span className="muted">排序</span>
            <select value={view.sort} onChange={e => setV({ sort: e.target.value })}>{SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          </label>
        </div>
      )}
      {items.length > 0 && !shown.length && <p className="muted shelf-none">{q ? `书架里没有「${q}」。` : '这一栏还没有书。'}</p>}

      {items.length > 0 && (
        <section className={`shelf-grid ${editing ? 'is-editing' : ''}`}>
          {shown.map((it, i) => (
            <article key={it.id} className={`shelf-item ${picked.has(it.id) ? 'is-picked' : ''}`} style={{ '--i': Math.min(i, 16) }}>
              <button className="shelf-cover" onClick={onCover(it)} aria-label={(editing ? '选择 ' : '阅读 ') + it.title} aria-pressed={editing ? picked.has(it.id) : undefined}
                onPointerDown={holdStart(it)} onPointerMove={holdMove} onPointerUp={holdEnd} onPointerCancel={holdEnd} onContextMenu={(e) => { if (!editing && e.nativeEvent.pointerType !== 'mouse') e.preventDefault(); }}>
                <Cover book={it} />
                <span className="shelf-progress"><i style={{ width: `${Math.round((it.progress?.percent || 0) * 100)}%` }} /></span>
                {it.ext === 'txt' && <span className="shelf-ext">TXT</span>}
                {editing && <span className="shelf-check" aria-hidden="true"><Icon name="check" size={15} stroke={2.4} /></span>}
              </button>
              <div className="shelf-meta">
                <strong className="serif">{it.title}</strong>
                <small className="muted">{it.author || '佚名'} · {fmtSize(it.size)}</small>
                <small className="muted num">{it.progress?.percent ? `读到 ${Math.round(it.progress.percent * 100)}%` : '未开始'}{it.lastReadAt ? ` · ${ago(it.lastReadAt)}` : ''}</small>
              </div>
            </article>
          ))}
        </section>
      )}

      {items.length > 0 && (
        <div className="shelf-bottom">
          <NotesPanel items={items} onOpenAt={openAt} toast={toast} />
          <ForYou items={items} books={lib.books} byId={lib.byId} onOpen={openBook} />
        </div>
      )}

      {editing && (
        <div className="shelf-managebar glass" role="toolbar" aria-label="管理书架">
          <span className="num">{picked.size ? `已选 ${picked.size} 本` : '点书来选择'}</span>
          <button className="btn btn-ghost sm" onClick={pickAll}>{allPicked ? '全不选' : '全选'}</button>
          <button className={`btn sm shelf-remove ${armed ? 'is-danger' : ''}`} disabled={!picked.size} onClick={removePicked}>
            <Icon name="trash" size={15} />{armed ? `确定删除 ${picked.size} 本？` : '删除'}
          </button>
        </div>
      )}

      <div className="drop-hint" aria-hidden="true"><Icon name="upload" size={32} /><p className="serif">松手，放进书架</p></div>
    </div>
  );
}
