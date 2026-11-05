/* Shared API interface: local Node server or Supabase-backed static hosting. */
(() => {
 const cfg=window.BBDESIGN_CONFIG||{mode:'local'};
 if(cfg.mode!=='supabase'){window.bbFetch=(url,options)=>fetch(url,options);return;}
 const base=cfg.url.replace(/\/$/,''),bucket='portfolio-images',sessionKey='bb-admin:'+base;
 let session=null,refreshing=null;
 try{session=JSON.parse(sessionStorage.getItem(sessionKey)||'null');}catch{}
 const store=value=>{session=value;if(value)sessionStorage.setItem(sessionKey,JSON.stringify(value));else sessionStorage.removeItem(sessionKey);};
 const response=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 const fail=(message,status=400)=>Object.assign(new Error(message),{status});
 async function remote(path,{method='GET',data,token,raw,headers={}}={}){
  const r=await fetch(base+path,{method,headers:{apikey:cfg.key,...(token?{Authorization:'Bearer '+token}:{}),...(!raw&&data!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw|| (data===undefined?undefined:JSON.stringify(data))});
  let result=null;const text=await r.text();try{result=text?JSON.parse(text):null;}catch{}
  if(!r.ok){const message=r.status===401?'로그인이 만료되었거나 로그인 정보가 올바르지 않습니다.':r.status===403?'관리자 권한이 없습니다.':result?.msg||result?.message||result?.error_description||'저장 서비스 요청에 실패했습니다.';throw fail(message,r.status);}
  return result;
 }
 async function token(){
  if(!session)throw fail('로그인이 필요합니다.',401);
  if(session.expires_at>Date.now()/1000+60)return session.access_token;
  if(!refreshing)refreshing=remote('/auth/v1/token?grant_type=refresh_token',{method:'POST',data:{refresh_token:session.refresh_token}}).then(s=>{store({...s,expires_at:Math.floor(Date.now()/1000)+s.expires_in});return s.access_token;}).catch(e=>{store(null);throw e;}).finally(()=>refreshing=null);
  return refreshing;
 }
 async function isAdmin(access){const rows=await remote('/rest/v1/bb_admins?select=user_id',{token:access});return Array.isArray(rows)&&rows.some(r=>r.user_id===session?.user?.id);}
 const getSetting=async id=>(await remote('/rest/v1/bb_settings?id=eq.'+id+'&select=value'))?.[0]?.value;
 const imagePrefix=base+'/storage/v1/object/public/'+bucket+'/';
 function objectName(url){if(typeof url!=='string'||!url.startsWith(imagePrefix))throw fail('잘못된 이미지 경로입니다.');const name=url.slice(imagePrefix.length);if(!/^[a-f0-9-]+\.(png|jpg|gif|webp)$/.test(name))throw fail('잘못된 이미지 경로입니다.');return name;}
 async function removeImages(urls,access){if(urls.length)await remote('/storage/v1/object/'+bucket,{method:'DELETE',token:access,data:{prefixes:urls.map(objectName)}});}
 function decodeImage(value){if(typeof value!=='string')throw fail('이미지를 확인해주세요.');let bytes;try{bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch{throw fail('이미지를 읽을 수 없습니다.');}const str=(a,b)=>String.fromCharCode(...bytes.slice(a,b));let ext;
  if(bytes.length>12&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))ext='png';else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';else if(['GIF87a','GIF89a'].includes(str(0,6)))ext='gif';else if(str(0,4)==='RIFF'&&str(8,12)==='WEBP')ext='webp';
  if(!ext||bytes.length>8*1024*1024)throw fail('JPG, PNG, GIF, WEBP 이미지를 장당 8MB 이하로 선택해주세요.');return {bytes,ext,type:{png:'image/png',jpg:'image/jpeg',gif:'image/gif',webp:'image/webp'}[ext]};
 }
 window.bbFetch=async(path,options={})=>{
  try{
   const method=options.method||'GET',data=options.body?JSON.parse(options.body):{};
   if(path==='/api/content'&&method==='GET'){
    const [settings,projects]=await Promise.all([remote('/rest/v1/bb_settings?select=id,value'),remote('/rest/v1/bb_projects?select=*&order=created.desc')]);
    const entries=Object.fromEntries(settings.map(s=>[s.id,s.value]));if(!entries.info||!entries.site)throw fail('Supabase SQL 초기 설정이 필요합니다.',503);
    return response(200,{info:entries.info,site:entries.site,projects});
   }
   if(path==='/api/session'){if(!session)return response(200,{authenticated:false});try{return response(200,{authenticated:await isAdmin(await token())});}catch(e){if(e.status===401||e.status===403){store(null);return response(200,{authenticated:false});}throw e;}}
   if(path==='/api/login'&&method==='POST'){
    if(!data.email||!data.password)throw fail('관리자 이메일과 비밀번호를 입력해주세요.');
    const s=await remote('/auth/v1/token?grant_type=password',{method:'POST',data:{email:data.email,password:data.password}});store({...s,expires_at:Math.floor(Date.now()/1000)+s.expires_in});
    if(!await isAdmin(s.access_token)){store(null);throw fail('이 계정은 사이트 관리자로 등록되어 있지 않습니다.',403);}return response(200,{ok:true});
   }
   const access=await token();
   if(path==='/api/logout'&&method==='POST'){try{await remote('/auth/v1/logout?scope=local',{method:'POST',token:access});}finally{store(null);}return response(200,{ok:true});}
   if(path==='/api/password'&&method==='PUT'){if(typeof data.password!=='string'||data.password.length<12||data.password.length>256)throw fail('비밀번호는 12~256자로 입력해주세요.');await remote('/auth/v1/user',{method:'PUT',token:access,data:{password:data.password}});await remote('/auth/v1/logout',{method:'POST',token:access});store(null);return response(200,{ok:true});}
   if(path==='/api/info'&&method==='PUT'){
    const limits={name:60,intro:300,body:3000,notice:500,email:150,contactHeading:150,contactBody:2000},patch={};for(const [key,max]of Object.entries(limits))if(Object.hasOwn(data,key))patch[key]=String(data[key]??'').trim().slice(0,max);
    if(patch.name==='')throw fail('사이트 이름을 입력해주세요.');if(patch.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email))throw fail('이메일 주소를 확인해주세요.');
    await remote('/rest/v1/rpc/bb_patch_info',{method:'POST',token:access,data:{p_patch:patch}});return response(200,{ok:true});
   }
   if(path==='/api/site'&&method==='PUT'){
    const ids=['info','contact','portfolio'];if(!Array.isArray(data.sections)||data.sections.length!==3||new Set(data.sections.map(s=>s?.id)).size!==3||data.sections.some(s=>!ids.includes(s?.id)||typeof s.label!=='string'||!s.label.trim()||s.label.trim().length>16||typeof s.visible!=='boolean')||!data.sections.some(s=>s.visible)||!Number.isInteger(data.previewCount)||data.previewCount<1||data.previewCount>12||typeof data.showExamples!=='boolean')throw fail('섹션 설정을 확인해주세요. 최소 하나의 섹션은 공개해야 합니다.');
    await remote('/rest/v1/bb_settings?id=eq.site',{method:'PATCH',token:access,data:{value:{sections:data.sections.map(s=>({id:s.id,label:s.label.trim(),visible:s.visible})),previewCount:data.previewCount,showExamples:data.showExamples}}});return response(200,{ok:true});
   }
   const match=path.match(/^\/api\/projects(?:\/([a-f0-9-]{36}))?$/);
   if(match&&['POST','PUT','DELETE'].includes(method)){
    const id=match[1]||crypto.randomUUID();let old=null;
    if(method!=='POST'){old=(await remote('/rest/v1/bb_projects?id=eq.'+id+'&select=*',{token:access}))?.[0];if(!old)throw fail('작업을 찾을 수 없습니다.',404);}
    if(method==='DELETE'){await remote('/rest/v1/bb_projects?id=eq.'+id,{method:'DELETE',token:access});try{await removeImages(old.images,access);}catch{ return response(200,{ok:true,warning:'작업은 삭제됐지만 일부 이미지 정리에 실패했습니다. Storage에서 확인해주세요.'});}return response(200,{ok:true});}
    const title=String(data.title||'').trim().slice(0,120),category=String(data.category||'').trim().slice(0,60),description=String(data.description||'').trim().slice(0,5000);
    if(!title||!category)throw fail('제목과 카테고리를 입력해주세요.');const retained=Array.isArray(data.retained)?data.retained:[],uploads=Array.isArray(data.uploads)?data.uploads:[];
    if(retained.some(x=>!old?.images.includes(x))||retained.length+uploads.length<1||retained.length+uploads.length>10)throw fail('이미지는 기존 이미지 또는 새 파일로 1~10장 선택해주세요.');
    const decoded=uploads.map(decodeImage);if(decoded.reduce((a,x)=>a+x.bytes.length,0)>16*1024*1024)throw fail('업로드 총 용량은 16MB 이하로 선택해주세요.');
    const added=[];try{
     for(const image of decoded){const name=crypto.randomUUID()+'.'+image.ext;await remote('/storage/v1/object/'+bucket+'/'+name,{method:'POST',token:access,raw:image.bytes,headers:{'Content-Type':image.type,'x-upsert':'false'}});added.push(imagePrefix+name);}
     const project={id,title,category,description,images:[...retained,...added],created:old?.created||new Date().toISOString()};
     await remote('/rest/v1/bb_projects'+(method==='PUT'?'?id=eq.'+id:''),{method:method==='PUT'?'PATCH':'POST',token:access,data:project});
    }catch(e){try{await removeImages(added,access);}catch{}throw e;}
    try{await removeImages((old?.images||[]).filter(x=>!retained.includes(x)),access);}catch{return response(200,{ok:true,id,warning:'저장했습니다. 이전 이미지 일부는 Storage에서 정리해주세요.'});}
    return response(200,{ok:true,id});
   }
   throw fail('찾을 수 없는 요청입니다.',404);
  }catch(e){return response(e.status||500,{error:e.status?e.message:'저장 서비스에 연결하지 못했습니다. 설정과 네트워크를 확인해주세요.'});}
 };
})();
