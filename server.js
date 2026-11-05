import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=path.resolve(process.env.DATA_DIR || path.join(root,'.data'));
mkdirSync(path.join(data,'uploads'),{recursive:true,mode:0o700});
const db=new DatabaseSync(path.join(data,'portfolio.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY,title TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,images TEXT NOT NULL,created TEXT NOT NULL);');
const getSetting=k=>db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value;
const setSetting=(k,v)=>db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(k,v);
function savePassword(password){const salt=randomBytes(16).toString('hex');setSetting('password',`${salt}:${scryptSync(password,salt,64).toString('hex')}`);}
if(process.env.ADMIN_PASSWORD&&!getSetting('password')){if(process.env.ADMIN_PASSWORD.length<12)throw Error('ADMIN_PASSWORD must contain at least 12 characters');savePassword(process.env.ADMIN_PASSWORD);}
if(!getSetting('password')){const password=randomBytes(18).toString('base64url');savePassword(password);writeFileSync(path.join(data,'initial-admin-password.txt'),password+'\n',{mode:0o600});console.log('Initial administrator password saved to .data/initial-admin-password.txt (private; never served over HTTP).');}
if(!getSetting('info'))setSetting('info',JSON.stringify({name:'BBDESIGN',intro:'단순하게, 분명하게.\n오래 남는 디자인을 만듭니다.',body:'브랜드의 본질을 발견하고,\n필요한 것만 남기는 디자인을 합니다.',notice:'새로운 프로젝트 문의를 받고 있습니다.',email:''}));
const defaultSite={sections:[{id:'info',label:'INFO',visible:true},{id:'contact',label:'CONTACT',visible:true},{id:'portfolio',label:'PORTFOLIO',visible:true}],previewCount:6,showExamples:true};
const site=()=>getSetting('site')?JSON.parse(getSetting('site')):defaultSite;
const info=()=>({contactHeading:'LET’S MAKE\nSOMETHING GOOD.',contactBody:'함께 만들고 싶은 것이 있나요?\n프로젝트와 협업 이야기를 들려주세요.',...JSON.parse(getSetting('info'))});
const sessions=new Map(),attempts=new Map();
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
function session(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bb_session='))?.slice(11);const s=sessions.get(token);if(!s || s<Date.now()){sessions.delete(token);return null;}return token;}
async function body(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>24*1024*1024)throw Object.assign(Error('업로드는 총 16MB 이하로 선택해주세요.'),{status:413});chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(Error('잘못된 요청입니다.'),{status:400});}}
const field=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const projects=()=>db.prepare('SELECT * FROM projects ORDER BY created DESC').all().map(p=>({...p,images:JSON.parse(p.images)}));
function imageType(b){if(b.length>12&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';if(b[0]===255&&b[1]===216&&b[2]===255)return 'jpg';if(['GIF87a','GIF89a'].includes(b.subarray(0,6).toString()))return 'gif';if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return 'webp';return null;}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 try{
 const url=new URL(req.url,'http://localhost'),p=url.pathname;
 if(!['GET','HEAD'].includes(req.method)){
  const origin=req.headers.origin;
  if((origin&&new URL(origin).host!==req.headers.host)||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'허용되지 않은 요청입니다.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON 요청이 필요합니다.'});
 }
 if(p==='/api/content'&&req.method==='GET')return json(res,200,{info:info(),site:site(),projects:projects()});
 if(p==='/api/session'&&req.method==='GET')return json(res,200,{authenticated:!!session(req)});
 if(p==='/api/login'&&req.method==='POST'){
  const ip=req.socket.remoteAddress,now=Date.now();let a=attempts.get(ip);if(!a||a.until<now){a={count:0,until:now+15*60*1000};attempts.set(ip,a);}if(a.count>=10)return json(res,429,{error:'시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요.'});
  const b=await body(req),[salt,hash]=getSetting('password').split(':');a.count++;
  if(typeof b.password!=='string'||b.password.length>256||!timingSafeEqual(scryptSync(b.password,salt,64),Buffer.from(hash,'hex')))return json(res,401,{error:'비밀번호를 확인해주세요.'});
  attempts.delete(ip);const token=randomBytes(32).toString('hex');sessions.set(token,now+8*3600000);
  res.setHeader('Set-Cookie',`bb_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);return json(res,200,{ok:true});
 }
 if(p.startsWith('/api/')){
  const token=session(req);if(!token)return json(res,401,{error:'로그인이 필요합니다.'});
  if(p==='/api/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie','bb_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
  if(p==='/api/password'&&req.method==='PUT'){const b=await body(req);if(typeof b.password!=='string'||b.password.length<12||b.password.length>256)return json(res,400,{error:'비밀번호는 12~256자로 입력해주세요.'});savePassword(b.password);const initial=path.join(data,'initial-admin-password.txt');if(existsSync(initial))unlinkSync(initial);sessions.clear();return json(res,200,{ok:true});}
  if(p==='/api/site'&&req.method==='PUT'){
   const b=await body(req),ids=['info','contact','portfolio'];
   if(!Array.isArray(b.sections)||b.sections.length!==3||new Set(b.sections.map(s=>s?.id)).size!==3||b.sections.some(s=>!ids.includes(s?.id)||typeof s.label!=='string'||!s.label.trim()||s.label.trim().length>16||typeof s.visible!=='boolean')||!b.sections.some(s=>s.visible)||!Number.isInteger(b.previewCount)||b.previewCount<1||b.previewCount>12||typeof b.showExamples!=='boolean')return json(res,400,{error:'섹션 이름(최대 16자), 표시 여부, 미리보기 개수(1~12)를 확인해주세요. 최소 한 섹션은 공개해야 합니다.'});
   setSetting('site',JSON.stringify({sections:b.sections.map(s=>({id:s.id,label:s.label.trim(),visible:s.visible})),previewCount:b.previewCount,showExamples:b.showExamples}));return json(res,200,{ok:true});
  }
  if(p==='/api/info'&&req.method==='PUT'){
   const b=await body(req),updated=info();
   for(const [key,max]of Object.entries({name:60,intro:300,body:3000,notice:500,email:150,contactHeading:150,contactBody:2000}))if(Object.hasOwn(b,key))updated[key]=field(b[key],max);
   if(!updated.name)return json(res,400,{error:'이름을 입력해주세요.'});
   if(updated.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updated.email))return json(res,400,{error:'이메일 주소를 확인해주세요.'});
   setSetting('info',JSON.stringify(updated));return json(res,200,{ok:true});
  }
  if((p==='/api/projects'&&req.method==='POST')||(p.startsWith('/api/projects/')&&req.method==='PUT')){
   const b=await body(req),id=req.method==='POST'?randomUUID():p.split('/').pop();const old=db.prepare('SELECT * FROM projects WHERE id=?').get(id);if(req.method==='PUT'&&!old)return json(res,404,{error:'작업을 찾을 수 없습니다.'});
   const title=field(b.title,120),category=field(b.category,60),description=field(b.description,5000);
   if(!title||!category)return json(res,400,{error:'제목과 카테고리를 입력해주세요.'});
   const retained=Array.isArray(b.retained)?b.retained:[];const oldImages=old?JSON.parse(old.images):[];
   if(retained.some(x=>!oldImages.includes(x)))return json(res,400,{error:'잘못된 이미지입니다.'});
   const uploads=Array.isArray(b.uploads)?b.uploads:[];if(retained.length+uploads.length<1||retained.length+uploads.length>10)return json(res,400,{error:'이미지는 1~10장을 선택해주세요.'});
   let total=0;const decoded=uploads.map(x=>{const buf=Buffer.from(typeof x==='string'?x:'','base64');total+=buf.length;const ext=imageType(buf);if(!ext||buf.length>8*1024*1024||total>16*1024*1024)throw Object.assign(Error('JPG, PNG, GIF, WEBP만 가능하며, 장당 8MB·총 16MB까지 업로드할 수 있습니다.'),{status:400});return {buf,ext};});
   const images=[...retained,...decoded.map(({buf,ext})=>{const name=`${randomUUID()}.${ext}`;writeFileSync(path.join(data,'uploads',name),buf);return '/uploads/'+name;})];
   db.prepare('INSERT OR REPLACE INTO projects VALUES (?,?,?,?,?,?)').run(id,title,category,description,JSON.stringify(images),old?.created||new Date().toISOString());for(const removed of oldImages.filter(x=>!images.includes(x))){try{unlinkSync(path.join(data,removed));}catch{}}return json(res,200,{ok:true,id});
  }
  if(p.startsWith('/api/projects/')&&req.method==='DELETE'){const id=p.split('/').pop(),old=db.prepare('SELECT images FROM projects WHERE id=?').get(id);db.prepare('DELETE FROM projects WHERE id=?').run(id);for(const src of old?JSON.parse(old.images):[]){try{unlinkSync(path.join(data,src));}catch{}}return json(res,200,{ok:true});}
  return json(res,404,{error:'찾을 수 없는 요청입니다.'});
 }
 if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'허용되지 않는 요청입니다.'});
 let file;if(p.startsWith('/uploads/')&&/^\/uploads\/[a-f0-9-]+\.(png|jpg|gif|webp)$/.test(p))file=path.join(data,p);else {const names={'/':'index.html','/admin':'admin.html','/admin/':'admin.html','/style.css':'style.css','/portfolio.css':'portfolio.css','/app.js':'app.js','/config.js':'config.js','/backend.js':'backend.js','/admin.js':'admin.js','/admin.css':'admin.css','/fonts/Anton-Regular.ttf':'fonts/Anton-Regular.ttf','/title-font.css':'title-font.css','/fonts/DottedSongtiDiamondRegular.otf':'fonts/DottedSongtiDiamondRegular.otf'};if(names[p])file=path.join(root,'public',names[p]);}
 if(!file||!existsSync(file))return json(res,404,{error:'페이지를 찾을 수 없습니다.'});
 const types={'.otf':'font/otf','.ttf':'font/ttf','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'};
 res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':p.startsWith('/uploads/')?'public, max-age=86400':'no-cache'});res.end(req.method==='HEAD'?undefined:readFileSync(file));
 }catch(e){if(e.status)return json(res,e.status,{error:e.message});console.error(e);json(res,500,{error:'처리하지 못했습니다. 다시 시도해주세요.'});}
});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log(`BBDESIGN listening on port ${server.address().port}`));
