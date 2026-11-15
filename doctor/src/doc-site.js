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

function siteSearch(q, code) { return siteSearchCore(q, code, norm, tokens); }
