import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { appReady, platform } from './lib/native.js';
import { applyTheme } from './lib/theme.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/home.css';
import './styles/accounts.css';
import './styles/light.css';

// 平台写在 <html> 上，CSS 按端微调（客户端的标题栏留位、安全区等）
document.documentElement.classList.add(`platform-${platform}`);
applyTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 客户端窗口 / 安卓启动页先挡着，等第一帧画完再亮出来——不闪白、不闪黑
requestAnimationFrame(() => requestAnimationFrame(() => appReady()));
