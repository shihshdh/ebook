// 设置页「账户」：当前账户、切换、新建、编辑（名字 / 头像 / PIN）、删除、导出备份、导入备份。
// 手机上顶栏不显示，账户入口就在这里；电脑上顶栏头像菜单也能切。
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import {
  AVATAR_COLORS, DEFAULT_ID, checkPin, createAccount, deleteAccount, setPin, switchAccount, updateAccount, useAccounts,
} from '../lib/accounts.js';
import { accountBooksSize, exportAccount, importAccount } from '../lib/accountIO.js';
import { onBackButton, saveExport } from '../lib/native.js';
import { useUIActions } from '../lib/ui.jsx';

const mb = (n) => n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(.1, n / 1e6).toFixed(1)} MB`;

/** 照片 → 160×160 居中裁切的 JPEG data URL（头像存在 localStorage 里，要小） */
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const S = 160, c = document.createElement('canvas');
      c.width = c.height = S;
      const k = Math.max(S / im.naturalWidth, S / im.naturalHeight);
      const w = im.naturalWidth * k, h = im.naturalHeight * k;
      c.getContext('2d').drawImage(im, (S - w) / 2, (S - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', .85));
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('读不了这张图')); };
    im.src = url;
  });
}

function Editor({ account, onClose, onCreated }) {
  const isNew = !account;
  const [name, setName] = useState(account?.name || '');
  const [color, setColor] = useState(account?.color || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  const [avatar, setAvatar] = useState(account?.avatar || '');
  const [pinMode, setPinMode] = useState(isNew ? 'none' : account.pin ? 'keep' : 'none');   // none | keep | set | remove
  const [pin1, setPin1] = useState(''), [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');
  const photo = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const offBack = onBackButton(() => { onClose(); return true; });   // 安卓返回键先关弹窗
    return () => { window.removeEventListener('keydown', onKey); offBack(); };
  }, []);

  const save = async () => {
    if (!name.trim()) return setErr('起个名字吧');
    if (pinMode === 'set') {
      if (!/^\d{4,6}$/.test(pin1)) return setErr('PIN 是 4 到 6 位数字');
      if (pin1 !== pin2) return setErr('两次输入的 PIN 不一样');
    }
    let acc = isNew ? createAccount({ name, color, avatar }) : updateAccount(account.id, { name, color, avatar });
    if (pinMode === 'set') acc = await setPin(acc.id, pin1);
    if (pinMode === 'remove') acc = await setPin(acc.id, '');
    onClose();
    if (isNew) onCreated?.(acc);
  };

  const preview = { name: name || '读', color, avatar };
  return (
    <div className="acct-modal" role="dialog" aria-modal="true" aria-label={isNew ? '新建账户' : '编辑账户'}>
      <div className="acct-scrim" onClick={onClose} />
      <div className="acct-dialog glass-dense">
        <header><h3 className="serif">{isNew ? '新建账户' : '编辑账户'}</h3><button className="btn btn-ghost btn-icon sm" onClick={onClose} aria-label="关闭"><Icon name="close" size={18} /></button></header>
        <div className="acct-ed-top">
          <Avatar account={preview} size={72} />
          <label className="acct-field">
            <span>名字</span>
            <input value={name} maxLength={16} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="比如：小明" autoFocus />
          </label>
        </div>
        <div className="acct-field">
          <span>头像</span>
          <div className="acct-colors">
            {AVATAR_COLORS.map(c => <button key={c} className={`acct-swatch ${!avatar && color === c ? 'on' : ''}`} style={{ '--av': c }} onClick={() => { setColor(c); setAvatar(''); }} aria-label="选这个颜色" />)}
            <button className="btn btn-ghost sm" onClick={() => photo.current?.click()}><Icon name="image" size={16} />用照片</button>
            {avatar && <button className="btn btn-ghost sm" onClick={() => setAvatar('')}>去掉照片</button>}
            <input ref={photo} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) try { setAvatar(await shrinkPhoto(f)); } catch (x) { setErr(x.message); } }} />
          </div>
        </div>
        <div className="acct-field">
          <span>PIN 锁</span>
          {pinMode === 'keep' && <div className="acct-row-inline"><span className="muted">已设置</span><button className="btn btn-ghost sm" onClick={() => setPinMode('set')}>修改</button><button className="btn btn-ghost sm" onClick={() => setPinMode('remove')}>去掉</button></div>}
          {pinMode === 'remove' && <div className="acct-row-inline"><span className="muted">保存后去掉 PIN</span><button className="btn btn-ghost sm" onClick={() => setPinMode('keep')}>算了</button></div>}
          {pinMode === 'none' && <div className="acct-row-inline"><span className="muted">没有设置</span><button className="btn btn-ghost sm" onClick={() => setPinMode('set')}><Icon name="lock" size={15} />设置 PIN</button></div>}
          {pinMode === 'set' && (
            <div className="acct-pins">
              <input inputMode="numeric" type="password" maxLength={6} placeholder="4 到 6 位数字" value={pin1} onChange={e => { setPin1(e.target.value.replace(/\D/g, '')); setErr(''); }} />
              <input inputMode="numeric" type="password" maxLength={6} placeholder="再输一次" value={pin2} onChange={e => { setPin2(e.target.value.replace(/\D/g, '')); setErr(''); }} />
              <button className="btn btn-ghost sm" onClick={() => { setPinMode(account?.pin ? 'keep' : 'none'); setPin1(''); setPin2(''); }}>算了</button>
            </div>
          )}
          <small className="muted">打开 EBOOK 或切到这个账户时要先输 PIN。它只是挡住别人随手打开，书和笔记本身没有加密。</small>
        </div>
        {err && <p className="acct-err">{err}</p>}
        <footer><button className="btn btn-ghost" onClick={onClose}>取消</button><button className="btn btn-gold" onClick={save}>{isNew ? '创建' : '保存'}</button></footer>
      </div>
    </div>
  );
}

export default function AccountPanel() {
  const { list, current } = useAccounts();
  const { toast } = useUIActions();
  const [editing, setEditing] = useState(null);          // null | 'new' | account
  const [confirmDel, setConfirmDel] = useState('');
  const [ask, setAsk] = useState(null);                  // 删设了 PIN 的账户：{ id, value, bad }
  const [exp, setExp] = useState(null);                  // null | { books, size, busy, p }
  const [imp, setImp] = useState(null);                  // null | { busy, p } | { done: account, books, orphans }
  const file = useRef(null);
  const others = list.filter(a => a.id !== current.id);

  const openExport = async () => {
    setExp({ books: true, size: null });
    const size = await accountBooksSize(current.id).catch(() => 0);
    setExp(e => e && { ...e, size });
  };
  const doExport = async () => {
    setExp(e => ({ ...e, busy: true, p: 0 }));
    try {
      const out = await exportAccount(current.id, { books: exp.books, onProgress: p => setExp(e => e && { ...e, p }) });
      const where = await saveExport(out.name, out.bytes);
      toast(`已导出${exp.books ? ` ${out.books} 本书和` : ''}进度、书签、笔记 → ${where}`, { tone: 'ok', ms: 6000 });
      setExp(null);
    } catch (e) {
      toast(`导出失败：${e.message || e}`, { tone: 'error' });
      setExp(x => x && { ...x, busy: false });
    }
  };
  const doImport = async (f) => {
    setImp({ busy: true, p: 0 });
    try {
      const res = await importAccount(new Uint8Array(await f.arrayBuffer()), { onProgress: p => setImp({ busy: true, p }) });
      setImp({ done: res.account, books: res.books, orphans: res.orphans });
    } catch (e) {
      toast(`导入失败：${e.message || e}`, { tone: 'error' });
      setImp(null);
    }
  };
  const del = async (a) => {
    // 设了 PIN 的账户：要输它的 PIN（忘了的话输完整账户名也行——删除不会泄露数据，只是要确认是故意的）
    if (a.pin && ask?.id !== a.id) { setAsk({ id: a.id, value: '', bad: false }); return; }
    if (a.pin) {
      const ok = ask.value === a.name || (/^\d{4,6}$/.test(ask.value) && await checkPin(a.id, ask.value));
      if (!ok) { setAsk(x => ({ ...x, bad: true })); return; }
    } else if (confirmDel !== a.id) { setConfirmDel(a.id); setTimeout(() => setConfirmDel(c => (c === a.id ? '' : c)), 4000); return; }
    await deleteAccount(a.id);
    setConfirmDel(''); setAsk(null);
    toast(`已删除账户「${a.name}」和它的书架`, { tone: 'ok' });
  };

  return (
    <div className="acct" id="account">
      <div className="acct-current">
        <Avatar account={current} size={60} />
        <div className="acct-who">
          <strong className="serif">{current.name}</strong>
          <small className="muted">正在使用{current.pin ? ' · 已设 PIN' : ''}{current.id === DEFAULT_ID ? ' · 默认账户' : ''}</small>
        </div>
        <div className="acct-actions">
          <button className="btn sm" onClick={() => setEditing(current)}><Icon name="edit" size={15} />编辑</button>
          <button className="btn sm" onClick={openExport} disabled={!!exp}><Icon name="download" size={15} />导出备份</button>
        </div>
      </div>

      {exp && (
        <div className="acct-box">
          <label className="acct-check">
            <input type="checkbox" checked={exp.books} disabled={exp.busy} onChange={e => setExp(x => ({ ...x, books: e.target.checked }))} />
            <span>带上书文件{exp.size != null ? `（约 ${mb(exp.size)}）` : '…'}</span>
          </label>
          <p className="muted">{exp.books
            ? '换设备、重装时用：一个文件里是全部的书和进度、书签、笔记。'
            : '只带进度、书签、笔记和阅读偏好，文件很小。在另一台设备导入后，重新下载同一本书时进度会自动接上。'}</p>
          <div className="acct-row-inline">
            {exp.busy ? <span className="acct-bar"><b style={{ transform: `scaleX(${exp.p || 0})` }} /></span> : <button className="btn btn-gold sm" onClick={doExport}>导出</button>}
            {!exp.busy && <button className="btn btn-ghost sm" onClick={() => setExp(null)}>取消</button>}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <ul className="acct-list">
          {others.map(a => (
            <li key={a.id}>
              <Avatar account={a} size={36} />
              <span className="acct-name">{a.name}{a.pin && <Icon name="lock" size={13} />}</span>
              {/* 只能编辑自己正在用的账户：不然别人能顺手把你的 PIN 去掉 */}
              {a.id !== DEFAULT_ID && ask?.id === a.id && (
                <input className={`acct-ask ${ask.bad ? 'is-bad' : ''}`} autoFocus type="password" placeholder="输它的 PIN（忘了就输账户名）"
                  value={ask.value} onChange={e => setAsk({ ...ask, value: e.target.value, bad: false })} onKeyDown={e => e.key === 'Enter' && del(a)} />
              )}
              {a.id !== DEFAULT_ID && (
                <button className={`btn btn-ghost sm ${confirmDel === a.id ? 'is-danger' : ''}`} onClick={() => del(a)}>
                  <Icon name="trash" size={15} />{confirmDel === a.id ? '再点一次，连书架一起删' : ask?.id === a.id ? '删除' : ''}
                </button>
              )}
              <button className="btn sm" onClick={() => switchAccount(a.id)}>切换</button>
            </li>
          ))}
        </ul>
      )}

      {imp?.done && (
        <div className="acct-box is-ok">
          <p>已导入账户「{imp.done.name}」：{imp.books} 本书{imp.orphans ? `，另有 ${imp.orphans} 本的进度等重新下载后接上` : ''}。</p>
          <div className="acct-row-inline"><button className="btn btn-gold sm" onClick={() => switchAccount(imp.done.id)}>切换过去</button><button className="btn btn-ghost sm" onClick={() => setImp(null)}>好的</button></div>
        </div>
      )}

      <div className="acct-row-inline acct-more">
        <button className="btn btn-ghost sm" onClick={() => setEditing('new')}><Icon name="plus" size={15} />新建账户</button>
        <button className="btn btn-ghost sm" onClick={() => file.current?.click()} disabled={imp?.busy}><Icon name="upload" size={15} />{imp?.busy ? `导入中 ${Math.round((imp.p || 0) * 100)}%` : '导入备份'}</button>
        <input ref={file} type="file" accept=".zip,application/zip" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) doImport(f); }} />
      </div>
      <p className="muted acct-note">账户只存在这台设备上，不联网、不上传。每个账户有自己的书架、进度、书签、笔记和阅读偏好。</p>

      {/* 挂到 body：设置面板的玻璃（backdrop-filter）会把 fixed 定位困在面板里 */}
      {editing && createPortal(<Editor account={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
        onCreated={(a) => toast(`已创建账户「${a.name}」，在下面点「切换」就能用`, { tone: 'ok', ms: 4200 })} />, document.body)}
    </div>
  );
}
