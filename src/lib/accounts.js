// 本地账户：同一台电脑 / 手机上可以有好几个人用，各自的书架、进度、书签、划线、阅读偏好、明暗、搜索记录互不相干。
// 不需要服务器，数据全在本机；换设备靠「导出 / 导入」（见 accountIO.js）。
//
// 哪些跟着账户走、哪些属于这台设备：
//   账户：IndexedDB 的 shelf / blob / bookmarks、kv 里的 notes:*；localStorage 里经 acctKey() 的键
//   设备：书目缓存、封面缓存、网络测速、画质学习、下载监视、开屏标记
//
// 默认账户 id 是 'default'，用的就是原来不带后缀的键和 'librarium' 数据库——老用户升级后数据原样都在，不用迁移。
// 其它账户：localStorage 键加 "@<id>" 后缀，IndexedDB 用 'librarium@<id>'。
//
// PIN 只是挡住别人随手打开（加盐 SHA-256 存哈希），书和笔记本身没有加密——界面上也这么说，不夸大。
import { useEffect, useState } from 'react';

const REG = 'librarium.accounts';
const UNLOCKED = 'librarium.unlocked';          // sessionStorage：本次打开已解锁的账户
export const DEFAULT_ID = 'default';

// 头像底色：和生成封面同一套书衣色
export const AVATAR_COLORS = ['#7a2a30', '#1d4d4a', '#27375e', '#3a4a2c', '#4b2f57', '#6d4a1f', '#3b342c', '#9a6f2a'];

const blank = () => ({
  current: DEFAULT_ID,
  list: [{ id: DEFAULT_ID, name: '我', color: AVATAR_COLORS[7], avatar: '', pin: null, createdAt: Date.now() }],
});

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(REG) || 'null');
    if (v?.list?.length) {
      if (!v.list.some(a => a.id === v.current)) v.current = v.list[0].id;
      return v;
    }
  } catch {}
  return blank();
}
function write(reg) {
  try { localStorage.setItem(REG, JSON.stringify(reg)); } catch {}
  window.dispatchEvent(new CustomEvent('librarium:accounts'));
}

/** 当前账户 id。整个页面生命周期里不变——切换账户会整页重载，所有模块干净地按新账户重新读数据 */
export const currentId = read().current;

/** 账户私有的 localStorage 键 */
export const acctKey = (key, id = currentId) => (id === DEFAULT_ID ? key : `${key}@${id}`);
/** 账户私有的 IndexedDB 库名 */
export const acctDB = (id = currentId) => (id === DEFAULT_ID ? 'librarium' : `librarium@${id}`);

/** 跟着账户走的 localStorage 键（导出、删除账户时按这张表处理） */
export const ACCOUNT_KEYS = ['librarium.prefs', 'librarium.theme', 'librarium.search', 'librarium.plugins', 'librarium.tocPinned'];

export const listAccounts = () => read().list;
export const getAccount = (id = currentId) => read().list.find(a => a.id === id) || null;
export const currentAccount = () => getAccount(currentId);

export function useAccounts() {
  const [reg, setReg] = useState(read);
  useEffect(() => {
    const on = () => setReg(read());
    window.addEventListener('librarium:accounts', on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener('librarium:accounts', on); window.removeEventListener('storage', on); };
  }, []);
  return { list: reg.list, current: reg.list.find(a => a.id === reg.current) || reg.list[0] };
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** 名字去重：「小明」已存在就叫「小明 2」 */
export function uniqueName(name, list = read().list) {
  const base = (name || '').trim().slice(0, 16) || '读者';
  if (!list.some(a => a.name === base)) return base;
  for (let i = 2; ; i++) if (!list.some(a => a.name === `${base} ${i}`)) return `${base} ${i}`;
}

export function createAccount({ name, color, avatar = '' } = {}) {
  const reg = read();
  const acc = {
    id: newId(), name: uniqueName(name, reg.list),
    color: color || AVATAR_COLORS[reg.list.length % AVATAR_COLORS.length], avatar, pin: null, createdAt: Date.now(),
  };
  reg.list.push(acc);
  write(reg);
  return acc;
}

export function updateAccount(id, patch) {
  const reg = read();
  const i = reg.list.findIndex(a => a.id === id);
  if (i < 0) return null;
  if (patch.name != null) patch = { ...patch, name: uniqueName(patch.name, reg.list.filter(a => a.id !== id)) };
  reg.list[i] = { ...reg.list[i], ...patch };
  write(reg);
  return reg.list[i];
}

/** 删账户：书架、书、书签、笔记、偏好全部删掉。默认账户和当前账户不能删 */
export async function deleteAccount(id) {
  if (id === DEFAULT_ID || id === currentId) throw new Error('不能删除默认账户或正在使用的账户');
  const reg = read();
  reg.list = reg.list.filter(a => a.id !== id);
  write(reg);
  for (const k of ACCOUNT_KEYS) { try { localStorage.removeItem(acctKey(k, id)); } catch {} }
  await new Promise(resolve => {
    const req = indexedDB.deleteDatabase(acctDB(id));
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

/** 切换账户：记下新账户，整页重载（设好了已解锁就不再问 PIN） */
export function switchAccount(id, { unlocked = false } = {}) {
  const reg = read();
  if (!reg.list.some(a => a.id === id)) return;
  reg.current = id;
  write(reg);
  if (unlocked) markUnlocked(id);
  document.documentElement.classList.add('account-switching');
  setTimeout(() => location.reload(), 260);
}

// ---------- PIN ----------
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function digest(text) {
  if (crypto?.subtle) return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  // 极少数非安全上下文拿不到 subtle：退回 FNV（PIN 本来就只是挡一下）
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'fnv' + (h >>> 0).toString(16);
}

export async function setPin(id, pin) {
  if (!pin) return updateAccount(id, { pin: null });
  const salt = hex(crypto.getRandomValues(new Uint8Array(12)));
  // len：解锁界面输够位数就自动校验，不用再点确定
  return updateAccount(id, { pin: { salt, len: String(pin).length, hash: await digest(salt + ':' + pin) } });
}
export async function checkPin(id, pin) {
  const acc = getAccount(id);
  if (!acc?.pin) return true;
  return (await digest(acc.pin.salt + ':' + pin)) === acc.pin.hash;
}

export function markUnlocked(id) { try { sessionStorage.setItem(UNLOCKED, id); } catch {} }
/** 当前账户要不要先输 PIN（本次打开已经解过锁就不用） */
export function needsUnlock() {
  const acc = currentAccount();
  if (!acc?.pin) return false;
  try { return sessionStorage.getItem(UNLOCKED) !== acc.id; } catch { return true; }
}
