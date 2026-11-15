/* ===== Врачебная версия: анализ ===== */
'use strict';

function selMatch(m, s) {
  if (s == null) return true;
  if (Array.isArray(s)) return s.some(x => selMatch(m, x));
  if (typeof s === 'function') return !!s(m);
  if (s.startsWith('id:')) return m.id === s.slice(3) || m.base === s.slice(3);
  return m.T.has(s);
}

// противопоказания вещества: [{c, sev, t}] — по каждому состоянию самое строгое
function contraFor(m) {
  const by = {};
  for (const r of CONTRA) {
    if (r.fallback && by[r.c]) continue;
    if (!selMatch(m, r.sel)) continue;
    if (!by[r.c] || by[r.c].sev < r.sev) by[r.c] = { c: r.c, sev: r.sev, t: r.t };
  }
  return Object.values(by);
}

const DOC_SEV = { 3: { k: 'major', t: 'Серьёзно' }, 2: { k: 'mod', t: 'Умеренно' }, 1: { k: 'minor', t: 'Учесть' } };
const CONTRA_SEV = { 3: { k: 'crit', t: 'Противопоказано' }, 2: { k: 'mod', t: 'С осторожностью' }, 1: { k: 'minor', t: 'Учесть' } };

function analyzeDoc(ids, cond = []) {
  ids = [...new Set(ids)].filter(id => BY[id] && (BY[id].kind !== 'excipient' || (typeof SITE_IDS !== 'undefined' && SITE_IDS[id])));
  const ms = ids.map(id => BY[id]);
  const condSet = new Set(cond);
  const inter = [], syn = [];

  // парные фармакологические правила и синергия
  for (let i = 0; i < ms.length; i++) for (let j = 0; j < ms.length; j++) {
    if (i === j) continue;
    const A = ms[i], B = ms[j];
    for (const R of PAIR_RULES) {
      if (R.cat !== 'pharm') continue;
      if (DOC_SKIP_RULES.has(R.id)) continue;
      if (R.a === R.b && j < i) continue;
      if (!matchSel(A, R.a) || !matchSel(B, R.b)) continue;
      if (R.not && (R.not(A) || R.not(B))) continue;
      if (R.when && R.cat !== 'syn' && !R.when(A, B, { pc: 'D', items: [] })) continue;
      if (R.id === 'syn_edta' || R.id === 'syn_taste') continue;
      const key = R.id + ':' + [A.id, B.id].sort().join('|');
      const list = R.cat === 'syn' ? syn : inter;
      if (list.some(f => f.key === key)) continue;
      const sev = R.cat === 'syn' ? 0 : sevFor(R.sev, 'D', A, B, { pc: 'D' });
      if (R.cat !== 'syn' && !(sev > 0)) continue;
      list.push({ key, rule: R.id, sev, type: R.type, ids: [A.id, B.id], t: A.ru + ' + ' + B.ru, mech: fill(R.mech, A, B), act: fill(R.act, A, B), split: !!R.split });
    }
  }
  // синергия: правила базы + врачебные пары
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) synBetween(ms[i], ms[j]).forEach(f => syn.push(f));
  // группы: суммирование эффектов
  for (const G of GROUP_RULES) {
    const mm = ms.map(m => ({ m, w: G.w(m) })).filter(o => o.w > 0);
    if (mm.length < 2) continue;
    const sum = mm.reduce((a, o) => a + o.w, 0);
    if (sum < G.min) continue;
    const list = mm.map(o => o.m);
    inter.push({ rule: G.id, sev: G.sev(list, sum), type: G.type, ids: list.map(m => m.id), t: list.map(m => m.ru).join(' + '), mech: G.mech, act: G.act, group: true });
  }
  // синергия «пиперин + куркумин» и пр. — объединяем дубли с одинаковым типом не нужно; сортировка
  inter.sort((a, b) => b.sev - a.sev);

  // направленность
  const dirs = {};
  ms.forEach(m => (DIR_OF[m.id] || []).forEach(d => { (dirs[d] = dirs[d] || []).push(m.id); }));
  const dirList = Object.entries(dirs).map(([k, v]) => ({ k, n: DIRS[k].n, ids: v })).sort((a, b) => b.ids.length - a.ids.length || a.n.localeCompare(b.n, 'ru'));

  // противопоказания
  const contra = [];
  ms.forEach(m => contraFor(m).forEach(c => contra.push(Object.assign({ id: m.id }, c))));
  const byCond = {};
  contra.forEach(c => { (byCond[c.c] = byCond[c.c] || []).push(c); });
  const condRows = CONDITIONS.filter(c => byCond[c.k]).map(c => ({ k: c.k, n: c.n, sel: condSet.has(c.k), sev: Math.max(...byCond[c.k].map(x => x.sev)), items: byCond[c.k].sort((a, b) => b.sev - a.sev) }))
    .sort((a, b) => (b.sel - a.sel) || (b.sev - a.sev));
  const patient = condRows.filter(r => r.sel);

  // общие предостережения
  const notes = [];
  ms.forEach(m => GENERAL_NOTES.forEach(n => { if (n.id ? m.id === n.id : m.T.has(n.tag)) notes.push({ id: m.id, t: n.tx || n.t }); }));

  // схема приёма
  const tim = {}; ms.forEach(m => { tim[m.id] = timing(m); });
  const slots = { morning: [], evening: [], any: [] };
  ms.forEach(m => slots[tim[m.id].slot].push(m.id));
  const food = { empty: ms.filter(m => tim[m.id].food === 'empty').map(m => m.id), food: ms.filter(m => tim[m.id].food === 'food').map(m => m.id) };
  const separate = inter.filter(f => f.split && f.sev >= 2 && !f.group).map(f => f.ids);
  const conflictTime = slots.morning.length && slots.evening.length;
  const conflictFood = food.empty.length && food.food.length;
  const schedule = { slots, food, separate, conflictTime: !!conflictTime, conflictFood: !!conflictFood, tim };
  if (conflictFood) inter.push({ rule: 'food_conflict', sev: 1, type: 'Приём относительно еды', ids: food.empty.concat(food.food), t: 'Разные требования к приёму пищи',
    mech: `Натощак лучше принимать: ${food.empty.map(nm).join(', ')}; во время еды — ${food.food.map(nm).join(', ')}. В одной форме часть веществ будет приниматься в неоптимальных условиях.`,
    act: 'Если состав в одной форме — выбрать время по приоритетному компоненту или разделить на два приёма.', split: true });

  // разделение на приёмы (раскраска графа)
  const edges = [];
  inter.forEach(f => { if (f.split && f.sev >= 2 && !f.group) edges.push([f.ids[0], f.ids[1]]); });
  if (conflictTime) slots.morning.forEach(a => slots.evening.forEach(b => { if (!edges.some(e => e.includes(a) && e.includes(b))) edges.push([a, b]); }));
  const groups = edges.length ? colorGraph(ids, edges) : null;

  // вердикт
  const pMax = patient.length ? Math.max(...patient.map(r => r.sev)) : 0;
  const iMax = inter.length ? Math.max(...inter.map(f => f.sev)) : 0;
  let verdict;
  if (pMax >= 3) verdict = { k: 'crit', t: 'Противопоказано пациенту', d: 'В составе есть вещества, противопоказанные при отмеченных состояниях. См. блок «Противопоказания».' };
  else if (iMax >= 3) verdict = { k: 'major', t: 'Есть серьёзные противоречия', d: 'Компоненты противоречат друг другу или их эффекты опасно суммируются. Рекомендуется изменить состав или разделить приём.' };
  else if (iMax >= 2 || pMax >= 2) verdict = { k: 'mod', t: 'Допустимо с оговорками', d: 'Сочетание возможно при соблюдении рекомендаций: время приёма, контроль показателей, осторожность при отмеченных состояниях.' };
  else verdict = { k: 'ok', t: syn.length ? 'Сочетание оправдано' : 'Противоречий не найдено', d: syn.length ? 'Существенных противоречий нет, есть полезные сочетания.' : 'Существенных противоречий по базе не найдено.' };
  if (!ms.length) verdict = null;

  return { ids, ms, cond: [...condSet], inter, syn, dirList, condRows, patient, notes, schedule, groups, verdict };
}

