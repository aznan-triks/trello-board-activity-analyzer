const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs/promises');

async function openApp(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await page.waitForFunction(() => window.tba && typeof Chart !== 'undefined');
  return errors;
}
async function demo(page) {
  await page.locator('#btn-demo').click();
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('#s-total')).toHaveText(/1.?284/);
}
async function fillCredentials(page) {
  await page.locator('#api-key').fill('test-key-not-real');
  await page.locator('#api-token').fill('test-token-not-real');
  await page.locator('#board-id').fill('https://trello.com/b/Ab12Cd34/sample');
}
const actions = Array.from({ length: 12 }, (_, i) => ({
  id: 'action-' + i, type: i % 2 ? 'commentCard' : 'createCard',
  date: `2026-09-${String(22 - i).padStart(2, '0')}T10:00:00.000Z`,
  memberCreator: { id: 'member-1', fullName: 'Camille Martin' },
  data: { card: { name: 'Carte ' + i } }
}));
async function mockApi(page, status = 200) {
  await page.route('https://api.trello.com/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/actions') ? actions : path.endsWith('/members') ? [{ id: 'member-1', fullName: 'Camille Martin' }] : { id: '1234567890abcdef12345678', name: 'Tableau de test' };
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? data : { message: 'Invalid token' }) });
  });
}

test('accueil : contenu, validation, clavier et aucun appel tiers', async ({ page }) => {
  const external = [];
  page.on('request', request => { if (!request.url().startsWith(new URL(page.url()).origin) && page.url() !== 'about:blank') external.push(request.url()); });
  const errors = await openApp(page);
  await expect(page).toHaveTitle(/Trello Analyzer/);
  await expect(page.locator('h1')).toContainText('Votre activité Trello.');
  await expect(page.locator('#keep-creds')).not.toBeChecked();
  await page.locator('#btn-analyze').click();
  await expect(page.locator('#err-msg')).toHaveText('Veuillez remplir tous les champs.');
  await expect(page.locator('#api-key')).toBeFocused();
  await expect(page.locator('#api-key')).toHaveAttribute('aria-invalid', 'true');
  await fillCredentials(page);
  await page.locator('#board-id').fill('invalid/../../');
  await page.locator('#btn-analyze').click();
  await expect(page.locator('#err-msg')).toContainText('Lien de tableau invalide');
  await page.locator('#board-id').blur();
  await page.keyboard.press('e');
  await expect(page.locator('#export-menu')).not.toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('moteur de calcul et constructeurs de rapports : self-test intégré', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(() => tba.selfTest());
  expect(result.failed, JSON.stringify(result.results.filter(r => !r.ok))).toBe(0);
  expect(result.passed).toBeGreaterThan(20);
});

test('démo : huit graphiques, filtres, tri, granularité et isolation du stockage', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => localStorage.setItem('trello-v3', 'sauvegarde à préserver'));
  await demo(page);
  expect(await page.evaluate(() => Object.values(tba.state.charts).filter(Boolean).length)).toBe(8);
  expect(await page.evaluate(() => tba.state.charts.typetl.data.datasets.reduce((sum, dataset) => sum + dataset.data.reduce((a, b) => a + b, 0), 0))).toBe(1284);
  expect(await page.evaluate(() => tba.state.charts.typetl.data.labels.every(label => /^\d{4}-/.test(label)))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('trello-v3'))).toBe('sauvegarde à préserver');
  await page.locator('[data-gran="month"]').click();
  await expect(page.locator('[data-gran="month"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-hm="share"]').click();
  expect(await page.evaluate(() => tba.state.heatMetric)).toBe('share');
  await page.locator('#fl-search').fill('Camille Martin');
  await page.locator('#fl-search').press('Enter');
  await expect(page.locator('#fl-chips')).toContainText('Camille Martin');
  await expect(page.locator('#s-members')).toHaveText('1');
  await page.locator('#fl-clear').click();
  await expect(page.locator('#s-members')).toHaveText('5');
  await page.locator('#fl-from').fill('2099-01-01T00:00');
  await page.locator('#fl-from').dispatchEvent('change');
  await expect(page.locator('#s-total')).toHaveText('0');
  await page.locator('#fl-clear').click();
  await page.locator('#mtable th').first().focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => tba.state.msort.k)).toBe('name');
  await page.locator('#btn-demo-exit').click();
  await expect(page.locator('#setup')).toBeVisible();
  expect(errors).toEqual([]);
});

test('thèmes persistés, raccourcis et focus des fenêtres', async ({ page }) => {
  await openApp(page);
  await page.locator('#btn-theme-top').click();
  await page.locator('#btn-theme-top').click();
  await expect(page.locator('html')).toHaveAttribute('data-tba-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-tba-theme', 'dark');
  await demo(page);
  await page.locator('#btn-kbd').click();
  await expect(page.locator('#btn-kbd-close')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#btn-kbd-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-kbd')).toBeFocused();
  await page.locator('#btn-log').click();
  await expect(page.locator('#btn-log-copy')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#btn-log-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-log')).toBeFocused();
});

for (const width of [360, 390, 768, 1440]) {
  test(`responsive ${width}px : accueil et dashboard sans débordement`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page);
    await expect(page.locator('#btn-analyze')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/accueil-${width}.png`, fullPage: true });
    await demo(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/dashboard-${width}.png`, fullPage: true });
    await page.locator('#btn-export').click();
    const box = await page.locator('#export-menu').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  });
}

