/* ===== Движок анализа рецептуры ===== */
'use strict';

const SEVW = { 4: 1000, 3: 60, 2: 8, 1: 1, 0: 0 };
const TROCHE_BASES = { peg: { n: 'ПЭГ 1450/3350', id: 'peg_base', heat: 60, pc: 'M' }, gelatin: { n: 'Глицерин-желатиновая', ids: ['gelatin', 'glycerin'], heat: 70, pc: 'M' } };
const SUPP_BASES = { fat: { n: 'Твёрдый жир (Witepsol)', id: 'hardfat', heat: 45, pc: 'L' }, peg: { n: 'ПЭГ 1450/3350', id: 'peg_base', heat: 60, pc: 'M' } };
const COSOLV_ID = { glycerin: 'glycerin', pg: 'pg', peg400: 'peg400', ethanol: 'ethanol' };
const COSOLV_KEY = { glycerin: 'glycerin', pg: 'pg', peg400: 'peg400', ethanol: 'ethanol' };
const COSOLV_RHO = { glycerin: 1.26, pg: 1.04, peg400: 1.13, ethanol: 0.80 };
const LIQUID_IDS = new Set(['mct', 'olive', 'ethanol', 'glycerin', 'pg', 'peg400', 'ps80', 'tocoph', 'dha', 'vite', 'wfi', 'benzylalc']);

function matchSel(m, s) {
  if (s == null) return true;
  if (Array.isArray(s)) return s.some(x => matchSel(m, x));
  if (typeof s === 'function') return !!s(m);
  if (s.startsWith('id:')) return m.id === s.slice(3) || m.base === s.slice(3); // липосомальная/мицеллярная форма наследует правила исходного вещества
  if (s.startsWith('alert:')) return (m.alerts || []).includes(s.slice(6));
  if (s.startsWith('kind:')) return m.kind === s.slice(5);
  return m.T.has(s);
}
function sevFor(spec, pc, A, B, x) {
  if (typeof spec === 'function') spec = spec(A, B, x);
  if (typeof spec === 'number') return spec;
  if (!spec) return 1;
  if (spec[pc] != null) return spec[pc];
  if (pc === 'M') return Math.max(spec.D ?? 0, (spec.W ?? 1) - 1);
  if (pc === 'L') return spec.D ?? 1;
  return 1;
}
function fill(s, A, B) { return String(s || '').replace(/\{A\}/g, A ? A.ru : '').replace(/\{B\}/g, B ? B.ru : ''); }
function isLiquidM(m) { return LIQUID_IDS.has(m.id) || m.T.has('oilbase') || (m.mp != null && m.mp < 20); }
function molW(m) { return m.mw || m.mw_smi || null; }

/* ---------- Контекст формы ---------- */
function formContext(form, P) {
  const F = FORMS[form];
  const x = { form, F, P, phase: F.phase, heat: 0, implicit: [], baseName: '' };
  switch (form) {
    case 'caps': case 'powder': x.pc = 'D'; break;
    case 'oildr': case 'oint': x.pc = 'L'; break;
    case 'troche': { const b = TROCHE_BASES[P.base] || TROCHE_BASES.peg; x.pc = b.pc; x.heat = b.heat; x.baseName = b.n; (b.ids || [b.id]).forEach(id => x.implicit.push(id)); break; }
    case 'supp': case 'vag': { const b = SUPP_BASES[P.base] || SUPP_BASES.fat; x.pc = b.pc; x.heat = b.heat; x.baseName = b.n; x.implicit.push(b.id); break; }
    default: x.pc = 'W';
  }
  if (form === 'caps') { x.implicit.push(P.filler || 'mcc'); if (P.shell === 'gelatin') x.implicit.push('gelatin'); }
  if (form === 'oildr') x.implicit.push(P.oil || 'mct');
  if (form === 'hydro') x.implicit.push('ethanol');
  if ((form === 'drops' || form === 'slspray') && P.cosolv && P.cosolv !== 'none' && +P.cpct > 0) x.implicit.push(COSOLV_ID[P.cosolv]);
  if (form === 'gel') x.implicit.push(P.gelling || 'hec');
  if (form === 'td') x.implicit.push('plo');
  // объём водной фазы на приём, мл
  if (F.liquid) x.V = +P.vdose || 1;
  else if (form === 'powder') x.V = +P.water || 250;
  else if (F.aq) x.V = (+P.mass || 1) * F.aq;
  x.tasteMatters = F.route === 'sl' || form === 'troche' || form === 'powder' || (F.route === 'oral_sl' && +P.sl === 1);
  return x;
}

/* ---------- pH ---------- */
function phItems(rows, V, skipId) {
  return rows.filter(r => r.m.SP.length && r.mg > 0 && r.id !== skipId).map(r => ({ r, c: r.mg / molW(r.m) / V, sp: r.m.SP }));
}
function calcPH(rows, V, skipId) {
  const its = phItems(rows, V, skipId);
  if (!its.length) return null;
  let ph = solvePH(its);
  // учёт нерастворённой части: в раствор переходит не больше растворимости
  for (let k = 0; k < 3; k++) {
    its.forEach(it => {
      const S = solAt(it.r.m, ph);
      const cmax = S != null ? S / molW(it.r.m) : Infinity;
      it.c = Math.min(it.r.mg / molW(it.r.m) / V, cmax * (it.r.cf || 1));
    });
    ph = solvePH(its);
  }
  return ph;
}

/* ---------- Капсулы ---------- */
function capsCalc(rows, P) {
  let vol = 0, mass = 0, liq = 0;
  rows.forEach(r => { if (r.mg > 0) { vol += r.mg / 1000 / bulkDensity(r.m); mass += r.mg; if (isLiquidM(r.m)) liq += r.mg; } });
  let size, n, cap;
  if (P.size && P.size !== 'auto') {
    const c = CAPS.find(c => c[0] === P.size) || CAPS[1]; size = c[0]; cap = c[1]; n = Math.max(1, Math.ceil(vol / cap));
  } else {
    const fit = CAPS.slice().reverse().find(c => c[1] >= vol);
    if (fit) { size = fit[0]; cap = fit[1]; n = 1; }
    else { size = '00'; cap = 0.95; n = Math.ceil(vol / cap); }
  }
  const fillerMg = Math.max(0, (n * cap - vol)) * 1000 * (RHO_ID[P.filler] || 0.4);
  return { vol, mass, size, cap, n, fillerMg, liqFrac: mass ? liq / mass : 0, total: n * (+P.ndose || 1) };
}

/* ---------- Осмоляльность ---------- */
function osmol(rows, V) {
  let osm = 0;
  rows.forEach(r => {
    if (!(r.mg > 0)) return;
    const m = r.m, mw = molW(m);
    if (!mw || m.kind === 'polymer' || m.T.has('gelling') || m.kind === 'enzyme' || m.kind === 'protein') return;
    let i = 1;
    if (m.SP.length) i = m.SP.reduce((a, p) => a + p.n, 0) + m.SP.reduce((a, p) => a + Math.abs(p.z0) * p.n, 0) * (m.SP.length > 1 ? 0.5 : 1);
    else if (m.id === 'nacl') i = 2;
    else if (m.T.has('electrolyte')) i = 2;
    if (m.id === 'nacl' || m.id === 'ki') i = 2;
    let c = r.mg / mw / V; // моль/л
    if (r.S != null && r.conc > r.S) c = r.S / mw;
    osm += c * i * 0.93 * 1000;
  });
  return osm;
}

