const { test } = require('@playwright/test');
const { open, seed, expect } = require('./helpers');
for (const error of ['SecurityError', 'QuotaExceededError']) {
  test(`PLAN-002 ${error} : ancien snapshot et date conservés, recharge durable`, async ({ page }) => {
    await open(page); await seed(page);
    const before = await page.evaluate(() => ({ saved: localStorage.getItem('trello-v3'), date: tba.state.savedAtIso }));
    const after = await page.evaluate(async error => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) { if (k === 'trello-v3') throw new DOMException('Test', error); return set.call(this,k,v); };
      tba.state.actions[0].cardName = 'Nouvelle carte';
      const ok = await tba.persistData();
      return { ok, saved: localStorage.getItem('trello-v3'), date: tba.state.savedAtIso, card: tba.state.actions[0].cardName };
    }, error);
    expect(after).toEqual({ ok: false, ...before, card: 'Nouvelle carte' });
    await expect(page.locator('#save-label')).toContainText('non sauvegardée');
    await page.reload(); await page.evaluate(() => tba.loadSaved());
    expect(await page.evaluate(() => tba.state.actions[0].cardName)).toBe('Carte');
    expect(await page.evaluate(() => tba.state.savedAtIso)).toBe(before.date);
  });
}
test('PLAN-002 stockage entièrement bloqué : mémoire non durable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
  await open(page);
  expect(await seed(page)).toBe(false);
  expect(await page.evaluate(() => tba.state.savedAtIso)).toBe(null);
  await expect(page.locator('#save-label')).toContainText('non sauvegardée');
  await page.evaluate(() => tba.checkSaved());
  await expect(page.locator('#saved-banner')).not.toBeVisible();
});
for (const denied of [false, true]) {
  test(`PLAN-002 effacement avec quota plein, suppression refusée=${denied}`, async ({ page }) => {
    await open(page); await seed(page);
    await page.evaluate(denied => {
      Storage.prototype.setItem = () => { throw new DOMException('Full','QuotaExceededError'); };
      if (denied) Storage.prototype.removeItem = () => { throw new DOMException('Blocked','SecurityError'); };
      return tba.clearSaved();
    }, denied);
    expect(await page.evaluate(() => !!localStorage.getItem('trello-v3'))).toBe(denied);
    await expect(page.locator('#toast')).toContainText(denied ? 'Impossible' : 'effacée');
  });
}
for (const demo of [false, true]) {
  test(`PLAN-002 révocation immédiate sur copie sauvegardée, démo=${demo}`, async ({ page }) => {
    await open(page);
    await page.locator('#keep-creds').check(); await seed(page);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('trello-v3')));
    if (demo) { await page.locator('#btn-demo').click(); await page.waitForFunction(() => tba.state.demo); }
    await page.evaluate(() => {
      const el = document.getElementById('keep-creds'); el.checked = false; el.dispatchEvent(new Event('change'));
    });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('trello-v3')).creds.token)).toBe('');
    const next = await page.evaluate(() => JSON.parse(localStorage.getItem('trello-v3')));
    expect(next).toEqual({ ...saved, creds: { ...saved.creds, key:'', token:'' } });
    if (!demo) expect(await page.evaluate(() => tba.state.creds.token)).toBe('fake-token');
  });
}
for (const fail of [false,true]) {
  test(`PLAN-002 window.storage : succès/rejet ${fail}`, async ({ page }) => {
    await page.addInitScript(fail => {
      const data = new Map(); window.hostData = data;
      window.storage = { get: async k => data.has(k) ? {value:data.get(k)} : null,
        set: async (k,v) => { if(fail) throw new Error('refus'); data.set(k,v); },
        delete: async k => { if(fail) throw new Error('refus'); data.delete(k); } };
    },fail);
    await open(page); expect(await seed(page)).toBe(!fail);
    expect(await page.evaluate(() => window.hostData.has('trello-v3'))).toBe(!fail);
  });
}
test('PLAN-002 révocation refusée : copie intacte et avertissement', async ({ page }) => {
  await open(page); await page.locator('#keep-creds').check(); await seed(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('refus'); }; });
  await page.locator('#keep-creds').uncheck();
  await expect(page.locator('#toast')).toContainText('données du site');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('trello-v3')).creds.token)).toBe('fake-token');
});
test('PLAN-002 révocation sérialisée avec écriture hôte en attente et changements rapides', async ({ page }) => {
  await page.addInitScript(() => {
    const data = new Map(); window.hostData = data;
    window.storage = { get: async k => data.has(k) ? {value:data.get(k)} : null,
      set: async (k,v) => { await new Promise(r => setTimeout(r,30)); data.set(k,v); },
      delete: async k => data.delete(k) };
  });
  await open(page); await page.locator('#keep-creds').check(); await seed(page);
  await page.evaluate(() => {
    window.pendingSave = tba.persistData();
    const el = document.getElementById('keep-creds');
    for (const checked of [false,true,false]) { el.checked = checked; el.dispatchEvent(new Event('change')); }
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(window.hostData.get('trello-v3')).creds.token)).toBe('');
  expect(await page.evaluate(() => tba.state.creds.token)).toBe('fake-token');
  await page.evaluate(() => tba.clearSaved());
  expect(await page.evaluate(() => window.hostData.has('trello-v3'))).toBe(false);
});
