// Загружает ядро, правила и врачебный движок в контекст Node
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), tech = path.join(root, '..', 'compat-calc');
const SRC = [path.join(tech, 'src/core.js'), path.join(tech, 'src/rules.js'), path.join(tech, 'src/engine.js'), path.join(root, 'src/doc-data.js'), path.join(root, 'src/doc-engine.js'), path.join(root, 'src/doc-forms.js')];
function load() {
  const json = fs.readFileSync(path.join(tech, 'data/molecules.json'), 'utf8');
  const ctx = { document: { getElementById: () => ({ textContent: json }) }, console };
  vm.createContext(ctx);
  vm.runInContext(SRC.map(f => fs.readFileSync(f, 'utf8')).join('\n;\n') + '\n;globalThis.API = { formsFor, analyzeDoc, partners, suggest, synBetween, docReport, contraFor, BY, DIRS, DIR_OF, CONDITIONS };', ctx);
  return ctx.API;
}
module.exports = { load, SRC };
