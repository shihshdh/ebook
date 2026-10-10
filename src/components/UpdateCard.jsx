// 有新版时在首页弹一张卡片：更新 / 以后。
//   · 每次打开都查：开屏放完 1.2 秒后查一次；「以后」只管这一次打开，下次打开还会弹（见 lib/update.js）
//   · 自动查到的只在首页弹（在别的页就等回到首页）；插件页手动「检查更新」查到的当场弹
//   · 下载走国内能直连的 GitHub 加速代理，按本机实测快慢排，直连 github.com 垫底；下完核对 SHA-256
//   · 下载中可以取消；分步显示（下载 → 校验 → 打开安装器）；下了 25 秒还没好、或者没下成，给一个「用浏览器下载」的退路
//     （0.3.15 上有人卡在 100% 不动：某一路下到的不是安装包、作废以后进度条没退回，别的线路又慢）
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { browserDownloadUrl, checkUpdate, current, installUpdate, skipUpdate } from '../lib/update.js';
import { useUIActions } from '../lib/ui.jsx';

export default function UpdateCard({ hidden }) {
  const { toast } = useUIActions();
  const { pathname } = useLocation();
  const [upd, setUpd] = useState(null);      // { version, notes, file, sha256, manual }
  const [state, setState] = useState('idle');   // idle | loading | done
  const [p, setP] = useState(0);
  const [phase, setPhase] = useState('download');   // download | verify | install
  const [slow, setSlow] = useState(false);          // 下了 25 秒还没好
  const [failed, setFailed] = useState(false);      // 上一次没下成
  const run = useRef(null);                         // 正在下的那次：AbortController
  const checked = useRef(false);
  const goBtn = useRef(null);

  // 开屏放完再查（不和开屏抢），一次打开只自动查一次
  useEffect(() => {
    if (hidden || checked.current) return;
    checked.current = true;
    let dead = false;
    const t = setTimeout(() => checkUpdate().then(u => { if (!dead && u) setUpd(u); }).catch(e => console.info('[update]', e?.message)), 1200);
    return () => { dead = true; clearTimeout(t); };
  }, [hidden]);
  // 插件页「检查更新」按钮发这个事件：当场弹
  useEffect(() => {
    const manual = (e) => { setState('idle'); setUpd({ ...e.detail, manual: true }); };
    window.addEventListener('librarium:update', manual);
    return () => window.removeEventListener('librarium:update', manual);
  }, []);

  const open = !!upd && !hidden && state !== 'done' && (upd.manual || pathname === '/');
  const later = () => { if (state === 'loading') return; skipUpdate(upd.version); setUpd(null); };
  useEffect(() => {
    if (!open) return;
    goBtn.current?.focus({ preventScroll: true });
    const key = (e) => { if (e.key === 'Escape') later(); };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [open, state]);

  useEffect(() => {
    if (state !== 'loading') return;
    setSlow(false);
    const t = setTimeout(() => setSlow(true), 25000);
    return () => clearTimeout(t);
  }, [state]);

  if (!open) return null;

  const go = async () => {
    const ctl = new AbortController();
    run.current = ctl;
    setState('loading'); setP(0); setPhase('download'); setFailed(false);
    try {
      const msg = await installUpdate(upd, setP, { onPhase: setPhase, signal: ctl.signal });
      setState('done');
      toast(msg, { tone: 'ok', ms: 6000 });
    } catch (e) {
      setState('idle');
      if (ctl.signal.aborted) return;   // 自己点了取消
      setFailed(true);
      toast('更新没下成：' + (e?.message || '网络错误'), { tone: 'error', ms: 4000 });
    } finally {
      if (run.current === ctl) run.current = null;
    }
  };
  const cancel = () => run.current?.abort();
  const label = phase === 'verify' ? '校验中…' : phase === 'install' ? '打开安装器…' : p ? Math.round(p * 100) + '%' : '连接中…';

  return (
    <div className="upd-layer">
      <div className="upd-scrim" onClick={later} />
      <section className="upd-card glass-dense" role="dialog" aria-modal="true" aria-labelledby="upd-title">
        <p className="eyebrow">NEW VERSION · 有新版本</p>
        <h2 id="upd-title" className="serif">EBOOK {upd.version}</h2>
        <p className="upd-ver muted num">当前 {current}</p>
        {upd.notes && <p className="upd-notes">{upd.notes}</p>}
        <div className="upd-actions">
          {state === 'loading'
            ? <div className="upd-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
                <span className="upd-track" style={{ '--p': p }}><i /></span>
                <span className="num muted">{label}</span>
                {phase === 'download' && <button className="btn btn-ghost sm upd-cancel" onClick={cancel}>取消</button>}
              </div>
            : <>
                <button ref={goBtn} className="btn btn-gold" onClick={go}><Icon name="download" size={16} />更新</button>
                <button className="btn btn-ghost" onClick={later}>以后</button>
              </>}
        </div>
        {(state === 'loading' && slow) || (state === 'idle' && failed)
          ? <p className="upd-foot muted">{failed ? '没下成？' : '下得慢？'}可以<a href={browserDownloadUrl(upd)} target="_blank" rel="noreferrer">用浏览器下载</a>，下好后手动安装</p>
          : <p className="upd-foot muted">经国内加速线路下载，下完自动校验安装包</p>}
      </section>
    </div>
  );
}
