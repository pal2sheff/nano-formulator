// Тесты движка совместимости: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.js');
const A = load();

const run = (form, items, P = {}) => A.analyze({ form, P, items: items.map(([id, amt, unit]) => ({ id, amt, unit: unit || 'мг' })) });
const has = (res, pred) => res.findings.find(pred);
const pair = (f, a, b) => f.ids.includes(a) && f.ids.includes(b);
const maxPair = (res, a, b, cats) => Math.max(-1, ...res.findings.filter(f => f.cat !== 'syn' && pair(f, a, b) && (!cats || cats.includes(f.cat))).map(f => f.sev));

test('НАДН + витамин C в водных каплях — несовместимо (кислотный гидролиз, pH вне окна)', () => {
  const r = run('drops', [['nadh', 10], ['vitc', 100]]);
  assert.ok(r.summary.pH < 4, 'pH должен быть кислым: ' + r.summary.pH);
  assert.equal(r.maxSev, 4);
  const f = has(r, f => f.rule === 'acidlabile_acid' && pair(f, 'nadh', 'vitc'));
  assert.ok(f && f.sev === 4 && f.cat === 'chem');
  const w = has(r, f => f.rule === 'ph_window' && f.ids[0] === 'nadh');
  assert.ok(w, 'нет находки по окну pH НАДН');
  assert.ok(w.shifters.some(s => s.id === 'vitc'), 'витамин C должен быть назван как сдвигающий pH');
  assert.ok(has(r, f => f.rule === 'ph_overlap'), 'окна pH НАДН и витамина C не пересекаются');
});

test('НАДН + витамин C: тяжесть зависит от фазы (капсула мягче, чем капли)', () => {
  const caps = run('caps', [['nadh', 10], ['vitc', 100]]);
  const drops = run('drops', [['nadh', 10], ['vitc', 100]]);
  assert.ok(maxPair(caps, 'nadh', 'vitc', ['chem']) < maxPair(drops, 'nadh', 'vitc', ['chem']));
  assert.equal(maxPair(caps, 'nadh', 'vitc', ['chem']), 2);
});

test('Медь + NAC + витамин C в каплях — катализ окисления медью', () => {
  const r = run('drops', [['cubis', 2], ['nac', 100], ['vitc', 100]], { vdose: 2 });
  const cuNac = has(r, f => f.rule === 'cu_thiol' && pair(f, 'cubis', 'nac'));
  const cuC = has(r, f => f.rule === 'redoxmetal_reducing' && pair(f, 'cubis', 'vitc'));
  assert.ok(cuNac && cuNac.sev === 4, 'Cu + NAC');
  assert.ok(cuC && cuC.sev === 4, 'Cu + витамин C');
  assert.equal(maxPair(r, 'nac', 'vitc', ['chem']), -1, 'NAC и витамин C между собой химически совместимы');
  const sp = A.suggestSplit(r);
  assert.ok(sp && sp.groups.length >= 2);
  const g = sp.groups.find(g => g.ids.includes('cubis'));
  assert.ok(!g.ids.includes('nac') && !g.ids.includes('vitc'), 'медь отделена от восстановителей');
});

test('Лактоза (наполнитель) + аминокислота в капсуле — реакция Майяра', () => {
  const r = run('caps', [['lys', 500]], { filler: 'lactose' });
  const f = has(r, f => f.rule === 'maillard' && pair(f, 'lactose', 'lys'));
  assert.ok(f, 'нет реакции Майяра');
  assert.ok(f.sev >= 2);
  const mcc = run('caps', [['lys', 500]], { filler: 'mcc' });
  assert.ok(!has(mcc, f => f.rule === 'maillard'), 'с МКЦ реакции быть не должно');
  const glyc = run('caps', [['glycine', 500], ['lactose', 100]]);
  assert.ok(has(glyc, f => f.rule === 'maillard' && pair(f, 'lactose', 'glycine')), 'лактоза, добавленная явно');
});

