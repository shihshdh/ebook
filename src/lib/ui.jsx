// 全局 UI：打开书籍详情、轻提示、打开阅读器（带从封面展开的转场）
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const UI = createContext(null);
export const useUI = () => useContext(UI);

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

  const value = useMemo(() => ({ sheet, openBook, closeBook, toast, toasts, opening, openReader, endOpening: () => setOpening(null) }),
    [sheet, openBook, closeBook, toast, toasts, opening, openReader]);
  return <UI.Provider value={value}>{children}</UI.Provider>;
}
