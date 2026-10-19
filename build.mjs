import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const prod = process.argv.includes('--prod');
const r = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: prod,
  write: false,
  target: 'es2020',
  legalComments: 'none',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/template.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
writeFileSync('rainy-konbini-diorama.html', html);
console.log('built', (html.length / 1024).toFixed(0) + ' KB', prod ? '(prod)' : '(dev)');
