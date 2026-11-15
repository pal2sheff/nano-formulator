/* ===== Интерфейс ===== */
'use strict';
const $ = s => document.querySelector(s);
const UNITS = ['мг', 'мкг', 'г', 'МЕ', '%'];
FORM_DEFAULTS.oildr.oil = FORM_DEFAULTS.oildr.oil || 'mct';

const PARAMS = {
  shell: { l: 'Оболочка', o: { hpmc: 'ГПМЦ (растительная)', gelatin: 'Желатиновая' } },
  size: { l: 'Размер капсулы', o: { auto: 'Подобрать', '000': '№000', '00': '№00', '0': '№0', '1': '№1', '2': '№2', '3': '№3', '4': '№4' } },
  filler: { l: 'Наполнитель', o: { mcc: 'МКЦ', lactose: 'Лактоза', rice: 'Рисовая мука' } },
  ndose: { l: 'Единиц в упаковке', u: 'шт' },
  water: { l: 'Вода для растворения', u: 'мл' },
  vdose: { l: 'Объём на приём', u: 'мл', step: 0.05 },
  vtot: { l: 'Объём флакона', u: 'мл' },
  cosolv: { l: 'Сорастворитель', o: { none: 'Нет', glycerin: 'Глицерин', pg: 'Пропиленгликоль', peg400: 'ПЭГ 400', ethanol: 'Этанол' } },
  cpct: { l: 'Доля сорастворителя', u: '% об.' },
  eth: { l: 'Этанол', u: '% об.' },
  sl: { l: 'Приём', o: { 1: 'Держать под языком', 0: 'Проглатывать' } },
  base: { l: 'Основа', o: f => f === 'troche' ? { peg: 'ПЭГ 1450/3350', gelatin: 'Глицерин-желатиновая' } : { fat: 'Твёрдый жир (Witepsol)', peg: 'ПЭГ 1450/3350' } },
  mass: { l: 'Масса единицы / дозы', u: 'г', step: 0.1 },
  area: { l: 'Площадь нанесения', u: 'см²' },
  mtot: { l: 'Масса упаковки', u: 'г' },
  gelling: { l: 'Гелеобразователь', o: { hec: 'ГЭЦ', carbomer: 'Карбомер 940', hpmc: 'ГПМЦ' } },
  oil: { l: 'Масло-основа', o: { mct: 'MCT', olive: 'Оливковое' } }
};
const ROUTE_N = { oral: 'внутрь', oral_sl: 'внутрь / под язык', sl: 'сублингвально / трансбуккально', nasal: 'интраназально', topical: 'наружно', td: 'трансдермально', rectal: 'ректально', vaginal: 'вагинально' };

const EXAMPLES = [
  { n: 'НАДН + витамин C', form: 'drops', P: {}, items: [['nadh', 10], ['vitc', 100]] },
  { n: 'Медь + NAC + витамин C', form: 'drops', P: { vdose: 2 }, items: [['cubis', 2], ['nac', 100], ['vitc', 100]] },
  { n: 'L-лизин на лактозе', form: 'caps', P: { filler: 'lactose' }, items: [['lys', 500]] },
  { n: 'Тадалафил + L-аргинин', form: 'troche', P: {}, items: [['tadalafil', 5], ['arg', 500]] },
  { n: 'Синефрин + мелатонин', form: 'caps', P: {}, items: [['synephrine', 30], ['melatonin', 3]] },
  { n: 'Куркумин + пиперин', form: 'caps', P: {}, items: [['curcumin', 500], ['piperine', 10]] },
  { n: 'Железо + витамин C + кальций', form: 'caps', P: {}, items: [['fefum', 60], ['vitc', 200], ['cacit', 300]] },
  { n: 'D3 + K2 + токоферол', form: 'oildr', P: {}, items: [['vitd3', 2000, 'МЕ'], ['vitk2', 100, 'мкг'], ['tocoph', 1]] },
  { n: 'НМН + TMG + ресвератрол', form: 'caps', P: {}, items: [['nmn', 250], ['tmg', 250], ['resv', 150]] },
  { n: 'Окситоцин + NaCl', form: 'nasal', P: {}, items: [['oxytocin', 24, 'МЕ'], ['nacl', 1.6]] },
  { n: 'Прогестерон', form: 'td', P: {}, items: [['prog', 50]] },
  { n: 'Берберин в карбомерном геле', form: 'gel', P: { gelling: 'carbomer' }, items: [['berberine', 20]] }
];

/* ---------- Иконки ---------- */
const I = {
  crit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5.3 1.5h5.4l3.8 3.8v5.4l-3.8 3.8H5.3l-3.8-3.8V5.3z"/><path d="m5.8 5.8 4.4 4.4m0-4.4-4.4 4.4"/></svg>',
  major: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 1.8 15 14H1z" stroke-linejoin="round"/><path d="M8 6.3v3.5M8 11.6v.1"/></svg>',
  mod: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.3"/><path d="M8 4.6v4M8 10.9v.1"/></svg>',
  minor: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.3"/><path d="M8 7.2v4M8 4.9v.1"/></svg>',
  syn: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.3"/><path d="M8 5v6M5 8h6"/></svg>',
  ok: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.3"/><path d="m5.2 8.2 2 2 3.7-4"/></svg>',
  copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>',
  sun: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3"/></svg>',
  moon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1z"/></svg>',
  auto: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6"/><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3v10M3 8h10"/></svg>'
};
const FI = {
  caps: '<rect x="2" y="6" width="14" height="6" rx="3"/><path d="M9 6v6"/>',
  powder: '<path d="M4 15h10l-1.5-7h-7z"/><path d="M6 8c0-2 1.5-3 3-3s3 1 3 3"/>',
  drops: '<path d="M9 2.5c2.5 3.2 4 5.4 4 7.5a4 4 0 0 1-8 0c0-2.1 1.5-4.3 4-7.5z"/>',
  oil: '<path d="M9 2.5c2.5 3.2 4 5.4 4 7.5a4 4 0 0 1-8 0c0-2.1 1.5-4.3 4-7.5z"/><path d="M7 11a2 2 0 0 0 2 2"/>',
  spray: '<rect x="6" y="7" width="7" height="9" rx="1.5"/><path d="M8 7V4h3v3M11 4h2M3 3.5l1.5.5M3 6l1.5-.3M3.5 1.5 5 2.5"/>',
  troche: '<rect x="3" y="5" width="12" height="9" rx="2"/><path d="M3 9h12"/>',
  nasal: '<path d="M7 16V9l2-6 2 6v7"/><path d="M7 11h4"/>',
  cream: '<rect x="4" y="8" width="10" height="8" rx="1.5"/><path d="M6 8V5.5h6V8M7 3h4"/>',
  td: '<rect x="2.5" y="4" width="13" height="10" rx="2"/><circle cx="9" cy="9" r="2"/>',
  gel: '<path d="M5 3h8v4l-1 1v7H6V8L5 7z"/>',
  oint: '<path d="M3 9h10l2 2-2 2H3z"/><path d="M5 9V6h6v3"/>',
  supp: '<path d="M9 2c2.5 2 3.5 5 3.5 8v5h-7v-5c0-3 1-6 3.5-8z"/>'
};
const fico = k => `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${FI[k] || FI.caps}</svg>`;
function sevBadge(s, label) { const S = s === 'ok' ? { k: 'ok', t: 'Совместимо' } : SEV[s]; return `<span class="sev ${S.k}">${I[S.k]}${label || S.t}</span>`; }

/* ---------- Состояние ---------- */
let S = { form: 'caps', P: Object.assign({}, FORM_DEFAULTS.caps), items: [] };
let FILT = 'all', TAB = 'recipe', CUR_MOL = null, LAST = null, LAST_SPLIT = null;
function save() { try { localStorage.setItem('cc_recipe', JSON.stringify(S)); } catch (e) {} }
function restore() { try { const s = JSON.parse(localStorage.getItem('cc_recipe') || 'null'); if (s && FORMS[s.form] && Array.isArray(s.items)) { S = s; S.items = S.items.filter(i => BY[i.id]); S.P = Object.assign({}, FORM_DEFAULTS[S.form], S.P); } } catch (e) {} }