test('Тадалафил + L-аргинин в троше — загрузка, суммирование гипотензии, синергия NO/цГМФ', () => {
  const r = run('troche', [['tadalafil', 5], ['arg', 1000]]);
  const load = has(r, f => f.rule === 'unit_load');
  assert.ok(load && load.sev >= 3, 'перегрузка троше');
  assert.ok(has(r, f => f.rule === 'g_hypotens' && pair(f, 'tadalafil', 'arg') && f.sev >= 2), 'гипотензия');
  assert.ok(has(r, f => f.cat === 'syn' && pair(f, 'tadalafil', 'arg')), 'синергия NO + ФДЭ-5');
  assert.ok(has(r, f => f.rule === 'form_Вкус' && f.ids[0] === 'arg'), 'вкус щелочного аргинина');
});

test('Синефрин + мелатонин — антагонизм и разное время приёма, разделение', () => {
  const r = run('caps', [['synephrine', 30], ['melatonin', 3]]);
  const f = has(r, f => f.rule === 'stim_sed');
  assert.ok(f && f.cat === 'pharm' && f.sev === 3);
  const sp = A.suggestSplit(r);
  assert.equal(sp.groups.length, 2);
});

test('Куркумин + пиперин — синергия биодоступности, без проблем', () => {
  const r = run('caps', [['curcumin', 500], ['piperine', 10]]);
  assert.ok(has(r, f => f.cat === 'syn' && f.rule === 'syn_piperine' && pair(f, 'curcumin', 'piperine')));
  assert.ok(r.maxSev <= 1, 'сочетание в капсуле не должно давать проблем выше «Учесть»');
  assert.equal(A.suggestSplit(r), null);
});

test('Пиперин + тадалафил — ингибирование CYP3A4', () => {
  const r = run('caps', [['tadalafil', 5], ['piperine', 10]]);
  assert.ok(has(r, f => f.rule === 'cyp3a4' && f.sev >= 2));
});

test('Железо + кальций + витамин C: конкуренция за всасывание и синергия Fe + C', () => {
  const r = run('caps', [['fefum', 60], ['cacit', 300], ['vitc', 200]]);
  assert.ok(has(r, f => f.rule === 'fe_ca'));
  assert.ok(has(r, f => f.rule === 'syn_fe_c'));
});

test('Масляные капли: D3 растворим, гидрофильное вещество — взвесь', () => {
  const r = run('oildr', [['vitd3', 2000, 'МЕ'], ['nmn', 100]]);
  const d3 = r.rows.find(x => x.id === 'vitd3'), nmn = r.rows.find(x => x.id === 'nmn');
  assert.equal(d3.status, 'раствор');
  assert.equal(d3.mg, 0.05);
  assert.equal(nmn.status, 'взвесь');
  assert.ok(has(r, f => f.item === 'nmn' && f.type === 'Фаза' && f.sev >= 2));
});

test('Назальный спрей: осмоляльность рассчитывается', () => {
  const r = run('nasal', [['oxytocin', 24, 'МЕ'], ['nacl', 1.6]]);
  assert.ok(r.summary.osm > 200 && r.summary.osm < 350, 'осм ' + r.summary.osm);
});

test('Пробиотик в водных каплях — несовместимо; в капсулах — допустимо с мерами (влага)', () => {
  assert.equal(run('drops', [['akkermansia', 100]]).maxSev, 4);
  assert.ok(run('caps', [['akkermansia', 100]]).maxSev <= 2);
});

test('Берберин в карбомерном геле — осаждение катиона', () => {
  const r = run('gel', [['berberine', 20]], { gelling: 'carbomer' });
  assert.ok(r.maxSev >= 3);
  const hec = run('gel', [['berberine', 20]], { gelling: 'hec' });
  assert.ok(hec.maxSev < r.maxSev);
});

test('Капсулы: число и размер', () => {
  const r = run('caps', [['mgcit', 2000]]);
  assert.ok(r.summary.caps.n >= 3, 'много капсул для 2 г цитрата магния');
  const r2 = run('caps', [['melatonin', 3]]);
  assert.equal(r2.summary.caps.n, 1);
});

test('Пустая рецептура и все вещества во всех формах — без исключений', () => {
  assert.equal(run('caps', []).maxSev, 0);
  for (const id of Object.keys(A.BY)) {
    const s = A.suitability(id);
    assert.equal(s.length, Object.keys(A.FORMS).length);
  }
});

