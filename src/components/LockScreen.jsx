// 解锁：当前账户设了 PIN、本次打开还没解过锁时挡在最前面。
// 输够位数自动校验；错了抖一下。可以换别的账户。PIN 只是挡住别人随手打开（界面上照实说）。
import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import { checkPin, currentAccount, listAccounts, markUnlocked, switchAccount } from '../lib/accounts.js';
import { haptic } from '../lib/native.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function LockScreen({ onUnlock }) {
  const acc = currentAccount();
  const len = acc?.pin?.len || 6;
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(false);
  const [others, setOthers] = useState(false);
  const [forgot, setForgot] = useState(false);
  const busy = useRef(false);

  const press = (k) => {
    if (busy.current) return;
    setBad(false);
    if (k === 'del') setPin(p => p.slice(0, -1));
    else if (k) setPin(p => (p.length < len ? p + k : p));
  };

  useEffect(() => {
    if (pin.length < len) return;
    busy.current = true;
    checkPin(acc.id, pin).then(ok => {
      busy.current = false;
      if (ok) { markUnlocked(acc.id); onUnlock(); return; }
      haptic('medium');
      setBad(true);
      setTimeout(() => setPin(''), 360);
    });
  }, [pin]);

  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const rest = listAccounts().filter(a => a.id !== acc?.id);

  return (
    <div className="lock" role="dialog" aria-modal="true" aria-label="解锁账户" data-tauri-drag-region="deep">
      <div className="lock-card glass">
        <Avatar account={acc} size={76} />
        <h1 className="serif">{acc?.name}</h1>
        <p className="muted">输入 PIN 打开书架</p>
        <div className={`lock-dots ${bad ? 'is-bad' : ''}`} aria-live="polite" aria-label={`已输入 ${pin.length} 位`}>
          {Array.from({ length: len }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
        </div>
        <p className="lock-msg">{bad ? 'PIN 不对，再试一次' : '\u00a0'}</p>
        <div className="lock-pad">
          {KEYS.map((k, i) => k
            ? <button key={i} className="lock-key" onClick={() => press(k)} aria-label={k === 'del' ? '删除' : k}>{k === 'del' ? <Icon name="back" size={20} /> : <span className="num">{k}</span>}</button>
            : <span key={i} />)}
        </div>
        <div className="lock-foot">
          {rest.length > 0 && <button className="btn btn-ghost sm" onClick={() => setOthers(v => !v)}>换个账户</button>}
          <button className="btn btn-ghost sm" onClick={() => setForgot(v => !v)}>忘了 PIN？</button>
        </div>
        {others && (
          <ul className="lock-others">
            {rest.map(a => (
              <li key={a.id}><button onClick={() => switchAccount(a.id)}><Avatar account={a} size={30} /><span>{a.name}</span>{a.pin && <Icon name="lock" size={14} />}</button></li>
            ))}
          </ul>
        )}
        {forgot && <p className="lock-note muted">PIN 只存在这台设备上，没法找回。可以换到别的账户，在「插件 · 账户」里删掉这个账户——问 PIN 时输入完整的账户名代替（它的书架和笔记会一起删掉）。PIN 只是防止别人随手打开，书和笔记本身没有加密。</p>}
      </div>
    </div>
  );
}