/* ---------- Поиск ---------- */
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
LIST.forEach(m => { m._q = norm(m.ru + ' ' + m.en + ' ' + m.id + ' ' + (m.cat || '')); m._r = norm(m.ru); m._e = norm(m.en); });
const tokens = s => s.split(/[^a-zа-я0-9]+/i).filter(Boolean);
LIST.forEach(m => { m._t = tokens(m._q); });
const CATS = [...new Set(DB.map(m => m.cat))].sort((a, b) => (a === 'Вспомогательные вещества') - (b === 'Вспомогательные вещества'));
const BYCAT = LIST.slice().sort((a, b) => CATS.indexOf(a.cat) - CATS.indexOf(b.cat) || a.ru.localeCompare(b.ru, 'ru'));
// поиск: каждое слово запроса — начало какого-либо слова названия (рус/англ); затем — вхождение внутри слова
function searchMol(q, cat) {
  q = norm(q).trim();
  let base = cat ? LIST.filter(m => m.cat === cat) : LIST;
  if (!q) return cat ? base : BYCAT;
  const words = tokens(q);
  if (!words.length) return base;
  const score = m => {
    if (m._r.startsWith(q) || m._e.startsWith(q)) return 0;
    if (words.every(w => m._t.some(t => t.startsWith(w)))) return 1;
    if (words.every(w => m._q.includes(w))) return 2;
    return -1;
  };
  let r = base.map(m => [m, score(m)]).filter(a => a[1] >= 0);
  // короткий запрос (до 3 букв) — только совпадения с начала слова, если они есть
  if (words.every(w => w.length <= 3) && r.some(a => a[1] <= 1)) r = r.filter(a => a[1] <= 1);
  return r
    .sort((a, b) => a[1] - b[1] || (a[0].kind === 'excipient') - (b[0].kind === 'excipient') || a[0].ru.localeCompare(b[0].ru, 'ru'))
    .map(a => a[0]);
}
function hl(text, q) {
  const words = tokens(norm(q)); let h = esc(text);
  if (!words.length) return h;
  const re = new RegExp('(^|[^a-zа-яё0-9])(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]')).join('|') + ')', 'gi');
  return h.replace(re, '$1<mark>$2</mark>');
}
// выпадающий выбор: список по категориям + поиск по первым буквам
function bindSearch(wrap, onPick, opt = {}) {
  const inp = wrap.querySelector('input'), dd = wrap.querySelector('.dd'), tg = wrap.querySelector('.dd-toggle');
  let sel = 0, list = [], cat = '', open = false;
  const isAdded = opt.isAdded || (() => false);
  const close = () => { open = false; dd.hidden = true; tg && tg.setAttribute('aria-expanded', 'false'); };
  const draw = () => {
    const q = inp.value.trim();
    list = searchMol(q, cat);
    sel = Math.max(0, Math.min(sel, list.length - 1));
    let h = `<div class="dd-cats">${['', ...CATS].map(c => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === cat}">${c ? esc(c) : 'Все'}</button>`).join('')}</div>`;
    h += `<div class="dd-hint">${q ? `Найдено: ${list.length}` : (cat ? esc(cat) + ': ' + list.length : 'Все вещества: ' + list.length + ' · начните вводить первые 3 буквы названия')}${opt.multi ? ' · можно выбрать несколько' : ''}</div>`;
    if (!list.length) h += '<div class="empty" style="border:0">Не найдено. Попробуйте английское название или другую категорию</div>';
    let lastCat = null;
    h += '<div class="dd-list">' + list.map((m, i) => {
      let g = '';
      if (!q && !cat && m.cat !== lastCat) { g = `<div class="dh">${esc(m.cat)}</div>`; lastCat = m.cat; }
      const ad = isAdded(m.id);
      return g + `<button type="button" data-i="${i}" class="${i === sel ? 'on' : ''}${ad ? ' added' : ''}"><span>${ad ? '<span class="ck">✓</span>' : ''}${hl(m.ru, q)} <span class="en">${hl(m.en, q)}</span></span><span class="cat">${ad ? 'в составе' : esc(q || cat ? m.cat : '')}</span></button>`;
    }).join('') + '</div>';
    if (opt.multi) h += `<div class="dd-foot"><button type="button" class="btn" data-done>Готово</button></div>`;
    const sc = dd.querySelector('.dd-list')?.scrollTop || 0;
    dd.innerHTML = h; dd.hidden = false; open = true; tg && tg.setAttribute('aria-expanded', 'true');
    if (opt.keepScroll) { const l = dd.querySelector('.dd-list'); if (l) l.scrollTop = sc; }
  };
  const pick = (m, viaKey) => {
    if (!m) return;
    onPick(m, viaKey);
    if (opt.multi && !viaKey) { opt.keepScroll = true; draw(); opt.keepScroll = false; }
    else { inp.value = ''; close(); }
  };
  inp.addEventListener('input', () => { sel = 0; if (inp.value.trim()) cat = ''; draw(); });
  inp.addEventListener('focus', draw);
  inp.addEventListener('click', () => { if (!open) draw(); });
  tg && tg.addEventListener('click', () => { if (open) close(); else { sel = 0; draw(); } });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open) draw();
      sel = e.key === 'ArrowDown' ? Math.min(sel + 1, list.length - 1) : Math.max(sel - 1, 0);
      dd.querySelectorAll('.dd-list button').forEach(b => b.classList.toggle('on', +b.dataset.i === sel));
      dd.querySelector('.dd-list .on')?.scrollIntoView({ block: 'nearest' }); e.preventDefault();
    } else if (e.key === 'Enter') { if (open && list[sel]) pick(list[sel], true); e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
  dd.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  dd.addEventListener('click', e => {
    const c = e.target.closest('[data-cat]'); if (c) { cat = c.dataset.cat; sel = 0; draw(); dd.querySelector('.dd-list').scrollTop = 0; return; }
    if (e.target.closest('[data-done]')) { inp.value = ''; cat = ''; close(); return; }
    const b = e.target.closest('button[data-i]'); if (b) pick(list[+b.dataset.i], false);
  });
  document.addEventListener('mousedown', e => { if (open && !wrap.contains(e.target)) close(); });
  document.addEventListener('touchstart', e => { if (open && !wrap.contains(e.target)) close(); }, { passive: true });
}

/* ---------- Ввод рецептуры ---------- */
function renderForms() {
  $('#forms').innerHTML = Object.entries(FORMS).map(([k, F]) => `<button type="button" class="fbtn" data-f="${k}" aria-pressed="${k === S.form}">${fico(F.ico)}<span>${esc(F.n)}</span></button>`).join('');
  $('#formRoute').textContent = ROUTE_N[FORMS[S.form].route] || '';
  const keys = Object.keys(FORM_DEFAULTS[S.form]).filter(k => !(k === 'cpct' && (S.P.cosolv || 'none') === 'none'));
  $('#params').innerHTML = keys.map(k => {
    const d = PARAMS[k]; if (!d) return '';
    const v = S.P[k] ?? FORM_DEFAULTS[S.form][k];
    if (d.o) {
      const o = typeof d.o === 'function' ? d.o(S.form) : d.o;
      return `<div class="fld"><label for="p_${k}">${d.l}</label><div class="in"><select id="p_${k}" data-p="${k}">${Object.entries(o).map(([a, b]) => `<option value="${a}"${String(a) === String(v) ? ' selected' : ''}>${b}</option>`).join('')}</select></div></div>`;
    }
    return `<div class="fld"><label for="p_${k}">${d.l}</label><div class="in"><input id="p_${k}" data-p="${k}" type="number" inputmode="decimal" min="0" step="${d.step || 'any'}" value="${v}"><span class="u">${d.u || ''}</span></div></div>`;
  }).join('');
}
function renderItems(res) {
  const st = {}; if (res) res.rows.forEach(r => { st[r.k] = r; });
  $('#itemCount').textContent = S.items.length ? S.items.length + ' ' + plural(S.items.length, 'вещество', 'вещества', 'веществ') : '';
  $('#items').innerHTML = S.items.length ? S.items.map((it, k) => {
    const m = BY[it.id]; const r = st[k];
    const meta = [];
    if (r && r.status) meta.push(`<span class="tag ${r.status === 'раствор' ? 'sol' : r.status === 'взвесь' ? 'susp' : ''}">${r.status}</span>`);
    if (r && r.unit !== 'мг' && r.mg) meta.push(`<span class="mono">${fmtMg(r.mg)}</span>`);
    if (m.kind === 'excipient') meta.push('<span>вспомогательное</span>');
    else meta.push(`<span>${esc(m.cat)}</span>`);
    return `<div class="item${m.kind === 'excipient' ? ' ex' : ''}" data-k="${k}">
      <div class="nm"><button type="button" data-mol="${m.id}" title="Карточка вещества">${esc(m.ru)}</button><div class="meta">${meta.join('')}</div></div>
      <input type="number" inputmode="decimal" min="0" step="any" data-a="${k}" value="${it.amt ?? ''}" placeholder="кол-во" aria-label="Количество">
      <select data-u="${k}" aria-label="Единица">${UNITS.map(u => `<option${u === it.unit ? ' selected' : ''}>${u}</option>`).join('')}</select>
      <button type="button" class="rm" data-rm="${k}" aria-label="Удалить" title="Удалить">✕</button></div>`;
  }).join('') : '<div class="empty">Добавьте вещества поиском или загрузите пример</div>';
  const x = res ? res.x : formContext(S.form, S.P);
  $('#implicit').innerHTML = x.implicit.length ? 'Основа и вспомогательные (учитываются в проверке): ' + x.implicit.map(id => `<a href="#card/${id}">${esc(nm(id))}</a>`).join(', ') : '';
}
function plural(n, a, b, c) { const d = n % 10, e = n % 100; return d === 1 && e !== 11 ? a : d >= 2 && d <= 4 && (e < 10 || e >= 20) ? b : c; }
function addItem(m, focusAmt = true) {
  if (S.items.some(i => i.id === m.id)) { toast(m.ru + ' уже в составе'); return; }
  const unit = (m.id === 'vitd3') ? 'МЕ' : 'мг';
  S.items.push({ id: m.id, amt: '', unit });
  update();
  if (focusAmt) setTimeout(() => { const inp = document.querySelector(`[data-a="${S.items.length - 1}"]`); inp && inp.focus(); }, 0);
}
function setForm(f) { S.form = f; S.P = Object.assign({}, FORM_DEFAULTS[f]); update(true); }
function loadExample(e) {
  S = { form: e.form, P: Object.assign({}, FORM_DEFAULTS[e.form], e.P), items: e.items.map(([id, amt, unit]) => ({ id, amt, unit: unit || 'мг' })) };
  FILT = 'all'; update(true);
  if (window.innerWidth < 960) $('#out').scrollIntoView({ behavior: 'smooth' });
}

/* ---------- Анализ и вывод ---------- */
function update(full) {
  save();
  if (full) renderForms();
  const res = analyze(S);
  LAST = res;
  LAST_SPLIT = suggestSplit(res);
  renderItems(res);
  renderOut(res, LAST_SPLIT);
}
function molLinks(ids) { return [...new Set(ids)].map(id => `<button type="button" data-mol="${id}">${esc(nm(id))}</button>`).join(', '); }
function findingHTML(f) {
  const k = f.cat === 'syn' ? 'syn' : SEV[f.sev].k;
  return `<div class="fnd ${k}">
    <div class="fnd-h">${f.cat === 'syn' ? sevBadge(0) : sevBadge(f.sev)}<span class="ty">${CAT[f.cat]} · ${esc(f.type)}</span></div>
    <div class="fnd-t">${esc(f.t)}</div>
    <p>${esc(f.mech)}</p>
    ${f.act ? `<div class="act"><b>${f.cat === 'syn' ? 'Применение' : 'Что сделать'}:</b> ${esc(f.act)}</div>` : ''}
    ${f.ids.length ? `<div class="small muted" style="margin-top:6px">Вещества: <span class="fnd-t" style="font-weight:400">${molLinks(f.ids)}</span></div>` : ''}
  </div>`;
}
function renderOut(res, split) {
  const out = $('#out');
  if (!S.items.length) {
    out.innerHTML = `<div class="card verdict"><div class="v-title"><span class="big" style="color:var(--text)">Рецептура пуста</span></div><div class="v-desc">Выберите лекарственную форму, добавьте вещества и укажите количество на приём. Анализ пересчитывается при каждом изменении. Можно начать с готового примера слева.</div></div>` + methodTeaser();
    return;
  }
  const s = res.summary, x = res.x, F = FORMS[S.form];
  const probs = res.findings.filter(f => f.cat !== 'syn');
  const syn = res.findings.filter(f => f.cat === 'syn');
  const cnt = [4, 3, 2, 1].map(v => [v, probs.filter(f => f.sev === v).length]).filter(a => a[1]);
  const vk = res.verdict.k;

  // сводка
  const stats = [];
  if (s.pH != null) stats.push(['pH смеси', fmt(s.pH, 1), x.pc === 'W' ? (F.phase === 'hydroalc' ? 'ориентировочно (спирт)' : 'в водной фазе ' + fmt(x.V, 2) + ' мл') : 'в ' + fmt(x.V, 0) + ' мл воды']);
  else if (x.pc === 'W') stats.push(['pH смеси', '—', 'нет ионогенных веществ: задаётся буфером']);
  if (res.phInfo.lo != null) stats.push(['Общее окно pH', res.phInfo.lo <= res.phInfo.hi ? fmt(res.phInfo.lo, 1) + '–' + fmt(res.phInfo.hi, 1) : 'нет', res.phInfo.lo <= res.phInfo.hi ? 'пересечение окон стабильности' : 'окна не пересекаются']);
  if (s.osm != null) stats.push(['Осмоляльность', fmt(s.osm, 0), 'мОсм/кг, норма 250–350']);
  if (s.caps) stats.push(['Капсулы на приём', `${s.caps.n} × №${s.caps.size}`, `${fmt(s.caps.vol, 2)} мл смеси; всего ${s.caps.total} шт`]);
  if (s.load != null) stats.push([S.form === 'troche' ? 'Загрузка троше' : 'Загрузка свечи', fmt(s.load, 0) + '%', `${fmtMg(s.totalMg)} в ${fmt(+S.P.mass, 2)} г`]);
  if (s.wv != null) stats.push(['Концентрация', fmt(s.wv, 1) + '%', `м/о; ${fmtMg(s.totalMg)} в ${fmt(+S.P.vdose, 2)} мл`]);
  if (x.heat) stats.push(['Нагрев основы', '≈ ' + x.heat + ' °C', x.baseName]);
  if (!s.caps && s.load == null && s.wv == null) stats.push(['Масса веществ', fmtMg(s.totalMg), 'на приём']);
  stats.push(['Фаза', { W: 'водная', D: 'сухая', M: 'расплав', L: 'липидная' }[x.pc], F.n.toLowerCase()]);

  let h = `<div class="card verdict ${vk}">
    <div class="v-top"><div class="v-title">${I[vk].replace('<svg ', '<svg class="vi" ')}<span class="big">${res.verdict.t}</span></div>
      <button class="btn primary" id="copyBtn" type="button">${I.copy}Копировать заключение</button></div>
    <div class="v-desc">${res.verdict.d}</div>
    <div class="counts">${cnt.map(([v, n]) => sevBadge(v, SEV[v].t + ' · ' + n)).join('')}${syn.length ? sevBadge(0, 'Синергия · ' + syn.length) : ''}</div>
    <div class="stats">${stats.map(([k, v, d]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${esc(d || '')}</div></div>`).join('')}</div>
    <div class="est">Оценочный расчёт по моделям и справочным данным; см. раздел «Методика».</div>
  </div>`;

  // находки
  const cats = ['all', 'chem', 'phys', 'stab', 'pharm', 'form'];
  const catN = { all: 'Все', chem: 'Химические', phys: 'Физические', stab: 'Стабильность', pharm: 'Фармакологические', form: 'Форма' };
  const fl = probs.filter(f => FILT === 'all' || f.cat === FILT);
  const main = fl.filter(f => f.sev >= 2), minor = fl.filter(f => f.sev < 2);
  h += `<div class="card"><div class="card-h"><h2>Находки</h2><div class="filters">${cats.map(c => { const n = c === 'all' ? probs.length : probs.filter(f => f.cat === c).length; return n || c === 'all' ? `<button type="button" class="chip" data-filt="${c}" aria-pressed="${FILT === c}">${catN[c]}<span class="c">${n}</span></button>` : ''; }).join('')}</div></div>
    <div class="flist">${main.map(findingHTML).join('') || (fl.length ? '' : '<div class="empty">Проблем не найдено</div>')}
    ${minor.length ? `<details class="more"${main.length ? '' : ' open'}><summary>Учесть: ${minor.length} ${plural(minor.length, 'замечание', 'замечания', 'замечаний')}</summary><div class="flist" style="margin-top:6px">${minor.map(findingHTML).join('')}</div></details>` : ''}</div></div>`;

  if (syn.length) h += `<div class="card syn-list"><div class="card-h"><h2>Синергия</h2><span class="sub">полезные сочетания</span></div><div class="flist">${syn.map(findingHTML).join('')}</div></div>`;

  // разделение
  if (split && split.groups.length > 1) {
    h += `<div class="card"><div class="card-h"><h2>Разделение на совместимые группы</h2><span class="sub">раскраска графа конфликтов · ${split.edges.length} ${plural(split.edges.length, 'конфликт', 'конфликта', 'конфликтов')}</span></div>
      <div class="groups">${split.groups.map((g, i) => `<div class="grp"><div class="gh"><b>Группа ${i + 1}</b>${g.res ? sevBadge(g.res.maxSev || 'ok', g.res.verdict.t) : ''}</div>
      <div class="small"><span class="muted">Форма:</span> ${esc(FORMS[g.form].n)}${g.form !== S.form ? ' <span class="tag">подобрана</span>' : ''}</div>
      <ul>${g.ids.map(id => `<li>${esc(nm(id))}</li>`).join('')}</ul>
      <button type="button" class="btn" data-grp="${i}">Открыть как рецептуру</button></div>`).join('')}</div>
      <div class="small muted" style="margin-top:8px">Конфликтующие пары (химические/физические — «Серьёзно» и выше; фармакологические, требующие разного времени приёма) разнесены по разным группам. Для каждой группы форма подобрана из того же пути введения по наименьшему числу и тяжести проблем.</div></div>`;
  }

  // физико-химия
  h += physTable(res);
  // матрица
  h += matrixHTML(res);
  out.innerHTML = h;
}
function physTable(res) {
  const x = res.x, rows = res.rows;
  const pH = res.summary.pH;
  if (x.V || x.pc === 'L') {
    const oil = x.pc === 'L';
    return `<div class="card"><div class="card-h"><h2>Растворимость и pH</h2><span class="sub">${oil ? 'оценка растворимости в масле' : 'при pH ' + (pH != null ? fmt(pH, 1) : '—') + (Object.keys(x.fr).some(k => x.fr[k] > 0) ? ', с сорастворителями' : '')}</span></div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>Вещество</th><th class="num">На приём</th><th class="num">Конц., мг/${oil && S.form === 'oint' ? 'г' : 'мл'}</th><th class="num">Раств., мг/мл</th><th>Состояние</th>${oil ? '' : '<th class="num">Окно pH</th><th class="num">logD</th>'}</tr></thead><tbody>
    ${rows.map(r => {
      const win = r.m.ph && !(r.m.ph[0] <= 1 && r.m.ph[1] >= 13) ? fmt(r.m.ph[0], 1) + '–' + fmt(r.m.ph[1], 1) : '—';
      const wc = r.phOk === false ? 'badc' : r.phOk ? 'okc' : '';
      const ld = pH != null ? logD(r.m, pH) : null;
      return `<tr><td><a href="#card/${r.id}">${esc(r.m.ru)}</a></td><td class="num mono">${r.mg ? fmtMg(r.mg) : '—'}</td><td class="num mono">${fmt(r.conc, 2)}</td><td class="num mono">${r.S != null ? fmt(r.S, 2) : '—'}</td>
      <td>${r.status ? `<span class="tag ${r.status === 'раствор' ? 'sol' : r.status === 'взвесь' ? 'susp' : ''}">${r.status}${r.status === 'взвесь' && r.dissFrac != null ? ' · ' + fmt(r.dissFrac * 100, 0) + '%' : ''}</span>` : '—'}</td>
      ${oil ? '' : `<td class="num mono ${wc}">${win}</td><td class="num mono">${fmt(ld, 1)}</td>`}</tr>`;
    }).join('')}</tbody></table></div>
    <div class="est" style="margin-top:6px">Растворимость — оценка: pH-зависимая модель Хендерсона–Хассельбаха от собственной растворимости, log-линейная модель сорастворителей; для масла — общее уравнение растворимости. Процент — доля, перешедшая в раствор.</div></div>`;
  }
  return `<div class="card"><div class="card-h"><h2>Свойства компонентов</h2><span class="sub">сухая форма: pH и растворимость не определяют стабильность напрямую</span></div>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>Вещество</th><th class="num">На приём</th><th class="num">Объём, мл</th><th class="num">logP</th><th class="num">Окно pH</th><th>Окисл. · Гидр. · Нагрев · Свет · Влага</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td><a href="#card/${r.id}">${esc(r.m.ru)}</a></td><td class="num mono">${r.mg ? fmtMg(r.mg) : '—'}</td><td class="num mono">${r.mg ? fmt(r.mg / 1000 / bulkDensity(r.m), 2) : '—'}</td><td class="num mono">${fmt(r.m.logP, 1)}</td>
  <td class="num mono">${r.m.ph && !(r.m.ph[0] <= 1 && r.m.ph[1] >= 13) ? fmt(r.m.ph[0], 1) + '–' + fmt(r.m.ph[1], 1) : '—'}</td><td class="mono">${['ox', 'hy', 'he', 'li', 'mo'].map(k => r.m.S[k]).join(' · ')}</td></tr>`).join('')}</tbody></table></div>
  <div class="est" style="margin-top:6px">Устойчивость 0–3 (3 — наиболее чувствительно). Объём — по насыпной плотности.</div></div>`;
}
let TIPS = [];
function matrixHTML(res) {
  const M = pairMatrix(res); TIPS = [];
  const ids = M.ids;
  if (ids.length < 2) return '';
  const short = id => { const n = nm(id); return n.length > 26 ? n.slice(0, 25) + '…' : n; };
  const cellCls = c => !c ? '' : c.sev >= 0 ? SEV[c.sev].k : c.syn ? 'syn' : '';
  let h = `<div class="card"><div class="card-h"><h2>Матрица совместимости</h2><span class="sub">в форме «${esc(FORMS[S.form].n)}» · наведите на ячейку</span></div><div class="tbl-wrap"><table class="mx"><thead><tr><th></th>${ids.map(id => `<th title="${esc(nm(id))}"><div>${esc(short(id))}</div></th>`).join('')}</tr></thead><tbody>`;
  ids.forEach(a => {
    h += `<tr><th title="${esc(nm(a))}">${esc(short(a))}</th>`;
    ids.forEach(b => {
      if (a === b) {
        const d = M.diag[a]; const t = TIPS.push({ t: nm(a) + ' — пригодность для формы', list: d.list }) - 1;
        h += `<td class="self ${d.sev >= 2 ? SEV[d.sev].k : ''}" data-tip="${t}">${d.sev >= 2 ? `<span>${d.sev}</span>` : ''}</td>`;
        return;
      }
      const c = M.get(a, b); const t = TIPS.push({ t: nm(a) + ' + ' + nm(b), list: c ? c.list : [] }) - 1;
      const k = cellCls(c);
      h += `<td class="${k}" data-tip="${t}">${c && c.sev >= 1 ? `<span>${c.sev}</span>` : c && c.syn ? '<span>+</span>' : ''}</td>`;
    });
    h += '</tr>';
  });
  h += `</tbody></table></div><div class="legend"><span><i style="background:var(--crit)"></i>4 — Несовместимо</span><span><i style="background:var(--major)"></i>3 — Серьёзно</span><span><i style="background:var(--mod)"></i>2 — Умеренно</span><span><i style="background:var(--minor-bg);outline:1px solid var(--minor)"></i>1 — Учесть</span><span><i style="background:var(--syn-bg);outline:1px solid var(--syn)"></i>+ — Синергия</span><span><i style="background:var(--none)"></i>нет находок</span><span>Диагональ — проблемы вещества в форме</span></div></div>`;
  return h;
}
function tipHTML(o) {
  if (!o.list.length) return `<b>${esc(o.t)}</b><div class="r">Находок нет</div>`;
  return `<b>${esc(o.t)}</b>` + o.list.slice(0, 6).map(f => `<div class="r">${f.cat === 'syn' ? '＋ Синергия' : SEV[f.sev].t}: ${esc(f.type)}</div>`).join('') + (o.list.length > 6 ? `<div class="r">… ещё ${o.list.length - 6}</div>` : '');
}
function methodTeaser() { return `<div class="card"><h2 style="margin-bottom:8px">Что проверяется</h2><div class="v-desc small">Расчётный pH смеси и растворимость каждого компонента; окна стабильности и кто сдвигает pH; совместимость с фазой и технологией формы (нагрев, влага, свет, вкус, загрузка); парные химические, физические и фармакологические взаимодействия; синергия; разделение конфликтующих компонентов по формам.</div></div>`; }

/* ---------- Подсказки ---------- */
const tip = $('#tip');
function showTip(html, e) { tip.innerHTML = html; tip.hidden = false; moveTip(e); }
function moveTip(e) { const w = tip.offsetWidth, hh = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY + 14; if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + hh > innerHeight - 8) y = e.clientY - hh - 14; tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px'; }
function hideTip() { tip.hidden = true; }

/* ---------- Графики ---------- */
const CHARTS = new Map(); let chartSeq = 0;
function chartSVG(o) {
  const W = 340, H = 180, ml = 40, mr = 10, mt = 8, mb = 26, pw = W - ml - mr, ph = H - mt - mb;
  const ys = o.series.flatMap(s => s.pts.map(p => p[1])).filter(v => isFinite(v));
  let y0 = o.ymin ?? Math.min(...ys), y1 = o.ymax ?? Math.max(...ys);
  if (y1 - y0 < 1e-6) { y0 -= 1; y1 += 1; }
  const step = Math.max(o.ystepMin || 0, niceStep((y1 - y0) / 4)); y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;
  const X = v => ml + v / 14 * pw, Y = v => mt + (1 - (v - y0) / (y1 - y0)) * ph;
  let g = '';
  for (let v = y0; v <= y1 + 1e-9; v += step) g += `<line class="gr" x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${ml - 5}" y="${Y(v) + 3.5}" text-anchor="end">${o.ytick ? o.ytick(v) : fmt(v, 1)}</text>`;
  for (let v = 0; v <= 14; v += 2) g += `<text x="${X(v)}" y="${H - mb + 14}" text-anchor="middle">${v}</text>`;
  if (o.band) g = `<rect class="band" x="${X(o.band[0])}" y="${mt}" width="${X(o.band[1]) - X(o.band[0])}" height="${ph}"/>` + g;
  g += `<line class="ax" x1="${ml}" x2="${W - mr}" y1="${mt + ph}" y2="${mt + ph}"/>`;
  g += o.series.map(s => `<path class="ln" stroke="${s.color}" d="${s.pts.filter(p => isFinite(p[1])).map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(Math.max(y0, Math.min(y1, p[1]))).toFixed(1)).join('')}"/>`).join('');
  const id = 'c' + (++chartSeq);
  CHARTS.set(id, { o, X, Y, ml, pw, mt, ph, W, H });
  g += `<g class="hov" hidden><line class="cross" x1="0" x2="0" y1="${mt}" y2="${mt + ph}"/>${o.series.map(s => `<circle r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join('')}</g>`;
  g += `<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="transparent" data-chart="${id}"/>`;
  g += `<text x="${ml + pw / 2}" y="${H - 1}" text-anchor="middle">pH</text>`;
  return `<div class="chart"><h4>${o.title}</h4><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title)}">${g}</svg>${o.series.length > 1 ? `<div class="lg">${o.series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}${o.note ? `<div class="est">${o.note}</div>` : ''}</div>`;
}
function niceStep(r) { const p = Math.pow(10, Math.floor(Math.log10(r))); const n = r / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; }
function chartHover(e, rect) {
  const C = CHARTS.get(rect.dataset.chart); if (!C) return;
  const svg = rect.ownerSVGElement; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  const xv = Math.max(0, Math.min(14, (p.x - C.ml) / C.pw * 14));
  const hov = svg.querySelector('.hov'); hov.hidden = false; hov.removeAttribute('hidden');
  const xx = C.X(xv); hov.querySelector('line').setAttribute('x1', xx); hov.querySelector('line').setAttribute('x2', xx);
  const vals = C.o.series.map(s => { let best = s.pts[0]; s.pts.forEach(q => { if (Math.abs(q[0] - xv) < Math.abs(best[0] - xv)) best = q; }); return best; });
  hov.querySelectorAll('circle').forEach((c, i) => { const v = vals[i]; c.setAttribute('cx', C.X(v[0])); c.setAttribute('cy', isFinite(v[1]) ? C.Y(Math.max(C.o.ymin ?? -1e9, Math.min(C.o.ymax ?? 1e9, v[1]))) : -99); });
  showTip(`<b>pH ${fmt(vals[0][0], 1)}</b>` + C.o.series.map((s, i) => `<div class="r">${esc(s.name)}: ${C.o.vfmt ? C.o.vfmt(vals[i][1]) : fmt(vals[i][1], 2)}</div>`).join(''), e);
}

