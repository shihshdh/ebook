import { Suspense, lazy, memo, startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HashRouter, NavigationType, Route, Routes, UNSAFE_LocationContext as LocationContext, useLocation, useNavigate } from 'react-router-dom';
import { PageActiveContext } from './lib/pageActive.js';
import NavBar from './components/NavBar.jsx';
import Splash, { shouldShowSplash } from './components/Splash.jsx';
import BookSheet from './components/BookSheet.jsx';
import UpdateCard from './components/UpdateCard.jsx';
import Toasts from './components/Toasts.jsx';
import WindowControls, { isDesktopClient } from './components/WindowControls.jsx';
import LockScreen from './components/LockScreen.jsx';
import { needsUnlock } from './lib/accounts.js';
import OpenTransition from './effects/OpenTransition.jsx';
import { UIProvider, useUIActions } from './lib/ui.jsx';
import { startDownloadWatch } from './lib/downloads.js';
import { onBackButton } from './lib/native.js';
import { loadLibrary, libraryBooks, classics, WORLDS, worldScore } from './lib/library.js';
import { prefetchCovers } from './lib/covers.js';
import { trackPointerGlow } from './lib/motion.js';
import './lib/press.js';   // 触屏按下反馈
import { lazyOptional } from './lib/optional.jsx';
import Home from './pages/Home.jsx';
import Explore, { prepareWorlds } from './pages/Explore.jsx';
import { atMost } from './lib/fonts.js';
import Search from './pages/Search.jsx';
import Shelf from './pages/Shelf.jsx';
import Plugins from './pages/Plugins.jsx';
import { warmer } from './lib/warm.js';
const Rss = lazy(() => import('./pages/Rss.jsx'));   // 订阅页按需加载

function ReaderMissing() {
  return <div className="page center-note"><p className="serif">阅读器还在装订中…</p></div>;
}
const Reader = lazyOptional(import.meta.glob('./pages/Reader.jsx'), ReaderMissing);

// 空闲时先在后台渲染好的几页（见 Shell 里的预渲染）
const PREWARM = [['explore', '/explore'], ['search', '/search'], ['shelf', '/shelf'], ['plugins', '/plugins']];

// 顶部导航的几页去过就留着（见 lib/pageActive.js）：按路径归到哪一页
const TAB_OF = (path) => path === '/' ? 'home' : ['explore', 'search', 'shelf', 'plugins', 'rss'].find(k => path === '/' + k || path.startsWith('/' + k + '/')) || 'home';

