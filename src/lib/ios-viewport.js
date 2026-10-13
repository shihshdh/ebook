// 键盘弹出时把可见区域写进 --visual-height / --visual-top，面板、阅读器留在可见区里，底栏藏起来（keyboard-open）。
// iPhone 的键盘盖在页面上（innerHeight 不变、visualViewport 变矮）；安卓的窗口会跟着变矮（innerHeight 也变）——
// 所以拿「这个宽度下见过的最大高度」当基准，两边都认得出键盘
export function setupIOSViewport() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let frame = 0, previous = '', full = 0, fullWidth = 0;
  const update = () => {
    frame = 0;
    const height = Math.round(viewport?.height || innerHeight);
    const top = Math.round(viewport?.offsetTop || 0);
    if (innerWidth !== fullWidth) { fullWidth = innerWidth; full = 0; }   // 转屏：重新记基准
    full = Math.max(full, innerHeight);
    const keyboard = full - height > 120;
    const key = `${height}:${top}:${keyboard}`;
    if (key === previous) return;
    previous = key;
    root.style.setProperty('--visual-height', `${height}px`);
    root.style.setProperty('--visual-top', `${top}px`);
    root.classList.toggle('keyboard-open', keyboard);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  update();
  return () => {
    cancelAnimationFrame(frame);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
  };
}
