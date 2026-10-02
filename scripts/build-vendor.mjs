/**
 * Reconstruit `vendor/chart.umd.js` — le bundle Chart.js allégé du site.
 *
 * Le site est servi tel quel (aucune chaîne de build à l'exécution) ; cette
 * étape ne produit qu'un artefact versionné, à relancer uniquement si les
 * types de graphiques ou la version de Chart.js changent :
 *
 *   npm run build:vendor
 *
 * @see scripts/chart.entry.js — la liste exacte des composants conservés.
 */
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = pkg.devDependencies['chart.js'].replace(/^[^\d]*/, '');
const outFile = path.join(root, 'vendor', 'chart.umd.js');

const banner = [
  '/*!',
  ' * Chart.js v' + version + ' — build allégé (tree-shaken) pour trello-board-activity-analyzer.',
  ' * https://www.chartjs.org — (c) Chart.js Contributors — MIT License.',
  ' *',
  ' * Ne contient que : line, bar, doughnut · échelles category/linear ·',
  ' * greffons filler, legend, tooltip. Voir scripts/chart.entry.js.',
  ' * Ne pas éditer à la main : `npm run build:vendor`.',
  ' */'
].join('\n');

const bundle = await rollup({
  input: path.join(root, 'scripts', 'chart.entry.js'),
  plugins: [nodeResolve()],
  onwarn(warning, warn) {
    // `globalThis` est volontaire : le bundle expose le même global que l'UMD officiel.
    if (warning.code === 'THIS_IS_UNDEFINED' || warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  }
});

const { output } = await bundle.generate({
  format: 'iife',
  name: 'tbaChartBundle',
  strict: false,
  plugins: [terser({ format: { comments: false, preamble: banner } })]
});

await bundle.close();
await writeFile(outFile, output[0].code);

const { size } = await stat(outFile);
const kb = n => (n / 1024).toFixed(1) + ' Ko';
console.log('vendor/chart.umd.js : ' + kb(size) + ' (gzip ' + kb(gzipSync(output[0].code, { level: 9 }).length) + ')');
