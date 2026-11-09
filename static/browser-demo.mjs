import {checkBrowserCSV, validDate} from './browser-csv.mjs';
export const DEMO_MODE = typeof document !== 'undefined' && document.querySelector('meta[name="atlas-mode"]')?.content === 'browser-demo';
const KEY = 'atlas-browser-demo-v1';
const TYPES = ['document', 'dataset', 'report'], KINDS = ['describes', 'derived from', 'related to'];
export function createDemoAPI(seed, storage) {
  const fresh = () => ({resources: seed.resources.map((r, i) => ({description:'',owner:'',url:'',reviewed_on:null,tags:[],...r,id:i+1})), relations:seed.relations.map(([source_id,target_id,kind])=>({source_id,target_id,kind})), nextId:seed.resources.length+1, receipts:{}});
  let state = fresh();
  const saved = storage?.getItem(KEY);
  if (saved) {
    try { const parsed=JSON.parse(saved); if (!Array.isArray(parsed.resources) || !Array.isArray(parsed.relations) || !Number.isInteger(parsed.nextId) || !parsed.receipts) throw Error(); state=parsed; }
    catch { throw new Error('Saved demo data could not be read. Use Reset demo to start again.'); }
  }
  const commit = next => {
    try { storage?.setItem(KEY, JSON.stringify(next)); }
    catch { throw new Error('Your browser could not save this change. Free some browser storage or reset the demo.'); }
    state = next;
  };
  const get = (db, id) => { const item=db.resources.find(r=>r.id===id); if (!item) throw new Error('Resource not found.'); return item; };
  const clean = record => {
    const string = (name, max) => { const value=record[name] ?? ''; if (typeof value !== 'string' || value.length>max) throw new Error(`Check ${name}: maximum ${max} characters.`); return value.trim(); };
    const title=string('title',180), type=record.type;
    if (!title || !TYPES.includes(type)) throw new Error('Enter a name and choose document, dataset or report.');
    const url=string('url',1000);
    if (url) { try { const parsed=new URL(url); if (!['http:','https:'].includes(parsed.protocol)) throw Error(); } catch { throw new Error('Use an absolute http:// or https:// URL, or leave it empty.'); } }
    const reviewed_on=record.reviewed_on || null;
    if (reviewed_on && !validDate(reviewed_on)) throw new Error('Enter a real review date in YYYY-MM-DD format.');
    if (!Array.isArray(record.tags ?? []) || (record.tags?.length || 0)>12 || (record.tags || []).some(tag=>typeof tag!=='string' || tag.length>40)) throw new Error('Use at most 12 tags, each up to 40 characters.');
    return {title,type,description:string('description',4000),owner:string('owner',120),url,reviewed_on,tags:[...new Set((record.tags||[]).map(t=>t.trim().toLowerCase()).filter(Boolean))]};
  };
  const addLink = (db, source, link) => {
    get(db,source); get(db,link.target_id);
    if (source===link.target_id) throw new Error('A resource cannot link to itself.');
    if (!KINDS.includes(link.kind)) throw new Error('Choose a valid relationship type.');
    if (!db.relations.some(l=>l.source_id===source&&l.target_id===link.target_id&&l.kind===link.kind)) db.relations.push({source_id:source,target_id:link.target_id,kind:link.kind});
  };
  const insert = (db, record) => {
    if (db.resources.length>=200) throw new Error('The browser demo is limited to 200 resources. Reset it or download the full app.');
    const item={...clean(record),id:db.nextId++}; db.resources.push(item); return item;
  };
  return {
    reset() { storage?.removeItem(KEY); state=fresh(); },
    async request(path, options = {}) {
      const url=new URL(path,'https://atlas.invalid'), route=url.pathname, method=options.method || 'GET';
      if (route==='/api/status') return {resources:state.resources.length,relations:state.relations.length,ai_configured:true,model:'prepared examples',version:'1.0.0',demo:true};
      if (route==='/api/tags') return [...new Set(state.resources.flatMap(r=>r.tags))].sort();
      if (route==='/api/csv/check') return checkBrowserCSV(await options.body.get('file').arrayBuffer());
      const data=typeof options.body==='string' ? JSON.parse(options.body) : options.body;
      if (route==='/api/resources' && method==='GET') {
        const q=(url.searchParams.get('q') || '').toLowerCase(), type=url.searchParams.get('type'), tag=url.searchParams.get('tag');
        return structuredClone(state.resources.filter(r=>(!q||(r.title+' '+r.description).toLowerCase().includes(q))&&(!type||r.type===type)&&(!tag||r.tags.includes(tag))).sort((a,b)=>b.id-a.id));
      }
      if (route==='/api/resources' && method==='POST') { const next=structuredClone(state), item=insert(next,data); commit(next); return structuredClone(item); }
      const match=route.match(/^\/api\/resources\/(\d+)(\/relations)?$/);
      if (match) {
        const id=Number(match[1]); get(state,id);
        if (method==='GET' && !match[2]) return structuredClone({...get(state,id),relations:state.relations.filter(l=>l.source_id===id||l.target_id===id).map(l=>({...l,source_title:get(state,l.source_id).title,target_title:get(state,l.target_id).title}))});
        const next=structuredClone(state);
        if (method==='PUT' && !match[2]) { Object.assign(get(next,id),clean(data)); commit(next); return structuredClone(get(state,id)); }
        if (method==='POST' && match[2]) { addLink(next,id,data); commit(next); return {saved:true}; }
      }
      if (route==='/api/ai/proposals') {
        if (data.demo_scenario==='refusal') return {kind:'refusal',message:'Prepared refusal example: cooking recipes are outside the assistant’s scope. No live model was called.',records:[]};
        if (data.demo_scenario==='answer') return {kind:'answer',message:'Prepared answer example: metadata describes a resource. A resource has a name, type and optional owner, description, review date, link and tags. No live model was called.',records:[]};
        const record={title:'Volunteer onboarding FAQ',type:'document',description:'Explains how volunteers register and complete onboarding.',owner:'Petra Novak',reviewed_on:null,url:'',tags:['volunteers','onboarding'],relations:[{target_id:1,kind:'related to',reason:'Prepared example: connects this FAQ to the registration guide.'}]};
        return {kind:'proposal',message:'Prepared draft example. Your text has not been interpreted by a live model. Edit this example, then approve it to try the save workflow in your browser.',records:[{...record,duplicates:state.resources.filter(r=>r.title.toLowerCase()===record.title.toLowerCase()).map(r=>({id:r.id,title:r.title}))}]};
      }
      if (route==='/api/ai/confirm') {
        if (!/^[a-zA-Z0-9-]{8,80}$/.test(data.request_id) || !Array.isArray(data.records) || !data.records.length || data.records.length>8) throw new Error('Select between 1 and 8 valid drafts.');
        const payload=JSON.stringify(data.records), receipt=Object.hasOwn(state.receipts,data.request_id) ? state.receipts[data.request_id] : null;
        if (receipt) { if (receipt.payload!==payload) throw new Error('This request ID was already used for a different confirmation.'); return {resource_ids:receipt.ids}; }
        const next=structuredClone(state), ids=[];
        for (const record of data.records) { const item=insert(next,record); ids.push(item.id); if ((record.relations?.length || 0)>8) throw new Error('Use at most 8 relationships.'); for (const link of record.relations || []) addLink(next,item.id,link); }
        next.receipts[data.request_id]={payload,ids}; commit(next); return {resource_ids:ids};
      }
      throw new Error('This action is not available in the browser demo.');
    }
  };
}
let apiPromise;
export function resetDemo() { try { localStorage.removeItem(KEY); location.reload(); } catch { throw new Error('The browser could not reset demo storage.'); } }
export async function demoRequest(path, options) {
  apiPromise ||= fetch('/demo/seed.json').then(r=>{ if (!r.ok) throw new Error('The demo could not load its sample data. Reload the page.'); return r.json(); }).then(seed=>{
    let storage; try { storage=localStorage; } catch { /* Private browsers can use memory for this visit. */ }
    return createDemoAPI(seed,storage);
  });
  return (await apiPromise).request(path,options);
}
