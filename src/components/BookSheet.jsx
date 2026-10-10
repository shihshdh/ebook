// 书籍详情：桌面从右侧滑出的玻璃侧板，手机是能往下拖关闭的底部抽屉。
// 下载在这里完成：插图版按卷、纯文本版整本、蓝奏云（客户端里开下载页自动填码，下完自动入架）。下完直接"阅读"。
import { armDownloadWatch } from '../lib/downloads.js';
import { lanzou, onBackButton, platform } from '../lib/native.js';
import { useEffect, useRef, useState } from 'react';
import Cover from './Cover.jsx';
import Icon from './Icon.jsx';
import { useUI } from '../lib/ui.jsx';
import { useShelf } from '../lib/useShelf.js';
import { addToShelf, getShelfItem } from '../lib/shelf.js';
import { pluginById } from '../plugins/registry.js';
import { isTouch, prefersReduced } from '../lib/motion.js';
import { pauseEffects } from '../lib/frame.js';

const fmtSize = (n) => !n ? '' : n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

// 取封面最多等 6 秒：个别结构怪的 EPUB 会让 epub.js 一直不返回，不能因此卡住下载
function epubCover(blob) {
  return Promise.race([epubCoverInner(blob), new Promise(r => setTimeout(() => r(''), 6000))]);
}
async function epubCoverInner(blob) {
  try {
    const { default: ePub } = await import('epubjs');
    const book = ePub(await blob.arrayBuffer());
    await book.ready;
    const url = await book.coverUrl();
    let out = '';
    if (url) {
      // 缩成 360 宽的 JPEG 再存，书架列表不必背着整张大图
      const img = new Image();
      img.src = url;
      await img.decode();
      const w = 360, h = Math.round(img.naturalHeight / img.naturalWidth * w);
      const cv = Object.assign(document.createElement('canvas'), { width: w, height: h });
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      out = cv.toDataURL('image/jpeg', .84);
    }
    book.destroy();
    return out;
  } catch { return ''; }
}

// 面板分两步挂：第一帧只挂顶部（封面、书名、作者），简介、标签、下载列表下一帧再挂。
// 以前点开一本书，面板滑入前要先把整块内容排完（手机上七八十到一百多毫秒，中文排字为主），点了要等一下才开始动；
// 现在第一帧很轻，滑入马上开始（滑动在合成线程上跑，后面排版不影响它），后半截在面板还没滑到那儿之前就挂好了。
// 桌面面板是整屏高，后补内容不改变面板大小；手机面板高度跟内容走（最高 92dvh），只有内容明显会顶满时才分两步，
// 第一帧先撑到 92dvh（.sheet.is-partial），补上内容后高度不变。估得保守（宁可低估），短的照旧一次挂完，免得滑到一半变高
const PHONE = '(max-width: 760px)';
function deferRest(book) {
  if (!matchMedia(PHONE).matches) return true;
  const perLine = Math.ceil((innerWidth - 36) / 15);   // 简介 15px 字：中文一个字一格，西文算半格（往少里估）
  const units = [...(book.description || '')].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e80 ? 1 : .5), 0);
  let h = 60 + 180;   // 抓手、上下留白 + 封面那一栏
  if (book.description) h += Math.floor(units / perLine) * 27 + 16;
  if (book.tags.length) h += 50;
  for (const d of book.downloads) h += d.volumes ? 50 + d.volumes.length * 48 : 72;
  return h > innerHeight * .92 * 1.15;
}

function useProgressMap() {
  const [map, setMap] = useState({});
  const set = (key, v) => setMap(m => ({ ...m, [key]: v }));
  return [map, set];
}

