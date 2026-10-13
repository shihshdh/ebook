import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { appReady, platform, isIOS, watchAccessibility } from './lib/native.js';
import { setupIOSViewport } from './lib/ios-viewport.js';
import { applyTheme } from './lib/theme.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/home.css';
import './styles/accounts.css';
import './styles/light.css';
import './styles/ios.css';

// 平台写在 <html> 上，CSS 按端微调（客户端的标题栏留位、安全区等）
document.documentElement.classList.add(`platform-${platform}`);
if (isIOS) {
  const root = document.documentElement;
  root.classList.add('platform-ios');
  setupIOSViewport();
  // 系统的「降低透明度」「增强对比度」：玻璃换实色、文字和分隔线加深（ios.css 的 a11y-solid / a11y-contrast）
  const contrast = matchMedia('(prefers-contrast: more)');
  const sync = (s = {}) => {
    root.classList.toggle('a11y-solid', !!s.reduceTransparency);
    root.classList.toggle('a11y-contrast', !!s.increaseContrast || contrast.matches);
  };
  sync();
  watchAccessibility(sync);
}
applyTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 客户端窗口 / 安卓启动页先挡着，等第一帧画完再亮出来——不闪白、不闪黑
requestAnimationFrame(() => requestAnimationFrame(() => appReady()));
