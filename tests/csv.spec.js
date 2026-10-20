const {test}=require('@playwright/test');
const fs=require('node:fs/promises');
const {open,seed,expect,unzip}=require('./helpers');
function parseCsv(csv) {
  const rows=[]; let row=[], cell='',quoted=false;
  csv=csv.replace(/^\uFEFF/,'');
  for(let i=0;i<csv.length;i++) {
    const c=csv[i];
    if(c==='"') { if(quoted && csv[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; }
    else if(!quoted && c===','){row.push(cell);cell='';}
    else if(!quoted && c==='\r' && csv[i+1]==='\n'){row.push(cell);rows.push(row);row=[];cell='';i++;}
    else cell+=c;
  }
  return rows;
}
const hostile=['=1+1','+1','-1','@x','\ttexte','\rtexte','\ntexte','  =1+1','\u0000  +1','\uFEFF=1+1','\uFF1D1+1','\uFF0B1','\uFF0D1','\uFF20x','="a,b"\nligne'];
test('PLAN-004 cellules : préfixe dans champ cité, parse RFC et texte ordinaire identique',async({page})=>{
  await open(page);
  const result=await page.evaluate(values=>values.map(v=>tba.csvCell(v)),hostile);
  result.forEach((v,i)=>{expect(v.startsWith('"\t')).toBe(true);expect(parseCsv(v+'\r\n')).toEqual([['\t'+hostile[i]]]);});
  expect(await page.evaluate(()=>['','Français éà','a,b','a"b','a\nb'].map(tba.csvCell))).toEqual(['','Français éà','"a,b"','"a""b"','"a\nb"']);
});
test('PLAN-004 téléchargements CSV/ZIP et réexport offline protégés ; JSON/XLSX exacts',async({page,context})=>{
  await open(page); await seed(page);
  await page.evaluate(()=>{const a=tba.state.actions[0];a.id='=1+1';a.type='+1';a.memberName='@x';a.cardName='  -1';});
  const pending=page.waitForEvent('download');await page.evaluate(()=>tba.exportZip());
  const zip=unzip(await fs.readFile(await(await pending).path()));
  const rows=parseCsv(zip['actions.csv'].toString());expect(rows).toHaveLength(2);
  expect(rows[1]).toEqual(['\t=1+1','2026-09-22T10:00:00Z','\t+1','\t@x','\t  -1']);
  const json=JSON.parse(zip['analyse.json']);expect(json.actions[0].card).toBe('  -1');expect(json.actions[0].id).toBe('=1+1');
  const xml=unzip(zip['membres.xlsx']);expect(xml['xl/sharedStrings.xml'].toString()).toContain('  -1');
  expect(Object.values(xml).some(v=>v.toString().includes('<f>'))).toBe(false);
  const report=await context.newPage();await report.route('**/*',r=>r.abort());await report.setContent(zip['rapport.html'].toString());
  expect(await report.evaluate(()=>tba.csvCell('=1+1'))).toBe('"\t=1+1"');
  const direct=page.waitForEvent('download');await page.evaluate(()=>tba.exportCsv());
  expect(await fs.readFile(await(await direct).path())).toEqual(zip['actions.csv']);
});
