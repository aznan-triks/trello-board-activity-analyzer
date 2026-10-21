const { test } = require('@playwright/test');
const fs = require('node:fs/promises');
const { open, seed, expect, unzip } = require('./helpers');
async function fixture(page) {
  await open(page); await seed(page);
  await page.evaluate(() => {
    const a=tba.state.actions[0]; a.cardName='Carte choisie';
    tba.state.actions.push({...a,id:'secret-id',memberName:'EXCLU_NOM',cardName:'EXCLU_CARTE'},
      {...a,id:'old-id',date:'2026-09-01T00:00:00Z',dateMs:Date.parse('2026-09-01T00:00:00Z')});
    tba.renderDashboard(tba.state.board.name);
    tba.state.filter.members.add('Alice');
    tba.state.filter.fromMs=Date.parse('2026-09-22T00:00:00Z');
    tba.state.filter.toMs=Date.parse('2026-09-23T00:00:00Z');
    tba.state.filter.query='choisie'; // lastStats demeure volontairement périmé.
  });
}
function embedded(html) { return JSON.parse(html.match(/window.__TBA_EMBEDDED__ = (.*);<\/script>/)[1]); }
async function download(page, fn) {
  const promise=page.waitForEvent('download'); await page.evaluate(fn);
  return fs.readFile(await (await promise).path());
}
test('PLAN-003 constructeurs : même vue, métadonnées autorisées et statistiques fraîches',async({page})=>{
  await fixture(page);
  const data=await page.evaluate(()=>({json:JSON.parse(tba.buildAnalysisJson()),html:tba.buildHtmlExport('/*test*/'),all:tba.state.actions.length}));
  expect(data.json.actions.map(a=>a.id)).toEqual(['a']); expect(data.json.stats.total).toBe(1);
  expect(data.json.filters.query).toBe('choisie'); expect(data.json.filters.fromMs).toBe(Date.parse('2026-09-22T00:00:00Z'));
  const p=embedded(data.html); expect(p.actions.map(a=>a.i)).toEqual(['a']);
  expect(p.filter).toEqual({members:[],fromMs:null,toMs:null,query:''});
  expect(p.provenance.filters.query).toBe('choisie'); expect(data.all).toBe(3);
  for(const value of [data.html,JSON.stringify(data.json)]) for(const secret of ['EXCLU_NOM','EXCLU_CARTE','secret-id','fake-key','fake-token']) expect(value).not.toContain(secret);
});
test('PLAN-003 ZIP : JSON/CSV/XLSX/HTML du même sous-ensemble, réexport offline borné',async({page,context})=>{
  await fixture(page);
  const entries=unzip(await download(page,()=>tba.exportZip()));
  expect(JSON.parse(entries['analyse.json']).actions.map(a=>a.id)).toEqual(['a']);
  expect(entries['actions.csv'].toString().trim().split('\r\n')).toHaveLength(2);
  const workbook=unzip(entries['membres.xlsx']);
  expect(workbook['xl/worksheets/sheet3.xml'].toString().match(/<row /g)).toHaveLength(2);
  const p=embedded(entries['rapport.html'].toString()); expect(p.actions.map(a=>a.i)).toEqual(['a']);
  for(const [name,buf] of Object.entries(entries)) {
    const texts=name.endsWith('.xlsx') ? Object.values(unzip(buf)).map(x=>x.toString()).join('') : buf.toString();
    for(const secret of ['EXCLU_NOM','EXCLU_CARTE','secret-id','fake-key','fake-token']) expect(texts).not.toContain(secret);
  }
  const report=await context.newPage(); await report.route('**/*',r=>r.abort());
  await report.setContent(entries['rapport.html'].toString(),{waitUntil:'load'});
  await expect(report.locator('#s-total')).toHaveText('1');
  await expect(report.locator('#export-banner')).toContainText('sous-ensemble');
  await report.locator('#fl-clear').click();
  expect(await report.evaluate(()=>JSON.parse(tba.buildAnalysisJson()).actions.map(a=>a.id))).toEqual(['a']);
  expect(embedded(await report.evaluate(()=>tba.buildHtmlExport('/*test*/'))).actions.map(a=>a.i)).toEqual(['a']);
});
test('PLAN-003 vue vide : aucun retour à l’historique complet',async({page})=>{
  await fixture(page); await page.evaluate(()=>tba.state.filter.query='aucun résultat');
  const result=await page.evaluate(()=>({j:JSON.parse(tba.buildAnalysisJson()),h:tba.buildHtmlExport('/*test*/')}));
  expect(result.j.stats.total).toBe(0); expect(result.j.actions).toEqual([]); expect(embedded(result.h).actions).toEqual([]);
});
test('PLAN-003 export immédiat après saisie : flush et contrôles restaurés',async({page})=>{
  await fixture(page);
  await page.evaluate(()=>{ document.getElementById('setup').style.display='none';document.getElementById('dashboard').style.display='block'; });
  await page.locator('#fl-query').fill('aucun résultat');
  const data=JSON.parse(await download(page,()=>tba.exportJson()));
  expect(data.stats.total).toBe(0); expect(data.actions).toEqual([]);
  await expect(page.locator('#fl-query')).toBeEnabled();
});
test('PLAN-003 attente du bundle : vue figée, contrôles verrouillés et états disabled préservés',async({page})=>{
  await page.addInitScript(()=>{window.requestIdleCallback=()=>0;});
  await fixture(page);
  let reached, release;
  const waiting=new Promise(r=>{reached=r;}); const held=new Promise(r=>{release=r;});
  await page.route('**/vendor/chart.umd.js',async r=>{ reached(); await held; await r.continue(); });
  await page.evaluate(()=>document.getElementById('btn-refresh').disabled=true);
  const promise=page.waitForEvent('download'); const exporting=page.evaluate(()=>tba.exportHtml());
  await waiting;
  await expect(page.locator('#fl-query')).toBeDisabled();
  expect(await page.locator('#dashboard').evaluate(el=>el.inert)).toBe(true);
  // Même une mutation via console ne doit pas changer le snapshot de données.
  await page.evaluate(()=>{tba.state.filter.query=''; tba.state.filter.members.clear();});
  release(); await exporting;
  expect(embedded((await fs.readFile(await (await promise).path())).toString()).actions.map(a=>a.i)).toEqual(['a']);
  await expect(page.locator('#fl-query')).toBeEnabled(); await expect(page.locator('#btn-refresh')).toBeDisabled();
  expect(await page.locator('#dashboard').evaluate(el=>el.inert)).toBe(false);
});
test('PLAN-003 repli HTML statique forcé : même vue et aucun secret exclu',async({page})=>{
  await page.addInitScript(()=>{window.requestIdleCallback=()=>0;});
  await fixture(page); await page.route('**/*',r=>r.abort());
  const html=(await download(page,()=>tba.exportHtml())).toString();
  expect(html).not.toContain('window.__TBA_EMBEDDED__ =');
  expect(html).toContain('1 action(s) affichée(s)');
  expect(html).toContain('Alice');
  for(const secret of ['EXCLU_NOM','EXCLU_CARTE','fake-key','fake-token']) expect(html).not.toContain(secret);
});
