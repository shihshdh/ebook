let worker, failed = false, seq = 0;
const pending = new Map();
export function decodeImageBytes(data, signal) {
  if (failed || typeof Worker === 'undefined') return null;
  if (!worker) {
    try { worker = new Worker(new URL('./image-bytes.worker.js', import.meta.url), { type: 'module' }); }
    catch { failed = true; return null; }
    worker.onmessage = ({ data }) => {
      const entry = pending.get(data.id); if (!entry) return;
      if (data.error) entry.reject(new Error(data.error)); else entry.resolve(new Uint8Array(data.bytes));
    };
    worker.onerror = event => {
      event.preventDefault(); failed = true;
      for (const entry of [...pending.values()]) entry.reject(new Error(event.message || '图片解码线程不可用'));
      worker.terminate(); worker = null;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const finish = (settle, value) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); pending.delete(id); settle(value); };
    const abort = () => finish(reject, new DOMException('已取消', 'AbortError'));
    const timer = setTimeout(() => finish(reject, new Error('图片解码超时')), 10000);
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    pending.set(id, { resolve: value => finish(resolve, value), reject: error => finish(reject, error) });
    try { worker.postMessage({ id, data }); } catch (error) { finish(reject, error); }
  });
}
