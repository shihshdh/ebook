// 有新版时在底部弹一条：更新 / 以后再说。启动 8 秒后查一次，不打扰开屏。
import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { checkUpdate, installUpdate, skipUpdate } from '../lib/update.js';
import { useUI } from '../lib/ui.jsx';

export default function UpdateBanner({ hidden }) {
  const { toast } = useUI();
  const [upd, setUpd] = useState(null);
  const [state, setState] = useState('idle');   // idle | loading | done
  const [p, setP] = useState(0);

  useEffect(() => {
    let dead = false;
    const t = setTimeout(() => checkUpdate().then(u => { if (!dead) setUpd(u); }).catch(e => console.info('[update]', e?.message)), 8000);
    // 插件页「检查更新」按钮会发这个事件
    const manual = (e) => setUpd(e.detail);
    window.addEventListener('librarium:update', manual);
    return () => { dead = true; clearTimeout(t); window.removeEventListener('librarium:update', manual); };
  }, []);

  if (!upd || hidden || state === 'done') return null;

  const go = async () => {
    setState('loading'); setP(0);
    try {
      const msg = await installUpdate(upd, setP);
      setState('done');
      toast(msg, { tone: 'ok', ms: 6000 });
    } catch (e) {
      setState('idle');
      toast('更新没下成：' + (e?.message || '网络错误'), { tone: 'error', ms: 4000 });
    }
  };

  return (
    <div className="update-banner glass" role="status">
      <span className="update-dot" aria-hidden="true" />
      <span className="update-text">EBOOK {upd.version} 可以更新了{upd.notes ? <small className="muted">{upd.notes}</small> : null}</span>
      {state === 'loading'
        ? <span className="update-p num">{p ? Math.round(p * 100) + '%' : '下载中'}</span>
        : <>
            <button className="btn btn-gold sm" onClick={go}><Icon name="download" size={15} />更新</button>
            <button className="btn btn-ghost sm" onClick={() => { skipUpdate(upd.version); setUpd(null); }}>以后</button>
          </>}
    </div>
  );
}
