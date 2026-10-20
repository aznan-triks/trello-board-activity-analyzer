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
function unzip(buffer) {
  const entries = {};
  let p = 0;
  while (p + 30 <= buffer.length && buffer.readUInt32LE(p) === 0x04034b50) {
    const method = buffer.readUInt16LE(p+8), size = buffer.readUInt32LE(p+18);
    const nl = buffer.readUInt16LE(p+26), extra = buffer.readUInt16LE(p+28);
    const name = buffer.subarray(p+30,p+30+nl).toString();
    const start = p+30+nl+extra;
    const raw = buffer.subarray(start,start+size);
    entries[name] = method === 0 ? raw : require('node:zlib').inflateRawSync(raw);
    p = start+size;
  }
  return entries;
}
module.exports.unzip = unzip;
