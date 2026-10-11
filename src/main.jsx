import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { appReady, isIOS, platform } from './lib/native.js';
import { applyTheme } from './lib/theme.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/home.css';
import './styles/accounts.css';
import './styles/light.css';

// 平台写在 <html> 上，CSS 按端微调（客户端的标题栏留位、安全区等）
document.documentElement.classList.add(`platform-${platform}`);
// iOS 客户端：输入框字号小于 16px 时一点就整页放大（Safari 内核的老规矩），锁住缩放。安卓 WebView 本来就不缩放，网页版不动
if (isIOS) document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
applyTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 客户端窗口 / 安卓启动页先挡着，等第一帧画完再亮出来——不闪白、不闪黑
requestAnimationFrame(() => requestAnimationFrame(() => appReady()));