/* ---------- Анализ ---------- */
function analyze(recipe, opt = {}) {
  const form = recipe.form, P = Object.assign({}, FORM_DEFAULTS[form], recipe.P || {});
  const F = FORMS[form];
  const x = formContext(form, P);
  const findings = [];
  const add = f => { f.ids = f.ids || []; f.pairs = f.pairs || []; findings.push(f); return f; };

  // строки
  const rows = (recipe.items || []).filter(it => BY[it.id]).map((it, k) => {
    const m = BY[it.id];
    return { k, id: it.id, m, amt: it.amt, unit: it.unit || 'мг', mg: toMg(it, form, P) };
  });
  const implicitRows = x.implicit.filter(id => BY[id] && !rows.some(r => r.id === id)).map(id => ({ id, m: BY[id], mg: 0, implicit: true }));
  x.items = rows.concat(implicitRows);
  const actives = rows.filter(r => r.m.kind !== 'excipient');

  // сорастворители (объёмные доли)
  const fr = {};
  if (form === 'hydro') fr.ethanol = (+P.eth || 0) / 100;
  if ((form === 'drops' || form === 'slspray') && P.cosolv && P.cosolv !== 'none') fr[COSOLV_KEY[P.cosolv]] = (+P.cpct || 0) / 100;
  if (x.V) rows.forEach(r => { if (COSOLV_RHO[r.id] && r.mg > 0) fr[r.id] = (fr[r.id] || 0) + r.mg / 1000 / COSOLV_RHO[r.id] / x.V; });
  x.fr = fr;
  rows.forEach(r => { r.cf = cosolvFactor(r.m, fr); });

  // pH
  x.pH = null;
  if (x.V && (x.pc === 'W' || form === 'powder')) x.pH = calcPH(rows, x.V);
  const pH = x.pH;

  // растворимость
  rows.forEach(r => {
    const m = r.m;
    if (x.V && x.pc !== 'L') {
      r.conc = r.mg / x.V;
      const s = pH != null ? solAt(m, pH) : (m.sw ?? null);
      r.S = s != null ? s * r.cf : null;
      if (r.S == null) r.status = (m.kind === 'excipient' && isLiquidM(m)) ? 'жидкость' : 'н/д';
      else r.status = r.conc <= r.S ? 'раствор' : 'взвесь';
      r.dissFrac = r.S != null ? Math.min(1, r.S / Math.max(r.conc, 1e-12)) : null;
    } else if (x.pc === 'L' && (form === 'oildr' || form === 'oint')) {
      const vol = form === 'oildr' ? (+P.vdose || 1) : (+P.mass || 1);
      r.conc = r.mg / vol; r.S = oilSol(m); r.oil = true;
      r.status = (m.T.has('oilbase') || m.T.has('antiox_lipid')) ? 'раствор' : r.conc <= r.S ? 'раствор' : 'взвесь';
      r.dissFrac = Math.min(1, r.S / Math.max(r.conc, 1e-12));
    }
  });

  /* ---- pH и окна стабильности ---- */
  const phInfo = { lo: null, hi: null, conflicts: [] };
  const winRows = actives.filter(r => r.m.ph && !(r.m.ph[0] <= 1 && r.m.ph[1] >= 13));
  if (winRows.length) {
    phInfo.lo = Math.max(...winRows.map(r => r.m.ph[0]));
    phInfo.hi = Math.min(...winRows.map(r => r.m.ph[1]));
  }
  if (x.pc === 'W' && pH != null) {
    winRows.forEach(r => {
      const [lo, hi] = r.m.ph;
      const d = pH < lo ? lo - pH : pH > hi ? pH - hi : 0;
      r.phOk = d === 0; r.phDev = d;
      if (!d) return;
      const below = pH < lo;
      const labile = below ? (r.m.T.has('acidlabile') || r.m.S.hy >= 2) : (r.m.T.has('baselabile') || r.m.S.hy >= 2 || r.m.S.ox >= 2);
      let sev = d >= 2 && labile ? 4 : d >= 1 ? 3 : d >= 0.5 ? 2 : 1;
      if (r.m.kind === 'probiotic') sev = Math.max(sev, 3);
      // кто сдвигает pH
      const shifters = [];
      rows.forEach(o => {
        if (o.id === r.id || !o.m.SP.length) return;
        const p2 = calcPH(rows, x.V, o.id);
        if (p2 == null) return;
        const towards = below ? p2 - pH : pH - p2;
        if (towards > 0.3) shifters.push({ id: o.id, ph: p2, inWin: p2 >= lo && p2 <= hi });
      });
      shifters.sort((a, b) => Math.abs(b.ph - pH) - Math.abs(a.ph - pH));
      const shTxt = shifters.length ? ' Сдвигают pH: ' + shifters.map(s => `${nm(s.id)} (без него pH ≈ ${fmt(s.ph, 1)}${s.inWin ? ', в окне' : ''})`).join('; ') + '.' : ' pH определяется в основном самим веществом и его солевой формой.';
      add({ sev, cat: 'stab', type: 'pH вне окна стабильности', ids: [r.id].concat(shifters.map(s => s.id)),
        pairs: shifters.map(s => [r.id, s.id]), rule: 'ph_window', shifters,
        t: `${r.m.ru}: pH ${fmt(pH, 1)} вне окна ${fmt(lo, 1)}–${fmt(hi, 1)}`,
        mech: `Расчётный pH рецептуры ${fmt(pH, 1)} ${below ? 'ниже' : 'выше'} окна стабильности (${fmt(lo, 1)}–${fmt(hi, 1)}) на ${fmt(d, 1)} ед.${r.m.deg ? ' ' + r.m.deg : ''}${shTxt}`,
        act: shifters.length && shifters[0].inWin ? `Вынести ${nm(shifters[0].id)} в отдельную форму, заменить его солевую форму или ввести буфер (цитратный/фосфатный) с целевым pH ${fmt(lo, 1)}–${fmt(hi, 1)}.` : `Буферировать до pH ${fmt(lo, 1)}–${fmt(hi, 1)} или выбрать другую соль / сухую форму.` });
    });
    if (phInfo.lo != null && phInfo.lo > phInfo.hi) {
      const conf = [];
      for (let i = 0; i < winRows.length; i++) for (let j = i + 1; j < winRows.length; j++) {
        const a = winRows[i].m.ph, b = winRows[j].m.ph;
        if (a[0] > b[1] || b[0] > a[1]) conf.push([winRows[i].id, winRows[j].id]);
      }
      phInfo.conflicts = conf;
      add({ sev: 3, cat: 'stab', type: 'Окна pH не пересекаются', ids: [...new Set(conf.flat())], pairs: conf, rule: 'ph_overlap',
        t: 'Нет общего pH стабильности',
        mech: 'Окна стабильности компонентов в растворе не имеют общей области: ' + conf.map(([a, b]) => `${nm(a)} (${BY[a].ph.map(v => fmt(v, 1)).join('–')}) и ${nm(b)} (${BY[b].ph.map(v => fmt(v, 1)).join('–')})`).join('; ') + '. Любое значение pH разрушает хотя бы один компонент.',
        act: 'Разделить конфликтующие компоненты по разным формам или перейти на сухую форму.' });
    }
  }

  /* ---- Совместимость каждого вещества с формой ---- */
  const hydroEth = form === 'hydro' ? (+P.eth || 0) : ((fr.ethanol || 0) * 100);
  rows.forEach(r => {
    const m = r.m; const I = [r.id];
    const isEx = m.kind === 'excipient';
    const F1 = (sev, type, t, mech, act, cat = 'stab') => add({ sev, cat, type, ids: I, t: `${m.ru}: ${t}`, mech, act, rule: 'form_' + type, item: r.id });
    // единицы
    if (r.unit === 'МЕ' && !IU[r.id]) F1(2, 'Единицы', 'МЕ не пересчитываются', 'Для этого вещества нет коэффициента пересчёта МЕ → мг; количество принято равным нулю.', 'Ввести количество в мг или мкг.', 'form');
    if (r.unit === '%' && !(F.liquid || F.unitMass)) F1(2, 'Единицы', '% не применим к форме', 'Проценты пересчитываются только для жидких и мягких форм.', 'Ввести количество в мг.', 'form');
    if (m.dmax && r.mg > m.dmax * 20) F1(2, 'Единицы', 'проверьте единицы', `Введённое количество (${fmtMg(r.mg)}) во много раз превышает типичные значения для этого вещества — возможна ошибка единиц (мг/мкг/г).`, 'Проверить единицы измерения.', 'form');
    if (m.dmin && r.mg > 0 && r.mg < m.dmin / 100) F1(1, 'Единицы', 'проверьте единицы', `Введённое количество (${fmtMg(r.mg)}) во много раз ниже типичных значений — возможна ошибка единиц.`, 'Проверить единицы измерения.', 'form');
    if (isEx && !['ethanol', 'glycerin', 'pg', 'peg400', 'mct', 'olive'].includes(r.id)) {
      // вспомогательные вещества проверяем только по основным признакам ниже
    }
    // фаза: растворимость
    if (x.pc === 'W' && F.liquid && r.status === 'взвесь') {
      const df = r.dissFrac;
      let sev = form === 'nasal' || form === 'slspray' ? 3 : 2;
      if (form === 'drops' || form === 'hydro') sev = (df < 0.05 && (m.T.has('lipo') || (m.logP ?? 0) > 3)) ? 3 : 2;
      F1(sev, 'Фаза', `взвесь (растворено ≈ ${fmt(df * 100, 0)}%)`,
        `Концентрация ${fmt(r.conc, 2)} мг/мл превышает оценку растворимости ${fmt(r.S, 3)} мг/мл при pH ${fmt(pH, 1)}${Object.keys(fr).some(k => fr[k] > 0) ? ' с учётом сорастворителей' : ''}. В ${form === 'nasal' || form === 'slspray' ? 'спрее взвесь забивает распылитель и даёт неравномерную дозу; всасывание через слизистую идёт только из раствора' : 'каплях взвесь оседает — неоднородность дозы'}.`,
        m.T.has('lipo') ? 'Масляная форма, мицеллярная/липосомальная субстанция, солюбилизатор (полисорбат 80) или сорастворитель; иначе — капсулы.' : 'Увеличить объём на приём, сорастворитель (глицерин, ПГ), подходящая соль или pH; либо суспензия с загустителем и пометкой «взбалтывать».', 'phys');
    }
    if (x.pc === 'W' && !F.liquid && r.status === 'взвесь' && (form === 'gel' || form === 'cream' || form === 'td') && (form !== 'td')) {
      F1(1, 'Фаза', 'диспергировано (не растворено)', `Концентрация ${fmt(r.conc, 1)} мг/мл в водной фазе выше растворимости ${fmt(r.S, 3)} мг/мл: вещество в основе в виде частиц, проникновение — только из растворённой части.`, 'Микронизировать, предварительно растереть с ПГ/глицерином.', 'phys');
    }
    if (form === 'powder' && r.status === 'взвесь') F1(1, 'Фаза', 'не растворится полностью в напитке', `В ${P.water} мл воды растворится ≈ ${fmt(r.dissFrac * 100, 0)}%: частицы остаются взвесью.`, 'Размешивать перед питьём; для жирорастворимых — капсулы или эмульгированная форма.', 'phys');
    if (x.pc === 'L' && r.oil && r.status === 'взвесь' && !isEx) {
      const sev = form === 'oildr' ? (m.logP != null && m.logP < 0 || m.kind === 'mineral' ? 3 : 2) : 1;
      F1(sev, 'Фаза', 'не растворяется в масле', `Оценка растворимости в масле ${fmt(r.S, 2)} мг/мл при концентрации ${fmt(r.conc, 1)} мг/мл${m.logP != null ? ' (logP ' + fmt(m.logP, 1) + ')' : ''}: вещество будет взвесью, оседает и комкуется.`, form === 'oildr' ? 'Перенести гидрофильный компонент в водную форму или капсулы; в масле — только микронизированная взвесь с загустителем (SiO₂).' : 'Микронизировать; допустимо как суспензионная мазь.', 'phys');
    }
    if (x.pc === 'W' && isLiquidM(m) && (m.T.has('oilbase') || m.T.has('pufa') || m.id === 'vite') && !rows.some(o => o.m.T.has('surfactant') || o.m.T.has('emulsifier'))) {
      F1(form === 'cream' || form === 'td' ? 0 : 3, 'Фаза', 'масло в водной форме', 'Масляная жидкость не смешивается с водной фазой: расслоение.', 'Эмульгатор (полисорбат 80, лецитин) или масляная форма.', 'phys');
    }
    if (x.pc === 'D' && isLiquidM(m) && r.mg > 0) {
      F1(2, 'Фаза', 'жидкость в сухой форме', 'Жидкий компонент в порошковой смеси: комкование, неравномерная дозировка, протекание капсул.', 'Адсорбировать на SiO₂/МКЦ (до 1:1), либо мягкие/запаянные капсулы или масляная форма.', 'phys');
    }
    if (x.pc === 'W' && F.liquid && m.T.has('gelling') && m.kind !== 'excipient') {
      F1(m.id === 'psyllium' ? 4 : 2, 'Фаза', 'гелеобразование', `${m.ru} набухает и загущает жидкость${m.id === 'psyllium' ? ' в плотный гель — капли и спрей невозможны' : ' — меняется вязкость и дозирование'}.`, m.id === 'psyllium' ? 'Только порошок для напитка или капсулы.' : 'Учесть вязкость; для спрея — снизить концентрацию.', 'phys');
    }
    // этанол
    if (hydroEth >= 15 && (m.kind === 'enzyme' || m.kind === 'protein' || m.T.has('anionpoly') || m.T.has('fibre') || m.kind === 'peptide' || m.kind === 'probiotic') && !isEx) {
      F1(m.kind === 'probiotic' ? 4 : 3, 'Фаза', `осаждается / денатурирует в ${fmt(hydroEth, 0)}% этаноле`, 'Белки, пептиды и полисахариды теряют гидратную оболочку и выпадают в осадок в водно-спиртовой среде; ферменты и пробиотики инактивируются.', 'Водная форма без спирта или сухая форма.', 'phys');
    }
    // липосомальные формы
    if (m.T.has('liposome')) {
      if (hydroEth > 10) F1(3, 'Липосомы', `разрушаются в ${fmt(hydroEth, 0)}% этаноле`, 'Этанол растворяет фосфолипидный бислой: липосомы распадаются, вещество теряет преимущество формы и может выпасть в осадок.', 'Водная форма без спирта (капли, спрей) или готовая липосомальная жидкость.', 'phys');
      if (x.heat >= 40) F1(3, 'Липосомы', `разрушаются при нагреве до ${x.heat} °C`, 'Выше температуры фазового перехода фосфолипидов (≈ 40 °C) липосомы сливаются и теряют содержимое.', 'Форма без нагрева: капли, спрей, капсулы с готовым липосомальным порошком.', 'phys');
      if (x.pc === 'L') F1(2, 'Липосомы', 'в масляной/жировой основе', 'Липосомы — водная дисперсия; в масле они не сохраняют структуру.', 'Водная форма или водная фаза крема.', 'phys');
      if (x.pc === 'D') F1(1, 'Липосомы', 'сухая форма', 'В капсулах и порошке сохраняются только лиофилизированные (порошковые) липосомы; жидкую липосомальную субстанцию в капсулу не перенести.', 'Уточнить у поставщика форму субстанции (порошок / жидкость).', 'phys');
    }
    // типы веществ
    if (m.kind === 'probiotic') {
      if (x.pc === 'W') F1(4, 'Жизнеспособность', 'пробиотик в водной форме', 'В воде бактерии быстро теряют жизнеспособность (гидратация, кислород, консерванты).', 'Только капсулы (ГПМЦ, кислотоустойчивые) или порошок в саше.');
      else if (x.heat >= 40) F1(4, 'Жизнеспособность', `нагрев ${x.heat} °C`, 'Пробиотические бактерии погибают при нагреве основы.', 'Только капсулы.');
      else if (x.pc === 'L') F1(1, 'Жизнеспособность', 'масляная суспензия', 'В масле жизнеспособность сохраняется лучше, чем в воде, но ниже, чем в сухих капсулах.', 'Предпочтительны капсулы.');
    }
    if ((m.kind === 'enzyme' || (m.kind === 'protein' && !isEx)) && x.pc === 'W' && F.liquid) F1(2, 'Активность', 'фермент/белок в растворе', 'В водном растворе ферменты теряют активность (денатурация, автолиз протеаз, микробная контаминация); срок годности короткий.', 'Сухая форма; в жидкой — хранение 2–8 °C, короткий BUD (USP <795>: ≤ 14 дней для водных форм в холодильнике).');
    if (m.kind === 'peptide' && (F.route === 'oral' || (F.route === 'oral_sl' && !(+P.sl)))) F1(2, 'Всасывание', 'пептид при проглатывании', 'Пептиды гидролизуются пепсином и панкреатическими протеазами; пероральная биодоступность обычно < 1% без специальных усилителей.', 'Рассмотреть сублингвальную или назальную форму.', 'pharm');
    if (x.heat && !isEx) {
      const he = m.S.he;
      const prot = m.kind === 'enzyme' || m.kind === 'peptide' || (m.kind === 'protein');
      let sev = 0;
      if (prot) sev = x.heat >= 55 ? 3 : 2; else if (he >= 3) sev = x.heat >= 55 ? 3 : 2; else if (he >= 2) sev = x.heat >= 55 ? 2 : 1;
      if (m.kind === 'probiotic') sev = 0;
      if (sev) F1(sev, 'Нагрев', `нагрев основы до ≈ ${x.heat} °C`, `При изготовлении ${form === 'troche' ? 'троше' : 'свечей'} основа (${x.baseName}) расплавляется при ≈ ${x.heat} °C. ${prot ? 'Белки и пептиды денатурируют.' : 'Вещество чувствительно к нагреву (he' + he + ').'}`, 'Вводить в основу при минимальной температуре в последнюю очередь, минимальное время нагрева; альтернатива — форма без нагрева.');
    }
    // влага
    if (x.pc === 'D' && !isEx) {
      if (m.T.has('deliq')) F1(2, 'Влага', 'расплывается на воздухе', 'Расплывающееся вещество впитывает влагу до растворения: капсулы слипаются, порошок комкуется.', 'Капсулы ГПМЦ, SiO₂ 0,5–1%, осушитель во флаконе, наполнение при низкой влажности.');
      else if (m.S.mo >= 3) F1(2, 'Влага', 'чувствительно к влаге', 'Вещество разрушается при контакте с влагой (mo3).', 'Капсулы ГПМЦ, осушитель, герметичная тара.');
      else if (m.T.has('hygro') || m.S.mo >= 2) F1(1, 'Влага', 'гигроскопично', 'Поглощает влагу из воздуха — возможно комкование.', 'Плотная тара, осушитель.');
    }
    if (x.pc === 'M' && P.base !== 'fat' && m.S.mo >= 3 && !isEx) F1(1, 'Влага', 'гигроскопичная основа ПЭГ/желатин', 'Гидрофильная основа содержит и поглощает влагу.', 'Герметичная упаковка.');
    // свет
    if (!isEx && m.S.li >= 2) F1(m.S.li >= 3 && (x.pc === 'W' || x.pc === 'L') ? 2 : 1, 'Свет', `светочувствительно (li${m.S.li})`, 'Фотодеградация на свету' + (m.iso ? ': ' + m.iso : '.'), 'Тара из тёмного (янтарного) стекла или непрозрачная; хранить в темноте.');
    // окисление / гидролиз в растворе
    if (x.pc === 'W' && !isEx) {
      if (m.S.ox >= 3) F1(2, 'Окисление', 'легко окисляется в растворе', (m.deg || 'Окисление растворённым кислородом.'), 'Антиоксидант (метабисульфит/аскорбат по совместимости, ЭДТА 0,05%), заполнение азотом, минимальный свободный объём, холодильник, короткий срок.');
      else if (m.S.ox >= 2) F1(1, 'Окисление', 'умеренно окисляется', 'Возможна окислительная деградация при длительном хранении раствора.', 'ЭДТА, тёмная тара, холодильник.');
      if (m.S.hy >= 3 && r.phOk !== false) F1(1, 'Гидролиз', 'гидролитически нестабильно', (m.deg || 'Гидролиз в водной среде.'), 'Сухая форма или короткий срок годности, 2–8 °C.');
    }
    if (x.pc === 'L' && (m.T.has('pufa') || m.T.has('carotenoid') || m.id === 'retinol') && !rows.some(o => o.m.T.has('antiox_lipid'))) F1(1, 'Окисление', 'нужен антиоксидант масла', 'Полиеновые и полиненасыщенные соединения окисляются в масле.', 'Добавить токоферол 0,1–0,5% и/или аскорбилпальмитат 0,02%.');
    // вкус
    if (x.tasteMatters && !isEx) {
      const parts = []; let sev = 0;
      if (m.veryBitter) { parts.push('выраженная горечь'); sev = 2; } else if (m.isBitter) { parts.push('горький вкус'); sev = Math.max(sev, 1); }
      if (m.T.has('sulfurodor')) { parts.push('серный запах'); sev = Math.max(sev, 1); }
      if (m.T.has('fishodor')) { parts.push('рыбный запах'); sev = Math.max(sev, 1); }
      if (m.taste && /металл/i.test(m.taste.t || '')) { parts.push('металлический привкус'); sev = Math.max(sev, 1); }
      if (m.T.has('acidic_strong')) { parts.push('резко кислый'); sev = Math.max(sev, 1); }
      if (m.p1 != null && m.p1 >= 10 && r.mg >= 100) { parts.push('щелочной, раздражает слизистую'); sev = Math.max(sev, 2); }
      if (m.T.has('stain')) { parts.push('окрашивает слизистую и зубы'); sev = Math.max(sev, 1); }
      if (parts.length) F1(sev, 'Вкус', parts.join(', '), `Вещество находится во рту длительно (${F.n.toLowerCase()}).${m.taste && m.taste.t ? ' Вкус: ' + m.taste.t.toLowerCase() + '.' : ''}`, 'Подсластитель (сукралоза, ксилит), ароматизатор, маскирующая основа; при выраженной горечи — проглатываемая форма.', 'form');
    }
    // проницаемость слизистой (SL)
    if ((F.route === 'sl' || (F.route === 'oral_sl' && +P.sl === 1)) && !isEx && m.kind === 'small') {
      const mw = m.mw_smi || m.mw;
      if ((m.tpsa && m.tpsa > 140) || (mw && mw > 600) || (m.logP != null && m.logP < -2)) F1(1, 'Всасывание', 'низкая проницаемость слизистой', `Полярное вещество (TPSA ${fmt(m.tpsa, 0)} Å², logP ${fmt(m.logP, 1)}, M ${fmt(mw, 0)}): пассивное трансбуккальное всасывание ограничено; большая часть дозы будет проглочена.`, 'Учесть при выборе пути введения.', 'pharm');
    }
    // кожа
    if ((form === 'td' || form === 'cream' || form === 'gel' || form === 'oint') && !isEx) {
      const pg = pottsGuy(m);
      if (pg && ((m.logP != null && m.logP < 0) || (m.mw_smi || m.mw) > 500)) F1(form === 'td' ? 2 : 1, 'Проницаемость кожи', 'низкий трансдермальный поток', `Оценка по Potts–Guy: kp ≈ ${fmt(pg.kp, 2)} см/ч${pg.J != null ? ', поток из насыщенного раствора ≈ ' + fmt(pg.J, 2) + ' мкг/см²/ч' : ''}. Гидрофильные (logP < 0) и крупные (M > 500) молекулы плохо проникают через роговой слой.`, form === 'td' ? 'Для системного действия выбрать другой путь введения; для местного действия — допустимо.' : 'Для местного действия допустимо.', 'pharm');
      else if (!pg && (m.kind === 'protein' || m.kind === 'enzyme' || m.kind === 'peptide' || m.kind === 'polymer') && form === 'td') F1(2, 'Проницаемость кожи', 'макромолекула', 'Белки, пептиды и полимеры практически не проникают через неповреждённую кожу.', 'Другой путь введения.', 'pharm');
    }
    // гели и основы
    if (form === 'gel' && P.gelling === 'carbomer' && (m.T.has('cationic') || m.T.has('alkaloid'))) F1(3, 'Основа', 'катион + карбомер', 'Катионное вещество образует с карбомером нерастворимый комплекс.', 'Гелеобразователь ГЭЦ или ГПМЦ.', 'phys');
    // консерванты
    if (pH != null && m.T.has('preserv_benzoate') && pH > 5) F1(2, 'Консервант', `неэффективен при pH ${fmt(pH, 1)}`, 'Бензоат активен в недиссоциированной форме (pKa 4,2): при pH > 5 консервирующее действие резко падает.', 'pH ≤ 4,5 или другой консервант (парабены, бензиловый спирт).', 'form');
    if (pH != null && m.T.has('preserv_sorbate') && pH > 6.5) F1(2, 'Консервант', `неэффективен при pH ${fmt(pH, 1)}`, 'Сорбиновая кислота (pKa 4,8) эффективна при pH < 6.', 'pH ≤ 6 или другой консервант.', 'form');
    // одиночные фармакологические
    SINGLE_NOTES.forEach(n => { if (m.T.has(n.tag)) add({ sev: n.sev, cat: 'pharm', type: n.type, ids: I, t: `${m.ru}: ${n.type.toLowerCase()}`, mech: n.mech, act: n.act, rule: 'single_' + n.tag, item: r.id }); });
  });

  /* ---- Загрузка формы и сводка ---- */
  const summary = { pH, V: x.V, pc: x.pc, heat: x.heat, fr };
  const activeMg = rows.filter(r => r.mg > 0 && !(r.m.kind === 'excipient' && isLiquidM(r.m))).reduce((a, r) => a + r.mg, 0);
  summary.totalMg = activeMg;
  if (form === 'caps') {
    const c = capsCalc(rows, P); summary.caps = c;
    if (c.n > 4) add({ sev: 2, cat: 'form', type: 'Загрузка формы', t: `${c.n} капсул №${c.size} на приём`, mech: `Объём смеси ≈ ${fmt(c.vol, 2)} мл на приём (оценка по насыпной плотности) — ${c.n} капсул №${c.size}.`, act: 'Разделить на 2 приёма, вынести объёмные компоненты (аминокислоты, минералы) в порошок для напитка.', rule: 'caps_load' });
    else if (c.n > 2) add({ sev: 1, cat: 'form', type: 'Загрузка формы', t: `${c.n} капсул №${c.size} на приём`, mech: `Объём смеси ≈ ${fmt(c.vol, 2)} мл на приём.`, act: 'Допустимо; при необходимости уменьшить число капсул — порошок.', rule: 'caps_load' });
    if (c.liqFrac > 0.1) add({ sev: 2, cat: 'phys', type: 'Фаза', t: 'Много жидких компонентов в капсуле', mech: `Жидкие компоненты ≈ ${fmt(c.liqFrac * 100, 0)}% массы наполнения.`, act: 'Адсорбент SiO₂ или запаянные / мягкие капсулы.', rule: 'caps_liq' });
  }
  if (form === 'troche' || form === 'supp' || form === 'vag') {
    const base = (+P.mass || 1) * 1000; const load = activeMg / base * 100; summary.load = load;
    const lim = form === 'troche' ? [35, 60, 100] : [30, 50, 90];
    const sev = load > lim[2] ? 4 : load > lim[1] ? 3 : load > lim[0] ? 2 : 0;
    if (sev) add({ sev, cat: 'form', type: 'Загрузка формы', t: `Загрузка ${fmt(load, 0)}% массы ${form === 'troche' ? 'троше' : 'свечи'}`, mech: `Активные вещества ${fmtMg(activeMg)} на единицу массой ${fmt(+P.mass, 2)} г. ${form === 'troche' ? 'Троше на ПЭГ/желатиновой основе выдерживает примерно до 30–35% порошка; выше — масса не льётся, троше крошится.' : 'Свечная основа выдерживает около 30% порошка; выше — расплав густеет, свечи ломаются, нарушается высвобождение.'}${load > 100 ? ' Масса веществ больше массы единицы — изготовить невозможно.' : ''}`, act: 'Увеличить массу единицы, разделить дозу на 2 единицы, вынести объёмные компоненты в другую форму.', rule: 'unit_load' });
  }
  if (F.liquid) {
    const wv = activeMg / (+P.vdose || 1) / 10; summary.wv = wv; // % м/о
    if (wv > 80) add({ sev: 4, cat: 'form', type: 'Загрузка формы', t: `${fmt(wv, 0)}% (м/о) — не жидкость`, mech: `${fmtMg(activeMg)} в ${fmt(+P.vdose, 2)} мл: масса веществ сопоставима с объёмом, раствор/взвесь получить нельзя.`, act: 'Увеличить объём на приём или выбрать порошок/капсулы.', rule: 'liq_load' });
    else if (wv > 40) add({ sev: 3, cat: 'form', type: 'Загрузка формы', t: `${fmt(wv, 0)}% (м/о)`, mech: `${fmtMg(activeMg)} в ${fmt(+P.vdose, 2)} мл — очень концентрированная жидкость: вязкость, кристаллизация при хранении.`, act: 'Увеличить объём на приём.', rule: 'liq_load' });
    else if (wv > 20) add({ sev: 2, cat: 'form', type: 'Загрузка формы', t: `${fmt(wv, 0)}% (м/о)`, mech: 'Высокая концентрация: риск кристаллизации при охлаждении и изменения вкуса.', act: 'Проверить пробную партию при 2–8 °C.', rule: 'liq_load' });
  }
  if (form === 'nasal') {
    const osm = osmol(rows, x.V); summary.osm = osm;
    if (osm > 700) add({ sev: 3, cat: 'form', type: 'Осмоляльность', t: `≈ ${fmt(osm, 0)} мОсм/кг — гипертонично`, mech: 'Сильно гипертонический раствор раздражает слизистую носа и угнетает мукоцилиарный клиренс.', act: 'Снизить концентрацию, увеличить объём (до 0,2 мл на ноздрю).', rule: 'osm' });
    else if (osm > 450) add({ sev: 2, cat: 'form', type: 'Осмоляльность', t: `≈ ${fmt(osm, 0)} мОсм/кг`, mech: 'Гипертонический раствор: жжение, раздражение.', act: 'Целевой диапазон 250–350 мОсм/кг.', rule: 'osm' });
    else if (osm < 180) add({ sev: 1, cat: 'form', type: 'Осмоляльность', t: `≈ ${fmt(osm, 0)} мОсм/кг — гипотонично`, mech: 'Гипотонический раствор может вызывать дискомфорт.', act: 'Довести натрия хлоридом до 250–350 мОсм/кг (≈ 0,9% − вклад компонентов).', rule: 'osm' });
    if (pH != null && (pH < 4.5 || pH > 6.5)) { const far = pH < 3.5 || pH > 8; add({ sev: far ? 2 : 1, cat: 'form', type: 'pH слизистой', t: `pH ${fmt(pH, 1)} вне диапазона носовой слизистой`, mech: 'Переносимый pH назальных растворов 4,5–6,5 (физиологически 5,5–6,5); за пределами — жжение, нарушение мукоцилиарного транспорта.', act: 'Буферировать (цитратный/фосфатный) в пределах окна стабильности веществ.', rule: 'nasal_ph' }); }
  }
  if ((form === 'slspray' || ((form === 'drops' || form === 'hydro') && +P.sl === 1)) && pH != null && (pH < 3 || pH > 9)) add({ sev: 1, cat: 'form', type: 'pH слизистой', t: `pH ${fmt(pH, 1)} при удержании во рту`, mech: 'Сильнокислый или щелочной раствор при длительном контакте раздражает слизистую и повреждает эмаль.', act: 'Буферировать или разбавлять перед приёмом.', rule: 'sl_ph' });
  if (form === 'gel' && P.gelling === 'carbomer' && pH != null && (pH < 4.5 || pH > 9)) add({ sev: pH < 4.5 ? 3 : 2, cat: 'phys', type: 'Вязкость основы', t: `Карбомер при pH ${fmt(pH, 1)}`, mech: 'Карбомер загущает только после нейтрализации (pH 5–8); при pH < 4,5 гель не образуется, при высоком pH и солях — разжижается.', act: 'ГЭЦ/ГПМЦ вместо карбомера или буферирование.', rule: 'carbomer_ph' });
  if ((form === 'cream' || form === 'td') && pH != null && (pH < 3.5 || pH > 9)) add({ sev: 2, cat: 'form', type: 'pH кожи', t: `pH водной фазы ${fmt(pH, 1)}`, mech: 'Сильнокислая или щелочная основа раздражает кожу и может разрушать эмульсию (в том числе трансдермальную основу Pentravan).', act: 'Буферировать водную фазу до 4,5–7.', rule: 'skin_ph' });
  if (form === 'oildr' && actives.length && actives.filter(r => r.status === 'взвесь').length > actives.length / 2) add({ sev: 2, cat: 'form', type: 'Выбор формы', t: 'Большинство веществ не растворяются в масле', mech: 'Масляная форма подходит для жирорастворимых веществ; гидрофильные остаются взвесью.', act: 'Рассмотреть водные капли или капсулы.', rule: 'oil_choice' });

  /* ---- Парные правила ---- */
  const all = x.items;
  for (let i = 0; i < all.length; i++) for (let j = 0; j < all.length; j++) {
    if (i === j) continue;
    const A = all[i].m, B = all[j].m;
    if (all[i].implicit && all[j].implicit) continue;
    for (const R of PAIR_RULES) {
      if (R.a === R.b && j < i) continue;
      if (!matchSel(A, R.a) || !matchSel(B, R.b)) continue;
      if (R.not && (R.not(A) || R.not(B))) continue;
      if (R.when && !R.when(A, B, x)) continue;
      const sev = R.cat === 'syn' ? 0 : sevFor(R.sev, x.pc, A, B, x);
      if (R.cat !== 'syn' && !(sev > 0)) continue;
      const key = R.id + ':' + [A.id, B.id].sort().join('|');
      if (findings.some(f => f.key === key)) continue;
      add({ key, sev, cat: R.cat, type: R.type, ids: [A.id, B.id], pairs: [[A.id, B.id]], rule: R.id, split: !!R.split, add: !!R.add,
        implicit: all[i].implicit || all[j].implicit,
        t: `${A.ru} + ${B.ru}${all[i].implicit || all[j].implicit ? ' (основа)' : ''}`,
        mech: fill(R.mech, A, B), act: fill(R.act, A, B) });
    }
  }
  /* ---- Групповые фармакологические ---- */
  for (const G of GROUP_RULES) {
    const ms = actives.map(r => r.m).filter((m, i, a) => a.indexOf(m) === i).map(m => ({ m, w: G.w(m) })).filter(o => o.w > 0);
    if (ms.length < 2) continue;
    const sum = ms.reduce((a, o) => a + o.w, 0);
    if (sum < G.min) continue;
    const mm = ms.map(o => o.m);
    const pairs = []; for (let i = 0; i < mm.length; i++) for (let j = i + 1; j < mm.length; j++) pairs.push([mm[i].id, mm[j].id]);
    add({ sev: G.sev(mm, sum), cat: 'pharm', type: G.type, ids: mm.map(m => m.id), pairs, rule: G.id, t: mm.map(m => m.ru).join(' + '), mech: G.mech, act: G.act });
  }

  /* ---- Данные аптеки Nano Identica (блок ni): pH, нагрев, растворитель, концентрация, консерванты ---- */
  niChecks({ rows, actives, x, form, F, pH, fr, hydroEth, add, findings, phInfo });

  findings.forEach(f => { if (f.cat !== 'syn' && !f.src) f.src = ['lit']; });
  findings.sort((a, b) => (b.sev || 0) - (a.sev || 0) || (a.cat === 'syn') - (b.cat === 'syn'));
  const probs = findings.filter(f => f.cat !== 'syn');
  const maxSev = probs.length ? Math.max(...probs.map(f => f.sev)) : 0;
  const verdict = VERDICT[maxSev];
  return { recipe: { form, P, items: recipe.items }, x, rows, findings, maxSev, verdict, summary, phInfo, score: score(findings) };
}
const VERDICT = {
  4: { k: 'crit', t: 'Несовместимо', d: 'В этой форме и составе готовить нельзя: есть компоненты, разрушающие друг друга или форму. Нужно разделение или замена.' },
  3: { k: 'major', t: 'Серьёзные проблемы', d: 'Без изменения состава, соли, основы или формы рецептура нестабильна или неудобна. См. рекомендации.' },
  2: { k: 'mod', t: 'Совместимо с мерами', d: 'Готовить можно при соблюдении мер: буфер, антиоксидант, тара, раздельный приём, срок годности.' },
  1: { k: 'minor', t: 'Совместимо, с замечаниями', d: 'Существенных противоречий не найдено; учесть отмеченные особенности.' },
  0: { k: 'ok', t: 'Совместимо', d: 'Противоречий по правилам базы не найдено.' }
};
function score(fs) { return fs.reduce((a, f) => a + (f.cat === 'syn' ? 0 : SEVW[f.sev] || 0), 0); }