/* ---------- Карточка вещества ---------- */
function openMol(id) { location.hash = '#card/' + id; }
function renderMol(id) {
  const m = BY[id]; const el = $('#mol');
  if (!m) { el.innerHTML = `<div class="card"><div class="empty">Найдите вещество по названию. Карточка содержит структуру, физико-химические свойства, графики ионизации, logD и растворимости, окно стабильности и пригодность для каждой формы.</div></div>`; return; }
  CUR_MOL = id; CHARTS.clear();
  const pk = m.SP.flatMap(p => p.pk);
  const stat = (k, v, d) => v == null || v === '' ? '' : `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ''}</div>`;
  const lev = ['устойчиво', 'слабо', 'умеренно', 'сильно'];
  const stN = { ox: 'Окисление', hy: 'Гидролиз', he: 'Нагрев', li: 'Свет', mo: 'Влага' };
  const stCol = ['var(--ok)', 'var(--minor)', 'var(--mod)', 'var(--crit)'];
  const tags = [...m.T].filter(t => t);
  let h = `<div class="card"><div class="mol-head">
    <div class="struct">${m.svg || '<span class="muted small">Структура не задана (экстракт, полимер или белок)</span>'}</div>
    <div style="display:flex;flex-direction:column;gap:12px;min-width:0">
      <div><h2 style="font-size:20px">${esc(m.ru)}</h2><div class="muted">${esc(m.en)} · ${esc(m.cat)} · ${esc({ small: 'малая молекула', mineral: 'минерал', extract: 'экстракт', enzyme: 'фермент', protein: 'белок', peptide: 'пептид', polymer: 'полимер', probiotic: 'пробиотик', formulation: 'готовая форма субстанции', excipient: 'вспомогательное вещество' }[m.kind] || m.kind)}${m.T.has('rx') ? ' · <span class="tag">рецептурный</span>' : ''}</div></div>
      ${m.pharm && m.pharm.eff ? `<div class="v-desc">${esc(m.pharm.eff)}${m.pharm.bf ? ` <span class="muted">· рекомендуемая форма в аптеке: ${esc(m.pharm.bf)}</span>` : ''}</div>` : ''}
      ${m.role ? `<div class="v-desc">${esc(m.role)}</div>` : ''}
      <div class="kv">
        ${stat('Формула (активная частица)', m.fx ? fmla(m.fx) : null)}
        ${stat('Форма поставки', m.fs ? fmla(m.fs) : m.mw ? fmla(m.fx || '') : null, m.mw ? 'M = ' + fmt(m.mw, 2) + ' г/моль' : '')}
        ${stat('Солевой фактор', m.sf != null ? fmt(m.sf, 3) : null, 'доля активной части')}
        ${stat('logP эксп.', m.lp != null ? fmt(m.lp, 2) : null)}
        ${stat('cLogP (Crippen)', m.clogp != null ? fmt(m.clogp, 2) : null)}
        ${stat('TPSA', m.tpsa != null ? fmt(m.tpsa, 1) : null, 'Å²')}
        ${stat('HBD / HBA', m.hbd != null ? m.hbd + ' / ' + m.hba : null)}
        ${stat('pKa', pk.length ? pk.map(v => fmt(v, 2)).join('; ') : null)}
        ${stat('pH 1% раствора', m.p1 != null ? fmt(m.p1, 1) : null, 'расчёт')}
        ${stat('Растворимость в воде', m.sw != null ? fmt(m.sw, 3) : null, 'мг/мл, 25 °C')}
        ${stat('Собственная раств. S₀', m.s0 != null ? fmt(m.s0, 3) : null, 'мг/мл')}
        ${stat('Масло / этанол', m.oil != null || m.eth != null ? ['нет', 'слабо', 'хорошо'][m.oil ?? 0] + ' / ' + ['нет', 'слабо', 'хорошо'][m.eth ?? 0] : null)}
        ${stat('Т. плавления', m.mp != null ? fmt(m.mp, 0) + ' °C' : null)}
        ${stat('pI', m.pI != null ? fmt(m.pI, 1) : null, m.seq ? esc(m.seq) : '')}
        ${stat('Хиральные центры', m.chir != null ? String(m.chir) : null)}
        ${stat('ID аптеки', m.pharm && m.pharm.pid ? String(m.pharm.pid) : null)}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="button" data-addmol="${m.id}">${I.plus}Добавить в рецептуру</button></div>
    </div></div></div>`;
  // стабильность
  h += `<div class="card"><div class="card-h"><h2>Стабильность</h2><span class="sub">окно pH в растворе: ${m.ph ? fmt(m.ph[0], 1) + '–' + fmt(m.ph[1], 1) : '—'}</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px 24px">${Object.keys(stN).map(k => `<div class="stbar"><span>${stN[k]}</span><div class="bar"><i style="width:${(m.S[k] / 3 * 100) || 2}%;background:${stCol[m.S[k]]}"></i></div><span class="mono">${m.S[k]}</span></div>`).join('')}</div>
    <div class="est" style="margin-top:6px">0 — ${lev[0]}, 3 — ${lev[3]} чувствительно.</div>
    ${(m.alerts || []).length ? `<div style="margin-top:10px"><div class="small muted" style="margin-bottom:4px">Структурные признаки (SMARTS)</div><div class="pills">${m.alerts.map(a => `<span class="tag">${esc(ALERT_N[a] || a)}</span>`).join('')}</div></div>` : ''}
    ${tags.length ? `<div style="margin-top:10px"><div class="small muted" style="margin-bottom:4px">Теги для правил</div><div class="pills">${tags.map(t => `<span class="tag mono">${esc(t)}</span>`).join('')}</div></div>` : ''}</div>`;
  // графики
  const charts = [];
  const xs = []; for (let v = 0; v <= 14.0001; v += 0.1) xs.push(+v.toFixed(1));
  if (m.SP.length && m.SP[0].pk.length) {
    const p = m.SP[0]; const col = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
    const n = p.pk.length + 1;
    const series = []; for (let j = 0; j < n; j++) { const z = p.zf - j; series.push({ name: 'заряд ' + (z > 0 ? '+' + z : z === 0 ? '0' : '−' + Math.abs(z)), color: col[j % 5], pts: xs.map(x => [x, alphas(p.pk, Math.pow(10, -x))[j] * 100]) }); }
    charts.push(chartSVG({ title: 'Ионизация, % частиц', series, ymin: 0, ymax: 100, band: m.ph, vfmt: v => v < 0.1 ? '< 0,1%' : fmt(v, 1) + '%' }));
  }
  if (m.logP != null && m.SP.length) charts.push(chartSVG({ title: 'logD от pH', series: [{ name: 'logD', color: 'var(--s1)', pts: xs.map(x => [x, logD(m, x)]) }], band: m.ph, vfmt: v => fmt(v, 2) }));
  if (m.sw != null && m.SP.length) charts.push(chartSVG({ title: 'Растворимость, мг/мл (лог. шкала)', series: [{ name: 'растворимость', color: 'var(--s3)', pts: xs.map(x => [x, Math.log10(solAt(m, x))]) }], band: m.ph, ytick: v => fmtPow(v), ystepMin: 1, vfmt: v => fmt(Math.pow(10, v), 3) + ' мг/мл', note: m.s0 == null ? 'Нет данных о собственной растворимости S₀ — показана растворимость формы поставки.' : '' }));
  if (charts.length) h += `<div class="card"><div class="card-h"><h2>Зависимость от pH</h2><span class="sub">зелёная полоса — окно стабильности; оценка</span></div><div class="charts">${charts.join('')}</div></div>`;
  // заметки
  const notes = [['salt', 'Соли и эфиры'], ['iso', 'Изомеры'], ['poly', 'Полиморфизм'], ['deg', 'Деградация'], ['clin', 'Клинические замечания'], ['marker', 'Маркер экстракта'], ['note', 'Примечание']].filter(([k]) => m[k]);
  const taste = m.taste ? [['Вкус', m.taste.t], ['Запах', m.taste.s], ['Цвет', m.taste.c]].filter(a => a[1]) : [];
  if (notes.length || taste.length) h += `<div class="card"><div class="card-h"><h2>Заметки</h2></div><div class="notes">${notes.map(([k, n]) => `<div><b>${n}</b>${esc(m[k])}</div>`).join('')}${taste.length ? `<div><b>Органолептика</b>${taste.map(([a, b]) => a + ': ' + esc(b)).join(' · ')}</div>` : ''}</div></div>`;
  // пригодность
  const suit = suitability(id);
  h += `<div class="card"><div class="card-h"><h2>Пригодность для лекарственных форм</h2><span class="sub">анализ рецептуры из одного вещества (условное количество, параметры формы по умолчанию)</span></div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>Форма</th><th>Оценка</th><th>Основные замечания</th></tr></thead><tbody>
    ${suit.map(s => `<tr><td style="white-space:nowrap">${esc(FORMS[s.form].n)}</td><td>${s.sev ? sevBadge(s.sev) : sevBadge('ok')}</td><td class="small">${s.top.length ? s.top.map(f => esc(f.type + ': ' + f.t.replace(m.ru + ': ', ''))).join('<br>') : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
  el.innerHTML = h;
}
const ALERT_N = { catechol: 'катехол', pyrogallol: 'пирогаллол', thiol: 'тиол', disulfide: 'дисульфид', thioester: 'тиоэфир', amine1: 'первичный амин', amine2: 'вторичный амин', aldehyde: 'альдегид', ester: 'сложный эфир', lactone: 'лактон', phosphate: 'фосфат', quinone: 'хинон', oquinone: 'о-хинон', polyene: 'полиен', michael: 'акцептор Михаэля', itc: 'изотиоцианат', diketone: 'β-дикетон', flavonol: 'флавонол', stilbene: 'стильбен', dhp: 'дигидропиридин', nglyco: 'N-гликозид', glycoside: 'гликозид', quat: 'четвертичный аммоний', indole: 'индол' };
function fmtPow(v) { return v >= 0 && v <= 3 ? String(Math.round(Math.pow(10, v))) : v < 0 && v >= -2 ? String(Math.pow(10, v)).replace('.', ',') : '1e' + v; }
function fmla(f) { const m = String(f || '').match(/^(.*?)([+-])(\d*)$/); let core = m ? m[1] : String(f || ''), ch = m ? '<sup>' + (m[3] && m[3] !== '1' ? m[3] : '') + (m[2] === '-' ? '−' : '+') + '</sup>' : ''; return esc(core).replace(/(\d+)/g, '<sub>$1</sub>').replace(/·<sub>(\d+)<\/sub>/g, '·$1') + ch; }

/* ---------- Методика ---------- */
function renderMethod() {
  $('#method').innerHTML = `
<h2 style="margin-top:0">Методика расчёта</h2>
<p>Инструмент — поддержка решений для врача. Все значения <b>оценочные</b>: они получены из упрощённых физико-химических моделей и справочных данных и не заменяют экспертизу провизора, пробную партию и испытания стабильности. Дозировки не рекомендуются; количество вводит врач.</p>

<h3>1. pH смеси</h3>
<p>Решается уравнение электронейтральности для всех ионогенных компонентов в объёме водной фазы на приём (капли и спреи — объём дозы; гель и кремы — масса × доля водной фазы; порошок — объём воды). Каждая частица задана набором pKa, зарядом полностью протонированной формы и зарядом в форме поставки; противоионы солей считаются сильными. Учтён фоновый CO₂ воздуха. Корень находится бисекцией по pH −1…15.</p>
<span class="f">Σ cᵢ·nᵢ·(z̄ᵢ(pH) − z₀ᵢ) + [H⁺] − [OH⁻] = 0,  z̄ = z_f − Σ j·αⱼ(pH)</span>
<p>В раствор переходит не больше растворимости: концентрация нерастворённой части пересчитывается итерационно (3 шага). Не учтены коэффициенты активности (ионная сила), комплексообразование металлов и влияние этанола на pKa — для водно-спиртовых форм pH ориентировочный.</p>
<p><b>Кто сдвигает pH.</b> Если pH выходит за окно стабильности вещества, pH пересчитывается без каждого другого ионогенного компонента; перечисляются те, чьё исключение возвращает pH к окну более чем на 0,3 ед.</p>

<h3>2. Ионизация, logD и растворимость</h3>
<p>Доли микроформ — из констант кислотности (αⱼ). logD = logP + log₁₀(f₀), где f₀ — доля электронейтральной формы (не ниже logP − 4, учёт ион-парного распределения). Растворимость при pH — модель Хендерсона–Хассельбаха: S(pH) = S₀ / f₀, ограниченная сверху растворимостью соли (не менее 300 мг/мл). Для веществ без S₀ используется растворимость формы поставки.</p>
<p>Сорастворители — log-линейная модель Ялковского: log(S_mix/S_w) = Σ σₖ·fₖ, σ = M·logP + N (Millard 2002; этанол, ПГ, глицерин, ПЭГ 400).</p>
<p>Растворимость в масле (MCT) — общее уравнение растворимости (GSE): log S_oct = 0,5 − 0,01·(т.пл. − 25), с поправкой MCT ≈ октанол / 10, либо качественный признак из базы.</p>
<p>Статус «раствор / взвесь» — сравнение концентрации на приём с оценкой растворимости; процент — доля в растворе.</p>

<h3>3. Совместимость с формой</h3>
<ul>
<li><b>Фаза:</b> водная (капли, спреи, гели, кремы), сухая (капсулы, порошок), расплав гидрофильной основы (троше, свечи на ПЭГ), липидная (масляные капли, мазь, свечи на твёрдом жире). Тяжесть одной и той же реакции зависит от фазы: в растворе она идёт за часы–дни, в сухой капсуле — только в слое адсорбированной влаги.</li>
<li><b>Нагрев:</b> ПЭГ-основа ≈ 60 °C, глицерин-желатиновая ≈ 70 °C, твёрдый жир ≈ 45 °C; оценивается по устойчивости к нагреву (he) и типу вещества (белки, пептиды, пробиотики).</li>
<li><b>Влага, свет, окисление, гидролиз:</b> по шкале устойчивости 0–3 из базы и тегам (гигроскопичность, расплывание).</li>
<li><b>Вкус:</b> только для форм, растворяющихся во рту (троше, сублингвальный спрей, капли «под язык», порошок).</li>
<li><b>Загрузка:</b> капсулы — объём по насыпной плотности и вместимость размеров №000–№4; троше — до ~30–35% порошка, свечи — до ~30%; жидкости — % м/о.</li>
<li><b>Назальный спрей:</b> осмоляльность Σ c·i·φ (φ ≈ 0,93; i — число частиц с учётом противоионов), целевая 250–350 мОсм/кг; pH 4,5–6,5.</li>
<li><b>Кожа:</b> Potts–Guy: log kp (см/ч) = −2,7 + 0,71·logP − 0,0061·M; поток из насыщенного раствора J = kp·S.</li>
</ul>

<h3>4. Парные взаимодействия и синергия</h3>
<p>Правила составлены по тегам базы (свойства и фармакология), полям устойчивости, окон pH, pH 1% раствора, структурным признакам (SMARTS) и элементному составу. Категории:</p>
<ul>
<li><b>Химические:</b> катализ окисления Cu/Fe (Фентон), окисление тиолов и иодида, разрушение B12 аскорбатом, сульфит + тиамин, бензоат + аскорбат (бензол), кислотный и щелочной гидролиз, реакция Майяра, альдегид/генипин/хинон + амины, изотиоцианат + тиол, протеолиз, хелатирование и осаждение (Fe + катехолы, Ca + фосфат, танины + белки и алкалоиды).</li>
<li><b>Физические:</b> растворимость, расслоение, гелеобразование, потеря вязкости карбомера с солями и катионами, ион-парное осаждение, инактивация парабенов ПАВ, расплывание и эвтектики в сухих смесях, хрупкость желатиновых капсул.</li>
<li><b>Фармакологические:</b> суммирование эффектов (гипогликемический, антиагрегантный, гипотензивный, седативный, стимулирующий, серотонинергический), антагонизм и противоречие по времени приёма, конкуренция за всасывание (Fe/Ca, LAT1), ингибирование и индукция CYP3A4/CYP1A2 и P-gp.</li>
<li><b>Синергия:</b> биодоступность (пиперин, фосфолипиды, липиды), кофакторы (D3 + K2, Mg + D3, B12 + фолат), взаимная стабилизация (антиоксиданты масел, ЭДТА, трегалоза), маскировка вкуса.</li>
</ul>
<p>Шкала: <b>Несовместимо</b> — готовить нельзя; <b>Серьёзно</b> — нужна замена соли, основы или формы; <b>Умеренно</b> — допустимо с мерами; <b>Учесть</b> — информация; <b>Синергия</b> — полезное сочетание.</p>

<h3>5. Разделение состава</h3>
<p>Строится граф конфликтов: рёбра — химические/физические находки «Серьёзно» и выше, а также фармакологические конфликты, решаемые разным временем приёма. Вершины раскрашиваются жадным алгоритмом DSatur — каждая группа (цвет) не содержит конфликтов. Для каждой группы перебираются формы того же пути введения и выбирается форма с наименьшей взвешенной суммой находок (вес 1000 / 60 / 8 / 1 по тяжести).</p>

<h3>Ограничения</h3>
<ul>
<li>База содержит 260 веществ; для экстрактов свойства даны по маркерному соединению или качественно.</li>
<li>Кинетика деградации не моделируется: тяжесть — экспертная оценка вероятности и скорости процесса.</li>
<li>Не учитываются: ионная сила, комплексы металлов в балансе pH, взаимодействия с материалом тары, микробиологическая стабильность, индивидуальные особенности пациента.</li>
<li>Фармакологические находки — справочные; решение о совместном назначении принимает врач.</li>
<li>Срок годности (BUD) определяется по USP &lt;795&gt; и данным о стабильности, а не этим инструментом.</li>
</ul>

<h3>Источники</h3>
<ul>
<li>Sheskey P. J. et al. <i>Handbook of Pharmaceutical Excipients</i>, 9th ed. — свойства и несовместимости вспомогательных веществ.</li>
<li>Trissel L. A. <i>Trissel's Stability of Compounded Formulations</i>, 6th ed.</li>
<li>USP General Chapter &lt;795&gt; Pharmaceutical Compounding — Nonsterile Preparations.</li>
<li>Allen L. V. <i>The Art, Science, and Technology of Pharmaceutical Compounding</i>.</li>
<li>Yalkowsky S. H., Valvani S. C. Solubility and partitioning I // J Pharm Sci 1980 (GSE); Millard J. W. et al. Solubilization by cosolvents // Int J Pharm 2002.</li>
<li>Avdeef A. <i>Absorption and Drug Development: Solubility, Permeability, and Charge State</i>.</li>
<li>Potts R. O., Guy R. H. Predicting skin permeability // Pharm Res 1992;9:663.</li>
<li>Shoba G. et al. Influence of piperine on the pharmacokinetics of curcumin // Planta Med 1998;64:353.</li>
<li>PubChem, DrugBank, Merck Index — справочные pKa, logP, растворимость, т. пл.; RDKit — дескрипторы и структуры.</li>
</ul>`;
}

/* ---------- Копирование ---------- */
function copyText(t) {
  const done = () => toast('Заключение скопировано');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, () => fallback());
  else fallback();
  function fallback() { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Не удалось скопировать'); } ta.remove(); }
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1800); }

