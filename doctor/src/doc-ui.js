/* ===== Врачебная версия: интерфейс ===== */
'use strict';
const $ = s => document.querySelector(s);
const TECH_URL = 'https://claude.ai/artifact/2jpwvZxpZPbxpssj4UToem';

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
  plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3v10M3 8h10"/></svg>',
  sunrise: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12h12M4.5 12a3.5 3.5 0 0 1 7 0M8 3v3M3.4 6.4l1.2 1.2M12.6 6.4l-1.2 1.2"/></svg>',
  clock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>'
};
const badge = (k, t) => `<span class="sev ${k}">${I[k] || ''}${t}</span>`;
const dsev = s => badge(DOC_SEV[s].k, DOC_SEV[s].t);
const csev = s => badge(CONTRA_SEV[s].k, CONTRA_SEV[s].t);
function plural(n, a, b, c) { const d = n % 10, e = n % 100; return d === 1 && e !== 11 ? a : d >= 2 && d <= 4 && (e < 10 || e >= 20) ? b : c; }
const ACT = LIST.filter(m => m.kind !== 'excipient');
const effOf = m => (m.pharm && (m.pharm.eff || m.pharm.pc)) || '';

/* ---------- Состояние ---------- */
// S.items — позиции состава в терминах сайта: {n: название в конструкторе, amt: суточная доза в единицах сайта}
let S = { form: 'КП', items: [], cond: [], unlim: false, th: 0, cat: 0, q: '' }, CUR_MOL = null, LAST = null, LASTF = null, LASTRES = null;
const idsOf = () => [...new Set(S.items.map(it => sid(it.n)))];
function save() { try { localStorage.setItem('cc_doc2', JSON.stringify(S)); } catch (e) {} }
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem('cc_doc2') || 'null');
    if (s && SFORM[s.form] && Array.isArray(s.items)) S = Object.assign(S, s, { items: s.items.filter(it => SITE.mols[it.n]), cond: (s.cond || []).filter(c => COND_N[c]), q: '' });
  } catch (e) {}
}

/* ---------- Выбор вещества (список + поиск по первым буквам) ---------- */
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
const tokens = s => s.split(/[^a-zа-я0-9]+/i).filter(Boolean);
ACT.forEach(m => { m._q = norm(m.ru + ' ' + m.en + ' ' + m.id + ' ' + effOf(m) + ' ' + (m.syn || '')); m._r = norm(m.ru); m._e = norm(m.en); m._t = tokens(norm(m.ru + ' ' + m.en + ' ' + m.id + ' ' + (m.syn || ''))); });
// группы списка — по направленности (первое направление)
const GROUPS = Object.keys(DIRS).map(k => ({ k, n: DIRS[k].n })).concat([{ k: 'other', n: 'Прочее' }]);
const firstDir = m => (DIR_OF[m.id] || ['other'])[0];
function inGroup(m, g) { return g === 'other' ? !DIR_OF[m.id] : (DIR_OF[m.id] || []).includes(g); }
function searchMol(q, g) {
  q = norm(q).trim();
  const base = g ? ACT.filter(m => inGroup(m, g)) : ACT;
  if (!q) return g ? base : base.slice().sort((a, b) => GROUPS.findIndex(x => x.k === firstDir(a)) - GROUPS.findIndex(x => x.k === firstDir(b)) || a.ru.localeCompare(b.ru, 'ru'));
  const words = tokens(q); if (!words.length) return base;
  const score = m => words.every(w => m._t.includes(w)) ? 0 : m._r.startsWith(q) || m._e.startsWith(q) ? 0.5 : words.every(w => m._t.some(t => t.startsWith(w))) ? 1 : words.every(w => m._q.includes(w)) ? 2 : -1;
  let r = base.map(m => [m, score(m)]).filter(a => a[1] >= 0);
  if (words.every(w => w.length <= 3) && r.some(a => a[1] <= 1)) r = r.filter(a => a[1] <= 1);
  return r.sort((a, b) => a[1] - b[1] || a[0].ru.localeCompare(b[0].ru, 'ru')).map(a => a[0]);
}
function hl(text, q) {
  const words = tokens(norm(q)); const h = esc(text); if (!words.length) return h;
  const re = new RegExp('(^|[^a-zа-яё0-9])(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]')).join('|') + ')', 'gi');
  return h.replace(re, '$1<mark>$2</mark>');
}
function bindPicker(wrap, onPick, opt = {}) {
  const inp = wrap.querySelector('input'), dd = wrap.querySelector('.dd'), tg = wrap.querySelector('.dd-toggle');
  let sel = 0, list = [], grp = '', open = false;
  const isAdded = opt.isAdded || (() => false);
  const close = () => { open = false; dd.hidden = true; tg.setAttribute('aria-expanded', 'false'); };
  const draw = (keep) => {
    const q = inp.value.trim(); list = searchMol(q, grp); sel = Math.max(0, Math.min(sel, list.length - 1));
    const sc = keep ? (dd.querySelector('.dd-list') || {}).scrollTop : 0;
    let h = `<div class="dd-cats">${[{ k: '', n: 'Все' }].concat(GROUPS).map(g => `<button type="button" class="chip" data-grp="${g.k}" aria-pressed="${g.k === grp}">${esc(g.n)}</button>`).join('')}</div>`;
    h += `<div class="dd-hint">${q ? 'Найдено: ' + list.length : (grp ? list.length + ' в группе' : 'Все вещества: ' + list.length + ' · начните вводить первые 3 буквы')}${opt.multi ? ' · можно выбрать несколько' : ''}</div>`;
    if (!list.length) h += '<div class="empty" style="border:0">Не найдено</div>';
    let last = null;
    h += '<div class="dd-list">' + list.map((m, i) => {
      let gh = ''; if (!q && !grp && firstDir(m) !== last) { last = firstDir(m); gh = `<div class="dh">${esc(GROUPS.find(g => g.k === last).n)}</div>`; }
      const ad = isAdded(m.id);
      return gh + `<button type="button" data-i="${i}" class="${i === sel ? 'on' : ''}${ad ? ' added' : ''}"><span>${ad ? '<span class="ck">✓</span>' : ''}${hl(m.ru, q)} <span class="en">${hl(m.en, q)}</span>${effOf(m) ? `<span class="eff">${esc(effOf(m))}</span>` : ''}</span><span class="cat">${ad ? 'в составе' : ''}</span></button>`;
    }).join('') + '</div>';
    if (opt.multi) h += '<div class="dd-foot"><button type="button" class="btn" data-done>Готово</button></div>';
    dd.innerHTML = h; dd.hidden = false; open = true; tg.setAttribute('aria-expanded', 'true');
    if (keep) dd.querySelector('.dd-list').scrollTop = sc;
  };
  const pick = (m, viaKey) => { if (!m) return; onPick(m); if (opt.multi && !viaKey) draw(true); else { inp.value = ''; close(); } };
  inp.addEventListener('input', () => { sel = 0; if (inp.value.trim()) grp = ''; draw(); });
  inp.addEventListener('focus', () => draw());
  tg.addEventListener('click', () => { if (open) close(); else { sel = 0; draw(); } });
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
    const g = e.target.closest('[data-grp]'); if (g) { grp = g.dataset.grp; sel = 0; draw(); return; }
    if (e.target.closest('[data-done]')) { inp.value = ''; grp = ''; close(); return; }
    const b = e.target.closest('button[data-i]'); if (b) pick(list[+b.dataset.i], false);
  });
  document.addEventListener('mousedown', e => { if (open && !wrap.contains(e.target)) close(); });
  document.addEventListener('touchstart', e => { if (open && !wrap.contains(e.target)) close(); }, { passive: true });
}