// memo：切页时只重渲染地址变了的那一页。以前每点一次导航，前台后台留着的五六页全部跟着重渲染一遍，
// 点击是「离散事件」，React 一口气同步做完不让出主线程，手机上一下五六十毫秒。
// 地址只比路径、查询、锚点和 state（各页都不看 location.key）：回到地址没变的页，换了个 location 对象也不用重来
const sameLocation = (a, b) => a === b || (a.pathname === b.pathname && a.search === b.search && a.hash === b.hash && a.state === b.state);
const Pages = memo(function Pages({ location }) {
  return (
    <Suspense fallback={<div className="page" />}>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/explore/:world" element={<Explore />} />
        <Route path="/search" element={<Search />} />
        <Route path="/shelf" element={<Shelf />} />
        <Route path="/plugins" element={<Plugins />} />
        <Route path="/rss" element={<Rss />} />
        <Route path="/rss/:id" element={<Rss />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Suspense>
  );
}, (a, b) => sameLocation(a.location, b.location));

function Shell() {
  const location = useLocation();
  const { pathname } = location;
  const reading = pathname.startsWith('/read/');
  // 去过的页面：每页记着它自己最后的地址（探索的世界、订阅的哪个源…）和滚动位置
  const tab = reading ? null : TAB_OF(pathname);
  const [kept, setKept] = useState(() => (tab ? { [tab]: location } : {}));
  const scrolls = useRef({});
  const shown = useRef(tab);
  // 当前账户设了 PIN、本次还没解锁：先挡住（不渲染书架内容），也不放开屏动画
  const [locked, setLocked] = useState(needsUnlock);
  const [splash, setSplash] = useState(() => shouldShowSplash() && !reading && !locked);

  const [libReady, setLibReady] = useState(false);
  useEffect(() => { loadLibrary().finally(() => setLibReady(true)); return trackPointerGlow(); }, []);

  // 空闲预渲染 + 预排版：还没去过的探索 / 搜索 / 书架 / 插件页，趁你停手时在后台一步步先做好，第一次点进去不用现做。
  //   1. 渲染：并发渲染（startTransition，React 每 5ms 让一次主线程），挂成后台页（content-visibility: hidden，不排版不画）
  //   2. 排版：一小块一小块排（lib/warm.js），每段几毫秒，段与段之间先画一帧；当前页面里先没排的区块（首页下半截）最先排；
  //      content-visibility: hidden 会留着排好的结果，点进去只剩绘制（以前手机上第一次进探索 / 书架要一两百毫秒，大半是现排）
  //   全部做完再预加载书源规则引擎（第一次搜书源时要现加载，手机上一百多毫秒）。
  // 停手 1.2 秒才开始，之后一步接一步；一有操作（滚、点、划、按键、输入）就停下，排到一半的记着，停手后接着排
  const keptRef = useRef(kept); keptRef.current = kept;
  const tabRef = useRef(tab); tabRef.current = tab;
  const routeEls = useRef({});
  const [warming, setWarming] = useState(null);
  const warmed = useRef(new Set()), warmers = useRef({}), engineReady = useRef(false), worldsReady = useRef(false);
  const [warmedEls, sectionWarmers] = useState(() => [new WeakSet(), new WeakMap()])[0];
  useEffect(() => {
    if (splash || locked || reading || !libReady) return;
    let timer = 0, running = null;   // running：正在分块排版的那一页 { stop }
    // 分块排一页：先让 React 挂上 data-warming，再一段段排；done() 时这页排完了
    const warmPage = (k, done) => {
      let stopped = false, raf = 0, t = 0;
      const next = () => { raf = requestAnimationFrame(() => { t = setTimeout(tick, 0); }); };
      const finish = () => { warmed.current.add(k); delete warmers.current[k]; setWarming(w => (w === k ? null : w)); done(); };
      const tick = () => {
        if (stopped) return;
        const route = routeEls.current[k];
        if (tabRef.current === k || !keptRef.current[k]) { finish(); return; }   // 已经点进去了，用不着
        if (!route) { next(); return; }   // 上一步的并发渲染还没把这页挂上
        if (!route.hasAttribute('data-warming')) { next(); return; }   // data-warming 还没挂上
        const run = warmers.current[k] || (warmers.current[k] = warmer(route.firstElementChild));
        if (run()) next(); else finish();
      };
      setWarming(k);
      next();
      return { stop: () => { stopped = true; cancelAnimationFrame(raf); clearTimeout(t); setWarming(w => (w === k ? null : w)); } };
    };
    // 分块排当前页面里先没排的区块（首页近年佳作往下那几块，content-visibility: auto）：排好的结果留着，
    // 滚到那里只剩绘制。正在屏幕上的不碰（它本来就排好了，临时锁住里面的块反而会闪）
    const warmSection = (el, done) => {
      let stopped = false, raf = 0, t = 0;
      const next = () => { raf = requestAnimationFrame(() => { t = setTimeout(tick, 0); }); };
      const finish = () => { el.removeAttribute('data-warming'); warmedEls.add(el); done(); };
      const tick = () => {
        if (stopped) return;
        if (!el.isConnected) { finish(); return; }
        let run = sectionWarmers.get(el);
        if (!run) sectionWarmers.set(el, run = warmer(el));
        if (run()) next(); else finish();
      };
      el.setAttribute('data-warming', '');
      next();
      return { stop: () => { stopped = true; cancelAnimationFrame(raf); clearTimeout(t); el.removeAttribute('data-warming'); } };
    };
    const skipped = (el) => el.firstElementChild && !el.firstElementChild.checkVisibility?.({ contentVisibilityAuto: true });
    const nextStep = () => {
      const lazy = [...document.querySelectorAll('.route.is-active .home-lazy')].find(el => !warmedEls.has(el));
      if (lazy) return (done) => { if (skipped(lazy)) return warmSection(lazy, done); warmedEls.add(lazy); done(); };
      for (const [k, path] of PREWARM) {
        if (!keptRef.current[k]) return (done) => { startTransition(() => setKept(prev => prev[k] ? prev : { ...prev, [k]: { pathname: path, search: '', hash: '', state: null, key: 'prewarm-' + k } })); done(); };
        // 换世界要用的字体（见 Explore.jsx 的 prepareWorlds）放在预排探索页之前、等它下好才往下走
        // （中途有人操作被叫停的话撤回标记，停手以后重来）
        if (k === 'explore' && !worldsReady.current) return (done) => {
          worldsReady.current = true;
          const r = prepareWorlds(libraryBooks(), done);
          return { stop: () => { r.stop(); worldsReady.current = false; } };
        };
        if (!warmed.current.has(k)) return (done) => {
          if (tabRef.current === k) { warmed.current.add(k); done(); return; }
          if (document.fonts?.status !== 'loading') return warmPage(k, done);
          // 还有字体在下（比如瀑布流、换世界的预取）：等它到了再排。分片到得晚的话，会把刚排好的整页衬线字作废，点进去照样现排
          let stopped = false, inner = null;
          atMost(document.fonts.ready, 3000).then(() => { if (!stopped) inner = warmPage(k, done); });
          return { stop: () => { stopped = true; inner?.stop(); } };
        };
      }
      if (!engineReady.current) return (done) => { engineReady.current = true; import('./plugins/legado/index.js').catch(() => { engineReady.current = false; }); done(); };
      return null;
    };
    // 一步做完、这期间没人操作，隔几帧就接着下一步（以前每步都等 1.2 秒，十几步排完要将近二十秒，
    // 打开 App 没多久就切页时，后台页还没排好）；一有操作才重新等停手 1.2 秒。
    // 操作事件里只记一下时间、停掉正在排的：滚动、指针移动每帧都来，以前每来一次都清掉计时器重设、再把下一步找一遍
    // （querySelectorAll 之类），滚首页时主线程白白多出一截。计时器到点时自己看停手够不够 1.2 秒
    let lastInput = 0;
    const tick = () => {
      timer = 0;
      const wait = 1200 - (performance.now() - lastInput);
      if (wait > 0) { timer = setTimeout(tick, wait); return; }
      const step = nextStep();
      if (step) running = step(() => { running = null; clearTimeout(timer); timer = nextStep() ? setTimeout(tick, 120) : 0; }) || running;
    };
    function later() {
      lastInput = performance.now();
      if (running) { running.stop(); running = null; }
      if (!timer) timer = setTimeout(tick, 1200);
    }
    const events = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart', 'scroll', 'input', 'compositionupdate'];
    events.forEach(t => addEventListener(t, later, { passive: true, capture: true }));
    later();
    // 封面也趁空闲先拉一批进缓存：探索页第一屏的精选、五个世界拼贴各前 7 张（排队里优先级最低，不和屏幕上的抢）
    const covers = setTimeout(() => {
      const books = libraryBooks();
      const worlds = WORLDS.flatMap(w => books.filter(b => b.tags.includes(w.tag)).sort((a, b) => worldScore(b, w.id) - worldScore(a, w.id)).slice(0, 7));
      prefetchCovers([...classics(books, 48), ...worlds]);
    }, 3000);
    return () => { running?.stop(); clearTimeout(timer); clearTimeout(covers); events.forEach(t => removeEventListener(t, later, { capture: true })); };
  }, [splash, locked, reading, libReady]);
  // 安卓返回键的最底层：不在首页就回上一页（没有历史就回首页），在首页交给系统退到后台。
  // 详情面板、阅读器各自在上面再挂一层，先关它们
  const navigate = useNavigate();
  const here = useRef(pathname); here.current = pathname;
  useEffect(() => onBackButton(() => {
    if (here.current === '/') return false;
    if (window.history.state?.idx > 0) navigate(-1); else navigate('/', { replace: true });
    return true;
  }), [navigate]);
  // 客户端：蓝奏云这类在浏览器里下好的书，回到窗口时自动放进书架
  const { toast } = useUIActions();
  useEffect(() => startDownloadWatch(({ ok, failed }, names) => {
    if (ok.length) toast(ok.length === 1 ? `已放进书架：${names[0].replace(/\.(epub|txt)$/i, '')}` : `已放进书架：${ok.length} 本`, { tone: 'ok', ms: 4200 });
    if (failed.length) toast(`${failed.length} 个文件没能导入`, { tone: 'error' });
  }), [toast]);
  useEffect(() => {
    const on = (e) => toast(`已导入账户「${e.detail.account.name}」，到「插件 · 账户」里切换过去`, { tone: 'ok', ms: 5200 });
    window.addEventListener('librarium:account-imported', on);
    return () => window.removeEventListener('librarium:account-imported', on);
  }, [toast]);
  // 切页：记下离开那一页滚到哪了；回到去过的页面接着原来的位置，同一页里换地址（换个世界、换个订阅源）回顶部。阅读器自己管滚动
  const lastPath = useRef(pathname);
  useLayoutEffect(() => {
    const prev = shown.current, prevPath = lastPath.current;
    lastPath.current = pathname;
    if (reading) { if (prev) scrolls.current[prev] = window.scrollY; shown.current = null; return; }
    if (prev && prev !== tab) scrolls.current[prev] = window.scrollY;
    shown.current = tab;
    setKept(k => (k[tab] === location ? k : { ...k, [tab]: location }));
    window.scrollTo(0, prev === tab && prevPath !== pathname ? 0 : scrolls.current[tab] || 0);
  }, [pathname, location.search]);
  // 每页自己的路由地址，地址没变就给同一个对象（套在 Pages 外面）。光有 Pages 的 memo 不够：里面的 <Routes location> 自己
  // 订着当前地址，地址一变（切页、搜索框同步到地址栏）就给整页换一个新的地址上下文，后台页里用 useNavigate / Link 的
  // 组件（首页、插件页……）跟着全部重渲染，手机上一次五六十毫秒。外面套一层不变的，后台页就纹丝不动
  const locCtx = useRef({});
  const locationContext = (k, loc) => {
    const prev = locCtx.current[k];
    return prev && sameLocation(prev.location, loc) ? prev : (locCtx.current[k] = { location: loc, navigationType: NavigationType.Pop });
  };

  if (locked) return (
    <>
      <LockScreen onUnlock={() => setLocked(false)} />
      {isDesktopClient && <WindowControls />}
    </>
  );

  return (
    <>
      <NavBar hidden={reading || splash} />
      {!reading && <div className="status-veil" aria-hidden="true" />}
      <main className="pages">
        {Object.entries(kept).map(([k, loc]) => {
          const active = k === tab;
          // 不在前台的：留着排版和渲染状态但不画、不占位置、点不到也聚焦不到（inert）
          return (
            <div key={k} ref={(el) => { routeEls.current[k] = el; }} className={`route ${active ? 'is-active' : 'is-kept'}`} data-warming={!active && warming === k ? '' : undefined} aria-hidden={active ? undefined : 'true'} inert={active ? undefined : ''}>
              <PageActiveContext.Provider value={active}>
                <LocationContext.Provider value={locationContext(k, active ? location : loc)}>
                  <Pages location={active ? location : loc} />
                </LocationContext.Provider>
              </PageActiveContext.Provider>
            </div>
          );
        })}
        {reading && (
          <div className="route route-reader is-active">
            <Suspense fallback={<div className="page" />}>
              <Routes><Route path="/read/:id" element={<Reader />} /></Routes>
            </Suspense>
          </div>
        )}
      </main>
      <BookSheet />
      <OpenTransition />
      <UpdateCard hidden={reading || splash || locked} />
      <Toasts />
      {splash && <Splash onDone={() => setSplash(false)} />}
      {isDesktopClient && <WindowControls autoHide={reading} />}
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <UIProvider>
        <Shell />
      </UIProvider>
    </HashRouter>
  );
}
