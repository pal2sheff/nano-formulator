/* ===== Врачебная версия: совместимость с формами доставки =====
 * Для каждой формы прогоняется технологический анализ (движок версии технолога),
 * врачу показывается только итог: Предпочтительно / Можно / С ограничениями / Нельзя и причина простыми словами. */
'use strict';

const DOC_FORMS = ['caps', 'powder', 'drops', 'hydro', 'oildr', 'slspray', 'troche', 'gummy', 'nasal', 'cream', 'td', 'gel', 'oint', 'supp', 'vag'];
const GUMMY = { n: 'Мармелад (gummies)', bases: { pectin: { n: 'пектиновая основа', acid: true }, gelatin: { n: 'желатиновая основа', acid: false } }, mass: 3 };
const formName = f => f === 'gummy' ? GUMMY.n : FORMS[f].n;
const RATING = {
  best: { k: 'ok', t: 'Предпочтительно', o: 0 },
  ok: { k: 'minor', t: 'Можно', o: 1 },
  limit: { k: 'mod', t: 'С ограничениями', o: 2 },
  no: { k: 'crit', t: 'Нельзя', o: 3 }
};

// рекомендуемая форма в аптеке → формы
const BF_MAP = [
  [/только капсулы/, ['caps'], true],
  [/капсул|таблет/, ['caps']],
  [/напит|порош/, ['powder']],
  [/сублингв/, ['slspray', 'troche', 'drops']],
  [/жидк|сироп/, ['drops']],
  [/трансдерм/, ['td']],
  [/крем/, ['cream']],
  [/гель/, ['gel']],
  [/любые/, ['caps', 'powder', 'drops', 'slspray', 'troche', 'gummy']]
];
function bfForms(m) {
  const bf = (m.pharm && m.pharm.bf) || ''; const out = new Set(); let only = false;
  BF_MAP.forEach(([re, fs, o]) => { if (re.test(bf)) { fs.forEach(f => out.add(f)); if (o) only = true; } });
  return { set: out, only };
}

// короткое имя: без пояснений в скобках
const sn = id => (BY[id] ? BY[id].ru : id).replace(/\s*\([^)]*\)/g, '').replace(/\s*\/.*$/, '').trim();

/* ---------- Путь введения: для каких веществ имеют смысл непероральные формы ---------- */
const ROUTE_OF = { caps: 'oral', powder: 'oral', drops: 'oral', hydro: 'oral', oildr: 'oral', slspray: 'oral', troche: 'oral', gummy: 'oral', nasal: 'nasal', cream: 'topical', gel: 'topical', oint: 'topical', td: 'td', supp: 'rectal', vag: 'vaginal' };
const ROUTE_N = { nasal: 'интраназально', topical: 'наружно', td: 'трансдермально', rectal: 'ректально', vaginal: 'вагинально' };
const isHormone = m => ['hormone', 'androgen', 'estrogen', 'progestogen'].some(t => m.T.has(t));
const idset = s => new Set(s.split(' '));
const ROUTE_OK = {
  oral: () => true,
  nasal: (m, S = idset('mecbl cncbl nad nadh gsh gsh_lipo hyaluronate xylitol')) => m.kind === 'peptide' || S.has(m.id),
  topical: (m, S = idset('calendula aloe chamomile horsechest plantain bpc157 sflecithin nag retinol vitc vitc_lipo nam vite coq10 resv ferulic egcg ala hyaluronate pea curcumin curc_mic boswellia glycyrrhizin astax gsh gsh_lipo nad carnosine ergo sod catalase niacin arg cit pantoth zngluc quercetin chondroitin glucosamine bromelain')) => isHormone(m) || S.has(m.id),
  td: (m, S = idset('melatonin pea mecbl cncbl dhea preg')) => isHormone(m) || S.has(m.id),
  rectal: (m, S = idset('prog gsh gsh_lipo curcumin curc_mic curc_lipo butyrate sily_lipo')) => S.has(m.id),
  vaginal: (m, S = idset('e2 e3 prog dhea hyaluronate vite calendula aloe')) => S.has(m.id)
};

