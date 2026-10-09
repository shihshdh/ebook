import { Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { acctKey } from '../lib/accounts.js';
import Cover from '../components/Cover.jsx';
import Icon from '../components/Icon.jsx';
import { searchBooks, useLibrary } from '../lib/library.js';
import { useUI } from '../lib/ui.jsx';
import { lazyOptional } from '../lib/optional.jsx';
import { useTheme } from '../lib/theme.js';
import { useSources, searchSources, useUsableSourceCount } from '../lib/legado.js';
import { pool } from '../lib/pool.js';
import { enabledPlugins, pluginById } from '../plugins/registry.js';

// ④ Prism 玻璃折射（ASTRA 负责）；文件没到位时退回静态标题
function PrismFallback({ title, lead, children }) {
  return (
    <section className="prism-fallback">
      <h1 className="serif">{title.map((l, i) => <span key={i}>{l}<br /></span>)}</h1>
      {lead && <p className="muted">{lead}</p>}
      <div className="prism-overlay">{children}</div>
    </section>
  );
}
const PrismGlass = lazyOptional(import.meta.glob('../effects/PrismGlass.jsx'), PrismFallback);

const HISTORY = acctKey('librarium.search');   // 搜索记录跟着账户走
const readHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY) || '[]'); } catch { return []; } };

