// A deadline covers source boot, callbacks and native HTTP together.
export function requestBudget(run, { timeout = 12000, signal, message = '漫画源响应超时，请重试或切换漫画源' } = {}) {
  const ctl = new AbortController();let timer,abort;
  const stopped = new Promise((_,reject) => {
    abort = () => { const error = new DOMException('已取消','AbortError');ctl.abort(error);reject(error); };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>{const error=new Error(message);error.name='TimeoutError';ctl.abort(error);reject(error);},timeout);
  });
  return Promise.race([stopped,Promise.resolve().then(()=>{ctl.signal.throwIfAborted();return run(ctl.signal);})])
    .finally(()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);});
}
export const transientComicError = error => /network|fetch|ECONN|HTTP 50[0234]/i.test(error?.message||'') && !/403|404|429|验证码|登录|权限|取消|abort/i.test(error?.message||'');