test('Заключение для копирования содержит вердикт и находки', () => {
  const r = run('drops', [['nadh', 10], ['vitc', 100]]);
  const t = A.reportText(r, A.suggestSplit(r));
  assert.match(t, /ВЕРДИКТ: Несовместимо/);
  assert.match(t, /Кислотный гидролиз/);
  assert.match(t, /Предлагаемое разделение/);
});

/* ---------- Вещества, добавленные 11.2026 ---------- */
test('Липосомы: в водно-спиртовых каплях и троше разрушаются, в водных каплях — нет', () => {
  assert.ok(has(run('hydro', [['curc_lipo', 200]]), f => f.type === 'Липосомы' && f.sev === 3));
  assert.ok(has(run('troche', [['resv_lipo', 100]]), f => f.type === 'Липосомы' && f.sev === 3));
  assert.ok(!has(run('drops', [['resv_lipo', 100]], { vdose: 2 }), f => f.type === 'Липосомы'));
});
test('Липосомальная форма наследует правила исходного вещества (пиперин + куркумин)', () => {
  assert.ok(has(run('caps', [['curc_lipo', 200], ['piperine', 10]]), f => f.rule === 'syn_piperine'));
});
test('N-ацетилглюкозамин — восстанавливающий сахар: Майяр с лизином', () => {
  assert.ok(has(run('caps', [['nag', 500], ['lys', 500]]), f => f.rule === 'maillard'));
});
test('Рибофлавин-фосфат на свету ускоряет разрушение витамина C в каплях', () => {
  assert.ok(has(run('drops', [['b2', 10], ['vitc', 100]]), f => f.rule === 'b2_photo' && f.sev === 2));
});
test('Бисглицинат железа: окисляет витамин C в жидкости, pH 1% — щелочной (модель хелата)', () => {
  assert.ok(has(run('drops', [['febis', 50], ['vitc', 100]], { vdose: 2 }), f => f.rule === 'redoxmetal_reducing'));
});
test('Новые вещества: структура и дескрипторы RDKit, синонимы находятся', () => {
  for (const id of ['nag', 'b2', 'succinic', 'butyrate', 'aucubin', 'mgthr']) assert.ok(A.BY[id].svg && A.BY[id].tpsa != null, id);
  assert.ok(Object.values(A.BY).filter(m => (m.syn || '').includes('Гриффония')).some(m => m.id === 'htp'));
  assert.equal(Object.keys(A.BY).length, 301);
  for (const id of ['methblue', 'eugenol', 'dmannose', 'betaala']) assert.ok(A.BY[id].svg, id);
});

/* ---------- Конструктор сайта в версии технолога ---------- */
test('Формы сайта переводятся в формы движка; гамми — троше на желатине', () => {
  assert.deepEqual(A.engineFor('КП').form, 'caps');
  const g = A.engineFor('ГМ'); assert.equal(g.form, 'troche'); assert.equal(g.P.base, 'gelatin');
  assert.equal(A.engineFor('СЛ').form, 'drops');
});
test('Позиции сайта → состав движка: единицы сайта, профилактическая доза, анализ в форме', () => {
  const items = [{ n: 'NADH', amt: A.siteDose('NADH', 'СЛ').prof }, { n: 'Липосомальный NAD+', amt: A.siteDose('Липосомальный NAD+', 'СЛ').prof }];
  const ei = A.engineItems(items, 'СЛ');
  assert.equal(ei[0].id, 'nadh'); assert.equal(ei[0].unit, 'мг');
  const r = A.analyze({ form: 'drops', P: A.engineP('СЛ', ei), items: ei });
  assert.ok(r.findings.some(f => f.rule === 'ph_overlap'));
});
test('Отметки технолога: окна pH в каплях, таблица аптеки, без проблем в капсулах', () => {
  assert.equal(A.sitePairStatus('NADH', 'Липосомальный Витамин C (аскорбиновая кислота)', 'СЛ').lvl, 2);
  assert.equal(A.sitePairStatus('NADH', 'Липосомальный Витамин C (аскорбиновая кислота)', 'КП').lvl, 0);
  assert.equal(A.sitePairStatus('Бромелайн', 'Семакс', 'НС').lvl, 3);
  assert.equal(A.zoneOf(A.siteDose('Астаксантин', 'СЛ').ther, A.siteDose('Астаксантин', 'СЛ')), 'ther');
});
