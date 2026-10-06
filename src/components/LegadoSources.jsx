// 插件页「自定义书源」：导入（粘贴 / 网址 / 文件）、列表、开关、删除。
// 每个书源旁边说清楚能不能用：可用 / 部分不支持（发现页、登录这类不影响读书的）/ 用不了（搜索、目录、正文走不通，默认不启用）。
import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useUI } from '../lib/ui.jsx';
import { useSources, importSources, importFromUrl, setSourceEnabled, removeSource, fatalOf } from '../lib/legado.js';

const hostOf = (u) => { try { return new URL(u).host; } catch { return u; } };

function summary({ added, updated, broken, errors }) {
  const parts = [];
  if (added) parts.push(`新增 ${added} 个`);
  if (updated) parts.push(`更新 ${updated} 个`);
  if (broken) parts.push(`${broken} 个用不了`);
  if (errors.length) parts.push(`${errors.length} 条格式不对`);
  return parts.join(' · ') || '没有找到书源';
}

export default function LegadoSources() {
  const list = useSources();
  const { toast } = useUI();
  const [mode, setMode] = useState('');          // '' | 'paste' | 'url'
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState('');          // 展开问题清单的书源 id
  const [errors, setErrors] = useState([]);
  const file = useRef(null);

  const run = async (job) => {
    setBusy(true); setErrors([]);
    try {
      const r = await job();
      setErrors(r.errors);
      toast(`书源导入：${summary(r)}`, { tone: r.added + r.updated ? 'ok' : 'error', ms: 3600 });
      if (r.added + r.updated) { setMode(''); setText(''); }
    } catch (e) { toast('导入失败：' + (e?.message || '读不到内容'), { tone: 'error', ms: 3600 }); }
    setBusy(false);
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) run(async () => importSources(await f.text()));
  };

  const enabled = list?.filter(e => e.enabled).length || 0;

  return (
    <section id="booksources" className="settings glass booksources">
      <div className="bs-head">
        <div>
          <h2 className="serif">自定义书源</h2>
          <p className="muted">导入你自己的 Legado（阅读 App）书源，搜索页就能在这些书源里现搜、整本下载。{list?.length ? <>已导入 <span className="num">{list.length}</span> 个，启用 <span className="num">{enabled}</span> 个。</> : ''}</p>
        </div>
        <div className="bs-actions">
          <button className={`btn sm ${mode === 'paste' ? 'btn-gold' : ''}`} onClick={() => setMode(m => m === 'paste' ? '' : 'paste')} aria-expanded={mode === 'paste'}><Icon name="copy" size={16} />粘贴</button>
          <button className={`btn sm ${mode === 'url' ? 'btn-gold' : ''}`} onClick={() => setMode(m => m === 'url' ? '' : 'url')} aria-expanded={mode === 'url'}><Icon name="external" size={16} />网址</button>
          <button className="btn sm" onClick={() => file.current?.click()} disabled={busy}><Icon name="upload" size={16} />文件</button>
          <input ref={file} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={onFile} />
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
        <p className="bs-empty muted">还没有书源。书源是一段描述「怎么在某个网站搜书、读目录、取正文」的规则，可以从你用的阅读 App 里导出。EBOOK 不内置任何网站的书源。</p>
      )}

      {list?.length > 0 && (
        <ol className="bs-list">
          {list.map(e => {
            const fatal = fatalOf(e.check), issues = e.check?.unsupported || [];
            const state = fatal.length ? 'bad' : issues.length ? 'part' : 'ok';
            return (
              <li key={e.id} className={`bs-item ${e.enabled ? '' : 'is-off'}`}>
                <div className="bs-row">
                  <div className="bs-name">
                    <strong>{e.source.bookSourceName}</strong>
                    <small className="muted">{e.source.bookSourceGroup ? `${e.source.bookSourceGroup} · ` : ''}{hostOf(e.source.bookSourceUrl)}</small>
                  </div>
                  <button className={`bs-badge ${state}`} onClick={() => setOpen(o => o === e.id ? '' : e.id)} disabled={!issues.length} aria-expanded={open === e.id}>
                    {{ ok: '可用', part: '部分不支持', bad: '用不了' }[state]}
                  </button>
                  <button className={`switch ${e.enabled ? 'on' : ''}`} role="switch" aria-checked={e.enabled} disabled={state === 'bad' && !e.enabled}
                    onClick={() => setSourceEnabled(e.id, !e.enabled)} aria-label={`启用 ${e.source.bookSourceName}`}><i /></button>
                  <button className="btn btn-ghost btn-icon sm" onClick={() => removeSource(e.id)} aria-label={`删除 ${e.source.bookSourceName}`}><Icon name="trash" size={16} /></button>
                </div>
                {open === e.id && issues.length > 0 && (
                  <ul className="bs-issues">{issues.map((m, i) => <li key={i} className={fatal.includes(m) ? 'fatal' : ''}>{m}</li>)}</ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
