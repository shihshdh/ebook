import { Suspense, lazy, startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
import { UIProvider, useUI } from './lib/ui.jsx';
import { startDownloadWatch } from './lib/downloads.js';
import { onBackButton } from './lib/native.js';
import { loadLibrary, libraryBooks, classics, WORLDS, worldScore } from './lib/library.js';
import { prefetchCovers } from './lib/covers.js';
import { trackPointerGlow } from './lib/motion.js';
import { lazyOptional } from './lib/optional.jsx';
import Home from './pages/Home.jsx';
import Explore from './pages/Explore.jsx';
import Search from './pages/Search.jsx';
import Shelf from './pages/Shelf.jsx';
import Plugins from './pages/Plugins.jsx';
const Rss = lazy(() => import('./pages/Rss.jsx'));   // 订阅页按需加载

function ReaderMissing() {
  return <div className="page center-note"><p className="serif">阅读器还在装订中…</p></div>;
}
const Reader = lazyOptional(import.meta.glob('./pages/Reader.jsx'), ReaderMissing);

// 空闲时先在后台渲染好的几页（见 Shell 里的预渲染）
const PREWARM = [['explore', '/explore'], ['search', '/search'], ['shelf', '/shelf'], ['plugins', '/plugins']];

// 顶部导航的几页去过就留着（见 lib/pageActive.js）：按路径归到哪一页
const TAB_OF = (path) => path === '/' ? 'home' : ['explore', 'search', 'shelf', 'plugins', 'rss'].find(k => path === '/' + k || path.startsWith('/' + k + '/')) || 'home';

function Pages({ location }) {
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
}

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

  // 空闲预渲染：还没去过的探索 / 搜索 / 书架 / 插件页，趁你停手时在后台先渲染好。
  // 用并发渲染（startTransition，React 每 5ms 让一次主线程），挂成后台页（content-visibility: hidden，不排版不画），
  // 第一次点进去就只剩排版和绘制——以前点进探索页那一帧要把渲染、筛选排序、排版、绘制全做完，一百多毫秒。
  // 一有操作（滚、点、划、按键）就停，停手 1.2 秒再接着来，一次只渲染一页
  const keptRef = useRef(kept); keptRef.current = kept;
  useEffect(() => {
    if (splash || locked || reading || !libReady) return;
    let timer = 0;
    const next = () => PREWARM.find(([k]) => !keptRef.current[k]);
    const later = () => { clearTimeout(timer); if (next()) timer = setTimeout(run, 1200); };
    const run = () => {
      const item = next();
      if (!item) return;
      const [k, path] = item;
      startTransition(() => setKept(prev => prev[k] ? prev : { ...prev, [k]: { pathname: path, search: '', hash: '', state: null, key: 'prewarm-' + k } }));
      later();
    };
    const events = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart', 'scroll'];
    events.forEach(t => addEventListener(t, later, { passive: true, capture: true }));
    later();
    // 封面也趁空闲先拉一批进缓存：探索页第一屏的精选、五个世界拼贴各前 7 张（排队里优先级最低，不和屏幕上的抢）
    const covers = setTimeout(() => {
      const books = libraryBooks();
      const worlds = WORLDS.flatMap(w => books.filter(b => b.tags.includes(w.tag)).sort((a, b) => worldScore(b, w.id) - worldScore(a, w.id)).slice(0, 7));
      prefetchCovers([...classics(books, 48), ...worlds]);
    }, 3000);
    return () => { clearTimeout(timer); clearTimeout(covers); events.forEach(t => removeEventListener(t, later, { capture: true })); };
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
  const { toast } = useUI();
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
            <div key={k} className={`route ${active ? 'is-active' : 'is-kept'}`} aria-hidden={active ? undefined : 'true'} inert={active ? undefined : ''}>
              <PageActiveContext.Provider value={active}>
                <Pages location={k === tab ? location : loc} />
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
