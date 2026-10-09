// 插件页「自定义书源」：导入（粘贴 / 网址 / 文件，可一次选多个）、列表、开关、删除、「测一遍」。
// 能用的、用不了的各收在一个折叠组里（默认收起，书源一多平铺着要翻好久）；用不了的（规则走不通，或者测一遍没通过）默认不启用，可以一键清掉。
// 每个书源旁边说清楚状态：能用（测过）/ 可用 / 部分不支持（发现页、登录、作者简介这类不影响读书的）/ 用不了 / 没通过。
import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useUIActions } from '../lib/ui.jsx';
import { useSources, importSources, importFromUrl, setSourceEnabled, removeSource, removeSources, fatalOf, isBroken, testSources } from '../lib/legado.js';

const hostOf = (u) => { try { return new URL(u).host; } catch { return u; } };
const SUBSCRIPTION = /订阅源/;

function summary({ added, updated, broken, skipped, errors, rss }) {
  const bad = errors.filter(e => !SUBSCRIPTION.test(e)).length;
  const parts = [];
  if (added) parts.push(`书源新增 ${added} 个`);
  if (updated) parts.push(`更新 ${updated} 个`);
  if (broken) parts.push(`${broken} 个用不了，已收起`);
  if (rss?.added || rss?.updated) parts.push(`订阅源${rss.added ? `新增 ${rss.added} 个` : ''}${rss.updated ? ` 更新 ${rss.updated} 个` : ''}（在「订阅」页）`);
  const skip = (skipped || 0) + (rss?.skipped || 0);
  if (skip) parts.push(`跳过 ${skip} 个不收的（成人、影音、漫画、软件工具等）`);
  if (bad) parts.push(`${bad} 条格式不对`);
  return parts.join(' · ') || '没有找到书源';
}
const changed = (r) => r.added + r.updated + (r.rss?.added || 0) + (r.rss?.updated || 0);

/** 用不了的原因归个类，折叠组标题上给个大概 */
function reasonOf(e) {
  if (e.test?.ok === false && !fatalOf(e.check).length) return '测试没通过';
  const f = fatalOf(e.check);
  if (f.some(m => /用了 (<js>|@js:|java)/.test(m) || /脚本/.test(m))) return '要执行脚本';
  return '规则不认识';
}

function SourceItem({ e, open, onToggle }) {
  const fatal = fatalOf(e.check), issues = e.check?.unsupported || [];
  const failed = e.test?.ok === false, passed = e.test?.ok === true;
  const state = fatal.length || failed ? 'bad' : passed ? 'ok' : issues.length ? 'part' : 'ok';
  const label = fatal.length ? '用不了' : failed ? '没通过' : passed ? '能用' : issues.length ? '部分不支持' : '可用';
  const lines = [...(failed ? [e.test.why] : []), ...issues];
  const tip = passed ? `测过：搜到 ${e.test.books} 本，目录 ${e.test.chapters} 章` : undefined;
  return (
    <li className={`bs-item ${e.enabled ? '' : 'is-off'}`}>
      <div className="bs-row">
        <div className="bs-name">
          <strong>{e.source.bookSourceName}</strong>
          <small className="muted">{e.builtin ? '内置 · ' : ''}{e.source.bookSourceGroup ? `${e.source.bookSourceGroup} · ` : ''}{hostOf(e.source.bookSourceUrl)}</small>
        </div>
        <button className={`bs-badge ${state}`} title={tip} onClick={onToggle} disabled={!lines.length} aria-expanded={open}>{label}</button>
        <button className={`switch ${e.enabled ? 'on' : ''}`} role="switch" aria-checked={e.enabled} disabled={fatal.length > 0 && !e.enabled}
          onClick={() => setSourceEnabled(e.id, !e.enabled)} aria-label={`启用 ${e.source.bookSourceName}`}><i /></button>
        <button className="btn btn-ghost btn-icon sm" onClick={() => removeSource(e.id)} aria-label={`删除 ${e.source.bookSourceName}`}><Icon name="trash" size={16} /></button>
      </div>
      {open && lines.length > 0 && (
        <ul className="bs-issues">{lines.map((m, i) => <li key={i} className={(failed && i === 0) || fatal.includes(m) ? 'fatal' : ''}>{m}</li>)}</ul>
      )}
    </li>
  );
}