// причина простыми словами по правилу находки
function reasonOf(f) {
  const A = f.ids && f.ids[0] ? sn(f.ids[0]) : '', B = f.ids && f.ids[1] ? sn(f.ids[1]) : '';
  const r = f.rule || '';
  if (r === 'ph_window') return `${A} разрушается в среде этой формы`;
  if (r === 'ph_overlap') return 'компонентам нужна разная кислотность среды';
  if (r === 'acidlabile_acid') return `${A} разрушается в кислой среде (из-за: ${B})`;
  if (r === 'baselabile_base') return `${A} разрушается в щелочной среде (из-за: ${B})`;
  if (r === 'redoxmetal_reducing' || r === 'cu_thiol' || r === 'oxidant_reducing' || r === 'pufa_metal') return `${A} окисляет ${B}`;
  if (r === 'peroxide_oxprone') return `${B} окисляется основой`;
  if (r === 'maillard' || r === 'dha_browning') return `${A} и ${B} реагируют между собой (потемнение)`;
  if (r === 'vitc_b12') return `витамин C разрушает ${B}`;
  if (r === 'protease_protein') return `${A} расщепляет ${B}`;
  if (r === 'protprecip' || r === 'alkprecip' || r === 'cation_anionpoly' || r === 'fe_catechol' || r === 'ca_phosphate') return `${A} и ${B} образуют осадок`;
  if (r === 'sulfite_thiamine' || r === 'tannin_thiamine') return `${A} разрушает ${B}`;
  if (r === 'effervescent_acid') return 'газообразование в упаковке';
  if (r === 'deliq_pair' || r === 'gelatin_hygro') return 'смесь отсыревает и слипается';
  if (r === 'lowmp_eutectic') return 'смесь становится липкой';
  if (/^(unit_load|liq_load|caps_load|gummy_load)$/.test(r)) return f.short || 'слишком большой объём веществ для этой формы';
  if (r === 'caps_liq') return 'много жидких компонентов';
  if (r === 'osm' || r === 'nasal_ph') return 'раздражает слизистую носа';
  if (r === 'sl_ph') return 'раздражает слизистую рта';
  if (r === 'skin_ph') return 'раздражает кожу';
  if (r === 'carbomer_ph' || r === 'polyval_carbomer') return 'гелевая основа разжижается';
  if (r === 'oil_choice') return 'большинство веществ не растворяется в масле';
  if (r === 'gummy_acid') return `${A} разрушается в кислой мармеладной основе`;
  if (r === 'gummy_maillard') return `${A} темнеет с сахарным сиропом при варке`;
  if (r.startsWith('form_')) {
    const t = r.slice(5);
    if (t === 'Фаза') return /гелеобраз/.test(f.t) ? `${A} превращает жидкость в гель` : /этанол/.test(f.t) ? `${A} выпадает в осадок в спирте` : /масл/.test(f.t) && /водной/.test(f.t) ? `${A} не смешивается с водой` : /сухой/.test(f.t) ? `${A} — жидкость в сухой форме` : /масле/.test(f.t) ? `${A} не растворяется в масле` : `${A} не растворяется — взвесь`;
    if (t === 'Нагрев') return `${A} разрушается при нагреве основы`;
    if (t === 'Жизнеспособность') return `${A} погибает в этой форме`;
    if (t === 'Активность') return `${A} теряет активность в растворе`;
    if (t === 'Всасывание') return /проглатыв/.test(f.t) ? `${A} разрушается при проглатывании` : `${A} плохо всасывается через слизистую`;
    if (t === 'Проницаемость кожи') return `${A} плохо проникает через кожу`;
    if (t === 'Вкус') return `неприятный вкус: ${A}`;
    if (t === 'Влага') return `${A} впитывает влагу`;
    if (t === 'Окисление') return `${A} окисляется при хранении`;
    if (t === 'Гидролиз') return `${A} нестабилен в воде`;
    if (t === 'Свет') return `${A} чувствителен к свету`;
    if (t === 'Основа') return `${A} несовместим с основой`;
    if (t === 'Консервант') return 'консервант не работает';
    if (t === 'Единицы') return `проверьте дозу ${A}`;
  }
  return (f.type || '') + (A ? ': ' + A : '');
}

