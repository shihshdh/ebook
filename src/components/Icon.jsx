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

// 实心版：iOS 标签栏选中的那格用实心图标（SF Symbols 的 .fill），没选中的用线性
const F = {
  home: <path d="M3.6 10.6 12 3.9l8.4 6.7a1 1 0 0 1 .4.8v8.1a1.5 1.5 0 0 1-1.5 1.5H15v-5.2a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1V21H4.7a1.5 1.5 0 0 1-1.5-1.5v-8.1a1 1 0 0 1 .4-.8z" />,
  explore: <path fillRule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm3.9 5.1-5.5 2.3-2.3 5.5 5.5-2.3z" />,
  shelf: <><rect x="3.6" y="4" width="4.6" height="16.2" rx="1.1" /><rect x="9.4" y="4" width="4.6" height="16.2" rx="1.1" /><path d="m15.2 5.6 3.4-.9a1 1 0 0 1 1.2.7l3.5 13.6a1 1 0 0 1-.7 1.2l-3.4.9a1 1 0 0 1-1.2-.7L14.5 6.8a1 1 0 0 1 .7-1.2z" /></>,
  plugin: <path d="M9 3.2a1 1 0 0 1 1 1V7h4V4.2a1 1 0 1 1 2 0V7h1.5a2 2 0 0 1 2 2v3a3 3 0 0 1-3 3H13v2a4 4 0 0 1-4 4 1 1 0 1 1 0-2 2 2 0 0 0 2-2v-2H7.5a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2H8V4.2a1 1 0 0 1 1-1z" />,
  rss: <path fillRule="evenodd" d="M6 3.5h12A2.5 2.5 0 0 1 20.5 6v12a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5zm1.3 3.2a.9.9 0 0 0 0 1.8 8.2 8.2 0 0 1 8.2 8.2.9.9 0 0 0 1.8 0c0-5.5-4.5-10-10-10zm0 4a.9.9 0 0 0 0 1.8 4.2 4.2 0 0 1 4.2 4.2.9.9 0 0 0 1.8 0 6 6 0 0 0-6-6zm.4 4.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z" />,
  user: <><circle cx="12" cy="8" r="4.2" /><path d="M4.2 19.6c1.3-3.9 4.2-6 7.8-6s6.5 2.1 7.8 6a1 1 0 0 1-1 1.3H5.2a1 1 0 0 1-1-1.3z" /></>,
};

export default function Icon({ name, size = 20, stroke = 1.6, className, style }) {
  if (name?.endsWith('-fill') && F[name.slice(0, -5)]) {
    return (
      <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {F[name.slice(0, -5)]}
      </svg>
    );
  }
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}

Icon.filled = (name) => !!F[name];
