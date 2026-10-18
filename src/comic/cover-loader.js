// Visible covers bypass background artwork; one slow host cannot occupy every slot.
// Keep Blobs in memory, never shared object URLs: each mounted consumer owns its URL.
export function coverLoader({ load, save, fetch, max = 6, perHost = 2, keep = 120, timeout = 8000, failedFor = 3000 }) {
  const cache = new Map(), pending = new Map(), failures = new Map(), queue = [], hosts = new Map();
  let active = 0, background = 0;
  const priority = job => job.nears.some(near => near());
  function pump() {
    while (active < max) {
      const eligible = job => (hosts.get(job.host) || 0) < perHost && (priority(job) || background < 1);
      let index = queue.findIndex(job => priority(job) && eligible(job));
      if (index < 0) index = queue.findIndex(eligible);
      if (index < 0) return;
      const job = queue.splice(index, 1)[0], low = !priority(job);
      active++; if (low) background++;
      hosts.set(job.host, (hosts.get(job.host) || 0) + 1);
      const controller = new AbortController();
      let timer;
      const expired = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('封面请求超时')); }, timeout); });
      Promise.race([Promise.resolve().then(() => fetch(job.sourceId, job.url, controller.signal)), expired])
        .then(blob => { save(job.key, blob); job.resolve(blob); }, job.reject)
        .finally(() => { clearTimeout(timer); active--; if (low) background--; hosts.set(job.host, hosts.get(job.host) - 1); pump(); });
    }
  }
  function get(sourceId, url, near = () => true) {
    const key = `${sourceId}|${url}`;
    if (cache.has(key)) { const blob = cache.get(key); cache.delete(key); cache.set(key, blob); return Promise.resolve(blob); }
    const hit = pending.get(key);
    if (hit) { hit.nears.push(near); pump(); return hit.promise; }
    if (Date.now() - (failures.get(key) || 0) < failedFor) return Promise.reject(new Error('封面稍后重试'));
    const job = { key, sourceId, url, nears: [near], host: (() => { try { return new URL(url).host; } catch { return sourceId; } })() };
    job.promise = Promise.resolve().then(() => load(key)).catch(() => null).then(saved => saved || new Promise((resolve, reject) => {
      Object.assign(job, { resolve, reject }); queue.push(job); pump();
    })).then(blob => { cache.set(key, blob); failures.delete(key); while (cache.size > keep) cache.delete(cache.keys().next().value); return blob; }, error => { failures.set(key, Date.now()); throw error; }).finally(() => pending.delete(key));
    pending.set(key, job);
    return job.promise;
  }
  get.refresh = pump;
  return get;
}

// Hedge a slow preferred source without waiting its full timeout. At most two
// source attempts per book run together; only the winning Blob becomes a URL.
export function firstCover(candidates, get, { stagger = 700 } = {}) {
  if (!candidates.length) return Promise.reject(new Error('没有取得到的封面'));
  return new Promise((resolve, reject) => {
    let next = 0, active = 0, done = false, timer;
    const launch = () => {
      clearTimeout(timer);
      if (done || next >= candidates.length || active >= 2) return;
      const c = candidates[next++]; active++;
      Promise.resolve().then(() => get(c)).then(blob => { if (!done) { done = true; clearTimeout(timer); resolve(blob); } }, () => {
        active--;
        if (done) return;
        if (next >= candidates.length && !active) { done = true; clearTimeout(timer); reject(new Error('没有取得到的封面')); }
        else launch();
      });
      if (next < candidates.length && active < 2) timer = setTimeout(launch, stagger);
    };
    launch();
  });
}
