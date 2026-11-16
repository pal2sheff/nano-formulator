// Сборка дополнения: node build.js → dist/index.html (фирменный стиль и база — из основной части, только чтение)
const fs = require('fs'), path = require('path');
const R = (...p) => path.join(__dirname, ...p), CORE = (...p) => path.join(__dirname, '..', '..', 'compat-calc', ...p);
const read = f => fs.readFileSync(f, 'utf8');
const RANGE = { cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', latin: 'U+0000-00FF,U+2000-206F,U+2212' };
let ff = '';
for (const [fam, w, file] of [['IBM Plex Sans', 400, 'ibm-plex-sans'], ['IBM Plex Sans', 600, 'ibm-plex-sans'], ['IBM Plex Mono', 400, 'ibm-plex-mono'], ['Unbounded', 500, 'unbounded']])
  for (const sub of ['cyrillic', 'latin'])
    ff += `@font-face{font-family:'${fam}';font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(CORE('assets/fonts', `${file}-${sub}-${w}-normal.woff2`)).toString('base64')}) format('woff2');unicode-range:${RANGE[sub]}}\n`;
const css = read(CORE('src/style.css')).replace('/*FONTS*/', ff) + '\n' + read(CORE('src/ni-theme.css')) + '\n' + read(R('src/addon.css'));
const html = read(R('src/template.html')).replace('/*STYLE*/', () => css).replace('/*JS*/', () => read(R('src/app.js')));
fs.mkdirSync(R('dist'), { recursive: true });
fs.writeFileSync(R('dist', 'index.html'), html);
console.log(path.basename(__dirname) + ': dist/index.html', (html.length / 1024).toFixed(0) + ' КБ');