/* ---------- Матрица ---------- */
function pairMatrix(res) {
  const ids = res.rows.filter(r => r.m.kind !== 'excipient' || true).map(r => r.id).filter((v, i, a) => a.indexOf(v) === i);
  const cell = {};
  const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  res.findings.forEach(f => (f.pairs || []).forEach(([a, b]) => {
    if (a === b || !ids.includes(a) || !ids.includes(b)) return;
    const k = key(a, b); const c = cell[k] || (cell[k] = { sev: -1, syn: false, list: [] });
    if (f.cat === 'syn') c.syn = true; else c.sev = Math.max(c.sev, f.sev);
    c.list.push(f);
  }));
  const diag = {};
  ids.forEach(id => {
    const fs = res.findings.filter(f => f.item === id && f.cat !== 'syn');
    diag[id] = { sev: fs.length ? Math.max(...fs.map(f => f.sev)) : -1, list: fs };
  });
  return { ids, get: (a, b) => cell[key(a, b)], diag };
}

/* ---------- Разделение на группы (раскраска графа конфликтов) ---------- */
function conflictEdges(res) {
  const E = new Set();
  const ids = res.rows.map(r => r.id);
  res.findings.forEach(f => {
    if (f.cat === 'syn' || f.implicit) return;
    const chemphys = (f.cat === 'chem' || f.cat === 'phys' || f.cat === 'stab') && f.sev >= 3;
    const pharm = f.split && f.sev >= 2;
    const chemSplit = f.split && f.sev >= 2 && f.cat !== 'pharm' && res.x.pc === 'W';
    if (!(chemphys || pharm || chemSplit)) return;
    (f.pairs || []).forEach(([a, b]) => { if (a !== b && ids.includes(a) && ids.includes(b)) E.add(a < b ? a + '|' + b : b + '|' + a); });
  });
  return [...E].map(s => s.split('|'));
}
function colorGraph(ids, edges) {
  const adj = {}; ids.forEach(i => adj[i] = new Set());
  edges.forEach(([a, b]) => { adj[a].add(b); adj[b].add(a); });
  const col = {}; const left = new Set(ids);
  while (left.size) { // DSatur
    let best = null, bs = -1, bd = -1;
    left.forEach(v => { const sat = new Set([...adj[v]].filter(u => col[u] != null).map(u => col[u])).size; const d = adj[v].size; if (sat > bs || (sat === bs && d > bd)) { best = v; bs = sat; bd = d; } });
    const used = new Set([...adj[best]].map(u => col[u]).filter(c => c != null));
    let c = 0; while (used.has(c)) c++;
    col[best] = c; left.delete(best);
  }
  const groups = [];
  ids.forEach(i => { (groups[col[i]] = groups[col[i]] || []).push(i); });
  return groups;
}
function bestForm(items, fam, preferred, P0) {
  const cands = Object.keys(FORMS).filter(f => FORMS[f].fam === fam);
  let best = null;
  cands.forEach(f => {
    const okUnits = items.every(it => it.unit !== '%' || FORMS[f].liquid || FORMS[f].unitMass);
    if (!okUnits) return;
    const P = f === preferred ? P0 : {};
    const r = analyze({ form: f, P, items }, { nosplit: true });
    const s = r.score + (f === preferred ? -0.5 : 0);
    if (!best || s < best.s) best = { form: f, s, res: r };
  });
  return best;
}
function suggestSplit(res) {
  const ids = res.rows.map(r => r.id).filter((v, i, a) => a.indexOf(v) === i);
  const edges = conflictEdges(res);
  if (!edges.length) return null;
  const groups = colorGraph(ids, edges);
  const fam = FORMS[res.recipe.form].fam;
  return {
    edges,
    groups: groups.map(g => {
      const items = res.recipe.items.filter(it => g.includes(it.id));
      const b = bestForm(items, fam, res.recipe.form, res.recipe.P);
      return { ids: g, items, form: b ? b.form : res.recipe.form, res: b ? b.res : null };
    })
  };
}

