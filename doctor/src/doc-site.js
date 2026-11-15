/* ===== Конструктор как на сайте nano-identica.com =====
 * SITE — справочник конструктора (doctor/data/site_catalog.json, подставляется при сборке):
 * формы, дерево «вид терапии → категория → молекулы», дозы с зонами по формам, таблица несовместимостей. */
'use strict';
const SITE = /*SITE*/null;
const SFORM = Object.fromEntries(SITE.forms.map(f => [f.code, f]));
const SITE_IDS = {}; // id базы → названия на сайте
Object.entries(SITE.mols).forEach(([n, v]) => { (SITE_IDS[v.id] = SITE_IDS[v.id] || []).push(n); });
const SITE_PATH = {}; // название → [вид терапии, категория]
SITE.tree.forEach(t => t.cats.forEach(c => c.mols.forEach(n => { (SITE_PATH[n] = SITE_PATH[n] || []).push([t.n, c.n]); })));
const SITE_INC = new Map();
['high', 'medium'].forEach(l => SITE.incompat[l].forEach(([a, b]) => SITE_INC.set(a < b ? a + '|' + b : b + '|' + a, l)));
const siteInc = (a, b) => SITE_INC.get(a < b ? a + '|' + b : b + '|' + a);
const sid = n => SITE.mols[n] && SITE.mols[n].id;

/* ---------- Дозы ---------- */
const UNIT_ENGINE = { 'мг': 'мг', 'мкг': 'мкг', 'IU': 'МЕ', '%': '%' };
const UNIT_N = { 'IU': 'МЕ' };
function siteDose(n, code) { const d = SITE.mols[n] && SITE.mols[n].d[code]; return d ? { sub: d[0], prof: d[1], ther: d[2], max: d[3], u: d[4] } : null; }
const ZONES = { below: 'ниже субклинической', sub: 'субклиническая', prof: 'профилактическая', ther: 'терапевтическая', over: 'выше максимума' };
function zoneOf(amt, d) {
  if (!d || !(amt > 0)) return null;
  if (amt > d.max) return 'over';
  if (amt < d.sub * 0.5) return 'below';
  if (amt < (d.sub + d.prof) / 2) return 'sub';
  if (amt < (d.prof + d.ther) / 2) return 'prof';
  return 'ther';
}
function engineForm(code) { return SFORM[code].engine; }
// позиции состава → вещества движка (дозы в мг/мкг/МЕ/%; ферментные единицы — условное количество)
function engineItems(items, code) {
  return items.filter(it => siteDose(it.n, code)).map(it => {
    const d = siteDose(it.n, code), u = UNIT_ENGINE[d.u];
    if (!u) { const a = defaultAmount(BY[sid(it.n)]); return { id: sid(it.n), amt: a.amt, unit: a.unit, n: it.n }; }
    return { id: sid(it.n), amt: +it.amt || 0, unit: u, n: it.n };
  });
}
function engineP(code, eitems) {
  const f = SFORM[code], P = Object.assign({}, FORM_DEFAULTS[f.engine] || {}, f.P || {});
  if (f.engine === 'drops') { // объём на приём растёт с суммарной дозой (флакон 30 мл)
    const mg = eitems.reduce((a, it) => a + toMg(it, 'drops', P), 0);
    P.vdose = Math.min(2, Math.max(0.25, Math.ceil(mg / 200 / 0.05) * 0.05));
  }
  if (f.engine === 'nasal' && typeof S !== 'undefined' && S.nasalV) P.vdose = S.nasalV;
  return P;
}
function analyzeSiteForm(items, code) {
  const ei = engineItems(items, code);
  if (!ei.length) return null;
  if (engineForm(code) === 'gummy') {
    const a = analyzeGummy(ei, 'pectin'), b = analyzeGummy(ei, 'gelatin');
    return scoreF(formFindings(a)) <= scoreF(formFindings(b)) ? a : b;
  }
  return analyze({ form: engineForm(code), P: engineP(code, ei), items: ei });
}