/* ---------- Конструктор ---------- */
const fico = k => `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${{
  caps: '<rect x="2" y="6" width="14" height="6" rx="3"/><path d="M9 6v6"/>', drops: '<path d="M9 2.5c2.5 3.2 4 5.4 4 7.5a4 4 0 0 1-8 0c0-2.1 1.5-4.3 4-7.5z"/>',
  troche: '<rect x="3" y="5" width="12" height="9" rx="2"/><path d="M3 9h12"/>', nasal: '<path d="M7 16V9l2-6 2 6v7"/><path d="M7 11h4"/>',
  td: '<rect x="2.5" y="4" width="13" height="10" rx="2"/><circle cx="9" cy="9" r="2"/>', cream: '<rect x="4" y="8" width="10" height="8" rx="1.5"/><path d="M6 8V5.5h6V8M7 3h4"/>',
  supp: '<path d="M9 2c2.5 2 3.5 5 3.5 8v5h-7v-5c0-3 1-6 3.5-8z"/>' }[k]}</svg>`;
const availIn = (n, code) => !!siteDose(n, code);
function thList(code) { return SITE.tree.map((t, i) => ({ i, t, n: t.cats.reduce((a, c) => a + c.mols.filter(m => availIn(m, code)).length, 0) })).filter(x => x.n); }
function maxOf(d) { return d.max * (S.unlim ? 2 : 1); }
function stepOf(d) { const m = maxOf(d); return m <= 1 ? 0.01 : m <= 10 ? 0.1 : m <= 100 ? 0.5 : m <= 1000 ? 5 : 50; }
function addSite(n) {
  if (!availIn(n, S.form)) { toast(n + ' — нет в форме «' + SFORM[S.form].n + '»'); return; }
  const i = S.items.findIndex(it => it.n === n);
  if (i >= 0) { S.items.splice(i, 1); update(); return; } // повторное нажатие — убрать, как на сайте
  if (S.items.some(it => sid(it.n) === sid(n))) toast('То же вещество уже в составе: ' + S.items.find(it => sid(it.n) === sid(n)).n);
  S.items.push({ n, amt: siteDose(n, S.form).prof }); update();
}
function addId(id) { const n = (SITE_IDS[id] || []).find(x => availIn(x, S.form)); if (n) addSite(n); else toast(nm(id) + ' — нет в выбранной форме'); }
function setForm(code) {
  S.form = code; S.items.forEach(it => { const d = siteDose(it.n, code); if (d) it.amt = d.prof; });
  const th = thList(code); if (!th.some(x => x.i === S.th)) { S.th = th.length ? th[0].i : 0; S.cat = 0; }
  update();
}
function statusHTML(n) {
  if (!S.items.length && !S.cond.length) return '';
  const st = candStatus(n, S); const L = LVL[st.lvl]; if (!L) return '';
  const why = st.why.filter(w => w.l === st.lvl || st.lvl === 1).slice(0, 5).map(w => (w.with ? w.with + ' — ' : '') + w.t).join('\n');
  return `<span class="mst ${L.k}" data-t="${esc(L.t[0].toUpperCase() + L.t.slice(1) + ':\n' + why)}">${L.t}</span>`;
}
function molBtn(n, showPath) {
  const k = S.items.findIndex(it => it.n === n);
  const p = showPath && SITE_PATH[n] ? `<span class="mpath">${esc(SITE_PATH[n][0][1])}</span>` : '';
  return `<button type="button" class="mbtn${k >= 0 ? ' on' : ''}" data-sn="${esc(n)}">${k >= 0 ? `<span class="mnum">${k + 1}</span>` : ''}<span class="mname">${esc(n)}${p}</span>${statusHTML(n)}</button>`;
}
function renderCtor() {
  $('#ftiles').innerHTML = SITE.forms.map(f => `<button type="button" class="ftile" data-form="${f.code}" aria-pressed="${f.code === S.form}">${fico(FORM_ICO[f.code])}<span><b>${f.code}</b> ${esc(f.n)}</span></button>`).join('');
  $('#unlim').checked = !!S.unlim;
  const ths = thList(S.form);
  if (!ths.some(x => x.i === S.th) && ths.length) S.th = ths[0].i;
  const T = SITE.tree[S.th];
  const cats = T.cats.map((c, i) => ({ i, c, n: c.mols.filter(m => availIn(m, S.form)).length })).filter(x => x.n);
  if (!cats.some(x => x.i === S.cat) && cats.length) S.cat = cats[0].i;
  $('#colTh').innerHTML = ths.map(x => `<button type="button" class="cbtn" data-th="${x.i}" aria-pressed="${x.i === S.th && !S.q}">${esc(x.t.n.replace(/^Вне дерева.*$/, 'Только через поиск'))}<span class="cn">${x.n}</span></button>`).join('');
  $('#colCat').innerHTML = cats.map(x => `<button type="button" class="cbtn" data-cat="${x.i}" aria-pressed="${x.i === S.cat && !S.q}">${esc(x.c.n)}<span class="cn">${x.n}</span></button>`).join('');
  if (S.q) {
    const r = siteSearch(S.q, S.form);
    $('#colMolH').textContent = 'Найдено: ' + r.length;
    $('#colMol').innerHTML = r.length ? r.map(n => molBtn(n, true)).join('') : '<div class="empty">Нет в форме «' + esc(SFORM[S.form].n) + '»</div>';
  } else {
    const C = T.cats[S.cat]; const mols = C ? C.mols.filter(m => availIn(m, S.form)) : [];
    $('#colMolH').textContent = '3. Молекула';
    $('#colMol').innerHTML = mols.map(n => molBtn(n)).join('');
  }
}
function zoneBar(d, amt) {
  const M = maxOf(d), pct = v => Math.min(100, v / M * 100);
  const b1 = (d.sub + d.prof) / 2, b2 = (d.prof + d.ther) / 2;
  return `<div class="zbar"><i class="z1" style="width:${pct(b1)}%"></i><i class="z2" style="left:${pct(b1)}%;width:${pct(b2) - pct(b1)}%"></i><i class="z3" style="left:${pct(b2)}%;width:${pct(d.max) - pct(b2)}%"></i>${S.unlim ? `<i class="z4" style="left:${pct(d.max)}%;width:${100 - pct(d.max)}%"></i>` : ''}<b style="left:${pct(amt)}%"></b></div>`;
}
const TASTE_FORMS = new Set(['СЛ', 'ТР', 'ГМ']);
function renderItems() {
  $('#clearBtn').hidden = !S.items.length;
  $('#items').innerHTML = S.items.length ? S.items.map((it, k) => {
    const id = sid(it.n), m = BY[id], d = siteDose(it.n, S.form);
    if (!d) return `<div class="dcard off"><div class="dh"><span class="mnum">${k + 1}</span><b>${esc(it.n)}</b><button type="button" class="rm" data-rmn="${esc(it.n)}" aria-label="Удалить">✕</button></div><div class="muted small">Нет в форме «${esc(SFORM[S.form].n)}» — не учитывается.</div></div>`;
    const z = zoneOf(+it.amt, d), u = UNIT_N[d.u] || d.u;
    const org = TASTE_FORMS.has(S.form) && m.taste ? [m.taste.t && /горьк|металл|кисл|жгуч|остр|сернист/i.test(m.taste.t) ? 'вкус: ' + m.taste.t.toLowerCase() : '', m.taste.c && !/бел|бесцвет|молоч/i.test(m.taste.c) ? 'цвет: ' + m.taste.c.toLowerCase() : '', m.taste.s && !/без запаха/i.test(m.taste.s) ? 'запах: ' + m.taste.s.toLowerCase() : ''].filter(Boolean) : [];
    return `<div class="dcard"><div class="dh"><span class="mnum">${k + 1}</span><button type="button" class="mlink" data-mol="${id}">${esc(it.n)}</button><button type="button" class="rm" data-rmn="${esc(it.n)}" aria-label="Удалить">✕</button></div>
      <div class="drow2"><input type="range" min="0" max="${maxOf(d)}" step="${stepOf(d)}" value="${it.amt}" data-amt="${k}" aria-label="Суточная доза">
      <span class="dval"><input type="number" min="0" max="${maxOf(d)}" step="${stepOf(d)}" value="${it.amt}" data-amtn="${k}" aria-label="Суточная доза"><span class="u">${esc(u)}</span></span></div>
      ${zoneBar(d, +it.amt)}
      <div class="dmeta"><span class="zone ${z || ''}">${z ? ZONES[z] : 'доза не указана'}</span><span class="muted">0–${fmt(maxOf(d), 2)} ${esc(u)}${S.unlim ? ' (ограничение снято)' : ''}</span></div>
      ${org.length ? `<div class="dorg">${esc(org.join('; '))}</div>` : ''}
    </div>`;
  }).join('') : '<div class="empty">Выберите форму, вид терапии, категорию и молекулы</div>';
}
function renderConds() {
  $('#condN').textContent = S.cond.length ? 'отмечено: ' + S.cond.length : '';
  $('#conds').innerHTML = CONDITIONS.map(c => `<button type="button" class="cchip" data-cond="${c.k}" aria-pressed="${S.cond.includes(c.k)}">${esc(c.n)}</button>`).join('');
  $('#condClear').hidden = !S.cond.length;
}

