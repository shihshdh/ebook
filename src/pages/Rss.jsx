// 「订阅」页：用户导入的订阅源（阅读 App 的 RSS 源）。
//   /rss       所有启用的订阅源：搜索、按分组筛选；点开——能列文章的进文章列表，只有网页的在 EBOOK 自带的浏览器里打开
//   /rss/:id   一个订阅源：分类标签、文章列表（滚到底自动加载下一页）；点文章——有正文规则或 RSS 自带正文的在这里读，否则开网页
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useRss, groupsOf, fetchArticles, fetchContent, sanitize } from '../lib/rss.js';
import { browser, onBackButton } from '../lib/native.js';
import { acctKey } from '../lib/accounts.js';
import { usePageActive } from '../lib/pageActive.js';
import { useUIActions } from '../lib/ui.jsx';
import '../styles/rss.css';

const GROUP_KEY = acctKey('librarium.rssGroup');
const PAGE = 60;
const MODE = { list: '文章', rss: 'RSS', web: '网页' };
const iconOk = (u) => /^(https?:|data:image\/)/i.test(String(u || '').trim());

function SourceIcon({ s, size = 44 }) {
  const [broken, setBroken] = useState(false);
  const letter = (s.sourceName || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1) || '?';
  return (
    <span className="rss-icon" style={{ width: size, height: size }} aria-hidden="true">
      {iconOk(s.sourceIcon) && !broken
        ? <img src={s.sourceIcon.trim()} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : <span className="serif">{letter}</span>}
    </span>
  );
}

const openWeb = (url, title, toast) => browser.open({ url, title }).catch(e => toast?.('打不开：' + (e?.message || e), { tone: 'error' }));

function RssHome() {
  const all = useRss();
  const nav = useNavigate();
  const { toast } = useUIActions();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState(() => { try { return localStorage.getItem(GROUP_KEY) || ''; } catch { return ''; } });
  const [limit, setLimit] = useState(PAGE);
  const list = useMemo(() => (all || []).filter(e => e.enabled && e.mode !== 'bad'), [all]);
  const groups = useMemo(() => {
    const m = new Map();
    for (const e of list) for (const g of groupsOf(e.source)) m.set(g, (m.get(g) || 0) + 1);
    // 只装一两个源的零散分组不单列筛选（合集里有几百个），搜索照样搜得到
    return [...m].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  }, [list]);
  const pick = (g) => { setGroup(g); setLimit(PAGE); try { localStorage.setItem(GROUP_KEY, g); } catch {} };
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return list.filter(e => (!group || groupsOf(e.source).includes(group))
      && (!k || `${e.source.sourceName} ${e.source.sourceGroup || ''} ${e.source.sourceComment || ''}`.toLowerCase().includes(k)));
  }, [list, group, q]);
  useEffect(() => { if (all && group && !groups.some(([g]) => g === group)) pick(''); }, [all, groups, group]);

  const open = (e) => e.mode === 'web' ? openWeb(e.home || e.source.sourceUrl, e.source.sourceName, toast) : nav(`/rss/${e.id}`);

  return (
    <div className="page rss-page">
      <header className="rss-head">
        <p className="eyebrow">SUBSCRIPTIONS</p>
        <h1 className="serif page-title">订阅</h1>
        <p className="muted">{all == null ? '' : list.length ? `${list.length} 个订阅源，来自你导入的阅读 App 订阅源。不执行源里的脚本：规则用不了的直接打开网页。` : ''}</p>
      </header>

      {all && !list.length && (
        <div className="rss-empty glass">
          <p className="serif">还没有订阅源</p>
          <p className="muted">在「插件 → 自定义书源」里导入阅读 App 的订阅源文件（和书源用同一个导入按钮）。EBOOK 不内置任何订阅源。</p>
          <Link className="btn btn-gold sm" to="/plugins#booksources"><Icon name="upload" size={15} />去导入</Link>
        </div>
      )}

      {list.length > 0 && (
        <>
          <div className="rss-tools">
            <label className="shelf-search rss-search"><Icon name="search" size={16} /><input value={q} onChange={e => { setQ(e.target.value); setLimit(PAGE); }} placeholder="找订阅源" aria-label="找订阅源" /></label>
          </div>
          <div className="rss-groups" role="group" aria-label="分组">
            <button className="chip" aria-pressed={!group} onClick={() => pick('')}>全部<span className="chip-count num">{list.length}</span></button>
            {groups.map(([g, n]) => <button key={g} className="chip" aria-pressed={group === g} onClick={() => pick(g)}>{g}<span className="chip-count num">{n}</span></button>)}
          </div>
          {!shown.length && <p className="muted rss-none">没有找到「{q}」。</p>}
          <div className="rss-grid">
            {shown.slice(0, limit).map((e, i) => (
              <button key={e.id} className="rss-card glass" style={{ '--i': Math.min(i % PAGE, 20) }} onClick={() => open(e)}>
                <SourceIcon s={e.source} />
                <span className="rss-card-text">
                  <strong>{e.source.sourceName}</strong>
                  <small className="muted">{MODE[e.mode]}{groupsOf(e.source)[0] ? ` · ${groupsOf(e.source)[0]}` : ''}</small>
                </span>
                {e.mode === 'web' && <Icon name="external" size={15} className="rss-card-go" />}
              </button>
            ))}
          </div>
          {shown.length > limit && <div className="rss-more"><button className="btn sm" onClick={() => setLimit(l => l + PAGE)}>再显示 {Math.min(PAGE, shown.length - limit)} 个 <span className="muted num">（共 {shown.length}）</span></button></div>}
        </>
      )}
    </div>
  );
}

