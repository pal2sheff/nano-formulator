// Проверка страницы в браузере: ошибки консоли, примеры, карточка, методика
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || null;
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const run = async (opts, tag) => {
    const p = await b.newPage(opts);
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${tag}] ${m.type()}: ${m.text()}`); });
    p.on('pageerror', e => errs.push(`[${tag}] pageerror: ${e.message}`));
    await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
    const n = await p.$$eval('#examples button', x => x.length);
    for (let i = 0; i < n; i++) {
      await p.click(`#examples button[data-ex="${i}"]`);
      const v = await p.textContent('.verdict .big');
      if (tag === 'desktop') console.log('пример', i, '→', v);
      if (out && i === 0 && tag === 'desktop') await p.screenshot({ path: `${out}/${tag}-ex0.png`, fullPage: true });
      if (out && i === 3) await p.screenshot({ path: `${out}/${tag}-ex3.png`, fullPage: tag !== 'desktop' });
    }
    // наведение на матрицу
    await p.click('#examples button[data-ex="1"]');
    const cell = await p.$('.mx td[data-tip]:not(.self)');
    if (cell) { await cell.hover(); if (tag === 'desktop') console.log('tooltip:', (await p.textContent('#tip')).slice(0, 80)); }
    if (out && tag === 'desktop') await p.screenshot({ path: `${out}/${tag}-ex1.png`, fullPage: true });
    // добавить вещество поиском
    await p.click('#clearBtn');
    await p.fill('#q', 'аргинин'); await p.keyboard.press('Enter');
    await p.fill('[data-a="0"]', '1000');
    await p.fill('#q', 'nadh'); await p.keyboard.press('Enter');
    await p.fill('[data-a="1"]', '10');
    await p.click('[data-f="drops"]');
    if (tag === 'desktop') console.log('поиск+ввод →', await p.textContent('.verdict .big'));
    // копирование
    await p.click('#copyBtn');
    // карточка
    await p.goto('file://' + path.join(__dirname, '..', 'index.html') + '#card/vitc');
    await p.waitForSelector('.chart svg');
    const ch = await p.$('[data-chart]'); await ch.scrollIntoViewIfNeeded(); const bb = await ch.boundingBox(); await p.mouse.move(bb.x + bb.width * 0.4, bb.y + bb.height / 2);
    if (tag === 'desktop') console.log('chart tip:', (await p.textContent('#tip')).slice(0, 60));
    if (out) await p.screenshot({ path: `${out}/${tag}-card.png`, fullPage: true });
    for (const id of ['curcumin', 'oxytocin', 'spirulina', 'cubis', 'nadh', 'mct']) { await p.goto('file://' + path.join(__dirname, '..', 'index.html') + '#card/' + id); await p.waitForSelector('#mol table'); }
    await p.goto('file://' + path.join(__dirname, '..', 'index.html') + '#method');
    if (out && tag === 'mobile') await p.screenshot({ path: `${out}/${tag}-method.png` });
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (sw > 0) errs.push(`[${tag}] горизонтальная прокрутка ${sw}px`);
    await p.close();
  };
  await run({ viewport: { width: 1400, height: 900 } }, 'desktop');
  await run({ viewport: { width: 1400, height: 900 }, colorScheme: 'dark' }, 'dark');
  await run({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'mobile');
  await b.close();
  console.log(errs.length ? 'ОШИБКИ:\n' + errs.join('\n') : 'Ошибок в консоли нет');
  process.exit(errs.length ? 1 : 0);
})();