/* ---------- Отметки в списке молекул: синергия / осторожно / конфликт ---------- */
const PAIR_CACHE = new Map();
function pairStatus(na, nb, code) {
  const ck = code + '|' + (na < nb ? na + '|' + nb : nb + '|' + na);
  if (PAIR_CACHE.has(ck)) return PAIR_CACHE.get(ck);
  const A = BY[sid(na)], B = BY[sid(nb)]; const why = []; let lvl = 0; if (!A || !B) return { lvl: 0, why }; // 0 нет, 1 синергия, 2 осторожно, 3 конфликт
  const bump = (l, t) => { if (l > lvl) lvl = l; why.push({ l, t }); };
  if (A.id !== B.id) {
    const si = siteInc(A.id, B.id);
    if (si === 'high') bump(3, 'таблица аптеки: несовместимо');
    else if (si === 'medium') bump(2, 'таблица аптеки: с осторожностью');
    const pc = engineForm(code) === 'gummy' ? 'M' : formContext(engineForm(code), Object.assign({}, FORM_DEFAULTS[engineForm(code)] || {}, SFORM[code].P)).pc;
    const x = { pc, pH: null, items: [], form: engineForm(code) };
    for (const [X, Y] of [[A, B], [B, A]]) for (const R of PAIR_RULES) {
      if (R.cat === 'syn' || DOC_SKIP_RULES.has(R.id)) continue;
      if (R.a === R.b && X === B) continue;
      if (!matchSel(X, R.a) || !matchSel(Y, R.b)) continue;
      if (R.not && (R.not(X) || R.not(Y))) continue;
      if (R.when && !R.when(X, Y, x)) continue;
      const s = sevFor(R.sev, R.cat === 'pharm' ? 'D' : pc, X, Y, x);
      if (!(s > 0)) continue;
      const t = (R.cat === 'pharm' ? '' : 'в этой форме: ') + R.type.toLowerCase();
      if (s >= 3) bump(3, t); else if (s === 2) bump(2, t);
    }
    const syn = synBetween(A, B);
    if (syn.length && lvl < 2) { lvl = Math.max(lvl, 1); syn.forEach(f => why.push({ l: 1, t: 'синергия: ' + f.type.toLowerCase() })); }
  }
  const r = { lvl, why };
  PAIR_CACHE.set(ck, r);
  return r;
}
const SOLO_CACHE = new Map();
function soloStatus(n, code) { // проблемы самого вещества в форме
  const ck = code + '|' + n; if (SOLO_CACHE.has(ck)) return SOLO_CACHE.get(ck);
  const d = siteDose(n, code); let r = { lvl: 0, why: [] };
  if (d) {
    const res = analyzeSiteForm([{ n, amt: d.prof }], code);
    const fs = res ? formFindings(res).filter(f => f.sev >= 3) : [];
    if (fs.length) r = { lvl: 2, why: [...new Set(fs.map(reasonOf))].slice(0, 2).map(t => ({ l: 2, t: 'в этой форме: ' + t })) };
  }
  SOLO_CACHE.set(ck, r); return r;
}
function candStatus(n, st) {
  const sel = st.items.map(it => it.n).filter(x => x !== n);
  let lvl = 0; const why = [];
  sel.forEach(o => { const p = pairStatus(n, o, st.form); if (p.lvl) { lvl = Math.max(lvl, p.lvl); p.why.forEach(w => why.push(Object.assign({ with: o }, w))); } });
  if (st.cond.length) contraFor(BY[sid(n)]).forEach(c => { if (st.cond.includes(c.c) && c.sev >= 2 && !(c.c === 'preg' && /недостаточно/.test(c.t))) { const l = c.sev >= 3 ? 3 : 2; lvl = Math.max(lvl, l); why.push({ l, t: (c.sev >= 3 ? 'противопоказано: ' : 'осторожно: ') + COND_N[c.c].toLowerCase() }); } });
  const so = soloStatus(n, st.form); if (so.lvl && lvl < 2) { lvl = Math.max(lvl, so.lvl); } so.why.forEach(w => why.push(w));
  return { lvl, why };
}
const LVL = { 0: null, 1: { k: 'syn', t: 'синергия' }, 2: { k: 'warn', t: 'осторожно' }, 3: { k: 'bad', t: 'конфликт' } };

/* ---------- Сравнение форм сайта для состава ---------- */
function siteFormsFor(items, curCode) {
  if (!items.length) return null;
  const rows = SITE.forms.map(f => {
    const miss = items.filter(it => !siteDose(it.n, f.code));
    const n = f.n;
    if (miss.length === items.length) return { f: f.code, n, rating: 'na', score: 1e6, reasons: [] };
    if (miss.length) return { f: f.code, n, rating: 'no', score: 5e5, reasons: [miss.map(it => it.n).join(', ') + ' — нет в этой форме у аптеки'] };
    const its = f.code === curCode ? items : items.map(it => ({ n: it.n, amt: siteDose(it.n, f.code).prof }));
    const res = analyzeSiteForm(its, f.code);
    const fs = formFindings(res).sort((a, b) => b.sev - a.sev);
    const mx = fs.length ? fs[0].sev : 0;
    const rating = mx >= 4 ? 'no' : mx >= 3 ? 'limit' : 'ok';
    return { f: f.code, n, rating, score: scoreF(fs), reasons: [...new Set(fs.filter(x => x.sev >= Math.max(2, mx - 1)).map(reasonOf))].slice(0, 2), note: f.code === curCode ? 'выбрана' : '' };
  });
  const ok = rows.filter(r => r.rating === 'ok').sort((a, b) => a.score - b.score);
  if (ok.length) { const b = ok[0].score; ok.filter(r => r.score <= b + 4).slice(0, 3).forEach(r => { r.rating = 'best'; if (!r.reasons.length) r.reasons = ['противоречий с формой нет']; }); }
  const na = rows.filter(r => r.rating === 'na').map(r => r.f);
  const list = rows.filter(r => r.rating !== 'na').sort((a, b) => RATING[a.rating].o - RATING[b.rating].o || a.score - b.score);
  return { rows: list, na, split: null, typical: false };
}

/* ---------- Поиск по названиям сайта и синонимам ---------- */
let SITE_Q = null;
function siteSearch(q, code) {
  if (!SITE_Q) SITE_Q = Object.keys(SITE.mols).map(n => { const m = BY[sid(n)]; return { n, q: norm(n + ' ' + m.ru + ' ' + m.en + ' ' + (m.syn || '')) }; });
  q = norm(q).trim(); if (!q) return [];
  const ws = tokens(q);
  return SITE_Q.filter(x => siteDose(x.n, code) && ws.every(w => tokens(x.q).some(t => t.startsWith(w)) || (w.length > 3 && x.q.includes(w))))
    .map(x => x.n).sort((a, b) => (norm(b).startsWith(q) - norm(a).startsWith(q)) || a.localeCompare(b, 'ru')).slice(0, 60);
}
