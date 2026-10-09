// 自定义书源插件：把用户导入的 Legado 书源接进应用（存取、搜索、下载都在 lib/legado.js）。
// 不是 catalog（没有现成书目可列），是 remote：搜索页按关键词去各书源现搜。
export { downloadBook as download } from '../../lib/legado.js';   // lib/legado.js 本身很轻，规则引擎在它里面按需加载

export const id = 'legado';
export const kind = 'remote';
export const name = '默认与自定义书源 · Legado 规则';
export const short = '书源';
export const description = '内置默认书源，打开就能在搜索页搜书、整本下载进书架，也支持导入自己的 Legado 书源。只认规则，不执行书源里的脚本。';
export const license = '';
export const version = '1.0.0';
