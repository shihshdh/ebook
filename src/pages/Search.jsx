import { Suspense, memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { acctKey } from '../lib/accounts.js';
import Cover from '../components/Cover.jsx';
import Icon from '../components/Icon.jsx';
import { prepareSearch, searchBooks, useLibrary } from '../lib/library.js';
import { useUIActions } from '../lib/ui.jsx';
import { pressBook, warmIdle } from '../lib/glyph-warm.js';
import { atMost, loadSerif } from '../lib/fonts.js';
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

const fromLine = (b) => {
  const s = b.poolSources || [];
  return s.length > 1 ? `${s[0]} 等 ${s.length} 个来源` : s[0] ? `来自 ${s[0]}` : '';
};
// 结果分帧挂。以前一个词的结果一次挂 30 行：行是 content-visibility: auto，但离屏幕 1.5 屏以内的照样当帧全排——
// 手机上看得见的只有 3 行，当帧排的却有 10 行、近两百个冷字形（字形第一次以某个字重 × 字号出现要现算，见 lib/glyph-warm.js），
// 4 倍降速下打出第一个字那帧排版 95ms。现在新词的第一帧只挂看得见的几行（firstRows），之后每帧加一行，
// 挂满「附近」（nearRows）以后剩下的一次挂上（再往后的行本来就不排版）。
// 入场动画：晚挂的行一挂上，就把它的 reveal 动画的 startTime 对齐到这个词第一批行的动画开始时刻（CSS 里 i×30ms 的延迟照旧）——
// 第 i 行本来就要等 i×30ms 才开始淡入，晚挂一两帧都落在这段等待里，每行开始淡入的时刻和一次全挂时分毫不差。
// （试过按渲染时刻算「晚了多久」去扣延迟：第一批行真正开始动画还要晚一个渲染加排版，晚挂的行反而早了六十毫秒。）
// 屏幕外的行等书名要的衬线分片下好再挂（最多 FONT_WAIT）：往下滚到时不用逐字现查后备字体、分片到了再重排。
// 也等打字停下来（SETTLE）再挂：打字当中挂屏幕外的行是白干（下一个字一来结果又换了），还和每个字的输入处理挤在一起，
// 两帧之间拉到四十毫秒上下。看得见的几行照旧第一帧就挂；晚挂的行入场动画照样对齐到这个词的第一帧（见上），看起来和原来一样。
// 只按「词」分代：书源结果陆续到、列表跟着变时不重新分帧（用户可能正往下看，重新分帧页面会塌下去）。
const FONT_WAIT = 500;
const SETTLE = 250;   // ms：这个词出来以后这么久没再打字，才开始挂屏幕外的行
let rowsFor = null;   // [firstRows, nearRows]，按窗口算；不在渲染里读 innerWidth（手机上可能逼浏览器当场排版），换尺寸时重算
const rowCounts = () => {
  if (!rowsFor) {
    const W = innerWidth - 2 * Math.min(56, Math.max(16, innerWidth * .04)), H = innerHeight;
    const cols = Math.max(1, Math.floor((W + 10) / 450));   // 和 .result-list 的 repeat(auto-fill, minmax(440px, 1fr)) 一致
    // 有搜索词时顶上的玻璃标题是 min(46vh, 420px)，再往下一百来像素（顶栏、结果数）才是结果；一行至少 120px。
    // 看得见的行数按这个算、再多挂一行保险（手机 390×844：算出 4 行，实际看得见 3 行）；「附近」按 2.5 屏算
    const top = Math.min(H * .46, 420) + 100;
    rowsFor = [(Math.ceil(Math.max(0, H - top) / 120) + 1) * cols, Math.ceil(H * 2.5 / 120) * cols];
  }
  return rowsFor;
};
if (typeof window !== 'undefined') addEventListener('resize', () => { rowsFor = null; }, { passive: true });

// 每一行单独 memo：分帧挂新行、书源结果陆续到时只渲染变了的行（以前每次 30 行全部重新生成比对，4 倍降速下十几毫秒）。
// 搜索池每次都生成新的书对象（lib/pool.js），按 id 比；书源合并进来一定会加下载入口，下载入口个数变了就重渲染（详情页要拿最新的下载列表）
const ResultRow = memo(function ResultRow({ b, i, onOpen }) {
  return (
    <li style={{ '--i': Math.min(i, 14) }}>
      <button className="result" onClick={(e) => onOpen(b, e.currentTarget.querySelector('.cover'))} {...pressBook(b)}>
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
  );
}, (a, z) => a.i === z.i && a.onOpen === z.onOpen && a.b.id === z.b.id && a.b.downloads.length === z.b.downloads.length);

// 结果行里所有书共用的字：标签、出版社和状态、来源那一行。空闲时按结果行的样式先排一遍（lib/glyph-warm.js 的 warmIdle）——
// 打出第一个字那帧，看得见的几行里约四成的字就是它们（字形第一次以某个字重 × 字号出现要现算）。书名、作者每本不一样，排不过来。
// 槽位的标签、类名要和 ResultRow 一致（字号全靠类名）
const ROW_WORDS = [['span.result-tags>span', 'tag'], ['span', 'result-meta'], ['span.result-body>small', 'result-from']];
let rowWordsWarmed = false;
function warmRowWords(lib) {
  if (rowWordsWarmed) return;
  rowWordsWarmed = true;
  let meta = ' · ';
  const seen = new Set();
  for (const b of lib.books) for (const v of [b.publisher, b.status]) if (v && !seen.has(v)) { seen.add(v); meta += v; }
  const from = '来自等个来源' + ['书目', ...Object.values(pluginById).map(p => p.short || '')].join('') + '0123456789';
  warmIdle(ROW_WORDS, [lib.tags.map(([t]) => t).join('') + '插图版', meta, from]);
}

// 结果列表单独 memo：每敲一个字，输入框先跟着变（紧急更新），这时结果还是上一个词的，
// 不用把几十行重新生成、比对一遍（以前每个字都来一遍，手机上二三十毫秒，打字跟手那一帧就顿）
const ResultList = memo(function ResultList({ books, term, limit, onOpen, onMore }) {
  const [first, near] = rowCounts();
  const [stage, setStage] = useState({ term, n: 0 });
  const want = Math.min(limit, books.length);
  const count = Math.min(want, Math.max(first, stage.term === term ? stage.n : 0));
  // 换词时上一个词已经挂着的行原地留着（和原来一样不重挂、不重新淡入），只有新出现的行分帧挂；
  // 它们之间暂时空着的位置都在 first 之后，在屏幕外。已经挂着哪些行，提交以后才记（渲染可能被新打的一个字作废）
  const mounted = useRef(new Set());
  const rows = books.slice(0, want).map((b, i) => [b, i]).filter(([b, i]) => i < count || mounted.current.has(b.id));
  const ol = useRef(null), gen = useRef({ term: null, ready: null }), aligned = useRef(new WeakSet()), pending = useRef([]), pendingRaf = useRef(0);
  useLayoutEffect(() => {
    mounted.current = new Set(rows.map(([b]) => b.id));
    const fresh = gen.current.term !== term;
    // 这个词的基准：第一批新挂的行的动画开始时刻；这一批要是全是上个词留下的，就用下一帧的时刻（新挂的动画也从那一帧开始）
    if (fresh) gen.current = { term, ready: new Promise(r => requestAnimationFrame(r)), own: false, t0: performance.now() };
    const g = gen.current;
    for (const li of ol.current?.children || []) {
      if (aligned.current.has(li)) continue;
      aligned.current.add(li);
      pending.current.push([li, fresh, g]);
    }
    // getAnimations() 会逼浏览器当场把样式和排版都算一遍：不在提交里调（书源结果一个个回来，每次提交都多排一遍），
    // 攒到下一帧的 rAF 里一起处理——rAF 在这一帧排版之前，这一遍就是这一帧本来要做的排版
    if (pending.current.length && !pendingRaf.current) pendingRaf.current = requestAnimationFrame(() => {
      pendingRaf.current = 0;
      for (const [li, isFresh, gg] of pending.current.splice(0)) {
        if (!li.isConnected) continue;
        if (isFresh && gg.own) continue;   // 这一批第一行已经当了基准，其余的本来就一起开始
        const a = li.getAnimations().find(x => x.animationName);   // CSS 的 reveal（减弱动效时没有）
        if (!a) continue;
        if (isFresh) { gg.own = true; gg.ready = a.ready.then(x => x.startTime); }
        else gg.ready.then(s => { if (s != null && gen.current === gg) a.startTime = s; });
      }
    });
  });
  useEffect(() => () => cancelAnimationFrame(pendingRaf.current), []);

  // 书名的衬线分片：这一批和下一批一起下（到达挤在一起，同一帧到的只重排一次）。只在换词、加载下一批时下——
  // 书源结果陆续到、列表一变就重下一遍，白白多出一大截工作
  const fonts = useRef(null), booksNow = useRef(books); booksNow.current = books;
  useEffect(() => { fonts.current = loadSerif(booksNow.current.slice(0, limit + 30).map(b => b.title).join(''), 600); }, [term, limit]);
  useEffect(() => {
    if (count >= want) return;
    let alive = true, raf = 0;
    // 看得见的 first 行已经挂了，往下的都在屏幕外：等打字停下、书名分片下好（一般早好了）再挂下一行
    const timer = setTimeout(() => atMost(fonts.current, FONT_WAIT).then(() => {
      if (alive) raf = requestAnimationFrame(() => setStage({ term, n: count >= near ? want : count + 1 }));
    }), Math.max(0, SETTLE - (performance.now() - gen.current.t0)));
    return () => { alive = false; clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [term, count, want, near]);

  // 「继续往下翻」：这一批挂完才放哨兵（列表还短的时候它就在附近，会提前多拉 30 行）
  const more = useRef(null), done = count >= want && books.length > limit;
  useEffect(() => {
    const el = more.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) onMore(); }, { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [done, onMore]);

  return (<>
    <ol ref={ol} className="result-list">
      {rows.map(([b, i]) => <ResultRow key={b.id} b={b} i={i} onOpen={onOpen} />)}
    </ol>
    {done && <div ref={more} className="mw-more muted">继续往下翻…</div>}
  </>);
});

const HISTORY = acctKey('librarium.search');   // 搜索记录跟着账户走
const readHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY) || '[]'); } catch { return []; } };

