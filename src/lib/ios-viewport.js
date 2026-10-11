// Keep dialogs inside the visible viewport when the iPhone keyboard opens.
export function setupIOSViewport() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let frame = 0, previous = '';
  const update = () => {
    frame = 0;
    const height = Math.round(viewport?.height || innerHeight);
    const top = Math.round(viewport?.offsetTop || 0);
    const keyboard = innerHeight - height > 120;
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
