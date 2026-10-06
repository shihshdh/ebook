// 网络诊断：平时只是一行说明，点「测速」才展开各条线路的延迟。
// 测出来的速度会写进 net.js 的本机记录，之后的请求直接先走最快的那条。
// 只测线路，不碰设备信息（用户明确不要在看书软件里看到设备配置）。
import { useState } from 'react';
import Icon from './Icon.jsx';
import { forgetNetStats, hostOf, probe, probeImage, releaseAssetUrls, repoFileUrls } from '../lib/net.js';
import { sourceCoverUrls } from '../lib/covers.js';

const NAMES = {
  'testingcf.jsdelivr.net': 'jsDelivr · testingcf', 'gcore.jsdelivr.net': 'jsDelivr · Gcore', 'originfastly.jsdelivr.net': 'jsDelivr · originfastly',
  'quantil.jsdelivr.net': 'jsDelivr · Quantil', 'fastly.jsdelivr.net': 'jsDelivr · Fastly', 'cdn.jsdelivr.net': 'jsDelivr 主站',
  'gh-proxy.org': 'gh-proxy 加速', 'edgeone.gh-proxy.org': 'gh-proxy · EdgeOne', 'ghfast.top': 'ghfast 加速', 'gh.llkk.cc': 'llkk 加速',
  'raw.githubusercontent.com': 'GitHub 直连', 'github.com': 'GitHub 直连',
  'wsrv.nl': 'wsrv 图片代理', 'i0.wp.com': 'WordPress 图片代理', 'img.wenku8.com': '原站直连',
  'api.bgm.tv': 'Bangumi', 'fonts.loli.net': '字体镜像（loli.net）',
};
const nameOf = (url) => NAMES[hostOf(url)] || hostOf(url);

function groups(books) {
  const out = [{ id: 'catalog', title: '书目', urls: repoFileUrls('mojimoon', 'wenku8', 'main', 'out/epub_index.json') }];
  // 下载线路拿书库里真实存在的文件来测，不写死
  const ill = books.find(b => b.illustrated)?.downloads.find(d => d.kind === 'illustrated');
  const vol = ill?.volumes?.slice().sort((a, b) => (a.size || 0) - (b.size || 0))[0];
  if (vol) out.push({ id: 'release', title: '插图版下载', urls: vol.urls });
  const txt = books.find(b => b.downloads.some(d => d.kind === 'txt'))?.downloads.find(d => d.kind === 'txt');
  if (txt) out.push({ id: 'txt', title: '纯文本下载', urls: txt.urls });
  const cover = books.find(b => /^\d+$/.test(b.aid || '') && b.coverSrc)?.coverSrc;
  if (cover) out.push({ id: 'cover', title: '封面', urls: sourceCoverUrls(cover), image: true });
  out.push({ id: 'misc', title: '其它', urls: ['https://api.bgm.tv/v0/subjects/1', 'https://fonts.loli.net/css2?family=Noto+Serif+SC:wght@600&display=swap'], each: true });
  return out;
}

// 同时最多测 4 条，免得互相抢带宽把结果测歪
async function pool(jobs, n = 4) {
  const queue = [...jobs];
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await queue.shift()(); }));
}

export default function NetDiag({ books = [] }) {
  const [state, setState] = useState(null);   // null | { running, groups:[{title, rows:[{url, name, ok, ms, error}]}] }

  const run = async () => {
    const gs = groups(books).map(g => ({ ...g, rows: g.urls.map(url => ({ url, name: nameOf(url) })) }));
    setState({ running: true, groups: gs });
    const update = () => setState(s => ({ ...s, groups: gs.map(g => ({ ...g, rows: [...g.rows] })) }));
    await pool(gs.flatMap(g => g.rows.map(row => async () => {
      Object.assign(row, await (g.image ? probeImage(row.url) : probe(row.url)));
      update();
    })));
    setState(s => ({ ...s, running: false }));
  };

  const reset = () => { forgetNetStats(); setState(null); };

  return (
    <div className="netdiag">
      <div className="netdiag-head">
        <p className="muted">书目、下载、封面都有好几条线路，自动走本机最快的那条，不用开代理。换了网络觉得慢，可以测一次。</p>
        <div className="netdiag-actions">
          <button className="btn sm" onClick={run} disabled={state?.running}><Icon name="refresh" size={16} />{state?.running ? '测速中…' : state ? '重新测' : '测速'}</button>
          {state && !state.running && <button className="btn btn-ghost sm" onClick={reset}>忘掉记录</button>}
        </div>
      </div>
      {state && (
        <div className="netdiag-groups">
          {state.groups.map(g => {
            const best = g.each ? null : g.rows.filter(r => r.ok).sort((a, b) => a.ms - b.ms)[0];
            return (
              <section key={g.id} className="netdiag-group">
                <h3>{g.title}{best && <span>用 {best.name}</span>}{!g.each && g.rows.every(r => 'ok' in r) && !best && <em>全部不通</em>}</h3>
                <ul>
                  {g.rows.map(r => (
                    <li key={r.url} className={`${r.ok === false ? 'is-bad' : ''} ${r === best ? 'is-best' : ''}`}>
                      <span className="netdiag-name">{r.name}</span>
                      <span className="netdiag-bar" aria-hidden="true"><b style={{ transform: `scaleX(${r.ok ? Math.min(1, r.ms / 3000) : 'ok' in r ? 1 : 0})` }} /></span>
                      <span className="netdiag-ms num">{!('ok' in r) ? '…' : r.ok ? `${r.ms} ms` : r.error}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
