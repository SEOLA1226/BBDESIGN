const $=s=>document.querySelector(s);let content,category='All';let siteSettings={sections:[{id:'info',label:'INFO',visible:true},{id:'contact',label:'CONTACT',visible:true},{id:'portfolio',label:'PORTFOLIO',visible:true}],previewCount:6,showExamples:true};
const examples=[{id:'sample1',title:'FORM / Identity',category:'Branding',sample:'form',label:'form.'},{id:'sample2',title:'Quiet Objects',category:'Editorial',sample:'quiet',label:'QUIET\nOBJECTS'},{id:'sample3',title:'Between the Lines',category:'Graphic',sample:'lines',label:'BETWEEN\nTHE LINES'},{id:'sample4',title:'Ordinary Studio',category:'Web',sample:'ordinary',label:'Ordinary\nis enough.'}];
const folderNames=['info','contact','portfolio'];
let activeFolder=null;
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
function route(){
 const requested=location.hash.slice(1),next=folderNames.includes(requested)&&siteSettings.sections.some(s=>s.id===requested&&s.visible)?requested:null;
 if(next===activeFolder)return;
 document.querySelectorAll('.folder,.folder-tab,.folder-content').forEach(el=>el.getAnimations().forEach(a=>a.cancel()));
 const moving=next||activeFolder,folder=$('#'+moving+'-folder'),button=folder.querySelector('.folder-tab');
 const before=folder.getBoundingClientRect(),tabBefore=button.getBoundingClientRect();
 activeFolder=next;
 document.body.classList.toggle('view-open',!!next);
 for(const name of folderNames){
  const selected=name===next,el=$('#'+name+'-folder'),btn=el.querySelector('.folder-tab');
  el.classList.toggle('is-open',selected);el.inert=!!next&&!selected;
  $('#'+name).hidden=!selected;btn.setAttribute('aria-expanded',selected);
  btn.querySelector('.folder-symbol').textContent=selected?'×':'+';
  btn.setAttribute('aria-label',(siteSettings.sections.find(s=>s.id===name)?.label||name.toUpperCase())+(selected?' 닫고 메인으로':' 열기'));
 }
 $('#home-preview').hidden=!!next;
 $('.header').inert=!!next;$('footer').inert=!!next;
 const after=folder.getBoundingClientRect(),tabAfter=button.getBoundingClientRect();
 if(!reduceMotion.matches){
  const timing={duration:560,easing:'cubic-bezier(.22,.8,.25,1)'};
  folder.animate([{transform:`translateY(${before.top-after.top}px)`,height:before.height+'px',zIndex:20},{transform:'translateY(0)',height:after.height+'px',zIndex:20}],timing);
  button.animate([{width:tabBefore.width+'px',marginLeft:tabBefore.left+'px'},{width:tabAfter.width+'px',marginLeft:tabAfter.left+'px'}],timing);
  if(next)$('#'+next).animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,delay:160,fill:'backwards',easing:'ease-out'});
 }
 button.focus({preventScroll:true});
}
function navigate(name){history.pushState(null,'',location.pathname+(name?'#'+name:''));route();}
document.querySelectorAll('[data-folder]').forEach(button=>button.onclick=()=>navigate(activeFolder===button.dataset.folder?null:button.dataset.folder));
$('.brand').onclick=e=>{e.preventDefault();navigate(null);};
window.addEventListener('popstate',route);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeFolder&&!$('#project-dialog').open){e.preventDefault();navigate(null);}});
function applySections(){
 const visible=siteSettings.sections.filter(s=>s.visible);
 siteSettings.sections.forEach(section=>{
  const el=$('#'+section.id+'-folder'),button=el.querySelector('.folder-tab');
  el.hidden=!section.visible;button.firstElementChild.textContent=section.label;
  button.setAttribute('aria-label',section.label+(activeFolder===section.id?' 닫고 메인으로':' 열기'));
  el.classList.remove('slot-0','slot-1','slot-2','is-last');
  if(section.visible){el.classList.add('slot-'+visible.findIndex(s=>s.id===section.id));if(section.id===visible.at(-1).id)el.classList.add('is-last');}
  $('.folders').append(el);
 });
 route();
}
function artwork(p){const d=document.createElement('div');d.className='artwork '+p.sample;const t=document.createElement('span');t.textContent=p.label;d.append(t);return d;}
function render(){const items=content.projects.length?content.projects:(siteSettings.showExamples?examples:[]);$('#sample-note').hidden=!!content.projects.length||!siteSettings.showExamples;$('#empty-work').hidden=items.length>0;const categories=['All',...new Set(items.map(p=>p.category))];if(!categories.includes(category))category='All';$('#filters').replaceChildren(...categories.map(c=>{const b=document.createElement('button');b.textContent=c;b.className=c===category?'active':'';b.setAttribute('aria-pressed',c===category);b.onclick=()=>{category=c;render();};return b;}));const shown=items.filter(p=>category==='All'||p.category===category);$('#work-count').textContent=`${String(shown.length).padStart(2,'0')} PROJECTS`;
$('#grid').replaceChildren(...shown.map(card));
$('#preview-grid').replaceChildren(...items.slice(0,siteSettings.previewCount).map(card));
$('#preview-note').hidden=!!content.projects.length||!siteSettings.showExamples;
}
function card(p,i){const card=document.createElement('button');card.className='work-card';card.setAttribute('aria-label',p.title+' 상세 보기');if(p.sample)card.append(artwork(p));else{const image=document.createElement('img');image.src=p.images[0];image.alt=p.title;image.loading=i<2?'eager':'lazy';card.append(image);}const meta=document.createElement('div');meta.className='card-meta';const title=document.createElement('h2');title.textContent=p.title;const tag=document.createElement('span');tag.textContent=p.category+' ↗';meta.append(title,tag);card.append(meta);card.onclick=()=>open(p);return card;}
function open(p){$('#detail-title').textContent=p.title;$('#detail-category').textContent=p.category;$('#detail-description').textContent=p.sample?'레이아웃 예시 작업입니다. 관리자 화면에서 나만의 작업을 등록해주세요.':p.description;$('#detail-images').replaceChildren(...(p.sample?[artwork(p)]:p.images.map((src,i)=>{const img=document.createElement('img');img.src=src;img.alt=`${p.title} — ${i+1}`;img.loading='lazy';return img;})));$('#project-dialog').showModal();document.body.classList.add('modal-open');}
$('#close-dialog').onclick=()=>$('#project-dialog').close();$('#project-dialog').addEventListener('close',()=>document.body.classList.remove('modal-open'));$('#project-dialog').addEventListener('click',e=>{if(e.target===$('#project-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
window.addEventListener('hashchange',route);route();$('#year').textContent=new Date().getFullYear();
window.bbFetch('/api/content').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{content=data;siteSettings=data.site||siteSettings;applySections();const info=data.info;$('#contact-heading').textContent=info.contactHeading??'LET’S MAKE\nSOMETHING GOOD.';$('#contact-body').textContent=info.contactBody??'함께 만들고 싶은 것이 있나요?\n프로젝트와 협업 이야기를 들려주세요.';document.title=info.name+' — Portfolio';$('.brand-name').textContent=info.name;$('.brand').setAttribute('aria-label',info.name+' 홈');$('#footer-name').textContent=info.name;$('#intro').textContent=info.intro;$('#bio').textContent=info.body;$('#notice').textContent=info.notice||'등록된 공지가 없습니다.';if(info.email){const a=document.createElement('a');a.href='mailto:'+info.email;a.textContent=info.email+' ↗';$('#contact-address').append(a);}else $('#contact-address').textContent='연락처를 준비하고 있습니다.';render();}).catch(()=>{$('#load-error').hidden=false;$('#load-error').textContent='콘텐츠를 불러오지 못했습니다. 페이지를 새로고침해주세요.';});