/* ---------- Вывод ---------- */
function update(keepItems) {
  save(); renderCtor(); if (!keepItems) renderItems(); renderConds();
  const live = S.items.filter(it => availIn(it.n, S.form));
  LASTRES = live.length ? analyzeSiteForm(live, S.form) : null;
  LAST = analyzeDoc([...new Set(live.map(it => sid(it.n)))], S.cond);
  renderOut(LAST);
}
const mlinks = ids => [...new Set(ids)].map(id => `<button type="button" class="mlink" data-mol="${id}">${esc(nm(id))}</button>`).join(', ');
function interHTML(f) {
  return `<div class="fnd ${DOC_SEV[f.sev].k}"><div class="fnd-h">${dsev(f.sev)}<span class="ty">${esc(f.type)}</span></div>
    <div class="fnd-t">${mlinks(f.ids)}</div>
    <div class="act">${esc(f.act)}</div>
    <details class="why"><summary>Почему</summary><p>${esc(f.mech)}</p></details></div>`;
}
function synHTML(f) {
  return `<div class="fnd syn"><div class="fnd-h">${badge('syn', 'Синергия')}<span class="ty">${esc(f.type)}</span></div>
    <div class="fnd-t">${mlinks(f.ids)}</div><p>${esc(f.mech)}</p></div>`;
}
function renderOut(r) {
  const out = $('#out');
  if (!r.verdict) { out.innerHTML = `<div class="card verdict"><div class="v-title"><span class="big" style="color:var(--text)">Выберите вещества</span></div><div class="v-desc">Появятся синергия, взаимодействия, противопоказания и схема приёма.</div></div>`; return; }
  let v = r.verdict;
  const live = S.items.filter(it => availIn(it.n, S.form));
  const FF = siteFormsFor(live, S.form); LASTF = FF;
  // совместимость в выбранной форме (химия и технология — простыми словами) + таблица аптеки
  const FN = SFORM[S.form].n;
  const ffs = LASTRES ? formFindings(LASTRES).sort((a, b) => b.sev - a.sev) : [];
  const incl = []; const ids = r.ids;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const l = siteInc(ids[i], ids[j]); if (l) incl.push({ l, ids: [ids[i], ids[j]] }); }
  const fmax = Math.max(0, ...ffs.map(f => f.sev), ...incl.map(x => x.l === 'high' ? 4 : 2));
  if (fmax >= 4 && v.k !== 'crit') v = { k: 'crit', t: 'Несовместимо в форме «' + FN + '»', d: '' };
  else if (fmax === 3 && (v.k === 'ok' || v.k === 'mod')) v = { k: 'major', t: 'Проблемы в форме «' + FN + '»', d: '' };
  const pc = r.patient.reduce((a, c) => a + c.items.filter(x => x.sev >= 2 && !isFallback(x)).length, 0);
  const i3 = r.inter.filter(f => f.sev === 3).length, i2 = r.inter.filter(f => f.sev === 2).length;
  let h = `<div class="card verdict ${v.k}">
    <div class="v-top"><div class="v-title">${(I[v.k] || '').replace('<svg ', '<svg class="vi" ')}<span class="big">${v.t}</span></div>
    <button class="btn primary" id="copyBtn" type="button">${I.copy}Копировать</button></div>
    ${(() => { const F = FF; const b = F && F.rows.filter(x => x.rating === 'best'); return b && b.length ? `<div class="focus"><span class="muted">Лучшие формы:</span> <b>${b.map(x => esc(x.n)).join(', ')}</b></div>` : (F && F.split ? '<div class="focus"><span class="muted">Формы:</span> <b>нужно разделить состав</b></div>' : ''); })()}
    <div class="counts">${r.syn.length ? badge('syn', 'Синергия · ' + r.syn.length) : ''}${pc ? badge('crit', 'Противопоказания · ' + pc) : ''}${i3 ? badge('major', 'Серьёзно · ' + i3) : ''}${i2 ? badge('mod', 'Умеренно · ' + i2) : ''}</div>
  </div>`;

  // совместимость в форме
  const fmain = ffs.filter(f => f.sev >= 2);
  h += `<div class="card"><div class="card-h"><h2>Совместимость в форме «${esc(FN)}»</h2></div>
    ${fmain.length || incl.length ? `<div class="flist">${incl.map(x => `<div class="citem">${x.l === 'high' ? badge('crit', 'Несовместимо') : badge('mod', 'Осторожно')}<span>${mlinks(x.ids).replace('</button>, <button', '</button> + <button')} — по таблице несовместимостей аптеки</span></div>`).join('')}
      ${fmain.map(f => `<div class="citem">${f.sev >= 4 ? badge('crit', 'Нельзя') : f.sev === 3 ? badge('major', 'Серьёзно') : badge('mod', 'Умеренно')}<span>${esc(reasonOf(f))}${srcTag(f)}${f.act ? `<span class="muted"> — ${esc(f.act)}</span>` : ''}</span></div>`).join('')}</div>`
      : '<div class="snote ok" style="margin-top:0">Противоречий с формой нет.</div>'}
    ${ffs.some(f => f.sev < 2) ? `<details class="more"><summary>Учесть: ${ffs.filter(f => f.sev < 2).length}</summary><div class="flist" style="margin-top:6px">${[...new Set(ffs.filter(f => f.sev < 2).map(reasonOf))].map(t => `<div class="citem">${badge('minor', 'Учесть')}<span>${esc(t)}</span></div>`).join('')}</div></details>` : ''}
  </div>`;

  // синергия — всегда, сгруппирована по типу + подсказки
  const byType = {};
  r.syn.forEach(f => { (byType[f.type] = byType[f.type] || { mech: f.mech, pairs: [] }).pairs.push(f.ids); });
  const sug = suggest(r, 30).filter(x => (SITE_IDS[x.id] || []).some(n => availIn(n, S.form))).slice(0, 8);
  h += `<div class="card syn-list"><div class="card-h"><h2>Синергия</h2></div>
    ${Object.keys(byType).length ? `<div class="flist">${Object.entries(byType).map(([t, g]) => `<div class="fnd syn"><div class="fnd-h">${badge('syn', esc(t))}</div>
      <div class="fnd-t">${g.pairs.map(p => mlinks(p).replace('</button>, <button', '</button> + <button')).join('<span class="muted"> · </span>')}</div>
      ${g.pairs.length === 1 ? `<details class="why"><summary>Почему</summary><p>${esc(g.mech)}</p></details>` : ''}</div>`).join('')}</div>`
      : `<div class="muted small">Между выбранными веществами известных синергий нет.</div>`}
    ${sug.length ? `<div class="sugg"><div class="sugg-h">Можно усилить</div><div class="pills">${sug.map(x => `<button type="button" class="addpill" data-add="${x.id}" data-t="${esc(x.type + ' — с ' + x.with.map(nm).join(', '))}">${I.plus}${esc(nm(x.id))}</button>`).join('')}</div></div>` : ''}
  </div>`;

  // противопоказания пациенту
  if (r.patient.length) {
    h += `<div class="card"><div class="card-h"><h2>Противопоказания пациенту</h2></div><div class="flist">` +
      r.patient.map(c => `<div class="crow"><div class="crow-h"><b>${esc(c.n)}</b></div>${c.items.filter(x => !isFallback(x)).map(x => `<div class="citem">${csev(x.sev)}<span><button type="button" class="mlink" data-mol="${x.id}">${esc(nm(x.id))}</button> — ${esc(x.t)}</span></div>`).join('')}${fallbackLine(c)}</div>`).join('') + '</div></div>';
  }

  // формы доставки
  if (FF) h += formsHTML(FF);

  // взаимодействия
  const main = r.inter.filter(f => f.sev >= 2), minor = r.inter.filter(f => f.sev < 2);
  if (r.inter.length) h += `<div class="card"><div class="card-h"><h2>Взаимодействия</h2></div><div class="flist">${main.map(interHTML).join('')}
    ${minor.length ? `<details class="more"${main.length ? '' : ' open'}><summary>Учесть: ${minor.length}</summary><div class="flist" style="margin-top:6px">${minor.map(interHTML).join('')}</div></details>` : ''}</div></div>`;

  // метаболическая нагрузка и общие мишени
  h += pkHTML(r);

  // направленность
  h += `<div class="card"><div class="card-h"><h2>Направленность</h2></div><div class="dirs">` +
    r.dirList.map(d => `<div class="drow${d.ids.length > 1 ? ' strong' : ''}"><div class="dn">${esc(d.n)}</div><div class="dbar"><i style="width:${Math.round(d.ids.length / r.ms.length * 100)}%"></i></div><div class="dm">${mlinks(d.ids)}</div></div>`).join('') +
    '</div></div>';

  // схема приёма
  const s = r.schedule;
  const col = k => s.slots[k].length ? `<div class="scol"><div class="sh">${k === 'morning' ? I.sunrise : k === 'evening' ? I.moon : I.clock}${SLOT_N[k]}</div>${s.slots[k].map(id => `<div class="sitem"><button type="button" class="mlink" data-mol="${id}">${esc(nm(id))}</button>${s.tim[id].food ? `<span class="tag">${FOOD_N[s.tim[id].food]}</span>` : ''}</div>`).join('')}</div>` : '';
  h += `<div class="card"><div class="card-h"><h2>Схема приёма</h2></div>
    <div class="sched">${col('morning')}${col('any')}${col('evening')}</div>
    ${s.separate.length ? `<div class="snote"><b>Разнести ≥ 2 ч:</b> ${s.separate.map(([a, b]) => esc(nm(a)) + ' ↔ ' + esc(nm(b))).join('; ')}</div>` : ''}
    ${r.groups && r.groups.length > 1 ? `<div class="snote"><b>${r.groups.length} ${plural(r.groups.length, 'приём', 'приёма', 'приёмов')}:</b> ${r.groups.map((g, i) => `${i + 1}) ${g.map(id => esc(nm(id))).join(', ')}`).join('; ')}</div>` : ''}
  </div>`;

  // противопоказания при других состояниях — свёрнуто
  const other = r.condRows.filter(c => !c.sel);
  if (other.length || r.notes.length) {
    h += `<div class="card"><details class="more"><summary><h2 style="display:inline">Противопоказания при других состояниях</h2> <span class="muted">(${other.length})</span></summary>
      <div class="ctable">${other.map(c => `<div class="crow2"><div class="cn">${esc(c.n)}</div><div class="cv">${c.items.filter(x => !isFallback(x)).map(x => `<span class="cpill ${CONTRA_SEV[x.sev].k}" data-t="${esc(CONTRA_SEV[x.sev].t + ': ' + x.t)}" data-mol="${x.id}">${esc(nm(x.id))}</span>`).join('')}${fallbackLine(c, true)}</div></div>`).join('')}</div>
      <div class="legend"><span><i style="background:var(--crit)"></i>противопоказано</span><span><i style="background:var(--mod)"></i>с осторожностью</span><span><i style="background:var(--minor-bg);outline:1px solid var(--minor)"></i>учесть</span></div>
      ${r.notes.length ? `<div class="notes2">${r.notes.map(n => `<div><b>${esc(nm(n.id))}:</b> ${esc(n.t)}</div>`).join('')}</div>` : ''}
    </details></div>`;
  }
  out.innerHTML = h;
}
function pkHTML(r) {
  const L = pkLoad(r.ids); if (!L.rows.length && !L.shared.length) return '';
  const kid = S.cond.includes('kidney') || S.cond.includes('liver');
  const main = L.rows.filter(x => x.sub.length), inhOnly = L.rows.filter(x => !x.sub.length);
  const chip = (s, cls) => `<button type="button" class="cpill ${cls || ''}" data-mol="${s.id}"${s.minor ? ' data-t="минорный путь / слабое действие"' : ''}>${esc(sn(s.id))}${s.minor ? '<sup>*</sup>' : ''}</button>`;
  const row = x => { let lv = x.lvl; if (x.k === 'Почки' && S.cond.includes('kidney')) lv = Math.max(lv, 2) + (x.sub.length >= 3 ? 1 : 0); lv = Math.min(3, lv);
    return `<div class="pkrow"><div class="pkn">${esc(x.n)}</div><div class="pkl"><span class="lvl l${lv}">${LOAD_N[lv].t}</span></div>
    <div class="pkm">${x.sub.map(s => chip(s)).join('')}${x.inh.length ? `<span class="pkt">тормозит:</span>${x.inh.map(s => chip(s, 'crit')).join('')}` : ''}${x.ind.length ? `<span class="pkt">ускоряет:</span>${x.ind.map(s => chip(s, 'syn')).join('')}` : ''}
    ${x.note.length ? `<div class="pkno">${esc(x.note.join('; '))}</div>` : ''}</div></div>`; };
  return `<div class="card"><div class="card-h"><h2>Метаболическая нагрузка</h2></div>
    ${main.length ? `<div class="pk">${main.map(row).join('')}</div>` : '<div class="muted small">Значимых путей метаболизма у состава нет.</div>'}
    ${inhOnly.length ? `<div class="snote"><b>Влияет на ферменты других препаратов пациента:</b> ${inhOnly.map(x => `${esc(x.k)} — ${x.inh.length ? 'тормозят ' + x.inh.map(s => esc(sn(s.id))).join(', ') : ''}${x.ind.length ? (x.inh.length ? '; ' : '') + 'ускоряют ' + x.ind.map(s => esc(sn(s.id))).join(', ') : ''}`).join('; ')}</div>` : ''}
    ${L.shared.length ? `<div class="sugg"><div class="sugg-h">Общие мишени (эффекты суммируются)</div>${L.shared.map(t => `<div class="pkrow2"><b>${esc(t.k)}</b> — ${t.ids.map(id => `<button type="button" class="mlink" data-mol="${id}">${esc(sn(id))}</button>`).join(', ')}</div>`).join('')}</div>` : ''}
    <div class="muted small" style="margin-top:8px">* минорный путь или слабое действие (часто — данные in vitro).${kid ? ' Нагрузка на почки и печень учитывает отмеченные состояния.' : ''}</div>
  </div>`;
}
function formsHTML(FF, compact) {
  const groups = ['best', 'ok', 'limit', 'no'].map(k => [k, FF.rows.filter(r => r.rating === k)]).filter(g => g[1].length);
  const row = r => `<div class="frow ${r.rating}"><div class="fn">${esc(r.n)}${r.note ? ` <span class="muted small">· ${esc(r.note)}</span>` : ''}</div><div class="fr">${esc(r.reasons.join('; '))}</div></div>`;
  return `<div class="card"><div class="card-h"><h2>Формы доставки</h2>${!compact ? '<span class="sub">другие формы — по профилактическим дозам сайта</span>' : ''}</div>
    <div class="fgroups">${groups.map(([k, rs]) => `<div class="fgroup">${badge(RATING[k].k, RATING[k].t)}<div class="flist2">${rs.map(row).join('')}</div></div>`).join('')}</div>
    ${FF.split ? `<div class="snote"><b>Целиком ни одна форма не подходит. Разделить:</b> ${FF.split.map((g, i) => `${i + 1}) ${g.ids.map(id => esc(sn(id))).join(', ')} — ${esc(formName(g.form))}`).join('; ')}</div>` : ''}
    ${FF.na.length ? `<div class="muted small" style="margin-top:10px">Не применяется для этого состава: ${FF.na.map(f => esc(formName(f))).join(', ')}</div>` : ''}
  </div>`;
}
function isFallback(x) { return x.c === 'preg' && x.sev === 2 && /недостаточно/.test(x.t); }
function fallbackLine(c, compact) {
  const fb = c.items.filter(isFallback); if (!fb.length) return '';
  return compact ? `<span class="muted small fbl" data-t="${esc(fb.map(x => nm(x.id)).join(', '))}">нет данных о безопасности: ${fb.length}</span>`
    : `<div class="citem">${csev(2)}<span>Нет достаточных данных о безопасности: ${mlinks(fb.map(x => x.id))}</span></div>`;
}