/* ---------- Синергия пары ---------- */
const SYN_CACHE = new Map();
function synBetween(A, B) {
  const ck = A.id < B.id ? A.id + '|' + B.id : B.id + '|' + A.id;
  if (SYN_CACHE.has(ck)) return SYN_CACHE.get(ck);
  const out = [], seen = new Set();
  const push = (X, Y, type, mech, rule) => { if (seen.has(type)) return; seen.add(type); out.push({ key: rule + ':' + ck, rule, sev: 0, type, ids: [X.id, Y.id], t: X.ru + ' + ' + Y.ru, mech }); };
  for (const [X, Y] of [[A, B], [B, A]]) {
    for (const R of PAIR_RULES) {
      if (R.cat !== 'syn' || DOC_SKIP_RULES.has(R.id)) continue;
      if (!matchSel(X, R.a) || !matchSel(Y, R.b)) continue;
      if (R.not && (R.not(X) || R.not(Y))) continue;
      push(X, Y, R.type, fill(R.mech, X, Y), R.id);
    }
    for (const [k, R] of DOC_SYN.entries()) {
      if (!selMatch(X, R.a) || !selMatch(Y, R.b) || X.id === Y.id) continue;
      if (R.not && (R.not(X) || R.not(Y))) continue;
      push(X, Y, R.type, R.t, 'dsyn' + k);
    }
  }
  SYN_CACHE.set(ck, out);
  return out;
}
// подсказки: чем можно усилить состав (синергия с выбранными, без серьёзных взаимодействий и противопоказаний пациенту)
function suggest(r, limit = 8) {
  if (!r.ms.length) return [];
  const have = new Set(r.ids), cand = [];
  for (const o of LIST) {
    if (o.kind === 'excipient' || have.has(o.id)) continue;
    const with_ = r.ms.filter(m => synBetween(m, o).length);
    if (!with_.length) continue;
    if (r.cond.length && contraFor(o).some(c => r.cond.includes(c.c) && c.sev >= 2)) continue;
    const t = analyzeDoc(r.ids.concat(o.id), []);
    if (t.inter.some(f => f.sev >= 2 && f.ids.includes(o.id))) continue;
    cand.push({ id: o.id, with: with_.map(m => m.id), type: synBetween(with_[0], o)[0].type, rx: o.T.has('rx') });
  }
  const PREF = ['cacit', 'mgbis', 'znbis', 'fefum', 'mecbl', 'mthf', 'vitc', 'p5p', 'vitd3', 'vitk2', 'semet', 'nmn', 'resv', 'dha', 'curcumin', 'gsh'];
  const pr = id => { const i = PREF.indexOf(id); return i < 0 ? 99 : i; };
  const haveKeys = new Set(r.ms.map(dupKey).filter(Boolean)), used = new Set();
  return cand.filter(c => !c.rx).sort((a, b) => b.with.length - a.with.length || pr(a.id) - pr(b.id) || nm(a.id).localeCompare(nm(b.id), 'ru'))
    .filter(c => { const k = dupKey(BY[c.id]); if (!k) return true; if (haveKeys.has(k) || used.has(k)) return false; used.add(k); return true; })
    .slice(0, limit);
}

