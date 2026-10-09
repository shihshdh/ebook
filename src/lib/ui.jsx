// 全局 UI：打开书籍详情、轻提示、打开阅读器（带从封面展开的转场）
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// 分两个上下文：动作（openBook、toast……，永远是同一组函数）和状态（打开的是哪本书、提示列表、转场）。
// 以前合在一个里，点开 / 关上一本书、弹一条提示，所有 useUI() 的组件都跟着重渲染——首页、插件页（书源列表一长串 Link）、
// 书架、搜索这些后台页全在里面，手机上每次点书二三十毫秒。只要动作的用 useUIActions()，状态变了不会牵连它们
const UIState = createContext(null);
const UIActions = createContext(null);
/** 状态 + 动作（详情面板、提示、转场这几个要看状态的用） */
export const useUI = () => ({ ...useContext(UIActions), ...useContext(UIState) });
/** 只要动作：openBook / closeBook / toast / openReader / endOpening，状态变了不会重渲染 */
export const useUIActions = () => useContext(UIActions);

export function UIProvider({ children }) {
  const [sheet, setSheet] = useState(null);           // { book, rect }
  const [toasts, setToasts] = useState([]);
  const [opening, setOpening] = useState(null);       // { item, rect, cover }
  const seq = useRef(0);

  const toast = useCallback((text, { tone = 'info', ms = 2600 } = {}) => {
    const id = ++seq.current;
    setToasts(t => [...t, { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ms);
  }, []);

  /** 打开书籍详情。rect：点击来源（封面）的位置，用于桌面侧板的入场方向 */
  const openBook = useCallback((book, el) => {
    setSheet({ book, rect: el?.getBoundingClientRect?.() || null });
  }, []);
  const closeBook = useCallback(() => setSheet(null), []);

  /** 打开阅读器：先播放从封面展开的转场，再切路由（转场组件负责 navigate） */
  const openReader = useCallback((item, el, cover) => {
    setOpening({ item, rect: el?.getBoundingClientRect?.() || null, cover: cover || item.cover || '' });
  }, []);

  const endOpening = useCallback(() => setOpening(null), []);

  const actions = useMemo(() => ({ openBook, closeBook, toast, openReader, endOpening }), [openBook, closeBook, toast, openReader, endOpening]);
  const state = useMemo(() => ({ sheet, toasts, opening }), [sheet, toasts, opening]);
  return <UIActions.Provider value={actions}><UIState.Provider value={state}>{children}</UIState.Provider></UIActions.Provider>;
}