export default function Search() {
  const lib = useLibrary();
  const usableSources = useUsableSourceCount();
  const { openBook } = useUIActions();
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

  useEffect(() => prepareSearch(lib.books), [lib.books]);   // 每本书的折叠写法趁空闲先算好，第一次搜索不用现算
  useEffect(() => { if (lib.books.length) warmRowWords(lib); }, [lib.books]);
  // 输入框跟手，结果列表用延后的词在后台分片渲染：敲字那一帧不再等搜索 + 渲染上百行
  const dq = useDeferredValue(q);
  const results = useMemo(() => dq.trim() ? searchBooks(lib.books, dq.trim()).slice(0, 120) : [], [lib.books, dq]);
  const historyNow = useRef(history); historyNow.current = history;
  const remember = (term) => {
    const next = [term, ...historyNow.current.filter(h => h !== term)].slice(0, 10);
    setHistory(next);
    try { localStorage.setItem(HISTORY, JSON.stringify(next)); } catch {}
  };
  const qNow = useRef(q); qNow.current = q;
  const open = useCallback((b, el) => { const term = qNow.current.trim(); if (term) remember(term); openBook(b, el); }, [openBook]);   // 不变的函数，结果列表才 memo 得住

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
  const byParam = params.get('by') || '';
  const pooled = useMemo(() => {
    const term = dq.trim();
    // 首页推荐点进来的带着作者（?by=），只对那个书名有效
    const by = term === urlQ ? byParam : '';
    return term ? pool(results, remote?.q === term ? remote.items : [], term, (b) => pluginById[b.source]?.short || '书目', by) : [];
  }, [results, remote, dq, urlQ, byParam]);   // 不看整个 params：搜索框同步到地址栏时它会换，这里不用跟着重算
  // 结果分批挂：先 30 条，滚到附近再补 30 条（一次铺上百行，排版那一帧要几十毫秒）；每批里再分帧挂（见 ResultList）
  const [limit, setLimit] = useState(30);
  useEffect(() => { setLimit(30); }, [dq]);
  const loadMore = useCallback(() => setLimit(n => n + 30), []);
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
          <ResultList books={pooled} term={dq.trim()} limit={limit} onOpen={open} onMore={loadMore} />
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
