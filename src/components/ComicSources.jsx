// 插件页「漫画源」：从 Venera 的源仓库添加漫画源、开关、设置（换域名这些）、「测一遍」。
// 源脚本跑在隔离的沙箱里（src/comic/runtime），碰不到书架和账户；只列白名单里的一般向源（src/comic/policy.js）。
// 漫画在探索页「漫画」标签（ComicExplore）和搜索页（搜索池）里看；这一节管源：内置的默认源、从仓库再加、开关、设置、测一遍。
import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { useUIActions } from '../lib/ui.jsx';
import { ALLOWED, isSelfHosted } from '../comic/policy.js';
import {
  REPOS, comicSupported, comicUnsupportedWhy, useComicSources, fetchIndex, newer, installSource, checkUpdates, setComicSourceEnabled, removeComicSource,
  sourceSettings, setSourceSetting, runSettingCallback, testComicSources, previewOf,
} from '../comic/sources.js';
import '../styles/comic.css';

const repoName = (id) => REPOS.find(r => r.id === id)?.name || id;

/** 源自己的设置：下拉、输入框、开关、按钮（Venera 的 settings 字段） */
function Settings({ id }) {
  const { toast } = useUIActions();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    sourceSettings(id).then(l => alive && setList(l), e => alive && setError(e.message));
    return () => { alive = false; };
  }, [id]);
  const set = async (key, value) => {
    try { setList(await setSourceSetting(id, key, value)); toast('已保存', { tone: 'ok', ms: 1400 }); }
    catch (e) { toast('没存上：' + e.message, { tone: 'error' }); }
  };
  const press = async (key) => {
    try { setList(await runSettingCallback(id, key)); toast('好了', { tone: 'ok', ms: 1400 }); }
    catch (e) { toast('出错了：' + e.message, { tone: 'error' }); }
  };
  if (error) return <p className="cs-note bad">{error}</p>;
  if (!list) return <p className="cs-note muted">正在装载源…</p>;
  if (!list.length) return <p className="cs-note muted">这个源没有可调的设置。</p>;
  return (
    <div className="cs-settings">
      {list.map(s => (
        <div key={s.key} className="cs-field">
          <span>{s.title}</span>
          {s.type === 'select' ? (
            <label className="select">
              <select value={String(s.value ?? '')} onChange={e => set(s.key, e.target.value)} aria-label={s.title}>
                {s.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ) : s.type === 'switch' ? (
            <button className={`switch ${s.value ? 'on' : ''}`} role="switch" aria-checked={!!s.value} aria-label={s.title} onClick={() => set(s.key, !s.value)}><i /></button>
          ) : s.type === 'callback' ? (
            <button className="btn btn-ghost sm" onClick={() => press(s.key)}>{s.buttonText || s.title}</button>
          ) : (
            <input className="cs-input" defaultValue={String(s.value ?? '')} spellCheck="false" aria-label={s.title}
              onBlur={e => { if (e.target.value !== String(s.value ?? '')) set(s.key, e.target.value); }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          )}
        </div>
      ))}
    </div>
  );
}

function SourceRow({ e, open, onToggle }) {
  const t = e.test, state = t?.ok ? 'ok' : t ? 'bad' : 'part';
  const preview = t?.ok && previewOf(e.id);
  return (
    <li className={`bs-item ${e.enabled ? '' : 'is-off'}`}>
      <div className="bs-row">
        <div className="bs-name">
          <strong>{e.name}</strong>
          <small className="muted">{repoName(e.repo)} · v{e.version}{isSelfHosted(e.key) ? ' · 自己的服务器' : ''}</small>
        </div>
        <button className={`bs-badge ${state}`} onClick={onToggle} aria-expanded={open}>{t?.ok ? '能用' : t ? '没通过' : '未测'}</button>
        <button className={`switch ${e.enabled ? 'on' : ''}`} role="switch" aria-checked={e.enabled}
          onClick={() => setComicSourceEnabled(e.id, !e.enabled)} aria-label={`启用 ${e.name}`}><i /></button>
        <button className={`btn btn-ghost btn-icon sm ${open ? 'is-on' : ''}`} onClick={onToggle} aria-label={`${e.name} 的设置`} aria-expanded={open}><Icon name="edit" size={16} /></button>
        <button className="btn btn-ghost btn-icon sm" onClick={() => removeComicSource(e.id)} aria-label={`删除 ${e.name}`}><Icon name="trash" size={16} /></button>
      </div>
      {open && (
        <div className="cs-panel">
          {t && (
            <div className={`cs-test ${t.ok ? 'ok' : 'bad'}`}>
              {preview && <img src={preview} alt="" />}
              <p>{t.ok ? <>测过：搜到「{t.title}」，<span className="num">{t.chapters}</span> 话，第一话 <span className="num">{t.images}</span> 张，第一张图取到了。</> : t.why}</p>
            </div>
          )}
          <Settings id={e.id} />
        </div>
      )}
    </li>
  );
}

/** 从源仓库挑源：只列白名单里的 */
function Catalog({ installed }) {
  const { toast } = useUIActions();
  const [repo, setRepo] = useState(REPOS[0].id);
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  // 索引每个仓库拉一次；装没装、有没有新版按当前列表现算（开关、测一遍不用重拉）
  useEffect(() => {
    let alive = true;
    setRaw(null); setError('');
    fetchIndex(repo).then(l => alive && setRaw(l), e => alive && setError(e.message));
    return () => { alive = false; };
  }, [repo]);
  const have = new Map((installed || []).map(e => [e.id, e]));
  const items = raw?.map(i => ({ ...i, installed: have.has(i.id), update: have.has(i.id) && newer(i.version, have.get(i.id).version) }));
  const add = async (item) => {
    setBusy(item.id);
    try { await installSource(item); toast(`${item.update ? '更新了' : '添加了'}「${item.name}」`, { tone: 'ok' }); }
    catch (e) { toast(`没加上：${e.message}`, { tone: 'error', ms: 3600 }); }
    setBusy('');
  };
  const shown = items?.filter(i => !i.skip) || [], hidden = (items?.length || 0) - shown.length;
  return (
    <div className="cs-catalog">
      <div className="seg" role="radiogroup" aria-label="源仓库">
        {REPOS.map(r => <button key={r.id} className="chip" role="radio" aria-checked={repo === r.id} aria-pressed={repo === r.id} onClick={() => setRepo(r.id)}>{r.name}</button>)}
      </div>
      {error && <p className="cs-note bad">{error}，换个网络再试。</p>}
      {!items && !error && <p className="cs-note muted">正在读源索引…</p>}
      {shown.length > 0 && (
        <ol className="bs-list">
          {shown.map(i => (
            <li key={i.id} className="bs-item">
              <div className="bs-row">
                <div className="bs-name">
                  <strong>{i.name}</strong>
                  <small className="muted">{[ALLOWED[i.key], `v${i.version}`].filter(Boolean).join(" · ")}</small>
                </div>
                <button className={`btn sm ${i.installed && !i.update ? 'btn-ghost' : 'btn-gold'}`} disabled={busy === i.id || (i.installed && !i.update)} onClick={() => add(i)}>
                  {busy === i.id ? '添加中…' : i.update ? '更新' : i.installed ? '已添加' : <><Icon name="plus" size={15} />添加</>}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {hidden > 0 && <p className="cs-note muted">另有 <span className="num">{hidden}</span> 个不显示：成人站，或者还没审过的新源。</p>}
    </div>
  );
}

export default function ComicSources() {
  const list = useComicSources();
  const { toast } = useUIActions();
  const [catalog, setCatalog] = useState(false);
  const [open, setOpen] = useState('');
  const [testing, setTesting] = useState(null);   // { done, total, ctl }
  const [updating, setUpdating] = useState(false);

  // 源要弹的提示（UI.showMessage）
  useEffect(() => {
    const on = (e) => { if (e.detail?.kind === 'toast' && e.detail.message) toast(`${e.detail.source}：${e.detail.message}`, { ms: 3600 }); };
    window.addEventListener('librarium:comic-ui', on);
    return () => window.removeEventListener('librarium:comic-ui', on);
  }, [toast]);

  const startTest = async () => {
    if (testing) { testing.ctl.abort(); return; }
    const ids = list.map(e => e.id);
    const ctl = new AbortController();
    setTesting({ done: 0, total: ids.length, ctl });
    try {
      const r = await testComicSources(ids, { signal: ctl.signal, onProgress: (done, total) => setTesting(t => t && { ...t, done, total }) });
      toast(`测完了：${r.ok} 个能用${r.failed ? `，${r.failed} 个没通过（点「没通过」看原因）` : ''}`, { tone: r.ok ? 'ok' : 'error', ms: 5200 });
    } catch (e) { toast('没测成：' + (e?.message || '出错了'), { tone: 'error' }); }
    setTesting(null);
  };
  const update = async () => {
    setUpdating(true);
    try {
      const items = await checkUpdates();
      for (const item of items) await installSource(item);
      toast(items.length ? `更新了 ${items.length} 个源：${items.map(i => i.name).join('、')}` : '都是最新的', { tone: 'ok' });
    } catch (e) { toast('没查到更新：' + e.message, { tone: 'error' }); }
    setUpdating(false);
  };

  return (
    <section id="comicsources" className="settings glass booksources comicsources">
      <div className="bs-head">
        <div>
          <h2 className="serif">漫画源</h2>
          <p className="muted">
            内置了 <a href="https://github.com/venera-app/venera-configs" target="_blank" rel="noreferrer">Venera</a> 的漫画源，在探索页的「漫画」标签里看推荐，搜索时漫画和小说一起出来。源脚本在隔离的沙箱里运行，碰不到书架和账户；成人站不收。
            {list?.length ? <> 已添加 <span className="num">{list.length}</span> 个，启用 <span className="num">{list.filter(e => e.enabled).length}</span> 个。</> : ''}
            关着的几个是测试时连不上的，点「测一遍」，在你的网络下能用的会自动打开。
          </p>
        </div>
        {comicSupported && (
          <div className="bs-actions">
            <button className={`btn sm ${catalog ? 'btn-gold' : ''}`} onClick={() => setCatalog(v => !v)} aria-expanded={catalog}><Icon name="plus" size={16} />更多源</button>
            {list?.length > 0 && <button className="btn sm" onClick={update} disabled={updating}><Icon name="download" size={16} />{updating ? '检查中…' : '检查更新'}</button>}
            {list?.length > 0 && (
              <button className={`btn sm ${testing ? 'btn-gold' : ''}`} onClick={startTest} title="每个源真搜一次、打开第一本、取第一章的第一张图，都拿到才算能用">
                <Icon name={testing ? 'close' : 'refresh'} size={16} />{testing ? <>停止 <span className="num">{testing.done}/{testing.total}</span></> : '测一遍'}
              </button>
            )}
          </div>
        )}
      </div>

      {!comicSupported && <p className="bs-empty muted">{comicUnsupportedWhy}</p>}
      {comicSupported && catalog && <Catalog installed={list} />}
      {comicSupported && list && !list.length && !catalog && <p className="bs-empty muted">没有漫画源了。点「更多源」，从 Venera 的源仓库里挑。</p>}
      {comicSupported && list?.length > 0 && (
        <ol className="bs-list">
          {list.map(e => <SourceRow key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(o => (o === e.id ? '' : e.id))} />)}
        </ol>
      )}
    </section>
  );
}
