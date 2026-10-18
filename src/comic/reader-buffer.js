// Bounded, direction-aware page downloads. Each task owns its cancellation and URL.
// A jump cancels obsolete work; a visible page never waits behind a full speculative window.
export function readerBuffer({ length, load, change, dispose = page => page?.url && URL.revokeObjectURL(page.url), ahead = 4, behind = 2, concurrency = 3 }) {
  const ready = new Map(), active = new Map();
  let center = 0, direction = 1, pinned = new Set(), order = [], dead = false;
  const emit = () => { if (!dead) change(Object.fromEntries(ready)); };
  const cancel = i => { const task = active.get(i); active.delete(i); task?.abort(); };
  const pump = () => {
    if (dead) return;
    // Promote a newly visible page by releasing the least useful speculative task.
    if (!ready.has(center) && !active.has(center) && active.size >= concurrency) {
      const victim = [...active.keys()].reverse().find(i => i !== center);
      if (victim != null) cancel(victim);
    }
    for (const i of order) {
      if (active.size >= concurrency) break;
      if (ready.has(i) || active.has(i)) continue;
      const controller = new AbortController(); active.set(i, controller);
      Promise.resolve().then(() => { controller.signal.throwIfAborted(); return load(i, { signal: controller.signal, front: i === center }); }).then(page => {
        if (dead || active.get(i) !== controller) { dispose(page); return; }
        ready.set(i, page); emit();
      }, error => {
        if (!dead && active.get(i) === controller && !controller.signal.aborted) {
          ready.set(i, { error: String(error?.message || '没取到').slice(0, 60) }); emit();
        }
      }).finally(() => {
        if (active.get(i) === controller) active.delete(i);
        pump();
      });
    }
  };
  return {
    window(at, { pin = [], reverse = false } = {}) {
      if (dead) return;
      center = Math.max(0, Math.min(length - 1, at)); direction = reverse ? -1 : 1; pinned = new Set(pin);
      order = [center];
      for (let n = 1; n <= ahead; n++) order.push(center + n * direction);
      for (let n = 1; n <= behind; n++) order.push(center - n * direction);
      order = order.filter(i => i >= 0 && i < length);
      const keep = new Set([...order, ...pinned]);
      for (const i of active.keys()) if (!keep.has(i)) cancel(i);
      let changed = false;
      for (const [i, page] of ready) if (!keep.has(i)) { dispose(page); ready.delete(i); changed = true; }
      if (changed) emit();
      pump();
    },
    // Transfer the outgoing painted page to the chapter-transition owner.
    detach(i) { const page = ready.get(i); if (page?.url) { ready.delete(i); return page; } return null; },
    retry(i) { const old = ready.get(i); if (old) dispose(old); ready.delete(i); cancel(i); emit(); pump(); },
    destroy() {
      dead = true;
      for (const i of active.keys()) cancel(i);
      for (const page of ready.values()) dispose(page);
      ready.clear(); order = [];
    },
  };
}
