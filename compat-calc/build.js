// Сборка одностраничного index.html: node build.js
const fs = require('fs'), path = require('path');
const R = (...p) => path.join(__dirname, ...p);
const read = f => fs.readFileSync(R(f), 'utf8');
const fonts = [
  ['IBM Plex Sans', 400, 'ibm-plex-sans', ['cyrillic', 'latin']], ['IBM Plex Sans', 500, 'ibm-plex-sans', ['cyrillic', 'latin']], ['IBM Plex Sans', 600, 'ibm-plex-sans', ['cyrillic', 'latin']],
  ['IBM Plex Mono', 400, 'ibm-plex-mono', ['cyrillic', 'latin']], ['IBM Plex Mono', 500, 'ibm-plex-mono', ['cyrillic', 'latin']]
];
const RANGE = { cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' };
let ff = '';
for (const [fam, w, file, subs] of fonts) for (const sub of subs) {
  const b = fs.readFileSync(R('assets/fonts', `${file}-${sub}-${w}-normal.woff2`)).toString('base64');
  ff += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b}) format('woff2');unicode-range:${RANGE[sub]};}\n`;
}
// фирменный стиль сайта (как во врачебной версии): заголовки Unbounded, светлая тема
for (const w of [400, 500, 700]) for (const sub of ['cyrillic', 'latin']) {
  const b = fs.readFileSync(R('assets/fonts', `unbounded-${sub}-${w}-normal.woff2`)).toString('base64');
  ff += `@font-face{font-family:'Unbounded';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b}) format('woff2');unicode-range:${RANGE[sub]};}\n`;
}
const css = read('src/style.css').replace('/*FONTS*/', ff) + '\n' + read('src/ctor.css') + '\n' + read('src/ni-theme.css') + '\n' + read('src/ni-theme-tech.css');
const db = JSON.stringify(JSON.parse(read('data/molecules.json'))).replace(/<\//g, '<\\/');
const SITE_JSON = read('data/site_catalog.json');
const js = ['src/core.js', 'src/rules.js', 'src/engine.js', 'src/site-core.js', 'src/ui.js'].map(read).join('\n;\n').replace('/*SITE*/null', () => SITE_JSON).replace(/<\/script/gi, '<\\/script') + '\n;document.documentElement.setAttribute("data-theme","light");';
let html = read('src/template.html')
  .replace('<html lang="ru">', '<html lang="ru" data-theme="light">')
  .replace(/<script>try \{ var t = localStorage[\s\S]*?<\/script>\n/, '');
html = html.replace('/*STYLE*/', () => css).replace('/*DB*/', () => db).replace('/*JS*/', () => js);
fs.writeFileSync(R('index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' КБ');
