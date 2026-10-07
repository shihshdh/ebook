import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import NetDiag from '../components/NetDiag.jsx';
import AccountPanel from '../components/AccountPanel.jsx';
import LegadoSources from '../components/LegadoSources.jsx';
import { useSources } from '../lib/legado.js';
import { PLUGINS, enabledPlugins, setPluginEnabled } from '../plugins/registry.js';
import { loadLibrary, useLibrary } from '../lib/library.js';
import { useShelf } from '../lib/useShelf.js';
import { platform } from '../lib/native.js';
import { useUI } from '../lib/ui.jsx';
import { useTheme } from '../lib/theme.js';

/** 手动检查更新：有新版就让底部的更新横幅出来 */
function CheckUpdate() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { checkUpdate } = await import('../lib/update.js');
      const u = await checkUpdate({ force: true });
      if (u) window.dispatchEvent(new CustomEvent('librarium:update', { detail: u }));
      else toast('已经是最新版', { tone: 'ok' });
    } catch { toast('没查到，换个网络再试', { tone: 'error' }); }
    setBusy(false);
  };
  return <button className="btn btn-ghost sm check-update" disabled={busy} onClick={run}>{busy ? '检查中…' : '检查更新'}</button>;
}

const fmtTime = (t) => t ? new Date(t).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Plugins() {
  const lib = useLibrary();
  const { items } = useShelf();
  const { toast } = useUI();
  const [on, setOn] = useState(() => new Set(enabledPlugins().map(p => p.id)));
  const [refreshing, setRefreshing] = useState(false);
  const [theme, setTheme] = useTheme();
  const sources = useSources();
  // 顶栏头像菜单「管理账户」跳过来：滚到账户那一节
  const { hash } = useLocation();
  useEffect(() => { if (hash === '#account') setTimeout(() => document.getElementById('account')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120); }, [hash]);

  const toggle = (id) => {
    const next = !on.has(id);
    setPluginEnabled(id, next);
    setOn(new Set(enabledPlugins().map(p => p.id)));
    loadLibrary({ force: false });
  };
  const refresh = async () => {
    setRefreshing(true);
    try { await loadLibrary({ force: true }); toast('书目已更新', { tone: 'ok' }); }
    catch { toast('刷新失败', { tone: 'error' }); }
    setRefreshing(false);
  };
  const count = (id) => id === 'local' ? items.filter(i => i.source === 'local').length : lib.books.filter(b => b.source === id).length;

  return (
    <div className="page plugins-page">
      <header>
        <p className="eyebrow">PLUGINS · SETTINGS</p>
        <h1 className="serif page-title">插件</h1>
        <p className="muted">书从哪里来，由插件决定。每个书源都是一个独立插件，可以单独开关。</p>
      </header>

      <section className="plugin-list">
        {PLUGINS.map((p, i) => (
          <article key={p.id} className={`plugin glass ${on.has(p.id) ? '' : 'is-off'}`} style={{ '--d': `${i * 80}ms` }}>
            <div className="plugin-top">
              <span className="plugin-icon serif" aria-hidden="true">{{ catalog: '文', remote: '规' }[p.kind] || '本'}</span>
              <div className="plugin-title">
                <h2>{p.name}</h2>
                <p className="muted num">v{p.version} · {p.kind === 'import' ? '导入' : '书源'}{p.license ? ` · ${p.license}` : ''}</p>
              </div>
              <button className={`switch ${on.has(p.id) ? 'on' : ''}`} role="switch" aria-checked={on.has(p.id)} onClick={() => toggle(p.id)} aria-label={`启用 ${p.name}`}><i /></button>
            </div>
            <p className="plugin-desc">{p.description}</p>
            <dl className="plugin-facts">
              {p.kind === 'remote' ? <>
                <div><dt>已导入</dt><dd className="num">{sources?.length || 0} 个书源</dd></div>
                <div><dt>启用</dt><dd className="num">{sources?.filter(e => e.enabled).length || 0} 个</dd></div>
              </> : <div><dt>{p.kind === 'catalog' ? '收录' : '已导入'}</dt><dd className="num">{count(p.id).toLocaleString()} 本</dd></div>}
              {p.kind === 'catalog' && <div><dt>更新于</dt><dd className="num">{fmtTime(lib.fetchedAt)}</dd></div>}
              {p.kind === 'catalog' && lib.books.some(b => b.source === p.id && b.illustrated) && <div><dt>插图版</dt><dd className="num">{lib.books.filter(b => b.source === p.id && b.illustrated).length} 本</dd></div>}
            </dl>
            <div className="plugin-actions">
              {p.kind === 'catalog' && <button className="btn sm" onClick={refresh} disabled={refreshing}><Icon name="refresh" size={16} />{refreshing ? '刷新中…' : '立即刷新'}</button>}
              {p.kind === 'import' && <Link className="btn sm" to="/shelf"><Icon name="upload" size={16} />去书架导入</Link>}
              {p.kind === 'remote' && <button className="btn sm" onClick={() => document.getElementById('booksources')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Icon name="plugin" size={16} />管理书源</button>}
              {p.homepage && <a className="btn btn-ghost sm" href={p.homepage} target="_blank" rel="noreferrer"><Icon name="external" size={16} />网站</a>}
              {p.repo && <a className="btn btn-ghost sm" href={p.repo} target="_blank" rel="noreferrer">GitHub</a>}
            </div>
          </article>
        ))}
      </section>

      <LegadoSources />

      <section className="settings glass">
        <h2 className="serif">账户</h2>
        <AccountPanel />
        <h2 className="serif">外观</h2>
        <p className="muted">浅色是白天的象牙纸，深色是夜里的黑金。阅读器的纸张颜色在书里单独设置。</p>
        <div className="seg seg-wide" role="radiogroup" aria-label="外观">
          {[['light', '浅色'], ['dark', '深色']].map(([id, label]) => (
            <button key={id} className="chip" role="radio" aria-checked={theme === id} aria-pressed={theme === id} onClick={() => setTheme(id)}>{label}</button>
          ))}
        </div>
        <h2 className="serif">网络</h2>
        <NetDiag books={lib.books} />
        <dl className="plugin-facts about">
          <div><dt>运行环境</dt><dd>{{ web: '网页', tauri: 'Windows 客户端', capacitor: 'Android 客户端' }[platform]}</dd></div>
          <div><dt>书架</dt><dd className="num">{items.length} 本（存在本机）</dd></div>
          <div><dt>版本</dt><dd className="num">EBOOK {__APP_VERSION__}{platform !== 'web' && <CheckUpdate />}</dd></div>
        </dl>
      </section>
    </div>
  );
}
