const {test}=require('@playwright/test');
const fs=require('node:fs/promises');
const {open,seed,expect,unzip}=require('./helpers');
const AxeBuilder=require('@axe-core/playwright').default;
test.use({timezoneId:'UTC'});
async function fixture(page){await open(page);await seed(page);await page.evaluate(()=>{
 const a=tba.state.actions[0];a.cardName='Carte très longue <img src=x onerror=alert(1)> & suite complète';a.memberName='Alice Très Long Nom';
 tba.state.actions.push({...a,id:'b',date:'2026-09-02T10:00:00Z',dateMs:Date.parse('2026-09-02T10:00:00Z')});
 document.getElementById('setup').style.display='none';document.getElementById('dashboard').style.display='block';tba.renderDashboard('Test');
});}
test('PLAN-009 chaque graphique : table exacte ou lien membres, noms complets échappés',async({page})=>{
 await fixture(page);
 for(const key of ['timeline','types','trends','topcards','hours','typetl','weekend']){
  const expected=await page.evaluate(key=>{const d=tba.state.charts[key].data;return d.labels.map((label,i)=>d.datasets.map(s=>String(s.data[i]??0)));},key);
  const cells=await page.locator(`#data-${key} tbody tr`).evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('td')].map(c=>c.textContent)));
  expect(cells).toEqual(expected);
  await expect(page.locator(`#data-${key} caption`)).not.toBeEmpty();
  expect(await page.locator(`#c-${key}`).getAttribute('aria-describedby')).toBe(`data-${key}-summary`);
 }
 await expect(page.locator('#data-topcards')).toContainText('Carte très longue <img src=x onerror=alert(1)> & suite complète');
 await expect(page.locator('#data-topcards img')).toHaveCount(0);
 await expect(page.locator('#data-members')).toHaveAttribute('href','#sec-detail');
 await expect(page.locator('#mtable')).toContainText('Alice Très Long Nom');
 await page.locator('#data-members').click();await expect(page.locator('#sec-detail')).toBeFocused();
 await page.locator('#sec-detail a').click();await expect(page.locator('#sec-members')).toBeFocused();
});
test('PLAN-009 heatmap : 168 nombres et parts, zéros et clavier sans perte de focus',async({page})=>{
 await fixture(page);
 const summary=page.locator('#data-heat-summary');await page.locator('[data-hm="share"]').focus();await page.keyboard.press('Tab');await expect(summary).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.locator('#data-heat')).toHaveAttribute('open','');
 const result=await page.locator('#data-heat td').allTextContents();expect(result).toHaveLength(168);expect(result.filter(v=>v==='1')).toHaveLength(2);
 await page.locator('[data-hm="share"]').click();
 expect(await page.locator('#data-heat td').allTextContents()).toContain('1 (50 % de l’heure)');
 expect((await page.locator('#data-heat td').allTextContents()).filter(v=>v==='0 (0 % de l’heure)')).toHaveLength(166);
 await summary.focus();await page.evaluate(()=>tba.renderDashboard('Test'));
 await expect(summary).toBeFocused();await expect(page.locator('#data-heat')).toHaveAttribute('open','');
 await page.keyboard.press('Space');await expect(page.locator('#data-heat')).not.toHaveAttribute('open','');
 await expect(page.locator('.hm-cell[tabindex]')).toHaveCount(0);
});
test('PLAN-009 changements de filtre/granularité/vide et échec Chart : alternatives synchronisées',async({page})=>{
 await fixture(page);
 await page.locator('#data-timeline-summary').focus();await page.keyboard.press('Enter');
 await page.locator('[data-gran="month"]').click();expect(await page.locator('#data-timeline tbody tr').count()).toBe(1);
 await page.locator('#fl-query').fill('aucun résultat');await expect(page.locator('#s-total')).toHaveText('0');
 await expect(page.locator('#data-timeline')).toContainText('Aucune donnée');
 await page.locator('#fl-clear').click();
 await page.evaluate(()=>{window.Chart=function(){throw new Error('échec synthétique');};tba.renderDashboard('Test');});
 await expect(page.locator('#data-timeline')).toContainText('2');
 await expect(page.locator('#data-timeline')).toHaveAttribute('open','');
});
test('PLAN-009 HTML autonome offline et repli statique : tables présentes sans images',async({page,context})=>{
 await page.addInitScript(()=>{window.requestIdleCallback=()=>0;});await fixture(page);
 const model=await page.evaluate(()=>tba.buildReportModel());
 const html=await page.evaluate(()=>tba.buildHtmlExport('/*test*/'));
 const report=await context.newPage();await report.route('**/*',r=>r.abort());await report.setContent(html);
 await expect(report.locator('#data-hours tbody tr')).toHaveCount(24);await expect(report.locator('#data-heat td')).toHaveCount(168);
 await report.locator('[data-gran="month"]').click();await expect(report.locator('#data-timeline tbody tr')).toHaveCount(1);
 await report.locator('#fl-query').fill('aucun résultat');await expect(report.locator('#s-total')).toHaveText('0');await expect(report.locator('#data-timeline')).toContainText('Aucune donnée');
 await report.locator('#fl-clear').click();await expect(report.locator('#s-total')).toHaveText('2');
 const reexport=await report.evaluate(()=>tba.buildHtmlExport('/*test*/'));
 const reread=await context.newPage();await reread.route('**/*',r=>r.abort());await reread.setContent(reexport);await expect(reread.locator('#data-hours tbody tr')).toHaveCount(24);
 const staticHtml=await page.evaluate(model=>tba.buildHtmlStatic(model,{}),model);
 await report.setContent(staticHtml);await expect(report.locator('details.chart-data')).toHaveCount(8);
 await expect(report.locator('#data-heat td')).toHaveCount(168);
 await expect(report.locator('#data-topcards')).toContainText('suite complète');
 // L’ordre des cartes statiques diffère ; comparer chaque table à son équivalent live.
 for(const key of ['timeline','types','trends','topcards','hours','typetl','weekend','heat']) expect(await report.locator(`#data-${key} tbody`).textContent()).toBe(await page.locator(`#data-${key} tbody`).textContent());
 await page.locator('[data-hm="share"]').click();await report.setContent(await page.evaluate(()=>tba.buildHtmlStatic(tba.buildReportModel(),{})));
 expect(await report.locator('#data-heat td').allTextContents()).toContain('1 (50 % de l’heure)');
 await page.route('**/*',r=>r.abort());const promise=page.waitForEvent('download');await page.evaluate(()=>tba.exportHtml());
 const fallback=await fs.readFile(await(await promise).path(),'utf8');expect(fallback).toContain('id="data-topcards"');expect(fallback).toContain('id="data-heat"');
 const zipPromise=page.waitForEvent('download');await page.evaluate(()=>tba.exportZip());
 const zip=unzip(await fs.readFile(await(await zipPromise).path()));
 const bundled=Object.entries(zip).find(([name])=>name.endsWith('.html'));expect(bundled).toBeTruthy();expect(bundled[1].toString()).toContain('id="data-heat"');
});
test('PLAN-009 étiquettes de tendance limitées à la vue filtrée (complément PLAN-003)',async({page})=>{
 await fixture(page);await page.evaluate(()=>{const a=tba.state.actions[0];tba.state.actions=[...tba.state.actions,{...a,id:'excluded',memberName:'EXCLU_NOM',cardName:'secret'}];tba.renderDashboard('Test');});
 await page.locator('#fl-query').fill('suite complète');await expect(page.locator('#s-total')).toHaveText('2');
 expect(await page.evaluate(()=>tba.state.charts.trends.data.datasets.map(d=>d.label))).not.toContain('EXCLU_NOM');
 await expect(page.locator('#data-trends')).not.toContainText('EXCLU_NOM');
});

