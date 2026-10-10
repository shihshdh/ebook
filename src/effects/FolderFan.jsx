// ⑤ 文件夹悬停扇形展开（移植自 Pixel Reconstruction / Noël 的 FolderFan，黑金版）。
// 最近读的书插在文件夹里只露顶边；鼠标进入（或键盘聚焦、手机轻点）文件夹，卡片带回弹地扇形展开；
// 指到哪张哪张再抬起、换白边、阴影加深。前袋是磨砂玻璃，卡片下半截在后面若隐若现。
// 背后一行充气金箔大字，第一次进入视口时顺着书写方向写出来。
import { useEffect, useRef, useState } from 'react';
import { isTouch, prefersReduced } from '../lib/motion.js';
import './FolderFan.css';

export default function FolderFan({ cards, label, note, word = 'reading', onOpen, onOpenCard, onPressCard, sticker = 'EPUB' }) {
  const n = cards.length, mid = (n - 1) / 2;
  const stageRef = useRef(null);
  const [written, setWritten] = useState(false);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(0);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (prefersReduced()) { setWritten(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setWritten(true); io.disconnect(); } }, { threshold: .35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // 开合由脚本判断：舞台是盖住整个扇形的固定大区域，卡片怎么动都不会让开合来回翻转
  const show = () => { clearTimeout(closeTimer.current); setOpen(true); };
  const hide = () => { clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 180); };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const touch = isTouch();

  return (
    <div ref={stageRef} className="ff-stage" data-open={open || undefined} onPointerLeave={touch ? undefined : hide}
      onFocus={show} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) hide(); }}>
      <span className="ff-puff" data-written={written || undefined} aria-hidden="true">{word}</span>
      <div className="ff-folder" onPointerEnter={touch ? undefined : show}>
        <span className="ff-back" aria-hidden="true" />
        {cards.map((card, i) => {
          const k = i - mid, edge = Math.abs(k);
          return (
            <button key={card.key} type="button" className="ff-card" onClick={(e) => onOpenCard(card.key, e.currentTarget)} onPointerDown={onPressCard && (() => onPressCard(card.key))} aria-label={'打开 ' + card.title}
              style={{
                '--rest-x': `${k * 10}px`, '--rest-r': `${k * 3}deg`,
                '--open-x': `${k * 112}px`, '--open-y': `${-150 + edge * edge * 15}px`, '--open-r': `${k * 13}deg`,
                '--delay': `${edge * 70}ms`, zIndex: 10 - Math.round(edge),
              }}>
              <span className="ff-face">
                <span className="ff-photo">{card.thumb}</span>
                {card.tag && <span className="ff-tag">{card.tag}</span>}
              </span>
            </button>
          );
        })}
        <button type="button" className="ff-pocket" onClick={() => (touch && !open ? setOpen(true) : onOpen?.())} aria-label={label}>
          <span className="ff-badge" aria-hidden="true"><i /><i /></span>
          <span className="ff-sticker" aria-hidden="true">{sticker}</span>
          <span className="ff-label">{label}<small>{note}</small></span>
          <span className="ff-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