/* ---------- Пригодность одного вещества для форм ---------- */
function defaultAmount(m) {
  if (m.dmin) return { amt: m.dmin, unit: 'мг' };
  if (m.kind === 'peptide') return { amt: 1, unit: 'мг' };
  if (m.kind === 'excipient') return { amt: 10, unit: 'мг' };
  return { amt: 50, unit: 'мг' };
}
function suitability(id) {
  const m = BY[id]; const d = defaultAmount(m);
  return Object.keys(FORMS).map(f => {
    const r = analyze({ form: f, P: {}, items: [{ id, amt: d.amt, unit: d.unit }] });
    const own = r.findings.filter(x => x.cat !== 'syn' && (x.item === id || x.ids.includes(id)));
    const mx = own.length ? Math.max(...own.map(x => x.sev)) : 0;
    return { form: f, sev: mx, top: own.slice(0, 3), res: r };
  });
}

/* ---------- Текстовое заключение ---------- */
function reportText(res, split) {
  const F = FORMS[res.recipe.form]; const L = [];
  L.push('ЗАКЛЮЧЕНИЕ О СОВМЕСТИМОСТИ (оценочный расчёт, решение — за провизором)');
  L.push('Форма: ' + F.n);
  L.push('Состав на приём:');
  res.rows.forEach(r => L.push(`  • ${r.m.ru} — ${String(r.amt).replace('.', ',')} ${r.unit}${r.unit !== 'мг' && r.mg ? ' (' + fmtMg(r.mg) + ')' : ''}${r.status ? '; ' + r.status : ''}`));
  if (res.x.implicit.length) L.push('Основа / вспомогательные: ' + res.x.implicit.map(nm).join(', '));
  const s = res.summary;
  const sm = [];
  if (s.pH != null) sm.push('pH ≈ ' + fmt(s.pH, 1));
  if (s.osm != null) sm.push('осмоляльность ≈ ' + fmt(s.osm, 0) + ' мОсм/кг');
  if (s.caps) sm.push(`капсулы: ${s.caps.n} × №${s.caps.size} на приём, всего ${s.caps.total}`);
  if (s.load != null) sm.push('загрузка ' + fmt(s.load, 0) + '%');
  if (sm.length) L.push('Расчёт: ' + sm.join('; '));
  L.push('ВЕРДИКТ: ' + res.verdict.t + '. ' + res.verdict.d);
  const probs = res.findings.filter(f => f.cat !== 'syn');
  if (probs.length) {
    L.push(''); L.push('Находки:');
    probs.forEach((f, i) => { L.push(`${i + 1}. [${SEV[f.sev].t}] ${CAT[f.cat]} — ${f.type}: ${f.t}${f.src ? ' (источник: ' + srcLabel(f) + ')' : ''}`); L.push('   Механизм: ' + f.mech); L.push('   Что сделать: ' + f.act); });
  }
  const syn = res.findings.filter(f => f.cat === 'syn');
  if (syn.length) { L.push(''); L.push('Синергия:'); syn.forEach(f => L.push(`  + ${f.t} — ${f.type}: ${f.mech}`)); }
  if (split && split.groups.length > 1) {
    L.push(''); L.push('Предлагаемое разделение:');
    split.groups.forEach((g, i) => L.push(`  Группа ${i + 1} (${FORMS[g.form].n}): ${g.ids.map(nm).join(', ')}${g.res ? ' — ' + g.res.verdict.t.toLowerCase() : ''}`));
  }
  L.push(''); L.push('Все значения — оценочные (модели и справочные данные), дозировки не рекомендуются.');
  return L.join('\n');
}

