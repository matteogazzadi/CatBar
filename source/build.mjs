// Bundles src/*.js into the single self-contained ../index.html
//   npm run build            minified
//   npm run build:readable   unminified, for debugging
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = ['quality.js', 'math.js', 'shaders.js', 'world.js', 'cats.js', 'main.js', 'shop.js', 'games.js', 'life.js', 'audio.js']; // concatenation order matters
const readable = process.argv.includes('--readable');

let js = FILES.map((f) => readFileSync(path.join(here, 'src', f), 'utf8')).join('\n');
const VERSION = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8')).version;
const tpl = readFileSync(path.join(here, 'template.html'), 'utf8').replaceAll('__VERSION__', VERSION);
// everything runs inside one async function; startup errors are shown on screen
const wrap = (body) => `(async()=>{${body}\n})().catch(e=>{console.error(e);document.body.className='l e';document.getElementById('s').textContent=(e.cause?'':'Errore all\\'avvio: ')+e.message});`;

let html;
if (readable) {
  html = tpl.replace('/*SCRIPT*/', () => wrap(js));
} else {
  // shrink the WGSL inside /*wgsl*/ template literals, then minify the JS and the page's CSS
  const minWgsl = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([{}()\[\];,:=+\-*\/<>&|!%@]) ?/g, '$1').trim();
  js = js.replace(/\/\*wgsl\*\/`([^`]*)`/g, (_, w) => '`' + minWgsl(w) + '`');
  const code = transformSync(wrap(js), { minify: true, target: 'es2022', legalComments: 'none' }).code.trim();
  const css = (_, s) => '<style>' + transformSync(s, { loader: 'css', minify: true }).code.trim();
  html = tpl.replace(/<style>([^]*?)(?=<\/style>)/, css).replace(/>\s+</g, '><').replace('/*SCRIPT*/', () => code).replace(/<script>\s+/, '<script>').replace(/\s+<\/script>/, '</script>');
}
writeFileSync(path.join(here, '..', 'index.html'), html);
const gz = gzipSync(Buffer.from(html), { level: 9 }).length;
console.log(`index.html: ${(html.length / 1024).toFixed(1)} kB${readable ? ' (readable)' : ''}, ${(gz / 1024).toFixed(1)} kB gzipped`);