export default function BookSheet() {
  const { sheet, closeBook, toast, openReader } = useUI();
  const { ids } = useShelf();
  const [progress, setProgress] = useProgressMap();
  const [closing, setClosing] = useState(false);
  const panel = useRef(null);
  const coverRef = useRef(null);
  const book = sheet?.book;
  const [restFor, setRestFor] = useState(null);   // 后半截已经挂上的那本书
  const partial = !!book && restFor !== book.id && deferRest(book);
  useEffect(() => {
    if (!book) return;
    if (!partial) { setRestFor(book.id); return; }
    // 第一帧（只有顶部）画出来以后再挂后半截
    const r = requestAnimationFrame(() => setRestFor(book.id));
    return () => cancelAnimationFrame(r);
  }, [book?.id, partial]);

  useEffect(() => { setClosing(false); }, [book?.id]);
  useEffect(() => {
    if (!book) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    document.documentElement.classList.add('sheet-open');
    pauseEffects(true);   // 底下的书页之河、光盘停帧：面板滑入不卡
    const offBack = onBackButton(() => { close(); return true; });   // 安卓返回键先关面板
    return () => { window.removeEventListener('keydown', onKey); document.documentElement.classList.remove('sheet-open'); pauseEffects(false); offBack(); };
  }, [book?.id]);

  const close = () => {
    if (prefersReduced()) return closeBook();
    setClosing(true);
    setTimeout(() => { closeBook(); setClosing(false); }, 320);
  };

  // 手机：内容在顶上时往下拖，面板跟手；超过 120px、或者往下甩（松手前 ~100ms 的速度）就关。
  // 用触摸事件、touchmove 不是 passive：面板是 touch-action: pan-y，以前用指针事件，手指一往下动浏览器就把这一下当滚动接管
  // （发 pointercancel），面板只跟了几像素就弹回去，拖不下来。现在内容在顶上、手指往下拉时 preventDefault 不让它滚；
  // 往上推、横着划、内容没在顶上：不管，照常滚动。速度以前按「整段位移 ÷ 整段时间」算，先慢后快地甩也算不快
  const drag = useRef(null);
  useEffect(() => {
    const el = panel.current;
    if (!el || !isTouch()) return;
    const start = (e) => {
      drag.current = null;
      if (e.touches.length !== 1 || e.target.closest('button,a')) return;
      const scroller = el.querySelector('.sheet-body');
      if (scroller && scroller.scrollTop > 0 && !e.target.closest('.sheet-grip')) return;
      const t = e.touches[0];
      drag.current = { x: t.clientX, y: t.clientY, dy: 0, on: false, track: [[t.clientY, e.timeStamp]] };
    };
    const move = (e) => {
      const d = drag.current; if (!d) return;
      const t = e.touches[0], dy = t.clientY - d.y, dx = t.clientX - d.x;
      if (!d.on) {
        if (dy <= 0 || Math.abs(dx) > dy) { drag.current = null; return; }   // 往上推 / 横着：交给滚动
        d.on = true;
      }
      if (e.cancelable) e.preventDefault();
      d.dy = Math.max(0, dy);
      d.track.push([t.clientY, e.timeStamp]);
      if (d.track.length > 12) d.track.shift();
      el.style.transition = 'none';
      el.style.transform = `translate3d(0,${d.dy}px,0)`;
    };
    const end = (e) => {
      const d = drag.current; drag.current = null;
      if (!d?.on) return;
      const from = e.type === 'touchend' && d.track.find(([, t]) => e.timeStamp - t <= 100);
      const v = from && e.timeStamp - from[1] >= 8 ? (d.track.at(-1)[0] - from[0]) / (e.timeStamp - from[1]) : 0;
      // 关：面板停在手指松开的地方，关闭动画从这里接着往下滑（以前先跳回顶上再滑下去）
      if (d.dy > 120 || v > .4) { close(); return; }   // 400px/s：比翻页（200px/s）高，关错了得重新找书
      el.style.transition = ''; el.style.transform = '';
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end); };
  }, [book?.id]);

  if (!book) return null;

  const plugin = pluginById[book.source];
  // 搜索池合并过的书：下载入口来自不同插件（文库、书源），各自记着 source，按入口走
  const save = async (key, target, title) => {
    if (progress[key]?.state === 'loading') return;
    setProgress(key, { state: 'loading', p: 0 });
    try {
      const blob = await (pluginById[target.source] || plugin).download(target, (loaded, total) => setProgress(key, { state: 'loading', p: total ? loaded / total : 0, loaded }));
      const cover = await epubCover(blob);
      // coverSrc 一起存下：EPUB 里没有封面（纯文本版）时，书架上照样能显示原站封面
      await addToShelf({ id: key, bookId: book.id, source: target.source || book.source, title, author: book.author, cover, coverSrc: book.coverSrc || '', ext: 'epub', size: blob.size }, blob);
      setProgress(key, { state: 'done' });
      toast(`《${title}》已放进书架`, { tone: 'ok' });
    } catch (err) {
      console.error(err);
      setProgress(key, { state: 'error' });
      // 404 / 410 是地址失效（比如上游搬了存放位置），换网络没用，别让人白折腾
      const gone = /HTTP 4(04|10)/.test(err?.message || '');
      toast('下载失败：' + (gone ? '文件地址失效了，等书源或 EBOOK 更新后再试' : (err?.message || '网络错误') + '，换个网络再试'), { tone: 'error', ms: 4000 });
    }
  };
  const read = async (key, el) => {
    const item = await getShelfItem(key);
    if (item) { openReader(item, el || coverRef.current, item.cover); closeBook(); }
  };

  const Action = ({ k, target, title }) => {
    const st = progress[k];
    if (ids.has(k)) return <button className="btn btn-gold sm" onClick={() => read(k)}><Icon name="book" size={16} />阅读</button>;
    if (st?.state === 'loading') return (
      <span className="dl-ring" style={{ '--p': st.p || 0 }} aria-label={`下载中 ${Math.round((st.p || 0) * 100)}%`}>
        <span className="num">{st.p ? Math.round(st.p * 100) : ''}</span>
      </span>
    );
    return <button className="btn sm" onClick={() => save(k, target, title)}><Icon name="download" size={16} />{st?.state === 'error' ? '重试' : '下载'}</button>;
  };

  const illustrated = book.downloads.find(d => d.kind === 'illustrated');
  const txts = book.downloads.filter(d => d.kind === 'txt');   // 公版古籍有简体 / 繁体两份
  const externals = book.downloads.filter(d => d.kind === 'external');

  const downloadAll = async () => {
    for (const v of illustrated.volumes) {
      const k = `${book.id}:il:${v.key}`;
      if (!ids.has(k)) await save(k, v, `${book.title} · ${v.title}`);
    }
  };

  return (
    <div className={`sheet-layer ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={book.title}>
      <div className="sheet-scrim" onClick={close} />
      <aside ref={panel} className={`sheet glass-dense${partial ? ' is-partial' : ''}`}>
        <div className="sheet-grip" aria-hidden="true" />
        <button className="btn btn-ghost btn-icon sheet-close" onClick={close} aria-label="关闭"><Icon name="close" /></button>
        <div className="sheet-body">
          <header className="sheet-hero">
            <div className="sheet-cover-wrap">
              <Cover ref={coverRef} book={book} eager className="sheet-cover" />
              <span className="sheet-cover-glow" aria-hidden="true" />
            </div>
            <div className="sheet-head">
              <p className="eyebrow">{book.publisher || 'LIGHT NOVEL'}{book.aid ? ` · No.${book.aid}` : ''}</p>
              <h2 className="sheet-title serif">{book.title}</h2>
              {book.alt && <p className="sheet-alt">又名 {book.alt}</p>}
              <p className="sheet-author">{book.author}</p>
              <div className="sheet-meta">
                {book.status && <span className="tag">{book.status}</span>}
                {book.animated && <span className="tag tag-gold">已动画化</span>}
                {book.illustrated && <span className="tag tag-gold"><Icon name="image" size={12} /> 插图版</span>}
                {book.length && <span className="tag">{book.length} 字</span>}
              </div>
            </div>
          </header>

          {!partial && <>
          {book.description && <p className="sheet-desc">{book.description}</p>}
          {book.tags.length > 0 && <div className="sheet-tags">{book.tags.map(t => <span key={t} className="chip chip-static">{t}</span>)}</div>}
          {book.blockedNote && <p className="sheet-note">{book.blockedNote}</p>}

          {illustrated && (
            <section className="dl-block">
              <div className="dl-head">
                <div><h3>{illustrated.label}</h3><p className="muted">{illustrated.note}</p></div>
                <button className="btn sm btn-ghost" onClick={downloadAll}>全部下载</button>
              </div>
              <ol className="vol-list">
                {illustrated.volumes.map((v, i) => {
                  const k = `${book.id}:il:${v.key}`;
                  return (
                    <li key={v.key} className="vol" style={{ '--d': `${Math.min(i, 12) * 30}ms` }}>
                      <span className="vol-no num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="vol-title">{v.title}</span>
                      <span className="vol-meta num">{fmtSize(v.size)}{v.images ? ` · ${v.images} 图` : ''}</span>
                      <Action k={k} target={v} title={`${book.title} · ${v.title}`} />
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {txts.length > 0 && (
            <section className="dl-block">
              {txts.map(d => (
                <div key={d.shelfKey || d.key || 'txt'} className="vol vol-solo">
                  <span className="vol-no"><Icon name="book" size={18} /></span>
                  <span className="vol-title">{d.label}<small className="muted">{d.note}</small></span>
                  <span className="vol-meta" />
                  <Action k={d.shelfKey || `${book.id}:${d.key || 'txt'}`} target={d} title={d.title || book.title} />
                </div>
              ))}
            </section>
          )}

          {book.canRequest && plugin?.requestBuildUrl && (
            <section className="dl-block dl-request">
              <div className="vol vol-solo">
                <span className="vol-no"><Icon name="image" size={18} /></span>
                <span className="vol-title">插图版还没生成<small className="muted">可以请上游 mojimoon 用 GitHub Actions 重新生成带封面插图的版本：在浏览器里提交预填好的请求（要登录 GitHub），一般几十分钟到几小时生成好，之后到插件页点「立即刷新」就能按卷下载。</small></span>
                <span className="vol-meta" />
                <a className="btn sm" href={plugin.requestBuildUrl(book)} target="_blank" rel="noreferrer"><Icon name="external" size={16} />请求生成</a>
              </div>
            </section>
          )}

          {externals.map((d, i) => (
            <section key={i} className="dl-block">
              <div className="vol vol-solo">
                <span className="vol-no"><Icon name="external" size={18} /></span>
                <span className="vol-title">{d.label}<small className="muted">{d.note}{d.pwd ? ` · 提取码 ${d.pwd}` : ''}</small></span>
                <span className="vol-meta" />
                <button className="btn sm" onClick={async () => {
                  // 客户端：在 EBOOK 里开蓝奏云（Windows 小窗 / 安卓下载页），提取码自动填好，点下载后直接进书架
                  if (lanzou.available) {
                    try {
                      await lanzou.open({ url: d.url, pwd: d.pwd || '', title: book.title });
                      if (platform === 'tauri') toast('提取码已自动填好。在小窗里点下载，下完会自动放进书架', { ms: 5200 });
                      return;
                    } catch (e) { console.warn('[lanzou]', e); }   // 小窗开不了就退回外部浏览器
                  }
                  let copied = false;
                  if (d.pwd) { try { await navigator.clipboard.writeText(d.pwd); copied = true; } catch {} }
                  // 客户端会盯着「下载」文件夹：在浏览器里下好、回到 EBOOK，书就自动进书架
                  const watching = armDownloadWatch(book.title);
                  toast([copied && `提取码 ${d.pwd} 已复制`, watching ? '下好后回到 EBOOK，会自动放进书架' : '下好后在书架页点「导入本地书」'].filter(Boolean).join('。'), { ms: 5200 });
                  window.open(d.url, '_blank', 'noopener');
                }}><Icon name={lanzou.available ? 'download' : 'copy'} size={16} />{lanzou.available ? '打开下载' : '复制并打开'}</button>
              </div>
            </section>
          ))}

          {!book.downloads.length && <p className="sheet-note">这本书暂时没有可用的下载来源。</p>}
          <p className="sheet-source muted">来源：{book.poolSources?.length > 1 ? book.poolSources.join('、') : plugin?.name}</p>
          </>}
        </div>
      </aside>
    </div>
  );
}