/* ---------- Данные аптеки Nano Identica ---------- */
const SRC_N = { lit: 'литература', ni: 'данные аптеки' };
function srcLabel(f) { return (f.src || []).map(k => SRC_N[k]).filter(Boolean).join(' и '); }
const NI_PRES = ['nabenz', 'ksorb', 'mparaben', 'benzylalc'];          // консерванты базы
const NI_ANTI = ['metabisulfite', 'ascpalm', 'tocoph', 'edta'];        // антиоксиданты и хелаторы базы
const NI_PA_N = { nabenz: 'натрия бензоат', ksorb: 'калия сорбат', mparaben: 'парабены', benzylalc: 'бензиловый спирт', phenoxy: 'феноксиэтанол',
  dehydroacetic: 'дегидроуксусная кислота', ehg: 'этилгексилглицерин', quat: 'четвертичные аммониевые', chlorobutanol: 'хлорбутанол', tocoph: 'токоферол',
  ascpalm: 'аскорбилпальмитат', metabisulfite: 'метабисульфит', edta: 'ЭДТА', vitc: 'аскорбиновая кислота', citric: 'лимонная кислота', bht: 'BHT', bha: 'BHA',
  rosemary: 'экстракт розмарина', cysteine: 'цистеин', thiosulfate: 'тиосульфат' };
