// adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>
// Open a comic source's settings first. Never evaluate the probe in the top frame.
import { connect } from './perf/cdp.mjs';
const port = Number(process.argv[2] || 9333);
if ([5181, 9223].includes(port)) throw new Error('Reserved development port');
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find(t => t.type === 'page' && /^https?:\/\/localhost/.test(t.url));
if (!target) throw new Error('App WebView not found');
const cdp = await connect(target.webSocketDebuggerUrl);
const deadline = setTimeout(() => { console.error('Probe timed out'); process.exit(1); }, 20000);
try {
  const contexts = [];
  cdp.on('Runtime.executionContextCreated', e => contexts.push(e.context));
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const frames = [];
  const visit = t => { frames.push(t.frame); (t.childFrames || []).forEach(visit); };
  visit(frameTree);
  const frame = frames.find(f => f.parentId && f.url === 'about:srcdoc');
  const context = contexts.find(c => c.auxData?.frameId === frame?.id && c.auxData?.isDefault);
  if (!context) throw new Error('No srcdoc default context: expand a comic source settings panel');
  const expression = ` (async () => {
    const out = { androidBridge: typeof androidBridge, Capacitor: typeof Capacitor, webkit: typeof webkit, origin: self.origin };
    try { const r = await fetch('https://example.com'); out.fetch = 'UNBLOCKED ' + r.status; }
    catch (e) { out.fetch = e.name + ': ' + e.message; }
    out.xhr = await new Promise(resolve => { try { const x = new XMLHttpRequest(); x.timeout = 5000; x.onload = () => resolve('UNBLOCKED ' + x.status); x.onerror = () => resolve('error (blocked)'); x.ontimeout = () => resolve('TIMEOUT (inconclusive)'); x.open('GET','https://example.com'); x.send(); } catch(e) { resolve(e.name + ': ' + e.message); } });
    try { const r = indexedDB.open('x'); out.indexedDB = await new Promise(resolve => { r.onerror = () => resolve(r.error.name); r.onsuccess = () => { r.result.close(); resolve('UNBLOCKED'); }; }); }
    catch(e) { out.indexedDB = e.name + ': ' + e.message; }
    return out;
  })()`;
  const result = await cdp.send('Runtime.evaluate', { contextId: context.id, expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  console.log(JSON.stringify({ target: target.url, frame, context, probe: result.result.value }, null, 2));
  const p = result.result.value;
  if (p.androidBridge !== 'undefined' || p.Capacitor !== 'undefined' || !p.fetch.startsWith('TypeError') || !/blocked|SecurityError/.test(p.xhr) || !p.indexedDB.startsWith('SecurityError')) process.exitCode = 1;
} finally { clearTimeout(deadline); cdp.close(); }
