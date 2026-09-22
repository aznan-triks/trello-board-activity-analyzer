// Vérifie que GitHub Pages sert exactement les octets de ce commit.
//
//   1. arborescence complète  : chaque fichier du dépôt est demandé à Pages
//      (HTTP 200) et comparé octet par octet à sa version locale (SHA-256) ;
//   2. périmètre applicatif   : `index.html`, `.nojekyll` et `vendor/**` sont
//      obligatoires — un fichier manquant ou divergent fait échouer le script ;
//   3. cohérence sémantique   : la racine du site sert le même HTML que
//      `index.html`, avec la version de `package.json` et le titre attendus ;
//   4. état de publication    : l'API Pages est interrogée (si `GH_TOKEN` est
//      fourni) pour confirmer que la publication correspond au commit courant.
//
// Le reste du dépôt (README, tests, CI, scripts) est contrôlé aussi : s'il est
// servi, il doit être identique — mais son absence reste un simple
// avertissement, car GitHub Pages peut ne pas publier certains fichiers annexes.
//
// Variables d'environnement :
//   BASE_URL          URL racine du site (défaut : site Pages du dépôt)
//   VERIFY_ATTEMPTS   nombre de tentatives (défaut : 20)
//   VERIFY_DELAY_MS   délai entre tentatives, en ms (défaut : 15000)
//   GH_TOKEN          jeton en lecture (facultatif) pour l'API Pages
//   GH_REPOSITORY     « propriétaire/dépôt » (défaut : GITHUB_REPOSITORY)
//   GITHUB_SHA        commit publié à confirmer (facultatif)

import { createHash } from 'node:crypto';
import { appendFile, readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_BASE = 'https://aznan-triks.github.io/trello-board-activity-analyzer/';
const BASE = new URL(process.env.BASE_URL || DEFAULT_BASE);
if (!BASE.pathname.endsWith('/')) BASE.pathname += '/';

const ATTEMPTS = Math.max(1, Number(process.env.VERIFY_ATTEMPTS || 20));
const DELAY_MS = Math.max(0, Number(process.env.VERIFY_DELAY_MS || 15000));
const CONCURRENCY = 6;

/** Répertoires jamais publiés ou purement locaux. */
const SKIP_DIRS = new Set(['.git', 'node_modules', 'test-results', 'playwright-report', '_site', 'verification']);
/** Fichiers applicatifs : obligatoires et strictement identiques. */
const appFiles = new Set(['index.html', '.nojekyll']);

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const short = digest => digest.slice(0, 12);
const kilobytes = size => `${String(size).padStart(8)} o`;

// Annotations GitHub Actions : le récapitulatif reste lisible dans l'interface
// du job et interrogeable via l'API (check-runs/annotations), même quand les
// journaux complets ne sont pas accessibles.
const inActions = process.env.GITHUB_ACTIONS === 'true';
const escapeCommand = value => String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
function annotate(level, title, message) {
  if (inActions) console.log(`::${level} title=${escapeCommand(title)}::${escapeCommand(message)}`);
}

async function walk(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name === '.DS_Store') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, found);
    else if (entry.isFile()) found.push(relative('.', full).split(sep).join('/'));
  }
  return found;
}

/** Liste locale de référence : chemin publié, taille et empreinte. */
const local = new Map();
for (const path of (await walk('.')).sort()) {
  const bytes = await readFile(path);
  local.set(path, { size: bytes.length, digest: sha256(bytes), bytes });
  if (path === 'index.html' || path.startsWith('vendor/')) appFiles.add(path);
}

/** Empreinte unique de l'arborescence : identifie la publication d'un coup d'œil. */
const treeDigest = sha256([...local].map(([path, file]) => `${path}\u0000${file.digest}\n`).join(''));

const version = JSON.parse(local.get('package.json').bytes.toString()).version ?? '';
const html = local.get('index.html')?.bytes.toString() ?? '';

/** Interroge une URL publiée en contournant le cache. */
async function fetchPublished(path, attempt, raw = false) {
  const url = new URL(path.replace(/^\/+/, ''), BASE);
  url.searchParams.set('verify', process.env.GITHUB_SHA || `attempt-${attempt}-${Date.now()}`);
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const body = Buffer.from(await response.arrayBuffer());
  return { status: response.status, url: url.href, size: body.length, digest: sha256(body), body: raw ? body : null };
}

