// Проверка врачебной версии в Chromium: node test/browser.js [папка для скриншотов]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || null;
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const SETS = [['nmn', 'tmg', 'resv', 'coq10'], ['синеф', 'мелат'], ['metformin', 'berberine', 'mecbl'], ['tongkat', 'цинка пик']];
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [tag, opts] of [['desktop', { viewport: { width: 1400, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const p = await b.newPage(opts);
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${tag}] ${m.text()}`); });
    p.on('pageerror', e => errs.push(`[${tag}] ${e.message}`));
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload();
    for (const [si, set] of SETS.entries()) {
      if (await p.isVisible('#clearBtn')) await p.click('#clearBtn');
      for (const q of set) { await p.fill('#q', q); await p.keyboard.press('Enter'); }
      await p.click('h2');
      const syn = await p.$$eval('.syn-list .fnd', x => x.length), sug = await p.$$eval('[data-add]', x => x.length);
      if (tag === 'desktop') console.log(set.join('+'), '→', await p.textContent('.verdict .big'), '| синергий:', syn, '| подсказок:', sug);
      if (out && si === 0) await p.screenshot({ path: `${out}/doc2-${tag}.png`, fullPage: true });
    }
    // добавить из подсказки
    const n0 = await p.$$eval('#items .ditem', x => x.length);
    const add = await p.$('[data-add]'); if (add) { await add.click(); if ((await p.$$eval('#items .ditem', x => x.length)) !== n0 + 1) errs.push(`[${tag}] подсказка не добавила вещество`); }
    // пациент
    if (!(await p.isVisible('[data-cond="diab"]'))) await p.click('#condBox summary');
    await p.click('[data-cond="diab"]');
    await p.click('#copyBtn');
    await p.click('#items [data-mol]'); await p.waitForSelector('#mol .card');
    if (out) await p.screenshot({ path: `${out}/doc2-${tag}-card.png`, fullPage: true });
    await p.goto(URL + '#method');
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (sw > 0) errs.push(`[${tag}] горизонтальная прокрутка ${sw}px`);
    await p.close();
  }
  await b.close();
  console.log(errs.length ? 'ОШИБКИ:\n' + errs.join('\n') : 'Ошибок в консоли нет');
  process.exit(errs.length ? 1 : 0);
})();
