// 顶栏头像（电脑）：点开是账户列表，一键切换；底下去设置页管理。手机上顶栏不显示，入口在「插件 · 账户」。
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import { switchAccount, useAccounts } from '../lib/accounts.js';

export default function AccountMenu() {
  const { list, current } = useAccounts();
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off);
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', off); window.removeEventListener('keydown', key); };
  }, [open]);

  return (
    <div className="acct-menu" ref={root}>
      <button className="acct-trigger glass" onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open} title={`账户：${current.name}`}>
        <Avatar account={current} size={32} />
      </button>
      {open && (
        <div className="acct-pop glass-dense" role="menu">
          <p className="eyebrow">ACCOUNTS · 账户</p>
          <ul>
            {list.map(a => (
              <li key={a.id}>
                <button role="menuitemradio" aria-checked={a.id === current.id} className={a.id === current.id ? 'on' : ''}
                  onClick={() => { if (a.id !== current.id) switchAccount(a.id); else setOpen(false); }}>
                  <Avatar account={a} size={30} />
                  <span>{a.name}</span>
                  {a.pin && <Icon name="lock" size={13} />}
                  {a.id === current.id && <Icon name="check" size={16} />}
                </button>
              </li>
            ))}
          </ul>
          <Link to="/plugins#account" className="acct-pop-link" onClick={() => setOpen(false)}><Icon name="user" size={15} />管理账户、导出备份</Link>
        </div>
      )}
    </div>
  );
}
