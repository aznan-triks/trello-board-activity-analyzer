const {test}=require('@playwright/test');
const {open,seed,expect}=require('./helpers');
const action={t:'commentCard',d:'2026-09-22T10:00:00Z',m:'Alice',c:'Carte'};
const base={boardData:{name:'Valide'},actions:[action]};
const invalid=[null,[],{}, {...base,actions:[null]}, {...base,actions:[{...action,t:{}}]},
 {...base,actions:[{...action,m:3}]},{...base,actions:[{...action,d:'impossible'}]},
 {...base,actions:[{...action,i:3}]},{...base,boardData:{name:{}}},
 {...base,actions:{}},{...base,creds:{token:4}},{...base,savedAt:'pas une date'}];
test('PLAN-006 sessions invalides : booléen strict, aucun état/snapshot modifié',async({page})=>{
 await open(page);await seed(page);
 for(const data of invalid){
  const result=await page.evaluate(async data=>{
   const previous=JSON.stringify(tba.state.actions),board=tba.state.board;
   localStorage.setItem('trello-v3',JSON.stringify(data));
   const ok=tba.validPayload(data);await tba.loadSaved();
   return {ok,same:previous===JSON.stringify(tba.state.actions)&&board===tba.state.board,saved:(()=>{try{return localStorage.getItem('trello-v3');}catch(_){return null;}})()};
  },data);
  expect(result).toEqual({ok:false,same:true,saved:JSON.stringify(data)});
 }
 await expect(page.locator('#err-msg')).toContainText('corrompues');
});
for(const id of [undefined,'a']) test(`PLAN-006 legacy/actuel : IDs ${id}, champs historiques optionnels`,async({page})=>{
 await open(page);
 await page.evaluate(async p=>{localStorage.setItem('trello-v3',JSON.stringify(p));await tba.loadSaved();},{boardData:{},actions:[{...action,...(id?{i:id}:{})}]});
 expect(await page.evaluate(()=>({name:tba.state.board.name,id:tba.state.actions[0].id}))).toEqual({name:'Tableau',id:id||''});
 await expect(page.locator('#s-total')).toHaveText('1');
});
test('PLAN-006 noms spéciaux : aucun prototype modifié, tendances rendues',async({page})=>{
 await open(page);await seed(page);
 const result=await page.evaluate(()=>{
  const names=['__proto__','constructor','toString'];
  const arr=names.map(n=>({date:'2026-09-22T10:00:00Z',_memberName:n}));
  const before=Object.getOwnPropertyNames(Object.prototype);
  const out=tba.byMemberPeriod(arr,'month');
  tba.state.actions=names.map((n,i)=>({...tba.state.actions[0],id:String(i),memberName:n}));tba.renderDashboard('Test');
  return {names:Object.keys(out),counts:names.map(n=>out[n]['2026-09']),safe:JSON.stringify(before)===JSON.stringify(Object.getOwnPropertyNames(Object.prototype))};
 });expect(result).toEqual({names:['__proto__','constructor','toString'],counts:[1,1,1],safe:true});
});
test('PLAN-006 selfTest isolé sous query active, état et références restaurés',async({page})=>{
 await open(page);await seed(page);
 const result=await page.evaluate(()=>{
  tba.state.filter.query='AUCUN_RESULTAT';tba.state.filter.members.add('Alice');
  const {filter,board,actions,creds}=tba.state;const before=JSON.stringify([...filter.members]);
  const test=tba.selfTest();return {failed:test.failed,same:filter===tba.state.filter&&board===tba.state.board&&actions===tba.state.actions&&creds===tba.state.creds,query:tba.state.filter.query,members:before===JSON.stringify([...tba.state.filter.members])};
 });expect(result).toEqual({failed:0,same:true,query:'AUCUN_RESULTAT',members:true});
});
test('PLAN-006 normalisation : champs raw objets ne deviennent pas du texte',async({page})=>{
 await open(page);
 const result=await page.evaluate(()=>tba.normalizeAction({date:'2026-09-22',type:{},_memberName:{},data:{card:{name:{}}}}));
 expect(result.memberName).toBe('Inconnu');expect(result.cardName).toBe('');expect(result.type).toBe('');
});
test('PLAN-006 rapports invalides refusés avant publication ; anciens rapports acceptés',async({page,context})=>{
 await open(page);await seed(page);
 const html=await page.evaluate(()=>tba.buildHtmlExport('/*test*/'));
 const match=html.match(/window.__TBA_EMBEDDED__ = (.*);<\/script>/);const p=JSON.parse(match[1]);
 const cases=[{...p,kind:'inconnu'},{...p,actions:[null]},{...p,board:{name:{}}},{...p,filter:{members:[{}]}},
  {...p,filter:{fromMs:2,toMs:1}},{...p,filter:{fromMs:1e100}},{...p,filter:{query:{}}},
  {...p,gran:'year'},{...p,heatMetric:'other'},{...p,provenance:{filters:{members:[{}]}}}];
 for(const data of cases){
  const report=await context.newPage();await report.route('**/*',r=>r.abort());
  await report.setContent(html.replace(match[1],JSON.stringify(data)),{waitUntil:'load'});
  await expect(report.locator('#err-msg')).toContainText('Rapport illisible');
  expect(await report.evaluate(()=>({board:tba.state.board,actions:tba.state.actions.length,saved:(()=>{try{return localStorage.getItem('trello-v3');}catch(_){return null;}})()}))).toEqual({board:null,actions:0,saved:null});
  await report.close();
 }
 const report=await context.newPage();await report.route('**/*',r=>r.abort());
 const old={...p};delete old.provenance;delete old.filter;delete old.gran;delete old.heatMetric;
 await report.setContent(html.replace(match[1],JSON.stringify(old)));
 expect(await report.evaluate(()=>tba.state.actions.length)).toBe(1);
});
test('PLAN-006 membres non array : échec explicite et ancien candidat conservé',async({page})=>{
 await open(page);await seed(page);
 await page.route('https://api.trello.com/**',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/members')?{}:{name:'Candidat'}}));
 await page.evaluate(()=>{document.getElementById('api-key').value='fake';document.getElementById('api-token').value='fake';document.getElementById('board-id').value='Ab12Cd34';return tba.startAnalysis();});
 await expect(page.locator('#err-msg')).toContainText('membres inattendue');
 expect(await page.evaluate(()=>tba.state.board.name)).toBe('Tableau synthétique');
});
test('PLAN-006 snapshot profondément corrompu : révocation ne réécrit pas les octets',async({page})=>{
 await open(page); await seed(page);
 const bad=JSON.stringify({...base,actions:[null],creds:{key:'fake',token:'fake'}});
 await page.evaluate(bad=>{localStorage.setItem('trello-v3',bad);const el=document.getElementById('keep-creds');el.checked=false;el.dispatchEvent(new Event('change'));},bad);
 await expect(page.locator('#toast')).toContainText('corrompue');
 expect(await page.evaluate(()=>localStorage.getItem('trello-v3'))).toBe(bad);
});
