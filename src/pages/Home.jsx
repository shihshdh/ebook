import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DiscShelf from '../effects/DiscShelf.jsx';
import FolderFan from '../effects/FolderFan.jsx';
import Cover from '../components/Cover.jsx';
import Icon from '../components/Icon.jsx';
import { classics, useLibrary, WORLDS, isLightNovel, TOP_RECENT, pickList } from '../lib/library.js';
import { useShelf } from '../lib/useShelf.js';
import { useUI } from '../lib/ui.jsx';
import { lazyOptional } from '../lib/optional.jsx';
import { prefersReduced } from '../lib/motion.js';
import { useTheme } from '../lib/theme.js';
import { useUsableSourceCount } from '../lib/legado.js';
import { SOURCE_PICKS } from '../lib/picks.js';

// ⑥ 书页之河（ASTRA 负责）；文件没到位时用一团静态暖光顶上
function RiverFallback() { return <div className="river-fallback" aria-hidden="true" />; }
const PageRiver = lazyOptional(import.meta.glob('../effects/PageRiver.jsx'), RiverFallback);

/** 数字从 0 滚到目标值（开场计数器，A24 的 "1 0 0"） */
function CountUp({ value, ms = 1400 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!value) return;
    if (prefersReduced()) { setV(value); return; }
    let raf, t0;
    const tick = (now) => {
      t0 ??= now;
      const t = Math.min(1, (now - t0) / ms);
      setV(Math.round(value * (1 - Math.pow(1 - t, 4))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="num">{v.toLocaleString()}</span>;
}

const pad2 = (n) => String(n).padStart(2, '0');
// 入坑书单：五本近年的细腻之作，各配一句不剧透的推荐
const STARTERS = ['1779', '3027', '2353', '3111', '2032'];
const STARTER_NOTES = {
  1779: '把剩下的寿命卖掉之后，最后几个月反而过得最像人生。',
  3027: '传说走进隧道就能找回失去的东西，代价是外面的时间。',
  2353: '代笔写信的少女，想弄懂那句「我爱你」是什么意思。',
  3111: '她每晚入睡，就会把这一天忘得干干净净。',
  2032: '捡到一本写着「共病文库」的日记，告别从那天开始。',
};
const shortTitle = (t = '') => t.replace(/\(.*?\)$/, '');

/** 第一屏右侧的「今日一本」：每天从细腻之选前 40 本里轮到一本，可以手动换 */
function TodayPick({ pool, onOpen }) {
  const day = Math.floor(Date.now() / 864e5);
  const [k, setK] = useState(0);
  const card = useRef(null);
  const book = pool.length ? pool[(day * 7 + k) % pool.length] : null;
  if (!book) return <div className="pick pick-skeleton glass" aria-hidden="true" />;
  const quote = (book.description || '').replace(/…$/, '').split(/[。！？]/).find(s => s.length > 10) || '';
  // 鼠标在卡片上移动时，封面朝鼠标微微倾斜（像一本拿在手里的书）
  const tilt = (e) => {
    const r = card.current.getBoundingClientRect();
    card.current.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - .5) * -8}deg`);
    card.current.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - .5) * 10}deg`);
  };
  const reset = () => { card.current.style.setProperty('--rx', '0deg'); card.current.style.setProperty('--ry', '0deg'); };
  const d = new Date();
  return (
    <article ref={card} className="pick glass reveal" style={{ '--d': '.55s' }} onPointerMove={tilt} onPointerLeave={reset}>
      <p className="eyebrow">今日一本 · <span className="num">{pad2(d.getMonth() + 1)}.{pad2(d.getDate())}</span></p>
      <div className="pick-body" key={book.id}>
        <button className="pick-cover" onClick={(e) => onOpen(book, e.currentTarget)} aria-label={'打开 ' + book.title}>
          <Cover book={book} eager alt="" />
          <span className="pick-sheen" aria-hidden="true" />
        </button>
        <div className="pick-text">
          <h3 className="serif">{shortTitle(book.title)}</h3>
          <p className="pick-by">{book.author}{book.publisher ? ` · ${book.publisher}` : ''}</p>
          {quote && <p className="pick-quote serif">“{quote.slice(0, 54)}{quote.length > 54 ? '…' : ''}”</p>}
          <div className="pick-tags">{book.animated && <span className="tag tag-gold">已动画化</span>}{book.tags.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}</div>
        </div>
      </div>
      <div className="pick-actions">
        <button className="btn btn-gold sm" onClick={(e) => onOpen(book, e.currentTarget)}>看看这本 <Icon name="arrow" size={14} /></button>
        <button className="btn btn-ghost sm" onClick={() => setK(v => v + 1)}><Icon name="refresh" size={14} />换一本</button>
      </div>
    </article>
  );
}