for (const theme of ['light', 'dark']) {
  test(`accessibilité WCAG AA : accueil et dashboard ${theme}`, async ({ page }) => {
    await openApp(page);
    await page.evaluate(theme => tba.Theme.apply(theme), theme);
    let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await demo(page);
    results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({ path: `test-results/dashboard-${theme}.png`, fullPage: true });
  });
}

test('réduction des animations CSS et Chart.js', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  await demo(page);
  expect(await page.locator('#dashboard').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.evaluate(() => tba.state.charts.timeline.options.animation)).toBe(false);
});

test('Trello simulé : URL courte, analyse, sauvegarde, reprise et delta', async ({ page }) => {
  const errors = await openApp(page);
  await mockApi(page);
  await fillCredentials(page);
  await page.locator('#btn-analyze').click();
  await expect(page.locator('#s-total')).toHaveText('12');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('trello-v3')));
  expect(saved.creds.key).toBe('');
  expect(saved.creds.token).toBe('');
  await page.locator('#btn-refresh-inc').click();
  await expect(page.locator('#s-total')).toHaveText('12');
  await page.reload();
  await expect(page.locator('#saved-banner')).toBeVisible();
  await page.locator('#btn-reload-saved').click();
  await expect(page.locator('#s-total')).toHaveText('12');
  expect(errors).toEqual([]);
});

test('Trello simulé : erreur d’authentification et annulation', async ({ page }) => {
  await openApp(page);
  await mockApi(page, 401);
  await fillCredentials(page);
  await page.locator('#btn-analyze').click();
  await expect(page.locator('#err-msg')).toContainText('Erreur API (401)');
  await page.unroute('https://api.trello.com/**');
  await page.route('https://api.trello.com/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.fulfill({ contentType: 'application/json', body: '{}' }).catch(() => {});
  });
  await page.locator('#btn-analyze').click();
  await expect(page.locator('#loading')).toBeVisible();
  await page.locator('#btn-cancel').click();
  await expect(page.locator('#setup')).toBeVisible();
  await expect(page.locator('#loading')).not.toBeVisible();
});

test('exports : neuf formats téléchargés, HTML interactif réouvert sans réseau', async ({ page, context }) => {
  const errors = await openApp(page);
  await demo(page);
  for (const [id, ext] of [['json','json'], ['csv','csv'], ['md','md'], ['xlsx','xlsx'], ['pdf','pdf'], ['png','png'], ['sheet','png'], ['zip','zip'], ['html','html']]) {
    await page.locator('#btn-export').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exp-' + id).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${ext}$`));
    const buffer = await fs.readFile(await download.path());
    expect(buffer.length).toBeGreaterThan(100);
    if (['zip', 'xlsx'].includes(ext)) expect(buffer.subarray(0,2).toString()).toBe('PK');
    if (ext === 'pdf') expect(buffer.subarray(0,8).toString()).toBe('%PDF-1.4');
    if (ext === 'json') expect(JSON.parse(buffer.toString()).actions.length).toBe(1284);
    if (ext === 'html') {
      const report = await context.newPage();
      const reportErrors = [];
      report.on('pageerror', error => reportErrors.push(error.message));
      await report.route('**/*', route => route.abort());
      await report.setContent(buffer.toString(), { waitUntil: 'load' });
      await expect(report.locator('#s-total')).toHaveText(/1.?284/);
      await report.locator('[data-gran="month"]').click();
      expect(await report.evaluate(() => tba.state.currentGran)).toBe('month');
      expect(await report.evaluate(() => Object.values(tba.state.charts).filter(Boolean).length)).toBe(8);
      expect(reportErrors).toEqual([]);
      await report.close();
    }
    await expect(page.locator('#btn-export')).toHaveAttribute('aria-expanded', 'false');
  }
  expect(errors).toEqual([]);
});

test('stockage indisponible : démonstration et thème restent utilisables', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  const errors = await openApp(page);
  await demo(page);
  await page.locator('#btn-theme-top').click();
  await expect(page.locator('#s-total')).toHaveText(/1.?284/);
  expect(errors).toEqual([]);
});

test('confidentialité : identifiants opt-in, texte hostile échappé et exports sans secrets', async ({ page }) => {
  await openApp(page);
  await mockApi(page);
  await fillCredentials(page);
  await page.locator('#keep-creds').check();
  await page.locator('#btn-analyze').click();
  await expect(page.locator('#s-total')).toHaveText('12');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('trello-v3')).creds.token)).toBe('test-token-not-real');
  const result = await page.evaluate(() => {
    const hostile = '<img src=x onerror="window.injected=true">';
    tba.state.board.name = hostile;
    tba.state.actions[0].memberName = hostile;
    tba.state.actions[0].cardName = hostile;
    tba.renderDashboard(hostile);
    return { html: tba.buildHtmlExport('/* test */'), json: JSON.stringify(tba.buildAnalysisJson()) };
  });
  expect(result.html).not.toContain('test-token-not-real');
  expect(result.html).not.toContain('test-key-not-real');
  expect(result.json).not.toContain('test-token-not-real');
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  expect(await page.locator('#dashboard img').count()).toBe(0);
});

test('impression : commandes masquées, graphiques conservés', async ({ page }) => {
  await openApp(page);
  await demo(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.app-header')).not.toBeVisible();
  await expect(page.locator('.dash-actions')).not.toBeVisible();
  await expect(page.locator('#c-timeline')).toBeVisible();
});