/* ---------- Карточка вещества ---------- */
function renderMol(id) {
  const m = BY[id]; const el = $('#mol');
  if (!m || m.kind === 'excipient') { el.innerHTML = '<div class="card"><div class="empty">Выберите вещество: направленность, рекомендуемое время приёма, полезные сочетания, взаимодействия и противопоказания.</div></div>'; return; }
  CUR_MOL = id;
  const p = partners(id); const tm = timing(m); const ct = contraFor(m).sort((a, b) => b.sev - a.sev);
  const dirs = (DIR_OF[id] || []).map(k => DIRS[k].n);
  const chips = (arr, cls) => arr.map(x => `<button type="button" class="cpill ${cls ? cls(x) : ''}" data-mol="${x.id}" title="${esc(x.type || '')}">${esc(nm(x.id))}</button>`).join('');
  let h = `<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
    <div><h2 style="font-size:20px">${esc(m.ru)}</h2><div class="muted">${esc(m.en)} · ${esc(m.cat)}${m.T.has('rx') ? ' · <span class="tag">рецептурный</span>' : ''}</div></div>
    ${SITE_IDS[id] ? `<button class="btn primary" type="button" data-addmol="${id}"${idsOf().includes(id) ? ' disabled' : ''}>${I.plus}${idsOf().includes(id) ? 'Уже в составе' : 'Добавить в состав'}</button>` : '<span class="tag">нет в конструкторе аптеки</span>'}</div>
    ${effOf(m) ? `<p class="v-desc" style="margin:10px 0 0;font-size:15px">${esc(effOf(m))}</p>` : ''}
    <div class="kv" style="margin-top:12px">
      <div class="stat"><div class="k">Направленность</div><div class="d" style="font-size:13.5px;color:var(--text)">${dirs.length ? esc(dirs.join(', ')) : BIOENH.has(id) ? 'усилитель всасывания' : '—'}</div></div>
      <div class="stat"><div class="k">Время приёма</div><div class="d" style="font-size:13.5px;color:var(--text)">${SLOT_N[tm.slot]}${tm.food ? ', ' + FOOD_N[tm.food] : ''}</div></div>
      ${m.pharm && m.pharm.bf ? `<div class="stat"><div class="k">Форма в аптеке</div><div class="d" style="font-size:13.5px;color:var(--text)">${esc(m.pharm.bf)}</div></div>` : ''}
    </div>
    ${clinText(m) ? `<div class="notes2" style="margin-top:12px"><div>${esc(clinText(m))}</div></div>` : ''}
  </div>`;
  const P1 = pkOf(id);
  if (P1) { const line = (k, arr) => arr.length ? `<div class="pkrow2"><span class="muted">${k}:</span> ${arr.map(esc).join('; ')}</div>` : '';
    const body = line('Рецепторы', P1.rec) + line('Ферменты-мишени', P1.enz) + line('Метаболизм и выведение', P1.met) + line('Тормозит ферменты', P1.inh) + line('Ускоряет ферменты', P1.ind);
    if (body) h += `<div class="card"><div class="card-h"><h2>Мишени и метаболизм</h2></div>${body}</div>`; }
  (SITE_IDS[id] || []).forEach(n => {
    h += `<div class="card"><div class="card-h"><h2>В конструкторе: ${esc(n)}</h2><span class="sub">${esc((SITE_PATH[n] || []).map(p => p.join(' → ')).join('; '))}</span></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Форма</th><th class="num">Субклин.</th><th class="num">Профилакт.</th><th class="num">Терапевт.</th><th class="num">Максимум</th></tr></thead><tbody>
      ${SITE.forms.map(f => { const d = siteDose(n, f.code); return d ? `<tr><td>${esc(f.n)}</td><td class="num mono">${fmt(d.sub, 3)}</td><td class="num mono">${fmt(d.prof, 3)}</td><td class="num mono">${fmt(d.ther, 3)}</td><td class="num mono">${fmt(d.max, 3)} ${esc(UNIT_N[d.u] || d.u)}</td></tr>` : ''; }).join('')}
      </tbody></table></div><div class="muted small" style="margin-top:6px">Суточные дозы из конструктора заказов аптеки.</div></div>`;
  });
  h += `<div class="card"><div class="card-h"><h2>Хорошо сочетается</h2><span class="sub">${p.syn.length}</span></div>${p.syn.length ? `<div class="pills">${chips(p.syn, () => 'syn')}</div>` : '<div class="muted small">Известных синергий в базе нет</div>'}</div>`;
  h += `<div class="card"><div class="card-h"><h2>Взаимодействия</h2><span class="sub">${p.inter.length}</span></div>${p.inter.length ? `<div class="pills">${chips(p.inter, x => DOC_SEV[x.sev].k)}</div><div class="legend"><span><i style="background:var(--major)"></i>серьёзно</span><span><i style="background:var(--mod)"></i>умеренно</span><span><i style="background:var(--minor-bg);outline:1px solid var(--minor)"></i>учесть</span><span class="muted">наведите — тип взаимодействия</span></div>` : '<div class="muted small">Значимых взаимодействий в базе нет</div>'}</div>`;
  h += `<div class="card"><div class="card-h"><h2>Противопоказания и осторожность</h2></div>${ct.length ? '<div class="flist">' + ct.map(c => `<div class="citem">${csev(c.sev)}<span><b>${esc(COND_N[c.c])}.</b> ${esc(c.t)}</span></div>`).join('') + '</div>' : '<div class="muted small">По базе не отмечены</div>'}
    ${GENERAL_NOTES.filter(n => m.T.has(n.tag)).map(n => `<div class="notes2" style="margin-top:8px"><div>${esc(n.t)}</div></div>`).join('')}</div>`;
  h += niCardHTML(m, { collapsed: true });
  el.innerHTML = h;
}

