const {test}=require('@playwright/test');
const {open,seed,expect}=require('./helpers');
test.use({timezoneId:'UTC'});
async function setDates(page,dates){return page.evaluate(dates=>{
 const a=tba.state.actions[0];tba.state.actions=dates.map((date,i)=>({...a,id:'a'+i,date,dateMs:Date.parse(date)}));tba.renderDashboard('Test');
 return {ins:tba.buildInsights(tba.getVisible(),tba.computeStats(tba.getVisible())),model:tba.buildReportModel(),json:JSON.parse(tba.buildAnalysisJson())};
},dates);}
test('PLAN-008 une action/un jour : 1/j, équivalent 7 sans prévision ni score',async({page})=>{
 await open(page);await seed(page);const r=await setDates(page,['2026-09-22T10:00:00Z']);
 expect(r.ins.score).toBe(null);expect(r.ins.forecast).toBe(7);expect(r.model.totals.dayAvg).toBe(1);expect(r.model.totals.weekAvg).toBe(7);
 await expect(page.locator('#nx-ring')).toHaveCount(0);await expect(page.locator('#nx-score')).toHaveCount(0);
 await expect(page.locator('#s-dayavg')).toHaveText('1.0');await expect(page.locator('#s-avg')).toHaveText('7');
 await expect(page.locator('#nx-brief')).toContainText('pas une prévision');await expect(page.locator('#nexus')).toContainText('ne mesurent ni effort');
 expect(r.ins.briefing).not.toMatch(/projection|opérationnelle|charge week-end|si le rythme tient/i);
});
test('PLAN-008 vide : aucun équivalent chiffré ni ratio suggéré',async({page})=>{
 await open(page);await seed(page);const r=await setDates(page,[]);
 expect(r.ins.score).toBe(null);expect(r.ins.weekDelta).toBe(null);expect(r.ins.briefing).not.toContain('7');
 await expect(page.locator('#s-dayavg')).toHaveText('—');await expect(page.locator('#s-avg')).toHaveText('—');
});
test('PLAN-008 semaines closes consécutives : semaine zéro, dates et filtre insuffisant',async({page})=>{
 await open(page);await seed(page);
 const r=await setDates(page,['2026-09-06T00:00:00Z','2026-09-20T10:00:00Z','2026-09-27T10:00:00Z']);
 expect(r.ins.weekDelta).toMatchObject({prev:0,cur:1,pct:null,prevStart:'2026-09-13',curStart:'2026-09-20'});
 expect(r.json.stats.timelineByWeek).toEqual({labels:['2026-09-06','2026-09-13','2026-09-20','2026-09-27'],data:[1,0,1,1]});
 const charts=await page.evaluate(()=>['timeline','trends','typetl'].map(k=>tba.state.charts[k].data.labels));
 for(const labels of charts)expect(labels).toEqual(r.json.stats.timelineByWeek.labels);
 const narrow=await page.evaluate(()=>{tba.state.filter.fromMs=Date.parse('2026-09-14T00:00:00Z');tba.renderDashboard('Test');return tba.state.lastInsights;});
 expect(narrow.weekDelta).toBe(null);expect(narrow.bullets.join(' ')).toContain('comparaison indisponible');
});
test('PLAN-008 moyennes : jours inclusifs et bornes explicites limitées à l’observation',async({page})=>{
 await open(page);await seed(page);await setDates(page,['2026-09-01T00:00:00Z','2026-09-22T10:00:00Z','2026-09-30T23:59:59Z']);
 const r=await page.evaluate(()=>{tba.state.filter.fromMs=Date.parse('2026-09-20T00:00:00Z');tba.state.filter.toMs=Date.parse('2026-09-25T23:59:59Z');tba.renderDashboard('Test');const m=tba.buildReportModel();return {days:m.totals.spanDaysExact,avg:m.totals.dayAvg,text:tba.state.lastInsights.briefing,md:tba.buildMarkdownReport(m)};});
 expect(r.days).toBe(6);expect(r.avg).toBeCloseTo(1/6);expect(r.text).toContain('6 jours civils observés');expect(r.md).toContain('6 jours civils observés');
});
test('PLAN-008 séries mois complétées, sommes conservées, top jours descriptif',async({page})=>{
 await open(page);await seed(page);await setDates(page,['2026-01-01T10:00:00Z','2026-04-01T10:00:00Z']);
 const r=await page.evaluate(()=>({series:tba.byPeriod(tba.state.actions,'month'),ins:tba.state.lastInsights,html:tba.buildHtmlExport('/*test*/')}));
 expect(r.series).toEqual({labels:['2026-01','2026-02','2026-03','2026-04'],data:[1,0,0,1]});
 await expect(page.locator('#nx-anomalies')).toContainText('Jours les plus actifs');expect(r.ins.quietDay).toBe(null);
 expect(r.html).not.toContain('id="nx-ring"');
});
test('PLAN-008 HTML offline et classeur/briefing : période et limites conservées',async({page,context})=>{
 await open(page);await seed(page);await setDates(page,['2026-09-01T00:00:00Z','2026-09-22T10:00:00Z','2026-09-30T23:59:59Z']);
 const data=await page.evaluate(()=>{
  tba.state.filter.fromMs=Date.parse('2026-09-20T00:00:00Z');tba.state.filter.toMs=Date.parse('2026-09-25T23:59:59Z');tba.renderDashboard('Test');
  const model=tba.buildReportModel();return {html:tba.buildHtmlExport('/*test*/'),book:Array.from(tba.buildXlsxWorkbook(model)),model};
 });
 const {unzip}=require('./helpers');const xml=unzip(Buffer.from(data.book));
 expect(xml['xl/sharedStrings.xml'].toString()).toContain('6 jours civils observés');expect(xml['xl/sharedStrings.xml'].toString()).toContain('pas une prévision');
 const report=await context.newPage();await report.route('**/*',r=>r.abort());await report.setContent(data.html);
 const model=await report.evaluate(()=>tba.buildReportModel());expect(model.totals.dayAvg).toBeCloseTo(1/6);expect(model.totals.spanDaysExact).toBe(6);
 expect(await report.evaluate(()=>tba.selfTest().failed)).toBe(0);
 const promise=page.waitForEvent('download');await page.evaluate(()=>tba.exportBriefing());const text=await require('node:fs/promises').readFile(await(await promise).path(),'utf8');
 expect(text).toContain('6 jours civils observés');expect(text).toContain('ne mesurent ni effort');
});
test('PLAN-008 bornes débordantes, partielles et base précédente non nulle',async({page})=>{
 await open(page);await seed(page);await setDates(page,['2026-09-06T00:00:00Z','2026-09-13T10:00:00Z','2026-09-20T10:00:00Z','2026-09-20T11:00:00Z','2026-09-27T10:00:00Z']);
 expect(await page.evaluate(()=>tba.state.lastInsights.weekDelta)).toMatchObject({prev:1,cur:2,pct:100});
 const result=await page.evaluate(()=>{
  tba.state.filter.fromMs=Date.parse('2026-01-01T00:00:00Z');tba.state.filter.toMs=Date.parse('2026-12-31T23:59:59Z');
  const all=tba.buildReportModel().totals.spanDaysExact;
  tba.state.filter.fromMs=null;tba.state.filter.toMs=Date.parse('2026-09-19T23:59:59Z');
  return {all,partial:tba.buildReportModel().insights.weekDelta,sparse:Object.keys(tba.byMemberPeriod(tba.state.actions,'week').Alice).length};
 });expect(result).toEqual({all:22,partial:null,sparse:4});
});
