/* ===== Конструктор врачебной версии: отметки в списке, сравнение форм (общая часть — compat-calc/src/site-core.js) ===== */
'use strict';
function analyzeSiteForm(items, code) {
  const ei = engineItems(items, code);
  if (!ei.length) return null;
  if (engineForm(code) === 'gummy') {
    const a = analyzeGummy(ei, 'pectin'), b = analyzeGummy(ei, 'gelatin');
    return scoreF(formFindings(a)) <= scoreF(formFindings(b)) ? a : b;
  }
  return analyze({ form: engineFor(code).form, P: engineP(code, ei, typeof S !== 'undefined' && S.nasalV && engineForm(code) === 'nasal' ? { vdose: S.nasalV } : null), items: ei });
}

/* ---------- Отметки в списке молекул: синергия / осторожно / конфликт ---------- */
function pairStatus(na, nb, code) { return sitePairStatus(na, nb, code, { skip: DOC_SKIP_RULES, syn: synBetween }); }
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

/* ---------- Сравнение форм сайта для состава ---------- */
// Дозы: в выбранной форме — назначенные; в других формах назначенная доза сохраняется, если единицы те же
// (мг → мг), иначе берётся доза по умолчанию из справочника (не выше UL) и это отмечается.
// Нет позиции в каталоге аптеки для формы — это отсутствие данных, а не противопоказание: такие формы идут в na с пояснением.
// Ранжирование: технологические находки + рекомендация аптеки по форме (поле «рекомендуемая форма в аптеке»).
function siteFormsFor(items, curCode) {
  if (!items.length) return null;
  const na = [], naWhy = {};
  const rows = [];
  SITE.forms.forEach(f => {
    const miss = items.filter(it => !siteDose(it.n, f.code));
    if (miss.length) { na.push(f.code); naWhy[f.code] = miss.length === items.length ? 'нет в каталоге' : 'нет в каталоге: ' + miss.map(it => it.n).join(', '); return; }
    // в других формах — тот же уровень назначенной дозы (позиция в диапазоне аптеки), а не доза справочника
    const typical = f.code !== curCode, over = [];
    const its = f.code === curCode ? items : items.map(it => {
      const a = siteDose(it.n, curCode), d = siteDose(it.n, f.code);
      return { n: it.n, amt: a ? equivDose(+it.amt, a, d) : defDose(d) };
    });
    if (f.code === curCode) items.forEach(it => { const d = siteDose(it.n, f.code); if (d && +it.amt > d.max) over.push(it.n); });
    const res = analyzeSiteForm(its, f.code);
    const fs = formFindings(res).sort((a, b) => b.sev - a.sev);
    const mx = fs.length ? fs[0].sev : 0;
    let rating = mx >= 4 ? 'no' : mx >= 3 ? 'limit' : 'ok';
    const reasons = [...new Set(fs.filter(x => x.sev >= Math.max(2, mx - 1)).map(reasonOf))].slice(0, 2);
    let score = scoreF(fs);
    if (over.length) { if (rating === 'ok') rating = 'limit'; reasons.unshift(over.join(', ') + ' — назначенная доза выше максимума аптеки'); score += 60; }
    // рекомендация аптеки по форме вещества
    const ef = engineForm(f.code); let bfHit = 0;
    items.forEach(it => { const m = BY[sid(it.n)]; if (m && bfForms(m).set.has(ef)) bfHit++; });
    score -= bfHit * 3;
    // ограничения пути введения, записанные в описании вещества (например, трансдермальный прогестерон и эндометрий)
    if (ef === 'td') items.forEach(it => { const m = BY[sid(it.n)]; const w = m && String(m.clin || '').split(/(?<=\.)\s+/).find(t => /трансдерм/i.test(t) && /не обеспечива|не заменя|не эквивалент/i.test(t)); if (w) { reasons.unshift(w.replace(/\.$/, '')); score += 8; } });
    rows.push({ f: f.code, n: f.n, rating, score, reasons: reasons.slice(0, 3), bfHit, typical, note: f.code === curCode ? 'выбрана' : '' });
  });
  const ok = rows.filter(r => r.rating === 'ok').sort((a, b) => a.score - b.score);
  if (ok.length) { const b = ok[0].score; ok.filter(r => r.score <= b + 4).slice(0, 3).forEach(r => { r.rating = 'best'; if (!r.reasons.length) r.reasons = [r.bfHit ? 'рекомендуемая форма в аптеке' : 'противоречий с формой нет']; }); }
  const list = rows.sort((a, b) => RATING[a.rating].o - RATING[b.rating].o || a.score - b.score || b.bfHit - a.bfHit);
  return { rows: list, na, naWhy, split: null, typical: rows.some(r => r.typical) };
}

function siteSearch(q, code) { return siteSearchCore(q, code, norm, tokens); }

/* ---------- Итоговый вердикт: фармакология + пациент + технология выбранной формы ----------
 * Используется и на экране, и в копируемом заключении, чтобы они не расходились. */
const V_ORD = { ok: 0, mod: 1, major: 2, crit: 3 };
function finalVerdict(r, ffs, incl, FN) {
  if (!r || !r.verdict) return null;
  let v = Object.assign({}, r.verdict);
  const fmax = Math.max(0, ...(ffs || []).map(f => f.sev), ...(incl || []).map(x => x.l === 'high' ? 4 : 2));
  const why = [...new Set((ffs || []).filter(f => f.sev >= 3).map(reasonOf))].slice(0, 2).join('; ');
  const tab = (incl || []).filter(x => x.l === 'high').map(x => x.ids.map(nm).join(' + ')).join('; ');
  const fd = [why, tab && 'по таблице несовместимостей аптеки: ' + tab].filter(Boolean).join('; ');
  if (fmax >= 4 && v.k !== 'crit') v = { k: 'crit', t: 'Несовместимо в форме «' + FN + '»', d: 'Технологическая несовместимость в выбранной форме' + (fd ? ': ' + fd : '') + '. Выберите другую форму или разделите состав.' };
  else if (fmax >= 4) v.d += ' Кроме того, технологическая несовместимость в форме «' + FN + '»' + (fd ? ': ' + fd : '') + '.';
  else if (fmax === 3 && V_ORD[v.k] < V_ORD.major) v = { k: 'major', t: 'Проблемы в форме «' + FN + '»', d: 'Серьёзные технологические ограничения в выбранной форме' + (fd ? ': ' + fd : '') + '.' };
  // обязательные предупреждения без отмеченного состояния (например, Г6ФД для метиленового синего)
  const req = (r.notes || []).filter(n => n.req);
  if (req.length && v.k === 'ok') v = { k: 'mod', t: 'Допустимо с оговорками', d: 'Требуется уточнение: ' + req.map(n => nm(n.id) + ' — ' + n.t).join('; ') };
  return v;
}