// клинические заметки без технологии и химии
const TECH_RE = /pH|раствор|рецептур|капсул|жидк|поставки|сол[ьия]|осад|окисл|стабил|гигроскоп|Майяр|основ[аеуы]\b|троше|свеч|флакон|подкисл|подщел|буфер|суспенз|кристалл|эмульс|хранен|сочетать с кислот|влажн|в одной форме|этанол|ПАВ|электролит|заморажив|нагрев|Липосомы разруш/i;
function clinText(m) { return String(m.clin || '').split(/(?<=[.!?])\s+/).filter(x => x && !TECH_RE.test(x)).join(' '); }

/* ---------- О методе ---------- */
function renderMethod() {
  $('#method').innerHTML = `<h2 style="margin-top:0">О методе</h2>
<p>Врачебная версия оценивает состав с клинической стороны: на что он направлен, какие сочетания полезны, какие компоненты противоречат друг другу и кому состав противопоказан. Химическая и технологическая совместимость в лекарственной форме (pH, растворимость, реакции, основа) здесь не показывается — её проверяет провизор-технолог в <a href="${TECH_URL}" target="_blank" rel="noopener">технологической версии</a>.</p>
<h3>Конструктор</h3><p>Подбор устроен как конструктор заказов аптеки: форма → вид терапии → категория → молекула. Названия, рубрики, 9 форм, доступность молекул в формах и суточные дозы с зонами (субклиническая, профилактическая, терапевтическая, максимум) взяты из справочника конструктора аптеки (15.11.2026); «Снять ограничение» удваивает максимум, как на сайте. Отметка у молекулы в списке показывает, как она сочетается с уже выбранными: <b>синергия</b>, <b>осторожно</b> или <b>конфликт</b> — с учётом фармакологии, химии в выбранной форме, противопоказаний отмеченным состояниям пациента и таблицы несовместимостей аптеки (уровни high и medium; low не показываются).</p>
<h3>Направленность</h3><p>Каждое вещество базы отнесено к 1–3 направлениям (энергия, сон и стресс, сосуды, углеводный обмен, печень, ЖКТ, гормоны и др.) по фармакологическому действию. Направление, к которому относятся несколько компонентов, выделено — эффекты в нём усиливают друг друга.</p>
<h3>Синергия</h3><p>Известные полезные сочетания: биодоступность (пиперин, фосфолипиды, липиды), кофакторы (D3 + K2, магний + D3, B12 + фолат + B6), восполнение дефицита (метформин + B12), общие пути (цитруллин + аргинин, ФДЭ-5 + донаторы NO).</p>
<h3>Взаимодействия</h3><p>Суммирование эффектов (гипогликемический, антиагрегантный, гипотензивный, седативный, стимулирующий, серотонинергический, нагрузка на печень), антагонизм и противоположное время приёма, конкуренция за всасывание (железо и кальций, транспорт аминокислот), ингибирование ферментов метаболизма (CYP3A4, CYP1A2, P-гликопротеин).</p>
<p>Тяжесть: <b>Серьёзно</b> — изменить состав или разделить приём; <b>Умеренно</b> — допустимо с контролем; <b>Учесть</b> — справочно.</p>
<h3>Противопоказания</h3><p>Для 17 клинических ситуаций (беременность, антикоагулянты, сахароснижающая терапия, гипертензия, антидепрессанты, гормонозависимые опухоли, щитовидная железа, печень, почки и др.) у каждого вещества отмечено: <b>противопоказано</b>, <b>с осторожностью</b> или <b>учесть</b>. Отмеченные состояния пациента выносятся в начало и определяют вердикт.</p>
<h3>Мишени и метаболическая нагрузка</h3><p>Для каждого вещества указаны рецепторы, ферменты-мишени, пути метаболизма и выведения, а также ферменты, которые вещество тормозит или ускоряет (DrugBank, Natural Medicines, обзоры по фармакокинетике; данные in vitro помечены). Нагрузка на фермент считается по числу веществ состава, которые через него выводятся (основной путь — 1, минорный — 0,5): 1 — низкая, 2 — умеренная, 3 и более — высокая. Если в составе есть ингибитор этого фермента, нагрузка повышается на ступень. Для высокоёмких путей (глюкуронидация, сульфатирование, почки) нагрузка не выше умеренной; при отмеченной ХБП нагрузка на почки повышается. Ферменты, которые состав тормозит или ускоряет без собственных субстратов, показаны отдельно — это важно для других препаратов пациента. Общие мишени — рецепторы и ферменты, на которые действуют два и более вещества.</p>
<h3>Схема приёма</h3><p>Время суток и связь с едой — по фармакологии (стимуляторы утром, седативные вечером, жирорастворимые с едой). Конфликтующие пары разносятся по разным приёмам (раскраска графа конфликтов).</p>
<h3>Ограничения</h3><ul><li>Справочная оценка по базе из 262 активных веществ; не учитываются дозы, индивидуальные особенности и полный список принимаемых препаратов.</li><li>Перечень противопоказаний не исчерпывающий — для рецептурных препаратов действует инструкция.</li><li>Решение о назначении принимает врач.</li></ul>
<h3>Источники</h3><ul><li>Natural Medicines Comprehensive Database; Stockley's Drug Interactions; Stockley's Herbal Medicines Interactions.</li><li>Инструкции по медицинскому применению рецептурных препаратов.</li><li>Обзорные публикации по отдельным сочетаниям (Shoba 1998 — пиперин и куркумин; Sekhar 2021 — GlyNAC и др.).</li></ul>`;
}

