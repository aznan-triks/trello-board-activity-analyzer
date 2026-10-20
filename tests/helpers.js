const { expect } = require('@playwright/test');
async function open(page) {
  await page.goto('./');
  await page.waitForFunction(() => window.tba && typeof Chart !== 'undefined');
}
async function seed(page) {
  return page.evaluate(async () => {
    tba.state.board = { name: 'Tableau synthétique' };
    tba.state.creds = { key: 'fake-key', token: 'fake-token', boardId: 'Ab12Cd34' };
    tba.state.actions = [tba.normalizeAction({ id: 'a', type: 'commentCard', date: '2026-09-22T10:00:00Z', _memberName: 'Alice', data: { card: { name: 'Carte' } } })];
    return tba.persistData();
  });
}
module.exports = { open, seed, expect };
