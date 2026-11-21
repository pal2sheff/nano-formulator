// Тесты врачебной версии: node --test test/doc.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load.js').load();
const run = (ids, cond = []) => A.analyzeDoc(ids.split(' '), cond);

test('Химия и технология не попадают во врачебную версию', () => {
  const r = run('nadh vitc cubis nac');
  for (const f of r.inter) assert.ok(!['acidlabile_acid', 'redoxmetal_reducing', 'cu_thiol', 'maillard'].includes(f.rule), f.rule);
});
test('Синефрин + мелатонин: антагонизм, утро/вечер, два приёма', () => {
  const r = run('synephrine melatonin');
  assert.ok(r.inter.some(f => f.rule === 'stim_sed' && f.sev === 3));
  assert.deepEqual([...r.schedule.slots.morning], ['synephrine']);
  assert.deepEqual([...r.schedule.slots.evening], ['melatonin']);
  assert.equal(r.groups.length, 2);
  assert.equal(r.verdict.k, 'major');
});
test('Куркумин + пиперин: синергия, противоречий нет', () => {
  const r = run('curcumin piperine');
  assert.ok(r.syn.some(f => f.rule === 'syn_piperine'));
  assert.equal(r.verdict.k, 'ok');
});
test('Метформин + берберин у пациента на сахароснижающей терапии', () => {
  const r = run('metformin berberine mecbl', ['diab']);
  assert.equal(r.verdict.k, 'crit');
  assert.ok(r.inter.some(f => f.rule === 'g_hypogly'));
  assert.ok(r.syn.some(f => f.rule === 'syn_b12depl'));
});
test('5-HTP + SAMe на антидепрессантах — противопоказано', () => {
  const r = run('htp same', ['ssri']);
  assert.equal(r.verdict.k, 'crit');
  assert.ok(r.patient[0].items.some(x => x.id === 'htp' && x.sev === 3));
});
test('Наттокиназа + антикоагулянты; витамин K2 и варфарин', () => {
  assert.equal(run('nattokinase', ['anticoag']).verdict.k, 'crit');
  assert.ok(A.contraFor(A.BY.vitk2).some(c => c.c === 'anticoag' && c.sev === 3));
});
test('Тадалафил: нитраты — противопоказано; без нитратов — суммирование с аргинином умеренно', () => {
  assert.equal(run('tadalafil', ['nitrates']).verdict.k, 'crit');
  const r = run('tadalafil arg');
  assert.ok(r.inter.some(f => f.rule === 'g_hypotens' && f.sev === 2));
  assert.ok(r.syn.some(f => f.rule === 'syn_no_pde5'));
});
test('Железо + кальций: разнести по времени, Fe + C — синергия', () => {
  const r = run('fefum cacit vitc');
  assert.ok(r.schedule.separate.some(p => p.includes('fefum') && p.includes('cacit')));
  assert.ok(r.syn.some(f => f.rule === 'syn_fe_c'));
});
test('Беременность: гормоны и DIM противопоказаны, фолат — нет', () => {
  const r = run('dim mthf dhea', ['preg']);
  const it = r.patient[0].items;
  assert.ok(it.some(x => x.id === 'dim' && x.sev === 3));
  assert.ok(it.some(x => x.id === 'dhea' && x.sev === 3));
  assert.ok(!it.some(x => x.id === 'mthf'));
});
test('Направленность: каждое активное вещество (кроме пиперина) отнесено к направлению; b14 = PQQ', () => {
  const miss = Object.values(A.BY).filter(m => m.kind !== 'excipient' && !A.DIR_OF[m.id]).map(m => m.id);
  assert.deepEqual(miss.sort(), ['piperine']);
  const r = run('nmn coq10 pqq resv');
  assert.equal(r.dirList[0].k, 'energy');
});
test('Карточки и анализ всех веществ — без исключений', () => {
  for (const m of Object.values(A.BY)) if (m.kind !== 'excipient') { A.contraFor(m); A.analyzeDoc([m.id], ['preg', 'kidney']); }
  assert.ok(A.partners('curcumin').syn.some(x => x.id === 'piperine'));
});
test('Заключение', () => {
  const t = A.docReport(run('synephrine melatonin', ['htn']));
  assert.match(t, /ВЕРДИКТ/); assert.match(t, /Схема приёма/); assert.match(t, /Артериальная гипертензия/);
});