// находки, относящиеся к форме (без фармакологии состава — она в отдельных блоках)
// упаковка и хранение (свет, умеренная влага) — не довод против формы
function formFindings(res) {
  return res.findings.filter(f => f.cat !== 'syn' && !f.group && !(f.rule || '').startsWith('single_') && !(f.cat === 'pharm' && !f.item) && !/^g_/.test(f.rule || '')
      && f.rule !== 'form_Свет' && !(f.rule === 'form_Влага' && f.sev < 3) && f.rule !== 'form_Единицы')
    .map(f => (f.rule === 'form_Всасывание' && /проглатыв/.test(f.t)) ? Object.assign({}, f, { sev: 3 }) : f);
}

function itemsFor(ids, dose) {
  return ids.map(id => {
    const d = dose && dose[id];
    if (d && +d.amt > 0) return { id, amt: +d.amt, unit: d.unit || 'мг' };
    const a = defaultAmount(BY[id]); return { id, amt: a.amt, unit: a.unit, typical: true };
  });
}

// мармелад: анализ через основу троше (нагрев, вкус, сладкая основа) + свои проверки
function analyzeGummy(items, base) {
  const res = analyze({ form: 'troche', P: { base: 'gelatin', mass: GUMMY.mass }, items });
  const B = GUMMY.bases[base];
  res.findings = res.findings.filter(f => f.rule !== 'unit_load').map(f => Object.assign({}, f, { t: String(f.t).replace(/троше/g, 'мармелада'), mech: String(f.mech).replace(/троше/g, 'мармелада') }));
  const act = res.rows.filter(r => r.m.kind !== 'excipient');
  const mg = act.reduce((a, r) => a + r.mg, 0), load = mg / (GUMMY.mass * 1000) * 100;
  const sev = load > 50 ? 4 : load > 30 ? 3 : load > 15 ? 2 : 0;
  if (sev) res.findings.push({ sev, cat: 'form', rule: 'gummy_load', ids: [], t: `Загрузка ${fmt(load, 0)}% массы мармеладки`, short: 'слишком много веществ для мармеладки', mech: 'Мармелад выдерживает примерно до 15% активных веществ; выше — не застывает, вкус резко ухудшается.', act: 'Разделить дозу на несколько мармеладок или выбрать другую форму.' });
  if (B.acid) act.forEach(r => { if (r.m.ph && r.m.ph[0] > 4 && !(r.m.ph[0] <= 1 && r.m.ph[1] >= 13) || r.m.T.has('acidlabile')) res.findings.push({ sev: r.m.T.has('acidlabile') ? 4 : 3, cat: 'stab', rule: 'gummy_acid', ids: [r.id], item: r.id, t: `${r.m.ru}: кислая основа`, mech: 'Пектиновый мармелад застывает только в кислой среде (pH ≈ 3–3,5).', act: 'Желатиновая основа без кислоты или другая форма.' }); });
  act.forEach(r => { if ((r.m.T.has('amine1') || r.m.kind === 'peptide') && r.m.kind !== 'mineral') res.findings.push({ sev: 2, cat: 'chem', rule: 'gummy_maillard', ids: [r.id], item: r.id, t: `${r.m.ru}: реакция с сахарным сиропом`, mech: 'Аминокислоты при варке с глюкозным сиропом темнеют (реакция Майяра).', act: 'Вводить при остывании основы, сахарозаменитель вместо сиропа.' }); });
  res.summary.load = load; res.gummyBase = base;
  return res;
}

