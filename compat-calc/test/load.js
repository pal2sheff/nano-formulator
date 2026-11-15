// Загружает ядро и движок в изолированный контекст Node (без браузера)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
function load() {
  const json = fs.readFileSync(path.join(root, 'data/molecules.json'), 'utf8');
  const ctx = { document: { getElementById: () => ({ textContent: json }) }, console };
  vm.createContext(ctx);
  const src = ['src/core.js', 'src/rules.js', 'src/engine.js', 'src/site-core.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n').replace('/*SITE*/null', () => fs.readFileSync(path.join(root, 'data/site_catalog.json'), 'utf8'));
  vm.runInContext(src + '\n;globalThis.API = { SITE, siteDose, engineFor, engineItems, engineP, sitePairStatus, zoneOf, analyze, suggestSplit, suitability, pairMatrix, reportText, BY, FORMS, FORM_DEFAULTS, SEV, CAT, solvePH };', ctx, { filename: 'bundle.js' });
  return ctx.API;
}
module.exports = { load };