/** État de la dernière publication Pages pour le commit courant. */
async function pagesState() {
  const repository = process.env.GH_REPOSITORY || process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const sha = process.env.GITHUB_SHA;
  if (!repository || !token || !sha) return { skipped: 'API Pages non interrogée (GH_TOKEN/GITHUB_SHA absents).' };
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/pages/builds?per_page=20`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'verify-deployment' },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return { warning: `API Pages : HTTP ${response.status} (jeton sans droit « pages: read » ?).` };
    const builds = await response.json();
    const build = builds.find(entry => entry.commit === sha);
    if (!build) return { warning: `API Pages : aucune publication enregistrée pour ${short(sha)}.` };
    const state = `API Pages : publication ${short(sha)} — ${build.status}${build.error ? ` (${build.error.message})` : ''}`;
    return build.status === 'errored' ? { error: state } : { message: state };
  } catch (error) {
    return { warning: `API Pages indisponible : ${error.message}` };
  }
}

/** Vérifie un bloc de fichiers avec une concurrence limitée. */
async function checkAll(paths, attempt) {
  const results = new Map();
  const queue = [...paths];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      const expected = local.get(path);
      try {
        const published = await fetchPublished(path, attempt);
        results.set(path, { ...published, ok: published.status === 200 && published.digest === expected.digest });
      } catch (error) {
        results.set(path, { status: 0, error: error.message, ok: false });
      }
    }
  }));
  return results;
}

let report = null;
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const failures = [];
  const warnings = [];
  const checked = await checkAll([...local.keys()], attempt);

  for (const [path, published] of checked) {
    const required = appFiles.has(path);
    if (published.ok) continue;
    if (published.status === 404 && !required) {
      warnings.push(`${path} : non publié par Pages (HTTP 404) — toléré hors périmètre applicatif.`);
      continue;
    }
    failures.push(`${path} : ${published.error ? `échec réseau (${published.error})` : `HTTP ${published.status}, ${kilobytes(published.size)} sha256 ${short(published.digest)}`} ≠ attendu ${kilobytes(local.get(path).size)} sha256 ${short(local.get(path).digest)}`);
  }

  // La racine du site doit servir exactement le HTML de index.html.
  try {
    const root = await fetchPublished('', attempt, true);
    const rootOk = root.status === 200 && root.digest === local.get('index.html').digest;
    if (!rootOk) failures.push(`/ : HTTP ${root.status}, sha256 ${short(root.digest)} ≠ index.html ${short(local.get('index.html').digest)}`);
    else {
      const served = root.body.toString();
      if (version && !served.includes(`v${version}`)) failures.push(`/ : version v${version} absente du HTML publié.`);
      if (!/<title>Trello Analyzer/.test(served)) failures.push('/ : balise <title> attendue absente du HTML publié.');
    }
  } catch (error) {
    failures.push(`/ : échec réseau (${error.message})`);
  }

  const state = await pagesState();
  if (state.error) failures.push(state.error);
  else if (state.warning) warnings.push(state.warning);

  if (failures.length === 0) {
    report = { attempt, warnings, state, checked };
    break;
  }
  console.warn(`\nTentative ${attempt}/${ATTEMPTS} : ${failures.length} incohérence(s) côté GitHub Pages.`);
  for (const failure of failures.slice(0, 10)) console.warn(`  · ${failure}`);
  if (failures.length > 10) console.warn(`  · … et ${failures.length - 10} autre(s).`);
  for (const warning of warnings) console.warn(`  ! ${warning}`);
  if (attempt < ATTEMPTS) {
    console.warn(`Attente de ${Math.round(DELAY_MS / 1000)} s avant la prochaine tentative (propagation Pages)…`);
    await delay(DELAY_MS);
  } else {
    for (const failure of failures.slice(0, 10)) annotate('error', 'Pages — contenu divergent', failure);
  }
}

if (!report) {
  console.error(`\nÉchec : GitHub Pages ne sert pas les octets de ce commit après ${ATTEMPTS} tentative(s) (${BASE.href}).`);
  annotate('error', 'Pages — publication non conforme', `${BASE.href} ne sert pas les octets du commit ${process.env.GITHUB_SHA || 'local'} après ${ATTEMPTS} tentative(s).`);
  process.exit(1);
}

const lines = [
  `Publication vérifiée : ${BASE.href}`,
  `Commit : ${process.env.GITHUB_SHA || '(local)'}`,
  `Empreinte de l'arborescence publiée : sha256 ${treeDigest}`,
  `Fichiers contrôlés : ${local.size} (dont ${appFiles.size} applicatifs obligatoires) sur ${report.attempt} tentative(s).`,
  ...(report.state.message ? [`${report.state.message}`] : []),
  ...(report.state.skipped ? [report.state.skipped] : []),
  ...report.warnings.map(warning => `Avertissement : ${warning}`)
];
for (const line of lines) console.log(line);

const appDigests = [...local.keys()].filter(path => appFiles.has(path))
  .map(path => `${path} sha256 ${short(local.get(path).digest)}`).join(' · ');
annotate('notice', 'Pages à jour', `${BASE.href} · commit ${process.env.GITHUB_SHA || 'local'} · ${local.size} fichiers identiques · empreinte de l'arborescence sha256 ${short(treeDigest)}`);
annotate('notice', 'Fichiers applicatifs publiés', appDigests);
for (const warning of report.warnings) annotate('warning', 'Pages — avertissement', warning);
if (report.state.warning) annotate('warning', 'Pages — état', report.state.warning);
else if (report.state.message) annotate('notice', 'Pages — état', report.state.message);

if (process.env.GITHUB_STEP_SUMMARY) {
  const table = [...report.checked].map(([path, published]) => `| \`${path}\` | ${published.ok ? '✅ identique' : `⚠️ HTTP ${published.status}`} | ${published.size} | \`${short(published.digest)}\` |`).join('\n');
  const summary = [
    '## Publication GitHub Pages vérifiée', '',
    `- **URL** : ${BASE.href}`,
    `- **Commit** : \`${process.env.GITHUB_SHA || 'local'}\``,
    `- **Empreinte de l'arborescence** : \`sha256 ${treeDigest}\``,
    `- **Tentatives** : ${report.attempt}`,
    report.state.message ? `- ${report.state.message}` : '',
    report.state.skipped ? `- ${report.state.skipped}` : '',
    '', '| Fichier | État | Taille (o) | SHA-256 publié |', '| --- | --- | --- | --- |', table, '',
    report.warnings.length ? `Avertissements :\n\n${report.warnings.map(warning => `- ${warning}`).join('\n')}` : 'Aucun avertissement.'
  ].filter(line => line !== '').join('\n');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
