// Загружает ядро и движок в изолированный контекст Node (без браузера)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
function load() {
  const json = fs.readFileSync(path.join(root, 'data/molecules.json'), 'utf8');
  const ctx = { document: { getElementById: () => ({ textContent: json }) }, console };
  vm.createContext(ctx);
  const src = ['src/core.js', 'src/rules.js', 'src/engine.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
  vm.runInContext(src + '\n;globalThis.API = { analyze, suggestSplit, suitability, pairMatrix, reportText, BY, FORMS, FORM_DEFAULTS, SEV, CAT, solvePH };', ctx, { filename: 'bundle.js' });
  return ctx.API;
}
module.exports = { load };
