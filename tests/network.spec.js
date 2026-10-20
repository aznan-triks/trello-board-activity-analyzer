const {test}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const {open,seed,expect}=require('./helpers');
async function harness(page) {
 test.skip(!!process.env.BASE_URL,'Harness du code local, pas de substitution sur site distant.');
 const html=await fs.readFile(path.join(__dirname,'../index.html'),'utf8');
 await page.route('http://127.0.0.1:8080/',r=>r.fulfill({contentType:'text/html',body:html.replace('  window.tba = API;', '  window.__network = { sleep, retryDelay, fetchJSON, Limiter };\n  window.tba = API;')}));
 await open(page);await page.clock.install({time:new Date('2026-10-21T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-21T12:00:00Z'));
}
test('PLAN-005 Retry-After secondes/date/invalides et longs délais non tronqués',async({page})=>{
 await harness(page);
 const result=await page.evaluate(()=>{
  const delay=h=>__network.retryDelay({headers:{get:()=>h}},1);
  return {seconds:delay('120'),date:delay('Wed, 21 Oct 2026 12:02:00 GMT'),zero:delay('0'),invalid:delay('oops'),past:delay('Wed, 21 Oct 2026 11:00:00 GMT')};
 });expect(result.seconds).toBe(120000);expect(result.date).toBe(120000);expect(result.zero).toBe(0);
 for(const n of [result.invalid,result.past]) {expect(n).toBeGreaterThanOrEqual(250);expect(n).toBeLessThanOrEqual(500);}
});
test('PLAN-005 limite 90/10s : retry inclus, aucun départ prématuré',async({page})=>{
 await harness(page);
 await page.evaluate(()=>{
  window.calls=[];window.waitCalls=0;
  const wait=__network.Limiter.wait;__network.Limiter.wait=signal=>{waitCalls++;return wait(signal);};
  window.fetch=async()=>{calls.push(Date.now());return new Response('{}',{status:calls.length===90?429:200,headers:{'Retry-After':'0'}});};
  window.done=false;
  Promise.all(Array.from({length:90},()=>__network.fetchJSON('https://api.trello.com/test'))).then(()=>window.done=true);
 });
 await expect.poll(()=>page.evaluate(()=>waitCalls)).toBe(91);
 expect(await page.evaluate(()=>calls.length)).toBe(90);
 await page.clock.runFor(9999);expect(await page.evaluate(()=>calls.length)).toBe(90);
 await page.clock.runFor(1);await expect.poll(()=>page.evaluate(()=>calls.length)).toBe(91);
 expect(await page.evaluate(()=>done)).toBe(true);
 const dates=await page.evaluate(()=>calls);expect(dates[90]-dates[0]).toBeGreaterThanOrEqual(10000);
});
for(const header of ['120','Wed, 21 Oct 2026 12:02:00 GMT']) test(`PLAN-005 attente réelle du header ${header}`,async({page})=>{
 await harness(page);
 await page.evaluate(header=>{window.calls=0;window.fetch=async()=>new Response('{}',{status:++calls===1?503:200,headers:{'Retry-After':header}});window.done=false;__network.fetchJSON('https://api.trello.com/test').then(()=>window.done=true);},header);
 await expect.poll(()=>page.evaluate(()=>calls)).toBe(1);
 await page.clock.runFor(119999);expect(await page.evaluate(()=>calls)).toBe(1);
 await page.clock.runFor(1);await expect.poll(()=>page.evaluate(()=>done)).toBe(true);expect(await page.evaluate(()=>calls)).toBe(2);
});
for(const mode of ['backoff','limiter','page']) test(`PLAN-005 annulation pendant ${mode}, aucun départ supplémentaire`,async({page})=>{
 await harness(page);await seed(page);
 const before=await page.evaluate(()=>localStorage.getItem('trello-v3'));
 await page.evaluate(mode=>{
  window.controller=new AbortController();window.calls=0;window.result=null;
  window.fetch=async()=>{window.calls++;return new Response('{}',{status:429,headers:{'Retry-After':'120'}});};
  const run=async()=>{
   if(mode==='limiter'){for(let i=0;i<90;i++)await __network.Limiter.wait();}
   if(mode==='page')await __network.sleep(150,controller.signal);
   else await __network.fetchJSON('https://api.trello.com/test',{signal:controller.signal});
  };
  run().then(()=>window.result='ok',e=>window.result=e.name);
 },mode);
 await expect.poll(()=>page.evaluate(()=>calls)).toBe(mode==='backoff'?1:0);
 const t=performance.now();await page.evaluate(()=>controller.abort());
 await expect.poll(()=>page.evaluate(()=>result)).toBe('CanceledError');expect(performance.now()-t).toBeLessThan(500);
 await page.clock.runFor(130000);expect(await page.evaluate(()=>calls)).toBe(mode==='backoff'?1:0);
 expect(await page.evaluate(()=>localStorage.getItem('trello-v3'))).toBe(before);
});
test('PLAN-005 pré-aborted, retries bornés, auth et JSON invalide sans retry',async({page})=>{
 await harness(page);
 const result=await page.evaluate(async()=>{
  const c=new AbortController();c.abort();let timers=0,calls=0;const set=window.setTimeout;
  window.setTimeout=(...args)=>{timers++;return set(...args);};window.fetch=async()=>{calls++;return new Response('{}');};
  await __network.sleep(10,c.signal).catch(()=>{});await __network.fetchJSON('https://api.trello.com/test',{signal:c.signal}).catch(()=>{});
  window.setTimeout=set;
  const pre={calls,timers};const counts=[];
  for(const status of [401,403,404,200]){calls=0;window.fetch=async()=>{calls++;return new Response('invalide',{status});};await __network.fetchJSON('https://api.trello.com/test').catch(()=>{});counts.push(calls);}
  return {pre,counts};
 });expect(result).toEqual({pre:{calls:0,timers:0},counts:[1,1,1,1]});
 await page.evaluate(()=>{window.calls=0;window.done=false;window.fetch=async()=>{calls++;throw new TypeError('réseau');};__network.fetchJSON('https://api.trello.com/test').catch(()=>window.done=true);});
 for(let i=0;i<5;i++)await page.clock.runFor(10000);
 expect(await page.evaluate(()=>({calls,done}))).toEqual({calls:4,done:true});
});
test('PLAN-005 très long sleep segmenté et annulable, timeout seulement pendant fetch',async({page})=>{
 await harness(page);
 const result=await page.evaluate(async()=>{
  const c=new AbortController(),set=window.setTimeout;let max=0;
  window.setTimeout=(fn,ms,...args)=>{max=Math.max(max,ms);return set(fn,ms,...args);};
  const pending=__network.sleep(2147484000,c.signal).catch(e=>e.name);c.abort();
  const error=await pending;window.setTimeout=set;return {max,error};
 });expect(result).toEqual({max:2147483647,error:'CanceledError'});
 await page.evaluate(()=>{
  window.calls=0;window.fetch=(url,{signal})=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Timeout','AbortError')),{once:true}));};
  window.done=false;__network.fetchJSON('https://api.trello.com/test').catch(()=>window.done=true);
 });
 await page.clock.runFor(29999);expect(await page.evaluate(()=>calls)).toBe(1);
 await page.clock.runFor(501);await expect.poll(()=>page.evaluate(()=>calls)).toBe(2);
 for(let i=0;i<4;i++)await page.clock.runFor(40000);
 expect(await page.evaluate(()=>({calls,done}))).toEqual({calls:4,done:true});
});
test('PLAN-005 route 429, annulation du refresh : état/snapshot préservés',async({page})=>{
 await harness(page);await seed(page);
 const before=await page.evaluate(()=>({actions:JSON.stringify(tba.state.actions),saved:localStorage.getItem('trello-v3')}));
 let calls=0;
 await page.route('https://api.trello.com/**',r=>{
  const isActions=r.request().url().includes('/actions');if(isActions)calls++;
  return r.fulfill({status:isActions?429:200,json:isActions?{}:[],headers:{'Retry-After':'120','Access-Control-Expose-Headers':'Retry-After'}});
 });
 const refresh=page.evaluate(()=>tba.refreshData(true));await expect.poll(()=>calls).toBe(1);
 const t=performance.now();await page.evaluate(()=>document.getElementById('btn-cancel').click());await refresh;
 // Inclut le redessin de huit graphiques sous charge parallèle ; attentes isolées <500 ms ci-dessus.
 expect(performance.now()-t).toBeLessThan(1000);
 expect(await page.evaluate(()=>({actions:JSON.stringify(tba.state.actions),saved:localStorage.getItem('trello-v3')}))).toEqual(before);
 await page.clock.runFor(120000);expect(calls).toBe(1);
});