/* ---------- Формы доставки ---------- */
const F = (ids, dose) => A.formsFor(ids.split(' '), dose);
const rate = (r, f) => (r.rows.find(x => x.f === f) || { rating: r.na.includes(f) ? 'na' : '?' }).rating;
test('Формы: НАДН + витамин C — капсулы можно, водные капли нельзя', () => {
  const r = F('nadh vitc');
  assert.ok(['best', 'ok'].includes(rate(r, 'caps')));
  assert.equal(rate(r, 'drops'), 'no');
});
test('Формы: пептид — предпочтительно назально/сублингвально, при проглатывании с ограничениями', () => {
  const r = F('semax');
  assert.equal(rate(r, 'nasal'), 'best');
  assert.equal(rate(r, 'caps'), 'limit');
  assert.equal(rate(r, 'cream'), 'na');
});
test('Формы: D3 + K2 — масляные капли предпочтительны, водные с ограничениями', () => {
  const r = F('vitd3 vitk2');
  assert.equal(rate(r, 'oildr'), 'best');
  assert.equal(rate(r, 'drops'), 'limit');
});
test('Формы: пробиотик — нельзя в жидких и с нагревом, мармелад включён', () => {
  const r = F('akkermansia');
  assert.equal(rate(r, 'drops'), 'no');
  assert.equal(rate(r, 'troche'), 'no');
  assert.equal(rate(r, 'gummy'), 'no');
  assert.ok(['best', 'ok'].includes(rate(r, 'caps')));
});
test('Формы: доза влияет на загрузку (аргинин 5 г — троше нельзя)', () => {
  assert.equal(rate(F('arg', { arg: { amt: 5000, unit: 'мг' } }), 'troche'), 'no');
  assert.ok(F('arg', { arg: { amt: 5000, unit: 'мг' } }).typical === false);
});
test('Формы: прогестерон — наружные и вагинальные формы применимы', () => {
  const r = F('prog');
  assert.notEqual(rate(r, 'vag'), 'na');
  assert.notEqual(rate(r, 'td'), 'na');
});
test('Формы: медь + NAC + витамин C — жидкие нельзя', () => {
  const r = F('cubis nac vitc');
  assert.equal(rate(r, 'drops'), 'no');
});

/* ---------- Мишени и метаболизм ---------- */
test('Данные о мишенях и метаболизме есть у всех активных веществ', () => {
  for (const m of Object.values(A.BY)) if (m.kind !== 'excipient') assert.ok(A.PK[m.id], m.id);
});
test('Нагрузка: тадалафил + берберин + пиперин — CYP3A4 высокая, с ингибиторами', () => {
  const r = A.pkLoad(['tadalafil', 'berberine', 'piperine']);
  const c = r.rows.find(x => x.k === 'CYP3A4');
  assert.equal(c.lvl, 3);
  assert.ok(c.inh.some(x => x.id === 'piperine'));
});
test('Нагрузка: мелатонин + кофеин + DIM — CYP1A2 с индуктором', () => {
  const c = A.pkLoad(['melatonin', 'yerba', 'dim']).rows.find(x => x.k === 'CYP1A2');
  assert.ok(c.sub.length === 2 && c.ind.some(x => x.id === 'dim'));
});
test('Нагрузка: никотинамид + SAMe + TMG — метилирование; UGT не выше умеренной', () => {
  assert.equal(A.pkLoad(['nam', 'same', 'tmg']).rows.find(x => x.k === 'Метилирование').lvl, 3);
  assert.ok(A.pkLoad(['quercetin', 'resv', 'curcumin', 'egcg']).rows.find(x => x.k === 'UGT').lvl <= 2);
});
test('Общие мишени: 5-HTP и леводопа — AADC', () => {
  assert.ok(A.pkLoad(['htp', 'ldopa']).shared.some(t => t.k === 'AADC'));
});

