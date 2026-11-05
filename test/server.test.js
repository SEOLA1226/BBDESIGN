import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('authenticated publishing, validation, persistence and access boundaries',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'bb-test-'));let child,base,cookie;
 async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_PASSWORD:'test-only-password-123'}});let text='';await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.on('data',d=>{text+=d;const m=text.match(/listening on port (\d+)/);if(m){base='http://127.0.0.1:'+m[1];clearTimeout(timeout);resolve();}});child.once('exit',()=>{clearTimeout(timeout);reject(Error('Server exited'));});});}
 async function stop(){await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
 async function req(p,method='GET',body,auth=true,extra={}){return fetch(base+p,{method,headers:{...(method!=='GET'?{'Content-Type':'application/json'}:{}),...(auth&&cookie?{Cookie:cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});}
 t.after(async()=>{if(child.exitCode===null)await stop();rmSync(dir,{recursive:true,force:true});});await start();
 assert.equal((await req('/')).status,200);
 assert.equal((await req('/api/info','PUT',{name:'test'},false)).status,401);
 assert.equal((await req('/api/login','POST',{password:'wrong'},false)).status,401);
 let r=await req('/api/login','POST',{password:'test-only-password-123'});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly/);
 assert.equal((await req('/api/info','PUT',{name:'test'},true,{Origin:'https://evil.example'})).status,403);
 assert.equal((await req('/api/projects','POST',{title:'Title',category:'Branding',uploads:[Buffer.from('<svg/>').toString('base64')]})).status,400);
 r=await req('/api/projects','POST',{title:'A project',category:'Branding',description:'Description',uploads:[png]});assert.equal(r.status,200);const {id}=await r.json();
 let content=await(await req('/api/content')).json();assert.equal(content.projects.length,1);const src=content.projects[0].images[0];assert.equal((await req(src)).headers.get('content-type'),'image/png');
 assert.equal((await req('/api/projects/'+id,'PUT',{title:'Updated',category:'Web',retained:[src],uploads:[]})).status,200);
 assert.equal((await req('/api/info','PUT',{name:'Studio',intro:'Hello',body:'About',notice:'Notice',email:'hello@example.com'})).status,200);
 const settings={sections:[{id:'portfolio',label:'WORK',visible:true},{id:'info',label:'ABOUT',visible:true},{id:'contact',label:'CONTACT',visible:false}],previewCount:2,showExamples:false};
 assert.equal((await req('/api/site','PUT',settings,false)).status,401);
 assert.equal((await req('/api/site','PUT',{...settings,sections:settings.sections.map(s=>({...s,visible:false}))})).status,400);
 assert.equal((await req('/api/site','PUT',settings)).status,200);
 assert.equal((await req('/api/info','PUT',{contactHeading:'Get in touch',contactBody:'Available for work',email:'new@example.com'})).status,200);
 assert.equal((await req('/api/info','PUT',{intro:'Updated introduction'})).status,200);
 content=await(await req('/api/content')).json();assert.equal(content.info.name,'Studio');assert.equal(content.info.email,'new@example.com');assert.equal(content.info.contactHeading,'Get in touch');
 await stop();await start();content=await(await req('/api/content')).json();assert.deepEqual(content.site,settings);assert.equal(content.info.contactBody,'Available for work');assert.equal(content.info.name,'Studio');assert.equal(content.projects[0].title,'Updated');assert.equal((await req('/api/session')).status,200);assert.equal((await(await req('/api/session')).json()).authenticated,false);
 r=await req('/api/login','POST',{password:'test-only-password-123'});cookie=r.headers.get('set-cookie').split(';')[0];
 assert.equal((await req('/api/projects/'+id,'DELETE',{})).status,200);assert.equal((await req(src)).status,404);assert.equal((await(await req('/api/content')).json()).projects.length,0);
 assert.equal((await req('/.data/portfolio.sqlite')).status,404);assert.equal((await req('/server.js')).status,404);
 assert.equal((await req('/api/password','PUT',{password:'changed-test-password-123'})).status,200);assert.equal((await(await req('/api/session')).json()).authenticated,false);
 await stop();await start();assert.equal((await req('/api/login','POST',{password:'test-only-password-123'})).status,401);assert.equal((await req('/api/login','POST',{password:'changed-test-password-123'})).status,200);
});
