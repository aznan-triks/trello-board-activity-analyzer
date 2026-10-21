const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const date = '2026-09-22T10:00:00.000Z';
const action = (id, timestamp = date) => ({
  id, type: 'commentCard', date: timestamp, idMemberCreator: 'm1',
  data: { card: { name: 'Carte synthétique ' + id } }
});
const seed = [action('a'), action('b', '2026-09-21T10:00:00.000Z')];
const fullPage = prefix => Array.from({ length: 1000 }, (_, i) => action(prefix + i));

async function setup(page, maxPages) {
  if (maxPages) {
    test.skip(!!process.env.BASE_URL, 'Harness du code local uniquement : ne pas substituer le HTML d’un site distant.');
    // Harness uniquement en mémoire : aucun réglage produit ni fichier généré.
    const html = await fs.readFile(path.join(__dirname, '../index.html'), 'utf8');
    expect(html).toContain('const MAX_PAGES = 1000;');
    await page.route('http://127.0.0.1:8080/', route => route.fulfill({
      contentType: 'text/html', body: html.replace('const MAX_PAGES = 1000;', `const MAX_PAGES = ${maxPages};`)
    }));
  }
  const api = { requests: [], board: 'Tableau initial' };
  await page.route('https://api.trello.com/**', async route => {
    const url = new URL(route.request().url());
    expect(route.request().method()).toBe('GET');
    if (url.pathname.endsWith('/actions')) {
      expect(url.searchParams.get('limit')).toBe('1000');
      api.requests.push(url);
      return api.reply(route, url);
    }
    await route.fulfill({ json: url.pathname.endsWith('/members')
      ? [{ id: 'm1', fullName: 'Membre synthétique' }]
      : { id: '1234567890abcdef12345678', name: api.board } });
  });
  api.reply = route => route.fulfill({ json: seed });
  await page.goto('./');
  await page.waitForFunction(() => window.tba && typeof Chart !== 'undefined');
  await page.locator('#api-key').fill('fake-key');
  await page.locator('#api-token').fill('fake-token');
  await page.locator('#board-id').fill('Ab12Cd34');
  await page.locator('#btn-analyze').click();
  await expect(page.locator('#s-total')).toHaveText('2');
  api.requests = [];
  return api;
}
async function snapshot(page) {
  return page.evaluate(() => ({ board: tba.state.board, actions: tba.state.actions,
    savedAt: tba.state.savedAtIso, saved: localStorage.getItem('trello-v3') }));
}
async function ids(page) {
  return page.evaluate(() => ({ state: tba.state.actions.map(a => a.id),
    saved: JSON.parse(localStorage.getItem('trello-v3')).actions.map(a => a.i) }));
}

for (const [label, delta, expected] of [
  ['vide', [], ['a', 'b']],
  ['nouvelles uniquement', [action('c')], ['c', 'a', 'b']],
  ['chevauchement et égalité de timestamp', [action('c'), action('a'), action('c')], ['c', 'a', 'b']],
  ['connues uniquement', seed, ['a', 'b']]
]) {
  test(`PLAN-001 delta ${label} : union en mémoire et sauvegarde`, async ({ page }) => {
    const api = await setup(page);
    api.reply = (route, url) => route.fulfill({ json: delta.filter(a =>
      a.date >= url.searchParams.get('since')) });
    await page.evaluate(() => tba.refreshData(true));
    expect(await ids(page)).toEqual({ state: expected, saved: expected });
    expect(api.requests).toHaveLength(1);
    expect(api.requests[0].searchParams.get('since')).toBe('2026-09-22T09:59:59.000Z');
    expect(api.requests[0].searchParams.has('before')).toBe(false);
    await expect(page.locator('#dashboard')).toBeVisible();
    await expect(page.locator('#loading')).not.toBeVisible();
  });
}

test('PLAN-001 delta : deux pages pleines chevauchantes, connu avant une nouvelle action du même instant', async ({ page }) => {
  const api = await setup(page);
  const first = fullPage('c');
  first[0] = action('a'); // Un ID connu ne prouve pas la fin du même instant.
  const second = [first[999], ...fullPage('d').slice(0, 999)];
  api.reply = (route, url) => route.fulfill({ json: !url.searchParams.has('before') ? first
    : url.searchParams.get('before') === 'c999' ? second : [] });
  await page.evaluate(() => tba.refreshData(true));
  const expected = [...first.slice(1), ...second.slice(1), ...seed].map(a => a.id);
  expect(await ids(page)).toEqual({ state: expected, saved: expected });
  expect(api.requests.map(u => u.searchParams.get('before'))).toEqual([null, 'c999', 'd998']);
  expect(api.requests.every(u => u.searchParams.get('since') === '2026-09-22T09:59:59.000Z')).toBe(true);
});

