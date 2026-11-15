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
test('Направленность: каждое активное вещество (кроме b14 и пиперина) отнесено к направлению', () => {
  const miss = Object.values(A.BY).filter(m => m.kind !== 'excipient' && !A.DIR_OF[m.id]).map(m => m.id);
  assert.deepEqual(miss.sort(), ['b14', 'piperine']);
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
