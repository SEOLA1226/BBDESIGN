import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const script=readFileSync(new URL('../public/backend.js',import.meta.url),'utf8');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('static adapter: authentication, refresh, public read, partial updates, image rollback and CRUD',async()=>{
 const store=new Map(),objects=new Set();let projects=[],writesFail=false,refreshes=0;
 const info={name:'BBDESIGN',email:'owner@example.test'},site={sections:[{id:'info',label:'INFO',visible:true},{id:'contact',label:'CONTACT',visible:true},{id:'portfolio',label:'PORTFOLIO',visible:true}],previewCount:6,showExamples:true};
 const reply=(value,status=200)=>new Response(JSON.stringify(value),{status});
 const fetch=async(input,o={})=>{
  const u=new URL(input),method=o.method||'GET',auth=o.headers?.Authorization,p=u.pathname;
  if(p==='/auth/v1/token'){const body=JSON.parse(o.body);if(u.searchParams.get('grant_type')==='refresh_token')refreshes++;const owner=body.email!=='visitor@example.test';return reply({access_token:owner?'owner-token':'visitor-token',refresh_token:'test-refresh',expires_in:refreshes?3600:1,user:{id:owner?'owner':'visitor'}});}
  if(p==='/rest/v1/bb_admins')return reply(auth==='Bearer owner-token'?[{user_id:'owner'}]:[]);
  if(p==='/rest/v1/bb_settings'&&method==='GET'){assert.equal(auth,undefined);return reply([{id:'info',value:info},{id:'site',value:site}]);}
  if(p==='/rest/v1/bb_projects'&&method==='GET'){const id=u.searchParams.get('id')?.slice(3);return reply(id?projects.filter(x=>x.id===id):projects);}
  if(auth!=='Bearer owner-token')return reply({message:'Denied'},403);
  if(p==='/rest/v1/rpc/bb_patch_info'){Object.assign(info,JSON.parse(o.body).p_patch);return reply(null);}
  if(p==='/rest/v1/bb_settings'){Object.assign(site,JSON.parse(o.body).value);return reply(null);}
  if(p==='/rest/v1/bb_projects'){if(writesFail)return reply({message:'Database unavailable'},503);const body=o.body?JSON.parse(o.body):null,id=u.searchParams.get('id')?.slice(3);if(method==='POST')projects.push(body);if(method==='PATCH')projects=projects.map(x=>x.id===id?body:x);if(method==='DELETE')projects=projects.filter(x=>x.id!==id);return reply(null);}
  if(p.startsWith('/storage/v1/object/portfolio-images/')){assert(o.body instanceof Uint8Array);objects.add(p.split('/').at(-1));return reply({Key:p});}
  if(p==='/storage/v1/object/portfolio-images'){for(const name of JSON.parse(o.body).prefixes)objects.delete(name);return reply([]);}
  if(p==='/auth/v1/logout'||p==='/auth/v1/user')return reply({});
  throw Error('Unexpected mock route: '+p);
 };
 const window={BBDESIGN_CONFIG:{mode:'supabase',url:'https://test.supabase.co',key:'sb_publishable_test'}};
 const context={window,fetch,Response,Uint8Array,atob,crypto:webcrypto,sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}};
 vm.runInNewContext(script,context);
 const request=(path,method='GET',body)=>window.bbFetch(path,{method,body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal((await request('/api/info','PUT',{name:'bad'})).status,401);
 assert.equal((await request('/api/content')).status,200);
 assert.equal((await request('/api/login','POST',{email:'visitor@example.test',password:'test-password'})).status,403);
 assert.equal((await request('/api/login','POST',{email:'owner@example.test',password:'test-password'})).status,200);
 assert.equal((await(await request('/api/session')).json()).authenticated,true);assert.equal(refreshes,1);
 assert.equal((await request('/api/info','PUT',{intro:'New intro'})).status,200);assert.equal(info.email,'owner@example.test');assert.equal(info.intro,'New intro');
 assert.equal((await request('/api/site','PUT',{...site,sections:site.sections.map(s=>({...s,visible:false}))})).status,400);
 assert.equal((await request('/api/site','PUT',{...site,previewCount:2})).status,200);assert.equal(site.previewCount,2);
 const payload={title:'Work',category:'Branding',description:'Test',uploads:[png]};
 writesFail=true;assert.equal((await request('/api/projects','POST',payload)).status,503);assert.equal(objects.size,0);
 writesFail=false;const created=await(await request('/api/projects','POST',payload)).json();assert.equal(objects.size,1);assert.equal(projects.length,1);
 assert.equal((await request('/api/projects/'+created.id,'PUT',{title:'Edited',category:'Web',retained:projects[0].images,uploads:[]})).status,200);assert.equal(projects[0].title,'Edited');
 assert.equal((await request('/api/projects/'+created.id,'DELETE',{})).status,200);assert.equal(objects.size,0);assert.equal(projects.length,0);
 assert.equal((await request('/api/password','PUT',{password:'changed-test-password'})).status,200);assert.equal(store.size,0);
 assert.equal((await(await request('/api/session')).json()).authenticated,false);
});
test('local mode delegates unchanged to the Node API',async()=>{const window={BBDESIGN_CONFIG:{mode:'local'}};vm.runInNewContext(script,{window,fetch:async(url,options)=>({url,options})});assert.equal((await window.bbFetch('/api/content')).url,'/api/content');});
