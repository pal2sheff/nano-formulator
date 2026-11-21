/* ===== Ядро: данные, физико-химические расчёты ===== */
'use strict';
const DB = JSON.parse(document.getElementById('db').textContent);
const BY = {};
DB.forEach(m => {
  BY[m.id] = m;
  m.T = new Set((m.tags || '').split(/\s+/).filter(Boolean));
  const st = { ox: 0, hy: 0, he: 0, li: 0, mo: 0 };
  (m.st || '').split(/\s+/).forEach(t => { const k = t.slice(0, 2), v = +t.slice(2); if (k in st) st[k] = v; });
  m.S = st;
  m.logP = (m.lp != null) ? m.lp : (m.clogp != null ? m.clogp : null);
  m.SP = (m.sp || []).map(a => ({ pk: a[0], zf: a[1], z0: a[2], n: a[3] }));
  if (m.dose) { const p = String(m.dose).split('-').map(Number); m.dmin = p[0]; m.dmax = p[1] || p[0]; }
  // производные теги
  if (m.logP != null && m.logP >= 4) m.T.add('lipo');
  if (m.p1 != null && m.p1 <= 3.2) m.T.add('acidic');
  if (m.p1 != null && m.p1 >= 9.3) m.T.add('basic');
  if (['Mg', 'Ca', 'Zn', 'Fe', 'Cu', 'Cr'].some(e => m.T.has(e)) && m.kind === 'mineral') m.T.add('polyval');
  if (m.alerts) {
    if (m.alerts.includes('amine1') && !m.T.has('amine1') && m.kind !== 'peptide') m.T.add('amine1');
  }
  if (m.kind === 'peptide') { m.T.add('peptide'); m.T.add('amine1'); }
  m.isBitter = !!(m.taste && /горьк/i.test(m.taste.t || '')) || m.T.has('bitter');
  m.veryBitter = !!(m.taste && /(очень|выраженно|интенсивно) горьк/i.test(m.taste.t || '')) || m.T.has('bitter');
});
const LIST = DB.slice().sort((a, b) => a.ru.localeCompare(b.ru, 'ru'));

const SEV = {
  4: { k: 'crit', t: 'Несовместимо' },
  3: { k: 'major', t: 'Серьёзно' },
  2: { k: 'mod', t: 'Умеренно' },
  1: { k: 'minor', t: 'Учесть' },
  0: { k: 'syn', t: 'Синергия' }
};

