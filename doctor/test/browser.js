// Проверка врачебной версии в Chromium: node test/browser.js [папка для скриншотов]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || null;
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [tag, opts] of [['desktop', { viewport: { width: 1400, height: 900 } }], ['dark', { viewport: { width: 1400, height: 900 }, colorScheme: 'dark' }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const p = await b.newPage(opts);
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${tag}] ${m.text()}`); });
    p.on('pageerror', e => errs.push(`[${tag}] ${e.message}`));
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload();
    const n = await p.$$eval('#examples [data-ex]', x => x.length);
    for (let i = 0; i < n; i++) {
      await p.click(`#examples [data-ex="${i}"]`);
      if (tag === 'desktop') console.log('пример', i, '→', await p.textContent('.verdict .big'));
      if (out && (i === 2 || i === 4)) await p.screenshot({ path: `${out}/doc-${tag}-ex${i}.png`, fullPage: true });
    }
    // выбор из списка и состояние пациента
    await p.click('#clearBtn');
    await p.click('#tab-recipe .dd-toggle'); await p.click('#dd .dd-list button[data-i="0"]'); await p.click('#dd .dd-list button[data-i="5"]'); await p.click('#dd [data-done]');
    await p.fill('#q', 'мел'); await p.keyboard.press('Enter');
    await p.click('[data-cond="preg"]');
    if (tag === 'desktop') console.log('выбор + беременность →', await p.$$eval('#items .ditem', x => x.length), 'вещ.;', await p.textContent('.verdict .big'));
    await p.click('#copyBtn');
    await p.click('#items [data-mol]');
    await p.waitForSelector('#mol .pills, #mol .muted');
    if (out) await p.screenshot({ path: `${out}/doc-${tag}-card.png`, fullPage: true });
    await p.goto(URL + '#method');
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (sw > 0) errs.push(`[${tag}] горизонтальная прокрутка ${sw}px`);
    await p.close();
  }
  await b.close();
  console.log(errs.length ? 'ОШИБКИ:\n' + errs.join('\n') : 'Ошибок в консоли нет');
  process.exit(errs.length ? 1 : 0);
})();