export default function Search() {
  const lib = useLibrary();
  const usableSources = useUsableSourceCount();
  const { openBook } = useUI();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [history, setHistory] = useState(readHistory);
  const input = useRef(null);
  const [theme] = useTheme();

  useEffect(() => { const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 400); return () => clearTimeout(t); }, []);
  // 地址栏双向同步：输入写进地址（可分享、返回能回到结果）；地址被外部改了（后退、别处链接）就读回输入框
  const urlQ = params.get('q') || '';
  const written = useRef(urlQ);
  useEffect(() => {
    if (urlQ !== written.current) { written.current = urlQ; setQ(urlQ); }
  }, [urlQ]);
  useEffect(() => {
    if (q === written.current) return;
    const t = setTimeout(() => { written.current = q; setParams(q ? { q } : {}, { replace: true }); }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // 输入框跟手，结果列表用延后的词在后台分片渲染：敲字那一帧不再等搜索 + 渲染上百行
  const dq = useDeferredValue(q);
  const results = useMemo(() => dq.trim() ? searchBooks(lib.books, dq.trim()).slice(0, 120) : [], [lib.books, dq]);
  const remember = (term) => {
    const next = [term, ...history.filter(h => h !== term)].slice(0, 10);
    setHistory(next);
    try { localStorage.setItem(HISTORY, JSON.stringify(next)); } catch {}
  };
  const open = (b, el) => { if (q.trim()) remember(q.trim()); openBook(b, el); };

  // ---------- 书源（Legado）：按关键词去各书源现搜，和书目里的书放进同一个结果列表 ----------
  // 不跟着每次按键去请求别人的网站：停顿一下（两个字以上）再搜，或者按回车
  const sources = useSources();
  const active = useMemo(() => enabledPlugins().some(p => p.id === 'legado') ? (sources || []).filter(e => e.enabled) : [], [sources]);
  const [remote, setRemote] = useState(null);   // { q, items: [{entry, item}], done, total, errors, running }
  const remoteRun = useRef(null), remoteQ = useRef('');   // remoteQ：正在搜 / 已经搜过的词，自动搜索的定时器靠它避免重复发请求
  const runRemote = async (raw) => {
    const term = raw.trim();
    if (!term || !active.length) return;
    remoteQ.current = term;
    remoteRun.current?.abort();
    const ctl = new AbortController();
    remoteRun.current = ctl;
    let st = { q: term, items: [], done: 0, total: active.length, errors: [], running: true };
    setRemote(st);
    await searchSources(term, {
      signal: ctl.signal,
      onResult: ({ entry, items, error }) => {
        st = { ...st, done: st.done + 1, items: [...st.items, ...items.map(item => ({ entry, item }))], errors: error ? [...st.errors, { name: entry.source.bookSourceName, error }] : st.errors };
        setRemote(st);
      },
    });
    if (!ctl.signal.aborted) setRemote({ ...st, running: false });
  };
  useEffect(() => { if (remote && remote.q !== q.trim()) { remoteRun.current?.abort(); remoteQ.current = ''; setRemote(null); } }, [q]);
  useEffect(() => () => remoteRun.current?.abort(), []);
  useEffect(() => {
    const term = q.trim();
    if ([...term].length < 2 || !active.length || remoteQ.current === term) return;
    const t = setTimeout(() => { if (remoteQ.current !== term) runRemote(term); }, 900);
    return () => clearTimeout(t);
  }, [q, active.length]);
  // 搜索池：书目和书源不分开，同一本书合成一条（lib/pool.js）
  const pooled = useMemo(() => {
    const term = dq.trim();
    // 首页推荐点进来的带着作者（?by=），只对那个书名有效
    const by = term === urlQ ? params.get('by') || '' : '';
    return term ? pool(results, remote?.q === term ? remote.items : [], term, (b) => pluginById[b.source]?.short || '书目', by) : [];
  }, [results, remote, dq, params]);
  // 结果分批挂：先 30 条，滚到附近再补 30 条（一次铺上百行，排版那一帧要几十毫秒）
  const [limit, setLimit] = useState(30);
  const more = useRef(null);
  useEffect(() => { setLimit(30); }, [dq]);
  useEffect(() => {
    const el = more.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setLimit(n => n + 30); }, { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [pooled.length > limit]);
  const fromLine = (b) => {
    const s = b.poolSources || [];
    return s.length > 1 ? `${s[0]} 等 ${s.length} 个来源` : s[0] ? `来自 ${s[0]}` : '';
  };

  const box = (
    <form className="search-box glass" onSubmit={(e) => { e.preventDefault(); if (remoteQ.current !== q.trim()) runRemote(q); else if (pooled[0]) open(pooled[0]); }} role="search">
      <Icon name="search" size={20} />
      <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="书名、别名、作者，或 wenku8 编号"
        aria-label="搜索" enterKeyHint="search" autoComplete="off" spellCheck="false" />
      {q && <button type="button" className="btn btn-ghost btn-icon" onClick={() => { setQ(''); input.current?.focus(); }} aria-label="清空"><Icon name="close" size={18} /></button>}
    </form>
  );

  return (
    <div className="page search-page">
      <Suspense fallback={<PrismFallback title={['找一本', '今晚的书。']}>{box}</PrismFallback>}>
        <PrismGlass key={theme} title={['找一本', '今晚的书。']} lead={lib.books.length ? `在 ${lib.books.length.toLocaleString()} 本书${usableSources ? `和 ${usableSources} 个书源` : ''}里检索书名、别名和作者` : ''} height={q ? 'min(46vh, 420px)' : undefined}>
          {box}
        </PrismGlass>
      </Suspense>

      {!q && (
        <div className="search-idle">
          {history.length > 0 && (
            <section>
              <div className="section-head"><h3>最近搜过</h3><button className="btn btn-ghost sm" onClick={() => { setHistory([]); try { localStorage.removeItem(HISTORY); } catch {} }}>清空</button></div>
              <div className="chips-wrap">{history.map(h => <button key={h} className="chip" onClick={() => setQ(h)}>{h}</button>)}</div>
            </section>
          )}
          <section>
            <div className="section-head"><h3>按标签找</h3></div>
            <div className="chips-wrap">{lib.tags.slice(0, 28).map(([t, c]) => <button key={t} className="chip" onClick={() => setQ(t)}>{t}<span className="chip-count num">{c}</span></button>)}</div>
          </section>
        </div>
      )}

      {q && (
        <section className="results">
          <p className="muted results-count" role="status">
            {pooled.length
              ? <>找到 <span className="num">{pooled.length}</span> 本</>
              : remote?.running || (!remote && active.length > 0 && [...q.trim()].length >= 2) ? '正在搜…' : '没找到。换个写法，或者试试作者名。'}
            {remote && <> · {remote.running ? `正在搜 ${remote.done} / ${remote.total} 个书源` : `搜了 ${remote.total} 个书源`}</>}
            {!remote && active.length > 0 && [...q.trim()].length < 2 && <> · <button className="btn btn-ghost sm" onClick={() => runRemote(q)}>也在 {active.length} 个书源里搜</button></>}
          </p>
          <ol className="result-list">
            {pooled.slice(0, limit).map((b, i) => (
              <li key={b.id} style={{ '--i': Math.min(i, 14) }}>
                <button className="result" onClick={(e) => open(b, e.currentTarget.querySelector('.cover'))}>
                  <Cover book={b} />
                  <span className="result-body">
                    <strong className="serif">{b.title}</strong>
                    {b.alt && <small className="muted">{b.alt}</small>}
                    <span className="result-meta">{[b.author, b.source === 'legado' ? '' : b.publisher, b.status].filter(Boolean).join(' · ')}</span>
                    {b.tags.length > 0
                      ? <span className="result-tags">{b.illustrated && <span className="tag tag-gold">插图版</span>}{b.tags.slice(0, 4).map(t => <span key={t} className="tag">{t}</span>)}</span>
                      : b.description && <small className="muted result-intro">{b.description.length > 60 ? b.description.slice(0, 60) + '…' : b.description}</small>}
                    <small className="result-from">{fromLine(b)}</small>
                  </span>
                  <Icon name="arrow" size={18} className="result-go" />
                </button>
              </li>
            ))}
          </ol>
          {pooled.length > limit && <div ref={more} className="mw-more muted">继续往下翻…</div>}
          {remote?.errors.length > 0 && (
            <details className="remote-errors">
              <summary className="muted">{remote.errors.length} 个书源没搜成</summary>
              <ul>{remote.errors.map((e, i) => <li key={i}>{e.name}：{e.error}</li>)}</ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
