/* ===== Справочник конструктора заказов nano-identica.com — общая часть обеих версий =====
 * SITE (compat-calc/data/site_catalog.json, подставляется при сборке): 9 форм, дерево
 * «вид терапии → категория → молекулы», суточные дозы с зонами по формам, таблица несовместимостей. */
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
// форма движка и параметры для формы сайта; гамми в версии технолога — троше на желатиновой основе 3 г
function engineFor(code) {
  const f = SFORM[code];
  if (f.engine === 'gummy' && typeof analyzeGummy !== 'function') return { form: 'troche', P: { base: 'gelatin', mass: 3 } };
  return { form: f.engine, P: f.P || {} };
}
// позиции состава → вещества движка (дозы в мг/мкг/МЕ/%; ферментные единицы — условное количество)
function engineItems(items, code) {
  return items.filter(it => siteDose(it.n, code)).map(it => {
    const d = siteDose(it.n, code), u = UNIT_ENGINE[d.u];
    if (!u) { const a = defaultAmount(BY[sid(it.n)]); return { id: sid(it.n), amt: a.amt, unit: a.unit, n: it.n }; }
    return { id: sid(it.n), amt: +it.amt || 0, unit: u, n: it.n };
  });
}
function engineP(code, eitems, over) {
  const f = SFORM[code], e = engineFor(code), P = Object.assign({}, FORM_DEFAULTS[e.form] || {}, e.P, over || {});
  if (e.form === 'drops' && !(over && over.vdose)) { // объём на приём растёт с суммарной дозой (флакон 30 мл)
    const mg = eitems.reduce((a, it) => a + toMg(it, 'drops', P), 0);
    P.vdose = Math.min(2, Math.max(0.25, Math.ceil(mg / 200 / 0.05) * 0.05));
  }
    return P;
}

/* ---------- Отметка пары молекул: 0 нет, 1 синергия, 2 осторожно, 3 конфликт ---------- */
// opt.skip — правила, которые не учитывать; opt.syn(A, B) — синергии пары (список {type})
const PAIR_CACHE = new Map();
function sitePairStatus(na, nb, code, opt = {}) {
  const ck = code + '|' + (na < nb ? na + '|' + nb : nb + '|' + na);
  if (PAIR_CACHE.has(ck)) return PAIR_CACHE.get(ck);
  const A = BY[sid(na)], B = BY[sid(nb)]; const why = []; let lvl = 0; if (!A || !B) return { lvl: 0, why };
  const bump = (l, t) => { if (l > lvl) lvl = l; why.push({ l, t }); };
  if (A.id !== B.id) {
    const si = siteInc(A.id, B.id);
    if (si === 'high') bump(3, 'таблица аптеки: несовместимо');
    else if (si === 'medium') bump(2, 'таблица аптеки: с осторожностью');
    const ef = engineFor(code); const pc = engineForm(code) === 'gummy' ? 'M' : formContext(ef.form, Object.assign({}, FORM_DEFAULTS[ef.form] || {}, ef.P)).pc;
    const x = { pc, pH: null, items: [], form: ef.form };
    for (const [X, Y] of [[A, B], [B, A]]) for (const R of PAIR_RULES) {
      if (R.cat === 'syn' || (opt.skip && opt.skip.has(R.id))) continue;
      if (R.a === R.b && X === B) continue;
      if (!matchSel(X, R.a) || !matchSel(Y, R.b)) continue;
      if (R.not && (R.not(X) || R.not(Y))) continue;
      if (R.when && !R.when(X, Y, x)) continue;
      const sv = sevFor(R.sev, R.cat === 'pharm' ? 'D' : pc, X, Y, x);
      if (!(sv > 0)) continue;
      const t = (R.cat === 'pharm' ? '' : 'в этой форме: ') + R.type.toLowerCase();
      if (sv >= 3) bump(3, t); else if (sv === 2) bump(2, t);
    }
    // водные формы: окна pH стабильности не пересекаются
    const wide = m => !m.ph || (m.ph[0] <= 1 && m.ph[1] >= 13) || m.kind === 'excipient';
    if (pc === 'W' && !wide(A) && !wide(B)) {
      const gap = Math.max(A.ph[0] - B.ph[1], B.ph[0] - A.ph[1]);
      if (gap > 0) bump(gap >= 1 ? 3 : 2, `в этой форме: нет общего pH стабильности (${A.ph.join('–')} и ${B.ph.join('–')})`.replace(/\./g, ','));
    }
    const syn = opt.syn ? opt.syn(A, B) : [];
    if (syn.length && lvl < 2) { lvl = Math.max(lvl, 1); syn.forEach(f => why.push({ l: 1, t: 'синергия: ' + f.type.toLowerCase() })); }
  }
  const r = { lvl, why };
  PAIR_CACHE.set(ck, r);
  return r;
}
const LVL = { 0: null, 1: { k: 'syn', t: 'синергия' }, 2: { k: 'warn', t: 'осторожно' }, 3: { k: 'bad', t: 'конфликт' } };
const FORM_ICO = { КП: 'caps', СЛ: 'drops', ТР: 'troche', ГМ: 'troche', НС: 'nasal', ТД: 'td', КК: 'cream', РС: 'supp', ВС: 'supp' };
const ENGINE_TO_SITE = { caps: 'КП', drops: 'СЛ', troche: 'ТР', nasal: 'НС', td: 'ТД', cream: 'КК', supp: 'РС', vag: 'ВС' };

/* ---------- Поиск по названиям сайта и синонимам ---------- */
let SITE_Q = null;
function siteSearchCore(q, code, normF, tokF) {
  if (!SITE_Q) SITE_Q = Object.keys(SITE.mols).map(n => { const m = BY[sid(n)]; return { n, q: normF(n + ' ' + m.ru + ' ' + m.en + ' ' + (m.syn || '')) }; });
  q = normF(q).trim(); if (!q) return [];
  const ws = tokF(q);
  return SITE_Q.filter(x => siteDose(x.n, code) && ws.every(w => tokF(x.q).some(t => t.startsWith(w)) || (w.length > 3 && x.q.includes(w))))
    .map(x => x.n).sort((a, b) => (normF(b).startsWith(q) - normF(a).startsWith(q)) || a.localeCompare(b, 'ru')).slice(0, 60);
}
function siteIncPairs(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const l = siteInc(ids[i], ids[j]); if (l) out.push({ l, ids: [ids[i], ids[j]] }); }
  return out;
}
