// Досчитывает p1 (pH 1% раствора, 10 мг/мл с учётом растворимости) для записей без него: node tools/calc_p1.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const F = path.join(__dirname, '..', 'data', 'molecules.json');
const json = fs.readFileSync(F, 'utf8');
const ctx = { document: { getElementById: () => ({ textContent: json }) } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'core.js'), 'utf8') + ';globalThis.R={BY,solvePH,solAt};', ctx);
const db = JSON.parse(json); let n = 0;
for (const m of db) {
  if (m.p1 != null || !(m.sp && m.sp.length) || !m.mw) continue;
  const M = ctx.R.BY[m.id];
  let ph = 7;
  for (let k = 0; k < 4; k++) { const S = ctx.R.solAt(M, ph); const c = Math.min(10, S == null ? 10 : S) / m.mw; ph = ctx.R.solvePH([{ c, sp: M.SP }]); }
  m.p1 = +ph.toFixed(2); n++; console.log(m.id, m.p1);
}
fs.writeFileSync(F, JSON.stringify(db));
console.log('p1 рассчитан:', n);
