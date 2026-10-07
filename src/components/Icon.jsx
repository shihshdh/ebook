// 线性图标：1.6 描边、圆头，和玻璃面板的细线条一致
const P = {
  home: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10v9h11v-9" /><path d="M10 19v-5h4v5" /></>,
  explore: <><circle cx="12" cy="12" r="8" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  shelf: <><path d="M5 4.5h3.5v15H5zM10 4.5h3.5v15H10z" /><path d="m15.4 5.3 3.3-.9 3.6 14.4-3.3.9z" /></>,
  plugin: <><path d="M9 4v4M15 4v4" /><rect x="5.5" y="8" width="13" height="6" rx="2" /><path d="M12 14v3a3 3 0 0 1-3 3" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="M15 5 8 12l7 7" />,
  download: <><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 19.5h14" /></>,
  book: <><path d="M4.5 5.5c3-1 5.5-.7 7.5 1 2-1.7 4.5-2 7.5-1v13c-3-1-5.5-.7-7.5 1-2-1.7-4.5-2-7.5-1z" /><path d="M12 6.5v13" /></>,
  external: <><path d="M14 5h5v5" /><path d="M19 5 11 13" /><path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>,
  upload: <><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M5 19.5h14" /></>,
  trash: <><path d="M5 7h14M10 7V5h4v2" /><path d="M6.5 7 7.5 19.5h9L17.5 7" /></>,
  sparkle: <path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z" />,
  image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 17 4.5-4 3.5 3 2.5-2 3.5 3" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  lock: <><rect x="5.5" y="10.5" width="13" height="9" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  rss: <><path d="M5.5 5.5a13 13 0 0 1 13 13" /><path d="M5.5 10.5a8 8 0 0 1 8 8" /><circle cx="6.5" cy="17.5" r="1.4" /></>,
  edit: <><path d="M5 19l1-4L15.5 5.5a2 2 0 0 1 3 3L9 18z" /><path d="M13.5 7.5l3 3" /></>,
  grid: <><rect x="4.5" y="4.5" width="6" height="6" rx="1.5" /><rect x="13.5" y="4.5" width="6" height="6" rx="1.5" /><rect x="4.5" y="13.5" width="6" height="6" rx="1.5" /><rect x="13.5" y="13.5" width="6" height="6" rx="1.5" /></>,
};

export default function Icon({ name, size = 20, stroke = 1.6, className, style }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
