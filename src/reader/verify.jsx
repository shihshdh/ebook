// 独立验收入口：不修改协作者维护的路由和应用骨架。
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Reader from '../pages/Reader';
import PageRiver from '../effects/PageRiver';
import PrismGlass from '../effects/PrismGlass';
import { addToShelf } from '../lib/shelf';
import { txtToEpub } from './txt';
import '../styles/tokens.css';
import '../styles/base.css';

async function seed(ext) {
  const text = Array.from({ length: 4 }, (_, i) => `第${i + 1}章 夜灯与书页\n${'夜色落在纸上，书页像一条缓慢流动的河。我们在一盏灯下，读到遥远世界的回声。\n'.repeat(80)}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  await addToShelf({ id: `astra-check-${ext}`, title: '夜读 · 验收样书', author: 'ASTRA', ext }, ext === 'txt' ? blob : new Blob([await txtToEpub(blob, '夜读 · 验收样书')], { type: 'application/epub+zip' }));
  location.hash = `/read/astra-check-${ext}`;
}
function Check() {
  return <div style={{ padding: 24 }}><h1 className="serif">组件验收</h1><div style={{ display: 'flex', gap: 12, marginBottom: 24 }}><button className="btn" onClick={() => seed('txt')}>打开 TXT 样书</button><button className="btn" onClick={() => seed('epub')}>打开 EPUB 样书</button></div><div style={{ position: 'relative', height: 500 }}><PageRiver /></div><PrismGlass title={['找一本', '今晚的书。']} lead="让一页文字，陪你度过漫长的夜。"><input aria-label="搜索书名" placeholder="搜索书名或作者" style={{ width: '100%', padding: 18, borderRadius: 16, border: '1px solid #e9cb8b44', background: '#161310cc', color: '#f4efe3' }} /></PrismGlass></div>;
}
createRoot(document.getElementById('root')).render(<HashRouter><Routes><Route path="/read/:id" element={<Reader />} /><Route path="*" element={<Check />} /></Routes></HashRouter>);