function pkReport(r) {
  if (!r || !r.ids.length) return '';
  const L = pkLoad(r.ids); const rows = L.rows.filter(x => x.sub.length && x.lvl >= 2);
  if (!rows.length && !L.shared.length) return '';
  const out = ['', 'Метаболическая нагрузка:'];
  rows.forEach(x => out.push(`  ${x.n} — ${LOAD_N[x.lvl].t.toLowerCase()}: ${x.sub.map(s => sn(s.id)).join(', ')}${x.inh.length ? '; тормозят: ' + x.inh.map(s => sn(s.id)).join(', ') : ''}${x.ind.length ? '; ускоряют: ' + x.ind.map(s => sn(s.id)).join(', ') : ''}`));
  if (L.shared.length) out.push('  Общие мишени: ' + L.shared.map(t => `${t.k} (${t.ids.map(sn).join(', ')})`).join('; '));
  return '\n' + out.join('\n');
}
function formsReport(F) {
  if (!F) return '';
  const L = ['', 'Формы доставки' + (F.typical ? ' (где доза не указана — по типичной)' : '') + ':'];
  ['best', 'ok', 'limit', 'no'].forEach(k => { const rs = F.rows.filter(r => r.rating === k); if (rs.length) L.push(`  ${RATING[k].t}: ` + rs.map(r => r.n + (r.reasons.length && k !== 'best' ? ` (${r.reasons[0]})` : '')).join('; ')); });
  if (F.split) L.push('  Разделить: ' + F.split.map((g, i) => `${i + 1}) ${g.ids.map(sn).join(', ')} — ${formName(g.form).toLowerCase()}`).join('; '));
  return '\n' + L.join('\n');
}