function ArticleView({ entry, item, onClose }) {
  const { toast } = useUIActions();
  const [html, setHtml] = useState(item.html ? sanitize(item.html, item.link) : '');
  const [state, setState] = useState(item.html ? 'done' : 'loading');
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const off = onBackButton(() => { onClose(); return true; });
    document.documentElement.classList.add('sheet-open');
    return () => { window.removeEventListener('keydown', onKey); off(); document.documentElement.classList.remove('sheet-open'); };
  }, []);
  useEffect(() => {
    if (item.html) return;
    const ctl = new AbortController();
    fetchContent(entry, item.link, { signal: ctl.signal }).then(h => { setHtml(h); setState('done'); }).catch(() => { if (!ctl.signal.aborted) setState('error'); });
    return () => ctl.abort();
  }, [item.link]);
  // 正文里的链接：在 EBOOK 自带的浏览器里开，不在这一页跳走
  const onClick = (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    e.preventDefault();
    openWeb(a.href, entry.source.sourceName, toast);
  };
  return (
    <div className="rss-reader" role="dialog" aria-label={item.title}>
      <div className="rss-reader-bar glass">
        <button className="btn btn-ghost sm" onClick={onClose}><Icon name="back" size={16} />返回</button>
        <span className="rss-reader-from muted">{entry.source.sourceName}</span>
        <button className="btn btn-ghost sm" onClick={() => openWeb(item.link, item.title, toast)}><Icon name="external" size={15} />原网页</button>
      </div>
      <article className="rss-article">
        <h1 className="serif">{item.title}</h1>
        {item.pubDate && <p className="muted rss-date">{item.pubDate}</p>}
        {state === 'loading' && <p className="muted">正在取正文…</p>}
        {state === 'error' && <p className="muted">正文没取到。<button className="btn sm" onClick={() => openWeb(item.link, item.title, toast)}>在浏览器里看</button></p>}
        {state === 'done' && <div className="rss-body" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />}
      </article>
    </div>
  );
}