/* ---------- Карточка: партнёры по синергии и взаимодействиям ---------- */
function partners(id) {
  const m = BY[id]; const syn = [], inter = [];
  for (const o of LIST) {
    if (o.id === id || o.kind === 'excipient') continue;
    synBetween(m, o).forEach(f => syn.push({ id: o.id, type: f.type }));
    const r = analyzeDoc([id, o.id]);
    r.inter.filter(f => !f.group && f.rule !== 'food_conflict').forEach(f => inter.push({ id: o.id, sev: f.sev, type: f.type }));
  }
  const uniq = a => { const s = {}; a.forEach(x => { if (!s[x.id] || (x.sev || 0) > (s[x.id].sev || 0)) s[x.id] = x; }); return Object.values(s); };
  return { syn: uniq(syn), inter: uniq(inter).sort((a, b) => b.sev - a.sev) };
}

/* ---------- Текст заключения ---------- */
function docReport(r) {
  const L = [];
  L.push('ЗАКЛЮЧЕНИЕ ПО СОСТАВУ (оценка по базе взаимодействий; решение — за врачом)');
  L.push('Состав: ' + r.ms.map(m => m.ru).join('; '));
  if (r.cond.length) L.push('Пациент: ' + r.cond.map(c => COND_N[c]).join('; '));
  L.push('ВЕРДИКТ: ' + r.verdict.t + '. ' + r.verdict.d);
  if (r.dirList.length) L.push('Направленность: ' + r.dirList.map(d => `${d.n} (${d.ids.map(nm).join(', ')})`).join('; '));
  if (r.patient.length) { L.push(''); L.push('Противопоказания для пациента:'); r.patient.forEach(c => c.items.forEach(x => L.push(`  • [${CONTRA_SEV[x.sev].t}] ${COND_N[c.k]}: ${nm(x.id)} — ${x.t}`))); }
  if (r.syn.length) { L.push(''); L.push('Синергия:'); r.syn.forEach(f => L.push(`  + ${f.t} — ${f.type}`)); }
  const main = r.inter.filter(f => f.sev >= 2);
  if (main.length) { L.push(''); L.push('Взаимодействия:'); main.forEach(f => { L.push(`  • [${DOC_SEV[f.sev].t}] ${f.type}: ${f.t}`); L.push('    ' + f.act); }); }
  const s = r.schedule;
  L.push(''); L.push('Схема приёма:');
  ['morning', 'evening', 'any'].forEach(k => { if (s.slots[k].length) L.push(`  ${SLOT_N[k]}: ${s.slots[k].map(nm).join(', ')}`); });
  if (s.food.empty.length) L.push('  Натощак: ' + s.food.empty.map(nm).join(', '));
  if (s.food.food.length) L.push('  Во время еды: ' + s.food.food.map(nm).join(', '));
  s.separate.forEach(([a, b]) => L.push(`  Разнести ≥ 2 ч: ${nm(a)} и ${nm(b)}`));
  if (r.groups && r.groups.length > 1) { L.push('  Предлагается ' + r.groups.length + ' приёма/формы: ' + r.groups.map((g, i) => `${i + 1}) ${g.map(nm).join(', ')}`).join('; ')); }
  L.push(''); L.push('Совместимость в лекарственной форме (химия, технология) проверяется провизором-технологом.');
  return L.join('\n');
}