/* ---------- Вещества, добавленные 11.2026 ---------- */
test('Чистотел — противопоказан при болезнях печени и беременности', () => {
  const c = A.contraFor(A.BY.celandine);
  assert.ok(c.some(x => x.c === 'liver' && x.sev === 3) && c.some(x => x.c === 'preg' && x.sev === 3));
});
test('Серрапептаза, чеснок, конский каштан + антикоагулянты — осторожно', () => {
  for (const id of ['serrapeptase', 'garlic', 'horsechest']) assert.ok(A.contraFor(A.BY[id]).some(x => x.c === 'anticoag' && x.sev >= 2), id);
});
test('Липосомальные формы наследуют синергию, направленность и метаболизм', () => {
  assert.ok(run('curc_lipo piperine').syn.some(f => f.rule === 'syn_piperine'));
  assert.ok(A.DIR_OF.resv_lipo && A.PK.resv_lipo);
});
test('Рибофлавин + B6 + метилфолат — синергия кофакторов; слизи снижают всасывание минералов', () => {
  assert.ok(run('b2 p5p').syn.length);
  assert.ok(run('slipelm febis').inter.some(f => f.rule === 'fibre_abs'));
});
test('Формы: BPC-157 — назально/сублингвально предпочтительно, бутират — ректально применим', () => {
  const r = F('bpc157'); assert.ok(['best', 'ok'].includes(rate(r, 'nasal')));
  assert.notEqual(rate(F('butyrate'), 'supp'), 'na');
});
test('Все активные вещества имеют направленность (кроме пиперина) и данные метаболизма', () => {
  const act = Object.values(A.BY).filter(m => m.kind !== 'excipient');
  assert.equal(act.length, 263);
  assert.deepEqual(act.filter(m => !A.DIR_OF[m.id]).map(m => m.id).sort(), ['piperine']);
  assert.ok(act.every(m => A.PK[m.id]));
});

/* ---------- Конструктор как на сайте ---------- */
const st = (form, names, cond = []) => ({ form, items: names.map(n => ({ n, amt: A.siteDose(n, form) ? A.siteDose(n, form).prof : 0 })), cond });
test('Справочник сайта: 9 форм, 251 молекула, все сопоставлены с базой', () => {
  assert.equal(A.SITE.forms.length, 9);
  assert.equal(Object.keys(A.SITE.mols).length, 251);
  for (const [n, v] of Object.entries(A.SITE.mols)) assert.ok(A.BY[v.id], n);
  assert.equal(A.SITE.mols['Метиленовый синий'].id, 'methblue');
  assert.equal(A.SITE.mols['Бетаин HCl'].id, 'betainehcl');
});
test('Отметки: NAC + йод — конфликт (таблица аптеки), NAC + медь в каплях — конфликт, NAC + глицин — синергия', () => {
  const S = st('СЛ', ['N-Ацетилцистеин']);
  assert.equal(A.candStatus('Йод', S).lvl, 3);
  assert.equal(A.candStatus('Меди бисглицинат', S).lvl, 3);
  assert.equal(A.candStatus('Глицин', S).lvl, 1);
});
test('Отметки: синефрин + мелатонин — конфликт; минералы между собой — осторожно (таблица аптеки)', () => {
  assert.equal(A.candStatus('Мелатонин', st('КП', ['Синефрина гидрохлорид'])).lvl, 3);
  assert.equal(A.candStatus('Цинка бисглицинат', st('КП', ['Магния бисглицинат'])).lvl, 2);
});
test('Отметки учитывают пациента: наттокиназа при антикоагулянтах — конфликт', () => {
  assert.equal(A.candStatus('Наттокиназа', st('КП', ['Экстракт куркумы'], ['anticoag'])).lvl, 3);
});
test('Сравнение форм сайта: недоступная в форме молекула — «нельзя»', () => {
  const F = A.siteFormsFor(st('КП', ['Меди бисглицинат', 'N-Ацетилцистеин']).items, 'КП');
  assert.ok(F.rows.some(r => r.f === 'НС' && r.rating === 'no'));
  assert.ok(F.rows.some(r => r.f === 'КП' && ['best', 'ok'].includes(r.rating)));
});