for (const failure of ['curseur absent', 'curseur répété', 'cycle de curseurs', 'erreur page 2', 'garde-fou']) {
  test(`PLAN-001 complet ${failure} : état et snapshot inchangés`, async ({ page }) => {
    const api = await setup(page, failure === 'garde-fou' ? 2 : undefined);
    const before = await snapshot(page);
    const first = fullPage('c');
    if (failure === 'curseur absent') delete first[999].id;
    let count = 0;
    api.reply = (route, url) => {
      count++;
      if (failure === 'erreur page 2' && url.searchParams.has('before')) return route.fulfill({ status: 403, json: {} });
      const batch = failure === 'cycle de curseurs' && count === 2 ? fullPage('d')
        : failure === 'garde-fou' ? fullPage('page' + count + '-') : first;
      return route.fulfill({ json: batch });
    };
    await page.evaluate(() => tba.refreshData(false));
    expect(await snapshot(page)).toEqual(before);
    await expect(page.locator('#save-label')).toContainText(/Erreur/);
    await expect(page.locator('#dashboard')).toBeVisible();
    await expect(page.locator('#loading')).not.toBeVisible();
    await expect(page.locator('#btn-cancel')).not.toBeVisible();
    expect(count).toBe(failure === 'curseur absent' ? 1 : failure === 'cycle de curseurs' ? 3 : 2);
    expect(api.requests.every(u => !u.searchParams.has('since'))).toBe(true);
    if (failure !== 'erreur page 2') await expect(page.locator('#save-label')).toContainText(/incomplet/i);
    expect(await page.evaluate(() => JSON.parse(tba.buildAnalysisJson()).actions.map(a => a.id))).toEqual(['a', 'b']);
  });
}

for (const incremental of [true, false]) {
  test(`PLAN-001 annulation page 2 (${incremental ? 'delta' : 'complet'}) : aucun candidat publié`, async ({ page }) => {
    const api = await setup(page);
    const before = await snapshot(page);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let pageTwo;
    const reached = new Promise(resolve => { pageTwo = resolve; });
    api.reply = async (route, url) => {
      if (!url.searchParams.has('before')) return route.fulfill({ json: fullPage('c') });
      pageTwo();
      await held;
      await route.fulfill({ json: [] }).catch(() => {});
    };
    const refresh = page.evaluate(inc => tba.refreshData(inc), incremental);
    await reached;
    await page.locator('#btn-cancel').click();
    release();
    await refresh;
    expect(await snapshot(page)).toEqual(before);
    await expect(page.locator('#save-label')).toHaveText('Actualisation annulée');
    await expect(page.locator('#dashboard')).toBeVisible();
    await expect(page.locator('#loading')).not.toBeVisible();
  });
}

test('PLAN-001 complet vide et repli legacy sans IDs', async ({ page }) => {
  const api = await setup(page);
  await page.evaluate(() => { for (const a of tba.state.actions) a.id = ''; });
  api.reply = route => route.fulfill({ json: [action('replacement')] });
  await page.evaluate(() => tba.refreshData(true));
  expect(await ids(page)).toEqual({ state: ['replacement'], saved: ['replacement'] });
  expect(api.requests[0].searchParams.has('since')).toBe(false);
  api.reply = route => route.fulfill({ json: [] });
  await page.evaluate(() => tba.refreshData(false));
  expect(await ids(page)).toEqual({ state: [], saved: [] });
  await expect(page.locator('#s-total')).toHaveText('0');
});

test('PLAN-001 analyse : board candidat non publié si la collecte échoue', async ({ page }) => {
  const api = await setup(page);
  const before = await snapshot(page);
  api.board = 'Autre tableau candidat';
  const bad = fullPage('bad');
  delete bad[999].id;
  api.reply = route => route.fulfill({ json: bad });
  await page.evaluate(() => {
    document.getElementById('board-id').value = 'Zy98Xw76';
    return tba.startAnalysis();
  });
  expect(await snapshot(page)).toEqual(before);
  await expect(page.locator('#err-msg')).toContainText(/historique incomplet/i);
  await expect(page.locator('#loading')).not.toBeVisible();
});

for (const finalPage of [[], [action('last')]]) {
  test(`PLAN-001 garde-fou : fin normale de ${finalPage.length} action(s) à la dernière page permise`, async ({ page }) => {
    const api = await setup(page, 2);
    api.reply = (route, url) => route.fulfill({ json: url.searchParams.has('before') ? finalPage : fullPage('c') });
    await page.evaluate(() => tba.refreshData(false));
    const expected = [...fullPage('c'), ...finalPage].map(a => a.id);
    expect(await ids(page)).toEqual({ state: expected, saved: expected });
    expect(api.requests).toHaveLength(2);
    await expect(page.locator('#save-label')).toHaveText('Sauvegardé');
  });
}

test('PLAN-001 analyse vide : publication du nouveau board après une fin valide', async ({ page }) => {
  const api = await setup(page);
  api.board = 'Tableau vide';
  api.reply = route => route.fulfill({ json: [] });
  await page.evaluate(() => tba.startAnalysis());
  expect(await ids(page)).toEqual({ state: [], saved: [] });
  expect((await snapshot(page)).board.name).toBe('Tableau vide');
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('#loading')).not.toBeVisible();
});
