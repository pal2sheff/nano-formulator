// Сборка сайта для GitHub Pages: node build-site.js → docs/
//   docs/index.html — выбор версии, docs/vrach/ — врачебная, docs/tehnolog/ — технологическая,
//   docs/<имя>/ — дополнения из addons/<имя>/ (см. addons/README.md)
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const R = (...p) => path.join(__dirname, ...p);
execSync('node build.js', { cwd: R('compat-calc'), stdio: 'inherit' });
execSync('node build.js', { cwd: R('doctor'), stdio: 'inherit' });
const OUT = R('docs');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(R('docs', 'vrach'), { recursive: true });
fs.mkdirSync(R('docs', 'tehnolog'), { recursive: true });
// ссылка «на главную» в шапке и перекрёстные ссылки между версиями
const HOME_CSS = '<style>.home{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;border:1.5px solid var(--border-2);color:var(--ni-blue,var(--accent));text-decoration:none;font-size:16px;margin-right:4px;flex:none}.home:hover{border-color:var(--ni-blue,var(--accent))}.brand{align-items:center}</style>';
const withHome = (html, other, otherName) => html
  .replace('<div class="brand"><h1>', `<div class="brand"><a href="../" class="home" title="Все версии" aria-label="Все версии">←</a><h1>`)
  .replace('</head>', HOME_CSS + '</head>')
  .replace(/https:\/\/claude\.ai\/artifact\/2jpwvZxpZPbxpssj4UToem/g, '../tehnolog/');
fs.writeFileSync(R('docs', 'vrach', 'index.html'), withHome(fs.readFileSync(R('doctor', 'index.html'), 'utf8')));
fs.writeFileSync(R('docs', 'tehnolog', 'index.html'), withHome(fs.readFileSync(R('compat-calc', 'index.html'), 'utf8')));
// главная
const font = (fam, w, file, sub) => `@font-face{font-family:'${fam}';font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(R('compat-calc', 'assets', 'fonts', `${file}-${sub}-${w}-normal.woff2`)).toString('base64')}) format('woff2')}`;
const fonts = ['cyrillic', 'latin'].map(s => font('Unbounded', 500, 'unbounded', s) + font('IBM Plex Sans', 400, 'ibm-plex-sans', s) + font('IBM Plex Sans', 500, 'ibm-plex-sans', s)).join('\n');
// дополнения: addons/<имя>/ с build.js и addon.json; сборка дополнения пишет файлы в addons/<имя>/dist/
const ADDONS = [];
if (fs.existsSync(R('addons'))) for (const name of fs.readdirSync(R('addons')).sort()) {
  const dir = R('addons', name);
  if (name.startsWith('_') || name.startsWith('.') || !fs.statSync(dir).isDirectory() || !fs.existsSync(path.join(dir, 'build.js'))) continue;
  const meta = fs.existsSync(path.join(dir, 'addon.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'addon.json'), 'utf8')) : {};
  const slug = meta.path || name;
  if (['vrach', 'tehnolog'].includes(slug)) throw new Error('Дополнение не может занимать адрес основной версии: ' + slug);
  execSync('node build.js', { cwd: dir, stdio: 'inherit' });
  fs.cpSync(path.join(dir, 'dist'), R('docs', slug), { recursive: true });
  ADDONS.push(Object.assign({ path: slug, title: name, tag: 'Дополнение', desc: [] }, meta));
}
const addonCards = ADDONS.filter(a => a.landing !== false).map(a => `
    <a class="card" href="${a.path}/">
      <span class="tag">${a.tag}</span>
      <h2>${a.title}</h2>
      ${a.desc.length ? '<ul>' + a.desc.map(d => '<li>' + d + '</li>').join('') + '</ul>' : ''}
      <span class="btn outline">Открыть</span>
    </a>`).join('');
const db = JSON.parse(fs.readFileSync(R('compat-calc', 'data', 'molecules.json'), 'utf8'));
const nAct = db.filter(m => m.kind !== 'excipient').length;
fs.writeFileSync(R('docs', 'index.html'), fs.readFileSync(R('site', 'landing.html'), 'utf8')
  .replace('/*FONTS*/', () => fonts).replace('<!--ADDONS-->', () => addonCards).replace(/\{\{N\}\}/g, String(db.length)).replace(/\{\{NACT\}\}/g, String(nAct)));
fs.writeFileSync(R('docs', '.nojekyll'), '');
console.log('docs/ готово:', fs.readdirSync(OUT).join(', '));
