// Сборка врачебной версии: node build.js → index.html
// Ядро, правила и база берутся из ../compat-calc (технологическая версия, тег tech-v1).
const fs = require('fs'), path = require('path');
const R = (...p) => path.join(__dirname, ...p), T = (...p) => path.join(__dirname, '..', 'compat-calc', ...p);
const read = f => fs.readFileSync(f, 'utf8');
const fonts = [['IBM Plex Sans', 400, 'ibm-plex-sans'], ['IBM Plex Sans', 500, 'ibm-plex-sans'], ['IBM Plex Sans', 600, 'ibm-plex-sans'], ['IBM Plex Mono', 400, 'ibm-plex-mono']];
const RANGE = { cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' };
let ff = '';
for (const [fam, w, file] of fonts) for (const sub of ['cyrillic', 'latin']) {
  const b = fs.readFileSync(T('assets/fonts', `${file}-${sub}-${w}-normal.woff2`)).toString('base64');
  ff += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b}) format('woff2');unicode-range:${RANGE[sub]};}\n`;
}
const css = read(T('src/style.css')).replace('/*FONTS*/', ff) + '\n' + read(R('src/doc.css'));
// во врачебной версии структуры (svg) не нужны — уменьшаем размер
const db = JSON.stringify(JSON.parse(read(T('data/molecules.json'))).map(m => { const o = Object.assign({}, m); delete o.svg; return o; })).replace(/<\//g, '<\\/');
const js = [T('src/core.js'), T('src/rules.js'), T('src/engine.js'), R('src/doc-data.js'), R('src/doc-engine.js'), R('src/doc-forms.js'), R('src/doc-ui.js')].map(read).join('\n;\n').replace(/<\/script/gi, '<\\/script');
function make(theme) {
  let tpl = read(R('src/template.html')), style = css;
  if (theme === 'ni') {
    // модуль сайта: светлая тема как на сайте, шрифт заголовков Unbounded
    let uf = '';
    for (const w of [400, 500, 700]) for (const sub of ['cyrillic', 'latin']) {
      const b = fs.readFileSync(R('assets/fonts', `unbounded-${sub}-${w}-normal.woff2`)).toString('base64');
      uf += `@font-face{font-family:'Unbounded';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b}) format('woff2');unicode-range:${RANGE[sub]};}\n`;
    }
    style = uf + css + '\n' + read(R('src/ni-theme.css'));
    tpl = tpl.replace('<html lang="ru">', '<html lang="ru" data-theme="light">').replace(/<script>try \{ var t = localStorage[\s\S]*?<\/script>\n/, '');
  }
  const html = tpl.replace('/*STYLE*/', () => style).replace('/*DB*/', () => db).replace('/*JS*/', () => js + (theme === 'ni' ? '\n;document.documentElement.setAttribute("data-theme","light");' : ''));
  const out = 'index.html';
  fs.writeFileSync(R(out), html);
  console.log(out, (html.length / 1024).toFixed(0) + ' КБ');
}
// основная сборка — сразу в фирменном стиле сайта nano-identica.com
make('ni');
