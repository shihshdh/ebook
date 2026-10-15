// Read/evaluate/screenshot the existing Tauri dev client without closing it.
import { openPage, sleep } from './perf/cdp.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
const p = await openPage(9223);
try {
  const [action, arg] = process.argv.slice(2);
  if (action === 'eval') console.log(JSON.stringify(await p.eval(arg), null, 2));
  else if (action === 'file') console.log(JSON.stringify(await p.eval(readFileSync(arg, 'utf8')), null, 2));
  else if (action === 'shot') {
    await sleep(700);
    const r = await p.send('Page.captureScreenshot', { format: 'png' });
    mkdirSync('docs/screenshots/comic', { recursive: true });
    writeFileSync(`docs/screenshots/comic/${arg}.png`, Buffer.from(r.data, 'base64'));
  } else if (action === 'size') {
    const mobile = arg === 'mobile';
    await p.send('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000, deviceScaleFactor: 1, mobile });
    await p.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    await p.send('Network.setUserAgentOverride', { userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' });
    await p.send('Page.reload');
  } else if (action === 'restore-size') {
    await p.send('Emulation.clearDeviceMetricsOverride');
    await p.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await p.send('Network.setUserAgentOverride', { userAgent: '' });
  } else throw new Error('eval <JS> | file <JS file> | shot <name> | size mobile/desktop | restore-size');
} finally { p.close(); }