/* ---------- Кислотно-основное равновесие ---------- */
function alphas(pk, h) {
  const logs = [0]; let acc = 0;
  for (const p of pk) { acc += -p - Math.log10(h); logs.push(acc); }
  const mx = Math.max(...logs);
  const w = logs.map(l => Math.pow(10, l - mx));
  const S = w.reduce((a, b) => a + b, 0);
  return w.map(x => x / S);
}
function meanCharge(pk, zf, h) {
  if (!pk.length) return zf;
  const a = alphas(pk, h); let n = 0;
  a.forEach((x, j) => n += j * x);
  return zf - n;
}
const CO2 = [{ pk: [6.35, 10.33], zf: 0, z0: 0, n: 1 }];
function solvePH(items) {
  // items: [{c: моль/л, sp: [...]}]; противоионы формы поставки считаются сильными
  const all = items.concat([{ c: 1.3e-5, sp: CO2 }]);
  const f = ph => {
    const h = Math.pow(10, -ph); let s = h - 1e-14 / h;
    for (const it of all) for (const p of it.sp) s += it.c * p.n * (meanCharge(p.pk, p.zf, h) - p.z0);
    return s;
  };
  let lo = -1, hi = 15;
  for (let i = 0; i < 70; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
// доля электронейтральной формы (суммарный заряд 0)
function neutralFrac(m, ph) {
  if (!m.SP.length) return m.T.has('cationic') ? 0.0001 : 1;
  const h = Math.pow(10, -ph);
  // основная (органическая) частица — первая в списке
  const p = m.SP[0];
  const a = alphas(p.pk, h);
  let f = 0; a.forEach((x, j) => { if (Math.abs(p.zf - j) < 0.01) f += x; });
  return Math.max(f, 1e-9);
}
function chargeAt(m, ph) { const p = m.SP[0]; if (!p) return m.T.has('cationic') ? 1 : 0; return meanCharge(p.pk, p.zf, Math.pow(10, -ph)); }
function logD(m, ph) {
  if (m.logP == null) return null;
  const f = neutralFrac(m, ph);
  return Math.max(m.logP + Math.log10(f), m.logP - 4);
}
// растворимость в воде при pH, мг/мл
function solAt(m, ph) {
  if (m.sw == null) return null;
  if (m.s0 != null && m.SP.length) {
    const f = neutralFrac(m, ph);
    return Math.min(m.s0 / f, Math.max(300, m.sw));
  }
  return m.sw;
}
// сорастворители: log-линейная модель (Yalkowsky; σ = M·logP + N, Millard 2002)
const COSOLV = { ethanol: [0.93, 0.40], pg: [0.77, 0.58], glycerin: [0.35, 0.28], peg400: [0.89, 1.07] };
function cosolvFactor(m, fr) {
  let lp = m.logP;
  if (lp == null) lp = (m.kind === 'mineral' || m.T.has('electrolyte')) ? -3 : null;
  if (lp == null) return 1;
  let e = 0;
  for (const k in fr) if (fr[k] > 0 && COSOLV[k]) e += (COSOLV[k][0] * lp + COSOLV[k][1]) * fr[k];
  return Math.pow(10, e);
}
// растворимость в масле (MCT), оценка через GSE: log S_oct = 0.5 − 0.01·(т.пл. − 25), моль/л
function oilSol(m) {
  if (m.oil === 2) return 50;
  let gse = null;
  if (m.mp != null && m.logP != null && m.logP > 1 && m.mw) {
    gse = Math.pow(10, 0.5 - 0.01 * Math.max(0, m.mp - 25)) * m.mw / 10; // мг/мл, поправка MCT ≈ октанол/10
  }
  if (m.oil === 1) return gse != null ? Math.min(Math.max(gse, 0.5), 50) : 2;
  if (gse != null && m.logP >= 2) return Math.min(gse, 20);
  return 0.01;
}
function gseWater(mp, logP) { return 0.5 - 0.01 * Math.max(0, mp - 25) - logP; }
// Potts & Guy (1992): log kp (см/ч) = −2,7 + 0,71·logP − 0,0061·MW
function pottsGuy(m) {
  const mw = m.mw_smi || m.mw;
  if (m.logP == null || !mw) return null;
  const kp = Math.pow(10, -2.7 + 0.71 * m.logP - 0.0061 * mw);
  const sw = solAt(m, 5.5);
  if (sw == null) return { kp };
  const J = kp * sw * 1000; // мкг/см²/ч
  return { kp, J };
}

/* ---------- Единицы ---------- */
// мг на 1 МЕ. Витамин E у аптеки — синтетический DL-α-токоферол: 1 МЕ = 0,91 мг (USP; для природного d-α было бы 0,67 мг)
const IU = { vitd3: 0.000025, vite: 0.91, retinol: 0.0003, oxytocin: 0.00168 };
function toMg(row, form, P) {
  const v = +row.amt; if (!isFinite(v) || v <= 0) return 0;
  switch (row.unit) {
    case 'мг': return v;
    case 'мкг': return v / 1000;
    case 'г': return v * 1000;
    case 'МЕ': return IU[row.id] ? v * IU[row.id] : 0;
    case '%': {
      const F = FORMS[form];
      if (F.liquid) return v / 100 * (P.vdose || 1) * 1000;
      if (F.unitMass) return v / 100 * (P.mass || 1) * 1000;
      return 0;
    }
  }
  return v;
}

/* ---------- Формы ---------- */
const FORMS = {
  caps:   { n: 'Капсулы', fam: 'oral', phase: 'solid', route: 'oral', ico: 'caps' },
  powder: { n: 'Порошок для напитка', fam: 'oral', phase: 'solid', route: 'oral', recon: true, ico: 'powder' },
  drops:  { n: 'Капли водные', fam: 'oral', phase: 'aqueous', liquid: true, route: 'oral_sl', ico: 'drops' },
  hydro:  { n: 'Капли водно-спиртовые', fam: 'oral', phase: 'hydroalc', liquid: true, route: 'oral_sl', ico: 'drops' },
  oildr:  { n: 'Капли масляные', fam: 'oral', phase: 'oil', liquid: true, route: 'oral_sl', ico: 'oil' },
  slspray:{ n: 'Спрей сублингвальный', fam: 'oral', phase: 'aqueous', liquid: true, route: 'sl', ico: 'spray' },
  troche: { n: 'Троше', fam: 'oral', phase: 'melt', unitMass: true, route: 'sl', ico: 'troche' },
  nasal:  { n: 'Назальный спрей', fam: 'nasal', phase: 'aqueous', liquid: true, route: 'nasal', ico: 'nasal' },
  cream:  { n: 'Крем (м/в)', fam: 'topical', phase: 'emulsion', unitMass: true, route: 'topical', aq: 0.7, ico: 'cream' },
  td:     { n: 'Трансдермальный крем (Pentravan)', fam: 'topical', phase: 'emulsion', unitMass: true, route: 'td', aq: 0.6, ico: 'td' },
  gel:    { n: 'Гель', fam: 'topical', phase: 'aqueous', unitMass: true, route: 'topical', aq: 0.95, ico: 'gel' },
  oint:   { n: 'Мазь безводная', fam: 'topical', phase: 'anhydrous', unitMass: true, route: 'topical', ico: 'oint' },
  supp:   { n: 'Свеча ректальная', fam: 'rectal', phase: 'melt', unitMass: true, route: 'rectal', ico: 'supp' },
  vag:    { n: 'Свеча вагинальная', fam: 'rectal', phase: 'melt', unitMass: true, route: 'vaginal', ico: 'supp' }
};
const FORM_DEFAULTS = {
  caps: { shell: 'hpmc', size: 'auto', filler: 'mcc', ndose: 60 },
  powder: { water: 250, ndose: 30 },
  drops: { vdose: 1, vtot: 30, cosolv: 'none', cpct: 0, sl: 1 },
  hydro: { vdose: 1, vtot: 30, eth: 20, sl: 1 },
  oildr: { vdose: 1, vtot: 30, sl: 1 },
  slspray: { vdose: 0.28, vtot: 30, cosolv: 'none', cpct: 0 },
  troche: { mass: 1.0, base: 'peg', ndose: 30 },
  nasal: { vdose: 0.2, vtot: 10 },
  cream: { mass: 1.0, area: 100, mtot: 30 },
  td: { mass: 1.0, area: 100, mtot: 30 },
  gel: { mass: 1.0, area: 100, gelling: 'hec', mtot: 30 },
  oint: { mass: 1.0, area: 100, mtot: 30 },
  supp: { mass: 2.0, base: 'fat', ndose: 12 },
  vag: { mass: 3.0, base: 'fat', ndose: 12 }
};
const CAPS = [['000', 1.37], ['00', 0.95], ['0', 0.68], ['1', 0.50], ['2', 0.37], ['3', 0.30], ['4', 0.21]];
const RHO_ID = { agpc: 0.45, nmn: 0.35, nr: 0.45, coq10: 0.45, mcc: 0.35, lactose: 0.6, rice: 0.55, sio2: 0.06, mgst: 0.2,
  psyllium: 0.35, inulin: 0.45, vitc: 0.75, mgcit: 0.65, cacit: 0.7, glucosamine: 0.6, metformin: 0.55, citmal: 0.55 };
function bulkDensity(m) {
  if (RHO_ID[m.id]) return RHO_ID[m.id];
  if (m.kind === 'mineral') return 0.8;
  if (m.kind === 'extract' || m.kind === 'polymer') return 0.45;
  if (m.kind === 'peptide' || m.kind === 'protein' || m.kind === 'enzyme') return 0.4;
  if (m.T.has('lipo')) return 0.45;
  return 0.55;
}
function trueDensity(m) { if (m.kind === 'mineral') return 2.0; if (m.T.has('lipo')) return 1.05; return 1.35; }

/* ---------- Пептиды: заряд по последовательности ---------- */
const PEP_PK = { nterm: 8.6, cterm: 3.6, K: 10.8, R: 12.5, H: 6.5, D: 3.9, E: 4.1, C: 8.5, Y: 10.1 };
function pepCharge(pep, ph) {
  if (!pep) return null;
  let q = 0;
  const pos = (pk, n) => n * 1 / (1 + Math.pow(10, ph - pk));
  const neg = (pk, n) => -n * 1 / (1 + Math.pow(10, pk - ph));
  if (pep.nterm) q += pos(PEP_PK.nterm, 1);
  if (pep.cterm) q += neg(PEP_PK.cterm, 1);
  for (const r of ['K', 'R', 'H']) if (pep[r]) q += pos(PEP_PK[r], pep[r]);
  for (const r of ['D', 'E', 'C', 'Y']) if (pep[r]) q += neg(PEP_PK[r], pep[r]);
  return q;
}
function pepPI(pep) { let lo = 0, hi = 14; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (pepCharge(pep, m) > 0) lo = m; else hi = m; } return (lo + hi) / 2; }
DB.forEach(m => { if (m.pep && m.pI == null) m.pI = +pepPI(m.pep).toFixed(1); });

/* ---------- Форматирование ---------- */
function fmt(x, d = 2) {
  if (x == null || !isFinite(x)) return '—';
  const a = Math.abs(x);
  let s;
  if (a !== 0 && a < 0.001) s = x.toExponential(1).replace('e', '·10^');
  else if (a < 1) s = x.toFixed(Math.min(4, d + 1));
  else if (a < 100) s = x.toFixed(d);
  else s = Math.round(x).toString();
  s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return s.replace('.', ',');
}
function fmtMg(mg) {
  if (mg >= 1000) return fmt(mg / 1000, 2) + ' г';
  if (mg < 1) return fmt(mg * 1000, 1) + ' мкг';
  return fmt(mg, 1) + ' мг';
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function nm(id) { return BY[id] ? BY[id].ru : id; }
