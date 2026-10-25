// Visible covers bypass background artwork; one slow host cannot occupy every slot.
// Keep Blobs in memory, never shared object URLs: each mounted consumer owns its URL.
// low：屏幕外的（拼贴、书墙下面几张、光盘两边）同时最多几张。以前只给 1 张，屏幕外的排成一条队一张一张往外挤
// （实测冷启动 40 秒里只发出 28 个图片请求，一张其实只要 1–1.5 秒）；屏幕上的照样随时插到最前面
export function coverLoader({ load, save, fetch, max = 6, perHost = 2, low = 1, keep = 120, timeout = 8000, failedFor = 3000 }) {
  const cache = new Map(), pending = new Map(), failures = new Map(), queue = [], hosts = new Map();
  let active = 0, background = 0;
  const priority = job => job.nears.some(near => near());
  function pump() {
    while (active < max) {
      const eligible = job => (hosts.get(job.host) || 0) < perHost && (priority(job) || background < low);
      let index = queue.findIndex(job => priority(job) && eligible(job));
      if (index < 0) index = queue.findIndex(eligible);
      if (index < 0) return;
      const job = queue.splice(index, 1)[0], isLow = !priority(job);
      active++; if (isLow) background++;
      hosts.set(job.host, (hosts.get(job.host) || 0) + 1);
      job.running = true;
      for (const h of job.hooks) h?.started?.();
      const controller = new AbortController();
      let timer;
      const expired = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('封面请求超时')); }, timeout); });
      Promise.race([Promise.resolve().then(() => fetch(job.sourceId, job.url, controller.signal)), expired])
        .then(blob => { save(job.key, blob); job.resolve(blob); }, job.reject)
        .finally(() => { clearTimeout(timer); active--; if (isLow) background--; hosts.set(job.host, hosts.get(job.host) - 1); pump(); });
    }
  }
  /** hooks：{ queued(), started() }——要排队等时调 queued，真开始下时调 started（firstCover 按这个决定什么时候叫备用源） */
  function get(sourceId, url, near = () => true, hooks) {
    const key = `${sourceId}|${url}`;
    if (cache.has(key)) { const blob = cache.get(key); cache.delete(key); cache.set(key, blob); return Promise.resolve(blob); }
    const hit = pending.get(key);
    if (hit) {
      hit.nears.push(near);
      if (hit.running) hooks?.started?.(); else { hooks?.queued?.(); hit.hooks.push(hooks); }
      pump();
      return hit.promise;
    }
    if (Date.now() - (failures.get(key) || 0) < failedFor) return Promise.reject(new Error('封面稍后重试'));
    const job = { key, sourceId, url, nears: [near], hooks: [hooks], running: false, host: (() => { try { return new URL(url).host; } catch { return sourceId; } })() };
    job.promise = Promise.resolve().then(() => load(key)).catch(() => null).then(saved => saved || new Promise((resolve, reject) => {
      Object.assign(job, { resolve, reject });
      queue.push(job);
      for (const h of job.hooks) h?.queued?.();
      pump();
    })).then(blob => { cache.set(key, blob); failures.delete(key); while (cache.size > keep) cache.delete(cache.keys().next().value); return blob; }, error => { failures.set(key, Date.now()); throw error; }).finally(() => pending.delete(key));
    pending.set(key, job);
    return job.promise;
  }
  get.refresh = pump;
  return get;
}

// Hedge a slow preferred source without waiting its full timeout. At most two
// source attempts per book run together; only the winning Blob becomes a URL.
// 备用源从「首选源真开始下载」那一刻起算：以前从排进队起算，队一堵，每部有两个源的漫画 0.7 秒后都多塞一张进队，越堵越多
export function firstCover(candidates, get, { stagger = 700 } = {}) {
  if (!candidates.length) return Promise.reject(new Error('没有取得到的封面'));
  return new Promise((resolve, reject) => {
    let next = 0, active = 0, done = false, timer;
    const arm = () => { clearTimeout(timer); if (!done && next < candidates.length && active < 2) timer = setTimeout(launch, stagger); };
    const launch = () => {
      clearTimeout(timer);
      if (done || next >= candidates.length || active >= 2) return;
      const c = candidates[next++]; active++;
      let queued = false;
      const hooks = { queued: () => { queued = true; clearTimeout(timer); }, started: () => { if (queued) { queued = false; arm(); } } };
      Promise.resolve().then(() => get(c, hooks)).then(blob => { if (!done) { done = true; clearTimeout(timer); resolve(blob); } }, () => {
        active--;
        if (done) return;
        if (next >= candidates.length && !active) { done = true; clearTimeout(timer); reject(new Error('没有取得到的封面')); }
        else launch();
      });
      arm();
    };
    launch();
  });
}