/* ---------- Тема ---------- */
function themeGet() { try { return localStorage.getItem('cc_theme') || 'auto'; } catch (e) { return 'auto'; } }
function themeSet(t) {
  try { localStorage.setItem('cc_theme', t); } catch (e) {}
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const n = { auto: 'Тема: как в системе', light: 'Тема: светлая', dark: 'Тема: тёмная' }[t];
  $('#themeBtn').innerHTML = I[t === 'auto' ? 'auto' : t === 'light' ? 'sun' : 'moon']; $('#themeBtn').title = n; $('#themeBtn').setAttribute('aria-label', n);
}

/* ---------- Навигация ---------- */
function route() {
  const h = location.hash.slice(1);
  let tab = 'recipe';
  if (h.startsWith('card')) { tab = 'card'; renderMol(decodeURIComponent(h.split('/')[1] || '') || CUR_MOL); }
  else if (h === 'method') tab = 'method';
  TAB = tab;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  ['recipe', 'card', 'method'].forEach(t => { $('#tab-' + t).hidden = t !== tab; });
  if (tab !== 'recipe') window.scrollTo(0, 0);
}

/* ---------- События ---------- */
function init() {
  restore();
  renderForms(); renderMethod();
  $('#examples').innerHTML = EXAMPLES.map((e, i) => `<button type="button" data-ex="${i}"><span>${esc(e.n)}</span><span class="f">${esc(FORMS[e.form].n)}</span></button>`).join('');
  bindSearch($('#q').closest('.search'), (m, viaKey) => addItem(m, viaKey), { multi: true, isAdded: id => S.items.some(i => i.id === id) });
  bindSearch($('#q2').closest('.search'), m => openMol(m.id), { isAdded: id => id === CUR_MOL });
  themeSet(themeGet());
  $('#themeBtn').addEventListener('click', () => { const o = ['auto', 'light', 'dark']; themeSet(o[(o.indexOf(themeGet()) + 1) % 3]); });
  $('#forms').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b && b.dataset.f !== S.form) setForm(b.dataset.f); });
  $('#params').addEventListener('change', e => { const k = e.target.dataset.p; if (!k) return; S.P[k] = e.target.tagName === 'SELECT' ? e.target.value : +e.target.value; update(k === 'cosolv'); });
  $('#params').addEventListener('input', e => { const k = e.target.dataset.p; if (!k || e.target.tagName === 'SELECT') return; S.P[k] = +e.target.value; update(false); });
  $('#items').addEventListener('input', e => { const a = e.target.dataset.a; if (a != null) { S.items[+a].amt = e.target.value === '' ? '' : +e.target.value; save(); const res = analyze(S); LAST = res; LAST_SPLIT = suggestSplit(res); renderOut(res, LAST_SPLIT); refreshMeta(res); } });
  $('#items').addEventListener('change', e => { const u = e.target.dataset.u; if (u != null) { S.items[+u].unit = e.target.value; update(); } });
  $('#items').addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (r) { S.items.splice(+r.dataset.rm, 1); update(); } });
  $('#examples').addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) loadExample(EXAMPLES[+b.dataset.ex]); });
  $('#clearBtn').addEventListener('click', () => { S.items = []; update(); });
  document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; location.hash = b.dataset.tab === 'recipe' ? '' : b.dataset.tab === 'card' ? '#card/' + (CUR_MOL || '') : '#method'; if (b.dataset.tab === 'recipe') route(); });
  document.addEventListener('click', e => {
    const m = e.target.closest('[data-mol]'); if (m) { openMol(m.dataset.mol); return; }
    const f = e.target.closest('[data-filt]'); if (f) { FILT = f.dataset.filt; renderOut(LAST, LAST_SPLIT); return; }
    const c = e.target.closest('#copyBtn'); if (c) { copyText(reportText(LAST, LAST_SPLIT)); return; }
    const g = e.target.closest('[data-grp]'); if (g && LAST_SPLIT) { const gr = LAST_SPLIT.groups[+g.dataset.grp]; S = { form: gr.form, P: gr.form === S.form ? S.P : Object.assign({}, FORM_DEFAULTS[gr.form]), items: gr.items.map(i => Object.assign({}, i)) }; FILT = 'all'; update(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const a = e.target.closest('[data-addmol]'); if (a) { addItem(BY[a.dataset.addmol], false); location.hash = ''; route(); return; }
  });
  document.addEventListener('mouseover', e => { const t = e.target.closest('[data-tip]'); if (t) showTip(tipHTML(TIPS[+t.dataset.tip]), e); });
  document.addEventListener('mousemove', e => { const r = e.target.closest && e.target.closest('[data-chart]'); if (r) { chartHover(e, r); return; } if (e.target.closest && e.target.closest('[data-tip]')) moveTip(e); else if (!tip.hidden) hideTip(); });
  document.addEventListener('mouseout', e => { const r = e.target.closest && e.target.closest('[data-chart]'); if (r) { const hov = r.ownerSVGElement.querySelector('.hov'); hov && hov.setAttribute('hidden', ''); hideTip(); } });
  window.addEventListener('hashchange', route);
  update();
  route();
}
function refreshMeta(res) {
  const st = {}; res.rows.forEach(r => { st[r.k] = r; });
  document.querySelectorAll('#items .item').forEach(el => {
    const r = st[+el.dataset.k]; if (!r) return; const m = r.m; const meta = [];
    if (r.status) meta.push(`<span class="tag ${r.status === 'раствор' ? 'sol' : r.status === 'взвесь' ? 'susp' : ''}">${r.status}</span>`);
    if (r.unit !== 'мг' && r.mg) meta.push(`<span class="mono">${fmtMg(r.mg)}</span>`);
    meta.push(m.kind === 'excipient' ? '<span>вспомогательное</span>' : `<span>${esc(m.cat)}</span>`);
    el.querySelector('.meta').innerHTML = meta.join('');
  });
}
init();
