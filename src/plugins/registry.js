// 书源插件系统。
//
// 插件分两类：
//   · catalog —— 自带书目的书源（mojimoon）。load() 给出一批 Book，下载由 download() 完成
//   · import  —— 把用户手里的文件变成书架条目（本地导入）。importFiles(files) 直接写书架
//   · remote  —— 没有现成书目，按关键词去书源现搜（自定义 Legado 书源）。download() 同 catalog
//
// @typedef {object} Book
// @property {string} id            全局唯一，"<插件id>:<插件内id>"
// @property {string} source        插件 id
// @property {string} title
// @property {string} [alt]         别名
// @property {string} author
// @property {string} [publisher]
// @property {string} [status]      '连载中' | '已完结'
// @property {boolean} [animated]   已动画化
// @property {string[]} tags
// @property {string} [description]
// @property {string} [length]      字数，如 "167K"
// @property {string} updated       最近更新日期 YYYY-MM-DD
// @property {boolean} illustrated  有带插图的 EPUB（应用内一键下载）
// @property {boolean} [taiban]      有台版 EPUB（官方彩插，蓝奏云手动下载）
// @property {string} [blocked]     源站已下架正文（无法重制插图版），其它来源照常下载；blockedNote 是给用户看的说明
// @property {Download[]} downloads
//
// @typedef {object} Download
// @property {'illustrated'|'txt'|'external'} kind
// @property {string} label
// @property {string} [note]
// @property {{key:string,title:string,size?:number,images?:number,urls:string[]}[]} [volumes]   按卷下载
// @property {string[]} [urls]      整本下载
// @property {number} [size]
// @property {string} [url]         external：在浏览器打开
// @property {string} [pwd]         external：提取码
import * as mojimoon from './mojimoon/index.js';
import * as local from './local/index.js';
import * as publicDomain from './public/index.js';
import * as booksource from './booksource/index.js';
import { acctKey } from '../lib/accounts.js';

export const PLUGINS = [mojimoon, publicDomain, booksource, local];
export const pluginById = Object.fromEntries(PLUGINS.map(p => [p.id, p]));

const KEY = acctKey('librarium.plugins');
export function enabledPlugins() {
  let off = [];
  try { off = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
  return PLUGINS.filter(p => !off.includes(p.id));
}
export function setPluginEnabled(id, on) {
  let off = [];
  try { off = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
  off = on ? off.filter(x => x !== id) : [...new Set([...off, id])];
  try { localStorage.setItem(KEY, JSON.stringify(off)); } catch {}
}
