// Проверка врачебной версии (конструктор как на сайте) в Chromium: node test/browser.js [папка для скриншотов]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || null;
const URL = 'file://' + path.join(__dirname, '..', process.env.PAGE || 'index.html');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [tag, opts] of [['desktop', { viewport: { width: 1400, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const p = await b.newPage(opts);
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${tag}] ${m.text()}`); });
    p.on('pageerror', e => errs.push(`[${tag}] ${e.message}`));
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload();
    // форма → вид терапии → категория → молекулы
    await p.click('[data-form="СЛ"]');
    const ths = await p.$$eval('#colTh .cbtn', x => x.map(e => e.textContent));
    await p.click('#colTh .cbtn >> text=Витамино-минеральная терапия');
    await p.click('#colCat .cbtn >> text=Минералы и микроэлементы');
    await p.click('#colMol [data-sn="Меди бисглицинат"]');
    // поиск по синониму и отметки до добавления
    await p.fill('#q', 'ацетилцист');
    const st = await p.$eval('#colMol [data-sn="N-Ацетилцистеин"] .mst', e => e.className + ' ' + e.textContent).catch(() => 'нет отметки');
    await p.click('#colMol [data-sn="N-Ацетилцистеин"]');
    await p.fill('#q', 'глицин');
    const st2 = await p.$eval('#colMol [data-sn="Глицин"] .mst', e => e.textContent).catch(() => 'нет отметки');
    await p.fill('#q', '');
    const v = await p.textContent('.verdict .big');
    const cards = await p.$$eval('#items .dcard', x => x.length);
    // доза ползунком
    const zone0 = await p.textContent('#items .dcard .zone');
    await p.$eval('#items [data-amtn="1"]', e => { e.value = 1800; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(400);
    const zone1 = await p.$$eval('#items .dcard .zone', x => x.map(e => e.textContent));
    if (tag === 'desktop') {
      console.log('видов терапии в СЛ:', ths.length, '| NAC при выбранной меди:', st, '| глицин:', st2);
      console.log('вердикт:', v, '| карточек доз:', cards, '| зоны:', zone0, '→', zone1.join(', '));
    }
    if (out) await p.screenshot({ path: `${out}/ctor-${tag}.png`, fullPage: true });
    // смена формы, пациент, копирование, карточка
    await p.click('[data-form="КП"]');
    if (!(await p.isVisible('[data-cond="preg"]'))) await p.click('#condBox summary');
    await p.click('[data-cond="preg"]');
    await p.click('#copyBtn');
    await p.click('#items .dcard .mlink');
    await p.waitForSelector('#mol .card');
    const site = await p.$$eval('#mol h2', x => x.map(e => e.textContent).filter(t => /конструкторе/.test(t)));
    if (tag === 'desktop') console.log('карточка:', site.join(' | '));
    if (out) await p.screenshot({ path: `${out}/ctor-${tag}-card.png`, fullPage: true });
    await p.goto(URL + '#method');
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (sw > 0) errs.push(`[${tag}] горизонтальная прокрутка ${sw}px`);
    await p.close();
  }
  await b.close();
  console.log(errs.length ? 'ОШИБКИ:\n' + errs.join('\n') : 'Ошибок в консоли нет');
  process.exit(errs.length ? 1 : 0);
})();
