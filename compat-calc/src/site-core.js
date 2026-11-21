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
// Справочник аптеки даёт max — технологический максимум позиции в форме, а не клинически безопасную дозу.
// Клиническая граница — верхний допустимый уровень потребления (UL, мг/сут; IOM, Dietary Reference Intakes):
// витамин D 100 мкг (4000 МЕ), витамин A (ретинол) 3000 мкг, витамин E (α-токоферол из добавок) 1000 мг,
// витамин B6 100 мг, ниацин (никотиновая кислота) 35 мг, фолиевая кислота (синтетическая) 1000 мкг.
// Выше UL доза допустима только по показаниям под контролем врача — так она и маркируется.
const UL_MG = { vitd3: 0.1, retinol: 3, vite: 1000, pyridox: 100, niacin: 35, folic: 1 };
function ulIn(id, u) {
  const v = UL_MG[id]; if (v == null) return null;
  if (u === 'мг') return v;
  if (u === 'мкг') return v * 1000;
  if (u === 'IU' && typeof IU !== 'undefined' && IU[id]) return v / IU[id];
  return null;
}
function siteDose(n, code) {
  const d = SITE.mols[n] && SITE.mols[n].d[code]; if (!d) return null;
  const r = { sub: d[0], prof: d[1], ther: d[2], max: d[3], u: d[4] };
  const ul = ulIn(SITE.mols[n].id, d[4]); if (ul != null && ul < r.max) r.ul = +ul.toPrecision(4);
  return r;
}
// доза по умолчанию при добавлении: профилактическая из справочника, но не выше UL
function defDose(d) { return d ? (d.ul != null ? Math.min(d.prof, d.ul) : d.prof) : 0; }
const ZONES = { below: 'ниже субклинической', sub: 'субклиническая', prof: 'профилактическая', ther: 'терапевтическая', ul: 'выше верхнего допустимого уровня (UL) — только по показаниям', over: 'выше максимума аптеки' };
// рецептурные гормоны и препараты: «профилактическая/терапевтическая» неприменимо — уровни дозы относительно диапазона аптеки
const ZONES_RX = { below: 'ниже диапазона аптеки', sub: 'низкая', prof: 'средняя', ther: 'высокая' };
function zoneName(z, n) {
  if (!z) return 'доза не указана';
  const m = BY[sid(n)];
  return (m && (m.T.has('rx') || m.T.has('hormone')) && ZONES_RX[z]) || ZONES[z];
}
function zoneOf(amt, d) {
  if (!d || !(amt > 0)) return null;
  if (amt > d.max) return 'over';
  if (d.ul != null && amt > d.ul) return 'ul';
  // границы зон справочника, превышающие UL, ограничиваются UL (иначе доза на уровне UL оказывается «субклинической»)
  const p = d.ul != null ? Math.min(d.prof, d.ul) : d.prof, t = d.ul != null ? Math.min(d.ther, d.ul) : d.ther;
  if (amt < d.sub * 0.5) return 'below';
  if (amt < (d.sub + p) / 2) return 'sub';
  if (amt >= (p + t) / 2 && !(d.ul != null && t === p)) return 'ther'; // при t = p из-за UL терапевтической зоны ниже UL нет
  return 'prof';
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

/* ---------- Состав: одно вещество — одна позиция; восстановление сохранённого состава ---------- */
// позиция состава с тем же действующим веществом (одинаковый id базы), например «PQQ» и «Витамин B14»
function sameSubstance(items, n) { const id = sid(n); return id ? items.find(it => it.n !== n && sid(it.n) === id) : null; }
// проверка состава из localStorage: известные названия, числовая неотрицательная доза, без повторов одного вещества
function sanitizeItems(items, code) {
  if (!Array.isArray(items)) return [];
  const out = [];
  items.forEach(it => {
    if (!it || typeof it.n !== 'string' || !SITE.mols[it.n] || sameSubstance(out, it.n) || out.some(o => o.n === it.n)) return;
    let amt = +it.amt; const d = siteDose(it.n, code);
    if (!isFinite(amt) || amt < 0) amt = d ? defDose(d) : 0;
    out.push({ n: it.n, amt, u: typeof it.u === 'string' ? it.u : (d ? d.u : undefined) });
  });
  return out;
}
// уровень дозы в другой форме: та же позиция в диапазоне аптеки (0 → суб → проф → тер → макс), кусочно-линейно
function equivDose(amt, a, b) {
  const A = [0, a.sub, a.prof, a.ther, a.max], B = [0, b.sub, b.prof, b.ther, b.max];
  if (!(amt > 0)) return 0;
  if (amt >= a.max) return +(b.max * amt / a.max).toPrecision(4);
  for (let i = 1; i < A.length; i++) if (amt <= A[i]) { const t = A[i] > A[i - 1] ? (amt - A[i - 1]) / (A[i] - A[i - 1]) : 1; return +(B[i - 1] + t * (B[i] - B[i - 1])).toPrecision(4); }
  return b.max;
}
// смена формы: назначенная доза не меняется, если единицы те же; при других единицах (мг → %) — тот же уровень дозы
function keepDose(it, code, fromCode) {
  const d = siteDose(it.n, code); if (!d) return;
  if (it.u && it.u === d.u && +it.amt >= 0) return;
  const a = fromCode && siteDose(it.n, fromCode);
  it.amt = a && it.u === a.u ? equivDose(+it.amt, a, d) : defDose(d); it.u = d.u;
}

/* ---------- Отметка пары молекул: 0 нет, 1 синергия, 2 осторожно, 3 конфликт ---------- */
// opt.skip — правила, которые не учитывать; opt.syn(A, B) — синергии пары (список {type})
const PAIR_CACHE = new Map();
function sitePairStatus(na, nb, code, opt = {}) {
  const ck = code + '|' + (na < nb ? na + '|' + nb : nb + '|' + na);
  if (PAIR_CACHE.has(ck)) return PAIR_CACHE.get(ck);
  const A = BY[sid(na)], B = BY[sid(nb)]; const why = []; let lvl = 0; if (!A || !B) return { lvl: 0, why };
  const bump = (l, t) => { if (l > lvl) lvl = l; why.push({ l, t }); };
  if (A.id === B.id) { const r = { lvl: 2, why: [{ l: 2, t: 'то же вещество — уже в составе' }] }; PAIR_CACHE.set(ck, r); return r; }
  if ((A.base || A.id) === (B.base || B.id)) bump(2, 'одно действующее вещество — дозы суммируются');
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
    if (syn.length && lvl < 2) { lvl = Math.max(lvl, 1); syn.forEach(f => why.push({ l: 1, t: (f.add ? 'дополнение эффектов: ' : 'синергия: ') + f.type.toLowerCase() })); }
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

/* ---------- Карточка «Данные аптеки Nano Identica» (блок ni записи) — общая для обеих версий ---------- */
const NI_SOLV_RU = { water: 'вода', ethanol: 'этанол', pg: 'пропиленгликоль', glycerin: 'глицерин', oil: 'масла', dmso: 'ДМСО', peg: 'ПЭГ', ps80: 'полисорбат', org: 'органические растворители' };
function niRows(m) {
  const ni = m && m.ni; if (!ni) return [];
  const R = [];
  const rng = r => r ? fmt(r[0], 1) + '–' + fmt(r[1], 1) : '';
  if (ni.alias) R.push(['Трактовка аптеки', ni.alias]);
  if (ni.name) R.push(['Название в справочнике', ni.name + (ni.eds > 1 ? ` (редакций: ${ni.eds}, сведены)` : '')]);
  if (ni.inci) R.push(['INCI', ni.inci]);
  if (ni.cas) R.push(['CAS', ni.cas]);
  if (ni.organo) R.push(['Органолептика', [['Цвет', ni.organo.c], ['Вкус', ni.organo.t], ['Запах', ni.organo.s]].filter(a => a[1]).map(a => a[0] + ': ' + a[1]).join(' · ')]);
  if (ni.storage) R.push(['Условия хранения', ni.storage]);
  if (ni.state) R.push(['Физическое состояние', ni.state]);
  if (ni.mw) R.push(['Молярная масса', fmt(ni.mw, 2) + ' г/моль' + (m.mw && Math.abs(ni.mw - m.mw) / m.mw > 0.05 ? ` (в базе ${fmt(m.mw, 2)} — другая форма)` : '')]);
  const more = (t, n) => t && t.replace(/[\d,.\s–-]|°C/g, '').length > n ? t : '';   // текст карточки, если в нём больше, чем число
  if (ni.ph_tx || ni.ph_ni) R.push(['pH стабильности', ni.ph_ni ? [rng(ni.ph_ni) + (m.ph ? ` (литература: ${rng(m.ph)})` : ''), more(ni.ph_tx, 2)].filter(Boolean).join('. ') : ni.ph_tx]);
  if (ni.heat_tx || ni.heat_ni) R.push(['Термолабильность', ni.heat_ni ? [`не выше ${ni.heat_ni} °C`, more(ni.heat_tx, 14)].filter(Boolean).join('. ') : ni.heat_tx]);
  if (ni.solv_tx) R.push(['Оптимальные растворители', ni.solv_tx]);
  if (ni.insol_tx) R.push(['Нерастворим / разрушается', ni.insol_tx]);
  if (ni.conc_max) R.push(['Предельная концентрация', (ni.conc_max.v ? `≈ ${fmt(ni.conc_max.v, 1)} мг/мл (${NI_SOLV_RU[ni.conc_max.solv] || ni.conc_max.solv}). ` : '') + ni.conc_max.tx]);
  if (ni.pa_tx) R.push(['Консерванты и антиоксиданты', ni.pa_tx]);
  if (ni.incompat_ni) R.push(['Ограничения / несовместимости', ni.incompat_ni]);
  return R;
}
function niCardHTML(m, opt = {}) {
  const R = niRows(m); if (!R.length) return '';
  const body = `<div class="nibox">${R.map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v)}</div>`).join('')}</div>
    <div class="nisrc">Источник: технологические карточки аптеки Nano Identica. Эти значения используются при проверке рецептуры вместе с литературными; у каждой проблемы указан источник.</div>`;
  if (opt.collapsed) return `<details class="card nicard"><summary><h2>Данные аптеки Nano Identica</h2></summary>${body}</details>`;
  return `<div class="card nicard"><div class="card-h"><h2>Данные аптеки Nano Identica</h2><span class="sub">технологическая карточка</span></div>${body}</div>`;
}
function srcTag(f) {
  const s = f && f.src; if (!s || !s.length) return '';
  return s.map(k => `<span class="srctag ${k}">${k === 'ni' ? 'данные аптеки' : 'литература'}</span>`).join('');
}