export default function LegadoSources() {
  const list = useSources();
  const { toast } = useUIActions();
  const [mode, setMode] = useState('');          // '' | 'paste' | 'url'
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState('');          // 展开问题清单的书源 id
  const [errors, setErrors] = useState([]);
  const [fold, setFold] = useState(false);       // 「用不了的」那组展开没有
  const [showOk, setShowOk] = useState(false);   // 「能用的」那组展开没有：默认收起，内置两百来个，平铺着往下翻要好久
  const [armed, setArmed] = useState(false);     // 「全部删除」点了第一下
  const [testing, setTesting] = useState(null);  // { done, total, ctl }
  const file = useRef(null);

  const run = async (job) => {
    setBusy(true); setErrors([]);
    try {
      const r = await job();
      setErrors(r.errors.filter(e => !SUBSCRIPTION.test(e)));
      toast(`导入：${summary(r)}`, { tone: changed(r) ? 'ok' : 'error', ms: 4800 });
      if (changed(r)) { setMode(''); setText(''); }
    } catch (e) { toast('导入失败：' + (e?.message || '读不到内容'), { tone: 'error', ms: 3600 }); }
    setBusy(false);
  };
  // 书源合集常分好几个文件：一次选多个，结果合在一起报
  const onFile = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    run(async () => {
      const total = { added: 0, updated: 0, broken: 0, skipped: 0, errors: [], rss: { added: 0, updated: 0, skipped: 0 } };
      for (const f of files) {
        const r = await importSources(await f.text());
        total.added += r.added; total.updated += r.updated; total.broken += r.broken; total.skipped += r.skipped;
        total.rss.added += r.rss?.added || 0; total.rss.updated += r.rss?.updated || 0; total.rss.skipped += r.rss?.skipped || 0;
        total.errors.push(...r.errors.map(m => files.length > 1 ? `${f.name}：${m}` : m));
      }
      return total;
    });
  };

  const usable = list?.filter(e => !isBroken(e)) || [];
  const broken = list?.filter(isBroken) || [];
  const enabled = list?.filter(e => e.enabled).length || 0;
  const reasons = Object.entries(broken.reduce((m, e) => { const r = reasonOf(e); m[r] = (m[r] || 0) + 1; return m; }, {}))
    .sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(' · ');

  const startTest = async () => {
    if (testing) { testing.ctl.abort(); return; }
    // 规则走得通的都测（包括上次没通过的，网站可能又好了）
    const ids = list.filter(e => !fatalOf(e.check).length).map(e => e.id);
    if (!ids.length) return;
    const ctl = new AbortController();
    setTesting({ done: 0, total: ids.length, ctl });
    try {
      const r = await testSources(ids, { signal: ctl.signal, onProgress: (done, total) => setTesting(t => t && { ...t, done, total }) });
      toast(ctl.signal.aborted ? `测了 ${r.ok + r.failed} 个就停了：${r.ok} 个能用` : `测完了：${r.ok} 个能用${r.failed ? `，${r.failed} 个没通过（已停用、收起来了）` : ''}`, { tone: r.ok ? 'ok' : 'error', ms: 5200 });
    } catch (e) { toast('没测成：' + (e?.message || '出错了'), { tone: 'error' }); }
    setTesting(null);
  };
  const dropBroken = () => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3500); return; }
    setArmed(false);
    removeSources(broken.map(e => e.id)).then(() => toast(`删掉了 ${broken.length} 个用不了的书源`, { tone: 'ok' }));
  };

  const testable = list?.some(e => !fatalOf(e.check).length);

  return (
    <section id="booksources" className="settings glass booksources">
      <div className="bs-head">
        <div>
          <h2 className="serif">书源</h2>
          <p className="muted">已内置默认书源，可直接在搜索页搜书、整本下载，也可以导入自己的 Legado 书源。内置源已通过规则检查，网站是否可用可以点「测一遍」。{list?.length ? <>共 <span className="num">{list.length}</span> 个，启用 <span className="num">{enabled}</span> 个。</> : ''}</p>
        </div>
        <div className="bs-actions">
          <button className={`btn sm ${mode === 'paste' ? 'btn-gold' : ''}`} onClick={() => setMode(m => m === 'paste' ? '' : 'paste')} aria-expanded={mode === 'paste'}><Icon name="copy" size={16} />粘贴</button>
          <button className={`btn sm ${mode === 'url' ? 'btn-gold' : ''}`} onClick={() => setMode(m => m === 'url' ? '' : 'url')} aria-expanded={mode === 'url'}><Icon name="external" size={16} />网址</button>
          <button className="btn sm" onClick={() => file.current?.click()} disabled={busy}><Icon name="upload" size={16} />文件</button>
          {testable && (
            <button className={`btn sm ${testing ? 'btn-gold' : ''}`} onClick={startTest} title="每个书源真搜一次、打开目录、取第一章，走得通才算能用">
              <Icon name={testing ? 'close' : 'refresh'} size={16} />{testing ? <>停止 <span className="num">{testing.done}/{testing.total}</span></> : '测一遍'}
            </button>
          )}
          <input ref={file} type="file" multiple accept=".json,.txt,application/json,text/plain" hidden onChange={onFile} />
        </div>
      </div>

      {mode && (
        <form className="bs-import" onSubmit={(e) => { e.preventDefault(); if (text.trim()) run(() => mode === 'url' ? importFromUrl(text) : importSources(text)); }}>
          {mode === 'paste'
            ? <textarea value={text} onChange={e => setText(e.target.value)} rows={5} spellCheck="false" aria-label="书源 JSON" placeholder={'把书源 JSON 粘贴到这里（单个书源或书源数组都行）\n{ "bookSourceName": "…", "bookSourceUrl": "…", "searchUrl": "…", "ruleSearch": { … } }'} />
            : <input value={text} onChange={e => setText(e.target.value)} type="url" inputMode="url" spellCheck="false" aria-label="书源网址" placeholder="https://… 书源 JSON 的链接" />}
          <div className="bs-import-row">
            <small className="muted">只认规则，不执行书源里的脚本（&lt;js&gt;、@js:）；登录、发现页暂不支持。</small>
            <button type="submit" className="btn btn-gold sm" disabled={busy || !text.trim()}>{busy ? '导入中…' : '导入'}</button>
          </div>
        </form>
      )}
      {errors.length > 0 && <ul className="bs-errors">{errors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}{errors.length > 6 && <li>…还有 {errors.length - 6} 条</li>}</ul>}

      {list && !list.length && !mode && (
        <p className="bs-empty muted">当前没有书源。已删除的默认源不会自动加回来；可以从阅读 App 导出书源后，在这里导入。</p>
      )}

      {usable.length > 0 && (
        <div className={`bs-fold bs-fold-ok ${showOk ? 'is-open' : ''}`}>
          <div className="bs-fold-head">
            <button className="bs-fold-toggle" onClick={() => setShowOk(v => !v)} aria-expanded={showOk}>
              <Icon name="arrow" size={15} className="bs-fold-chev" />
              <span>能用的 <span className="num">{usable.length}</span> 个</span>
              <small className="muted">启用 {usable.filter(e => e.enabled).length} 个{usable.some(e => e.test?.ok) ? ` · 测过能用 ${usable.filter(e => e.test?.ok).length} 个` : ''}</small>
            </button>
          </div>
          {showOk && (
            <ol className="bs-list">
              {usable.map(e => <SourceItem key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(o => o === e.id ? '' : e.id)} />)}
            </ol>
          )}
        </div>
      )}
      {list?.length > 0 && !usable.length && (
        <p className="bs-empty muted">导入的书源都用不了。EBOOK 不执行书源里的脚本，带脚本的书源（多数「精选合集」里占大半）只能在阅读 App 里用。</p>
      )}

      {broken.length > 0 && (
        <div className={`bs-fold ${fold ? 'is-open' : ''}`}>
          <div className="bs-fold-head">
            <button className="bs-fold-toggle" onClick={() => setFold(f => !f)} aria-expanded={fold}>
              <Icon name="arrow" size={15} className="bs-fold-chev" />
              <span>用不了的 <span className="num">{broken.length}</span> 个</span>
              <small className="muted">{reasons}</small>
            </button>
            <button className={`btn btn-ghost sm ${armed ? 'is-armed' : ''}`} onClick={dropBroken}><Icon name="trash" size={15} />{armed ? `再点一次，删掉 ${broken.length} 个` : '全部删除'}</button>
          </div>
          {fold && (
            <ol className="bs-list">
              {broken.map(e => <SourceItem key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(o => o === e.id ? '' : e.id)} />)}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