function RssSource({ id }) {
  const all = useRss();
  const nav = useNavigate();
  const { toast } = useUIActions();
  const entry = all?.find(e => e.id === id);
  const sorts = useMemo(() => entry ? (entry.sorts?.length ? entry.sorts : [{ name: '首页', url: entry.source.sourceUrl }]) : [], [entry?.id]);
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [state, setState] = useState('idle');   // idle | loading | done | error
  const [error, setError] = useState('');
  const [reading, setReading] = useState(null);
  const sentinel = useRef(null), busy = useRef(false), gen = useRef(0), have = useRef([]);
  const active = usePageActive();
  useEffect(() => { if (!active) setReading(null); }, [active]);   // 切到别的页：文章关掉（它挂着返回键和页面滚动锁）

  const load = async (url, page, reset) => {
    if (busy.current && !reset) return;
    const my = reset ? ++gen.current : gen.current;
    busy.current = true; setState('loading');
    try {
      const r = await fetchArticles(entry, url, page);
      if (my !== gen.current) return;
      const prev = reset ? [] : have.current;
      const seen = new Set(prev.map(x => x.link));
      const fresh = r.items.filter(x => !seen.has(x.link) && seen.add(x.link));
      have.current = [...prev, ...fresh];
      setItems(have.current);
      setNext(fresh.length ? r.next : null);   // 下一页一条新的都没有：到头了
      setState('done');
    } catch (e) {
      if (my !== gen.current) return;
      setError(e?.message || '出错了'); setState('error');
    } finally { if (my === gen.current) busy.current = false; }
  };
  useEffect(() => { if (entry && entry.mode !== 'web') { have.current = []; setItems([]); setNext(null); busy.current = false; load(sorts[tab]?.url || entry.source.sourceUrl, 1, true); } }, [entry?.id, tab]);
  // 滚到底自动加载下一页
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return;
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) load(next.url, next.page, false); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [next]);

  if (!all) return <div className="page" />;
  if (!entry) return <div className="page center-note"><p>这个订阅源已经删掉了。<Link to="/rss">回到订阅</Link></p></div>;
  const s = entry.source;
  const home = entry.home || s.sourceUrl;
  const style = [0, 1, 2].includes(Number(s.articleStyle)) ? Number(s.articleStyle) : 0;
  const openItem = (it) => (entry.content || it.html) ? setReading(it) : openWeb(it.link, it.title, toast);

  return (
    <div className="page rss-page">
      <header className="rss-src-head">
        <button className="btn btn-ghost btn-icon sm" onClick={() => nav('/rss')} aria-label="回到订阅"><Icon name="back" size={18} /></button>
        <SourceIcon s={s} size={52} />
        <div className="rss-src-title">
          <h1 className="serif">{s.sourceName}</h1>
          <small className="muted">{MODE[entry.mode]}{groupsOf(s)[0] ? ` · ${groupsOf(s)[0]}` : ''}{entry.issues?.length ? ` · ${entry.issues[0]}` : ''}</small>
        </div>
        <button className="btn sm" onClick={() => openWeb(home, s.sourceName, toast)}><Icon name="external" size={15} />打开网页</button>
      </header>
      {sorts.length > 1 && (
        <div className="rss-groups rss-sorts" role="tablist">
          {sorts.map((x, i) => <button key={i} role="tab" className="chip" aria-pressed={tab === i} onClick={() => setTab(i)}>{x.name}</button>)}
        </div>
      )}
      {state === 'error' && !items.length && (
        <div className="rss-empty glass">
          <p className="serif">文章列表没取到</p>
          <p className="muted">{error}。可能网站换了样子、需要登录，或者要开代理。</p>
          <button className="btn btn-gold sm" onClick={() => openWeb(home, s.sourceName, toast)}><Icon name="external" size={15} />直接打开网页</button>
        </div>
      )}
      {state === 'done' && !items.length && <div className="rss-empty glass"><p className="muted">这里还没有文章。</p></div>}
      <div className={`rss-list style-${style}`}>
        {items.map((it, i) => (
          <button key={it.link + i} className="rss-item" onClick={() => openItem(it)}>
            {it.image && <img className="rss-thumb" src={it.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <span className="rss-item-text">
              <strong>{it.title || it.link}</strong>
              {it.description && style !== 2 && <small className="muted rss-desc">{it.description}</small>}
              {it.pubDate && <small className="muted num">{it.pubDate}</small>}
            </span>
          </button>
        ))}
      </div>
      <div ref={sentinel} className="rss-sentinel">
        {state === 'loading' && <span className="muted">加载中…</span>}
        {state === 'error' && items.length > 0 && <button className="btn sm" onClick={() => next && load(next.url, next.page, false)}>没加载出来，再试一次</button>}
        {state === 'done' && items.length > 0 && !next && <span className="muted">到底了</span>}
      </div>
      {reading && <ArticleView entry={entry} item={reading} onClose={() => setReading(null)} />}
    </div>
  );
}

export default function Rss() {
  const { id } = useParams();
  return id ? <RssSource key={id} id={id} /> : <RssHome />;
}
