// 书架页的几块面板（参照 Readest / Koodo Reader 书架上最实用的几样）：
//   继续阅读  上次读到哪一章、读了多少，一键接着读
//   阅读统计  今天 / 本周读了多久、连续几天、最近 7 天的柱状图、在读 / 读完 / 未读
//   最近划线  所有书里最新的划线和笔记，点一下跳回原文；一键导出全部笔记为 Markdown
//   为你推荐  按书架上的书的题材，从书目里挑没读过的近年佳作，并说明为什么推荐
import { useEffect, useMemo, useState } from 'react';
import Cover from './Cover.jsx';
import Icon from './Icon.jsx';
import { listNotes } from '../lib/shelf.js';
import { useReadingStats, fmtMinutes } from '../lib/readstats.js';
import { classicScore } from '../lib/library.js';
import { saveExport } from '../lib/native.js';

const pct = (it) => Math.round((it?.progress?.percent || 0) * 100);
export const isFinished = (it) => (it.progress?.percent || 0) >= .98;
export const isReading = (it) => (it.progress?.percent || 0) > 0 && !isFinished(it);
const ago = (t) => {
  if (!t) return '';
  const d = (Date.now() - t) / 1000;
  if (d < 3600) return Math.max(1, Math.round(d / 60)) + ' 分钟前';
  if (d < 86400) return Math.round(d / 3600) + ' 小时前';
  return Math.round(d / 86400) + ' 天前';
};

export function ContinueCard({ items, onOpen }) {
  const it = items.find(isReading) || items.find(x => !isFinished(x)) || items[0];
  if (!it) return null;
  const started = (it.progress?.percent || 0) > 0;
  const go = (e) => onOpen(it, e.currentTarget.closest('.sp-continue').querySelector('.cover'));
  return (
    <section className="sp-continue glass">
      <button className="sp-cover" onClick={go} aria-label={'阅读 ' + it.title}><Cover book={it} eager alt="" /></button>
      <div className="sp-body">
        <p className="eyebrow">{started ? `继续阅读 · ${ago(it.lastReadAt)}` : '还没开始 · 新放进书架的'}</p>
        <h2 className="serif">{it.title}</h2>
        <p className="muted sp-author">{it.author || '佚名'}</p>
        {it.progress?.chapter && <p className="sp-chapter">读到 <b>{it.progress.chapter}</b></p>}
        <div className="sp-bar" aria-hidden="true"><i style={{ width: `${pct(it)}%` }} /></div>
        <div className="sp-row">
          <span className="num muted">{started ? `已读 ${pct(it)}%` : '0%'}</span>
          <button className="btn btn-gold sm" onClick={go}><Icon name="book" size={16} />{started ? '继续读' : '开始读'}</button>
        </div>
      </div>
    </section>
  );
}

export function StatsCard({ items }) {
  const s = useReadingStats();
  const max = Math.max(1800, ...s.week.map(d => d.seconds));
  const counts = { reading: items.filter(isReading).length, done: items.filter(isFinished).length };
  counts.unread = items.length - counts.reading - counts.done;
  return (
    <section className="sp-stats glass" aria-label="阅读统计">
      <div className="sp-stat-row">
        <div><small className="eyebrow">今天</small><strong className="display num">{Math.round(s.today / 60)}</strong><span>分钟</span></div>
        <div><small className="eyebrow">本周</small><strong className="display num">{s.weekTotal < 3600 ? Math.round(s.weekTotal / 60) : (s.weekTotal / 3600).toFixed(1)}</strong><span>{s.weekTotal < 3600 ? '分钟' : '小时'}</span></div>
        <div><small className="eyebrow">连续</small><strong className="display num">{s.streak}</strong><span>天</span></div>
      </div>
      <div className="sp-week" role="img" aria-label={'最近 7 天：' + s.week.map(d => `${d.label} ${fmtMinutes(d.seconds)}`).join('，')}>
        {s.week.map(d => (
          <div key={d.day} className={`sp-day ${d.label === '今天' ? 'is-today' : ''}`} title={`${d.day} · ${fmtMinutes(d.seconds)}`}>
            <span className="sp-col"><i style={{ height: `${Math.max(d.seconds ? 6 : 0, Math.round(d.seconds / max * 100))}%` }} /></span>
            <small>{d.label}</small>
          </div>
        ))}
      </div>
      <div className="sp-counts">
        <span>在读 <b className="num">{counts.reading}</b></span>
        <span>读完 <b className="num">{counts.done}</b></span>
        <span>未读 <b className="num">{counts.unread}</b></span>
      </div>
    </section>
  );
}

/** 所有书的划线 / 笔记（最新在前） */
function useAllNotes(items) {
  const [notes, setNotes] = useState(null);
  const key = items.map(i => i.id).join('|');
  useEffect(() => {
    let alive = true;
    Promise.all(items.map(it => listNotes(it.id).then(list => list.map(n => ({ ...n, book: it })), () => [])))
      .then(all => { if (alive) setNotes(all.flat().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))); });
    return () => { alive = false; };
  }, [key]);
  return notes;
}

