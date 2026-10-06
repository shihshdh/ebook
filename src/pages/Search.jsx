import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { acctKey } from '../lib/accounts.js';
import Cover from '../components/Cover.jsx';
import Icon from '../components/Icon.jsx';
import { searchBooks, useLibrary } from '../lib/library.js';
import { useUI } from '../lib/ui.jsx';
import { lazyOptional } from '../lib/optional.jsx';
import { useTheme } from '../lib/theme.js';
import { useSources, searchSources, toBook } from '../lib/legado.js';
import { enabledPlugins } from '../plugins/registry.js';

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

  const results = useMemo(() => q.trim() ? searchBooks(lib.books, q.trim()).slice(0, 120) : [], [lib.books, q]);
  const remember = (term) => {
    const next = [term, ...history.filter(h => h !== term)].slice(0, 10);
    setHistory(next);
    try { localStorage.setItem(HISTORY, JSON.stringify(next)); } catch {}
  };
  const open = (b, el) => { if (q.trim()) remember(q.trim()); openBook(b, el); };

  // ---------- 自定义书源（Legado）：按关键词去各书源现搜 ----------
  // 不跟着每次按键去请求别人的网站：点按钮、按回车，或者书库里一本都没搜到时停顿一下再自动搜
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
    if (!term || results.length || !active.length || remoteQ.current === term) return;
    const t = setTimeout(() => { if (remoteQ.current !== term) runRemote(term); }, 900);
    return () => clearTimeout(t);
  }, [q, results.length, active.length]);
  // 书名和关键词完全一样的排前面，其余按各书源回来的先后
  const remoteBooks = useMemo(() => {
    if (!remote) return [];
    const term = remote.q, rank = (n) => n === term ? 0 : n.includes(term) ? 1 : 2;
    return remote.items.map(({ entry, item }) => toBook(entry, item)).map((b, i) => [rank(b.title), i, b]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map(x => x[2]);
  }, [remote]);

  const box = (
    <form className="search-box glass" onSubmit={(e) => { e.preventDefault(); if (results[0]) open(results[0]); else runRemote(q); }} role="search">
      <Icon name="search" size={20} />
      <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="书名、别名、作者，或 wenku8 编号"
        aria-label="搜索" enterKeyHint="search" autoComplete="off" spellCheck="false" />
      {q && <button type="button" className="btn btn-ghost btn-icon" onClick={() => { setQ(''); input.current?.focus(); }} aria-label="清空"><Icon name="close" size={18} /></button>}
    </form>
  );

  return (
    <div className="page search-page">
      <Suspense fallback={<PrismFallback title={['找一本', '今晚的书。']}>{box}</PrismFallback>}>
        <PrismGlass key={theme} title={['找一本', '今晚的书。']} lead={lib.books.length ? `在 ${lib.books.length.toLocaleString()} 本书里检索书名、别名和作者` : ''} height={q ? 'min(46vh, 420px)' : undefined}>
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
          <p className="muted results-count">{results.length ? <>找到 <span className="num">{results.length}</span> 本{results.length === 120 ? '（只显示前 120 本）' : ''}</> : (active.length ? '书库里没有这本，看看下面书源里的。' : '没找到。换个写法，或者试试作者名。')}</p>
          <ol className="result-list">
            {results.map((b, i) => (
              <li key={b.id} style={{ '--i': Math.min(i, 14) }}>
                <button className="result" onClick={(e) => open(b, e.currentTarget.querySelector('.cover'))}>
                  <Cover book={b} />
                  <span className="result-body">
                    <strong className="serif">{b.title}</strong>
                    {b.alt && <small className="muted">{b.alt}</small>}
                    <span className="result-meta">{b.author}{b.publisher ? ` · ${b.publisher}` : ''}{b.status ? ` · ${b.status}` : ''}</span>
                    <span className="result-tags">{b.illustrated && <span className="tag tag-gold">插图版</span>}{b.tags.slice(0, 4).map(t => <span key={t} className="tag">{t}</span>)}</span>
                  </span>
                  <Icon name="arrow" size={18} className="result-go" />
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {q && active.length > 0 && (
        <section className="results remote-results">
          <div className="section-head">
            <h3>自定义书源</h3>
            {!remote
              ? <button className="btn sm" onClick={() => runRemote(q)}><Icon name="search" size={16} />在 {active.length} 个书源里搜</button>
              : <span className="muted num" role="status">{remote.running ? `正在搜 ${remote.done} / ${remote.total} 个书源…` : `${remote.total} 个书源 · ${remote.items.length} 本`}</span>}
          </div>
          {remoteBooks.length > 0 && (
            <ol className="result-list">
              {remoteBooks.map((b, i) => (
                <li key={b.id} style={{ '--i': Math.min(i, 14) }}>
                  <button className="result" onClick={(e) => open(b, e.currentTarget.querySelector('.cover'))}>
                    <Cover book={b} />
                    <span className="result-body">
                      <strong className="serif">{b.title}</strong>
                      <span className="result-meta">{b.author ? `${b.author} · ` : ''}{b.publisher}</span>
                      {b.description && <small className="muted result-intro">{b.description.length > 60 ? b.description.slice(0, 60) + '…' : b.description}</small>}
                    </span>
                    <Icon name="arrow" size={18} className="result-go" />
                  </button>
                </li>
              ))}
            </ol>
          )}
          {remote && !remote.running && !remote.items.length && <p className="muted results-count">书源里也没搜到。</p>}
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