/* ---------- Сервис ---------- */
function copyText(t) {
  const done = () => toast('Заключение скопировано');
  const fb = () => { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Не удалось скопировать'); } ta.remove(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fb); else fb();
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1800); }
function themeGet() { try { return localStorage.getItem('cc_theme') || 'auto'; } catch (e) { return 'auto'; } }
function themeSet(t) {
  try { localStorage.setItem('cc_theme', t); } catch (e) {}
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const n = { auto: 'Тема: как в системе', light: 'Тема: светлая', dark: 'Тема: тёмная' }[t];
  $('#themeBtn').innerHTML = I[t === 'auto' ? 'auto' : t === 'light' ? 'sun' : 'moon']; $('#themeBtn').title = n; $('#themeBtn').setAttribute('aria-label', n);
}
const tip = $('#tip');
function route() {
  const h = location.hash.slice(1); let tab = 'recipe';
  if (h.startsWith('card')) { tab = 'card'; renderMol(decodeURIComponent(h.split('/')[1] || '') || CUR_MOL); }
  else if (h === 'method') tab = 'method';
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  ['recipe', 'card', 'method'].forEach(t => { $('#tab-' + t).hidden = t !== tab; });
  if (tab !== 'recipe') window.scrollTo(0, 0);
}

function init() {
  restore(); renderMethod();
  if (innerWidth >= 960 || S.cond.length) $('#condBox').open = true;
  bindPicker($('#q2').closest('.search'), m => { location.hash = '#card/' + m.id; }, { isAdded: id => id === CUR_MOL });
  themeSet(themeGet());
  $('#themeBtn').addEventListener('click', () => { const o = ['auto', 'light', 'dark']; themeSet(o[(o.indexOf(themeGet()) + 1) % 3]); });
  $('#ftiles').addEventListener('click', e => { const b = e.target.closest('[data-form]'); if (b && b.dataset.form !== S.form) setForm(b.dataset.form); });
  $('#colTh').addEventListener('click', e => { const b = e.target.closest('[data-th]'); if (!b) return; S.th = +b.dataset.th; S.cat = 0; S.q = ''; $('#q').value = ''; renderCtor(); });
  $('#colCat').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; S.cat = +b.dataset.cat; S.q = ''; $('#q').value = ''; renderCtor(); });
  $('#colMol').addEventListener('click', e => {
    const st = e.target.closest('.mst'); if (st && matchMedia('(hover: none)').matches) { toast(st.dataset.t.replace(/\n/g, '; ')); return; }
    const b = e.target.closest('[data-sn]'); if (b) addSite(b.dataset.sn);
  });
  $('#q').addEventListener('input', e => { S.q = e.target.value; renderCtor(); });
  $('#unlim').addEventListener('change', e => { S.unlim = e.target.checked; S.items.forEach(it => { const d = siteDose(it.n, S.form); if (d && it.amt > maxOf(d)) it.amt = maxOf(d); }); update(); });
  $('#items').addEventListener('click', e => { const r = e.target.closest('[data-rmn]'); if (r) { S.items = S.items.filter(it => it.n !== r.dataset.rmn); update(); } });
  $('#items').addEventListener('input', e => {
    const k = e.target.dataset.amt ?? e.target.dataset.amtn; if (k == null) return;
    const it = S.items[+k], d = siteDose(it.n, S.form); it.amt = Math.max(0, Math.min(maxOf(d), +e.target.value || 0));
    const card = e.target.closest('.dcard');
    card.querySelectorAll('[data-amt],[data-amtn]').forEach(x => { if (x !== e.target || +x.value > it.amt) x.value = it.amt; });
    const z = zoneOf(it.amt, d); const zt = card.querySelector('.zone'); zt.className = 'zone ' + (z || ''); zt.textContent = z ? ZONES[z] : 'доза не указана';
    card.querySelector('.zbar').outerHTML = zoneBar(d, it.amt);
    save(); clearTimeout(window._dt); window._dt = setTimeout(() => update(true), 300);
  });
  $('#conds').addEventListener('click', e => { const c = e.target.closest('[data-cond]'); if (!c) return; const k = c.dataset.cond; S.cond = S.cond.includes(k) ? S.cond.filter(x => x !== k) : S.cond.concat(k); update(); });
  $('#condClear').addEventListener('click', () => { S.cond = []; update(); });
  $('#clearBtn').addEventListener('click', () => { S.items = []; update(); });
  document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; if (b.dataset.tab === 'recipe') { history.replaceState(null, '', location.pathname + location.search); route(); } else location.hash = b.dataset.tab === 'card' ? '#card/' + (CUR_MOL || '') : '#method'; });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-addmol]'); if (a) { addId(a.dataset.addmol); history.replaceState(null, '', location.pathname + location.search); route(); return; }
    const ad = e.target.closest('[data-add]'); if (ad) { addId(ad.dataset.add); return; }
    const m = e.target.closest('[data-mol]'); if (m) { location.hash = '#card/' + m.dataset.mol; return; }
    if (e.target.closest('#copyBtn')) copyText(siteReport() + '\n\n' + docReport(LAST) + formsReport(LASTF) + pkReport(LAST));
  });
  document.addEventListener('mouseover', e => { const t = e.target.closest('[title].cpill'); if (t && t.title) { t.dataset.t = t.title; t.removeAttribute('title'); } const d = e.target.closest('[data-t]'); if (d) { tip.textContent = d.dataset.t; tip.hidden = false; } });
  document.addEventListener('mousemove', e => { if (tip.hidden) return; if (!e.target.closest('[data-t]')) { tip.hidden = true; return; } const w = tip.offsetWidth, hh = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY + 14; if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + hh > innerHeight - 8) y = e.clientY - hh - 14; tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px'; });
  window.addEventListener('hashchange', route);
  update(); route();
}
function siteReport() {
  const L = ['ЗАКАЗ: ' + SFORM[S.form].n];
  S.items.forEach((it, k) => { const d = siteDose(it.n, S.form); L.push(`  ${k + 1}. ${it.n} — ${d ? fmt(+it.amt, 3) + ' ' + (UNIT_N[d.u] || d.u) + '/сут (' + (ZONES[zoneOf(+it.amt, d)] || '—') + ')' : 'нет в этой форме'}`); });
  if (S.unlim) L.push('  Ограничение на максимальную дозу снято — требуется консультация фармацевта.');
  const ffs = LASTRES ? formFindings(LASTRES).filter(f => f.sev >= 2) : [];
  if (ffs.length) { L.push('Совместимость в форме:'); [...new Set(ffs.map(reasonOf))].forEach(t => L.push('  • ' + t)); }
  return L.join('\n');
}
init();
