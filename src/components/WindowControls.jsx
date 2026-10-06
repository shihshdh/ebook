// Windows 客户端的窗口按钮（最小化 / 最大化 / 关闭）。窗口是无边框的，标题栏由 EBOOK 自己画：
//   · 拖动：顶栏、阅读器顶栏带 data-tauri-drag-region="deep"，空白处按住就能拖，双击最大化
//   · 按钮：固定在右上角，尺寸和位置同 Windows 原生（46×32），关闭悬停是系统红
//   · 阅读时和全屏时自动隐藏，鼠标移到顶部 72px 内才出来（和阅读器工具栏同一个触发区）
// 只在 Tauri 里渲染；网页和安卓不出现。
import { useEffect, useRef, useState } from 'react';
import { platform, win } from '../lib/native.js';

const Glyph = ({ d }) => <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1" /></svg>;

export default function WindowControls({ autoHide = false }) {
  const [max, setMax] = useState(false);
  const [full, setFull] = useState(false);
  const [near, setNear] = useState(false);
  const timer = useRef(0);

  useEffect(() => win.onMaximizedChange(setMax), []);

  // F11 全屏；Esc 退出全屏（阅读器自己也用 Esc 关面板，所以只在全屏时接管）
  useEffect(() => {
    const onKey = async (e) => {
      if (e.key === 'F11') { e.preventDefault(); const f = !(await win.isFullscreen()); await win.setFullscreen(f); setFull(f); }
      else if (e.key === 'Escape' && full) { await win.setFullscreen(false); setFull(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const hiding = autoHide || full;
  useEffect(() => {
    if (!hiding) return;
    const onMove = (e) => {
      const n = e.clientY < 72;
      clearTimeout(timer.current);
      if (n) setNear(true);
      else timer.current = setTimeout(() => setNear(false), 1200);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); clearTimeout(timer.current); };
  }, [hiding]);

  return (
    <div className={`win-controls ${hiding && !near ? 'is-hidden' : ''}`} role="group" aria-label="窗口">
      <button onClick={() => win.minimize()} aria-label="最小化" title="最小化"><Glyph d="M0 5.5h10" /></button>
      <button onClick={() => win.toggleMaximize()} aria-label={max ? '还原' : '最大化'} title={max ? '还原' : '最大化'}>
        {max ? <Glyph d="M2.5 2.5V.5h7v7h-2M.5 2.5h7v7h-7z" /> : <Glyph d="M.5.5h9v9h-9z" />}
      </button>
      <button className="is-close" onClick={() => win.close()} aria-label="关闭" title="关闭"><Glyph d="M.5.5l9 9M9.5.5l-9 9" /></button>
    </div>
  );
}

export const isDesktopClient = platform === 'tauri';