export default function Home() {
  const lib = useLibrary();
  const { items } = useShelf();
  const { openBook, openReader } = useUI();
  const recent = items.slice(0, 8);
  const last = recent[0];
  const lastCover = useRef(null);
  const [theme] = useTheme();
  const sources = useUsableSourceCount();   // 能现搜的自定义书源（没有就不显示）

  // 光盘架：公认经典前 24 本；文件夹里再插 5 本"入坑必读"
  // 光盘「细腻之选」、今日一本：近年文笔细腻唯美的佳作（名单见 library.js 的 PICKS）
  const top = useMemo(() => classics(lib.books, 40), [lib.books]);
  const discs = top.slice(0, 24);
  const starters = useMemo(() => pickList(lib.books, STARTERS), [lib.books]);
  const recentTop = useMemo(() => pickList(lib.books, TOP_RECENT), [lib.books]);
  const stats = useMemo(() => ({
    total: lib.books.filter(isLightNovel).length,
    ill: lib.books.filter(b => b.illustrated).length,
    done: lib.books.filter(b => b.status === '已完结').length,
    anime: lib.books.filter(b => b.animated).length,
  }), [lib.books]);
  const ranking = recentTop.slice(0, 10);
  // 插图重制版：按经典程度排，取 6 本
  const illustrated = useMemo(() => classics(lib.books.filter(b => b.illustrated), 6), [lib.books]);
  // 最近更新：有简介的书（只有书名的条目做推荐太单薄）
  const fresh = useMemo(() => lib.books.filter(b => b.updated && b.description).slice(0, 14), [lib.books]);
  const volumesOf = (b) => b.downloads.find(d => d.kind === 'illustrated')?.volumes.length || 0;
  // 书源里的好书：只有书名，封面按书名去 Bangumi 找（找不到用生成的书衣），点开进搜索池
  const picks = useMemo(() => SOURCE_PICKS.map(p => ({ ...p, book: { id: `pick:${p.title}`, source: 'pick', title: p.title, alt: '', author: p.author, tags: [], downloads: [] } })), []);

  return (
    <div className="home">
      <section className="hero">
        <Suspense fallback={<RiverFallback />}><PageRiver key={theme} className="hero-river" /></Suspense>
        <div className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow reveal" style={{ '--d': '.1s' }}>EBOOK · 轻小说书库</p>
          <h1 className="hero-title serif reveal" style={{ '--d': '.2s' }}>
            今晚，<br /><span className="foil">读点什么。</span>
          </h1>
          <p className="hero-sub reveal" style={{ '--d': '.35s' }}>
            {lib.status === 'ready'
              ? <><CountUp value={stats.total} /> 本轻小说 · <CountUp value={stats.ill} /> 本插图重制版{sources > 0 ? <> · <CountUp value={sources} /> 个书源可现搜</> : ' · 每日更新'}</>
              : lib.status === 'error' ? lib.message : (lib.message || '正在打开书库…')}
          </p>
          <div className="hero-cta reveal" style={{ '--d': '.5s' }}>
            {last ? (
              <button className="btn btn-gold" onClick={() => openReader(last, lastCover.current, last.cover)}>
                <Icon name="book" size={18} />继续读《{last.title.split(' · ')[0]}》
              </button>
            ) : (
              <Link className="btn btn-gold" to="/explore"><Icon name="explore" size={18} />去探索</Link>
            )}
            <Link className="btn" to="/search"><Icon name="search" size={18} />找一本书</Link>
          </div>
        </div>
        <TodayPick pool={top} onOpen={openBook} />
        </div>
        <p className="hero-scroll eyebrow" aria-hidden="true">scroll</p>
      </section>

      <div className="page home-body">
        {lib.status === 'ready' && (
          <section className="stats glass reveal" aria-label="书库概况">
            {[[stats.total, '本轻小说', '收录'], [stats.ill, '本带插图', '重制版'], [stats.done, '本已完结', '完结'], [stats.anime, '本已动画化', '动画化'],
              ...(sources > 0 ? [[sources, '个可现搜', '书源']] : [])].map(([v, unit, k]) => (
              <div key={k} className="stat"><small className="eyebrow">{k}</small><strong className="display"><CountUp value={v} /></strong><span>{unit}</span></div>
            ))}
          </section>
        )}

        {recent.length > 0 && (
          <section className="home-section">
            <div className="section-head"><h2>接着读</h2><Link to="/shelf" className="btn btn-ghost sm">书架 <Icon name="arrow" size={14} /></Link></div>
            <div className="continue-row">
              {recent.map((it, i) => (
                <button key={it.id} className="continue-card" onClick={(e) => openReader(it, e.currentTarget.querySelector('.cover'), it.cover)}
                  ref={i === 0 ? (el) => { lastCover.current = el?.querySelector('.cover'); } : undefined}>
                  <Cover book={it} eager />
                  <span className="continue-meta">
                    <strong>{it.title}</strong>
                    <span className="bar"><i style={{ width: `${Math.round((it.progress?.percent || 0) * 100)}%` }} /></span>
                    <small className="num">{Math.round((it.progress?.percent || 0) * 100)}%{it.progress?.chapter ? ` · ${it.progress.chapter}` : ''}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="home-section">
          {discs.length > 0
            ? <DiscShelf books={discs} eyebrow="细腻之选 · TENDER" onOpen={(b, el) => openBook(b, el)} />
            : <div className="skeleton-disc" aria-hidden="true" />}
        </section>

        {ranking.length > 0 && (
          <section className="home-section editorial">
            <div className="rank glass">
              <div className="section-head"><h2>近年佳作</h2><span className="eyebrow">TOP 10</span></div>
              <ol>
                {ranking.map((b, i) => (
                  <li key={b.id} style={{ '--i': i }}>
                    <button onClick={(e) => openBook(b, e.currentTarget.querySelector('.cover'))}>
                      <span className={`rank-no display ${i < 3 ? 'top' : ''}`}>{pad2(i + 1)}</span>
                      <Cover book={b} />
                      <span className="rank-text">
                        <strong className="serif">{shortTitle(b.title)}</strong>
                        <small>{b.author}{b.animated ? ' · 已动画化' : ''}</small>
                      </span>
                      <span className="rank-tags">{b.tags.slice(0, 2).map(t => <span key={t} className="tag">{t}</span>)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div className="illus glass">
              <div className="section-head"><h2>插图重制版</h2><Link to="/explore?art=1" className="btn btn-ghost sm">全部有插图的 <Icon name="arrow" size={14} /></Link></div>
              <p className="muted illus-lead">按卷下载，带封面、彩页和插图，像拿到一本实体书。</p>
              <div className="illus-grid">
                {illustrated.map((b, i) => (
                  <button key={b.id} className="illus-card" style={{ '--i': i }} onClick={(e) => openBook(b, e.currentTarget)}>
                    <Cover book={b} />
                    <span className="illus-badge num">{volumesOf(b)} 卷</span>
                    <span className="illus-title serif">{shortTitle(b.title)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {sources > 0 && (
          <section className="home-section">
            <div className="section-head"><h2>书源里的好书</h2><Link to="/search" className="btn btn-ghost sm">搜索 <Icon name="arrow" size={14} /></Link></div>
            <div className="fresh-row">
              {picks.map(p => (
                <Link key={p.title} className="fresh-card" to={`/search?${new URLSearchParams({ q: p.title, by: p.author })}`}>
                  <Cover book={p.book} />
                  <strong className="serif">{p.title}</strong>
                  <small>{p.author} · {p.note}</small>
                </Link>
              ))}
            </div>
          </section>
        )}

        {fresh.length > 0 && (
          <section className="home-section">
            <div className="section-head"><h2>最近更新</h2><Link to="/explore" className="btn btn-ghost sm">探索 <Icon name="arrow" size={14} /></Link></div>
            <div className="fresh-row">
              {fresh.map(b => (
                <button key={b.id} className="fresh-card" onClick={(e) => openBook(b, e.currentTarget.querySelector('.cover'))}>
                  <Cover book={b} />
                  <strong className="serif">{shortTitle(b.title)}</strong>
                  <small className="num">{b.updated.slice(5).replace('-', '.')} 更新{b.status === '连载中' ? ' · 连载' : ''}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {starters.length === 5 && (
          <section className="home-section home-folder">
            <div className="section-head"><h2>入坑书单</h2><Link to="/explore" className="btn btn-ghost sm">更多佳作 <Icon name="arrow" size={14} /></Link></div>
            <div className="starter">
              <FolderFan label="入坑书单" note="五本细腻之作" word="tender" sticker="TOP 5"
                cards={starters.map((b, i) => ({ key: b.id, title: b.title, tag: i === 0 ? '从这本开始' : i === 4 ? shortTitle(b.title) : undefined, thumb: <Cover book={b} eager alt="" /> }))}
                onOpenCard={(k, el) => { const b = lib.books.find(x => x.id === k); if (b) openBook(b, el); }}
                onOpen={() => openBook(starters[0])} />
              <ol className="starter-list glass">
                {starters.map((b, i) => (
                  <li key={b.id}>
                    <button onClick={(e) => openBook(b, e.currentTarget)}>
                      <span className="starter-no">{i + 1}</span>
                      <span><strong>{shortTitle(b.title)}</strong><small>{STARTER_NOTES[b.aid] || b.author}</small></span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <section className="home-section">
          <div className="section-head"><h2>五个世界</h2><Link to="/explore" className="btn btn-ghost sm">全部 <Icon name="arrow" size={14} /></Link></div>
          <div className="world-row">
            {WORLDS.map((w, i) => (
              <Link key={w.id} to={`/explore/${w.id}`} className="world-card" style={{ '--c': w.color, '--g': w.glow, '--d': `${i * 60}ms` }}>
                <span className="world-glyph serif">{w.glyph}</span>
                <span className="world-name">{w.tag}</span>
                <span className="world-line muted">{w.tagline}</span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="home-foot muted">
          <p>书目与 EPUB 来自 <a href="https://github.com/mojimoon/wenku8" target="_blank" rel="noreferrer">mojimoon/wenku8</a>（MIT），由 GitHub Actions 每日从轻小说文库整理。封面来自轻小说文库（经 wsrv.nl 图片代理）与 Bangumi。</p>
          <p className="display">EBOOK · MMXXVI</p>
        </footer>
      </div>
    </div>
  );
}
