import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDemoAPI, DEMO_MODE} from '../static/browser-demo.mjs';
import {checkBrowserCSV} from '../static/browser-csv.mjs';
const seed=JSON.parse(readFileSync(new URL('../atlas/seed.json',import.meta.url),'utf8'));
const body=data=>({method:'POST',body:JSON.stringify(data)});
const memory=()=>{ const map=new Map(); return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}; };

test('the Python UI does not opt into browser demo mode',()=>assert.equal(DEMO_MODE,false));
test('catalogue changes persist only in the selected browser storage',async()=>{
  const storage=memory(), api=createDemoAPI(seed,storage);
  assert.equal((await api.request('/api/status')).resources,12);
  const created=await api.request('/api/resources',body({title:'New document',type:'document',tags:[' EVENTS ','events']}));
  assert.deepEqual(created.tags,['events']);
  assert.equal((await createDemoAPI(seed,storage).request('/api/status')).resources,13);
  assert.equal((await createDemoAPI(seed,memory()).request('/api/status')).resources,12);
  assert.equal((await api.request('/api/resources?q=new&type=document&tag=events')).length,1);
  api.reset(); assert.equal((await api.request('/api/status')).resources,12);
});
test('links, types, URLs and review dates are validated',async()=>{
  const api=createDemoAPI(seed,memory());
  for(const record of [{title:'x',type:'bad'},{title:'x',type:'document',url:'javascript:alert(1)'},{title:'x',type:'document',reviewed_on:'2026-02-30'}]) await assert.rejects(api.request('/api/resources',body(record)));
  await assert.rejects(api.request('/api/resources/1/relations',body({target_id:999,kind:'related to'})));
  await assert.rejects(api.request('/api/resources/1/relations',body({target_id:1,kind:'related to'})));
});
test('prepared examples do not analyse arbitrary text or write before approval',async()=>{
  const api=createDemoAPI(seed,memory());
  const proposal=await api.request('/api/ai/proposals',body({text:'Arbitrary different title',demo_scenario:'proposal'}));
  assert.match(proposal.message,/not been interpreted/); assert.equal(proposal.records[0].title,'Volunteer onboarding FAQ');
  assert.equal((await api.request('/api/status')).resources,12);
  const payload={request_id:'confirm-demo-123',records:proposal.records};
  const result=await api.request('/api/ai/confirm',body(payload));
  assert.deepEqual(await api.request('/api/ai/confirm',body(payload)),result);
  assert.equal((await api.request('/api/status')).resources,13);
  const refusal=await api.request('/api/ai/proposals',body({demo_scenario:'refusal'}));
  assert.equal(refusal.kind,'refusal'); assert.deepEqual(refusal.records,[]);
});
test('batch save and browser quota failures are atomic',async()=>{
  const api=createDemoAPI(seed,memory());
  await assert.rejects(api.request('/api/ai/confirm',body({request_id:'rollback-demo-123',records:[{title:'First',type:'document'},{title:'Second',type:'document',relations:[{target_id:999,kind:'related to'}]}]})));
  assert.equal((await api.request('/api/status')).resources,12);
  const full=createDemoAPI(seed,{getItem:()=>null,setItem(){throw Error('quota');}});
  await assert.rejects(full.request('/api/resources',body({title:'Unsaved',type:'document'})),/could not save/);
  assert.equal((await full.request('/api/status')).resources,12);
});
test('browser CSV checker matches supplied samples and physical issue locations',()=>{
  for(const [file,rows,errors,warnings] of [['events-valid.csv',3,0,0],['events-errors.csv',4,5,1],['events-semicolon.csv',2,0,0]]) {
    const result=checkBrowserCSV(readFileSync(new URL('../samples/'+file,import.meta.url)));
    assert.deepEqual([result.rows,result.errors,result.warnings],[rows,errors,warnings]);
    if(errors) assert.deepEqual(result.issues.map(i=>[i.row,i.column,i.severity]),[[3,'event_id','error'],[4,'title','error'],[4,'event_date','error'],[4,'capacity','error'],[4,'registered','error'],[5,'registered','warning']]);
  }
});
test('browser CSV handles BOM, multiline quotes, malformed quotes, encoding and size',()=>{
  const encode=s=>new TextEncoder().encode(s), header='event_id,title,event_date,capacity,registered\n';
  assert.equal(checkBrowserCSV(encode('\ufeff'+header+'a,"A\nquoted title",2026-12-12,4,3')).rows,1);
  const multiline=checkBrowserCSV(encode(header+'a,"A\nquoted title",2026-12-12,4,5'));
  assert.equal(multiline.issues[0].row,3);
  assert.throws(()=>checkBrowserCSV(encode(header+'a,"Unclosed,2026-12-12,4,3')),/Malformed/);
  assert.throws(()=>checkBrowserCSV(new Uint8Array([255,255])),/UTF-8/);
  assert.throws(()=>checkBrowserCSV(new Uint8Array(2*1024*1024+1)),/2 MB/);
});