function notesMarkdown(notes) {
  const byBook = new Map();
  for (const n of notes) { if (!byBook.has(n.book.id)) byBook.set(n.book.id, { book: n.book, list: [] }); byBook.get(n.book.id).list.push(n); }
  const lines = [`# 我的笔记`, '', `> EBOOK 导出于 ${new Date().toLocaleString('zh-CN')} · ${notes.length} 条`, ''];
  for (const { book, list } of byBook.values()) {
    lines.push(`## 《${book.title}》${book.author ? ` · ${book.author}` : ''}`, '');
    for (const n of [...list].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))) {
      lines.push(...String(n.text || '').split('\n').map(l => `> ${l}`), '');
      if (n.note) lines.push(n.note, '');
      lines.push(`<small>${n.chapter ? n.chapter + ' · ' : ''}${n.createdAt ? new Date(n.createdAt).toLocaleDateString('zh-CN') : ''}</small>`, '');
    }
  }
  return lines.join('\n');
}

export function NotesPanel({ items, onOpenAt, toast }) {
  const notes = useAllNotes(items);
  const exportAll = async () => {
    try {
      const d = new Date(), stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      const where = await saveExport(`EBOOK笔记-${stamp}.md`, new TextEncoder().encode(notesMarkdown(notes)));
      toast(`笔记已导出${where ? '：' + where : ''}`, { tone: 'ok', ms: 4200 });
    } catch (e) { toast('导出失败：' + (e?.message || '存不下来'), { tone: 'error' }); }
  };
  return (
    <section className="sp-notes glass">
      <div className="sp-head">
        <h2 className="serif">最近划线</h2>
        {notes?.length > 0 && <button className="btn btn-ghost sm" onClick={exportAll}><Icon name="download" size={15} />导出 Markdown</button>}
      </div>
      {notes && !notes.length && <p className="muted sp-empty">读书时选中一段文字就能划线、写笔记，这里会按时间汇总所有书的划线。</p>}
      <ol className="sp-note-list">
        {(notes || []).slice(0, 5).map((n, i) => (
          <li key={n.book.id + n.cfi}>
            <button onClick={() => onOpenAt(n.book, n.cfi)} style={{ '--ink-c': `var(--hl-${n.color || 'gold'}, var(--gold))`, '--i': i }}>
              <span className="sp-quote serif">{n.text.length > 70 ? n.text.slice(0, 70) + '…' : n.text}</span>
              {n.note && <span className="sp-note-text">{n.note}</span>}
              <small className="muted">《{n.book.title}》{n.chapter ? ` · ${n.chapter}` : ''}</small>
            </button>
          </li>
        ))}
      </ol>
      {notes?.length > 5 && <p className="muted sp-more num">还有 {notes.length - 5} 条，导出看全部</p>}
    </section>
  );
}

/** 按书架题材推荐：书架上每本书（借书目里的标签）给标签加权，挑没在书架上的、能下载的书；近年佳作（精选名单）加分 */
export function ForYou({ items, books, byId, onOpen }) {
  const picks = useMemo(() => {
    const owned = new Set(items.map(it => it.bookId || it.id));
    const shelfBooks = items.map(it => byId.get(it.bookId)).filter(Boolean);
    const weight = new Map();
    for (const b of shelfBooks) for (const t of b.tags) weight.set(t, (weight.get(t) || 0) + 1);
    const pool = books.filter(b => b.source === 'mojimoon' && b.downloads.length && !owned.has(b.id));
    const scored = pool.map(b => {
      const tagScore = b.tags.reduce((s, t) => s + (weight.get(t) || 0), 0);
      const c = classicScore(b);
      const score = tagScore + (c >= 500 ? 4 : c / 3);
      // 推荐理由：和书架上哪本书题材最像
      let because = null, overlap = [];
      for (const sb of shelfBooks) {
        const common = b.tags.filter(t => sb.tags.includes(t));
        if (common.length > overlap.length) { overlap = common; because = sb; }
      }
      return { b, score, because, overlap };
    }).sort((x, y) => y.score - x.score);
    return scored.slice(0, 6);
  }, [items, books, byId]);
  if (!picks.length) return null;
  return (
    <section className="sp-foryou glass">
      <div className="sp-head"><h2 className="serif">为你推荐</h2><small className="muted">按书架上的题材挑的近年佳作</small></div>
      <ol className="sp-rec-list">
        {picks.map(({ b, because, overlap }, i) => (
          <li key={b.id} style={{ '--i': i }}>
            <button onClick={(e) => onOpen(b, e.currentTarget.querySelector('.cover'))}>
              <Cover book={b} alt="" />
              <span className="sp-rec-body">
                <strong className="serif">{b.title.replace(/\(.*?\)$/, '')}</strong>
                <small className="muted">{b.author}{b.status ? ` · ${b.status}` : ''}</small>
                <small className="sp-why">{because && overlap.length ? `同为 ${overlap.slice(0, 2).join(' · ')}，和《${because.title.replace(/\(.*?\)$/, '').slice(0, 12)}》一样` : '近年口碑佳作'}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
