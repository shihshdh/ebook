// 插件页「订阅源」：管理导入的订阅源（导入和书源共用「自定义书源」的导入按钮，同一个文件里混着也行）。
// 订阅源动辄上千个：按分组列，分组默认收起；整组开关、整组删除；用不了的（网址都要靠脚本拼）单独折叠。
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useUI } from '../lib/ui.jsx';
import { useRss, groupsOf, setRssEnabled, removeRss } from '../lib/rss.js';
import '../styles/rss.css';

const MODE = { list: '文章', rss: 'RSS', web: '网页', bad: '用不了' };
const hostOf = (u) => { try { return new URL(u).host; } catch { return u; } };

function Row({ e }) {
  return (
    <li className={`bs-item ${e.enabled ? '' : 'is-off'}`}>
      <div className="bs-row">
        <div className="bs-name">
          <strong>{e.source.sourceName}</strong>
          <small className="muted">{hostOf(e.home || e.source.sourceUrl)}{e.issues?.length ? ` · ${e.issues[0]}` : ''}</small>
        </div>
        <span className={`bs-badge ${e.mode === 'bad' ? 'bad' : e.mode === 'web' ? 'part' : 'ok'}`}>{MODE[e.mode]}</span>
        <button className={`switch ${e.enabled ? 'on' : ''}`} role="switch" aria-checked={e.enabled} disabled={e.mode === 'bad'}
          onClick={() => setRssEnabled(e.id, !e.enabled)} aria-label={`启用 ${e.source.sourceName}`}><i /></button>
        <button className="btn btn-ghost btn-icon sm" onClick={() => removeRss(e.id)} aria-label={`删除 ${e.source.sourceName}`}><Icon name="trash" size={16} /></button>
      </div>
    </li>
  );
}

export default function RssSources() {
  const list = useRss();
  const { toast } = useUI();
  const [open, setOpen] = useState('');        // 展开的分组
  const [armed, setArmed] = useState('');      // 点了第一下「删除」的分组（'*' = 全部）
  const groups = useMemo(() => {
    const m = new Map();
    for (const e of list || []) {
      const g = e.mode === 'bad' ? '\u0000bad' : groupsOf(e.source)[0] || '未分组';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(e);
    }
    // 合集里常有几百个只装一两个源的分组：不到 3 个的并进「零散的」，列表才不会拉到上万像素
    const big = [], loose = [];
    for (const [g, items] of m) (g === '\u0000bad' || items.length >= 3 ? big : loose).push([g, items]);
    if (loose.length) big.push(['\u0000loose', loose.flatMap(([, items]) => items)]);
    const rank = (g) => g === '\u0000bad' ? 2 : g === '\u0000loose' ? 1 : 0;
    return big.sort((a, b) => rank(a[0]) - rank(b[0]) || b[1].length - a[1].length);
  }, [list]);
  if (!list?.length) return null;

  const counts = list.reduce((c, e) => (c[e.mode] = (c[e.mode] || 0) + 1, c), {});
  const enabled = list.filter(e => e.enabled).length;
  const arm = (key, run) => {
    if (armed !== key) { setArmed(key); setTimeout(() => setArmed(a => a === key ? '' : a), 3500); return; }
    setArmed(''); run();
  };

  return (
    <section id="rsssources" className="settings glass booksources rss-sources">
      <div className="bs-head">
        <div>
          <h2 className="serif">订阅源</h2>
          <p className="muted">
            已导入 <span className="num">{list.length}</span> 个，启用 <span className="num">{enabled}</span> 个：
            能列文章 <span className="num">{counts.list || 0}</span> · 标准 RSS <span className="num">{counts.rss || 0}</span> · 直接打开网页 <span className="num">{counts.web || 0}</span>{counts.bad ? <> · 用不了 <span className="num">{counts.bad}</span></> : ''}。
            不执行源里的脚本，规则用不了的直接在 EBOOK 自带的浏览器里打开网页；网页里下到的 EPUB / TXT 会进书架。
          </p>
        </div>
        <div className="bs-actions">
          <Link className="btn btn-gold sm" to="/rss"><Icon name="arrow" size={15} />打开订阅</Link>
          <button className={`btn btn-ghost sm ${armed === '*' ? 'is-armed' : ''}`} onClick={() => arm('*', () => removeRss(list.map(e => e.id)).then(() => toast('订阅源全部删掉了', { tone: 'ok' })))}>
            <Icon name="trash" size={15} />{armed === '*' ? `再点一次，删掉 ${list.length} 个` : '全部删除'}
          </button>
        </div>
      </div>
      <div className="rss-group-list">
        {groups.map(([g, items]) => {
          const bad = g === '\u0000bad', name = bad ? '用不了的' : g === '\u0000loose' ? '零散的（不到 3 个的分组）' : g, on = items.filter(e => e.enabled).length;
          return (
            <div key={g} className={`bs-fold ${open === g ? 'is-open' : ''} ${bad ? 'is-bad' : ''}`}>
              <div className="bs-fold-head">
                <button className="bs-fold-toggle" onClick={() => setOpen(o => o === g ? '' : g)} aria-expanded={open === g}>
                  <Icon name="arrow" size={15} className="bs-fold-chev" />
                  <span>{name} <span className="num">{items.length}</span></span>
                  <small className="muted">{bad ? '网址要执行脚本才能得到' : `启用 ${on}`}</small>
                </button>
                {!bad && <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on > 0} aria-label={`整组启用 ${name}`}
                  onClick={() => setRssEnabled(items.map(e => e.id), on === 0)}><i /></button>}
                <button className={`btn btn-ghost sm ${armed === g ? 'is-armed' : ''}`} onClick={() => arm(g, () => removeRss(items.map(e => e.id)))}>
                  <Icon name="trash" size={15} />{armed === g ? '再点一次' : ''}
                </button>
              </div>
              {open === g && <ol className="bs-list">{items.slice(0, 300).map(e => <Row key={e.id} e={e} />)}{items.length > 300 && <li className="muted rss-cap">这一组太多，只列前 300 个</li>}</ol>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