const NI_SOLV_N = { water: 'вода', ethanol: 'этанол', pg: 'пропиленгликоль', glycerin: 'глицерин', oil: 'масла', dmso: 'ДМСО', peg: 'ПЭГ', ps80: 'полисорбат', org: 'органические растворители' };
const NI_PA_RX = { nabenz: /бензоат|бензойн/i, ksorb: /сорбат|сорбинов/i, mparaben: /парабен|нипагин/i, benzylalc: /бензилов\S* спирт/i,
  metabisulfite: /сульфит/i, ascpalm: /аскорбил\s*пальмитат/i, tocoph: /токоферол/i, edta: /эдта|эдетат|edta/i };
function niOf(m) { return m && m.ni ? m.ni : null; }
// Добавить к уже найденной (литературной) проблеме пометку «данные аптеки» или создать новую
function niAdd(ctx, match, f) {
  const old = ctx.findings.find(match);
  if (old) {
    if (!(old.src || []).includes('ni')) old.src = (old.src || ['lit']).concat('ni');
    old.sev = Math.max(old.sev, f.sev);
    old.mech += ' По данным аптеки: ' + f.ni + '.';
    return old;
  }
  return ctx.add(Object.assign({ src: ['ni'], cat: 'stab' }, f, { mech: f.mech || ('По данным аптеки: ' + f.ni + '.') }));
}
function niChecks(ctx) {
  const { rows, actives, x, form, F, pH, fr, hydroEth, findings } = ctx;
  const nm = id => BY[id] ? BY[id].ru : id;
  const pa = rows.filter(r => NI_PRES.includes(r.id) || NI_ANTI.includes(r.id));
  const ph = actives.map(r => niOf(r.m) && niOf(r.m).ph_ni).filter(Boolean);
  if (ph.length) { ctx.phInfo.niLo = Math.max(...ph.map(p => p[0])); ctx.phInfo.niHi = Math.min(...ph.map(p => p[1])); }
  actives.forEach(r => {
    const m = r.m, ni = niOf(m); if (!ni) return;
    const I = [r.id], who = m.ru;
    // pH
    if (x.pc === 'W' && pH != null && ni.ph_ni) {
      const [lo, hi] = ni.ph_ni, d = pH < lo ? lo - pH : pH > hi ? pH - hi : 0;
      if (d > 0) niAdd(ctx, f => f.rule === 'ph_window' && f.ids[0] === r.id, { sev: d >= 1 ? 3 : d >= 0.5 ? 2 : 1, type: 'pH вне окна стабильности', ids: I, item: r.id, rule: 'ni_ph',
        t: `${who}: pH ${fmt(pH, 1)} вне диапазона аптеки ${fmt(lo, 1)}–${fmt(hi, 1)}`,
        ni: `pH стабильности ${fmt(lo, 1)}–${fmt(hi, 1)}${ni.ph_tx && ni.ph_tx.length > 12 ? ' (' + ni.ph_tx.replace(/\.$/, '') + ')' : ''}`,
        mech: `Расчётный pH рецептуры ${fmt(pH, 1)} ${pH < lo ? 'ниже' : 'выше'} диапазона стабильности по карточке аптеки (${fmt(lo, 1)}–${fmt(hi, 1)}) на ${fmt(d, 1)} ед.${ni.ph_tx ? ' Карточка: «' + ni.ph_tx.replace(/\.$/, '') + '».' : ''}`,
        act: `Буферировать до pH ${fmt(lo, 1)}–${fmt(hi, 1)} (цитратный или фосфатный буфер) или вынести вещество в отдельную форму.` });
    }
    // температура изготовления
    if (x.heat) {
      const lim = ni.heat_ni;
      if (lim && x.heat > lim) {
        const over = x.heat - lim;
        niAdd(ctx, f => f.item === r.id && (f.type === 'Нагрев' || (f.type === 'Липосомы' && /нагрев/.test(f.t)) || f.type === 'Жизнеспособность'),
          { sev: over >= 15 ? 3 : over >= 5 ? 2 : 1, type: 'Нагрев', ids: I, item: r.id, rule: 'ni_heat',
            t: `${who}: нагрев ${x.heat} °C выше допустимых ${lim} °C`,
            ni: `допустимо не выше ${lim} °C («${(ni.heat_tx || '').replace(/\.$/, '')}»)`,
            mech: `Основа (${x.baseName}) при изготовлении нагревается до ≈ ${x.heat} °C, а по карточке аптеки вещество выдерживает не выше ${lim} °C. Карточка: «${(ni.heat_tx || '').replace(/\.$/, '')}».`,
            act: 'Вводить в основу при остывании до допустимой температуры, в последнюю очередь; либо форма без нагрева.' });
      } else if (!lim && ni.heat_q === 'high' && x.heat >= 40) {
        niAdd(ctx, f => f.item === r.id && f.type === 'Нагрев', { sev: 2, type: 'Нагрев', ids: I, item: r.id, rule: 'ni_heat',
          t: `${who}: термолабильно по данным аптеки`, ni: `термолабильность «${(ni.heat_tx || '').replace(/\.$/, '')}»`,
          mech: `Основа нагревается до ≈ ${x.heat} °C; в карточке аптеки термолабильность: «${(ni.heat_tx || '').replace(/\.$/, '')}».`,
          act: 'Вводить при минимальной температуре в последнюю очередь или выбрать форму без нагрева.' });
      }
    }
    // растворитель формы
    // в эмульсионных основах (крем, трансдермальный крем Pentravan) липофильное вещество распределяется в масляную фазу — вода не единственный растворитель
    const solvs = x.pc === 'W' && x.V && F.phase !== 'emulsion' ? ['water'] : (x.pc === 'L' && (form === 'oildr' || form === 'oint') ? ['oil'] : []);
    if (fr) { if ((fr.ethanol || 0) > 0 || hydroEth > 0) solvs.push('ethanol'); if ((fr.pg || 0) > 0) solvs.push('pg'); if ((fr.glycerin || 0) > 0) solvs.push('glycerin'); }
    const ok = ni.solvents || [], bad = ni.insol || [];
    solvs.forEach(sv => {
      const main = sv === solvs[0];
      if (bad.includes(sv) && !ok.includes(sv)) {
        niAdd(ctx, f => f.item === r.id && (sv === 'ethanol' ? /этанол/.test(f.t) : f.type === 'Фаза'), { sev: main ? (F.liquid ? 3 : 2) : 2, type: 'Растворитель', cat: 'phys', ids: I, item: r.id, rule: 'ni_solv',
          t: `${who}: ${main ? 'не растворяется в основе формы' : 'плохо переносит сорастворитель'} (${NI_SOLV_N[sv]})`,
          ni: `${NI_SOLV_N[sv]} — среди нерастворяющих/разрушающих сред («${(ni.insol_tx || '').replace(/\.$/, '')}»)`,
          mech: `Растворитель формы — ${NI_SOLV_N[sv]}; по карточке аптеки: «${(ni.insol_tx || '').replace(/\.$/, '')}».${ok.length ? ' Рекомендованные растворители: ' + ok.map(k => NI_SOLV_N[k]).join(', ') + '.' : ''}`,
          act: ok.length ? `Форма на основе: ${ok.map(k => NI_SOLV_N[k]).join(', ')}; либо сухая форма.` : 'Сухая форма или суспензия.' });
      }
    });
    if (solvs.includes('ethanol') && ni.incompat_ni && /спирт|этанол/i.test(ni.incompat_ni) && !(bad.includes('ethanol') && !ok.includes('ethanol'))) {
      niAdd(ctx, f => f.item === r.id && (f.type === 'Липосомы' && /этанол/.test(f.t) || /этанол/.test(f.t)), { sev: m.T.has('liposome') || m.kind === 'enzyme' || m.kind === 'peptide' || m.kind === 'probiotic' ? 3 : 2,
        type: 'Растворитель', cat: 'phys', ids: I, item: r.id, rule: 'ni_ethanol', t: `${who}: спирт в составе`,
        ni: `несовместимости: «${ni.incompat_ni.replace(/\.$/, '')}»`,
        mech: `В форме есть этанол; карточка аптеки относит спирт к несовместимостям: «${ni.incompat_ni.replace(/\.$/, '')}».`, act: 'Форма без спирта.' });
    }
    // предельная концентрация
    const cm = ni.conc_max;
    if (cm && cm.v && r.conc != null && solvs.length && cm.solv === solvs[0] && r.conc > cm.v * 1.0001) {
      const k = r.conc / cm.v;
      niAdd(ctx, f => f.item === r.id && f.type === 'Фаза' && f.rule !== 'ni_solv', { sev: m.kind === 'formulation' ? 1 : (F.liquid ? (k > 2 ? 3 : 2) : 1), type: 'Концентрация', cat: 'phys', ids: I, item: r.id, rule: 'ni_conc',
        t: `${who}: ${fmt(r.conc, 1)} мг/мл выше предела аптеки ${fmt(cm.v, 1)} мг/мл`,
        ni: `предельная концентрация «${cm.tx.replace(/\.$/, '')}»`,
        mech: `Концентрация в ${NI_SOLV_N[cm.solv]} ${fmt(r.conc, 1)} мг/мл в ${fmt(k, 1)} раза выше предельной по карточке аптеки: «${cm.tx.replace(/\.$/, '')}».`,
        act: 'Увеличить объём на приём, снизить дозу в единице или перейти на суспензию / сухую форму.' });
    }
    // активные вещества состава, которые аптека относит к несовместимостям (например, аскорбиновая кислота для меди)
    actives.forEach(o => {
      if (o.id === r.id || !(ni.pa_bad || []).includes(o.id)) return;
      const ex = findings.find(f => f.cat !== 'syn' && f.ids.includes(r.id) && f.ids.includes(o.id) && !/^ph_/.test(f.rule));
      const why = `в карточке аптеки ${nm(o.id).toLowerCase()} указан среди несовместимостей: «${(ni.incompat_ni || '').replace(/\.$/, '')}»`;
      if (ex) { if (!ex.src || !ex.src.includes('ni')) { ex.src = (ex.src || ['lit']).concat('ni'); ex.mech += ' По данным аптеки: ' + why + '.'; } }
      else ctx.add({ sev: 2, cat: 'chem', src: ['ni'], type: 'Несовместимость', ids: [r.id, o.id], pairs: [[r.id, o.id]], item: r.id, rule: 'ni_incompat',
        t: `${who} + ${nm(o.id)}`, mech: why[0].toUpperCase() + why.slice(1) + '.', act: 'Развести по разным формам или снизить концентрацию; проверить пробной партией.' });
    });
    // консерванты и антиоксиданты состава
    pa.forEach(e => {
      const isP = NI_PRES.includes(e.id), list = (isP ? ni.preserv_ok : ni.antiox_ok) || [];
      const badPA = (ni.pa_bad || []).includes(e.id) || (ni.incompat_ni && NI_PA_RX[e.id] && NI_PA_RX[e.id].test(ni.incompat_ni));
      const cond = badPA && list.includes(e.id);   // в карточке и среди совместимых, и среди ограничений — совместим с условием
      if (badPA) ctx.add({ sev: cond ? 2 : 3, cat: 'chem', src: ['ni'], type: isP ? 'Консервант' : 'Антиоксидант', ids: [r.id, e.id], pairs: [[r.id, e.id]], item: r.id, rule: 'ni_pa_bad',
        t: `${who} + ${nm(e.id)}${cond ? ': совместим с ограничением' : ''}`, mech: `В карточке аптеки ${nm(e.id).toLowerCase()} ${cond ? 'назван среди совместимых, но с ограничением' : 'указан среди несовместимостей'}: «${(ni.incompat_ni || '').replace(/\.$/, '')}».`,
        act: `Заменить на совместимый${list.length ? ': ' + list.map(k => NI_PA_N[k] || k).join(', ') : ''}.` });
      else if (!list.includes(e.id) && !ni.pa_any && list.length) ctx.add({ sev: 1, cat: 'form', src: ['ni'], type: isP ? 'Консервант' : 'Антиоксидант', ids: [r.id, e.id], item: r.id, rule: 'ni_pa_other',
        t: `${who}: ${nm(e.id).toLowerCase()} не указан аптекой`, mech: `В карточке аптеки для этого вещества ${isP ? 'консерванты' : 'антиоксиданты'}: ${list.map(k => NI_PA_N[k] || k).join(', ')}. ${nm(e.id)} среди них нет — совместимость не подтверждена.`,
        act: `Предпочесть ${list.filter(k => (isP ? NI_PRES : NI_ANTI).includes(k)).map(k => NI_PA_N[k]).join(', ') || list.map(k => NI_PA_N[k] || k).join(', ')} или проверить пробной партией.` });
    });
  });
}