async function settled(page){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
}
for(const theme of ['light','dark']) test(`PLAN-009 axe tables ouvertes ${theme}`,async({page})=>{
 await fixture(page);await page.evaluate(theme=>{tba.Theme.apply(theme);document.querySelectorAll('details.chart-data').forEach(d=>d.open=true);},theme);
 await settled(page);
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations).toEqual([]);
});
for(const width of [360,390,768,1440]) test(`PLAN-009 tables ouvertes sans débordement page ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await fixture(page);
 await page.evaluate(()=>{document.querySelectorAll('details.chart-data').forEach(d=>d.open=true);});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===360){
  const wrap=page.locator('#data-heat .data-table-wrap');await wrap.focus();await page.keyboard.press('ArrowRight');
  await expect.poll(()=>wrap.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 }
 await page.locator('#data-timeline-summary').focus();await page.evaluate(()=>tba.setGran('month'));
 await expect(page.locator('#data-timeline-summary')).toBeFocused();
 const before=await page.locator('#data-heat tbody').textContent();await page.evaluate(()=>tba.Theme.apply('dark'));await page.setViewportSize({width:width+1,height:900});
 expect(await page.locator('#data-heat tbody').textContent()).toBe(before);
});
test('PLAN-009 domaines complétés, plusieurs séries et noms normalisés absents',async({page})=>{
 await fixture(page);await page.evaluate(()=>{
  tba.state.actions.push(tba.normalizeAction({id:'blank',date:'2026-10-21T10:00:00Z',type:'createCard',_memberName:'',data:{card:{name:''}}}));tba.renderDashboard('Test');
 });
 for(const key of ['timeline','trends','typetl']){
  const expected=await page.evaluate(key=>tba.state.charts[key].data.labels.map((_,i)=>tba.state.charts[key].data.datasets.map(s=>String(s.data[i]??0))),key);
  expect(await page.locator(`#data-${key} tbody tr`).evaluateAll(rows=>rows.map(r=>[...r.querySelectorAll('td')].map(c=>c.textContent)))).toEqual(expected);
  expect(expected.some(row=>row.every(v=>v==='0'))).toBe(true);
 }
 await expect(page.locator('#data-trends thead')).toContainText('Inconnu');
 await expect(page.locator('#data-topcards')).not.toContainText('undefined');
});
