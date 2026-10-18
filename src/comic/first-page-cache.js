// 详情页只预取即将阅读的一张图；不创建 blob URL，不缓存整话。
export function firstPageCache({ limit = 2, maxBytes = 4 * 1024 * 1024, ttl = 60000, now = Date.now } = {}) {
  const entries = new Map();
  const prune = () => { for (const [key, entry] of entries) if (now() - entry.at >= ttl) entries.delete(key); };
  return {
    warm(key, load) {
      prune(); if (entries.has(key) || entries.size >= limit) return;
      const entry = { at: now() };
      entry.promise = Promise.resolve().then(load).then(blob => {
        if (blob.size > maxBytes && entries.get(key) === entry) entries.delete(key);
        return blob;
      }, error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
      entries.set(key, entry); entry.promise.catch(() => {});
    },
    take(key, signal) {
      prune(); const entry = entries.get(key); if (!entry) return null;
      entries.delete(key);
      return new Promise((resolve, reject) => {
        const abort = () => { cleanup(); reject(new DOMException('已取消', 'AbortError')); };
        const cleanup = () => signal?.removeEventListener('abort', abort);
        if (signal?.aborted) return abort();
        signal?.addEventListener('abort', abort, { once: true });
        entry.promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
      });
    },
  };
}
