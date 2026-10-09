// 极简 CDP 客户端：启动 Edge（有界面，走真显卡），开一个页面，发命令、收事件。只用于本机测量 / 调试。
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// 浏览器：默认本机 Edge；云端 / Linux 用 BROWSER=/usr/bin/google-chrome（或 chromium）指定
const EDGE = process.env.BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function launch({ port = 9333, profile, width = 1440, height = 900, headless = false } = {}) {
  mkdirSync(profile, { recursive: true });
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-sync', '--disable-features=Translate,msEdgeSidebarV2,msHubApps,CalculateNativeWinOcclusion',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', `--window-size=${width},${height}`, '--window-position=40,40',
    ...(headless ? ['--headless=new'] : []), 'about:blank'];
  const proc = spawn(EDGE, args, { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) break; } catch {}
    await sleep(250);
  }
  const close = async () => { try { const b = await connect((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl); await b.send('Browser.close'); } catch {} try { proc.kill(); } catch {} };
  return { port, proc, close };
}

export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map(), listeners = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
    else if (msg.method) (listeners.get(msg.method) || []).forEach(fn => fn(msg.params));
  };
  return {
    send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }),
    on: (method, fn) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); },
    close: () => ws.close(),
  };
}

/** 打开一个页面，返回 { send, on, eval, close } */
export async function openPage(port, url) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const t = targets.find(x => x.type === 'page');
  const p = await connect(t.webSocketDebuggerUrl);
  await p.send('Page.enable'); await p.send('Runtime.enable');
  const logs = [];
  p.on('Runtime.consoleAPICalled', e => logs.push(`[${e.type}] ${e.args.map(a => a.value ?? a.description ?? '').join(' ')}`));
  p.on('Runtime.exceptionThrown', e => logs.push(`[exception] ${e.exceptionDetails?.exception?.description || e.exceptionDetails?.text}`));
  const evaluate = async (expr) => {
    const r = await p.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  if (url) { await p.send('Page.navigate', { url }); }
  return { ...p, eval: evaluate, logs };
}
export { sleep };
