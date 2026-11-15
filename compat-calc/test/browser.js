// Проверка версии технолога (конструктор как на сайте) в Chromium: node test/browser.js [папка для скриншотов]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || null;
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [tag, opts] of [['desktop', { viewport: { width: 1400, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const p = await b.newPage(opts);
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${tag}] ${m.text()}`); });
    p.on('pageerror', e => errs.push(`[${tag}] ${e.message}`));
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload();
    // СЛ: медь + NAC — несовместимо, отметка в списке до добавления
    await p.click('[data-form="СЛ"]');
    await p.click('#colTh .cbtn >> text=Витамино-минеральная терапия');
    await p.click('#colCat .cbtn >> text=Минералы и микроэлементы');
    await p.click('#colMol [data-sn="Меди бисглицинат"]');
    await p.fill('#q', 'ацетилцист');
    const mark = await p.$eval('#colMol [data-sn="N-Ацетилцистеин"] .mst', e => e.textContent).catch(() => 'нет');
    await p.click('#colMol [data-sn="N-Ацетилцистеин"]'); await p.fill('#q', '');
    const v1 = await p.textContent('.verdict .big');
    // параметры формы меняются и учитываются
    const params = await p.$$eval('#params label', x => x.length);
    // капсулы: лизин на лактозе — Майяр
    await p.click('#clearBtn'); await p.click('[data-form="КП"]');
    await p.selectOption('#p_filler', 'lactose');
    await p.fill('#q', 'лизин'); await p.click('#colMol .mbtn'); await p.fill('#q', '');
    const maillard = await p.$$eval('.fnd-h .ty', x => x.some(e => /Майяр/.test(e.textContent)));
    // доза ползунком, матрица, копирование, карточка
    await p.$eval('#items [data-amtn="0"]', e => { e.value = 2000; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(400);
    const zone = await p.textContent('#items .dcard .zone');
    await p.click('#copyBtn');
    if (tag === 'desktop') console.log('NAC при меди:', mark, '| СЛ медь+NAC:', v1, '| параметров формы:', params, '| лизин на лактозе — Майяр:', maillard, '| зона:', zone);
    if (out) await p.screenshot({ path: `${out}/tech-${tag}.png`, fullPage: true });
    await p.click('#items .dcard .mlink'); await p.waitForSelector('#mol .card');
    await p.goto(URL + '#method');
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (sw > 0) errs.push(`[${tag}] горизонтальная прокрутка ${sw}px`);
    await p.close();
  }
  await b.close();
  console.log(errs.length ? 'ОШИБКИ:\n' + errs.join('\n') : 'Ошибок в консоли нет');
  process.exit(errs.length ? 1 : 0);
})();
