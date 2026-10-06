const { chromium } = require('C:/Users/ys221/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const base = process.env.ASTRA_URL || 'http://127.0.0.1:5181/src/reader/verify.html';
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390, isMobile: width === 390 });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base);
      await page.waitForLoadState('networkidle');
      await page.locator('.prism-glass').scrollIntoViewIfNeeded();
      await page.mouse.move(width * .7, 350);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(__dirname, `.verify/prism-${width}.png`), fullPage: true });
      await page.getByRole('textbox', { name: '搜索书名' }).fill('夜读');
      assert.equal(await page.getByRole('textbox', { name: '搜索书名' }).inputValue(), '夜读');
      if (width === 390) assert.ok(await page.locator('.prism-glass.is-static').count());
      await page.getByRole('button', { name: '打开 TXT 样书' }).click();
      await page.locator('.reader-content.is-ready').waitFor({ timeout: 30000 });
      await page.waitForFunction(() => !document.querySelector('[aria-label="阅读进度"]').disabled);
      const frame = page.frameLocator('iframe').first();
      await frame.locator('body').click({ position: { x: width === 390 ? 180 : 340, y: 250 } });
      await page.getByRole('button', { name: '目录', exact: true }).click();
      await page.getByRole('button', { name: '第3章 夜灯与书页', exact: true }).click();
      await page.waitForTimeout(700);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(700);
      await page.locator('.reader-access').focus(); await page.keyboard.press('Enter');
      await page.getByRole('button', { name: '添加书签', exact: true }).click();
      await page.getByRole('button', { name: '设置', exact: true }).click();
      await page.getByRole('button', { name: '纸白', exact: true }).click();
      await page.getByLabel('字体', { exact: true }).selectOption('kai');
      await page.getByRole('button', { name: 'A＋', exact: true }).click();
      await page.getByLabel('阅读方式').selectOption('scrolled');
      await page.locator('.reader-content.is-ready').waitFor();
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(__dirname, `.verify/reader-${width}.png`) });
      const stored = await page.evaluate(async () => (await import('/src/lib/shelf.js')).getShelfItem('astra-check-txt'));
      assert.ok(stored.progress.cfi.startsWith('epubcfi('));
      assert.ok(stored.progress.percent > .4);
      await page.reload(); await page.locator('.reader-content.is-ready').waitFor();
      await page.waitForTimeout(700);
      const restored = await page.evaluate(async () => (await import('/src/lib/shelf.js')).getShelfItem('astra-check-txt'));
      assert.ok(Math.abs(restored.progress.percent - stored.progress.percent) < .06);
      assert.equal(await page.evaluate(async () => (await (await import('/src/lib/shelf.js')).listBookmarks('astra-check-txt')).length), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(`${width}px: Prism input/fallback, TXT chapters, keys, bookmark, themes, reflow, save/restore passed`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