function scoreF(fs) { return fs.reduce((a, f) => a + ({ 4: 1000, 3: 60, 2: 8, 1: 1 }[f.sev] || 0), 0); }

// оценка всех форм для набора веществ
function formsFor(ids, dose) {
  if (!ids.length) return null;
  const items = itemsFor(ids, dose);
  const ms = ids.map(id => BY[id]);
  const rows = DOC_FORMS.map(f => {
    let res, note = '';
    if (f === 'gummy') {
      const a = analyzeGummy(items, 'pectin'), b = analyzeGummy(items, 'gelatin');
      res = scoreF(formFindings(a)) <= scoreF(formFindings(b)) ? a : b;
      note = GUMMY.bases[res.gummyBase].n;
    } else res = analyze({ form: f, P: {}, items });
    const route = ROUTE_OF[f];
    const fit = ms.filter(m => ROUTE_OK[route](m) || (m.base && ROUTE_OK[route](BY[m.base])));
    if (!fit.length || (route !== 'oral' && fit.length < ms.length)) return { f, n: formName(f), route, rating: 'na', score: 1e6, reasons: [], note: '' };
    const fs = formFindings(res).sort((x, y) => y.sev - x.sev);
    let mx = fs.length ? fs[0].sev : 0;
    // рекомендации аптеки по веществам
    let bfHit = 0, onlyCaps = [];
    ms.forEach(m => { const b = bfForms(m); if (b.set.has(f)) bfHit++; if (b.only && f !== 'caps') onlyCaps.push(m.id); });
    let score = scoreF(fs) - bfHit * 3;
    let rating = mx >= 4 ? 'no' : mx >= 3 ? 'limit' : 'ok';
    const reasons = [...new Set(fs.filter(x => x.sev >= Math.max(2, mx - 1)).map(reasonOf))].slice(0, 2);
    if (fit.length < ms.length) { const rest = ms.filter(m => !fit.includes(m)); if (rating !== 'no') rating = 'limit'; reasons.unshift(rest.map(m => sn(m.id)).join(', ') + ' — не применяется ' + ROUTE_N[route]); score += 60; }
    if (onlyCaps.length && rating === 'ok') { rating = 'limit'; reasons.unshift(onlyCaps.map(sn).join(', ') + ' — в аптеке только в капсулах'); score += 60; }
    return { f, n: formName(f), route: f === 'gummy' ? 'oral' : FORMS[f].route, rating, mx, score, reasons, note, bfHit, res };
  });
  // предпочтительные — до 3 лучших среди «Можно» (по сумме находок и рекомендациям аптеки)
  const okRows = rows.filter(r => r.rating === 'ok').sort((a, b) => a.score - b.score);
  if (okRows.length) { const best = okRows[0].score; okRows.filter(r => r.score <= best + 4).slice(0, 3).forEach(r => { r.rating = 'best'; }); }
  rows.forEach(r => { if (r.rating === 'best' && !r.reasons.length) r.reasons = [r.bfHit ? 'рекомендуемая форма в аптеке' : 'противоречий с формой нет']; });
  const na = rows.filter(r => r.rating === 'na').map(r => r.f);
  rows.splice(0, rows.length, ...rows.filter(r => r.rating !== 'na'));
  rows.sort((a, b) => RATING[a.rating].o - RATING[b.rating].o || a.score - b.score);
  // если ничего не подходит целиком — разделение
  let split = null;
  if (!rows.some(r => r.rating === 'best' || r.rating === 'ok') && ids.length > 1) {
    const base = rows.filter(r => r.f !== 'gummy' && r.res).sort((a, b) => a.score - b.score)[0];
    const sp = suggestSplit(base.res);
    if (sp && sp.groups.length > 1) split = sp.groups.map(g => ({ ids: g.ids, form: g.form, rating: g.res ? (g.res.maxSev >= 4 ? 'no' : g.res.maxSev >= 3 ? 'limit' : 'ok') : 'ok' }));
  }
  return { rows, na, split, typical: items.some(i => i.typical) };
}
