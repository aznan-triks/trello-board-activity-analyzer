const {test}=require('@playwright/test');
const {open,seed,expect}=require('./helpers');
const fixtures={
 UTC:[['2026-09-21T22:30:00Z','2026-09-21','2026-09-20',22,1],['2026-03-29T00:30:00Z','2026-03-29','2026-03-29',0,0],['2026-12-31T23:30:00Z','2026-12-31','2026-12-27',23,4]],
 'Europe/Paris':[['2026-09-21T22:30:00Z','2026-09-22','2026-09-20',0,2],['2026-03-29T01:30:00Z','2026-03-29','2026-03-29',3,0],['2026-10-25T00:30:00Z','2026-10-25','2026-10-25',2,0],['2026-10-25T01:30:00Z','2026-10-25','2026-10-25',2,0],['2026-12-31T23:30:00Z','2027-01-01','2026-12-27',0,5]],
 'America/New_York':[['2026-09-21T22:30:00Z','2026-09-21','2026-09-20',18,1],['2026-03-08T07:30:00Z','2026-03-08','2026-03-08',3,0],['2026-11-01T05:30:00Z','2026-11-01','2026-11-01',1,0],['2026-11-01T06:30:00Z','2026-11-01','2026-11-01',1,0],['2026-01-01T00:30:00Z','2025-12-31','2025-12-28',19,3]]
};
for(const timezoneId of Object.keys(fixtures)) test(`PLAN-007 calendrier ${timezoneId} : jours/semaines/heures/weekend/libellés cohérents`,async({browser})=>{
 const context=await browser.newContext({timezoneId});const page=await context.newPage();await open(page);await seed(page);
 for(const [date,day,week,hour,dow] of fixtures[timezoneId]){
  const result=await page.evaluate(date=>{
   const a=tba.normalizeAction({date,type:'commentCard',_memberName:'Alice'});tba.state.actions=[a];const st=tba.computeStats([a]);tba.renderDashboard('Test');const m=tba.buildReportModel();
   return {days:[...st.dayCounts.keys()],weeks:[...st.weekCounts.keys()],hour:st.peakHour,weekend:st.weekend,heat:[...st.dayHour.keys()],date:a.date,peak:m.totals.peakDayLabel,timezone:JSON.parse(tba.buildAnalysisJson()).timezone};
  },date);
  expect(result.days).toEqual([day]);expect(result.weeks).toEqual([week]);expect(result.hour).toBe(hour);expect(result.weekend).toBe(dow===0||dow===6?1:0);expect(result.heat).toEqual([dow*24+hour]);expect(result.date).toBe(date);expect(result.timezone).toBe(timezoneId);
  expect(result.peak.startsWith(day.slice(-2))).toBe(true);
 }
 await expect(page.locator('#calendar-note')).toContainText(timezoneId);
 // Deux jours civils malgré 23/25h et deux jours UTC dans le même jour local.
 const result=await page.evaluate(()=>{
  const dates=[new Date(2026,2,7,23,30),new Date(2026,2,8,23,30)];
  const arr=dates.map(d=>tba.normalizeAction({date:d.toISOString(),_memberName:'Alice'}));
  const st=tba.computeStats(arr);return {days:st.dayCounts.size,streak:st.longestStreak,member:st.memberExtras.get('Alice').days.size};
 });expect(result).toEqual({days:2,streak:2,member:2});
 await context.close();
});
for(const timezoneId of ['Europe/Paris','America/New_York']) test(`PLAN-007 fenêtre civile 7 jours autour du DST ${timezoneId}`,async({browser})=>{
 const context=await browser.newContext({timezoneId});const page=await context.newPage();await open(page);await seed(page);
 const result=await page.evaluate(timezoneId=>{
  const newest=timezoneId==='Europe/Paris'?new Date(2026,2,30,12,30):new Date(2026,2,9,12,30);
  tba.state.actions[0].dateMs=newest.getTime();tba.state.actions[0].date=newest.toISOString();tba.setTimeWindow(7);
  const d=new Date(tba.state.filter.fromMs);return {hour:d.getHours(),elapsed:(newest-tba.state.filter.fromMs)/3600000};
 },timezoneId);
 expect(result).toEqual({hour:12,elapsed:167});await context.close();
});
test('PLAN-007 bornes : minute inclusive, zéro epoch, intervalle inversé refusé sans mutation',async({page})=>{
 await open(page);await seed(page);
 const result=await page.evaluate(()=>{
  const a=tba.state.actions[0];tba.state.actions=[{...a,dateMs:-1},{...a,id:'zero',dateMs:0}];tba.state.filter.fromMs=0;return tba.getVisible().map(a=>a.id);
 });expect(result).toEqual(['zero']);
 const before=await page.evaluate(()=>({...tba.state.filter,members:[...tba.state.filter.members]}));
 await page.evaluate(()=>{document.getElementById('fl-from').value='2026-09-23T12:00';document.getElementById('fl-to').value='2026-09-22T12:00';document.getElementById('fl-to').dispatchEvent(new Event('change'));});
 expect(await page.evaluate(()=>({...tba.state.filter,members:[...tba.state.filter.members]}))).toEqual(before);
 await expect(page.locator('#toast')).toContainText('inversées');
});
test('PLAN-007 rapport lu dans un autre fuseau : provenance et recalcul lecteur explicites',async({browser})=>{
 const source=await browser.newContext({timezoneId:'Europe/Paris'});const p=await source.newPage();await open(p);await seed(p);
 const html=await p.evaluate(()=>tba.buildHtmlExport('/*test*/'));
 const reader=await browser.newContext({timezoneId:'America/New_York'});const r=await reader.newPage();await r.route('**/*',route=>route.abort());await r.setContent(html);
 await expect(r.locator('#calendar-note')).toContainText('America/New_York');await expect(r.locator('#calendar-note')).toContainText('Europe/Paris');
 const json=await r.evaluate(()=>JSON.parse(tba.buildAnalysisJson()));expect(json.timezone).toBe('America/New_York');
 await source.close();await reader.close();
});
for(const timezoneId of ['UTC','Europe/Paris','America/New_York']) test(`PLAN-007 DST automne/printemps et minute inclusive ${timezoneId}`,async({browser})=>{
 const context=await browser.newContext({timezoneId});const page=await context.newPage();await open(page);await seed(page);
 const result=await page.evaluate(timezoneId=>{
  const transition=timezoneId==='America/New_York'?[10,1]:[9,25];
  const a=tba.state.actions[0];const dates=[new Date(2026,transition[0],transition[1]-1,23,30),new Date(2026,transition[0],transition[1],23,30)];
  const list=dates.map((d,i)=>({...a,id:String(i),date:d.toISOString(),dateMs:d.getTime()}));const st=tba.computeStats(list);
  // Un même jour civil contenant deux jours UTC (Paris en été, NY avant minuit UTC).
  const pair=[new Date(2026,5,1,0,30),new Date(2026,5,1,23,30)].map((d,i)=>({...a,id:'p'+i,date:d.toISOString(),dateMs:d.getTime()}));
  const same=tba.computeStats(pair);
  const start=new Date(2026,8,22,12,0,0),end=new Date(2026,8,22,12,0,59,999);
  tba.state.actions=[{...a,id:'start',dateMs:+start},{...a,id:'end',dateMs:+end},{...a,id:'outside',dateMs:+end+1}];
  document.getElementById('fl-from').value='2026-09-22T12:00';document.getElementById('fl-to').value='2026-09-22T12:00';document.getElementById('fl-to').dispatchEvent(new Event('change'));
  return {days:st.dayCounts.size,streak:st.longestStreak,same:same.dayCounts.size,ids:tba.getVisible().map(a=>a.id),sum:[...st.weekCounts.values()].reduce((a,b)=>a+b,0)};
 },timezoneId);
 expect(result).toEqual({days:2,streak:2,same:1,ids:['start','end'],sum:2});await context.close();
});
