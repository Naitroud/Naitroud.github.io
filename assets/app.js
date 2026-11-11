/* territory-engine.js */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TerritoryEngine=api;})(globalThis,function(){'use strict';const width=320,height=256,step=8;
function validate(t,groups){if(!t||t.version!==1||t.width!==width||t.height!==height||!Array.isArray(t.keys)||new Set(t.keys).size!==t.keys.length||t.keys.some(k=>!groups.some(g=>g.key===k))||!Array.isArray(t.cells)||t.cells.length!==width*height||t.cells.some(v=>!Number.isInteger(v)||v<0||v>t.keys.length)||!Number.isFinite(t.radius)||t.radius<40||t.radius>600)throw Error('Неверный слой территорий.');return JSON.parse(JSON.stringify(t));}
function generate(systems,groups,radius=260){const keys=groups.map(g=>g.key),cells=new Array(width*height).fill(0),points=systems.filter(s=>keys.includes(s.group)).map(s=>({x:s.x+5.5,y:s.y+5.5,v:keys.indexOf(s.group)+1}));for(let y=0;y<height;y++)for(let x=0;x<width;x++){let best=radius*radius,value=0;for(const p of points){const d=(x*step+4-p.x)**2+(y*step+4-p.y)**2;if(d<best){best=d;value=p.v;}}cells[y*width+x]=value;}return {version:1,width,height,keys,cells,radius};}
function paint(t,x,y,r,value){const a=Math.max(0,Math.floor((x-r)/step)),b=Math.min(width-1,Math.ceil((x+r)/step)),c=Math.max(0,Math.floor((y-r)/step)),d=Math.min(height-1,Math.ceil((y+r)/step));for(let j=c;j<=d;j++)for(let i=a;i<=b;i++)if((i*step+4-x)**2+(j*step+4-y)**2<=r*r)t.cells[j*width+i]=value;}
return {generate,validate,paint,width,height,step};});
;
/* app.js */
'use strict';
(() => {
 const data=JSON.parse(document.getElementById('galaxy-data').textContent);
 data.fleets=data.fleets.map(({type:legacyType,...f})=>f);data.events=data.events||[];const front=data.systems.find(s=>s.id===4);if(front){data.events.push({...front,color:'#ffb66a'});data.systems=data.systems.filter(s=>s.id!==4);}
 const $=id=>document.getElementById(id);
 const groups=new Map(data.groups.map(g=>[g.key,g]));
 let items=[...data.systems.map(s=>({...s,isFleet:false})),...data.events.map(e=>({...e,isEvent:true,isFleet:false,group:'События',factionGroup:e.group})),...data.fleets.map(f=>({...f,isFleet:true,group:'Флоты'}))];
 let byId=new Map(items.map(i=>[String(i.id),i]));
 const markerNodes=new Map();
 let selected=null,filter='all',faction=new Set(),scale=1,tx=0,ty=0,drag=null,toastTimer;
 let favorites=new Set();
 try{favorites=new Set(JSON.parse(localStorage.getItem('ugalaxy-favorites-v1')||'[]'));}catch{}
 const viewport=$('viewport'),world=$('world');
 viewport.addEventListener('dragstart',e=>e.preventDefault());
 viewport.addEventListener('selectstart',e=>e.preventDefault());
 for(const image of viewport.querySelectorAll('img')){image.draggable=false;image.addEventListener('dragstart',e=>e.preventDefault());}
 const mobileMode=matchMedia('(max-width:700px), (max-width:950px) and (max-height:500px)');
 const isMobile=()=>mobileMode.matches;
 function dockState(){const nav=$('nav-toggle').getAttribute('aria-expanded')==='true',layers=!$('layers').hidden,dossier=!$('inspector').hidden;$('mobile-nav').setAttribute('aria-expanded',String(nav));$('mobile-layers').setAttribute('aria-expanded',String(layers));$('mobile-dossier').disabled=!selected;[['mobile-nav',nav],['mobile-layers',layers],['mobile-dossier',dossier]].forEach(([id,on])=>$(id).classList.toggle('active',on));}
 function revealPanel(el){if(!el.hidden&&el.dataset.closing!=='true')return;el.dataset.closing='false';el.inert=false;el.hidden=false;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;el.getAnimations().forEach(a=>{a.onfinish=null;a.cancel();});const mobile=isMobile(),from=mobile?'translateY(36px)':'translateX(40px)';el.animate([{transform:from,opacity:0},{transform:'translate(0,0)',opacity:1}],{duration:250,easing:'ease',fill:'none'});}
 function dismissPanel(el){if(el.hidden)return;el.dataset.closing='true';el.inert=true;el.getAnimations().forEach(a=>{a.onfinish=null;a.cancel();});if(matchMedia('(prefers-reduced-motion: reduce)').matches){el.hidden=true;return;}const to=isMobile()?'translateY(36px)':'translateX(40px)';const anim=el.animate([{transform:'translate(0,0)',opacity:1},{transform:to,opacity:0}],{duration:250,easing:'ease'});anim.onfinish=()=>{el.hidden=true;el.inert=false;};}
 function hideDossier(){ dismissPanel($('inspector'));document.body.classList.remove('inspecting');dockState();}
 function showDossier(){if(!selected)return;if(isMobile())setNav(false);setLayers(false);revealPanel($('inspector'));document.body.classList.add('inspecting');dockState();}
 function setLayers(open){if(open){if(isMobile())setNav(false);hideDossier();}if(!open)dismissPanel($('layers'));$('layers-toggle').setAttribute('aria-expanded',String(open));if(open){revealPanel($('layers'));$('layers-content').hidden=false;$('layers-collapse').setAttribute('aria-expanded','true');$('layers-collapse').textContent='−';}dockState();}
 $('layers-close').onclick=()=>setLayers(false);$('layers-toggle').onclick=()=>setLayers($('layers').hidden||$('layers').dataset.closing==='true');$('mobile-layers').onclick=()=>setLayers($('layers').hidden||$('layers').dataset.closing==='true');
 $('layers-collapse').onclick=()=>{const open=$('layers-content').hidden;$('layers-content').hidden=!open;$('layers-collapse').textContent=open?'−':'+';$('layers-collapse').setAttribute('aria-expanded',String(open));};
 $('inspector-collapse').onclick=()=>{const folded=$('inspector').classList.toggle('folded');$('inspector-collapse').textContent=folded?'+':'−';$('inspector-collapse').setAttribute('aria-expanded',String(!folded));};
 $('mobile-nav').onclick=()=>setNav($('nav-toggle').getAttribute('aria-expanded')!=='true');$('mobile-dossier').onclick=()=>{($('inspector').hidden||$('inspector').dataset.closing==='true')?showDossier():hideDossier();};
 $('mobile-home').onclick=()=>{setNav(false);setLayers(false);hideDossier();galaxyHome();};$('mobile-universe').onclick=()=>{setNav(false);setLayers(false);hideDossier();fit();};
 const universe={x:-1800,y:-1250,width:6160,height:4548};
 const galaxy={x:-170,y:-245,width:2900,height:2475};
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let cameraFrame=0,cameraMode='galaxy';
 const jumpCanvas=$('jump-effect'),jumpContext=jumpCanvas.getContext('2d');
 const streaks=Array.from({length:58},(_,i)=>({angle:i*2.399963,depth:.2+((i*37)%100)/100}));
 function clearJump(){jumpContext.clearRect(0,0,jumpCanvas.width,jumpCanvas.height);}
 function cancelFlight(){cancelAnimationFrame(cameraFrame);cameraFrame=0;viewport.dataset.camera='idle';viewport.classList.remove('camera-flying');clearJump();}
 function paintJump(progress,strength){const w=viewport.clientWidth,h=viewport.clientHeight;if(jumpCanvas.width!==w||jumpCanvas.height!==h){jumpCanvas.width=w;jumpCanvas.height=h;}clearJump();const pulse=Math.pow(Math.sin(Math.PI*progress),2)*strength;if(pulse<.01)return;const cx=w*.5,cy=h*.42;streaks.forEach(s=>{const radius=Math.max(w,h)*(.13+s.depth*.6),length=(14+s.depth*65)*pulse,x=cx+Math.cos(s.angle)*radius,y=cy+Math.sin(s.angle)*radius;jumpContext.beginPath();jumpContext.moveTo(x,y);jumpContext.lineTo(x+Math.cos(s.angle)*length,y+Math.sin(s.angle)*length);jumpContext.strokeStyle=`rgba(151,216,234,${pulse*(.06+s.depth*.13)})`;jumpContext.lineWidth=.6+s.depth*.7;jumpContext.stroke();});}
 function flyTo(target,{animate=true,jump=false}={}){cancelFlight();const start={tx,ty,scale},distance=Math.hypot(target.tx-tx,target.ty-ty),deltaScale=Math.abs(Math.log(target.scale/scale));if(!animate||reducedMotion.matches||distance<.5&&deltaScale<.002){({tx,ty,scale}=target);applyTransform();return;}const duration=Math.min(1450,Math.max(850,800+distance*.18+deltaScale*120));let begin=null;viewport.dataset.camera='flying';viewport.classList.add('camera-flying');const strength=jump?Math.min(1,distance/600+deltaScale*.25):0;function step(now){if(begin===null)begin=now;const p=Math.min(1,(now-begin)/duration),ease=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;tx=start.tx+(target.tx-start.tx)*ease;ty=start.ty+(target.ty-start.ty)*ease;scale=Math.exp(Math.log(start.scale)+(Math.log(target.scale)-Math.log(start.scale))*ease);applyTransform();paintJump(p,strength);if(p<1)cameraFrame=requestAnimationFrame(step);else{cameraFrame=0;viewport.dataset.camera='idle';viewport.classList.remove('camera-flying');clearJump();}}cameraFrame=requestAnimationFrame(step);}
 function overview(bounds,animate=true){const left=!isMobile()&&$('nav-toggle').getAttribute('aria-expanded')==='true'?355:18,right=!isMobile()&&!$('layers').hidden?275:18,w=viewport.clientWidth-left-right,h=viewport.clientHeight;const next=Math.min(w/bounds.width,(h-120)/bounds.height)*.92;flyTo({scale:next,tx:left+(w-bounds.width*next)/2-bounds.x*next,ty:(h-bounds.height*next)/2-bounds.y*next},{animate});}
 const ship='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 8 6 9-9-4-9 4 6-9 3-8Z"/><path d="M12 6v9M6 16h12"/></svg>';
 const crown='<svg viewBox="0 0 20 20" aria-label="Столица"><path d="m3 6 3 4 4-6 4 6 3-4-2 9H5L3 6Zm2 11h10"/></svg>';
 const systemOf=i=>i.isFleet?[...data.systems,...data.events].find(s=>String(s.id)===String(i.system)):i;
 const groupOf=i=>{if(i.isFleet&&Object.prototype.hasOwnProperty.call(i,'faction'))return groups.get(i.faction)||{label:'Без принадлежности',color:i.color||'#a8dce7'};const s=systemOf(i);return groups.get(s.factionGroup||s.group)||{label:'Без принадлежности',color:s.color||'#ffb66a'};};
 const colorOf=i=>i.isFleet?groupOf(i).color:i.color||systemOf(i).color||groupOf(i).color;
 const eventIcon='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><text x="16" y="24" text-anchor="middle" fill="currentColor" stroke="none" font-size="24" font-weight="700" font-family="Arial">!</text></svg>';
 const text=(el,value)=>{el.textContent=value;return el;};
 const node=(tag,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;return el;};
 $('era').replaceChildren();const eraMain=node('span','era-main'),eraSub=node('span','era-sub');eraMain.textContent='638 тонг (2370 год)';eraSub.textContent='от Основания Галактической Ассамблеи';$('era').append(eraMain,eraSub);$('era').title=data.era;
 $('system-count').textContent=data.systems.length+' систем';
 function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);}
 function sorted(list){const order=new Map(data.groups.map((g,i)=>[g.key,i]));order.set('Флоты',data.groups.length);order.set('События',data.groups.length+1);return [...list].sort((a,b)=>{
  const group=(order.get(a.group)??99)-(order.get(b.group)??99);if(group)return group;
  const rank=i=>i.order?.startsWith('last')?2:i.order!=null?0:1;
  const diff=rank(a)-rank(b);if(diff)return diff;
  if(rank(a)===0){const n=Number(a.order)-Number(b.order);if(n)return n;}
  if(rank(a)===2){const n=Number(a.order?.split(':')[1]||Infinity)-Number(b.order?.split(':')[1]||Infinity);if(n)return n;}
  return a.name.localeCompare(b.name,'ru');
 });}
 function matches(item){const q=$('search').value.trim().toLocaleLowerCase('ru');return (!q||item.name.toLocaleLowerCase('ru').includes(q))&&(filter!=='favorites'||favorites.has(String(item.id)))&&(filter!=='fleets'||item.isFleet)&&(filter!=='events'||item.isEvent);}
 function renderList(){
  if(window.GalaxyNavV46){window.GalaxyNavV46.render({data:window.galaxyApp?.getData()||data,filter,favorites,selected,select:id=>{const item=byId.get(String(id));if(item)select(item);}});return;}
  const open=new Set([...$('object-list').querySelectorAll('details[open]')].map(d=>d.dataset.group));
  const first=!$('object-list').children.length;
  const visible=sorted(items.filter(matches));$('object-list').replaceChildren();
  $('result-count').textContent=`Объекты: ${visible.length} / ${items.length}`;
  $('favorite-count').textContent=favorites.size;
  if(!visible.length){$('object-list').append(text(node('div','empty-state'),filter==='favorites'?'В избранном пока нет объектов. Отметьте систему звездой в её карточке.':'Объекты не найдены. Попробуйте другое название.'));return;}
  let section=null,last=null;
  visible.forEach(item=>{
   if(item.group!==last){last=item.group;section=node('details','group');section.dataset.group=last;section.style.setProperty('--group-color',item.isFleet?'#a8dce7':groupOf(item).color);section.open=first||!!$('search').value||filter!=='all'||open.has(last);
    const summary=node('summary');summary.append(node('span','group-dot'),text(node('span'),groups.get(last)?.label||last),text(node('span','group-total'),visible.filter(i=>i.group===last).length));if(groups.get(last)?.overlord){const parent=groups.get(groups.get(last).overlord);if(parent)summary.append(text(node('small','group-overlord'),'Вассал · '+parent.label));}section.append(summary);$('object-list').append(section);}
   const row=node('button','object-row');row.dataset.id=item.id;row.classList.toggle('active',String(selected?.id)===String(item.id));row.style.setProperty('--group-color',groupOf(item).color);
   row.append(node('span','row-dot'),text(node('span','row-name'),item.name.trim()));
   if(favorites.has(String(item.id)))row.append(text(node('span','row-star'),'★'));
   else if(item.order==='0'){const el=node('span','capital');el.innerHTML=crown;el.title='Столица';row.append(el);}
   row.addEventListener('click',()=>select(item));section.append(row);
  });
 }
 function setFilter(value){filter=value;['all','favorite','fleet','event'].forEach((key,i)=>$(key+'-filter').classList.toggle('selected',['all','favorites','fleets','events'][i]===filter));renderList();}
 $('all-filter').onclick=()=>setFilter('all');$('favorite-filter').onclick=()=>setFilter('favorites');$('fleet-filter').onclick=()=>setFilter('fleets');$('event-filter').onclick=()=>setFilter('events');$('search').addEventListener('input',renderList);
 $('collapse-groups').onclick=()=>{const details=[...$('object-list').querySelectorAll('details')],close=details.some(d=>d.open);details.forEach(d=>d.open=!close);$('collapse-groups').textContent=close?'Раскрыть':'Свернуть';};
 function setNav(open){if(open&&isMobile()){setLayers(false);hideDossier();}$('navigation').classList.toggle('closed',!open);$('navigation').inert=!open;$('nav-toggle').setAttribute('aria-expanded',String(open));document.body.classList.toggle('nav-closed',!open);dockState();}
 $('nav-toggle').onclick=()=>setNav($('nav-toggle').getAttribute('aria-expanded')!=='true');
 function applyTransform(){world.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;world.style.setProperty('--inverse-scale',Math.max(.55,1/scale));const fleetSpread=Math.max(0,Math.min(1,(scale-.25)/.55));world.style.setProperty('--fleet-spread',fleetSpread);world.style.setProperty('--overview-label-scale',Math.min(3,1/scale));world.classList.toggle('universe-overview',scale<.19);$('zoom-status').textContent=`${Math.round(scale*100)}%`;}
 function constrain(){const w=viewport.clientWidth,h=viewport.clientHeight;tx=Math.min(w-90-universe.x*scale,Math.max(90-(universe.x+universe.width)*scale,tx));ty=Math.min(h-90-universe.y*scale,Math.max(90-(universe.y+universe.height)*scale,ty));}
 function fit(animate=true){cameraMode='universe';overview(universe,animate);}
 function galaxyHome(animate=true){cameraMode='galaxy';overview(galaxy,animate);}
 function zoom(factor,x=viewport.clientWidth/2,y=viewport.clientHeight/2){cancelFlight();cameraMode='manual';const next=Math.min(3.5,Math.max(.035,scale*factor));tx=x-(x-tx)*next/scale;ty=y-(y-ty)*next/scale;scale=next;constrain();applyTransform();}
 function center(item,animate=true){cameraMode='system';const s=systemOf(item),next=Math.max(scale,.9),mobile=isMobile();const landscape=mobile&&innerWidth>innerHeight,left=$('nav-toggle').getAttribute('aria-expanded')==='true'&&!mobile?340:0,right=landscape&&!$('inspector').hidden?Math.min(340,innerWidth*.42):mobile?0:360,x=left+(viewport.clientWidth-left-right)/2,y=mobile&&!landscape?viewport.clientHeight*.25:viewport.clientHeight*.48;flyTo({scale:next,tx:x-(s.x+5.5)*next,ty:y-(s.y+5.5)*next},{animate,jump:true});}
 $('fit').onclick=()=>fit();$('galaxy-home').onclick=()=>galaxyHome();$('zoom-in').onclick=()=>zoom(1.25);$('zoom-out').onclick=()=>zoom(.8);
 viewport.addEventListener('wheel',e=>{e.preventDefault();const rect=viewport.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-rect.left,e.clientY-rect.top);$('peek').hidden=true;},{passive:false});
 const pointers=new Map();let pinch=null;
 viewport.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;cancelFlight();cameraMode='manual';pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,tx,ty,moved:false};viewport.classList.add('dragging');if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y)};}$('peek').hidden=true;});
 viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),r=viewport.getBoundingClientRect();zoom(distance/pinch.distance,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinch.distance=distance;if(drag)drag.moved=true;return;}if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;tx=drag.tx+dx;ty=drag.ty+dy;constrain();applyTransform();});
 function endPointer(e){pointers.delete(e.pointerId);pinch=null;drag=null;viewport.classList.remove('dragging');if(pointers.size===1){const a=[...pointers.values()][0];drag={x:a.x,y:a.y,tx,ty,moved:true};}}
 viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);
 function peek(item,el){const r=el.getBoundingClientRect(),v=viewport.getBoundingClientRect();$('peek').replaceChildren(text(node('small'),groupOf(item).label),text(node('span'),item.name.trim()));if(!item.isFleet&&!item.isEvent&&item.shortDescription)$('peek').append(text(node('p','peek-description'),item.shortDescription));$('peek').hidden=false;$('peek').style.left=Math.max(12,Math.min(viewport.clientWidth-275,r.left-v.left+28))+'px';$('peek').style.top=Math.max(12,Math.min(viewport.clientHeight-$('peek').offsetHeight-12,r.top-v.top-20))+'px';}
 function renderMarkers(){markerNodes.clear();$('markers').replaceChildren();
 data.systems.forEach(s=>{const b=node('button','system-marker');b.classList.toggle('capital-marker',s.order==='0');b.style.left=(s.x+5.5)+'px';b.style.top=(s.y+5.5)+'px';b.style.setProperty('--marker-color',groups.get(s.group).color);b.setAttribute('aria-label',s.name.trim());b.dataset.id=s.id;b.append(text(node('span','system-label'),s.name.trim()));b.onclick=e=>{e.stopPropagation();select(byId.get(String(s.id)));};b.onpointerenter=()=>peek(s,b);b.onpointerleave=()=>{$('peek').hidden=true;};b.onfocus=()=>{};b.onblur=()=>{$('peek').hidden=true;};$('markers').append(b);markerNodes.set(String(s.id),b);});
 data.events.forEach(e=>{const b=node('button','event-marker');b.style.left=(e.x+5.5)+'px';b.style.top=(e.y+5.5)+'px';b.style.setProperty('--event-color',e.color);b.innerHTML=e.battle?'<svg viewBox="0 0 32 32"><path d="M5 5l22 22M27 5 5 27M3 21l8 8M21 3l8 8"/></svg>':eventIcon;b.setAttribute('aria-label',e.name.trim());b.dataset.id=e.id;b.onclick=()=>select(byId.get(String(e.id)));b.onpointerenter=()=>peek(byId.get(String(e.id)),b);b.onpointerleave=()=>{$('peek').hidden=true;};$('markers').append(b);markerNodes.set(String(e.id),b);});
 data.fleets.forEach(f=>{const s=[...data.systems,...data.events].find(s=>String(s.id)===String(f.system)),b=node('button','fleet-marker');const rank=data.fleets.filter(i=>String(i.system)===String(f.system)).findIndex(i=>i.id===f.id),size=isMobile()?36:26,gap=6;b.style.left=(s.x+5.5)+'px';b.style.top=(s.y+5.5)+'px';b.style.setProperty('--fleet-rank',rank);b.style.setProperty('--fleet-size',size+'px');b.style.setProperty('--fleet-base',(s.color?32:22)+'px');b.style.zIndex=String(100-rank);b.classList.toggle('event-attached',data.events.some(e=>String(e.id)===String(f.system)));const fleetColor=colorOf({...f,isFleet:true});b.style.color=fleetColor;b.style.borderColor=fleetColor;b.style.setProperty('--marker-color',fleetColor);b.innerHTML=ship;b.dataset.id=f.id;b.classList.toggle('destroyed-fleet',f.count===0);b.setAttribute('aria-label',f.name+(f.count===0?' — Уничтоженный':''));b.onclick=e=>{e.stopPropagation();select(byId.get(f.id));};b.onpointerenter=()=>peek(byId.get(f.id),b);b.onpointerleave=()=>{$('peek').hidden=true;};$('markers').append(b);markerNodes.set(f.id,b);});
 }
 function refreshData(next){if(next.fleetScaleVersion!==undefined)data.fleetScaleVersion=next.fleetScaleVersion;const oldId=selected?.id;data.groups=JSON.parse(JSON.stringify(next.groups||data.groups));groups.clear();data.groups.forEach(g=>groups.set(g.key,g));faction=new Set([...faction].filter(key=>groups.has(key)));renderFactions();data.territories=next.territories||null;data.systems=next.systems;data.events=next.events||[];data.fleets=next.fleets.map(({type:legacyType,...f})=>f);items=[...data.systems.map(s=>({...s,isFleet:false})),...data.events.map(e=>({...e,isEvent:true,isFleet:false,group:'События',factionGroup:e.group})),...data.fleets.map(f=>({...f,isFleet:true,group:'Флоты'}))];byId=new Map(items.map(i=>[String(i.id),i]));selected=byId.get(String(oldId))||null;renderMarkers();renderList();document.dispatchEvent(new Event('galaxy-data-changed'));$('system-count').textContent=data.systems.length+' систем';if(selected)select(selected);else hideDossier();}
 function updateSelection(){markerNodes.forEach((el,id)=>{el.classList.toggle('selected',selected&&(String(selected.id)===id||(selected.isFleet&&String(selected.system)===id)));const item=byId.get(id);if(item){const key=item.isFleet?(Object.prototype.hasOwnProperty.call(item,'faction')?item.faction:systemOf(item).group):item.isEvent?item.factionGroup:item.group;el.classList.toggle('dimmed',faction.size>0&&!faction.has(key));}});$('object-list').querySelectorAll('.object-row').forEach(el=>el.classList.toggle('active',String(selected?.id)===el.dataset.id));}
 function select(item){selected=item;$('peek').hidden=true;$('inspector').classList.remove('folded');$('inspector-collapse').textContent='−';$('inspector-collapse').setAttribute('aria-expanded','true');showDossier();const s=systemOf(item),g=groupOf(item);const capital=!item.isFleet&&!item.isEvent&&item.order==='0';$('capital-badge').hidden=!capital;$('capital-badge').innerHTML=crown+'<span>СТОЛИЧНАЯ СИСТЕМА</span>';$('inspector-emblem').dataset.capital=String(capital);$('inspector-emblem').innerHTML='<svg class="system-model" viewBox="0 0 140 140"><circle class="model-core" cx="70" cy="70" r="20"/><ellipse cx="70" cy="70" rx="59" ry="22" transform="rotate(-28 70 70)"/><ellipse cx="70" cy="70" rx="49" ry="32" transform="rotate(42 70 70)"/><circle cx="25" cy="84" r="4"/><circle cx="111" cy="94" r="3"/>'+(capital?'<path class="model-crown" d="m53 54 7 7 10-13 10 13 7-7-4 23H57l-4-23Zm4 27h26"/><circle class="capital-ring" cx="70" cy="70" r="64"/>':'<path d="M56 70h28M70 56v28"/>')+'</svg>';if(item.isEvent)$('inspector-emblem').innerHTML=eventIcon;if(item.isFleet)$('inspector-emblem').innerHTML='<svg class="fleet-dossier-model" viewBox="0 0 140 140"><circle cx="70" cy="70" r="61" stroke-dasharray="3 6"/><path d="m70 25 12 31 32 43-44-18-44 18 32-43 12-31Z"/><path d="M70 38v44M44 87h52M59 59l-5 19m27-19 5 19"/><path d="m60 102-5 12m15-16v19m10-15 5 12"/></svg>';document.documentElement.style.setProperty('--selected-color',colorOf(item));$('object-type').textContent=item.isFleet?'ДОСЬЕ ФЛОТА':item.isEvent?'ДОСЬЕ СОБЫТИЯ':'ДОСЬЕ СИСТЕМЫ';$('detail-group').textContent=g.label;
  if(item.isFleet)$('detail-title').textContent=item.name;else{$('detail-title').innerHTML=item.titleHtml;$('detail-title').querySelectorAll('a').forEach(a=>a.rel='noopener noreferrer');}
  $('detail-coordinates').textContent=`X ${String(s.x).padStart(4,'0')} / Y ${String(s.y).padStart(4,'0')}${item.isFleet?' · '+s.name.trim():''}`;
  $('detail-description').textContent=item.description||'Описание не задано в исходной карте.';$('description-panel').open=true;
  $('detail-fleets').replaceChildren();if(!item.isFleet)data.fleets.filter(f=>String(f.system)===String(item.id)).forEach(f=>{const b=text(node('button'),f.name.trim()+' ↗');b.onclick=()=>select(byId.get(f.id));$('detail-fleets').append(b);});
  $('selection-status').textContent=item.name.trim();updateFavoriteButton();updateSelection();center(item);($('dossier-content')||$('inspector')).scrollTop=0;document.dispatchEvent(new CustomEvent('galaxy-selection',{detail:item}));
 }
 function closeInspector(){hideDossier();}
 $('close-inspector').onclick=closeInspector;$('focus-object').onclick=()=>selected&&center(selected);
 function updateFavoriteButton(){const saved=selected&&favorites.has(String(selected.id));$('favorite-object').textContent=saved?'★':'☆';$('favorite-object').setAttribute('aria-pressed',String(!!saved));$('favorite-object').setAttribute('aria-label',saved?'Удалить из избранного':'Добавить в избранное');}
 $('favorite-object').onclick=()=>{if(!selected)return;const id=String(selected.id);favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('ugalaxy-favorites-v1',JSON.stringify([...favorites]));}catch{toast('Браузер не разрешил сохранить избранное.');}updateFavoriteButton();renderList();};
 $('influence-toggle').onchange=()=>{$('influence-map').classList.toggle('off',!$('influence-toggle').checked);};$('labels-toggle').onchange=()=>world.classList.toggle('show-labels',$('labels-toggle').checked);$('fleets-toggle').checked=false;world.classList.add('hide-fleets');$('fleets-toggle').onchange=()=>world.classList.toggle('hide-fleets',!$('fleets-toggle').checked);$('events-toggle').onchange=()=>world.classList.toggle('hide-events',!$('events-toggle').checked);
 $('faction-toggle').onclick=()=>{$('faction-list').hidden=!$('faction-list').hidden;$('faction-toggle').setAttribute('aria-expanded',String(!$('faction-list').hidden));};
 function setFaction(key){if(!key)faction.clear();else faction.has(key)?faction.delete(key):faction.add(key);$('faction-list').querySelectorAll('button').forEach(b=>{const active=b.dataset.key?faction.has(b.dataset.key):!faction.size;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$('faction-toggle').firstChild.textContent=faction.size?'Выбрано держав: '+faction.size+' ':'Все державы ';updateSelection();}
 function renderFactions(){$('faction-list').replaceChildren();[{key:'',label:'Все державы',color:'#78dfea'},...data.groups].forEach(g=>{const b=node('button');b.dataset.key=g.key;b.classList.toggle('all-factions',!g.key);b.classList.toggle('active',!g.key);b.setAttribute('aria-pressed',String(!g.key));b.style.setProperty('--group-color',g.color);b.append(node('i'),text(node('span'),g.label));b.onclick=()=>setFaction(g.key||null);$('faction-list').append(b);});$('faction-list').querySelectorAll('button').forEach(b=>{const active=b.dataset.key?faction.has(b.dataset.key):!faction.size;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$('faction-toggle').firstChild.textContent=faction.size?'Выбрано держав: '+faction.size+' ':'Все державы ';}renderFactions();
 $('help-toggle').onclick=()=>{$('help').showModal();};$('close-help').onclick=()=>$('help').close();$('help').addEventListener('click',e=>{if(e.target===$('help')){const r=$('help').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('help').close();}});
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Полноэкранный режим недоступен в этом браузере.');}};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('help').open)$('help').close();else closeInspector();return;}if(e.target.matches('input,textarea,select')||document.querySelector('dialog[open]'))return;if(e.key==='/'){e.preventDefault();setNav(true);$('search').focus();}if(e.key.toLowerCase()==='n'||e.key.toLowerCase()==='т')setNav($('nav-toggle').getAttribute('aria-expanded')!=='true');if(e.key==='+'||e.key==='=')zoom(1.25);if(e.key==='-')zoom(.8);if(e.key.toLowerCase()==='l'||e.key.toLowerCase()==='д')setLayers($('layers').hidden);if(e.key==='0')fit();if(e.key.toLowerCase()==='g'||e.key.toLowerCase()==='п')galaxyHome();});
 $('base-map').addEventListener('error',()=>toast('Не удалось загрузить изображение карты. Проверьте папку assets.'));
 $('influence-map').addEventListener('error',()=>{$('influence-toggle').checked=false;$('influence-toggle').disabled=true;$('influence-map').classList.add('off');});
 new ResizeObserver(()=>{if(cameraMode==='system'&&selected)center(selected,false);else if(cameraMode==='universe')fit(false);else if(cameraMode==='galaxy')galaxyHome(false);else{cancelFlight();constrain();applyTransform();}}).observe(viewport);
 reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)cancelFlight();});
 function updateScrollHint(){const el=$('dossier-content')||$('inspector');$('scroll-hint').hidden=el.hidden||el.classList.contains('folded')||el.scrollHeight<=el.clientHeight+40||el.scrollTop+el.clientHeight>=el.scrollHeight-38;}
 $('inspector').addEventListener('scroll',updateScrollHint);$('description-panel').addEventListener('toggle',()=>requestAnimationFrame(updateScrollHint));
 new ResizeObserver(()=>requestAnimationFrame(updateScrollHint)).observe($('inspector'));
 renderMarkers();renderList();window.galaxyApp={getNavigationState:()=>({filter,favorites:new Set(favorites),selected}),getData:()=>JSON.parse(JSON.stringify(data)),getSelected:()=>selected,replaceData:refreshData,selectId:id=>{const i=byId.get(String(id));if(i)select(i);},hidePanels:()=>{setNav(false);setLayers(false);hideDossier();},mapPoint:(x,y)=>{const r=viewport.getBoundingClientRect();return {x:Math.round((x-r.left-tx)/scale-5.5),y:Math.round((y-r.top-ty)/scale-5.5)};},toast,setTerritories:t=>{data.territories=t;document.dispatchEvent(new Event('galaxy-data-changed'));}};if(isMobile()){setNav(false);setLayers(false);}dockState();galaxyHome(false);
 function arrival(){viewport.dataset.arrival='done';if(reducedMotion.matches)return;const canvas=document.createElement('canvas');canvas.id='arrival-effect';canvas.setAttribute('aria-hidden','true');viewport.append(canvas);const ctx=canvas.getContext('2d');canvas.width=viewport.clientWidth;canvas.height=viewport.clientHeight;const w=canvas.width,h=canvas.height,start=performance.now();let frame=0;viewport.dataset.arrival='active';function stop(){cancelAnimationFrame(frame);canvas.remove();viewport.dataset.arrival='done';viewport.removeEventListener('pointerdown',stop);viewport.removeEventListener('wheel',stop);}viewport.addEventListener('pointerdown',stop,{once:true});viewport.addEventListener('wheel',stop,{once:true});function tick(now){const p=Math.min(1,(now-start)/1050);ctx.clearRect(0,0,w,h);const alpha=Math.sin(Math.PI*p)*.4;ctx.strokeStyle=`rgba(137,210,234,${alpha})`;ctx.lineWidth=1;for(let i=0;i<48;i++){const angle=i*2.39996+p*2.2,r=(.05+p*.9)*(Math.max(w,h)*(.15+(i%9)/14));ctx.beginPath();for(let j=0;j<6;j++){const a=angle-j*.035,rr=r-j*5;const x=w*.5+Math.cos(a)*rr,y=h*.48+Math.sin(a)*rr;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}if(p<1)frame=requestAnimationFrame(tick);else stop();}frame=requestAnimationFrame(tick);}
 arrival();
 mobileMode.addEventListener('change',()=>{renderMarkers();setNav(false);setLayers(false);hideDossier();galaxyHome(false);});
 if(window.visualViewport){const syncHeight=()=>{document.documentElement.style.setProperty('--app-height',window.visualViewport.height+'px');};window.visualViewport.addEventListener('resize',syncHeight);syncHeight();}
})();

;
/* battle-engine.js */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BattleEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const movementDescription='Манёвр при доступной атаке проверяется один раз за раунд для каждого корабля, а не для всего флота: движение расходует один выстрел; варп не расходует выстрел. Из собственного арьергарда сближается, если потери перекрёстного огня не выгоднее защиты или большинство целей находится в арьергардах без преимущества удержания позиции. При недоступных или полностью блокируемых целях прокладывает полезный маршрут. Ошибка маршрута: (10 − уровень) × 2,5% за раунд. После трёх завершённых раундов восстановления возвращается из тыла и два следующих раунда не начинает новый отход.';
const personalities=Object.freeze({
  aggressive:Object.freeze({id:'aggressive',name:'Агрессивный',description:'Избегает заведомо бесполезных выстрелов. В бою с несколькими противниками выбирает цель взвешенно: предпочтение характера и огневая угроза, без обязательного фокуса. В дуэли выбирает наиболее опасную цель. При HP ≤ 12% с вероятностью 12% начинает отход. Из сектора «Столкновение» вторгается на слабейший доступный фланг, если это снимает броню арьергарда или в центре нет целей. Шанс полезного сближения или вторжения — 30% за раунд. '+movementDescription,advanceChance:0.3,retreatChance:.12,retreatHp:.12}),
  cautious:Object.freeze({id:'cautious',name:'Осторожный',description:'Избегает заведомо бесполезных выстрелов. В бою с несколькими противниками выбирает цель взвешенно: предпочтение характера и огневая угроза, без обязательного фокуса. В дуэли выбирает цель с наименьшей долей оставшегося HP. При HP ≤ 35% с вероятностью 24% за раунд начинает отход; при безнадёжном превосходстве противника — 24%. Шанс полезного сближения — 20%; из центра вторгается лишь при отсутствии целей в центре и выгоде снятия брони. '+movementDescription,advanceChance:.2,retreatChance:.24,retreatHp:.35}),
  balanced:Object.freeze({id:'balanced',name:'Уравновешенный',description:'Избегает заведомо бесполезных выстрелов. В бою с несколькими противниками выбирает цель взвешенно: предпочтение характера и огневая угроза, без обязательного фокуса. В дуэли выбирает цель с минимальной суммой защиты и удвоенного оставшегося HP. При HP ≤ 12% с вероятностью 12% за раунд начинает отход. Шанс полезного сближения — 24%; вводит корабли поэтапно до 60% передовой, остальные сохраняет в резерве. Из центра вторгается лишь без целей в центре и при выгоде снятия брони. '+movementDescription,advanceChance:.24,retreatChance:.12,retreatHp:.12}),
  tactician:Object.freeze({id:'tactician',name:'Тактик',description:'Избегает заведомо бесполезных выстрелов. В бою с несколькими противниками выбирает цель взвешенно: предпочтение характера и огневая угроза, без обязательного фокуса. В дуэли выбирает доступную цель с наименьшим HP. При HP ≤ 14% с вероятностью 15% начинает отход. Шанс полезного сближения или фланга — 28%; вторгается на слабейший доступный фланг только при улучшении огня за счёт снятия брони арьергарда. Очищает астероиды при доле своих кораблей в секторе не ниже 50%. '+movementDescription,advanceChance:.28,retreatChance:.15,retreatHp:.14})
});
// Canonical UI text and engine modifiers share one immutable dictionary.
function trait(id,name,benefits,drawbacks,scope,duration,effects={}){
  const bonusItems=Array.isArray(benefits)?benefits:[benefits];
  const neutral=['Начальное размещение в секторе «Столкновение» не даёт бонус.','Срок окончательного бегства не сокращается: обычно 3 завершённых раунда подряд.','Прочность (HP) не восстанавливается.'];
  const items=Array.isArray(drawbacks)?drawbacks:[drawbacks];
  const downsideItems=items.filter(text=>text!=='Недостатков нет.'&&!neutral.includes(text));
  const limitationItems=items.filter(text=>neutral.includes(text));
  const bonus=bonusItems.join(' '),downside=[...downsideItems,...limitationItems].join(' ')||'Недостатков нет.';
  const probabilityNote=effects.disobedience||effects.withdrawalDisobedience||effects.recoveryDisobedience?'Поправка напрямую изменяет шанс неповиновения: например, 8% − 5% = 3%. Это не относительное снижение; итоговый шанс ограничен 0–70%.':'';
  return {id,name,bonusItems,downsideItems,limitationItems,bonus,downside,scope,duration,probabilityNote,description:bonus+' '+downside+' '+scope+' '+duration+(probabilityNote?' '+probabilityNote:''),...effects};
}
const traits=freeze({
  inspiring_leader:trait('inspiring_leader','Внушительный лидер','Неповиновение −5%.','Недостатков нет.','Явный приказ движения из сектора «Столкновение».','Всё сражение.',{disobedience:-.05}),
  decisive_assault:trait('decisive_assault','Решительный натиск','Результат броска атаки +3 после первого входа в сектор «Столкновение» за раунд.','Начальное размещение в секторе «Столкновение» не даёт бонус.','Корабль, вошедший в сектор «Столкновение»; бонус сохраняется при последующем перемещении.','До конца текущего раунда; следующий раунд сбрасывает бонус.',{entryAttack:3}),
  iron_discipline:trait('iron_discipline','Железная дисциплина','Неповиновение −7%.','Результат броска атаки −1.','Неповиновение: явный приказ движения из сектора «Столкновение»; атака: любой сектор.','Всё сражение.',{disobedience:-.07,attack:-1}),
  reckless_charge:trait('reckless_charge','Безрассудный натиск','Результат броска атаки +1 в секторе «Столкновение».','Неповиновение +4%.','Авангард — корабли в секторе «Столкновение», а не отдельный сектор; неповиновение при явном приказе из сектора «Столкновение».','Всё сражение, пока соблюдается условие сектора.',{disobedience:.04,centerAttack:1}),
  protective_screen:trait('protective_screen','Защитный экран','Результат броска защиты +2 только против стрелка в секторе «Столкновение».','Результат броска атаки −1 в собственном арьергарде.','Собственный арьергард; бонус защиты не действует против стрелков из других секторов.','Всё сражение, пока корабль в собственном арьергарде.',{ownGuardAttack:-1,screenDefense:2}),
  orderly_withdrawal:trait('orderly_withdrawal','Организованный отход','Неповиновение −6% при явном приказе из сектора «Столкновение» в собственный тыл.','Срок окончательного бегства не сокращается: обычно 3 завершённых раунда подряд.','Собственный тыл — конечная цель приказа, даже если первый шаг ведёт в собственный арьергард.','Всё сражение.',{withdrawalDisobedience:-.06}),
  seasoned_crew:trait('seasoned_crew','Опытный экипаж',['Шанс неповиновения −3% при явном приказе движения из сектора «Столкновение».','Результат броска защиты +1 в секторе «Столкновение».'],'Недостатков нет.','Неповиновение: явный приказ из сектора «Столкновение»; защита: корабли в секторе «Столкновение».','Всё сражение.',{disobedience:-.03,centerDefense:1}),
  independent_captains:trait('independent_captains','Независимые капитаны','Результат броска атаки +2 в секторе «Столкновение».','Неповиновение +7%.','Корабли в секторе «Столкновение»; неповиновение при явном приказе движения из сектора «Столкновение».','Всё сражение, пока соблюдается условие сектора.',{disobedience:.07,centerAttack:2}),
  vanguard_screen:trait('vanguard_screen','Экран авангарда','Результат броска защиты +2 в секторе «Столкновение».','Недостатков нет.','Авангард — корабли в секторе «Столкновение», а не отдельный сектор.','Всё сражение, пока корабль в секторе «Столкновение».',{centerDefense:2}),
  vanguard_pressure:trait('vanguard_pressure','Давление авангарда','Результат броска атаки +2 в секторе «Столкновение».','Результат броска защиты −1 в секторе «Столкновение».','Авангард — корабли в секторе «Столкновение», а не отдельный сектор.','Всё сражение, пока корабль в секторе «Столкновение».',{centerAttack:2,centerDefense:-1}),
  layered_armor:trait('layered_armor','Многослойная броня','Результат броска защиты +1 против любого стрелка, которому разрешена атака.','Результат броска атаки −1 в собственном арьергарде.','Собственный арьергард; в отличие от Защитного экрана, защита не ограничена стрелком в секторе «Столкновение».','Всё сражение, пока корабль в собственном арьергарде.',{ownGuardAttack:-1,ownGuardDefense:1}),
  rear_fortification:trait('rear_fortification','Укрепление тыла','Результат броска защиты +3 против вторгшегося в тот же тыл противника.','Недостатков нет.','Только собственный тыл; чужой тыл бонуса не даёт.','Всё сражение, пока корабль в собственном тылу.',{rearIntruderDefense:3}),
  rapid_evacuation:trait('rapid_evacuation','Быстрая эвакуация','Окончательное бегство после 2 завершённых раундов подряд в собственном тылу вместо обычных 3.','Результат броска защиты −1 в собственном тылу.','Только собственный тыл; выход сбрасывает счётчик. Сохраняет корабли ценой участия в бою: уже сбежавшие корабли не возвращаются и не приносят победу.','Всё сражение; учитываются завершённые раунды подряд.',{escapeRounds:2,ownRearDefense:-1}),
  emergency_reentry:trait('emergency_reentry','Экстренное возвращение','Шаг из собственного тыла в собственный арьергард не расходует действие атаки.','Результат броска атаки −2 до конца текущего раунда во всех секторах.','Только разрешённое движение из собственного тыла; не более одного шага за раунд, без повторной попытки; уже сбежавшие корабли исключены.','Штраф действует весь остаток текущего раунда и сбрасывается в следующем; чужой тыл эффекта не даёт.',{reentryAttack:-2}),
  rear_raiders:trait('rear_raiders','Тыловые рейдеры','Результат броска атаки +2 в чужом тылу.','Результат броска защиты −1 в чужом тылу.','Только чужой тыл; собственный тыл эффекта не даёт.','Всё сражение, пока корабль в чужом тылу.',{foreignRearAttack:2,foreignRearDefense:-1}),
  cautious_recovery:trait('cautious_recovery','Осторожное восстановление',['Шанс неповиновения −4% при явном приказе движения из сектора «Столкновение» в собственный арьергард или собственный тыл.','Результат броска защиты +1 в секторе «Столкновение», если осталось не больше 50% максимальной прочности (HP).'],'Прочность (HP) не восстанавливается.','Снижение неповиновения зависит от конечной цели приказа; защита — только в секторе «Столкновение» при HP не выше половины максимума.','Всё сражение, пока соблюдаются условия приказа и HP.',{recoveryDisobedience:-.04,woundedCenterDefense:1})
});
const shipTraits=freeze({
  repair_drones:trait('repair_drones','Ремонтные дроны','+1 HP, не выше максимума, после третьего завершённого раунда подряд в собственном тылу.','Окончательное бегство запрещено.','Только собственный тыл; корабль не атакует.','Один раз за непрерывное пребывание; выход сбрасывает триггер.',{preventsEscape:true,repair:1}),
  force_shields:trait('force_shields','Силовые щиты','После третьего завершённого раунда подряд в собственном тылу: +5 к защите.','Окончательное бегство запрещено.','Щит сохраняется в любом секторе.','Один раз за пребывание; первый выстрел, наносящий урон, расходует его; заблокированный выстрел сохраняет щит. Крит пробивает щит. Астероид наносит 1 HP и расходует щит.',{preventsEscape:true,shieldDefense:5}),
  warp_jump:trait('warp_jump','Варп-прыжок','Прямое движение в любой сектор без расхода атаки.','Запрет варпа отключает способность.','Любая дистанция; сбежавшие корабли не возвращаются.','Не более одного движения за раунд.',{warpJump:true})
});
const eventTraits=freeze({warp_ban:{id:'warp_ban',name:'Запрет варпа',description:'Варп-прыжки отключены.'},asteroid_rain:{id:'asteroid_rain',name:'Астероидный дождь',description:'10 астероидов с HP 1–3 в начале каждого чётного раунда; оставшиеся наносят 1 HP кораблю в своём секторе.'}});
function selectedEvents(selected=[]){if(!Array.isArray(selected)||new Set(selected).size!==selected.length||selected.some(id=>!Object.hasOwn(eventTraits,id)))throw Error('Некорректные черты события.');return [...selected];}
function selectedShipTraits(f){const selected=f.traits===undefined?[]:f.traits;if(!Array.isArray(selected)||selected.length>3||new Set(selected).size!==selected.length||selected.some(id=>!Object.hasOwn(shipTraits,id)))throw Error('Черты корабля: максимум 3 уникальные известные черты.');return [...selected];}
const cleanupThresholds=freeze({cautious:.4,balanced:.55,tactician:.5,aggressive:.7});
function hasShipTrait(u,id){return (u.traits??[]).includes(id);}
function preventsEscape(u){return (u.traits??[]).some(id=>shipTraits[id]?.preventsEscape);}
function commander(f){
  if(f.commander==null)return null;
  const c=f.commander;
  if(typeof c!=='object'||typeof c.name!=='string'||!c.name.trim()||c.name.length>100||!Object.hasOwn(personalities,c.personality))throw Error('Некорректный командир: имя и характер обязательны.');
  const selected=c.traits===undefined?[]:c.traits;
  if(!Array.isArray(selected)||selected.length>4||new Set(selected).size!==selected.length||selected.some(id=>!Object.hasOwn(traits,id)))throw Error('Некорректные черты командира: максимум 4 уникальные известные черты.');
  if(c.id!==undefined&&(typeof c.id!=='string'||!c.id.trim()))throw Error('Некорректный ID командира.');
  const level=c.level===undefined?5:c.level;
  if(!Number.isInteger(level)||level<1||level>10)throw Error('Некорректный уровень командира: 1–10.');
  return {name:c.name,personality:c.personality,level,traits:[...selected],...(c.id!==undefined?{id:c.id}:{})};
}
function traitSum(unit,key){return (unit.commander?.traits??[]).reduce((n,id)=>n+(traits[id]?.[key]??0),0);}
function traitAttack(unit,position=unit.position){return traitSum(unit,'attack')+(position==='center'?traitSum(unit,'centerAttack'):0)+(position==='guard:'+unit.sideId?traitSum(unit,'ownGuardAttack'):0)+(position.startsWith('rear:')&&position!=='rear:'+unit.sideId?traitSum(unit,'foreignRearAttack'):0)+(unit.emergencyReentryRound!=null?traitSum(unit,'reentryAttack'):0);}
function traitDefense(unit,from){return (unit.position==='center'?traitSum(unit,'centerDefense')+(unit.hp<=unit.maxHp*.5?traitSum(unit,'woundedCenterDefense'):0):0)+(unit.position==='guard:'+unit.sideId?traitSum(unit,'ownGuardDefense')+(from==='center'?traitSum(unit,'screenDefense'):0):0)+(unit.position==='rear:'+unit.sideId?traitSum(unit,'ownRearDefense')+(from===unit.position?traitSum(unit,'rearIntruderDefense'):0):unit.position.startsWith('rear:')?traitSum(unit,'foreignRearDefense'):0);}
function disobedienceChance(unit,destination){
  if(unit.position!=='center'||destination===unit.position||unit.escaped)return 0;
  const health=Math.max(0,Math.min(1,unit.hp/unit.maxHp));
  return Math.max(0,Math.min(.7,.15+.35*(1-health)+.03*(5-(unit.commander?(unit.commander.level??5):1))+traitSum(unit,'disobedience')+(destination==='rear:'+unit.sideId?traitSum(unit,'withdrawalDisobedience'):0)+(['guard:'+unit.sideId,'rear:'+unit.sideId].includes(destination)?traitSum(unit,'recoveryDisobedience'):0)));
}
function resolveCommanders(data){
  if(!data||!Array.isArray(data.fleets)||!Array.isArray(data.commanders??[]))throw Error('Некорректный реестр командиров.');
  const registry=new Map();
  for(const c of data.commanders??[]){
    if(!c||typeof c.id!=='string'||!c.id.trim()||registry.has(c.id)||(c.factionGroup!==null&&typeof c.factionGroup!=='string'))throw Error('Некорректный реестр командиров.');
    registry.set(c.id,commander({commander:c}));
  }
  return data.fleets.map(f=>{
    const copy=JSON.parse(JSON.stringify(f));
    if(Object.hasOwn(f,'commanderId')){
      if(f.commanderId==null)copy.commander=null;
      else {const c=registry.get(f.commanderId);if(!c)throw Error('Командир не найден: '+f.commanderId);copy.commander={...c,traits:[...c.traits]};}
    }
    return copy;
  });
}
function stats(f){
  const s={count:f.count??10,attackMin:f.attackMin??5,attackMax:f.attackMax??20,defenseMin:f.defenseMin??5,defenseMax:f.defenseMax??20,hp:f.hp??10};
  for(const [k,v] of Object.entries(s))if(!Number.isInteger(v)||v<(k==='hp'?1:0)||v>(k==='count'?500:k==='hp'?100:1000))throw Error('Некорректный параметр '+k);
  if(s.attackMin>s.attackMax||s.defenseMin>s.defenseMax)throw Error('Нижний порог выше верхнего.');
  s.multiAttack=f.multiAttack===true;s.attacks=s.multiAttack?Number(f.attacks??2):1;
  if(!Number.isSafeInteger(s.attacks)||s.attacks<(s.multiAttack?2:1))throw Error('Мультиатака: целое количество от 2.');
  s.model=f.model??'medium';
  if(!['small','medium','large'].includes(s.model))throw Error('Некорректная модель корабля.');
  commander(f);s.traits=selectedShipTraits(f);
  if(f.shipTypes!==undefined)s.count=types(f).reduce((n,t)=>n+t.count,0);
  return s;
}
function types(f){
  if(f.shipTypes===undefined)return [{id:'legacy',name:'Основной тип',...stats(f)}];
  if(!Array.isArray(f.shipTypes)||!f.shipTypes.length||f.shipTypes.length>20)throw Error('Нужно 1–20 типов кораблей.');
  const ids=new Set();
  const ts=f.shipTypes.map(t=>{
    if(!t||typeof t.id!=='string'||!t.id.trim()||ids.has(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>100)throw Error('Неверное название или ID типа кораблей.');
    ids.add(t.id);return {id:t.id,name:t.name,...stats({...t,shipTypes:undefined,commander:null})};
  });
  if(ts.reduce((n,t)=>n+t.count,0)>500)throw Error('Максимум 500 кораблей на флот.');
  return ts;
}
// Shared center and guard sectors can fire into each other.
function legalTargets(attacker,units){
  if(attacker.hp<=0||attacker.escaped||attacker.withdrawn||attacker.position==='rear:'+attacker.sideId)return [];
  return units.filter(u=>u.hp>0&&!u.escaped&&u.sideId!==attacker.sideId&&(u.position===attacker.position||(attacker.position.startsWith('guard:')&&(u.position==='center'||u.position.startsWith('guard:')))||(attacker.position==='center'&&u.position.startsWith('guard:'))));
}
function legalMoves(unit,sides){
  if(unit.hp<=0||unit.escaped)return [];
  if(unit.position==='center')return sides.map(s=>'guard:'+(typeof s==='object'?s.id:s));
  if(unit.position.startsWith('guard:'))return ['center','rear:'+unit.position.slice(6)];
  if(unit.position.startsWith('rear:'))return ['guard:'+unit.position.slice(5)];
  return [];
}
// No commander: attack if legal; otherwise advance one edge on a shortest
// route to an enemy. Never skip or retreat. Ties use the seeded RNG.
function advance(unit,enemies,sides,random){
  const choices=[];let best=Infinity;
  for(const next of legalMoves(unit,sides)){
    if(next==='rear:'+unit.sideId)continue;
    const queue=[[next,1]],seen=new Set([next]);let distance=Infinity;
    while(queue.length){
      const [position,d]=queue.shift();
      if(enemies.some(e=>e.position===position)){distance=d;break;}
      for(const p of legalMoves({...unit,position},sides))if(p!=='rear:'+unit.sideId&&!seen.has(p)){seen.add(p);queue.push([p,d+1]);}
    }
    if(distance<best){best=distance;choices.length=0;choices.push(next);}else if(distance===best&&distance<Infinity)choices.push(next);
  }
  return choices.length?choices[Math.floor(random()*choices.length)]:null;
}
function retreat(unit,sides){
  if(unit.position==='rear:'+unit.sideId)return unit.position;
  if(unit.position==='guard:'+unit.sideId)return 'rear:'+unit.sideId;
  if(unit.position==='center')return 'guard:'+unit.sideId;
  if(unit.position.startsWith('guard:'))return 'center';
  return legalMoves(unit,sides)[0]??null;
}
function decideMove(unit,enemies,targets,sides,random,retreatChecked,tactical){ 
  const p=unit.commander?personalities[unit.commander.personality]:null;
  if(preventsEscape(unit)&&unit.position==='rear:'+unit.sideId){if(!unit.rearTraitTriggered)return unit.position;unit.aiRetreat=false;unit.aiRecoveryUntil=tactical.round+2;return 'guard:'+unit.sideId;}
  if(unit.aiRetreat)return retreat(unit,sides);
  // Cautious disadvantage: every live enemy has attackMin > this ship's
  // defenseMax and defenseMin >= its attackMax (a visibly hopeless matchup).
  const outmatched=p?.id==='cautious'&&enemies.every(e=>e.attackMin>unit.defenseMax&&e.defenseMin>=unit.attackMax);
  if(p&&p.retreatChance>0&&(unit.aiRecoveryUntil??0)<tactical.round&&(unit.hp/unit.maxHp<=p.retreatHp||outmatched)&&!retreatChecked.has(unit.id)){
    retreatChecked.add(unit.id);
    if(random()<p.retreatChance){unit.aiRetreat=true;return retreat(unit,sides);}
  }
  // Modifiers can make every legal shot ineffective. Reposition rather than
  // indefinitely trading blocked crossguard fire; this is shared by all styles.
  if(p&&targets.length){
    const own=sides.find(s=>s.id===unit.sideId);
    const effective=(position,target)=>unit.attackMax+traitAttack(unit,position)-(position==='guard:'+unit.sideId&&target.position.startsWith('guard:')&&target.position!==position?own.guardPenalty:0)-target.defenseMin-traitDefense(target,position)-(position==='center'&&target.position==='guard:'+target.sideId?sides.find(s=>s.id===target.sideId).guardArmor:0);
    if(targets.every(t=>effective(unit.position,t)<=0)){
      const improved=legalMoves(unit,sides).filter(position=>position!=='rear:'+unit.sideId&&legalTargets({...unit,position,withdrawn:false},enemies).some(t=>effective(position,t)>0));
      if(improved.length)return improved[Math.floor(random()*improved.length)];
      // A useful firing sector may be two edges away (own guard → center →
      // enemy guard). Route toward a genuinely better shot, not arbitrary motion.
      const goals=['center',...sides.flatMap(s=>['guard:'+s.id,'rear:'+s.id])].filter(position=>position!==unit.position&&position!=='rear:'+unit.sideId&&legalTargets({...unit,position,withdrawn:false},enemies).some(t=>effective(position,t)>0));
      if(goals.length){
        const routes=goals.map(goal=>{const first=pathStep(unit,goal,sides);let position=unit.position,distance=0;while(position!==goal&&distance<4){position=pathStep({...unit,position},goal,sides);distance++;}return {first,distance};}).filter(r=>r.first);
        const distance=Math.min(...routes.map(r=>r.distance)),best=routes.filter(r=>r.distance===distance);
        if(best.length)return best[Math.floor(random()*best.length)].first;
      }
    }
  }
  if(!targets.length)return advance(unit,enemies,sides,random);
  if(p&&targets.length&&!tactical.checked.has(unit.id)){
    tactical.checked.add(unit.id);
    const own=sides.find(s=>s.id===unit.sideId),health=unit.hp/unit.maxHp;
    const guardTargets=targets.filter(t=>t.position.startsWith('guard:')&&t.position!=='guard:'+unit.sideId);
    const centerTargets=targets.length-guardTargets.length;
    // A voluntary maneuver spends one firing slot, not a whole burst. Evaluate
    // crossfire loss against the guard's real protection; retain useful reserves.
    if(unit.position==='guard:'+unit.sideId&&guardTargets.length&&health>p.retreatHp){
      const protection=traitSum(unit,'ownGuardDefense')+traitSum(unit,'screenDefense')+own.guardArmor;
      const gain=own.guardPenalty+traitAttack(unit,'center')-traitAttack(unit);
      const front=tactical.front.get(unit.sideId),total=tactical.total.get(unit.sideId);
      const reserveReady=p.id!=='balanced'||total===1||(front+1)/Math.max(1,total)<=.6;
      if(reserveReady&&(gain>=protection||guardTargets.length>centerTargets*1.5&&gain>=0)&&random()<p.advanceChance)return 'center';
    }
    if(unit.position==='center'&&guardTargets.length&&health>p.retreatHp){
      const strengths=new Map();
      for(const e of enemies)strengths.set(e.sideId,(strengths.get(e.sideId)??0)+e.hp/e.maxHp);
      const flankSides=[...new Set(guardTargets.map(t=>t.sideId))];
      const weakest=Math.min(...flankSides.map(id=>strengths.get(id)));
      const choices=flankSides.filter(id=>strengths.get(id)===weakest);
      // Randomize equally weak flanks per ship, not a fleet-wide hard focus.
      const id=choices[Math.floor(random()*choices.length)],position='guard:'+id;
      const armor=sides.find(s=>s.id===id).guardArmor;
      const gain=armor+traitAttack(unit,position)-traitAttack(unit);
      const worthwhile=gain>0||p.id==='aggressive'&&centerTargets===0;
      const style=p.id==='aggressive'||p.id==='tactician'||centerTargets===0;
      if(style&&worthwhile&&random()<p.advanceChance)return position;
    }
  }
  return null;
}
function freeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;
}
function counts(own){
  const living=own.filter(u=>u.hp>0),escaped=living.filter(u=>u.escaped).length,withdrawn=living.filter(u=>!u.escaped&&u.withdrawn).length;
  return {survivors:living.length,destroyed:own.length-living.length,active:living.length-withdrawn-escaped,withdrawn,escaped,remainingHp:own.reduce((n,u)=>n+Math.max(0,u.hp),0)};
}
function createBattle({fleets,sides,seed=1,critsEnabled=true,splitMultiAttacks=false,eventTraits:events=[]}={}){
  events=selectedEvents(events);
  if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('Некорректный seed.');
  if(typeof critsEnabled!=='boolean'||typeof splitMultiAttacks!=='boolean')throw Error('Некорректные правила боя.');
  if(!Array.isArray(sides)||sides.length<2||sides.length>6||sides.some(s=>!s||typeof s.id!=='string'||!s.id.trim()||typeof s.name!=='string'||!s.name.trim()||!Array.isArray(s.fleetIds)||!s.fleetIds.length)||new Set(sides.map(s=>s.id)).size!==sides.length)throw Error('Нужны 2–6 непустых сторон.');
  sides=JSON.parse(JSON.stringify(sides));
  for(const s of sides){
    for(const k of ['guardArmor','guardPenalty']){s[k]??=0;if(!Number.isFinite(s[k])||s[k]<0)throw Error('Некорректный '+k);}
    if(s.isPlayer!==undefined&&typeof s.isPlayer!=='boolean')throw Error('Некорректный isPlayer.');
  }
  if(!Array.isArray(fleets)||fleets.some(f=>!f||f.id==null)||new Set(fleets.map(f=>String(f.id))).size!==fleets.length)throw Error('Неверный список флотов.');
  const map=new Map(fleets.map(f=>[String(f.id),f])),used=new Set(),units=[];
  for(const side of sides)for(const id of side.fleetIds){
    if(used.has(String(id)))throw Error('Флот не может участвовать в двух сторонах.');used.add(String(id));
    const f=map.get(String(id));if(!f)throw Error('Флот не найден.');
    if(f.commanderId!=null&&(!f.commander||f.commander.id!==f.commanderId))throw Error('Командир не найден: '+f.commanderId);
    const ts=types(f),c=commander(f),count=ts.reduce((n,t)=>n+t.count,0);if(!count)throw Error('Уничтоженный флот не может участвовать в бою.');
    let index=0;
    for(const t of ts)for(let i=0;i<t.count;i++)units.push({id:String(id)+'#'+t.id+'#'+i,typeId:t.id,typeName:t.name,model:t.model,traits:[...t.traits],rearTraitTriggered:false,forceShield:0,commander:c?{...c,traits:[...c.traits]}:null,multiAttack:t.multiAttack,attacks:t.attacks,fleetId:f.id,sideId:side.id,maxHp:t.hp,hp:t.hp,attackMin:t.attackMin,attackMax:t.attackMax,defenseMin:t.defenseMin,defenseMax:t.defenseMax,position:index++<Math.ceil(count*.3)?'center':'guard:'+side.id,withdrawn:false,escaped:false,rearTurns:0,aiRetreat:false,aiRecoveryUntil:0,centerEntryRound:null,emergencyReentryRound:null});
  }
  // Manual deployment is side-wide: omitted scopes stay in own guard. Fleet
  // scopes select ships in stable type/index order; overlapping scopes are invalid.
  for(const side of sides)if(side.deployment!==undefined){
    if(!side.isPlayer||!Array.isArray(side.deployment))throw Error('Некорректное размещение.');
    const own=units.filter(u=>u.sideId===side.id),claimed=new Set(),scopes=[];
    for(const u of own)u.position='guard:'+side.id;
    for(const d of side.deployment){
      if(!d||typeof d!=='object'||Array.isArray(d)||d.fleetId==null||!Number.isSafeInteger(d.centerCount)||d.centerCount<0||(d.typeId!==undefined&&typeof d.typeId!=='string'))throw Error('Некорректное размещение.');
      const f=side.fleetIds.some(id=>String(id)===String(d.fleetId))?map.get(String(d.fleetId)):null;
      if(!f||(d.typeId!==undefined&&!types(f).some(t=>t.id===d.typeId))||scopes.some(p=>String(p.fleetId)===String(d.fleetId)&&(p.typeId===undefined||d.typeId===undefined||p.typeId===d.typeId)))throw Error('Несовместимые области размещения.');
      scopes.push(d);
      const selected=own.filter(u=>String(u.fleetId)===String(d.fleetId)&&(d.typeId===undefined||u.typeId===d.typeId));
      if(d.centerCount>selected.length||selected.some(u=>claimed.has(u.id)))throw Error('Несовместимые области размещения.');
      selected.forEach((u,i)=>{claimed.add(u.id);if(i<d.centerCount)u.position='center';});
    }
    if(own.filter(u=>u.position==='center').length<Math.ceil(own.length*.3))throw Error('Минимум 30% кораблей стороны должны быть в секторе «Столкновение».');
  }
  if(units.length>1500)throw Error('Максимум 1500 кораблей в одном бою.');
  if(units.reduce((n,u)=>n+u.attacks,0)>2000000)throw Error('Лимит 2 млн действий за раунд.');
  return freeze({eventTraits:events,initialEventTraits:events,asteroids:[],rules:{critsEnabled,splitMultiAttacks,eventTraits:events},sides,seed,rngState:seed,requestedRounds:null,completedRounds:0,...results(units,sides),units,initialUnitZones:units.map(u=>u.position),roundSummaries:[],log:[],logTruncated:false});
}
function results(units,sides){
  const scores=sides.map(s=>{
    const own=units.filter(u=>u.sideId===s.id),c=counts(own),initialHp=own.reduce((n,u)=>n+u.maxHp,0);
    return {...s,hp:c.remainingHp,initialHp,integrity:initialHp?c.remainingHp/initialHp:0,alive:c.survivors,total:own.length,active:c.active,withdrawn:c.withdrawn,escaped:c.escaped,destroyed:c.destroyed};
  });
  const livingSides=sides.filter(s=>units.some(u=>u.sideId===s.id&&u.hp>0&&!u.escaped)),finished=livingSides.length<=1,winnerId=finished&&livingSides.length===1?livingSides[0].id:null;
  const fleetResults=[...new Set(units.map(u=>String(u.fleetId)))].map(id=>{
    const own=units.filter(u=>String(u.fleetId)===id),c=counts(own);
    return {id,sideId:own[0].sideId,initial:own.length,...c,shipTypes:[...new Set(own.map(u=>u.typeId))].map(tid=>{
      const ts=own.filter(u=>u.typeId===tid);return {id:tid,name:ts[0].typeName,model:ts[0].model,initial:ts.length,...counts(ts)};
    }),disposition:!c.survivors?'Сокрушены':c.escaped===c.survivors?'Сбежали':!finished?'Бой продолжается':winnerId===null?'Ничья':own[0].sideId===winnerId?'Победитель':'Сбежали / сдались'};
  });
  return {scores,fleetResults,finished,winnerId,winnerName:winnerId!==null?scores.find(s=>s.id===winnerId).name:finished?'Ничья':'Бой продолжается'};
}
function matches(u,scope){return (scope.sideId===undefined||u.sideId===scope.sideId)&&(scope.fleetId===undefined||String(u.fleetId)===String(scope.fleetId))&&(scope.typeId===undefined||u.typeId===scope.typeId);}
function validateScope(scope,state,requiredSide=false){
  if(!scope||typeof scope!=='object'||Array.isArray(scope))throw Error('Некорректная область приказа/бонуса.');
  if((requiredSide||scope.sideId!==undefined)&&!state.sides.some(s=>s.id===scope.sideId))throw Error('Сторона не найдена.');
  if(scope.fleetId!==undefined&&(scope.fleetId===null||!state.units.some(u=>String(u.fleetId)===String(scope.fleetId))))throw Error('Флот не найден.');
  if(scope.typeId!==undefined&&(typeof scope.typeId!=='string'||!state.units.some(u=>u.typeId===scope.typeId)))throw Error('Тип не найден.');
  if(!state.units.some(u=>matches(u,scope)))throw Error('Несовместимые области приказа/бонуса.');
}
function pathStep(unit,destination,sides){
  if(unit.position===destination)return null;
  const queue=legalMoves(unit,sides).map(p=>[p,p]),seen=new Set([unit.position]);
  while(queue.length){const [p,first]=queue.shift();if(p===destination)return first;if(seen.has(p))continue;seen.add(p);for(const next of legalMoves({...unit,position:p},sides))if(!seen.has(next))queue.push([next,first]);}
  return null;
}
// Orders are round-local: HP/count selection happens before initiative; the first
// matching order owns a ship. One movement slot per ship per round advances
// one edge; remaining slots attack legally. Resubmit to continue next round.
// HP thresholds are absolute HP, not percentages. Bonuses affect effective rolls
// only; raw rolls determine critical eligibility and confirmation chance.
function nextRound(previous,{commands=[],bonuses=[],eventTraits:events}={}){
  if(!previous||!Array.isArray(previous.units)||!Number.isInteger(previous.rngState)||previous.rngState<0||previous.rngState>4294967295)throw Error('Некорректное состояние боя.');
  if(previous.units.some(u=>!Number.isSafeInteger(u.attacks)||u.attacks<1)||previous.units.filter(u=>u.hp>0&&!u.escaped).reduce((n,u)=>n+u.attacks,0)>2000000)throw Error('Лимит 2 млн действий за раунд.');
  if(!Array.isArray(commands)||!Array.isArray(bonuses)||commands.length>1500||bonuses.length>1500)throw Error('Некорректные команды или бонусы.');
  events=selectedEvents(events===undefined?(previous.eventTraits??previous.rules.eventTraits??[]):events);
  const destinations=new Set(['center',...previous.sides.flatMap(s=>['guard:'+s.id,'rear:'+s.id])]);
  for(const c of commands){validateScope(c,previous,true);if(!['move','attack_asteroids','focus'].includes(c.action??'move')||(c.action==='focus'?!previous.sides.some(s=>s.id===c.targetSideId&&s.id!==c.sideId):!destinations.has(c.destination))||!['lt','gt','lte','gte','eq','any'].includes(c.hpOp)||!Number.isFinite(c.hpValue)||c.hpValue<0||(c.count!==null&&(!Number.isInteger(c.count)||c.count<0||c.count>1500)))throw Error('Некорректный приказ.');}
  for(const b of bonuses){validateScope(b,previous);if(!Number.isFinite(b.attack)||!Number.isFinite(b.defense))throw Error('Некорректный бонус.');}
  const assigned=new Map();
  for(const c of commands){const compare={lt:u=>u.hp<c.hpValue,gt:u=>u.hp>c.hpValue,lte:u=>u.hp<=c.hpValue,gte:u=>u.hp>=c.hpValue,eq:u=>u.hp===c.hpValue,any:()=>true}[c.hpOp];let count=c.count??Infinity;for(const u of previous.units)if(count>0&&u.hp>0&&!u.escaped&&!assigned.has(u.id)&&matches(u,c)&&compare(u)&&(c.action!=='attack_asteroids'||u.position===c.destination)){assigned.set(u.id,c);count--;}}
  if(previous.selectedRound!==undefined){const {selectedRound,...base}=previous;previous={...base,roundSummaries:base.roundSummaries.slice(0,selectedRound),log:base.log.filter(l=>l.round<=selectedRound),logTruncated:selectedRound?(base.roundSummaries[selectedRound-1].logTruncated??false):false};}
  if(previous.finished)return freeze(previous);
  const units=previous.units.map(u=>({...u,centerEntryRound:null,emergencyReentryRound:null})),sides=previous.sides,{critsEnabled,splitMultiAttacks}=previous.rules;
  let rngState=previous.rngState;
  const random=()=>{rngState=(rngState+0x6D2B79F5)>>>0;let t=rngState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
  const roll=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1));
  const log=[...previous.log],roundSummaries=[...previous.roundSummaries],round=previous.completedRounds+1;
  let logTruncated=previous.logTruncated;
  const record=entry=>{if(log.length<5000)log.push(entry);else logTruncated=true;};
  const asteroids=(previous.asteroids??[]).filter(a=>a.hp>0).map(a=>({...a}));
  if(events.includes('asteroid_rain')&&round%2===0)for(let i=0;i<10;i++){const position=[...destinations][roll(0,destinations.size-1)],hp=roll(1,3),asteroid={id:'asteroid:'+round+':'+i,position,hp,maxHp:hp};asteroids.push(asteroid);record({round,action:'asteroid_spawn',...asteroid});}
  const living=units.filter(u=>u.hp>0&&!u.escaped),order=splitMultiAttacks?living.flatMap(u=>Array(u.attacks).fill(u)):[...living];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const attackAsteroid=(attacker,target,turn,shot,extra={})=>{const rawAttack=roll(attacker.attackMin,attacker.attackMax),attack=rawAttack+traitAttack(attacker)+(attacker.centerEntryRound===round?traitSum(attacker,'entryAttack'):0)+bonuses.filter(b=>matches(attacker,b)).reduce((n,b)=>n+b.attack,0),criticalCandidate=critsEnabled&&rawAttack===attacker.attackMax,criticalChance=Math.min(100,Math.floor(attacker.attackMax/5)*5),confirmationRoll=criticalCandidate?roll(1,100):null,critical=criticalCandidate&&confirmationRoll<=criticalChance,damage=critical||attack>0?1:0;target.hp=Math.max(0,target.hp-damage);record({round,turn,shot,action:'attack_asteroid',attacker:attacker.id,target:target.id,from:attacker.position,targetPosition:target.position,rawAttack,rawDefense:0,attack,defense:0,criticalCandidate,criticalChance,confirmationRoll,critical,damage,targetHp:target.hp,...extra});};
  let currentShot=0;const commandCleanup=attacker=>{const c=assigned.get(attacker.id);if(c?.action!=='attack_asteroids')return false;const rocks=asteroids.filter(a=>a.hp>0&&a.position===attacker.position);if(rocks.length)attackAsteroid(attacker,rocks[roll(0,rocks.length-1)],turn,currentShot,{reason:'Приказ очистки'});return true;};
  let turn=0;const moved=new Set(),movementRefused=new Set(),retreatChecked=new Set(),pathChecked=new Set(),pathMistakes=new Map(),focusBySide=new Map(),disobedience={checked:0,refused:0,bySide:{}};
  const tactical={round,checked:new Set(),front:new Map(sides.map(s=>[s.id,living.filter(u=>u.sideId===s.id&&u.position!=='guard:'+s.id&&u.position!=='rear:'+s.id).length])),total:new Map(sides.map(s=>[s.id,living.filter(u=>u.sideId===s.id).length]))};
  for(const attacker of order){
    turn++;const shots=splitMultiAttacks?1:attacker.attacks;
    for(let shot=1;shot<=shots;shot++){
      currentShot=shot;
      if(attacker.hp<=0||attacker.escaped)break;
      const enemies=units.filter(u=>u.hp>0&&!u.escaped&&u.sideId!==attacker.sideId);if(!enemies.length)break;
      let targets=legalTargets(attacker,units),from=attacker.position;const player=sides.find(s=>s.id===attacker.sideId).isPlayer;
      if(commandCleanup(attacker)){continue;}
      if(!player&&!assigned.has(attacker.id)&&attacker.commander&&!pathChecked.has(attacker.id)){pathChecked.add(attacker.id);const chance=(10-(attacker.commander.level??5))*.025,mistake=chance>0&&random()<chance;pathMistakes.set(attacker.id,mistake);record({round,turn,shot,action:'ai_path_check',attacker:attacker.id,from,chance,mistake});}
      if(!player&&!assigned.has(attacker.id)&&attacker.commander){const rocks=asteroids.filter(a=>a.hp>0&&a.position===from),sector=units.filter(u=>u.hp>0&&!u.escaped&&u.position===from),ownRatio=sector.filter(u=>u.sideId===attacker.sideId).length/Math.max(1,sector.length);if(rocks.length&&ownRatio>=cleanupThresholds[attacker.commander.personality]&&!pathMistakes.get(attacker.id)){attackAsteroid(attacker,rocks[roll(0,rocks.length-1)],turn,shot,{aiCleanup:true,ownRatio});continue;}}
      if(!moved.has(attacker.id)&&!assigned.has(attacker.id)&&!player&&!attacker.withdrawn&&!attacker.commander){const uncertainty=random();if(uncertainty<.18){record({round,turn,shot,action:'skip',attacker:attacker.id,from,reason:'Нет командующего'});continue;}if(uncertainty<.28){const moves=legalMoves(attacker,sides).filter(p=>p!=='rear:'+attacker.sideId);if(moves.length){const to=moves[Math.floor(random()*moves.length)];attacker.position=to;moved.add(attacker.id);record({round,turn,shot,action:'move',attacker:attacker.id,from,to,withdrawn:false,reason:'Несогласованный манёвр'});continue;}}}
      const command=assigned.get(attacker.id),commanded=!!command&&(command.action??'move')==='move';if(commanded)attacker.aiRetreat=false;
      let to=moved.has(attacker.id)||movementRefused.has(attacker.id)?null:commanded?(hasShipTrait(attacker,'warp_jump')&&!events.includes('warp_ban')&&command.destination!==attacker.position?command.destination:pathStep(attacker,command.destination,sides)):player||command?null:decideMove(attacker,enemies,targets,sides,random,retreatChecked,tactical);
      if(to&&to!==from&&!attacker.aiRetreat&&!commanded&&pathMistakes.get(attacker.id)){const moves=legalMoves(attacker,sides).filter(p=>p!=='rear:'+attacker.sideId);if(moves.length)to=moves[roll(0,moves.length-1)];}
      if(to&&!commanded&&hasShipTrait(attacker,'warp_jump')&&!events.includes('warp_ban')&&!attacker.aiRetreat&&!targets.length){const reachable=enemies.filter(e=>e.position!=='rear:'+attacker.sideId);if(reachable.length)to=reachable[roll(0,reachable.length-1)].position;}
      if(to&&commanded&&from==='center'){
        const chance=disobedienceChance(attacker,command.destination),roll=random();
        disobedience.checked++;const sideStats=disobedience.bySide[attacker.sideId]??={checked:0,refused:0};sideStats.checked++;
        if(roll<chance){movementRefused.add(attacker.id);disobedience.refused++;sideStats.refused++;record({round,turn,shot,action:'disobey',attacker:attacker.id,from,to,destination:command.destination,chance,roll,reason:'Приказ движения отклонён; корабль продолжает допустимые атаки'});to=null;}
      }
      if(to===from){record({round,turn,shot,action:'wait',attacker:attacker.id,from,reason:'Отступление'});continue;}
      if(to){
        const warpJump=hasShipTrait(attacker,'warp_jump')&&!events.includes('warp_ban');
        const freeMovement=warpJump||from==='rear:'+attacker.sideId&&to==='guard:'+attacker.sideId&&traitSum(attacker,'reentryAttack')!==0;
        const wasFront=from!=='guard:'+attacker.sideId&&from!=='rear:'+attacker.sideId,isFront=to!=='guard:'+attacker.sideId&&to!=='rear:'+attacker.sideId;
        tactical.front.set(attacker.sideId,tactical.front.get(attacker.sideId)+Number(isFront)-Number(wasFront));
        attacker.position=to;if(to==='center'&&attacker.centerEntryRound===null)attacker.centerEntryRound=round;
        moved.add(attacker.id);attacker.withdrawn=to==='rear:'+attacker.sideId;if(!attacker.withdrawn){attacker.rearTurns=0;attacker.rearTraitTriggered=false;}
        if(freeMovement&&!warpJump)attacker.emergencyReentryRound=round;
        record({round,turn,shot,action:'move',attacker:attacker.id,from,to,withdrawn:attacker.withdrawn,...(commanded?{reason:'Приказ'}:{}),...(warpJump?{warpJump:true,freeMovement:true,reason:'Варп-прыжок'}:{}),...(freeMovement&&!warpJump?{freeMovement:true,attackPenalty:traitSum(attacker,'reentryAttack'),emergencyReentryRound:round,reason:'Экстренное возвращение: шаг не расходует действие атаки; результат броска атаки −2 до конца раунда'}:{})});
        if(!freeMovement)continue;
        // The same attack slot fires from the new sector. Movement stays spent.
        from=attacker.position;targets=legalTargets(attacker,units);
      }
      if(!targets.length)continue;
      const useful=targets.filter(t=>attacker.attackMax+traitAttack(attacker)+(attacker.centerEntryRound===round?traitSum(attacker,'entryAttack'):0)+bonuses.filter(b=>matches(attacker,b)).reduce((n,b)=>n+b.attack,0)-(from==='guard:'+attacker.sideId&&t.position.startsWith('guard:')&&t.position!==from?sides.find(s=>s.id===attacker.sideId).guardPenalty:0)>t.defenseMin+traitDefense(t,from)+bonuses.filter(b=>matches(t,b)).reduce((n,b)=>n+b.defense,0)+(from==='center'&&t.position==='guard:'+t.sideId?sides.find(s=>s.id===t.sideId).guardArmor:0));
      if(useful.length)targets=useful;
      const preference=attacker.commander?.personality;
      const rank=t=>preference==='aggressive'?(t.attackMin+t.attackMax)*t.attacks:preference==='cautious'?-t.hp/t.maxHp:preference==='balanced'?-(t.defenseMin+t.defenseMax+2*t.hp):preference==='tactician'?-t.hp:0;
      const best=Math.max(...targets.map(rank)),available=targets.filter(t=>rank(t)===best);
      let target;
      if(preference&&new Set(enemies.map(t=>t.sideId)).size>1){
        const ranks=targets.map(rank),lo=Math.min(...ranks),hi=Math.max(...ranks),threats=targets.map(t=>(t.attackMin+t.attackMax)*t.attacks),maxThreat=Math.max(1,...threats);
        // Shared survival logic: dangerous enemies attract fire, while each style
        // retains a soft preference. Re-evaluated after each actual one-HP hit.
        const weights=targets.map((t,i)=>1+(hi===lo?0:(ranks[i]-lo)/(hi-lo))+threats[i]/maxThreat);
        let pick=random()*weights.reduce((a,b)=>a+b,0);target=targets.at(-1);
        for(let i=0;i<targets.length;i++){pick-=weights[i];if(pick<0){target=targets[i];break;}}
      }else target=available[Math.floor(random()*available.length)];
      const recommended=command?.targetSideId??(attacker.commander&&new Set(enemies.map(t=>t.sideId)).size>1?focusBySide.get(attacker.sideId):null);
      if(recommended&&targets.some(t=>t.sideId===recommended)){const chance=disobedienceChance({...attacker,position:'center'},'focus'),refused=chance>0&&random()<chance;record({round,turn,shot,action:'focus_check',attacker:attacker.id,from,targetSideId:recommended,chance,refused});const choices=refused?targets:targets.filter(t=>t.sideId===recommended);target=choices[roll(0,choices.length-1)];}
      if(attacker.commander&&!focusBySide.has(attacker.sideId))focusBySide.set(attacker.sideId,target.sideId);
      const rocks=asteroids.filter(a=>a.hp>0&&a.position===target.position),interceptChance=Math.min(.45,rocks.length*.15);
      if(rocks.length&&random()<interceptChance){attackAsteroid(attacker,rocks[roll(0,rocks.length-1)],turn,shot,{intercepted:true,interceptChance,intendedTarget:target.id});continue;}
      const rawAttack=roll(attacker.attackMin,attacker.attackMax),rawDefense=roll(target.defenseMin,target.defenseMax);
      const attackerSide=sides.find(s=>s.id===attacker.sideId),targetSide=sides.find(s=>s.id===target.sideId);
      const attack=rawAttack+traitAttack(attacker)+(attacker.centerEntryRound===round?traitSum(attacker,'entryAttack'):0)+bonuses.filter(b=>matches(attacker,b)).reduce((n,b)=>n+b.attack,0)-(from==='guard:'+attacker.sideId&&target.position.startsWith('guard:')&&target.position!==from?attackerSide.guardPenalty:0),baseDefense=rawDefense+traitDefense(target,from)+bonuses.filter(b=>matches(target,b)).reduce((n,b)=>n+b.defense,0)+(from==='center'&&target.position==='guard:'+target.sideId?targetSide.guardArmor:0),shieldDefense=target.forceShield??0,defense=baseDefense+shieldDefense;
      const criticalCandidate=critsEnabled&&rawAttack===attacker.attackMax,criticalChance=Math.min(100,Math.floor(attacker.attackMax/5)*5),confirmationRoll=criticalCandidate?roll(1,100):null,critical=criticalCandidate&&confirmationRoll<=criticalChance,damage=critical||attack>defense?1:0;
      const shieldConsumed=shieldDefense>0&&damage>0;if(shieldConsumed)target.forceShield=0;
      target.hp=Math.max(0,target.hp-damage);
      record({round,turn,shot,action:'attack',attacker:attacker.id,target:target.id,from,targetPosition:target.position,rawAttack,rawDefense,attack,defense,attackPenalty:attacker.emergencyReentryRound===round?traitSum(attacker,'reentryAttack'):0,emergencyReentryRound:attacker.emergencyReentryRound,criticalCandidate,criticalChance,confirmationRoll,critical,damage,shieldDefense,shieldConsumed,targetHp:target.hp});
    }
  }
  for(const asteroid of asteroids)if(asteroid.hp>0){const candidates=units.filter(u=>u.hp>0&&!u.escaped&&u.position===asteroid.position);if(candidates.length){const target=candidates[roll(0,candidates.length-1)],shieldConsumed=(target.forceShield??0)>0;target.forceShield=0;target.hp=Math.max(0,target.hp-1);record({round,action:'asteroid_damage',asteroid:asteroid.id,target:target.id,targetPosition:target.position,damage:1,targetHp:target.hp,shieldConsumed});}}
  for(const u of units)if(u.hp>0&&!u.escaped){
    u.withdrawn=u.position==='rear:'+u.sideId;u.rearTurns=u.withdrawn?u.rearTurns+1:0;
    if(!u.withdrawn)u.rearTraitTriggered=false;
    if(u.withdrawn&&u.rearTurns>=3&&!u.rearTraitTriggered&&preventsEscape(u)){u.rearTraitTriggered=true;if(hasShipTrait(u,'repair_drones')){const before=u.hp;u.hp=Math.min(u.maxHp,u.hp+1);record({round,action:'repair',unit:u.id,position:u.position,healed:u.hp-before,hp:u.hp});}if(hasShipTrait(u,'force_shields')){u.forceShield=5;record({round,action:'force_shield',unit:u.id,position:u.position,forceShield:5});}}
    if(!preventsEscape(u)&&u.rearTurns>=((u.commander?.traits??[]).includes('rapid_evacuation')?traits.rapid_evacuation.escapeRounds:3)){u.escaped=true;u.withdrawn=false;record({round,action:'escape',unit:u.id,position:u.position,hp:u.hp});}
  }
  const summary=results(units,sides);
  roundSummaries.push({round,eventTraits:events,asteroids:asteroids.filter(a=>a.hp>0).map(a=>({...a})),rngState,logTruncated,disobedience,unitRearTraitTriggered:units.map(u=>u.rearTraitTriggered),unitForceShield:units.map(u=>u.forceShield),unitCenterEntryRound:units.map(u=>u.centerEntryRound),unitEmergencyReentryRound:units.map(u=>u.emergencyReentryRound),unitHp:units.map(u=>u.hp),unitZones:units.map(u=>u.position),unitWithdrawn:units.map(u=>u.withdrawn),unitEscaped:units.map(u=>u.escaped),unitRearTurns:units.map(u=>u.rearTurns),unitAiRecoveryUntil:units.map(u=>u.aiRecoveryUntil??0),unitAiRetreat:units.map(u=>u.aiRetreat),sides:summary.scores,fleetResults:summary.fleetResults});
  return freeze({...previous,asteroids:asteroids.filter(a=>a.hp>0),eventTraits:events,rules:{...previous.rules,eventTraits:events},rngState,completedRounds:round,...summary,units,roundSummaries,log,logTruncated});
}
// Legacy bounded helper; interactive/full-auto callers step with nextRound.
function simulate({rounds,...options}){
  if(!Number.isInteger(rounds)||rounds<1||rounds>1000)throw Error('Раунды: от 1 до 1000.');
  let state=createBattle(options);
  for(let i=0;i<rounds&&!state.finished;i++)state=nextRound(state);
  return freeze({...state,requestedRounds:rounds});
}
function summarize(r,round){
  if(!Number.isInteger(round)||round<0||round>r.roundSummaries.length)throw Error('Раунд не найден.');
  const snapshot=round?r.roundSummaries[round-1]:null;
  const units=r.units.map((u,i)=>({...u,hp:snapshot?snapshot.unitHp[i]:u.maxHp,position:snapshot?.unitZones?.[i]??r.initialUnitZones?.[i]??'guard:'+u.sideId,withdrawn:snapshot?.unitWithdrawn?.[i]??false,escaped:snapshot?.unitEscaped?.[i]??false,rearTurns:snapshot?.unitRearTurns?.[i]??0,rearTraitTriggered:snapshot?.unitRearTraitTriggered?.[i]??false,forceShield:snapshot?.unitForceShield?.[i]??0,aiRecoveryUntil:snapshot?.unitAiRecoveryUntil?.[i]??0,aiRetreat:snapshot?.unitAiRetreat?.[i]??false,centerEntryRound:snapshot?.unitCenterEntryRound?.[i]??null,emergencyReentryRound:snapshot?.unitEmergencyReentryRound?.[i]??null}));
  const events=snapshot?.eventTraits??r.initialEventTraits??[];
  return {...r,eventTraits:events,asteroids:snapshot?.asteroids??[],rules:{...r.rules,eventTraits:events},selectedRound:round,completedRounds:round,rngState:snapshot?.rngState??(round?r.rngState:r.seed),units,...results(units,r.sides)};
}
return {stats,types,createBattle,nextRound,simulate,summarize,legalTargets,legalMoves,personalities,traits,shipTraits,eventTraits,cleanupThresholds,commander,resolveCommanders,disobedienceChance,counts};
});

;
/* ship-types.js */
'use strict';
(()=>{const $=id=>document.getElementById(id);let types=[];const section=document.createElement('section');section.id='ship-types-editor';const heading=document.createElement('div');heading.className='editor-section-title';heading.textContent='СОСТАВ ФЛОТА · ТИПЫ КОРАБЛЕЙ';const list=document.createElement('div'),add=document.createElement('button');add.type='button';add.className='primary-btn';add.textContent='＋ Добавить тип кораблей';section.append(heading,list,add);$('fleet-fields').append(section);const labels={count:'Количество',hp:'HP',attackMin:'Атака от',attackMax:'Атака до',defenseMin:'Защита от',defenseMax:'Защита до'};

const shipTraitIds=['repair_drones','force_shields','warp_jump'];
const fallbackTraits={repair_drones:{name:'Ремонтные дроны',description:'Восстановление корабля в собственном тылу.'},force_shields:{name:'Силовые щиты',description:'Защитный щит после пребывания в собственном тылу.'},warp_jump:{name:'Варп-прыжок',description:'Прямое перемещение между секторами.'}};
function shipTraits(){return window.BattleEngine.shipTraits||fallbackTraits;}
function effectText(text){const fragment=document.createDocumentFragment(),value=String(text||''),pattern=/[+−–-]?\d+(?:[.,]\d+)?\s*%?/g;let last=0;for(const match of value.matchAll(pattern)){fragment.append(document.createTextNode(value.slice(last,match.index)));const span=document.createElement('span');span.className='trait-number-v44';span.textContent=match[0].trimEnd();fragment.append(span,document.createTextNode(match[0].slice(span.textContent.length)));last=match.index+match[0].length;}fragment.append(document.createTextNode(value.slice(last)));return fragment;}
function traitCard(id){const trait=shipTraits()[id];const card=document.createElement('div');card.className='ship-trait-card commander-trait';const title=document.createElement('strong');title.textContent=trait.name||id;card.append(title);for(const [key,label,items] of [['bonus','Преимущества',trait.bonusItems||[trait.bonus||trait.description||'']],['downside','Недостатки',trait.downsideItems||[trait.downside||'']],['limitation-v44','Ограничения',trait.limitationItems||[]]]){const values=items.filter(Boolean);if(!values.length)continue;const ul=document.createElement('ul');ul.className='trait-'+key+' trait-effects-v44';ul.setAttribute('aria-label',label);for(const text of values){const li=document.createElement('li');li.append(effectText(text));ul.append(li);}card.append(ul);}for(const [key,label] of [['scope','Где: '],['duration','Когда: ']]){if(!trait[key])continue;const p=document.createElement('p');p.className='trait-'+key;p.append(effectText(label+trait[key]));card.append(p);}return card;}
function traitChoices(t){const field=document.createElement('fieldset'),legend=document.createElement('legend'),grid=document.createElement('div');legend.textContent='Черты типа кораблей';grid.className='ship-trait-grid';for(const id of shipTraitIds){const label=document.createElement('label');label.className='ship-trait-choice';const input=document.createElement('input');input.type='checkbox';input.value=id;input.checked=(t.traits||[]).includes(id);input.setAttribute('aria-label',shipTraits()[id].name);input.onchange=()=>{t.traits=shipTraitIds.filter(key=>key===id?input.checked:(t.traits||[]).includes(key));};label.append(input,traitCard(id));grid.append(label);}field.append(legend,grid);return field;}
function readTypes(f){const normalized=BattleEngine.types(f);return normalized.map((t,i)=>({...t,traits:[...(f.shipTypes?.[i]?.traits??t.traits??[])]}));}

function render(){list.replaceChildren();types.forEach((t,i)=>{const card=document.createElement('article');card.className='ship-type-form';const name=document.createElement('input');name.value=t.name;name.maxLength=100;name.placeholder='Название типа';name.setAttribute('aria-label','Название типа кораблей');name.oninput=()=>t.name=name.value;const remove=document.createElement('button');remove.type='button';remove.textContent='Удалить тип';remove.className='primary-btn';remove.disabled=types.length===1;remove.onclick=()=>{types.splice(i,1);render();};card.append(name);const modelLabel=document.createElement('label');modelLabel.textContent='Модель корабля';const model=document.createElement('select');model.className='ship-model-choice';model.append(new Option('Малый','small'),new Option('Средний','medium'),new Option('Большой','large'));model.value=t.model||'medium';model.onchange=()=>t.model=model.value;modelLabel.append(model);card.append(modelLabel);const grid=document.createElement('div');grid.className='editor-grid';for(const [key,label] of Object.entries(labels)){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type='number';input.dataset.stat=key;input.value=t[key];input.min=key==='hp'?10:0;input.max=key==='count'?500:key==='hp'?100:1000;input.oninput=()=>t[key]=Number(input.value);l.append(input);grid.append(l);}const multi=document.createElement('label');multi.className='multiattack-label';const check=document.createElement('input');check.type='checkbox';check.checked=t.multiAttack===true;check.dataset.multi='enabled';const attacks=document.createElement('input');attacks.type='number';attacks.min=2;attacks.step=1;attacks.value=t.attacks>=2?t.attacks:2;attacks.disabled=!check.checked;attacks.dataset.multi='count';attacks.setAttribute('aria-label','Количество мультиатак');check.onchange=()=>{t.multiAttack=check.checked;t.attacks=check.checked?Number(attacks.value):1;attacks.disabled=!check.checked;};attacks.oninput=()=>t.attacks=Number(attacks.value);multi.append(check,document.createTextNode('Мультиатака'),attacks);card.append(grid,multi,traitChoices(t),remove);list.append(card);});add.disabled=types.length>=20;}
add.onclick=()=>{types.push({id:crypto.randomUUID(),name:'Новый тип',traits:[],count:10,hp:10,attackMin:5,attackMax:20,defenseMin:5,defenseMax:20});render();};
document.addEventListener('fleet-form-open',e=>{if(e.detail.type!=='fleet')return;types=readTypes(e.detail.item||{}).map(t=>({...t,hp:Math.max(10,t.hp)}));render();requestAnimationFrame(()=>{$('fleet-fields').querySelector('.editor-grid').hidden=true;});});window.shipTypeEditor={read:()=>{if(types.some(t=>!Number.isInteger(t.hp)||t.hp<10))throw Error('HP типа кораблей: минимум 10.');return readTypes({shipTypes:types});},traits:shipTraits};
const details=document.createElement('section');details.id='ship-type-dossier';$('description-panel').before(details);document.addEventListener('galaxy-selection',e=>{details.replaceChildren();if(!e.detail.isFleet)return;for(const t of BattleEngine.types(e.detail)){const card=document.createElement('article');card.className='ship-type-summary';const name=document.createElement('strong');name.textContent=t.name;const values=document.createElement('p');values.textContent=`${t.count} кораблей · HP ${t.hp} · Атака ${t.attackMin}–${t.attackMax} · Защита ${t.defenseMin}–${t.defenseMax} · Атак за раунд: ${t.multiAttack?t.attacks:1}`;card.append(name,values);const traitList=document.createElement('div');traitList.className='ship-trait-grid';for(const id of t.traits||[])traitList.append(traitCard(id));card.append(traitList);details.append(card);}});
})();

;
/* system-objects.js */
'use strict';
(()=>{const $=id=>document.getElementById(id),app=window.galaxyApp;const kinds={planet:'Планета',star:'Звезда',gas:'Газовый гигант',artificial:'Искусственный объект',moon:'Спутник',asteroids:'Пояс Астероидов',blackhole:'Чёрная дыра',nebula:'Туманность'},features={landmark:'Интересное место',city:'Город',base:'База',ruins:'Руины',mine:'Шахта',mineral:'Минералы',energy:'Энергия',water:'Вода',biology:'Биоресурсы',industry:'Промышленность'};const drawings={planet:'<circle cx="12" cy="12" r="8"/><path d="M5 10c5 0 6 6 12 5M10 4l2 5-3 3"/>',star:'<circle cx="12" cy="12" r="4"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4M4 4l3 3m10 10 3 3M4 20l3-3M17 7l3-3"/>',gas:'<circle cx="12" cy="12" r="7"/><ellipse cx="12" cy="12" rx="11" ry="3" transform="rotate(-25 12 12)"/>',artificial:'<path d="M8 8h8v8H8zM2 8h4v8H2zm16 0h4v8h-4zM12 3v5m0 8v5M8 12H6m10 0h2"/>',moon:'<path d="M16 3a9 9 0 1 0 5 15A9 9 0 0 1 16 3Z"/>',asteroids:'<path d="m4 5 5-2 3 5-4 4-6-2Zm11 8 5-2 2 6-5 4-4-3Z"/><circle cx="16" cy="5" r="1"/>',blackhole:'<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="6"/><path d="M3 8c4-7 14-7 18 1M3 16c4 7 14 7 18-1"/>',nebula:'<path d="M5 17c-8-6 0-14 7-10 6-6 14 3 8 8 0 6-12 7-15 2Z"/>',landmark:'<path d="m12 3 8 8-8 10-8-10Z"/><circle cx="12" cy="11" r="2"/>',city:'<path d="M3 21V10h5V4h7v9h6v8ZM11 7h1m-1 4h1m-1 4h1"/>',base:'<path d="M3 21V11l9-8 9 8v10ZM9 21v-7h6v7"/>',ruins:'<path d="M3 20h18M5 20V7h4v13m6 0V7h4v13M3 7l9-4 9 4"/>',mine:'<path d="M3 20V11l9-7 9 7v9Zm5 0v-7h8v7M2 3l18 18M4 2l-2 4"/>',mineral:'<path d="m12 2 8 7-3 12H7L4 9Zm0 0v19M4 9h16"/>',energy:'<path d="m14 2-9 12h6l-1 8 9-13h-6Z"/>',water:'<path d="M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13Z"/>',biology:'<path d="M5 20c0-9 1-14 15-16-1 12-4 16-12 13M4 21 17 8"/>',industry:'<path d="M3 21V10l6 4v-4l6 4V4h4v17ZM6 18h1m4 0h1m4 0h1"/>'};function icon(type){const span=document.createElement('span');span.className='system-object-icon';span.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+drawings[type]+'</svg>';return span;}const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
function normalize(objects){if(objects==null)return [];if(!Array.isArray(objects)||objects.length>100)throw Error('Максимум 100 объектов в системе.');const ids=new Set();return objects.map(o=>{if(typeof o.id!=='string'||ids.has(o.id)||!kinds[o.type]||typeof o.name!=='string'||!o.name.trim()||o.name.length>160||typeof o.description!=='string'||o.description.length>20000||!/^#[0-9a-f]{6}$/i.test(o.color)||(o.faction!=null&&!app.getData().groups.some(g=>g.key===o.faction)))throw Error('Неверные данные объекта системы.');ids.add(o.id);if(!Array.isArray(o.features)||o.features.length>100)throw Error('Максимум 100 мест/ресурсов.');const featureIds=new Set();const fs=o.features.map(f=>{if(typeof f.id!=='string'||featureIds.has(f.id)||!features[f.icon]||typeof f.name!=='string'||!f.name.trim()||f.name.length>160||typeof f.description!=='string'||f.description.length>10000)throw Error('Неверные данные места или ресурса.');featureIds.add(f.id);return {id:f.id,icon:f.icon,name:f.name,description:f.description};});return {id:o.id,type:o.type,name:o.name,description:o.description,color:o.color,faction:o.faction||null,features:fs};});}
window.SystemObjects={normalize};let systemId=null,draft=[];const section=el('section',null,'system-contents');section.id='system-contents';$('description-panel').after(section);
function render(item){section.replaceChildren();section.hidden=!item||item.isFleet||item.isEvent;if(section.hidden)return;const header=el('div',null,'contents-header');header.append(el('span','ОБЪЕКТЫ СИСТЕМЫ','eyebrow'));const edit=el('button','✎ Состав системы','primary-btn');edit.id='edit-system-objects';edit.onclick=()=>open(item);section.append(header);for(const o of item.objects||[]){const details=el('details',null,'system-object-card');details.style.setProperty('--object-color',o.color);const summary=el('summary');summary.append(icon(o.type),el('span',o.name,'object-name'),el('span','⌄','object-chevron'));details.append(summary);const affiliation=app.getData().groups.find(g=>g.key===o.faction)?.label||'Без принадлежности';details.append(el('small',kinds[o.type]+' · '+affiliation,'object-meta'),el('p',o.description,'object-description'));for(const f of o.features){const feature=el('details',null,'system-feature');const head=el('summary');head.append(icon(f.icon),el('span',f.name,'object-name'),el('span','⌄','object-chevron'));feature.append(head,el('p',f.description,'object-description'));details.append(feature);}section.append(details);}if(!(item.objects||[]).length)section.append(el('small','Объекты пока не добавлены.','object-meta'));}
document.addEventListener('galaxy-selection',e=>render(e.detail));
const modal=el('dialog');modal.id='system-objects-dialog';modal.innerHTML='<div class="dialog-head"><span class="eyebrow">СОСТАВ СИСТЕМЫ</span><button id="system-objects-close" class="icon-btn" aria-label="Закрыть редактор объектов">×</button></div><h2 id="system-objects-title"></h2><div id="system-objects-forms"></div><button id="system-object-add" class="primary-btn">＋ Добавить объект</button><button id="system-objects-save" class="primary-btn">Сохранить состав</button><p id="system-objects-error" role="alert"></p>';document.body.append(modal);
function select(label,value,options,change){const l=el('label',label),s=el('select');for(const [key,text] of Object.entries(options))s.append(new Option(text,key));s.value=value||'';s.onchange=()=>change(s.value);l.append(s);return l;}function input(label,value,change,multiline=false,max=160){const l=el('label',label),i=el(multiline?'textarea':'input');i.value=value;i.maxLength=max;i.oninput=()=>change(i.value);if(multiline)i.rows=3;l.append(i);return l;}
function forms(){const list=$('system-objects-forms');const states=new Map([...list.querySelectorAll('details')].map(d=>[d.dataset.objectId||d.dataset.featureId,d.open]));list.replaceChildren();draft.forEach((o,index)=>{const card=el('details',null,'object-form-card');card.open=states.get(o.id)??true;const summary=el('summary',kinds[o.type]+' · '+o.name);card.append(summary);card.dataset.objectId=o.id;const grip=el('span','⠿','object-grip');grip.draggable=false;grip.title='Перетащить объект';grip.setAttribute('aria-label','Перетащить объект');summary.prepend(grip);grip.ondragstart=e=>{e.stopPropagation();e.dataTransfer.setData('application/x-galaxy-object',o.id);};card.ondragover=e=>{e.preventDefault();e.stopPropagation();card.classList.add('object-drop-target');};card.ondragleave=()=>card.classList.remove('object-drop-target');card.ondrop=e=>{e.preventDefault();e.stopPropagation();const fid=e.dataTransfer.getData('application/x-galaxy-feature'),oid=e.dataTransfer.getData('application/x-galaxy-object');if(fid){for(const source of draft){const f=source.features.find(f=>f.id===fid);if(f){source.features=source.features.filter(f=>f.id!==fid);o.features.push(f);break;}}}else if(oid&&oid!==o.id){const from=draft.findIndex(i=>i.id===oid),to=draft.findIndex(i=>i.id===o.id);if(from>=0){const moved=draft.splice(from,1)[0];draft.splice(to,0,moved);}}forms();};card.append(select('Тип',o.type,kinds,v=>{o.type=v;summary.childNodes[1].textContent=kinds[o.type]+' · '+o.name;}),input('Название',o.name,v=>{o.name=v;summary.childNodes[1].textContent=kinds[o.type]+' · '+o.name;}),select('Принадлежность',o.faction,{'':'Без принадлежности',...Object.fromEntries(app.getData().groups.map(g=>[g.key,g.label]))},v=>{o.faction=v||null;const g=app.getData().groups.find(g=>g.key===v);if(g){o.color=g.color;card.querySelector('input[type=color]').value=g.color;}}));const color=input('Цвет',o.color,v=>o.color=v);color.querySelector('input').type='color';card.append(color,input('Описание',o.description,v=>o.description=v,true,20000));for(const f of o.features){const feature=el('details',null,'feature-form-card');feature.open=states.get(f.id)??true;const fs=el('summary','Место / ресурс · '+f.name),fg=el('span','⠿','object-grip');fg.draggable=false;fg.title='Перенести место / ресурс в другой объект';fg.ondragstart=e=>{e.stopPropagation();e.dataTransfer.setData('application/x-galaxy-feature',f.id);};fs.prepend(fg);feature.dataset.featureId=f.id;feature.append(fs,select('Иконка',f.icon,features,v=>f.icon=v),input('Название',f.name,v=>f.name=v),input('Описание',f.description,v=>f.description=v,true,10000));const remove=el('button','Удалить место / ресурс','primary-btn');remove.onclick=()=>{o.features=o.features.filter(i=>i!==f);forms();};feature.append(select('Перенести в объект',o.id,Object.fromEntries(draft.map((item,i)=>[item.id,item.name||'Объект '+(i+1)])),v=>{const target=draft.find(t=>t.id===v);if(target&&target!==o){o.features=o.features.filter(i=>i!==f);target.features.push(f);forms();}}));feature.append(remove);card.append(feature);}const add=el('button','＋ Место или ресурс','primary-btn');add.onclick=()=>{o.features.push({id:crypto.randomUUID(),icon:'landmark',name:'',description:''});forms();};const remove=el('button','Удалить объект','primary-btn');remove.onclick=()=>{if(confirm('Удалить объект вместе с местами и ресурсами?')){draft=draft.filter(i=>i!==o);forms();}};const order=el('div',null,'object-order-controls');for(const [label,delta] of [['↑ Выше',-1],['↓ Ниже',1]]){const button=el('button',label,'primary-btn');button.disabled=index+delta<0||index+delta>=draft.length;button.onclick=()=>{const moved=draft.splice(index,1)[0];draft.splice(index+delta,0,moved);forms();};order.append(button);}card.append(order,add,remove);card.querySelectorAll('button').forEach(b=>b.type='button');list.append(card);});}
function open(item){$('system-objects-forms').replaceChildren();systemId=item.id;draft=JSON.parse(JSON.stringify(item.objects||[]));$('system-objects-title').textContent=item.name;$('system-objects-error').textContent='';forms();modal.showModal();}$('system-object-add').onclick=()=>{draft.push({id:crypto.randomUUID(),type:'planet',name:'',description:'',faction:null,color:'#78dfea',features:[]});forms();};$('system-objects-save').onclick=()=>{try{const objects=normalize(draft),data=app.getData(),system=data.systems.find(s=>String(s.id)===String(systemId));if(!system)throw Error('Система больше не существует.');system.objects=objects;app.replaceData(data);window.galaxyEditor.save();app.selectId(system.id);modal.close();}catch(e){$('system-objects-error').textContent=e.message;}};$('system-objects-close').onclick=()=>modal.close();
window.SystemObjects.begin=item=>{draft=JSON.parse(JSON.stringify(item?.objects||[]));$('system-objects-forms').replaceChildren();forms();};window.SystemObjects.read=()=>normalize(draft);window.SystemObjects.move=(objectId,featureId,targetId)=>{const src=draft.find(o=>o.id===objectId),dst=draft.find(o=>o.id===targetId);if(!src||!dst||src===dst)return;if(featureId){const f=src.features.find(f=>f.id===featureId);if(!f)return;src.features=src.features.filter(i=>i!==f);dst.features.push(f);}else{const from=draft.indexOf(src),to=draft.indexOf(dst);draft.splice(from,1);draft.splice(to,0,src);}forms();};const embedded=el('section');embedded.id='system-composition-editor';const title=el('div',null,'composition-heading');title.append(el('span','ОБЪЕКТЫ СИСТЕМЫ','eyebrow'));const collapse=el('button','Свернуть все','primary-btn');collapse.id='system-collapse-all';collapse.type='button';collapse.onclick=()=>{const ds=[...$('system-objects-forms').querySelectorAll('details')],close=ds.some(d=>d.open);ds.forEach(d=>d.open=!close);collapse.textContent=close?'Развернуть все':'Свернуть все';};title.append(collapse);embedded.append(title,$('system-objects-forms'),$('system-object-add'));embedded.querySelectorAll('button').forEach(b=>b.type='button');$('object-save').before(embedded);const launch=el('button','✎ Объекты системы','primary-btn');launch.id='editor-system-objects';$('editor-dashboard').querySelector('.editor-grid').append(launch);new MutationObserver(()=>{const s=app.getSelected();launch.disabled=!s||s.isFleet||s.isEvent;}).observe($('admin-dialog'),{attributes:true,attributeFilter:['open']});launch.onclick=()=>{const s=app.getSelected();if(!s||s.isFleet||s.isEvent)return;$('admin-dialog').close();open(s);};
})();

;
/* fleet-command.js */
'use strict';
(()=>{
const $=id=>document.getElementById(id),app=window.galaxyApp,section=document.createElement('section');section.id='fleet-commander-editor';section.innerHTML='<div class="editor-section-title">КОМАНДУЮЩИЙ ФЛОТОМ</div><label>Категория командующего<select id="commander-registry-faction"></select></label><label for="commander-registry-search">Поиск командующего по имени</label><div class="commander-search-scanner"><svg viewBox="0 0 24 24" role="img" aria-label="Сканер поиска"><circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6M4 10h12M10 4v12"/></svg><input id="commander-registry-search" type="search" maxlength="100" placeholder="Имя · поиск по всем фракциям" aria-label="Поиск командующего по имени" aria-controls="commander-registry-select" autocomplete="off"></div><label>Командующий<select id="commander-registry-select"></select></label><div id="commander-registry-preview"></div><div id="commander-legacy"><label class="check-label"><input type="checkbox" id="commander-enabled"> Старый командующий (локально)</label><div id="commander-fields"><label>Имя<input id="commander-name" maxlength="100"></label><label>Характер<select id="commander-personality"></select></label><label>Уровень · 1–10<input id="commander-legacy-level" type="number" min="1" max="10" step="1" value="5"></label><p id="commander-description"></p><button type="button" id="commander-migrate">Добавить в реестр</button></div></div>';$('fleet-fields').append(section);
let original=null,legacy=null;
function levelBadge(c){const span=document.createElement('span');span.className='commander-level';span.textContent='Уровень '+(c.level??5);return span;}
const descriptions=()=>window.BattleEngine.personalities||{};
function refresh(){const id=$('commander-registry-select').value,c=(app.getData().commanders||[]).find(c=>c.id===id);$('commander-legacy').hidden=id!=='legacy';$('commander-fields').hidden=!$('commander-enabled').checked;$('commander-description').textContent=descriptions()[$('commander-personality').value]?.description||'';$('commander-registry-preview').replaceChildren();if(c){const heading=document.createElement('p');heading.textContent=descriptions()[c.personality]?.name||c.personality;const cards=document.createElement('div');cards.className='registry-trait-grid';cards.innerHTML=window.CommanderRegistry?.traitHTML(c.traits)||'';$('commander-registry-preview').append(levelBadge(c),heading,cards);}}
function candidates(preferred){const d=app.getData(),category=$('commander-registry-faction').value,query=$('commander-registry-search').value.trim().toLocaleLowerCase();const all=d.commanders||[],list=all.filter(c=>query?c.name.toLocaleLowerCase().includes(query):category==='all'||(c.factionGroup||'')===category);const selected=all.find(c=>c.id===preferred);if(selected&&!list.some(c=>c.id===preferred))list.unshift(selected);$('commander-registry-select').replaceChildren(new Option('Без командующего',''),...(legacy?[new Option('Сохранить старого командующего','legacy')]:[]),...list.map(c=>{const group=d.groups.find(g=>g.key===c.factionGroup);return new Option(c.name+' · '+(group?.label||'Без принадлежности')+(query&&!c.name.toLocaleLowerCase().includes(query)?' · выбран':''),c.id);}));$('commander-registry-select').value=[...$('commander-registry-select').options].some(o=>o.value===preferred)?preferred:'';refresh();}
function factionChanged(){const d=app.getData(),category=$('commander-registry-faction').value||'all';$('commander-registry-faction').replaceChildren(new Option('Все фракции · любой флот','all'),new Option('Без принадлежности',''),...d.groups.map(g=>new Option(g.label,g.key)));$('commander-registry-faction').value=[...$('commander-registry-faction').options].some(o=>o.value===category)?category:'all';candidates($('commander-registry-select').value);}
document.addEventListener('fleet-form-open',e=>{if(e.detail.type!=='fleet')return;original=e.detail.item;legacy=original?.commander||null;$('commander-personality').replaceChildren(...Object.entries(descriptions()).map(([k,v])=>new Option(v.name,k)));$('commander-enabled').checked=!!legacy;$('commander-name').value=legacy?.name||'';$('commander-personality').value=legacy?.personality||'balanced';$('commander-legacy-level').value=legacy?.level??5;$('commander-registry-search').value='';$('commander-registry-faction').value='all';factionChanged();candidates(original?.commanderId||(legacy?'legacy':''));});
$('commander-registry-search').oninput=()=>candidates($('commander-registry-select').value);$('object-fleet-group').addEventListener('change',factionChanged);$('commander-registry-faction').onchange=()=>candidates($('commander-registry-select').value);$('commander-registry-select').onchange=refresh;$('commander-enabled').onchange=refresh;$('commander-personality').onchange=refresh;
function read(){if($('commander-registry-select').value!=='legacy'||!$('commander-enabled').checked)return null;return {...legacy,...BattleEngine.commander({commander:{...legacy,name:$('commander-name').value.trim(),personality:$('commander-personality').value,level:Number($('commander-legacy-level').value)}}),...(legacy?.traits?{traits:[...legacy.traits]}:{})};}
window.fleetCommandEditor={read,readFields:()=>{const id=$('commander-registry-select').value;if(id&&id!=='legacy'){const d=app.getData(),c=(d.commanders||[]).find(c=>c.id===id);if(!c)throw Error('Командующий отсутствует в реестре.');return {commanderId:id,commander:original?.commander||null};}return {commanderId:null,commander:read()};}};
$('commander-migrate').onclick=()=>{try{const c=read();if(!c)return;const d=app.getData(),id='cmd-'+crypto.randomUUID();d.commanders=[...(d.commanders||[]),{...c,id,factionGroup:$('object-fleet-group').value||null,traits:c.traits||[]}];app.replaceData({...d,...window.galaxyEditor.normalize({...d,version:7})});window.galaxyEditor.save();candidates(id);}catch(e){$('object-error').textContent=e.message;}};
const report=document.createElement('section');report.id='commander-dossier';$('description-panel').before(report);
const detail=document.createElement('aside');detail.id='commander-trait-detail';detail.hidden=true;detail.setAttribute('role','dialog');detail.setAttribute('aria-labelledby','commander-trait-detail-title');document.body.append(detail);
let activeTrait=null,hoverTimer=null;
function dismissDetail(){clearTimeout(hoverTimer);if(activeTrait){activeTrait.setAttribute('aria-expanded','false');activeTrait.removeAttribute('aria-controls');}activeTrait=null;detail.hidden=true;}
function showDetail(button){const trait=window.BattleEngine.traits[button.dataset.traitId];if(!trait)return;dismissDetail();activeTrait=button;button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',detail.id);detail.replaceChildren();const head=document.createElement('header'),title=document.createElement('strong'),close=document.createElement('button');title.id='commander-trait-detail-title';title.textContent=trait.name;close.type='button';close.textContent='×';close.setAttribute('aria-label','Закрыть описание черты');close.onclick=()=>{const target=activeTrait;dismissDetail();target?.focus({preventScroll:true});dismissDetail();};head.append(title,close);detail.append(head);for(const [label,value,key] of [['Преимущество',trait.bonus,'bonus'],['Недостаток',trait.downside,'downside'],['Где действует',trait.scope,'scope'],['Длительность',trait.duration,'duration']]){const p=document.createElement('p'),caption=document.createElement('strong');p.className='trait-detail-'+key;caption.textContent=label+': ';p.append(caption,document.createTextNode(value||'—'));detail.append(p);}detail.hidden=false;const viewport=window.visualViewport,offsetX=viewport?.offsetLeft||0,offsetY=viewport?.offsetTop||0,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight,margin=12;detail.style.maxWidth=Math.max(0,width-margin*2)+'px';detail.style.maxHeight=Math.max(0,height-margin*2)+'px';const box=detail.getBoundingClientRect(),anchor=button.getBoundingClientRect(),dossierBox=$('inspector').getBoundingClientRect();let left=dossierBox.left-box.width-14;if(width<720||left<offsetX+margin)left=offsetX+(width-box.width)/2;const top=Math.min(offsetY+height-box.height-margin,Math.max(offsetY+margin,anchor.top));detail.style.left=Math.max(offsetX+margin,Math.min(left,offsetX+width-box.width-margin))+'px';detail.style.top=top+'px';}
const paths=['M12 3 4 7v5c0 4 8 9 8 9s8-5 8-9V7z','m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z','M5 5h14v14H5z M9 8v8 M15 8v8','m5 19 14-14 M5 5h14v14','M3 12h18 M12 3v18 M5 5l14 14','M20 12H4m6-6-6 6 6 6','M5 17 12 4l7 13z M8 20h8','M4 6h16 M4 12h16 M4 18h16'];
function compactTraits(ids){const rows=document.createElement('div');rows.className='commander-trait-rows';for(const id of ids||[]){const t=window.BattleEngine.traits[id];if(!t)continue;const button=document.createElement('button');button.type='button';button.className='commander-trait-row';button.dataset.traitId=id;button.setAttribute('aria-expanded','false');button.setAttribute('aria-haspopup','dialog');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',paths[Object.keys(window.BattleEngine.traits).indexOf(id)%paths.length]);svg.append(path);const label=document.createElement('span');label.textContent=t.name;button.append(svg,label);button.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')showDetail(button);});button.addEventListener('pointerleave',()=>{hoverTimer=setTimeout(()=>{if(!detail.matches(':hover')&&document.activeElement!==button&&!detail.contains(document.activeElement))dismissDetail();},180);});button.addEventListener('focus',()=>showDetail(button));button.addEventListener('click',()=>showDetail(button));rows.append(button);}return rows;}
function dossier(item){dismissDetail();report.replaceChildren();if(!item?.isFleet)return;const c=window.CommanderRegistry?window.CommanderRegistry.resolveFleet(item,app.getData()).commander:item.commander,title=document.createElement('strong');title.textContent=c?c.name:'Без командующего';report.append(title);if(c){report.append(levelBadge(c));if(c.description){const desc=document.createElement('p');desc.className='commander-author-description';desc.textContent=c.description;report.append(desc);}report.append(compactTraits(c.traits));}}
detail.addEventListener('pointerenter',()=>clearTimeout(hoverTimer));detail.addEventListener('pointerleave',()=>{if(!detail.contains(document.activeElement)&&document.activeElement!==activeTrait)dismissDetail();});document.addEventListener('focusin',e=>{if(activeTrait&&e.target!==activeTrait&&!detail.contains(e.target))dismissDetail();});document.addEventListener('pointerdown',e=>{if(activeTrait&&!detail.contains(e.target)&&e.target.closest('.commander-trait-row')!==activeTrait)dismissDetail();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!detail.hidden){e.preventDefault();e.stopImmediatePropagation();dismissDetail();}},true);document.addEventListener('scroll',e=>{if(!detail.contains(e.target))dismissDetail();},true);window.addEventListener('resize',dismissDetail);window.visualViewport?.addEventListener('resize',dismissDetail);window.visualViewport?.addEventListener('scroll',dismissDetail);document.addEventListener('galaxy-data-changed',()=>dossier(app.getSelected()));document.addEventListener('click',()=>{if($('inspector').hidden||$('inspector').dataset.closing==='true')dismissDetail();});new MutationObserver(()=>{if($('inspector').hidden||$('inspector').dataset.closing==='true'||$('inspector').classList.contains('folded'))dismissDetail();}).observe($('inspector'),{attributes:true,attributeFilter:['hidden','data-closing','class']});
document.addEventListener('galaxy-selection',e=>dossier(e.detail));document.addEventListener('commander-registry-ready',()=>dossier(app.getSelected()));
})();

;
/* editor.js */
'use strict';
(() => {
const app=window.galaxyApp,$=id=>document.getElementById(id),base=app.getData(),draftKey='ugalaxy-draft-v7';
// Legacy templates may still contain this retired field; never expose or require it.
const fleetHP=$('fleet-hp');if(fleetHP){fleetHP.min='10';fleetHP.defaultValue='10';fleetHP.value='10';}
const legacyFleetType=$('object-fleet-type');if(legacyFleetType){legacyFleetType.required=false;legacyFleetType.disabled=true;(legacyFleetType.closest('label')||legacyFleetType).hidden=true;}
// app.js owns map fields; retain registry snapshots at its public boundary.
let commanderSnapshot=Array.isArray(base.commanders)?base.commanders:[];
const mapCollections=new Set(['systems','events','fleets','groups','commanders','territories','version']);
let metadataSnapshot=Object.fromEntries(Object.entries(base).filter(([key])=>!mapCollections.has(key)));
const originalGet=app.getData,originalReplace=app.replaceData;
app.getData=()=>({...originalGet(),...clone(metadataSnapshot),commanders:clone(commanderSnapshot)});
app.replaceData=next=>{commanderSnapshot=clone(next.commanders||[]);metadataSnapshot={...metadataSnapshot,...clone(Object.fromEntries(Object.entries(next).filter(([key])=>!mapCollections.has(key))))};originalReplace(next);};
const traitIds=['inspiring_leader','decisive_assault','iron_discipline','reckless_charge','protective_screen','orderly_withdrawal','seasoned_crew','independent_captains'];
function commanderCosmetics(c){if(window.CommanderRegistry)return window.CommanderRegistry.cosmetics(c);const description=c.description===undefined?'':c.description,portrait=c.portrait==null?null:c.portrait;if(typeof description!=='string'||description.length>1200)throw Error('Описание командующего: не более 1200 символов.');if(portrait!==null&&(typeof portrait!=='string'||portrait.length>600000||!/^data:image\/(png|jpeg|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(portrait)||!portrait.split(',')[1]))throw Error('Портрет: PNG, JPEG или WebP, не более 600 КБ.');return {description,portrait};}
function validateTraits(value){if(!Array.isArray(value)||value.length>4)throw Error('Выберите не более четырёх черт.');if(new Set(value).size!==value.length||value.some(id=>!Object.hasOwn(window.BattleEngine.traits||Object.fromEntries(traitIds.map(id=>[id,true])),id)))throw Error('Неизвестная или повторная черта командующего.');return [...value];}
function normalizeCommanders(list,groups){if(window.CommanderRegistry)return window.CommanderRegistry.normalize(list,groups);if(list==null)return [];if(!Array.isArray(list)||list.length>2000)throw Error('Неверный реестр командующих.');const ids=new Set(),keys=new Set(groups.map(g=>g.key));return list.map(c=>{if(!c||typeof c.id!=='string'||!c.id.trim()||c.id.length>160||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>100||(c.factionGroup!=null&&!keys.has(c.factionGroup))||!BattleEngine.personalities[c.personality])throw Error('Некорректный командующий.');ids.add(c.id);return {...c,name:c.name.trim(),factionGroup:c.factionGroup||null,traits:validateTraits(c.traits),level:BattleEngine.commander({commander:c}).level,...commanderCosmetics(c)};});}
let editing=null,kind='system',picking=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
function validateGroups(list){if(window.FactionManager)return window.FactionManager.validate(list);
 if(!Array.isArray(list)||!list.length||list.length>500)throw Error('Неверный список фракций (1–500).');
 const keys=new Set(),names=new Set();
 const clean=list.map(g=>{if(!g||typeof g.key!=='string'||!g.key.trim()||g.key.length>160||keys.has(g.key))throw Error('Неизвестный или повторный ключ фракции.');if(typeof g.label!=='string'||!g.label.trim()||g.label.length>100)throw Error('Название фракции: 1–100 символов.');const name=g.label.trim().toLocaleLowerCase('ru');if(names.has(name))throw Error('Фракция с таким названием уже существует.');if(typeof g.color!=='string'||!/^#[0-9a-f]{6}$/i.test(g.color))throw Error('Цвет фракции: #RRGGBB.');if(g.overlord!=null&&(typeof g.overlord!=='string'||!g.overlord))throw Error('Неверная фракция-сюзерен.');keys.add(g.key);names.add(name);return {...g,overlord:g.overlord??null};});
 const byKey=new Map(clean.map(g=>[g.key,g]));for(const g of clean){const seen=new Set([g.key]);let parent=g.overlord;while(parent!==null){if(!byKey.has(parent))throw Error('Фракция-сюзерен не существует.');if(seen.has(parent))throw Error('Подчинение фракций не может образовывать цикл или ссылаться на себя.');seen.add(parent);parent=byKey.get(parent).overlord;}}
 return clean;
}
// SystemObjects v22 validates against live groups; snapshot imports need incoming groups.
function normalizeObjects(objects,groups){const get=app.getData;app.getData=()=>({...get(),groups});try{return window.SystemObjects.normalize(objects,groups);}finally{app.getData=get;}}
function validateEventTraits(value){const dictionary=window.BattleEngine.eventTraits||window.BattleEngine.stageTraits||{};if(!Array.isArray(value)||new Set(value).size!==value.length||value.some(id=>typeof id!=='string'||!Object.hasOwn(dictionary,id)))throw Error('Неизвестная или повторная черта события.');return [...value];}
function preservePublished(collection,raw,clean){const published=base[collection]||[];return clean.map((item,index)=>{const source=raw[index],old=published.find(entry=>String(entry.id??entry.key)===String(source.id??source.key));if(old&&JSON.stringify(source)===JSON.stringify(old)){if(collection==='fleets')return {...clone(source),hp:item.hp,...(source.shipTypes?{shipTypes:source.shipTypes.map((t,i)=>({...clone(t),hp:item.shipTypes[i].hp}))}:{})};return clone(source);}return item;});}
function normalize(d){if(d?.version===4){d={version:6,systems:[...base.systems.filter(s=>!s.custom),...d.systems],events:base.events,fleets:[...base.fleets.filter(f=>!f.custom),...d.fleets]};}if(d?.version===6){const front=d.systems.find(s=>s.id===4);d={...d,version:7,systems:d.systems.filter(s=>s.id!==4),events:front?[{...front,color:'#ffb66a'}]:(d.events||[])};}if(!d||d.version!==7||!Array.isArray(d.systems)||!Array.isArray(d.events)||!Array.isArray(d.fleets)||d.systems.length+d.events.length>2000||d.fleets.length>4000)throw Error('Неверный формат черновика.');const groupList=validateGroups(d.groups||base.groups),groups=new Set(groupList.map(g=>g.key)),ids=new Set(),fleetIds=new Set();function point(s,event){const old=[...base.systems,...base.events].find(i=>String(i.id)===String(s.id));if(!((typeof s.id==='number'&&old)||(typeof s.id==='string'&&/^custom-[se]-[\w-]+$/.test(s.id)))||ids.has(String(s.id))||!(event?(s.group===null||s.group===''||groups.has(s.group)):groups.has(s.group))||!Number.isInteger(s.x)||!Number.isInteger(s.y)||s.x<0||s.x>2559||s.y<0||s.y>2047||typeof s.name!=='string'||!s.name.trim()||s.name.length>160||typeof s.description!=='string'||s.description.length>20000||(event&&!/^#[0-9a-f]{6}$/i.test(s.color)))throw Error('Некорректные данные объекта.');ids.add(String(s.id));return {...s,id:s.id,name:s.name,titleHtml:old&&old.name===s.name?old.titleHtml:esc(s.name),...(event?{}:{objects:normalizeObjects(s.objects,groupList)}),shortDescription:event?undefined:String(s.shortDescription||'').slice(0,600),description:s.description,descriptionHtml:old&&old.description===s.description?old.descriptionHtml:esc(s.description),x:s.x,y:s.y,group:event?(s.group||null):s.group,order:event?null:s.order==='0'?'0':typeof s.order==='string'&&/^last(?::\d+)?$/.test(s.order)?s.order:null,...(event?{color:s.color,eventType:s.eventType==='combat'?'combat':'information',...(s.eventTraits!==undefined?{eventTraits:validateEventTraits(s.eventTraits)}:{}),...(s.battle?{battle:s.battle}:{}),...(s.battles?{battles:s.battles}:{})}:{}),...(s.custom?{custom:true}:{})};}const commanders=normalizeCommanders(d.commanders,groupList);const systems=d.systems.map(s=>point(s,false)),events=d.events.map(s=>point(s,true));const fleets=d.fleets.map(source=>{const {type:legacyType,...f}=source;const old=base.fleets.find(i=>String(i.id)===String(f.id));if(typeof f.id!=='string'||!(old||/^custom-f-[\w-]+$/.test(f.id))||fleetIds.has(f.id)||!ids.has(String(f.system))||typeof f.name!=='string'||!f.name.trim()||f.name.length>160||typeof f.description!=='string'||f.description.length>20000)throw Error('Некорректные данные флота.');fleetIds.add(f.id);if(f.faction!=null&&!groups.has(f.faction))throw Error('Неизвестная фракция флота.');if(f.color!=null&&!/^#[0-9a-f]{6}$/i.test(f.color))throw Error('Неверный цвет флота.');if(f.commander){commanderCosmetics(f.commander);if(f.commander.traits)validateTraits(f.commander.traits);}if(f.commanderId!=null&&(typeof f.commanderId!=='string'||!commanders.some(c=>c.id===f.commanderId)))throw Error('Неизвестный командующий флота.');// Migrate authored maximum HP only; never touch stored battle-unit injuries.
for(const record of [f,...(f.shipTypes||[])])if(record.hp!==undefined&&(!Number.isInteger(record.hp)||record.hp<1||record.hp>100))throw Error('Некорректный параметр hp');
const authored={...f,hp:Math.max(10,f.hp??10),...(f.shipTypes?{shipTypes:f.shipTypes.map(t=>({...t,hp:Math.max(10,t.hp??10)}))}:{})};const combatStats={...BattleEngine.stats(authored),count:f.count??10};return {...f,commanderId:f.commanderId||null,id:f.id,system:f.system,name:f.name,description:f.description,...combatStats,...(f.commander?{commander:{...f.commander,...BattleEngine.commander({commander:f.commander}),...commanderCosmetics(f.commander),...(f.commander.traits?{traits:[...f.commander.traits]}:{})}}:{}),...(f.shipTypes?{shipTypes:BattleEngine.types(authored)}:{}),...(Object.prototype.hasOwnProperty.call(f,'faction')?{faction:f.faction||null}:{}),...(f.color?{color:f.color}:{}),offset:Math.max(18,Math.min(500,Number(f.offset)||18)),...(f.custom?{custom:true}:{})};});return {...d,version:7,groups:preservePublished('groups',d.groups||base.groups,groupList),commanders:preservePublished('commanders',d.commanders||[],commanders),systems:preservePublished('systems',d.systems,systems),events:preservePublished('events',d.events,events),fleets:preservePublished('fleets',d.fleets,fleets),territories:d.territories?TerritoryEngine.validate(d.territories,groupList):null};}
function currentDraft(){const d=app.getData();return {...d,version:7,commanders:d.commanders||[],systems:d.systems,events:d.events,fleets:d.fleets,territories:d.territories};}
function applyDraft(d){const clean=normalize(d);app.replaceData({...base,...clean});}
if(!window.GalaxyPublishedBase)window.GalaxyPublishedBase=clone(base);
try{const raw=localStorage.getItem(draftKey)||localStorage.getItem('ugalaxy-draft-v6')||localStorage.getItem('ugalaxy-draft-v4');if(raw)applyDraft(JSON.parse(raw));}catch(e){app.toast('Черновик не загружен: '+e.message);}
function saveDraft(){try{localStorage.setItem(draftKey,JSON.stringify(currentDraft()));return true;}catch{app.toast('Не удалось сохранить черновик. Экспортируйте резервную копию.');return false;}}
function dashboard(){const s=app.getSelected(),d=currentDraft();$('editor-edit').disabled=!s;$('editor-move').disabled=!s||s.isFleet;$('editor-delete').disabled=!s;$('editor-selected-name').textContent=s?s.name.trim():'Объект не выбран';$('editor-selected-type').textContent=s?(s.isFleet?'ФЛОТ · '+([...d.systems,...d.events].find(i=>String(i.id)===String(s.system))?.name.trim()||''):(s.isEvent?'СОБЫТИЕ':'СИСТЕМА')+' · X '+s.x+' / Y '+s.y):'Выберите систему или флот на карте';$('editor-status').textContent=`${d.systems.length} систем · ${d.events.length} событий · ${d.fleets.length} флотов`;}$('admin-toggle').onclick=()=>{dashboard();if(!$('admin-dialog').open)$('admin-dialog').showModal();};$('admin-close').onclick=()=>$('admin-dialog').close();
function openForm(type,item=null){kind=type;editing=item;const d=app.getData();$('object-form').reset();$('system-composition-editor').hidden=type!=='system';if(type==='system')window.SystemObjects.begin(item);$('object-error').textContent='';$('object-form-title').textContent=(item?'ИЗМЕНИТЬ ':'СОЗДАТЬ ')+(type==='fleet'?'ФЛОТ':type==='event'?'СОБЫТИЕ':'СИСТЕМУ');$('system-fields').hidden=type==='fleet';$('fleet-fields').hidden=type!=='fleet';$('object-x').required=$('object-y').required=type!=='fleet';$('object-x').disabled=$('object-y').disabled=type==='fleet';$('object-group').replaceChildren(...(type==='event'?[new Option('Без принадлежности','')]:[]),...d.groups.map(g=>new Option(g.label,g.key)));$('object-system').replaceChildren(...[...d.systems.map(s=>({...s,label:'Система: '})),...d.events.map(s=>({...s,label:'Событие: '}))].map(s=>new Option(s.label+s.name.trim(),String(s.id))));const selected=app.getSelected();if(selected)$('object-system').value=String(selected.isFleet?selected.system:selected.id);$('object-name').value=item?.name||'';$('object-description').value=item?.description||'';$('short-description-field').hidden=type!=='system';$('object-short-description').value=item?.shortDescription||'';$('object-x').value=item?.x??1280;$('object-y').value=item?.y??1024;$('object-group').value=type==='event'?(item?.factionGroup||((item?.group==='События')?'':item?.group)||''):(item?.group||'Нейтраные');$('object-capital').checked=item?.order==='0';$('object-capital').closest('label').hidden=type==='event';$('event-color-field').hidden=type!=='event';$('event-type-field').hidden=type!=='event';$('fleet-fields').querySelectorAll('input').forEach(i=>i.disabled=type!=='fleet');$('object-event-color').value=item?.color||'#ffb66a';$('object-event-type').value=item?.eventType||'information';if(type==='fleet'){$('object-system').value=String(item?.system??$('object-system').value);$('object-fleet-group').replaceChildren(new Option('Без принадлежности',''),...d.groups.map(g=>new Option(g.label,g.key)));$('object-fleet-group').value=Object.prototype.hasOwnProperty.call(item||{},'faction')?item.faction||'':([...d.systems,...d.events].find(s=>String(s.id)===String(item?.system))?.group||'');for(const [key,value] of Object.entries(BattleEngine.stats(item||{})))if($('fleet-'+key))$('fleet-'+key).value=key==='hp'?Math.max(10,value):key==='count'?(item?.count??10):value;$('object-fleet-color').value=d.groups.find(g=>g.key===$('object-fleet-group').value)?.color||item?.color||'#a8dce7';}document.dispatchEvent(new CustomEvent('fleet-form-open',{detail:{type,item}}));$('admin-dialog').close();$('object-dialog').showModal();}
$('object-group').addEventListener('change',()=>{if(kind!=='event')return;const group=app.getData().groups.find(g=>g.key===$('object-group').value);if(group)$('object-event-color').value=group.color;});
$('object-fleet-group').addEventListener('change',()=>{const g=app.getData().groups.find(g=>g.key===$('object-fleet-group').value);if(g)$('object-fleet-color').value=g.color;});
$('editor-new-system').onclick=()=>openForm('system');$('editor-new-fleet').onclick=()=>openForm('fleet');$('editor-new-event').onclick=()=>openForm('event');$('editor-edit').onclick=()=>{const s=app.getSelected();if(s)openForm(s.isFleet?'fleet':s.isEvent?'event':'system',s);};$('object-close').onclick=()=>$('object-dialog').close();
$('object-form').onsubmit=e=>{e.preventDefault();try{const d=currentDraft(),rawName=$('object-name').value,name=editing&&rawName.trim()===editing.name.trim()?editing.name:rawName.trim(),description=$('object-description').value;if(!name)throw Error('Введите название.');let item;if(kind==='fleet'&&(!$('fleet-hp').validity.valid||Number($('fleet-hp').value)<10))throw Error('HP: минимум 10.');if(kind!=='fleet'){item={...editing,id:editing?.id??(kind==='event'?'custom-e-':'custom-s-')+crypto.randomUUID(),name,description,...(kind==='system'?{shortDescription:$('object-short-description').value,objects:window.SystemObjects.read()}:{}),x:Number($('object-x').value),y:Number($('object-y').value),group:kind==='event'?($('object-group').value||null):$('object-group').value,...(kind==='event'?{color:$('object-event-color').value,eventType:$('object-event-type').value,...(editing?.battle?{battle:editing.battle}:{}),...(editing?.battles?{battles:editing.battles}:{})}:{}),order:$('object-capital').checked?'0':editing?.order?.startsWith('last')?editing.order:null,...(editing?.custom||!editing?{custom:true}:{})};const list=kind==='event'?'events':'systems';d[list]=d[list].filter(s=>s.id!==item.id);d[list].push(item);}else{const system=$('object-system').value,all=app.getData();item={...editing,id:editing?.id||'custom-f-'+crypto.randomUUID(),name,description,system,...(window.shipTypeEditor?{shipTypes:window.shipTypeEditor.read()}:{}),...(window.fleetCommandEditor?.readFields?.()||{commander:window.fleetCommandEditor?.read()||null}),...Object.fromEntries(['count','attackMin','attackMax','defenseMin','defenseMax','hp'].map(k=>[k,Number($('fleet-'+k).value)])),faction:$('object-fleet-group').value||null,color:$('object-fleet-color').value,offset:editing?.offset||(all.fleets.filter(f=>String(f.system)===system).length+1)*18,...(editing?.custom||!editing?{custom:true}:{})};d.fleets=d.fleets.filter(f=>f.id!==item.id);d.fleets.push(item);}applyDraft(d);saveDraft();$('object-dialog').close();app.selectId(item.id);app.toast('Сохранено в локальный черновик.');}catch(e){$('object-error').textContent=e.message;}};
$('editor-delete').onclick=()=>{const s=app.getSelected();if(!s)return;const d=currentDraft(),attached=d.fleets.filter(f=>String(f.system)===String(s.id));if(!confirm(`Удалить «${s.name.trim()}»?${attached.length?' Связанные флоты также будут удалены.':''}`))return;d.systems=d.systems.filter(i=>String(i.id)!==String(s.id));d.events=d.events.filter(i=>String(i.id)!==String(s.id));d.fleets=d.fleets.filter(i=>String(i.id)!==String(s.id)&&String(i.system)!==String(s.id));applyDraft(d);saveDraft();dashboard();};
$('editor-move').onclick=()=>{const s=app.getSelected();if(!s||s.isFleet)return;openForm(s.isEvent?'event':'system',s);$('object-pick').click();};
$('object-pick').onclick=()=>{picking=true;app.hidePanels();$('object-dialog').close();$('pick-banner').hidden=false;document.body.classList.add('picking');};
function cancelPick(){picking=false;$('pick-banner').hidden=true;document.body.classList.remove('picking');$('object-dialog').showModal();}
$('pick-cancel').onclick=cancelPick;let down=null;$('viewport').addEventListener('pointerdown',e=>{if(picking)down={x:e.clientX,y:e.clientY};},true);$('viewport').addEventListener('pointerup',e=>{if(!picking||!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)return;const point=app.mapPoint(e.clientX,e.clientY);if(point.x<0||point.x>2559||point.y<0||point.y>2047){app.toast('Выберите точку внутри Известной Галактики.');return;}e.preventDefault();$('object-x').value=point.x;$('object-y').value=point.y;cancelPick();},true);
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('editor-json').onclick=()=>{download(new Blob([JSON.stringify(currentDraft(),null,2)],{type:'application/json'}),'galaxy-draft-v7.json');};
$('editor-import').onchange=async()=>{const f=$('editor-import').files[0];if(!f)return;try{if(f.size>4000000)throw Error('Файл слишком большой.');const d=normalize(JSON.parse(await f.text()));if(!confirm('Заменить локальный черновик данными из файла?'))return;applyDraft(d);saveDraft();dashboard();}catch(e){app.toast(e.message);}finally{$('editor-import').value='';}};
$('editor-reset').onclick=()=>{if(!confirm('Отменить черновик и вернуться к опубликованной версии?'))return;app.replaceData(clone(base));try{localStorage.removeItem(draftKey);localStorage.removeItem('ugalaxy-draft-v4');localStorage.removeItem('ugalaxy-draft-v6');}catch{}dashboard();};
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zip(files){const chunks=[],central=[];let offset=0;for(const [name,bytes] of files){const n=new TextEncoder().encode(name),crc=crc32(bytes),local=new Uint8Array(30+n.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,n.length,true);local.set(n,30);chunks.push(local,bytes);const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);c.set(n,46);central.push(c);offset+=local.length+bytes.length;}const size=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});}
const runtime=['polish-v47.js','polish-v47.css','newlog-v47.css','fleet-scale-v46.js','nav-v46.js','nav-v46.css','help-v46.js','help-v46.css','guide-v45.js','progression-v45.css','battle-event-v45.css','partial-export-v45.js','fleet-setup-v44.js','trait-text-v44.js','trait-text-v44.css','faction-layout-v43.css','battle-roster-v43.js','battle-roster-v43.css','earth-v41.js','factions-v41.js','factions-v41.css','card-v39.css','faction-crests.js', 'territory-crests.js', 'assets/crests/Flag_Meli.png', 'assets/crests/Flag_Katon.png', 'assets/crests/Flag_Ef.png', 'assets/crests/Flag_Balter.png', 'assets/crests/Flag_Uvian.png', 'assets/crests/Flag_Lib.png', 'assets/crests/Flag_Ynatari.png', 'assets/crests/Flag_Gekho.png', 'assets/crests/Flag_Finisant.png', 'assets/crests/Flag_Moji.png', 'assets/crests/Flag_Zet.png', 'assets/crests/Flag_Human.png','commander-profile-v38.css','trait-browser-v37.js','trait-browser-v37.css','personality-v37.js','personality-v37.css','cards-v36.css','guide-v35.js','controls-v35.css','controls-v35.js','guide-v34.js','commander-registry.js','commander-registry.css','ui-v32.css','guide-v31.js','guide-v31.css','ui-v31.js','ui-v31.css','window-v30.css','battle-v30.css','round-orders.css','sector-ui.js','sector-ui.css','fleet-command.js','header-repair.js','header-repair.css','final-layout.js','final-layout.css','window-standards.js','window-standards.css','combined-editor.js','combined-editor.css','object-order.css','unified-ui.css','unified-ui.js','system-objects.css','system-objects.js','window-behavior.js','smooth-territories.js','panel-polish.js','panel-polish.css','territories.css','territory-engine.js','territories.js','combat-options.css','combat-help.js','rounds.css','ship-types.js','battle-report.css','polish.css','enhancements.css','enhancements.js','battle.css','battle-engine.js','battle.js','dossier.css','refinements.css','motion.css','events.css','cartographer.css','styles.css','universe.css','mobile.css','editor.css','app.js','editor.js','assets/galaxy-clean.png','assets/influence.png'];
let embedded=null;const assets=document.getElementById('export-assets');if(assets)embedded=JSON.parse(assets.textContent);
async function bytesFor(name){if(embedded?.[name])return Uint8Array.from(atob(embedded[name]),c=>c.charCodeAt(0));const response=await fetch(new URL(name,location.href),{cache:'no-cache'});if(!response.ok)throw Error('Не удалось получить '+name);return new Uint8Array(await response.arrayBuffer());}
$('editor-export').onclick=async()=>{$('editor-export').disabled=true;try{if(await window.GalaxyChanges?.exportCompact?.())return;const source=embedded?new TextDecoder().decode(await bytesFor('index.html')):await (async()=>{const r=await fetch(location.href,{cache:'no-cache'});if(!r.ok)throw Error('Не удалось загрузить шаблон сайта.');return r.text();})();const doc=new DOMParser().parseFromString(source,'text/html');doc.getElementById('galaxy-data').textContent=JSON.stringify(app.getData()).replace(/</g,'\\u003c');const html='<!doctype html>\n'+doc.documentElement.outerHTML;const files=[['index.html',new TextEncoder().encode(html)],['.nojekyll',new Uint8Array()]];for(const path of runtime)files.push([path,await bytesFor(path)]);download(zip(files),'Карта-Вселенной-экспорт-GitHub.zip');app.toast('Архив готов. Распакуйте и загрузите содержимое в корень GitHub.');}catch(e){app.toast(e.message+' Откройте редактор на опубликованном сайте или используйте автономную версию.');}finally{$('editor-export').disabled=false;}};
window.galaxyEditor={publishedBase:clone(base),exportIO:{download,zip,bytesFor,embedded},normalize,snapshot:currentDraft,applyDraft,save:saveDraft,editSelected:()=>{const s=app.getSelected();if(s)openForm(s.isFleet?'fleet':s.isEvent?'event':'system',s);else $('admin-toggle').click();}};dashboard();
})();

;
/* smooth-territories.js */
'use strict';
(function installSmoothTerritories(scope){
const STEP=8;
const vertex=(x,y)=>x+','+y;
const point=id=>id.split(',').map(n=>Number(n)*STEP);

// A single planar interface graph, including owner 0 (unclaimed). Ownership
// is never edited here. Every geometric chain is computed once, then reversed
// verbatim for the owner on its other side.
function graph(layer){
  const {width:w,height:h,cells}=layer,edges=[],vertices=new Map();
  const own=(x,y)=>x>=0&&y>=0&&x<w&&y<h?cells[y*w+x]:0;
  function add(ax,ay,bx,by,right,left){
    if(right===left)return;
    const a=vertex(ax,ay),b=vertex(bx,by),pair=[right,left].sort((x,y)=>x-y).join(':');
    const edge={a,b,right,left,pair};
    const index=edges.push(edge)-1;
    for(const v of [a,b]){if(!vertices.has(v))vertices.set(v,[]);vertices.get(v).push(index);}
  }
  for(let y=0;y<=h;y++)for(let x=0;x<w;x++)add(x,y,x+1,y,own(x,y),own(x,y-1));
  for(let x=0;x<=w;x++)for(let y=0;y<h;y++)add(x,y,x,y+1,own(x-1,y),own(x,y));
  const junction=v=>{const es=vertices.get(v);return es.length!==2||edges[es[0]].pair!==edges[es[1]].pair;};
  const used=new Set(),chains=[];
  function trace(index,start){
    const ids=[start],es=[];let cursor=start;
    while(!used.has(index)){
      used.add(index);es.push(index);
      const edge=edges[index];cursor=edge.a===cursor?edge.b:edge.a;ids.push(cursor);
      if(cursor===start||junction(cursor))break;
      index=vertices.get(cursor).find(i=>i!==index);
    }
    const first=edges[es[0]],forward=first.a===start;
    chains.push({ids,points:ids.map(point),closed:ids[0]===ids[ids.length-1]&&!junction(start),
      right:forward?first.right:first.left,left:forward?first.left:first.right});
  }
  for(const [v,es] of vertices)if(junction(v))for(const i of es)if(!used.has(i))trace(i,v);
  for(let i=0;i<edges.length;i++)if(!used.has(i))trace(i,edges[i].a);
  smoothGraph(chains,w*STEP,h*STEP);
  for(const c of chains)if(!c.segments)c.segments=cubic(c.points,c.closed,0);
  return chains;
}

function localSmooth(raw,closed){
  let ps=closed?raw.slice(0,-1):raw;
  // Three corner-cutting passes at the resampled visual scale. Closed rings
  // have no artificial pinned seam; open interfaces keep junctions pinned.
  for(let pass=0;pass<3;pass++){
    const next=closed?[]:[ps[0]],n=closed?ps.length:ps.length-1;
    for(let i=0;i<n;i++){
      const a=ps[i],b=ps[(i+1)%ps.length];
      next.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],
        [a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);
    }
    if(!closed)next.push(ps[ps.length-1]);ps=next;
  }
  // Exact collinearity simplification only: no topology-changing shortcuts.
  const out=[];
  for(const p of ps){
    while(out.length>1){const a=out[out.length-2],b=out[out.length-1];
      if((b[0]-a[0])*(p[1]-b[1])!==(b[1]-a[1])*(p[0]-b[0]))break;
      out.pop();
    }
    out.push(p);
  }
  if(closed)out.push(out[0]);return out;
}

// Broad geometric smoothing happens once per shared interface. The planar
// embedding, including junction incidence and every tiny face, is safeguarded.
const distance=(p,a,b)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;
  const t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
};
function simplify(ps,tolerance){
  if(ps.length<3)return ps;
  let max=tolerance,index=-1;
  for(let i=1;i<ps.length-1;i++){const d=distance(ps[i],ps[0],ps.at(-1));if(d>max){max=d;index=i;}}
  return index<0?[ps[0],ps.at(-1)]:simplify(ps.slice(0,index+1),tolerance).slice(0,-1).concat(simplify(ps.slice(index),tolerance));
}
function flowing(raw,closed){
  let ps;
  if(closed){
    let far=1;for(let i=2;i<raw.length-1;i++)if(Math.hypot(raw[i][0]-raw[0][0],raw[i][1]-raw[0][1])>Math.hypot(raw[far][0]-raw[0][0],raw[far][1]-raw[0][1]))far=i;
    ps=simplify(raw.slice(0,far+1),10).slice(0,-1).concat(simplify(raw.slice(far),10)).slice(0,-1);
    if(ps.length<3)ps=raw.slice(0,-1);
  }else ps=simplify(raw,10);
  // Uniform arc-length samples avoid short knots at every former cell corner.
  const sampled=[ps[0]],spacing=28;
  let carry=0;
  for(let i=0;i<(closed?ps.length:ps.length-1);i++){
    const a=ps[i],b=ps[(i+1)%ps.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let d=spacing-carry;d<length;d+=spacing)sampled.push([a[0]+(b[0]-a[0])*d/length,a[1]+(b[1]-a[1])*d/length]);
    carry=(carry+length)%spacing;
  }
  if(!closed)sampled.push(ps.at(-1));
  return simplify(localSmooth(closed?sampled.concat([sampled[0]]):sampled,closed),1.5);
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const equal=(a,b)=>Math.abs(a[0]-b[0])<1e-7&&Math.abs(a[1]-b[1])<1e-7;
function intersects(a,b,c,d){
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b),e=1e-7;
  if(((x>e&&y< -e)||(x< -e&&y>e))&&((z>e&&w< -e)||(z< -e&&w>e)))return true;
  const on=(p,q,r)=>Math.abs(cross(p,q,r))<e&&distance(r,p,q)<e;
  if(Math.abs(x)<e&&Math.abs(y)<e){
    const axis=Math.abs(b[0]-a[0])>Math.abs(b[1]-a[1])?0:1;
    return Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]))-Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis]))>e;
  }
  return (on(a,b,c)&&!equal(c,a)&&!equal(c,b))||(on(a,b,d)&&!equal(d,a)&&!equal(d,b))||(on(c,d,a)&&!equal(a,c)&&!equal(a,d))||(on(c,d,b)&&!equal(b,c)&&!equal(b,d));
}
class SegmentIndex{
  constructor(){this.buckets=new Map();this.chains=new Map();}
  keys(a,b){const out=[];for(let y=Math.floor(Math.min(a[1],b[1])/32);y<=Math.floor(Math.max(a[1],b[1])/32);y++)for(let x=Math.floor(Math.min(a[0],b[0])/32);x<=Math.floor(Math.max(a[0],b[0])/32);x++)out.push(x+','+y);return out;}
  set(id,ps){
    for(const s of this.chains.get(id)||[])for(const k of s.keys)this.buckets.get(k).delete(s);
    const ss=[];for(let i=1;i<ps.length;i++){const s={id,i,a:ps[i-1],b:ps[i],keys:this.keys(ps[i-1],ps[i])};ss.push(s);for(const k of s.keys){if(!this.buckets.has(k))this.buckets.set(k,new Set());this.buckets.get(k).add(s);}}this.chains.set(id,ss);
  }
  query(a,b){const out=new Set();for(const k of this.keys(a,b))for(const s of this.buckets.get(k)||[])out.add(s);return out;}
}
const area=ps=>ps.slice(1).reduce((s,p,i)=>s+ps[i][0]*p[1]-p[0]*ps[i][1],0)/2;
function inside(p,ps){
  let hit=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){
    const a=ps[i],b=ps[j];
    if(p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7&&Math.abs(cross(a,b,p))<1e-7)return false;
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;
}
function smoothGraph(chains,width,height){
  const index=new SegmentIndex();chains.forEach((c,i)=>index.set(i,c.points));
  chains.forEach((chain,id)=>{
    const raw=chain.points;
    // The map frame is not a faction interface: keep its coverage exact.
    if(raw.every(p=>p[0]===0||p[1]===0||p[0]===width||p[1]===height))return;
    const rawIndex=new SegmentIndex();rawIndex.set(id,raw);
    const rawArea=area(raw),frame=raw.filter(p=>p[0]===0||p[1]===0||p[0]===width||p[1]===height);
    function safe(ps){
      const candidateIndex=new SegmentIndex();candidateIndex.set(id,ps);
      const ring=equal(raw[0],raw.at(-1));
      if(ring&&(area(ps)*rawArea<=0||Math.abs(area(ps))<Math.abs(rawArea)*.35))return false;
      // Exact map-frame coverage remains pinned.
      for(const p of frame)if(![...candidateIndex.query(p,p)].some(s=>distance(p,s.a,s.b)<1e-6))return false;
      const near=(p,grid)=>{for(const s of grid.query([p[0]-12,p[1]-12],[p[0]+12,p[1]+12]))if(distance(p,s.a,s.b)<=12)return true;return false;};
      if(ps.some(p=>!near(p,rawIndex))||raw.some(p=>!near(p,candidateIndex)))return false;
      const self=candidateIndex;
      for(let i=1;i<ps.length;i++){
        const a=ps[i-1],b=ps[i];
        for(const s of index.query(a,b))if(s.id!==id&&intersects(a,b,s.a,s.b))return false;
        for(const s of self.query(a,b))if(Math.abs(s.i-i)>1&&!(chain.closed&&Math.abs(s.i-i)===ps.length-2)&&intersects(a,b,s.a,s.b))return false;
      }
      // A final crossing test alone misses curves jumping over tiny holes.
      // Reject any swept face containing another interface vertex.
      const sweep=raw.concat(ps.slice().reverse()),xs=sweep.map(p=>p[0]),ys=sweep.map(p=>p[1]);
      for(const s of index.query([Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]))if(s.id!==id&&(inside(s.a,sweep)||inside(s.b,sweep)))return false;
      return true;
    }
    let candidate=flowing(raw,chain.closed);
    if(!safe(candidate)){
      // Only constrained 64px windows fall back; long free curves stay flowing.
      candidate=[raw[0]];
      for(let start=0;start<raw.length-1;start+=8){
        const end=Math.min(raw.length-1,start+8),part=flowing(raw.slice(start,end+1),false);
        const trial=candidate.slice(0,-1).concat(part,raw.slice(end+1));
        candidate.push(...(safe(trial)?part:raw.slice(start,end+1)).slice(1));
      }
    }
    // The raster grid is only a topology source. Render shared cubic curves,
    // not the flattened samples used by the collision validator.
    const knots=simplify(candidate,.45);
    let curves=cubic(knots,chain.closed),flattened=flatten(curves);
    if(!safe(flattened)){
      // A narrow neck must not force a long border back to polygon facets.
      // Retry smaller tangents, then isolate only the colliding curve windows.
      curves=cubic(candidate,chain.closed,.75);flattened=flatten(curves);
      if(!safe(flattened)){
        const smooth=cubic(candidate,chain.closed,.65),linear=cubic(candidate,chain.closed,0);
        curves=linear.slice();
        function accept(start,end){
          const trial=curves.slice();for(let i=start;i<end;i++)trial[i]=smooth[i];
          if(safe(flatten(trial))){curves=trial;return;}
          if(end-start>1){const middle=(start+end)>>1;accept(start,middle);accept(middle,end);}
        }
        for(let start=0;start<curves.length;start+=12)accept(start,Math.min(start+12,curves.length));
        flattened=flatten(curves);
      }
    }
    chain.segments=curves;chain.points=flattened;
    index.set(id,chain.points);
  });
}

// Catmull–Rom tangents become cubic controls once per shared chain. Endpoint
// tangents are one-sided; junction positions remain exact. Reversal swaps
// controls, so neighbouring owners literally render the same mathematical arc.
function cubic(points,closed,tension=1){
  const ps=closed?points.slice(0,-1):points,n=ps.length,result=[];
  for(let i=0;i<(closed?n:n-1);i++){
    const a=ps[i],b=ps[(i+1)%n],p=i?ps[i-1]:closed?ps[n-1]:a,q=i+2<n?ps[i+2]:closed?ps[(i+2)%n]:b;
    result.push({a,b,c1:[a[0]+(b[0]-p[0])*tension/6,a[1]+(b[1]-p[1])*tension/6],c2:[b[0]-(q[0]-a[0])*tension/6,b[1]-(q[1]-a[1])*tension/6]});
  }return result;
}
function flatten(segments){
  if(!segments.length)return [];
  const out=[segments[0].a];
  const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  function split(a,c1,c2,b,depth){
    if(depth>=12||(distance(c1,a,b)<=.04&&distance(c2,a,b)<=.04)){out.push(b);return;}
    const u=mid(a,c1),v=mid(c1,c2),w=mid(c2,b),r=mid(u,v),s=mid(v,w),m=mid(r,s);
    split(a,u,r,m,depth+1);split(m,s,w,b,depth+1);
  }
  for(const s of segments)split(s.a,s.c1,s.c2,s.b,0);return out;
}
const reverseSegments=ss=>ss.slice().reverse().map(s=>({a:s.b,b:s.a,c1:s.c2,c2:s.c1}));
function loops(chains,value,withCurves=false){
  const arcs=[],outgoing=new Map(),result=[];
  for(const c of chains){
    if(c.right!==value&&c.left!==value)continue;
    const forward=c.right===value,ids=forward?c.ids:c.ids.slice().reverse();
    const points=forward?c.points:c.points.slice().reverse();
    const ss=c.segments||cubic(c.points,c.closed,0);
    const arc={ids,points,segments:forward?ss:reverseSegments(ss),used:false};arcs.push(arc);
    if(!outgoing.has(ids[0]))outgoing.set(ids[0],[]);outgoing.get(ids[0]).push(arc);
  }
  const direction=(a,b)=>{const p=point(a),q=point(b);return Math.atan2(q[1]-p[1],q[0]-p[0]);};
  for(const first of arcs){
    if(first.used)continue;
    const points=[],segments=[];let arc=first;
    while(arc&&!arc.used){
      arc.used=true;points.push(...arc.points.slice(0,-1));segments.push(...arc.segments);
      const ids=arc.ids,end=ids[ids.length-1];
      if(end===first.ids[0])break;
      const incoming=direction(ids[ids.length-2],end);
      const candidates=(outgoing.get(end)||[]).filter(a=>!a.used);
      // Keep the owned face on the right. At checkerboard degree-4 vertices,
      // take the right turn, not the other diagonal component's incidence.
      candidates.sort((a,b)=>{
        const rank=c=>{let t=direction(c.ids[0],c.ids[1])-incoming;
          while(t<=-Math.PI)t+=Math.PI*2;while(t>Math.PI)t-=Math.PI*2;
          return Math.abs(t-Math.PI/2);};
        return rank(a)-rank(b);
      });
      arc=candidates[0];
    }
    if(points.length>=3)result.push(withCurves?segments:points);
  }
  return result;
}
function contours(layer,value){return loops(graph(layer),value);}
function paths(layer,chains=graph(layer),ownerMap=null){
  const mapped=ownerMap?chains.map(c=>({...c,right:ownerMap[c.right]??c.right,left:ownerMap[c.left]??c.left})).filter(c=>c.right!==c.left):chains;
  return layer.keys.map((key,index)=>{
    const path=new Path2D();
    let d='';
    for(const ss of loops(mapped,index+1,true)){
      path.moveTo(...ss[0].a);d+='M'+ss[0].a.join(' ');
      for(const s of ss){path.bezierCurveTo(...s.c1,...s.c2,...s.b);d+='C'+[...s.c1,...s.c2,...s.b].join(' ');}
      path.closePath();d+='Z';
    }
    return {key,path,d};
  });
}
scope.SmoothTerritories={paths,contours,geometry:graph};
// Serialize this dependency-free installer into a worker. file:// exports work
// too; no additional asset or deployment-list change is required.
if(typeof document!=='undefined'&&typeof Worker!=='undefined'){
  let worker=null,sequence=0,pending=new Map();
  scope.SmoothTerritories.geometryAsync=function(layer){
    if(!worker){
      const source='('+installSmoothTerritories.toString()+')(self);self.onmessage=e=>{try{self.postMessage({id:e.data.id,chains:self.SmoothTerritories.geometry(e.data.layer)})}catch(error){self.postMessage({id:e.data.id,error:String(error)})}}';
      const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
      worker=new Worker(url);URL.revokeObjectURL(url);
      worker.onmessage=e=>{const job=pending.get(e.data.id);if(!job)return;pending.delete(e.data.id);e.data.error?job.reject(Error(e.data.error)):job.resolve(e.data.chains);};
      worker.onerror=e=>{for(const job of pending.values())job.reject(Error(e.message));pending.clear();worker.terminate();worker=null;};
    }
    return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({id,layer});});
  };
}
})(typeof window==='undefined'?self:window);

;
/* faction-crests.js */
'use strict';
(()=>{const files={'Земляне':'Flag_Human.png','Альянс':'Flag_Human.png','Унатари':'Flag_Ynatari.png','Можжи':'Flag_Moji.png','Катонцы':'Flag_Katon.png','Финисанты':'Flag_Finisant.png','Мелиафаты':'Flag_Meli.png','Эфы':'Flag_Ef.png','Гэкхо':'Flag_Gekho.png','Зетты':'Flag_Zet.png','Ювианцы':'Flag_Uvian.png','Либерио':'Flag_Lib.png'};const assets={};for(const [k,f]of Object.entries(files))assets[k]='assets/crests/'+f;const cache=new Map();window.FactionCrests={get:key=>assets[key]||null,keys:()=>Object.keys(assets),assets:Object.values(assets),image(key){return cache.get(key)||null;}};for(const key of Object.keys(assets)){const image=new Image();image.onload=()=>{cache.set(key,image);document.dispatchEvent(new Event('faction-crests-ready'));};image.src=assets[key];}
})();

;
/* territory-crests.js */
'use strict';
(()=>{let cachedSignature=null,anchors=[];window.TerritoryCrests={draw(ctx,layer,paths,selected=[]){if(!window.FactionCrests)return;const signature=layer.renderRevision===undefined?layer.cells:layer.renderRevision;if(cachedSignature!==signature){cachedSignature=signature;anchors=[];const {width,height,cells,keys}=layer,seen=new Uint8Array(cells.length);for(let n=0;n<cells.length;n++){if(seen[n]||!cells[n])continue;const value=cells[n],queue=[n];seen[n]=1;let head=0,sx=0,sy=0,positions=[];while(head<queue.length){const i=queue[head++],x=i%width,y=Math.floor(i/width);positions.push(i);sx+=x;sy+=y;for(const j of [x>0?i-1:-1,x<width-1?i+1:-1,y>0?i-width:-1,y<height-1?i+width:-1])if(j>=0&&!seen[j]&&cells[j]===value){seen[j]=1;queue.push(j);}}if(positions.length<80)continue;const cx=sx/positions.length,cy=sy/positions.length;let best=positions[0],distance=Infinity;for(const i of positions){const d=(i%width-cx)**2+(Math.floor(i/width)-cy)**2;if(d<distance){distance=d;best=i;}}const size=Math.max(45,Math.min(160,Math.sqrt(positions.length)*4));anchors.push({key:keys[value-1],x:(best%width)*8+4,y:Math.floor(best/width)*8+4,size});}}for(const a of anchors){const image=FactionCrests.image(a.key),region=paths.find(r=>r.key===a.key);if(!image||!region)continue;ctx.save();ctx.clip(region.path,'evenodd');ctx.globalAlpha=selected.length&&!selected.includes(a.key)?.025:.12;ctx.drawImage(image,a.x-a.size/2,a.y-a.size/2,a.size,a.size);ctx.restore();}}};})();

;
/* territories.js */
'use strict';
(()=>{const $=id=>document.getElementById(id),app=window.galaxyApp,E=TerritoryEngine;let layer=app.getData().territories||E.generate(app.getData().systems,app.getData().groups),editing=false,stroke=false,last=null,undo=[],redo=[];const canvas=document.createElement('canvas');canvas.id='territory-map';canvas.width=2560;canvas.height=2048;$('base-map').after(canvas);$('influence-map').hidden=true;
const panel=document.createElement('aside');panel.id='territory-tools';panel.hidden=true;panel.innerHTML='<header><span class="eyebrow">ГРАНИЦЫ ДЕРЖАВ</span><button id="territory-collapse" class="icon-btn" aria-label="Свернуть инструменты">−</button><button id="territory-close" class="icon-btn" aria-label="Закрыть инструменты">×</button></header><p>Кисть заменяет принадлежность участка, ластик освобождает пространство. Двигайте карту с зажатой Alt / Command или переключитесь в режим камеры.</p><label>Фракция<select id="territory-faction"></select></label><label>Инструмент<select id="territory-mode"><option value="paint">Кисть территории</option><option value="erase">Ластик</option><option value="camera">Камера</option></select></label><label>Радиус кисти <input id="territory-brush" type="range" min="8" max="220" value="48"></label><label>Радиус автограниц<input id="territory-radius" type="number" min="40" max="600" value="260"></label><button id="territory-generate" class="primary-btn">Перестроить по системам</button><div class="territory-actions"><button id="territory-undo" class="primary-btn">↶ Отмена</button><button id="territory-redo" class="primary-btn">↷ Повтор</button></div><button id="territory-clear" class="primary-btn">Очистить все границы</button><button id="territory-save" class="primary-btn">Сохранить границы</button><small id="territory-status"></small>';document.body.append(panel);
for(const g of app.getData().groups)$('territory-faction').append(new Option(g.label,g.key));const launch=document.createElement('button');launch.id='editor-territories';launch.className='primary-btn';launch.textContent='⌖ Редактор границ';$('editor-dashboard').querySelector('.editor-grid').append(launch);launch.onclick=()=>{$('admin-dialog').close();app.hidePanels();editing=true;panel.hidden=false;document.body.classList.add('territory-editing');$('territory-radius').value=layer.radius;};
const NS='http://www.w3.org/2000/svg',vector=document.createElementNS(NS,'svg');
vector.id='territory-vector';vector.setAttribute('viewBox','0 0 2560 2048');vector.setAttribute('aria-hidden','true');
Object.assign(vector.style,{position:'absolute',left:'0',top:'0',width:'2560px',height:'2048px',pointerEvents:'none',zIndex:'1',overflow:'hidden'});canvas.before(vector);
let revision=0,cachedRevision=-1,cachedOwners='',cachedGeometry=null,cachedPaths=[],cachedBloc=[],busy=false,frame=0,domRevision=-1,domOwners='',styleNodes=[];
const preview=document.createElement('canvas');preview.width=2560;preview.height=2048;preview.id='territory-brush-preview';Object.assign(preview.style,{position:'absolute',left:'0',top:'0',width:'2560px',height:'2048px',pointerEvents:'none',zIndex:'2'});canvas.after(preview);
layer.renderRevision=revision;
let failedRevision=-1;
function invalidate(){revision++;layer.renderRevision=revision;failedRevision=-1;}
function requestRender(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render();});}
function rebuild(){
  if(busy||stroke||cachedRevision===revision||failedRevision===revision)return;
  busy=true;const target=revision,snapshot={...layer,cells:layer.cells.slice(),keys:layer.keys.slice()},start=performance.now();
  const compute=SmoothTerritories.geometryAsync?SmoothTerritories.geometryAsync(snapshot):Promise.resolve().then(()=>SmoothTerritories.geometry(snapshot));
  compute.then(chains=>{
    if(target===revision&&!stroke){cachedGeometry=chains;cachedPaths=SmoothTerritories.paths(snapshot,chains);cachedRevision=target;cachedOwners='';window.territoryPerformance={revision:target,geometryWallMs:performance.now()-start,chains:chains.length};}
  }).catch(error=>{failedRevision=target;console.error('Territory geometry failed',error);$('territory-status').textContent='Не удалось обновить контуры';}).finally(()=>{busy=false;requestRender();});
}
function blocOwners(keys,groups){
  const byKey=new Map(groups.map(g=>[g.key,g])),map=[0];
  for(const key of keys){let root=key,seen=new Set([key]),next=byKey.get(root)?.overlord;
    while(next&&byKey.has(next)&&keys.includes(next)){
      if(seen.has(next)){root=key;break;}seen.add(next);root=next;next=byKey.get(root)?.overlord;
    }map.push(keys.indexOf(root)+1);
  }return map;
}
function node(tag,attrs,parent=vector){const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));parent.append(el);return el;}
function render(){
  const ctx=canvas.getContext('2d');
  const groups=app.getData().groups,byKey=new Map(groups.map(g=>[g.key,g])),selected=[...$('faction-list').querySelectorAll('button[aria-pressed=true]')].map(b=>b.dataset.key).filter(Boolean),owners=blocOwners(layer.keys,groups),ownerSignature=owners.join(',');
  if(!stroke)rebuild();
  if(cachedGeometry&&cachedOwners!==ownerSignature){cachedBloc=SmoothTerritories.paths(layer,cachedGeometry,owners);cachedOwners=ownerSignature;}
  const paths=cachedPaths,dim=key=>selected.length&&!selected.includes(key);
  if(domRevision!==cachedRevision||domOwners!==ownerSignature){
  vector.replaceChildren();styleNodes=[];const defs=node('defs',{});
  for(const region of paths){const g=byKey.get(region.key);if(!g)continue;
    node('path',{d:region.d,fill:g.color,'data-key':g.key,'fill-opacity':g.overlord?.145:.12,'fill-rule':'evenodd'});
  }
  // Root outlines trace the union of the very same shared curves. No separate
  // resmoothing can create slivers where a vassal meets its overlord.
  for(let i=0;i<cachedBloc.length;i++){const region=cachedBloc[i],g=byKey.get(region.key);if(!g||owners[i+1]!==i+1||!region.d)continue;
    const id='territory-bloc-clip-'+i,clip=node('clipPath',{id},defs);node('path',{d:region.d,'clip-rule':'evenodd'},clip);
        node('path',{d:region.d,fill:'none',stroke:g.color,'data-key':g.key,'data-bloc':'true','stroke-opacity':.12,'stroke-width':16,'stroke-linejoin':'round','clip-path':'url(#'+id+')'});
    node('path',{d:region.d,fill:'none',stroke:g.color,'data-key':g.key,'data-bloc':'true','stroke-opacity':.62,'stroke-width':2,'stroke-linejoin':'round','clip-path':'url(#'+id+')'});
  }
  for(let i=0;i<paths.length;i++){const region=paths[i],g=byKey.get(region.key);if(!g||owners[i+1]===i+1)continue;
    node('path',{d:region.d,fill:'none',stroke:g.color,'data-key':g.key,'stroke-opacity':.38,'stroke-width':1.15,'stroke-linejoin':'round','stroke-linecap':'round'});
  }
  domRevision=cachedRevision;domOwners=ownerSignature;
  // Retain SVG nodes for selection/crest/camera changes. Only opacity/color
  // attributes change, never path data or clip geometry.
  for(const el of vector.children)if(el.tagName==='path')styleNodes.push({el,opacity:el.getAttribute('fill-opacity')||el.getAttribute('stroke-opacity'),fill:el.getAttribute('fill')!=='none'});
  }
  for(const item of styleNodes){const group=byKey.get(item.el.dataset.key);if(!group)continue;const faded=item.el.dataset.bloc?selected.length&&!selected.some(k=>owners[layer.keys.indexOf(k)+1]===owners[layer.keys.indexOf(group.key)+1]):dim(group.key);item.el.setAttribute(item.fill?'fill':'stroke',group.color);item.el.setAttribute(item.fill?'fill-opacity':'stroke-opacity',faded?Number(item.opacity)*.2:Number(item.opacity));}
  ctx.clearRect(0,0,2560,2048);window.TerritoryCrests?.draw(ctx,layer,paths,selected);ctx.globalAlpha=1;
  if(!stroke&&cachedRevision===revision)preview.getContext('2d').clearRect(0,0,2560,2048);
  const hidden=!$('influence-toggle').checked;canvas.hidden=hidden;preview.hidden=hidden;vector.style.display=hidden?'none':'';
}
function history(){undo.push(layer.cells.slice());if(undo.length>30)undo.shift();redo=[];}
let syncing=false;
function sync(){syncing=true;try{app.setTerritories(JSON.parse(JSON.stringify(layer)));}finally{syncing=false;}$('territory-undo').disabled=!undo.length;$('territory-redo').disabled=!redo.length;requestRender();}
function persist(){sync();const ok=window.galaxyEditor.save();$('territory-status').textContent=ok?'Границы сохранены в черновике':'Не удалось сохранить — экспортируйте JSON';}
function point(e){const p=app.mapPoint(e.clientX,e.clientY);return {x:p.x+5.5,y:p.y+5.5};}
function apply(p){const value=$('territory-mode').value==='erase'?0:layer.keys.indexOf($('territory-faction').value)+1,r=Number($('territory-brush').value);if(value<0)return;if(last){const dist=Math.hypot(p.x-last.x,p.y-last.y),n=Math.max(1,Math.ceil(dist/Math.max(4,r/3)));for(let i=1;i<=n;i++)E.paint(layer,last.x+(p.x-last.x)*i/n,last.y+(p.y-last.y)*i/n,r,value);}else E.paint(layer,p.x,p.y,r,value);const previous=last;last=p;invalidate();const ctx=preview.getContext('2d'),color=brushColor;ctx.strokeStyle=value?color:'rgba(180,210,225,.65)';ctx.fillStyle=value?color:'rgba(180,210,225,.65)';ctx.globalAlpha=.22;ctx.lineWidth=r*2;ctx.lineCap='round';ctx.beginPath();if(previous){ctx.moveTo(previous.x,previous.y);ctx.lineTo(p.x,p.y);ctx.stroke();}else{ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();}}
let brushColor='#fff';const view=$('viewport');view.addEventListener('pointerdown',e=>{if(!editing||(e.altKey||e.metaKey)||$('territory-mode').value==='camera')return;e.preventDefault();e.stopImmediatePropagation();view.setPointerCapture(e.pointerId);history();brushColor=app.getData().groups.find(g=>g.key===$('territory-faction').value)?.color||'#fff';stroke=true;last=null;apply(point(e));},true);view.addEventListener('pointermove',e=>{if(!stroke)return;e.preventDefault();e.stopImmediatePropagation();apply(point(e));},true);function end(e){if(!stroke)return;e.preventDefault();e.stopImmediatePropagation();stroke=false;last=null;persist();}view.addEventListener('pointerup',end,true);view.addEventListener('pointercancel',end,true);view.addEventListener('click',e=>{if(editing&&$('territory-mode').value!=='camera'&&!(e.altKey||e.metaKey)){e.preventDefault();e.stopImmediatePropagation();}},true);
$('territory-undo').onclick=()=>{if(!undo.length)return;redo.push(layer.cells.slice());layer.cells=undo.pop();invalidate();persist();};$('territory-redo').onclick=()=>{if(!redo.length)return;undo.push(layer.cells.slice());layer.cells=redo.pop();invalidate();persist();};$('territory-generate').onclick=()=>{const radius=Number($('territory-radius').value);if(radius<40||radius>600){app.toast('Радиус: 40–600');return;}if(!confirm('Перестроить все территории? Ручные изменения заменятся; действие можно отменить.'))return;history();layer=E.generate(app.getData().systems,app.getData().groups,radius);invalidate();persist();};$('territory-clear').onclick=()=>{if(!confirm('Очистить все территории?'))return;history();layer.cells.fill(0);invalidate();persist();};$('territory-save').onclick=persist;$('territory-collapse').onclick=()=>{panel.classList.toggle('compact');$('territory-collapse').textContent=panel.classList.contains('compact')?'+':'−';};$('territory-close').onclick=()=>{editing=false;panel.hidden=true;document.body.classList.remove('territory-editing');persist();};
document.addEventListener('galaxy-data-changed',()=>{if(syncing)return;const t=app.getData().territories;if(t){if(t.width!==layer.width||t.height!==layer.height||t.keys.join('|')!==layer.keys.join('|')||t.cells.length!==layer.cells.length||t.cells.some((v,i)=>v!==layer.cells[i])){layer=t;invalidate();}}else{layer=E.generate(app.getData().systems,app.getData().groups);invalidate();}requestRender();});document.addEventListener('faction-crests-ready',requestRender);$('influence-toggle').addEventListener('change',requestRender);new MutationObserver(requestRender).observe($('faction-list'),{subtree:true,attributes:true,attributeFilter:['aria-pressed']});sync();requestRender();
window.territoryEditor={get:()=>JSON.parse(JSON.stringify(layer)),paint:(x,y,r,value)=>{history();E.paint(layer,x,y,r,value);invalidate();persist();}};
})();
;
/* panel-polish.js */
'use strict';
(()=>{const chevron='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';const ids=['inspector-collapse','layers-collapse','territory-collapse'];function update(){for(const id of ids){const b=document.getElementById(id);if(!b)continue;const collapsed=id==='inspector-collapse'?document.getElementById('inspector').classList.contains('folded'):id==='layers-collapse'?document.getElementById('layers-content').hidden:document.getElementById('territory-tools').classList.contains('compact');if(!b.querySelector('svg'))b.innerHTML=chevron;b.classList.add('collapse-icon');b.classList.toggle('is-collapsed',collapsed);b.title=collapsed?'Развернуть содержимое':'Свернуть содержимое';b.setAttribute('aria-label',b.title);b.setAttribute('aria-expanded',String(!collapsed));}}
const observer=new MutationObserver(()=>update());for(const id of ids){const b=document.getElementById(id);if(b)observer.observe(b,{childList:true});}for(const id of ['inspector','layers-content','territory-tools']){const el=document.getElementById(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['class','hidden']});}update();
const all=document.getElementById('collapse-groups');function groups(){const icon=document.createElement('span');icon.className='inline-fold-icon';icon.textContent=[...document.querySelectorAll('#object-list details')].some(d=>d.open)?'▾':'▸';all.prepend(icon);}all.addEventListener('click',()=>requestAnimationFrame(groups));groups();})();

;
/* window-behavior.js */
'use strict';
(()=>{for(const id of ['admin-dialog','battle-dialog','object-dialog']){const modal=document.getElementById(id);let outside=false;function beyond(e){const r=modal.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;}modal.addEventListener('pointerdown',e=>outside=e.target===modal&&beyond(e));modal.addEventListener('click',e=>{if(!outside||e.target!==modal||!beyond(e))return;outside=false;if(id==='battle-dialog')document.getElementById('battle-close').click();else document.getElementById(id==='object-dialog'?'object-close':'admin-close').click();});}
const panel=document.getElementById('inspector');function align(){panel.style.setProperty('--dossier-pad-x',getComputedStyle(panel).paddingLeft);}new ResizeObserver(align).observe(panel);align();})();

;
/* unified-ui.js */
'use strict';
(()=>{const $=id=>document.getElementById(id),chevron='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',cross='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
const grid=$('editor-dashboard').querySelector('.editor-grid');const groups=document.createElement('div');groups.className='console-operation-groups';for(const [title,ids] of [['СОЗДАНИЕ',['editor-new-system','editor-new-event','editor-new-fleet']],['ВЫБРАННЫЙ ОБЪЕКТ',['editor-edit','editor-move','editor-system-objects','editor-territories','editor-battle','editor-delete']]]){const column=document.createElement('section');const heading=document.createElement('h3');heading.textContent=title;column.append(heading);for(const id of ids){const b=$(id);if(b)column.append(b);}groups.append(column);}grid.replaceWith(groups);
const admin=$('admin-dialog'),head=admin.querySelector('.dialog-head'),fold=document.createElement('button');fold.id='admin-collapse';fold.className='icon-btn collapse-icon';fold.innerHTML=chevron;fold.setAttribute('aria-label','Свернуть пульт');fold.setAttribute('aria-expanded','true');head.insertBefore(fold,$('admin-close'));fold.onclick=()=>{const collapsed=admin.classList.toggle('console-folded');fold.setAttribute('aria-expanded',String(!collapsed));fold.classList.toggle('is-collapsed',collapsed);fold.title=collapsed?'Развернуть пульт':'Свернуть пульт';};
function update(){document.querySelectorAll('button[id*="close"],#close-help,#close-inspector').forEach(b=>{if(!b.classList.contains('uniform-close')){b.innerHTML=cross;b.classList.add('uniform-close');b.title=b.getAttribute('aria-label')||'Закрыть';}});document.querySelectorAll('details>summary').forEach(summary=>{let arrow=summary.querySelector(':scope > .object-chevron,:scope > .unified-chevron');if(!arrow){arrow=document.createElement('span');arrow.className='unified-chevron';summary.append(arrow);}if(!arrow.querySelector('svg'))arrow.innerHTML=chevron;arrow.title='Развернуть / свернуть';});document.querySelectorAll('.collapse-icon').forEach(b=>{if(!b.querySelector('svg'))b.innerHTML=chevron;});}
update();let queued=false;new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;update();});}}).observe(document.body,{subtree:true,childList:true});})();
;
/* combined-editor.js */
'use strict';
(()=>{const $=id=>document.getElementById(id);$('admin-collapse')?.remove();$('editor-system-objects').remove();const quick=document.createElement('button');quick.id='quick-edit';quick.className='icon-btn';quick.textContent='✎';quick.title='Редактировать выбранный объект';quick.setAttribute('aria-label',quick.title);document.querySelector('.toolbar-actions').prepend(quick);quick.onclick=()=>window.galaxyEditor.editSelected();const root=$('object-dialog');let active=null;
root.addEventListener('pointerdown',e=>{const grip=e.target.closest('.object-grip');if(!grip)return;e.preventDefault();e.stopPropagation();const card=grip.closest('.object-form-card'),feature=grip.closest('.feature-form-card');active={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,objectId:card.dataset.objectId,featureId:feature?.dataset.featureId,moved:false,target:null};grip.setPointerCapture(e.pointerId);grip.classList.add('dragging-grip');},true);
root.addEventListener('pointermove',e=>{if(!active||e.pointerId!==active.pointerId)return;e.preventDefault();if(Math.hypot(e.clientX-active.startX,e.clientY-active.startY)<6&&!active.moved)return;active.moved=true;root.querySelectorAll('.object-drop-target').forEach(c=>c.classList.remove('object-drop-target'));const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.object-form-card');active.target=target?.dataset.objectId;if(target&&active.target!==active.objectId)target.classList.add('object-drop-target');const rect=root.getBoundingClientRect();if(e.clientY<rect.top+85)(root.querySelector('.sector-window-body')||root).scrollTop-=12;else if(e.clientY>rect.bottom-45)(root.querySelector('.sector-window-body')||root).scrollTop+=12;},true);
function end(e){if(!active)return;const drag=active;active=null;root.querySelectorAll('.object-drop-target,.dragging-grip').forEach(c=>c.classList.remove('object-drop-target','dragging-grip'));if(e.type==='pointerup'&&drag.moved){const dest=document.elementFromPoint(e.clientX,e.clientY)?.closest('.object-form-card')?.dataset.objectId||drag.target;if(dest)window.SystemObjects.move(drag.objectId,drag.featureId,dest);}}
root.addEventListener('pointerup',end,true);root.addEventListener('pointercancel',end,true);root.addEventListener('click',e=>{if(e.target.closest('.object-grip')){e.preventDefault();e.stopPropagation();}},true);
})();

;
/* window-standards.js */
'use strict';
(()=>{const $=id=>document.getElementById(id);const show=HTMLDialogElement.prototype.showModal;HTMLDialogElement.prototype.showModal=function(){this.tabIndex=-1;show.call(this);this.scrollTop=0;this.focus({preventScroll:true});};
const guide=document.createElement('dialog');guide.id='territory-help';guide.innerHTML='<div class="dialog-head"><span class="eyebrow">РЕДАКТОР ГРАНИЦ · СПРАВКА</span><button class="icon-btn" aria-label="Закрыть справку">×</button></div>';for(const [title,text] of [['Автоматические территории','Перестроение распределяет пространство по ближайшим системам фракций. Радиус автограниц ограничивает дальность влияния: вне него остаётся свободный космос. События и флоты не служат опорными точками. Это расчётная заготовка; названия и принадлежность систем не изменяются.'],['Кисть и ластик','Выберите фракцию, инструмент и радиус кисти. Кисть назначает участок выбранной фракции, заменяя прежнюю; ластик делает участок свободным. Протяните мышью или пальцем для непрерывного штриха. Сетка владения 8 пикселей исходной карты, контуры отображаются плавно.'],['Перемещение карты','В режиме кисти/ластика зажмите Alt на Windows или Command (⌘) на Mac и перетаскивайте карту. Alt работает и на Mac. На телефоне выберите инструмент «Камера», затем двигайте карту пальцем. Колёсико изменяет масштаб.'],['Перестроение и исправления','«Перестроить по системам» заменяет ручные правки после подтверждения. Перемещение системы само не стирает слой: перестройте его явно при необходимости. «Очистить все границы» освобождает всю карту. «Отмена» и «Повтор» работают для последних 30 операций.'],['Сохранение и слои','После штриха границы сохраняются в локальном черновике; кнопка «Сохранить границы» показывает статус. JSON и ZIP включают слой. «Области влияния» скрывает/показывает территории; выбор нескольких держав приглушает остальные. Для общего обновления опубликуйте экспортированные файлы.'],['Панель инструментов','Шеврон сворачивает панель до заголовка, × закрывает инструменты. Это не удаляет сохранённые границы. Нижние настройки доступны прокруткой. Перед обновлением приложения экспортируйте JSON.']]){const s=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=text;s.append(h,p);guide.append(s);}document.body.append(guide);guide.querySelector('button').onclick=()=>guide.close();const help=document.createElement('button');help.id='territory-help-toggle';help.className='primary-btn';help.textContent='? Справка редактора границ';help.onclick=()=>guide.showModal();$('territory-tools').append(help);
function standardize(){for(const dialog of document.querySelectorAll('dialog')){dialog.tabIndex=-1;const head=dialog.querySelector(':scope>.dialog-head,:scope>.battle-header,:scope>header');if(head){dialog.classList.add('standard-window');head.classList.add('standard-header');}}}standardize();})();

;
/* final-layout.js */
'use strict';
(()=>{const $=id=>document.getElementById(id);$('quick-edit')?.remove();const section=$('system-composition-editor');$('object-description').closest('label').after(section);const title=section.querySelector('.eyebrow');title.textContent='СОСТАВ СИСТЕМЫ · ОБЪЕКТЫ И РЕСУРСЫ';const add=$('system-object-add');section.querySelector('.composition-heading').append(add);add.textContent='＋ Создать объект';document.addEventListener('keydown',e=>{if(e.code!=='KeyE'||e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open]'))return;e.preventDefault();window.galaxyEditor.editSelected();});const dl=$('help').querySelector('dl');if(dl){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='E / У';dd.textContent='Редактировать досье выбранного объекта';dl.append(dt,dd);}const note=document.createElement('p');note.textContent='Редактор системы включает состав: создавайте планеты, звёзды, станции и добавляйте к ним места и ресурсы. Вход: выберите систему → E / У или пульт → Редактировать досье.';$('help').append(note);})();

;
/* header-repair.js */
'use strict';
(()=>{const $=id=>document.getElementById(id);const help=$('territory-help-toggle');help.className='icon-btn';help.textContent='?';help.title='Справка редактора границ';help.setAttribute('aria-label',help.title);$('territory-tools').querySelector('header').insertBefore(help,$('territory-collapse'));for(const dt of $('help').querySelectorAll('dt'))if(dt.textContent==='E / У'){const key=document.createElement('kbd');key.textContent='E';dt.replaceChildren(key);dt.nextElementSibling.textContent='Редактировать досье выбранного объекта (У в русской раскладке)';}})();

;
/* battle.js */
'use strict';
(()=>{const $=id=>document.getElementById(id),app=window.galaxyApp;let eventId=null,sides=[],result=null,fullResult=null,roster=null,frame=0,finished=false,selectedEvent=null;const palette=['#70dae8','#ff9b83','#d3b6ff','#e0cb83','#89db9b','#e69aca'];const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
const box=node('div',null,'battle-dossier');box.id='battle-dossier';$('description-panel').before(box);
function swords(){const wrap=node('span',null,'report-swords');wrap.setAttribute('aria-hidden','true');wrap.innerHTML='<svg viewBox="0 0 32 32"><path d="M6 4l4 1 17 19-3 3L5 10 6 4ZM26 4l-4 1L5 24l3 3L27 10l-1-6ZM3 21l8 8M21 3l8 8M21 29l8-8M3 11l8-8"/></svg>';return wrap;}
function casualtyCard(f,name){const card=node('article',null,'casualty-card');card.dataset.destroyed=String(f.survivors===0);card.dataset.sideId=f.sideId;const side=sides.find(s=>s.id===f.sideId)||result?.scores?.find(s=>s.id===f.sideId);card.style.setProperty('--fleet-side-color',f.sideColor||side?.color||palette[0]);const header=node('header'),icon=node('span',null,'casualty-ship');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24"><path d="m12 2 3 8 6 9-9-4-9 4 6-9 3-8Z"/><path d="M12 6v9M6 16h12"/></svg>';header.append(icon,node('strong',name));card.append(header);const grid=node('div',null,'casualty-grid');for(const [label,value,cls] of [['Уцелело',f.survivors,'survived'],['Потеряно',f.destroyed,'lost'],['Вступило в бой',f.initial,'initial']]){const field=node('div',null,cls);field.append(node('small',label),node('b',String(value)));grid.append(field);}card.append(grid);const progress=node('div',null,'casualty-integrity'),fill=node('span');fill.style.width=(f.initial?f.survivors/f.initial*100:0)+'%';progress.append(fill);progress.setAttribute('aria-label',`Уцелело ${f.survivors} из ${f.initial}`);if(f.shipTypes)for(const t of f.shipTypes)card.append(node('div',`${t.name}: уцелело ${t.survivors}/${t.initial} · потеряно ${t.destroyed}`,'casualty-type'));card.append(node('small','Сбежало: '+(f.escaped||0)+' · В тылу: '+(f.withdrawn||0)+' · Активно: '+(f.active??f.survivors),'casualty-status'));card.append(progress,node('small',f.survivors===0?'Флот уничтожен':'Оставшийся HP: '+f.remainingHp,'casualty-status'));return card;}
function dossier(item){selectedEvent=item?.isEvent?item:null;box.replaceChildren();if(!selectedEvent)return;for(const [battleIndex,battle] of (item.battles||(item.battle?[item.battle]:[])).entries()){const entry=node('details',null,'battle-history');entry.open=battleIndex===(item.battles?.length||1)-1;entry.append(node('summary','Сражение '+(battleIndex+1)+' · Раунд '+battle.completedRounds+' · '+battle.winnerName));box.append(entry);const report=node('div');entry.append(report);$('inspector-emblem').innerHTML='<svg viewBox="0 0 32 32"><path d="M5 5l22 22M27 5 5 27M3 21l8 8M21 3l8 8"/></svg>';const badge=node('div',null,'battle-badge');badge.append(swords(),node('span','Недавнее сражение'));report.append(badge,node('h3',(battle.done===false?'Статус: ':'Победитель: ')+battle.winnerName,'battle-winner'));if(battle.rules)report.append(node('small','Криты: '+(battle.rules.critsEnabled?'включены':'выключены')+' · Мультиатаки: '+(battle.rules.splitMultiAttacks?'отдельные ходы':'подряд')));report.append(node('small','Утверждён раунд: '+battle.completedRounds));for(const side of battle.scores){const section=node('section',null,'battle-report-side');section.append(node('h4',side.name),node('p',`Уцелело: ${side.alive} / ${side.total} · сбежало: ${side.escaped||0} · в тылу: ${side.withdrawn||0} · активно: ${side.active??side.alive} · HP ${side.hp} / ${side.initialHp}`));section.style.setProperty('--side-color',side.color||palette[0]);for(const fleet of battle.fleetResults.filter(f=>f.sideId===side.id)){const name=fleet.name||app.getData().fleets.find(f=>String(f.id)===String(fleet.id))?.name||fleet.id;section.append(casualtyCard({...fleet,sideColor:side.color},name));}section.dataset.destroyed=String(side.alive===0);section.append(node('small',side.alive===0?'Сокрушены':battle.done===false?'Бой продолжается':battle.winnerId===null?'Ничья':side.id===battle.winnerId?'Победившая сторона':'Уцелевшие сбежали / сдались'));report.append(section);}const archive=node('section',null,'round-log-archive'),controls=node('div',null,'round-log-navigation'),prev=node('button','← Предыдущий','primary-btn'),next=node('button','Следующий →','primary-btn');prev.type=next.type='button';let selected=battle.completedRounds,archiveLog;function showArchiveRound(){archiveLog=renderRoundLog(battle,selected,archiveLog);if(!Array.isArray(battle.log))archiveLog.querySelector('.round-log-body').replaceChildren(node('p','Подробный журнал не был сохранён в этом старом отчёте.','round-log-empty'));prev.disabled=selected<=0;next.disabled=selected>=battle.completedRounds;archive.append(archiveLog);}prev.onclick=()=>{selected=Math.max(0,selected-1);showArchiveRound();};next.onclick=()=>{selected=Math.min(battle.completedRounds,selected+1);showArchiveRound();};controls.append(prev,next);archive.append(controls);report.append(archive);showArchiveRound();}if(item.eventType==='combat'){const b=node('button',item.battle?'Провести новое сражение':'Провести сражение','primary-btn');b.id='conduct-battle';b.onclick=()=>open(item);box.append(b);}}
document.addEventListener('galaxy-selection',e=>dossier(e.detail));
let selectedBattleEventTraits=[];
function readEventTraits(){return [...selectedBattleEventTraits];}
function renderEventTraits(){let panel=$('battle-event-traits');if(!panel){panel=node('section');panel.id='battle-event-traits';$('battle-canvas').before(panel);}panel.replaceChildren(node('h3','УСЛОВИЯ СРАЖЕНИЯ'));for(const [id,t]of Object.entries(BattleEngine.eventTraits||{warp_ban:{name:'Запрет варпа'},asteroid_rain:{name:'Астероидный дождь'}})){const label=node('label'),input=node('input');input.type='checkbox';input.value=id;input.checked=selectedBattleEventTraits.includes(id);input.onchange=()=>{selectedBattleEventTraits=input.checked?[...new Set([...selectedBattleEventTraits,id])]:selectedBattleEventTraits.filter(x=>x!==id);};label.append(input,node('span',t.name),node('small',t.description||''));panel.append(label);}panel.append(node('small','Изменения применяются к следующему раунду. Уже появившиеся астероиды не исчезают при отключении дождя.'));if($('battle-setup')&&!$('battle-setup').hidden)$('battle-setup').prepend(panel);else $('battle-canvas').before(panel);}
function open(item){selectedBattleEventTraits=[...(item.eventTraits||[])];autoRunning=false;pendingCommands=[];pendingBonuses=[];$('round-controls').hidden=true;eventId=item.id;result=null;roster=null;$('battle-log').replaceChildren();finished=false;cancelAnimationFrame(frame);sides=[{id:'side-1',name:'Сторона 1',color:palette[0],fleetIds:[]},{id:'side-2',name:'Сторона 2',color:palette[1],fleetIds:[]}];$('battle-title').textContent=item.name.trim();$('battle-setup').hidden=false;$('battle-playback').hidden=true;$('battle-save').disabled=false;$('battle-error').textContent='';render();$('battle-dialog').showModal();}
function assign(id,sideId){sides.forEach(s=>s.fleetIds=s.fleetIds.filter(f=>String(f)!==String(id)));const target=sides.find(s=>s.id===sideId);if(target)target.fleetIds.push(id);render();}
function fleetCard(f){const st=BattleEngine.stats(f),card=node('div',null,'battle-fleet');card.draggable=true;card.dataset.fleetId=f.id;card.append(node('strong',f.name.trim()),node('small',st.count+' кораблей'));for(const t of BattleEngine.types(f))card.append(node('small',`${t.name}: ${t.count} · HP ${t.hp} · А ${t.attackMin}–${t.attackMax} · З ${t.defenseMin}–${t.defenseMax} · ×${t.multiAttack?t.attacks:1}`));const select=node('select');select.setAttribute('aria-label','Сторона для '+f.name.trim());select.append(new Option('Не участвует',''),...sides.map(s=>new Option(s.name,s.id)));select.value=sides.find(s=>s.fleetIds.some(id=>String(id)===String(f.id)))?.id||'';select.onchange=()=>assign(f.id,select.value);card.append(select);card.ondragstart=e=>e.dataTransfer.setData('text/plain',String(f.id));return card;}
function deploymentEditor(side,fleets){const box=node('div',null,'deployment-editor'),assigned=side.fleetIds.map(id=>fleets.find(f=>String(f.id)===String(id))).filter(Boolean),types=assigned.flatMap(f=>BattleEngine.types(f).map(t=>({f,t})));const old=side.deployment||[];side.deployment=types.map(({f,t})=>({fleetId:f.id,typeId:t.id,centerCount:Math.min(t.count,old.find(e=>String(e.fleetId)===String(f.id)&&e.typeId===t.id)?.centerCount??Math.ceil(t.count*.3))}));const total=types.reduce((n,{t})=>n+t.count,0),status=node('p',null,'deployment-status');function update(){const n=side.deployment.reduce((n,e)=>n+e.centerCount,0);status.textContent=`Столкновение: ${n} / ${total} · минимум ${Math.ceil(total*.3)} (30%)`;status.dataset.valid=String(n>=Math.ceil(total*.3));}box.append(node('h4','НАЧАЛЬНАЯ РАССТАНОВКА'),status);types.forEach(({f,t},i)=>{const row=node('label',null,'deployment-row'),input=node('input');input.type='number';input.min=0;input.max=t.count;input.value=side.deployment[i].centerCount;input.setAttribute('aria-label',f.name+' · '+t.name+' в Столкновении');const rear=node('small');function set(){side.deployment[i].centerCount=Number(input.value);rear.textContent='арьергард: '+(t.count-side.deployment[i].centerCount);update();}input.onchange=set;set();row.append(node('span',f.name+' · '+t.name),input,rear);box.append(row);});update();return box;}
function render(){renderEventTraits();const fleets=app.getData().fleets;const used=new Set(sides.flatMap(s=>s.fleetIds.map(String)));$('battle-pool').replaceChildren(...fleets.filter(f=>!used.has(String(f.id))&&BattleEngine.stats(f).count>0).map(fleetCard));if(!$('battle-pool').children.length)$('battle-pool').append(node('p','Нет свободных флотов.'));$('battle-sides').replaceChildren();sides.forEach((side,i)=>{const el=node('section',null,'battle-side');el.style.setProperty('--side-color',side.color);el.dataset.sideId=side.id;const head=node('div',null,'battle-side-head'),name=node('input');name.value=side.name;name.maxLength=80;name.setAttribute('aria-label','Название стороны '+(i+1));name.onchange=()=>{side.name=name.value.trim()||'Сторона '+(i+1);render();};head.append(name);if(sides.length>2){const remove=node('button','×','icon-btn');remove.setAttribute('aria-label','Удалить сторону');remove.onclick=()=>{sides=sides.filter(s=>s!==side);render();};head.append(remove);}el.append(head,node('small','ПЕРЕТАЩИТЕ СЮДА ФЛОТЫ'));for(const [key,label] of [['guardArmor','Бонус защиты арьергарда'],['guardPenalty','Штраф атаки арьергарда']]){const l=node('label',label),input=node('input');input.type='number';input.min=0;input.value=side[key]||0;input.dataset.sideStat=key;input.onchange=()=>side[key]=Number(input.value);l.append(input);el.append(l);}const playerLabel=node('label','Сторона игроков'),player=node('input');player.type='checkbox';player.checked=!!side.isPlayer;player.dataset.player='true';player.onchange=()=>{side.isPlayer=player.checked;render();};playerLabel.prepend(player);el.append(playerLabel);for(const id of side.fleetIds){const f=fleets.find(f=>String(f.id)===String(id));if(f)el.append(fleetCard(f));}if(side.isPlayer)el.append(deploymentEditor(side,fleets));{ }el.ondragover=e=>{e.preventDefault();el.classList.add('drag-over');};el.ondragleave=()=>el.classList.remove('drag-over');el.ondrop=e=>{e.preventDefault();el.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain'),f=fleets.find(f=>String(f.id)===id);if(f)assign(f.id,side.id);};$('battle-sides').append(el);});$('battle-add-side').disabled=sides.length>=6;}
$('battle-add-side').onclick=()=>{if(sides.length>=6)return;sides.push({id:'side-'+crypto.randomUUID(),name:'Сторона '+(sides.length+1),color:palette[sides.length],fleetIds:[]});render();};
$('battle-rounds').closest('label').hidden=true;$('round-extra').closest('label').hidden=true;$('battle-full').onclick=fullBattle;
$('battle-start').onclick=()=>{try{$('battle-error').textContent='';const battleData=app.getData();roster=battleData.fleets.map(f=>window.CommanderRegistry?CommanderRegistry.resolveFleet(f,battleData):f);for(const side of sides.filter(s=>s.isPlayer)){const total=side.fleetIds.reduce((n,id)=>n+BattleEngine.stats(roster.find(f=>String(f.id)===String(id))).count,0),n=(side.deployment||[]).reduce((n,e)=>n+e.centerCount,0);if(n<Math.ceil(total*.3))throw new Error(side.name+': в Столкновении должно быть минимум 30% кораблей');}fullResult=BattleEngine.createBattle({fleets:roster,sides,seed:crypto.getRandomValues(new Uint32Array(1))[0],critsEnabled:$('battle-crits').checked,splitMultiAttacks:$('battle-split-multi').checked,eventTraits:readEventTraits()});result=fullResult;$('battle-setup').hidden=true;$('battle-playback').hidden=false;complete();renderOrders();}catch(e){$('battle-error').textContent=e.message;}};
function positions(round){const now=result.roundSummaries[round-1]?.unitZones||result.initialUnitZones;return result.units.map((u,i)=>{const zone=now[i],side=zone==='center'?sides.findIndex(s=>s.id===u.sideId):sides.findIndex(s=>s.id===zone.split(':')[1]),n=sides.length,base=-Math.PI/2+side*2*Math.PI/n;const ownIndices=result.units.map((v,j)=>now[j]===zone&&v.sideId===u.sideId?j:-1).filter(j=>j>=0),rank=ownIndices.indexOf(i);let radius,angle;const h=((i*37+11)%101)/101,k=((i*61+7)%103)/103;const personality=u.commander?.personality;if(zone==='center'){radius=25+Math.sqrt(h)*120;angle=i*2.39996;}else{const rear=zone.startsWith('rear:'),lo=rear?276:169,hi=rear?327:252;if(personality==='tactician'){const cols=Math.max(2,Math.ceil(Math.sqrt(ownIndices.length)));radius=lo+10+Math.floor(rank/cols)*11;angle=base+((rank%cols)-(cols-1)/2)*Math.min(.065,2*Math.PI/n/cols*.65);}else if(personality==='balanced'){radius=lo+12+(rank%3)*23;angle=base+((rank/3%1)+Math.floor(rank/3)%2*.14-.5)*2*Math.PI/n*.65;}else if(personality==='cautious'){radius=hi-8-k*24;angle=base+(h-.5)*2*Math.PI/n*.58;}else{radius=lo+8+k*(hi-lo-16);angle=base+(h-.5)*2*Math.PI/n*.78;}radius=Math.min(hi-5,radius);}return {x:500+Math.cos(angle)*radius,y:360+Math.sin(angle)*radius};});}
function draw(round,progress){const c=$('battle-canvas');if(c.width!==1000||c.height!==720){c.width=1000;c.height=720;}const ctx=c.getContext('2d'),pos=positions(round),previous=positions(Math.max(0,round-1)),state=result.roundSummaries[round-1],zones=state?.unitZones||result.units.map(u=>result.initialUnitZones?.[result.units.indexOf(u)]||u.position||'guard:'+u.sideId);ctx.clearRect(0,0,1000,720);ctx.fillStyle='#07101a';ctx.fillRect(0,0,1000,720);for(let i=0;i<sides.length;i++){const start=-Math.PI/2+(i-.5)*2*Math.PI/sides.length,end=start+2*Math.PI/sides.length;for(const [inner,outer,alpha] of [[155,265,.10],[265,335,.05]]){ctx.beginPath();ctx.arc(500,360,outer,start,end);ctx.arc(500,360,inner,end,start,true);ctx.closePath();ctx.fillStyle=sides[i].color;ctx.globalAlpha=alpha;ctx.fill();ctx.globalAlpha=.65;ctx.strokeStyle=sides[i].color;ctx.lineWidth=1;ctx.stroke();}const angle=(start+end)/2;ctx.globalAlpha=1;ctx.fillStyle=sides[i].color;ctx.font='11px Arial';ctx.textAlign='center';ctx.fillText(sides[i].name,500+Math.cos(angle)*300,360+Math.sin(angle)*300);ctx.font='9px Arial';ctx.fillText('АРЬЕРГАРД',500+Math.cos(angle)*230,360+Math.sin(angle)*230);ctx.fillText('ТЫЛ',500+Math.cos(angle)*320,360+Math.sin(angle)*320);}ctx.globalAlpha=1;ctx.strokeStyle='#a2c4d4';ctx.beginPath();ctx.arc(500,360,155,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#9dbdcc';ctx.font='12px Arial';ctx.textAlign='center';ctx.fillText('СТОЛКНОВЕНИЕ',500,365);const asteroids=state?.asteroids||result.asteroids||[];for(const [i,a]of asteroids.entries()){if(a.hp<=0)continue;const side=a.position==='center'?0:sides.findIndex(s=>s.id===a.position.split(':')[1]),base=-Math.PI/2+Math.max(0,side)*2*Math.PI/sides.length,h=((i*43+17)%101)/101,angle=a.position==='center'?i*2.39996:base+(h-.5)*2*Math.PI/sides.length*.7,radius=a.position==='center'?40+h*95:(a.position.startsWith('rear:')?280:177)+h*40,x=500+Math.cos(angle)*radius,y=360+Math.sin(angle)*radius;ctx.fillStyle='#736859';ctx.strokeStyle='#d1b98b';ctx.beginPath();for(let j=0;j<7;j++){const q=j*2*Math.PI/7,rr=5+((i+j*3)%4);const px=x+Math.cos(q)*rr,py=y+Math.sin(q)*rr;j?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#e0cb9f';ctx.font='8px Arial';ctx.fillText(String(a.hp),x,y-10);}
result.units.forEach((u,i)=>{if(state?.unitEscaped?.[i]??false)return;const s=sides.find(s=>s.id===u.sideId),dead=(state?.unitHp[i]??u.maxHp)<=0,lerp=finished?1:progress,p={x:previous[i].x+(pos[i].x-previous[i].x)*lerp,y:previous[i].y+(pos[i].y-previous[i].y)*lerp},size=u.model==='large'?7:u.model==='small'?3.5:5;ctx.globalAlpha=dead?.18:.95;ctx.strokeStyle=s.color;ctx.fillStyle=dead?'#364652':s.color;ctx.beginPath();if(u.model==='large'){ctx.moveTo(p.x,p.y-size);ctx.lineTo(p.x+size*.65,p.y-size*.2);ctx.lineTo(p.x+size*.65,p.y+size);ctx.lineTo(p.x,p.y+size*.6);ctx.lineTo(p.x-size*.65,p.y+size);ctx.lineTo(p.x-size*.65,p.y-size*.2);}else{ctx.moveTo(p.x,p.y-size);ctx.lineTo(p.x+size*.65,p.y+size);ctx.lineTo(p.x,p.y+size*.4);ctx.lineTo(p.x-size*.65,p.y+size);}ctx.closePath();ctx.fill();if(!dead&&zones[i]==='rear:'+u.sideId){ctx.strokeStyle='#d7c08f';ctx.strokeRect(p.x-size-2,p.y-size-2,size*2+4,size*2+4);}});ctx.globalAlpha=1;if(!finished)for(const l of result.log.filter(l=>l.round===round&&l.target).slice(0,100)){const a=result.units.findIndex(u=>u.id===l.attacker),b=result.units.findIndex(u=>u.id===l.target);if(a<0||b<0)continue;ctx.strokeStyle=l.damage?'#f7b98180':'#76dce644';ctx.beginPath();ctx.moveTo(pos[a].x,pos[a].y);ctx.lineTo(pos[b].x,pos[b].y);ctx.stroke();}$('battle-scoreboard').replaceChildren(...sides.map(s=>{const score=state?.sides.find(i=>i.id===s.id),initial=result.scores.find(i=>i.id===s.id);return node('div',s.name+' · '+(score?.alive??initial.total)+' кораблей · '+(score?.hp??initial.initialHp)+' HP');}));}
let autoRunning=false,pendingCommands=[],pendingBonuses=[];
// The round journal owns its body; other UI decorators may decorate only its summary.
if(!window.CompactSite&&!document.querySelector('link[href="newlog-v47.css"]')){const roundLogStyle=node('link');roundLogStyle.rel='stylesheet';roundLogStyle.href='newlog-v47.css';document.head.append(roundLogStyle);}
function roundLogText(l,source){
 const unit=id=>{const u=source.units?.find(u=>u.id===id)||source.logUnits?.find(u=>u.id===id);if(!u)return String(id||'');const fleet=roster?.find(f=>String(f.id)===String(u.fleetId));return (u.fleetName||fleet?.name||u.fleetId)+' / '+(u.typeName||u.name||u.typeId||'Корабль')+' · №'+(u.number??(Number(String(u.id).split('#').at(-1))+1));};
 const side=id=>source.sides?.find(s=>s.id===id)?.name||source.scores?.find(s=>s.id===id)?.name||id;
 const zone=z=>z==='center'?'Столкновение':z?((z.startsWith('rear:')?'Тыл':'Арьергард')+' · '+side(z.split(':')[1])):'';
 const asteroid=id=>'Астероид '+String(id||'').replace(/^asteroid:/,'');
 const actor=unit(l.attacker||l.unitId||l.unit),damage=l.damage??0;
 let text;
 if(l.action==='attack'||l.action==='attack_asteroid')text=actor+' → '+(l.action==='attack'?unit(l.target):asteroid(l.target))+`: атака ${l.attackTotal??l.attack}, защита ${l.defenseTotal??l.defense}, урон ${damage}`+(l.targetHp!==undefined?' · HP цели '+l.targetHp:'')+(l.critical?' · КРИТ':'')+(l.shieldConsumed?' · щит поглощён':'')+(l.intercepted?' · астероид перехватил выстрел':'');
 else if(l.action==='asteroid_damage'||l.action==='asteroid_hit')text=asteroid(l.asteroid)+' → '+unit(l.target)+': удар астероида · урон '+damage+' · HP цели '+l.targetHp;
 else if(l.action==='asteroid_spawn')text=asteroid(l.id)+': появился · '+zone(l.position)+' · HP '+l.hp;
 else if(l.action==='move')text=actor+': перемещение '+zone(l.from)+' → '+zone(l.to);
 else if(l.action==='escape')text=actor+': окончательное бегство · '+zone(l.position)+' · HP '+l.hp;
 else if(l.action==='repair')text=actor+': ремонт +'+l.healed+' HP · HP '+l.hp;
 else if(l.action==='force_shield'||l.action==='shield')text=actor+': силовой щит +'+(l.forceShield??l.shield??0)+' защиты';
 else if(l.action==='ai_path_check')text=actor+': проверка маршрута · '+(l.mistake?'ошибка манёвра':'маршрут соблюдён');
 else if(l.action==='focus_check')text=actor+': приоритет цели '+side(l.targetSideId)+' · '+(l.refused?'отклонён':'выполнен');
 else text=actor+': '+({disobey:'Неповиновение',skip:'Пропуск действия',wait:'Ожидание'}[l.action]||l.action);
 return (l.turn!==undefined?'Ход '+l.turn+(l.shot!==undefined?' · действие '+l.shot:'')+' — ':'')+text+(l.reason?' · '+l.reason:'');
}
function renderRoundLog(source,round,existing){
 const log=existing||node('details',null,'round-log-v47');log.classList.add('round-log-v47');
 if(!existing)log.open=true;
 const open=log.open,scroll=log.dataset.savedScroll!==undefined?Number(log.dataset.savedScroll):(log.querySelector('.round-log-body')?.scrollTop||0),oldRound=log.dataset.round;delete log.dataset.savedScroll;
 log.replaceChildren(node('summary','Журнал выбранного раунда · Раунд '+round));log.dataset.round=String(round);
 const body=node('div',null,'round-log-body');body.setAttribute('role','log');body.setAttribute('aria-label','События раунда '+round);body.tabIndex=0;
 const entries=(source.log||[]).filter(l=>l.round===round);
 const truncated=source.logTruncatedRounds?.includes(round)??source.roundSummaries?.[round-1]?.logTruncated??false;
 if(!entries.length)body.append(node('p',round===0?'Начальная расстановка. Действия ещё не выполнялись.':truncated?'Подробные события этого раунда недоступны: достигнут лимит сохранённого журнала (5000 записей).':'В этом раунде нет зарегистрированных событий.','round-log-empty'));
 for(const l of entries){const row=node('div',roundLogText(l,source),'round-log-entry');row.dataset.roundLogEntry=l.action;row.dataset.round=String(round);body.append(row);}
 if(entries.length&&truncated)body.append(node('p','Журнал раунда неполон: достигнут лимит 5000 записей. Показаны все сохранённые события.','round-log-empty'));
 log.append(body);log.open=open;if(oldRound===String(round)){const restore=()=>{if(log.isConnected&&log.dataset.round===String(round))body.scrollTop=scroll;};restore();requestAnimationFrame(restore);}return log;
}
function complete(){cancelAnimationFrame(frame);finished=true;draw(result.completedRounds,1);$('battle-round-status').textContent=result.finished?'ПОБЕДИТЕЛЬ: '+result.winnerName:'Раунд '+result.completedRounds+' · бой продолжается';$('battle-skip').hidden=true;$('battle-playback').classList.add('battle-complete');const previousLog=$('battle-log').querySelector('.round-log-v47'),previousRound=previousLog?.dataset.round,previousScroll=previousLog?.querySelector('.round-log-body')?.scrollTop||0;if(previousLog)previousLog.dataset.savedScroll=String(previousScroll);$('battle-log').replaceChildren();for(const score of result.scores)$('battle-log').append(node('p',`${score.name}: ${score.alive}/${score.total} уцелело · на поле ${score.active+score.withdrawn} · тыл ${score.withdrawn} · сбежало ${score.escaped||0} · HP ${score.hp}`));for(const f of result.fleetResults)$('battle-log').append(casualtyCard(f,roster.find(i=>String(i.id)===String(f.id))?.name||f.id));const journal=renderRoundLog(fullResult,result.completedRounds,previousLog);$('battle-log').append(journal);if(previousRound===String(result.completedRounds))journal.querySelector('.round-log-body').scrollTop=previousScroll;$('battle-save').hidden=false;$('battle-save').disabled=autoRunning||!result.completedRounds;$('battle-again').hidden=false;$('round-controls').hidden=false;$('round-selected').textContent='Раунд '+result.completedRounds+' / '+fullResult.completedRounds;$('round-prev').disabled=autoRunning||result.completedRounds<=0;$('round-next').disabled=autoRunning||result.completedRounds>=fullResult.completedRounds;$('round-extend').disabled=autoRunning||fullResult.finished;$('battle-full').disabled=fullResult.finished;$('battle-full').textContent=autoRunning?'Остановить расчёт':'Симулировать полное сражение';$('battle-save').textContent='Утвердить раунд '+result.completedRounds;}
const roundBar=$('round-controls');$('battle-playback').prepend(roundBar);roundBar.classList.add('round-command-bar');$('round-prev').textContent='← Предыдущий';$('round-next').textContent='Следующий →';
const ordersPanel=node('section',null,'round-orders');ordersPanel.id='round-orders';$('battle-canvas').before(ordersPanel);
function selector(label,id,options){const l=node('label',label),select=node('select');select.id=id;select.append(...options.map(([value,text])=>new Option(text,value)));l.append(select);return l;}
function inputField(label,id,value=0){const l=node('label',label),input=node('input');input.id=id;input.type='number';input.value=value;l.append(input);return l;}
function renderOrders(){if(!fullResult)return;renderEventTraits();ordersPanel.replaceChildren();ordersPanel.append(node('h3','ПРИКАЗЫ И МОДИФИКАТОРЫ ДЛЯ РАУНДА '+(fullResult.completedRounds+1)));const scopeOptions=[['','Все корабли'],...sides.map(s=>['side:'+s.id,s.name]),...roster.filter(f=>sides.some(s=>s.fleetIds.some(id=>String(id)===String(f.id)))).flatMap(f=>[['fleet:'+f.id,f.name],...BattleEngine.types(f).map(t=>['type:'+f.id+'|'+t.id,f.name+' · '+t.name])])];const bonus=node('div',null,'order-form bonus-form');bonus.append(selector('Область бонуса','bonus-scope',scopeOptions),inputField('Атака ±','bonus-attack'),inputField('Защита ±','bonus-defense'));const add=node('button','+ Бонус','primary-btn');add.id='add-bonus';add.onclick=()=>{const scope=$('bonus-scope').value,entry={attack:Number($('bonus-attack').value),defense:Number($('bonus-defense').value)};if(!Number.isInteger(entry.attack)||!Number.isInteger(entry.defense)){app.toast('Бонусы должны быть целыми числами');return;}if(scope.startsWith('side:'))entry.sideId=scope.slice(5);if(scope.startsWith('fleet:'))entry.fleetId=scope.slice(6);if(scope.startsWith('type:'))[entry.fleetId,entry.typeId]=scope.slice(5).split('|');pendingBonuses.push(entry);renderQueue();};bonus.append(add);ordersPanel.append(bonus);const players=sides.filter(s=>s.isPlayer);if(players.length){const cmd=node('div',null,'order-form command-form');cmd.append(selector('Сторона','command-side',players.map(s=>[s.id,s.name])),selector('Флот','command-fleet',[]),selector('Тип кораблей','command-type',[]),selector('HP','command-op',[['any','Любое'],['lt','< N'],['gt','> N'],['eq','= N'],['lte','≤ N'],['gte','≥ N']]),inputField('N','command-hp',1),inputField('Кораблей (0 = все)','command-count',0),selector('Действие','command-action',[['move','Перемещение'],['attack_asteroids','Зачистить астероиды'],['focus','Приоритет цели']]),selector('Цель','command-target',sides.map(s=>[s.id,s.name])),selector('Куда','command-destination',[['center','Столкновение'],['guard','Свой арьергард'],['rear','Свой тыл'],...sides.map(s=>['guard:'+s.id,'Арьергард: '+s.name]),...sides.map(s=>['rear:'+s.id,'Тыл: '+s.name])]));const issue=node('button','+ Приказ','primary-btn');issue.id='add-command';issue.onclick=()=>{const sideId=$('command-side').value,destination=$('command-destination').value,entry={action:$('command-action').value,...($('command-action').value==='focus'?{targetSideId:$('command-target').value}:{}),sideId,fleetId:$('command-fleet').value,hpOp:$('command-op').value,hpValue:Number($('command-hp').value),count:Number($('command-count').value)||null,destination:destination==='guard'||destination==='rear'?destination+':'+sideId:destination};if($('command-type').value)entry.typeId=$('command-type').value;if(!entry.fleetId){app.toast('Выберите свой флот');return;}if(!Number.isInteger(entry.hpValue)||entry.hpValue<0||entry.count!==null&&(!Number.isInteger(entry.count)||entry.count<0)){app.toast('HP и количество должны быть неотрицательными целыми');return;}pendingCommands.push(entry);renderQueue();};cmd.append(issue);ordersPanel.append(cmd);function updateTypes(){const fleet=roster.find(f=>String(f.id)===$('command-fleet').value);$('command-type').replaceChildren(new Option('Весь флот',''),...(fleet?BattleEngine.types(fleet).map(t=>new Option(t.name,t.id)):[]));}function updateFleets(){const side=players.find(s=>s.id===$('command-side').value);$('command-fleet').replaceChildren(...(side?side.fleetIds.map(id=>roster.find(f=>String(f.id)===String(id))).filter(Boolean).map(f=>new Option(f.name,f.id)):[]));updateTypes();}$('command-side').onchange=updateFleets;$('command-fleet').onchange=updateTypes;updateFleets();}else ordersPanel.append(node('p','Для ручных приказов отметьте «Сторона игроков» перед боем.'));const queue=node('div');queue.id='order-queue';ordersPanel.append(queue);renderQueue();if(fullResult.finished)ordersPanel.append(node('p','Бой завершён.'));}
function renderQueue(){const queue=$('order-queue');if(!queue)return;queue.replaceChildren();const fleetName=id=>roster.find(f=>String(f.id)===String(id))?.name||id;const sideName=id=>sides.find(s=>s.id===id)?.name||id;const signs={lt:'<',gt:'>',eq:'=',lte:'≤',gte:'≥'};for(const [kind,entries] of [['bonus',pendingBonuses],['command',pendingCommands]])entries.forEach((e,i)=>{const row=node('div',null,'pending-order pending-'+kind);const fleet=roster.find(f=>String(f.id)===String(e.fleetId)),type=e.typeId?BattleEngine.types(fleet).find(t=>t.id===e.typeId)?.name:null;let text;if(kind==='command'){const dest=e.destination==='center'?'Столкновение':(e.destination.startsWith('rear:')?'Тыл':'Арьергард')+' · '+sideName(e.destination.split(':')[1]);text=`${i+1}. ${sideName(e.sideId)} / ${fleetName(e.fleetId)}${type?' / '+type:''} · ${e.count||'Все'} · ${e.hpOp==='any'?'любое HP':'HP '+signs[e.hpOp]+' '+e.hpValue} → ${e.action==='focus'?'Приоритет цели: '+sideName(e.targetSideId):e.action==='attack_asteroids'?'Зачистить астероиды: '+dest:dest}`;}else text=`${e.sideId?sideName(e.sideId):e.fleetId?fleetName(e.fleetId):'Все корабли'}${type?' / '+type:''} · атака ${e.attack>=0?'+':''}${e.attack} · защита ${e.defense>=0?'+':''}${e.defense}`;row.append(node('span',text));const remove=node('button','×','icon-btn');remove.setAttribute('aria-label','Удалить '+(kind==='command'?'приказ':'бонус'));remove.onclick=()=>{entries.splice(i,1);renderQueue();};row.append(remove);queue.append(row);});}
function selectRound(n){result=BattleEngine.summarize(fullResult,n);complete();}
function animateLatest(){finished=false;$('round-extend').disabled=true;$('battle-save').disabled=true;const start=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:750;function tick(now){const p=duration?Math.min(1,(now-start)/duration):1;draw(result.completedRounds,p);if(p<1)frame=requestAnimationFrame(tick);else{complete();renderOrders();}}frame=requestAnimationFrame(tick);}
function advanceRound(animate=true){if(fullResult.finished)return;$('battle-error').textContent='';fullResult=BattleEngine.nextRound(fullResult,{commands:pendingCommands,bonuses:pendingBonuses,eventTraits:readEventTraits()});pendingCommands=[];pendingBonuses=[];result=fullResult;if(animate)animateLatest();else complete();renderOrders();}
$('round-prev').onclick=()=>selectRound(Math.max(0,result.completedRounds-1));$('round-next').onclick=()=>selectRound(Math.min(fullResult.completedRounds,result.completedRounds+1));$('round-extend').onclick=()=>{try{advanceRound();}catch(e){$('battle-error').textContent=e.message;}};
$('battle-skip').onclick=()=>complete();$('battle-again').onclick=()=>{autoRunning=false;cancelAnimationFrame(frame);$('battle-playback').hidden=true;$('battle-setup').hidden=false;render();};
function fullBattle(){if(autoRunning){autoRunning=false;complete();return;}autoRunning=true;complete();let unchanged=0,last='';function chunk(){if(!autoRunning||!$('battle-dialog').open)return;try{for(let i=0;i<5&&!fullResult.finished;i++){const before=JSON.stringify({ships:fullResult.units.map(u=>[u.hp,u.position,u.escaped,u.rearTurns,u.forceShield]),asteroids:fullResult.asteroids||[]});advanceRound(false);const after=JSON.stringify({ships:fullResult.units.map(u=>[u.hp,u.position,u.escaped,u.rearTurns,u.forceShield]),asteroids:fullResult.asteroids||[]});unchanged=before===after?unchanged+1:0;if(unchanged>=50){autoRunning=false;$('battle-error').textContent='50 раундов без изменения поля. Расчёт приостановлен без определения победителя; задайте команды или бонусы.';break;}}if(fullResult.finished)autoRunning=false;complete();if(autoRunning)setTimeout(chunk,0);}catch(e){autoRunning=false;$('battle-error').textContent=e.message;complete();}}setTimeout(chunk,0);}
$('battle-save').onclick=()=>{if(!result||!finished||$('battle-save').disabled)return;const data=app.getData(),event=data.events.find(e=>String(e.id)===String(eventId));if(!event){$('battle-error').textContent='Событие больше не существует.';return;}for(const loss of result.fleetResults){const f=data.fleets.find(f=>String(f.id)===String(loss.id));if(!f||JSON.stringify(BattleEngine.types(window.CommanderRegistry?CommanderRegistry.resolveFleet(f,data):f))!==JSON.stringify(BattleEngine.types(roster.find(i=>String(i.id)===String(loss.id))))){$('battle-error').textContent='Численность флота изменилась. Начните бой заново.';return;}}for(const loss of result.fleetResults){const f=data.fleets.find(f=>String(f.id)===String(loss.id));f.count=loss.survivors;if(f.shipTypes)for(const t of f.shipTypes)t.count=loss.shipTypes.find(i=>i.id===t.id)?.survivors??0;}$('battle-save').disabled=true;event.eventType='combat';event.eventTraits=readEventTraits();const previous=event.battles|| (event.battle?[event.battle]:[]);event.battle={log:fullResult.log.filter(l=>l.round<=result.completedRounds),logTruncatedRounds:fullResult.roundSummaries.filter(s=>s.round<=result.completedRounds&&s.logTruncated).map(s=>s.round),logUnits:fullResult.units.filter(u=>fullResult.log.some(l=>l.round<=result.completedRounds&&(l.attacker===u.id||l.target===u.id||l.unit===u.id||l.unitId===u.id))).map(u=>({id:u.id,fleetId:u.fleetId,fleetName:roster.find(f=>String(f.id)===String(u.fleetId))?.name||u.fleetId,typeName:u.typeName||BattleEngine.types(roster.find(f=>String(f.id)===String(u.fleetId))).find(t=>t.id===u.typeId)?.name||u.typeId})),commanders:roster.filter(f=>fullResult.fleetResults.some(r=>String(r.id)===String(f.id))).map(f=>({fleetId:f.id,name:f.name,commander:f.commander||null})),rules:fullResult.rules,commandRegistry:app.getData().commanders||[],eventTraits:readEventTraits(),eventTraitHistory:fullResult.roundSummaries.map(s=>({round:s.round,eventTraits:s.eventTraits||[]})),asteroids:result.asteroids||[],done:result.finished,winnerId:result.winnerId,winnerName:result.winnerName,requestedRounds:result.requestedRounds,completedRounds:result.completedRounds,seed:result.seed,scores:result.scores,fleetResults:result.fleetResults.map(f=>({...f,name:data.fleets.find(i=>String(i.id)===String(f.id))?.name||f.id}))};event.battles=[...previous,event.battle];app.replaceData(data);window.galaxyEditor.save();app.selectId(event.id);$('battle-dialog').close();app.toast('Итог сохранён в событии. Численность флотов обновлена по выжившим.');};
window.galaxyBattle={open};function close(){autoRunning=false;cancelAnimationFrame(frame);$('battle-dialog').close();}$('battle-close').onclick=close;$('battle-dialog').addEventListener('cancel',()=>{autoRunning=false;cancelAnimationFrame(frame);});
})();

;
/* combat-help.js */
'use strict';
(()=>{const modal=document.createElement('dialog');modal.id='combat-help';modal.innerHTML='<header><h2>ПРОТОКОЛ СРАЖЕНИЯ</h2><button class="icon-btn" aria-label="Закрыть помощь">×</button></header>';const sections=[['Расстановка сторон','Добавьте 2–6 сторон, задайте им названия и перетащите флоты на стороны. На телефоне используйте выбор стороны в карточке флота. Один флот участвует только в одной стороне. Уничтоженные флоты недоступны.'],['Корабли и очередь','Каждый корабль — отдельный юнит с параметрами своего типа: HP, атака, защита и число атак. В начале каждого раунда живые корабли перемешиваются. Уничтоженный до своего хода корабль не атакует. Каждая атака выбирает случайную живую цель другой стороны; цель бросает защиту каждый раз, без расходования собственного хода.'],['Броски и повреждения','Атака и защита — случайные целые числа во включительных диапазонах. Атака строго выше защиты наносит 1 HP; равенство не наносит урон. При 0 HP корабль уничтожается.'],['Подтверждение критов','Криты по умолчанию включены. Только максимальный бросок атаки даёт проверку подтверждения. Шанс = 5% за каждую полную пятёрку верхнего порога, максимум 100%: верхний порог 10 → 10%, 20 → 20%, 23 → 20%. Бросается 1–100; результат не выше шанса подтверждает крит, который наносит ровно 1 HP независимо от защиты. Неподтверждённый крит проверяется как обычная атака. При отключении галочки проверки подтверждения нет, все броски сравниваются только с защитой.'],['Мультиатаки','Мультиатака задаётся в редакторе отдельно каждому типу кораблей: галочка и целое количество от 2. Обычно корабль за один ход выполняет все атаки подряд, выбирая цель заново для каждой. Альтернативная галочка даёт ему столько отдельных ходов в общей перемешанной очереди раунда. Если корабль погиб до очередного хода, этот ход пропускается. Настройки фиксируются при запуске и сохраняются в отчёте.'],['Раунды и продление','Задайте начальные раунды и запустите бой. «Показать итог» пропускает анимацию, не меняя расчёт. Предыдущий/следующий показывают состояние после выбранного раунда. «Продлить бой» добавляет N раундов к концу полной последовательности, а не к просматриваемому раунду; прежние броски и ранения сохраняются. Если противников не осталось, бой завершён.'],['Победа и фиксация','Побеждает сторона с наибольшей долей оставшегося HP к начальному HP. Равные доли — ничья. Сторона без выживших — «Сокрушены»; уцелевшие проигравшие считаются сбежавшими/сдавшимися. «Утвердить раунд N» сохраняет выбранный итог в историю события и обновляет численность каждого типа кораблей. До утверждения данные карты не меняются. Каждый новый самостоятельный бой начинает с полного HP уцелевших; продление текущего сохраняет ранения.'],['История и управление','В досье события каждый утверждённый бой можно раскрыть отдельно. Закрытие площадки без утверждения не списывает корабли. «Вернуться к расстановке» позволяет начать новый расчёт. Кнопка × или Escape закрывает окно. При уменьшенном движении итог показывается без анимации. Все изменения локальные до экспорта и публикации.'],['Лимиты расчёта','До 20 типов и 500 кораблей на флот, 1500 кораблей на бой, 1000 суммарных раундов. Поле мультиатак не имеет фиксированного верхнего значения, но расчёт ограничен 2 млн потенциальных атак для защиты браузера от зависания. При превышении уменьшите состав, раунды или число атак. Журнал хранит первые 5000 бросков; просмотр показывает последние 100 из сохранённых до выбранного раунда.']];for(const [title,body] of sections){const s=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=body;s.append(h,p);modal.append(s);}document.body.append(modal);document.querySelector('.battle-header').insertBefore(document.getElementById('battle-help-toggle'),document.getElementById('battle-close'));modal.querySelector('button').onclick=()=>modal.close();document.getElementById('battle-help-toggle').onclick=()=>modal.showModal();})();

;
/* enhancements.js */
'use strict';
(()=>{const $=id=>document.getElementById(id),app=window.galaxyApp;const panel=document.createElement('section');panel.id='fleet-statistics';$('description-panel').before(panel);const field=(label,value)=>{const e=document.createElement('div');e.className='fleet-stat-field';const l=document.createElement('small'),v=document.createElement('strong');l.textContent=label;v.textContent=value;e.append(l,v);return e;};
function show(item){panel.replaceChildren();if(!item?.isFleet){panel.hidden=true;return;}panel.hidden=false;const stats=BattleEngine.stats(item);panel.append(field('Тип флота',stats.count===0?'Уничтоженный':'Целый'),field('Численность',stats.count+' кораблей'),field('HP каждого корабля',item.shipTypes?'По типу корабля':stats.hp),field('Атака',item.shipTypes?'По типу корабля':stats.attackMin+'–'+stats.attackMax),field('Защита',item.shipTypes?'По типу корабля':stats.defenseMin+'–'+stats.defenseMax));if(stats.count===0){$('inspector-emblem').classList.add('destroyed-model');const badge=document.createElement('div');badge.className='fleet-destroyed-badge';badge.textContent='ФЛОТ УНИЧТОЖЕН · 0 КОРАБЛЕЙ';panel.append(badge);}else $('inspector-emblem').classList.remove('destroyed-model');}
document.addEventListener('galaxy-selection',e=>{$('inspector-emblem').classList.remove('destroyed-model');show(e.detail);});
const button=$('editor-battle');function editorState(){const s=app.getSelected();button.hidden=!(s?.isEvent&&s.eventType==='combat');button.textContent=s?.battle?'Провести новое сражение':'Провести сражение';}new MutationObserver(editorState).observe($('admin-dialog'),{attributes:true,attributeFilter:['open']});button.onclick=()=>{const s=app.getSelected();if(!s?.isEvent||s.eventType!=='combat')return;$('admin-dialog').close();window.galaxyBattle.open(s);};
})();

;
/* sector-ui.js */
'use strict';
(()=>{const $=id=>document.getElementById(id),help=$('battle-help-toggle');help.className='icon-btn';help.textContent='?';help.title='Помощь по бою';help.setAttribute('aria-label',help.title);const windows=[...document.querySelectorAll('dialog')];for(const d of windows){const h=d.querySelector(':scope>.dialog-head,:scope>.battle-header,:scope>header');if(!h)continue;const body=document.createElement('div');body.className='sector-window-body';while(h.nextSibling)body.append(h.nextSibling);d.append(body);d.classList.add('sector-window');}const inspector=$('inspector'),h=inspector.querySelector('.inspector-top'),body=document.createElement('div');body.id='dossier-content';while(h.nextSibling)body.append(h.nextSibling);inspector.append(body);inspector.classList.add('sector-inspector');body.addEventListener('scroll',()=>{const hint=$('scroll-hint');hint.hidden=body.scrollTop+body.clientHeight>=body.scrollHeight-38||body.scrollHeight<=body.clientHeight+40;});const guide=document.createElement('section');guide.innerHTML='<h3>Круглая арена и командование</h3>';const text=document.createElement('p');text.textContent='В Столкновении на старте минимум 30% кораблей стороны; игроки сами распределяют корабли по флотам и типам, остальные в собственном арьергарде. Центр — общее Столкновение. Центр теперь может атаковать арьергард. Бонус защиты собственного арьергарда действует только против огня из центра. Из собственного арьергарда можно стрелять в чужой арьергард со штрафом атаки; для огня в центр или свой сектор этот штраф не действует. Значения задаются стороне перед стартом. В чужой тыл можно попасть только через его арьергард. Каждая граница сектора расходует одну атаку. При мультиатаке оставшиеся атаки можно использовать после перемещения. Тыл может атаковать только свой же сектор; корабли в тылу доступны только противникам, вошедшим туда. Корабль в собственном тылу не атакует. Через три завершённых раунда в тылу сбегает окончательно; до этого можно вернуть приказом. Бегство не считается потерей. Приказы по HP и количеству и бонусы бросков действуют в следующем раунде; для продолжения маршрута приказ нужно повторить. Сторона игроков не принимает автоматических решений о движении. Выжившие в тылу учитываются в сохранённых кораблях и восстановятся до полного HP в новом самостоятельном бою. Командиры используют разные приоритеты движения и выбора целей без бонусов к характеристикам: агрессивный не отступает, осторожный спасает побитых, уравновешенный отходит реже, тактик выбирает слабейшую доступную цель. Без командующего 18% действий пропускаются, ещё 10% приводят к случайному разрешённому манёвру. Модели кораблей только визуальные. Предыдущий/следующий раунды восстанавливают HP и позиции. Победа только когда другие стороны уничтожены или сбежали. Следующий раунд проигрывается отдельно; полный расчёт можно остановить. При 50 раундах без изменений расчёт приостанавливается без определения победителя.';guide.append(text);const helpBody=$('combat-help').querySelector('.sector-window-body');for(const s of [...helpBody.querySelectorAll('section')])if(['Победа и фиксация','Раунды и продление'].includes(s.querySelector('h3')?.textContent))s.remove();helpBody.prepend(guide);
})();

;
/* guide-v31.js */
/* Load LAST, after sector-ui.js. Help only: no data or shortcut changes. */
'use strict';
(() => {
  const topics = (items) => items.map(([title, html]) => `<details class="guide-topic"><summary>${title}</summary><div class="guide-topic-content">${html}</div></details>`).join('');
  const list = (...items) => `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
  const table = (head, rows) => `<div class="guide-table-wrap"><table><thead><tr>${head.map(x => `<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const territoryTopics = [
    ['Открыть и нарисовать границу', list('Пульт ✎ → «Редактор границ». Если слой не виден, включите «Области влияния» в слоях.', 'Выберите фракцию, «Кисть территории» и радиус 8–220 пикселей исходной карты. Протяните мышью или пальцем: участок получает выбранную принадлежность вместо прежней.', '«Ластик» оставляет свободное пространство. Кисть меняет только территорию, не названия и принадлежность систем, флотов или вложенных объектов.')],
    ['Камера и автограницы', list('Для перемещения карты выберите «Камера». На компьютере можно временно зажать Alt или Command (⌘) при перетаскивании. Колёсико меняет масштаб; на телефоне масштабируйте двумя пальцами в режиме камеры.', 'Радиус автограниц 40–600 ограничивает дальность до ближайшей системы: вне радиуса территория свободна. Опорные точки — системы, не события и не флоты.', '«Перестроить по системам» после подтверждения заменяет ручную разметку. Перенос системы не перестраивает уже сохранённый слой автоматически.', 'Сетка владения имеет шаг 8 пикселей исходной карты; видимые контуры сглажены. Рамка Известной Галактики — граница обзора, а не владение.')],
    ['Исправить и сохранить', list('«Отмена» и «Повтор» исправляют операции кисти, очистки и перестроения; хранится до 30 отмен. Новый штрих очищает очередь повтора.', '«Очистить все границы» освобождает весь слой после подтверждения; действие можно отменить.', 'После завершения штриха, отмены или перестроения слой сохраняется в локальном черновике. «Сохранить границы» показывает статус; × также сохраняет и закрывает инструменты, не удаляя слой.', 'Если браузер не даёт сохранить, сразу экспортируйте JSON. JSON и ZIP содержат территории; для общего доступа нужно опубликовать экспорт.', 'Шеврон сворачивает инструменты до заголовка. Выбор держав в слоях приглушает чужие территории, но не удаляет их.')]
  ];
  const battleTopics = [
    ['1. Стороны, корабли и расстановка', list('Откройте досье боевого события → «Провести сражение». Добавьте 2–6 непустых сторон, назовите их и распределите флоты перетаскиванием или выбором стороны в карточке. Один флот — одна сторона; уничтоженный флот не участвует. Флоты одной стороны не стреляют друг в друга.', 'Каждый корабль — отдельный юнит своего типа. В редакторе флота задаются количество, HP, включительные диапазоны атаки и защиты, модель и мультиатака. Малый / средний / большой — только вид модели, без бонусов.', 'Автоматическая расстановка отправляет в Столкновение первые ceil(30% численности) кораблей каждого флота, остальные — в свой арьергард. Типы заполняются по порядку.', 'Для «Стороны игроков» числа в Столкновении задаются отдельно по флотам и типам; остальное остаётся в своём арьергарде. Проверка минимума — по ВСЕЙ стороне: ceil(число кораблей стороны × 0,3), не 30% каждого типа. Например, 11 кораблей → минимум 4 в центре. В тылу бой не начинается.', 'До запуска задайте постоянные бонус защиты и штраф атаки арьергарда (неотрицательные), «Подтверждаемые криты» и режим мультиатак. При старте правила фиксируются. Начало — расстановка, раунд 0; затем считайте раунды кнопками. Старые поля количества раундов не запускают пакетный расчёт.')],
    ['2. Очередь, броски и ровно 1 HP урона', list('В начале раунда живые, ещё не сбежавшие корабли перемешиваются. Погибший до своего действия ничего не делает. Цель каждой атаки выбирается заново среди доступных живых врагов; командир меняет приоритет, при равенстве выбор случайный.', 'Атака и защита бросаются как случайные целые числа от нижнего до верхнего порога включительно. Защита бросается при каждом выстреле и не расходует действие защищающегося.', 'К броскам применяются бонусы и секторные поправки. Итоговая атака строго выше защиты → −1 HP. Равенство или меньшая атака → 0 урона. При HP = 0 корабль уничтожается.', 'Урон успешного выстрела всегда 1 HP, а не разница бросков; подтверждённый крит тоже наносит только 1 HP.') + '<p class="guide-example">Пример: атака 15, защита 12 → −1 HP. Атака 12, защита 12 → 0 HP, если нет подтверждённого крита.</p>'],
    ['3. Подтверждение критов', list('Криты по умолчанию включены. Кандидат на крит появляется ТОЛЬКО при исходном броске атаки, равном исходному верхнему порогу типа. Прибавленный бонус не делает бросок максимальным.', 'Шанс подтверждения: <code>min(100, floor(верхний порог / 5) × 5)%</code>. Верхний порог 4 → 0%; 10 → 10%; 23 → 20%; 100 и выше → 100%. Это шанс ПОСЛЕ максимального броска, не шанс крита каждого выстрела.', 'Кандидат бросает 1–100: результат ≤ шанса подтверждает крит. Он наносит 1 HP независимо от защиты и секторных поправок. Если не подтверждён — действует обычное сравнение итоговых бросков.', 'При отключённых критах нет проверки подтверждения; даже максимальный бросок сравнивается только с защитой. Бонусы и штрафы не меняют исходный максимум и шанс подтверждения.')],
    ['4. Мультиатака и движение', list('Без мультиатаки корабль имеет одно действие за раунд. С мультиатакой — целое число действий от 2, заданное для типа.', 'Обычный режим: один случайный ход корабля, все его действия идут подряд. «Мультиатаки отдельными ходами»: каждое действие отдельно попадает в общую перемешанную очередь; между ними действуют другие корабли. При гибели оставшиеся действия пропускаются.', 'Перемещение расходует ОДНО действие и пересекает ОДНУ границу. На корабль разрешено не более одного перемещения за раунд, даже при мультиатаке. Остальные действия могут атаковать из новой позиции, если есть доступная цель.', 'Маршрут к далёкому сектору занимает несколько раундов; приказ нужно повторять. Например, центр → чужой арьергард → чужой тыл: два раунда движения, не два последовательных прыжка одной мультиатакой.')],
    ['5. Секторы: куда стрелять и куда двигаться', '<p>Столкновение — общий центр. У каждой стороны есть свой арьергард и свой тыл. Вражеская принадлежность сектора сама по себе не запрещает вход.</p>' + table(['Позиция корабля', 'Доступные живые враги', 'Один шаг движения'], [
      ['Столкновение', 'В центре и в любом арьергарде; не в тылу', 'В любой арьергард'],
      ['Любой арьергард', 'В центре и во всех арьергардах; не в тылу', 'В центр или тыл этой же стороны'],
      ['Чужой тыл', 'Только в этом же тыловом секторе', 'В арьергард этой же стороны'],
      ['Собственный тыл', 'Не атакует', 'В собственный арьергард до окончательного бегства']
    ]) + list('Из арьергарда нельзя напрямую перескочить в другой арьергард: путь через центр. В чужой тыл входят только через его арьергард. Корабль в любом тылу доступен только врагу, находящемуся в том же тылу.', 'Бонус защиты стороны действует, когда цель находится в ЕЁ собственном арьергарде и стрелок — в центре. Он не защищает от огня другого арьергарда или врага внутри сектора.', 'Штраф атаки стороны применяется к стрелку в ЕГО собственном арьергарде, если цель — в другом арьергарде. Для огня в центр или тот же арьергард штрафа нет. В чужом арьергарде этот собственный штраф тоже не применяется.')],
    ['6. Отступление, бегство и победа', list('В своём тылу живой корабль считается отведённым: он не стреляет, но ещё остаётся на поле и может быть атакован вошедшим туда врагом.', 'Счётчик увеличивается в конце каждого завершённого раунда в своём тылу, включая раунд входа. После трёх таких раундов подряд корабль окончательно сбегает и больше не участвует.', 'До третьего завершения его можно вернуть приказом в свой арьергард или дальше; выход обнуляет счётчик. Приказ, выполненный до конца третьего раунда, успевает вернуть корабль. Чужой тыл не запускает собственное бегство.', 'Победа наступает, когда у всех остальных сторон нет живых несбежавших кораблей: они уничтожены или окончательно сбежали. Если таких сторон не осталось вообще — ничья. Отведённые, но ещё не сбежавшие корабли мешают завершению боя.', 'Доля HP — показатель состояния, НЕ правило выбора победителя. При остановке незавершённого боя победитель не назначается. Бегство — не потеря корабля.')],
    ['7. Командиры: реальные приоритеты', '<p>Назначаются в редакторе флота: имя и характер. Бонусов к характеристикам командир не даёт. Порог отступления — доля текущего HP от максимального HP корабля; проверка вероятности выполняется при решении о движении.</p>' + table(['Характер', 'Приоритет цели', 'Движение и отступление'], [
      ['Агрессивный', 'Наибольшая (атака от + атака до) × число атак', 'Не начинает отступление. Из центра при наличии только дальних целей с вероятностью 25% сближается.'],
      ['Осторожный', 'Наименьший текущий HP', 'При HP ≤ 25% или безнадёжном превосходстве врагов — 50% начать отход.'],
      ['Уравновешенный', 'Наименьшая сумма порогов защиты', 'При HP ≤ 15% — 25% начать отход.'],
      ['Тактик', 'Наименьший текущий HP', 'При HP ≤ 20% — 35% начать отход.']
    ]) + list('Безнадёжное превосходство для осторожного: у КАЖДОГО живого несбежавшего врага атака от > защиты до этого корабля и защита от ≥ его атаки до.', 'Начав отход, автоматический корабль продолжает кратчайший путь к своему тылу и ждёт бегства. Если доступных целей нет, остальные сближаются. Командиры также ищут более выгодный сектор, когда все доступные обычные выстрелы блокируются защитой и поправками.', 'Автоматический корабль без командующего до движения может пропустить действие (18%) или выполнить случайный допустимый манёвр без входа в свой тыл (ещё 10%). Иначе атакует доступную цель или сближается. Эти проверки не применяются к стороне игроков и к кораблю с назначенным приказом.', '«Сторона игроков» не двигается и не отступает автоматически; без приказа стреляет по доступным целям. Характер её командира по-прежнему определяет приоритет цели, но не движение.')],
    ['8. Приказы игроков: область, HP, количество', '<ol><li>Перед стартом отметьте «Сторона игроков».</li><li>В приказах выберите сторону → её флот → весь флот или конкретный тип. Смена стороны обновляет флоты, смена флота — типы.</li><li>Задайте условие HP, количество и сектор назначения; нажмите «+ Приказ». Можно поставить несколько приказов и удалить лишний через × в очереди.</li><li>Нажмите «Проиграть следующий раунд»: очередь применяется к следующему новому раунду и очищается.</li></ol>' + list('Условия: любое HP, < N, > N, = N, ≤ N, ≥ N. N — абсолютные текущие HP, НЕ проценты. Например, «= 2» выбирает корабли ровно с 2 HP.', 'Количество ограничивает число подходящих живых несбежавших кораблей; 0 в форме означает всех. Отбор делается ДО перемешивания хода, по стабильному порядку кораблей флота / типов, а не по тому, кто ходит первым.', 'Первый подходящий приказ в очереди получает корабль; последующие не перехватывают уже назначенный. Так можно первым приказом отвести 3 корабля с HP ≤ 1, вторым отправить остальных в центр.', 'Приказ задаёт цель маршрута, не телепорт: выполняется один допустимый шаг за раунд. Он отменяет автоматический отход для назначенного корабля. Если корабль уже в назначенном секторе, действие может атаковать.', 'Приказы действуют только один следующий раунд; для продолжения движения добавьте их снова. Сбежавших вернуть нельзя, ещё отведённых — можно.')],
    ['9. Разовые бонусы бросков', list('Выберите область: все корабли, конкретная сторона, флот или тип внутри флота. Введите целые «Атака ±» и «Защита ±»; «+ Бонус» добавляет запись в очередь, × удаляет.', 'Все подходящие бонусы складываются: общий +2 и бонус типа +3 дают этому типу +5. Отрицательные значения разрешены. Бонус атаки относится к стрелку, защиты — к цели.', 'Поправки меняют только итоговые броски, не HP, численность, число действий и не исходные диапазоны для критов. Постоянные настройки арьергарда применяются отдельно.', 'Очередь бонусов применяется лишь к следующему новому раунду и очищается вместе с приказами. В полном расчёте она действует только на первый рассчитанный раунд; для следующих задавайте заново.')],
    ['10. Раунды, полный расчёт и утверждение', list('«Предыдущий» / «Следующий» показывают уже рассчитанную историю, включая раунд 0: восстанавливаются HP, позиции, отвод и бегство. Просмотр не перебрасывает кубики.', '«Проиграть следующий раунд» добавляет один раунд к КОНЦУ расчёта, не к просматриваемому старому раунду. Текущие ранения и случайная последовательность сохраняются.', '«Симулировать полное сражение» считает до победы или ничьей. Та же кнопка «Остановить расчёт» приостанавливает его; после остановки можно задать новые приказы / бонусы и продолжить.', 'После 50 раундов подряд без изменений HP, позиций, бегства и счётчиков тыла полный расчёт приостанавливается БЕЗ победителя. Измените приказы или бонусы; это не ничья и не победа по HP.', 'Анимация не влияет на механику. При уменьшенном движении она отключается. Если доступна «Показать итог», она лишь пропускает показ.', '«Утвердить раунд N» сохраняет именно просматриваемый раунд N (N ≥ 1), даже если бой ещё идёт. До утверждения данные карты и численность флотов не меняются; закрытие × / Esc и возврат к расстановке не списывают корабли.', 'Утверждение добавляет запись в историю события и обновляет число выживших в каждом флоте и типе. Сохраняются активные, отведённые и сбежавшие; только уничтоженные вычитаются. Если состав флота изменился после старта, потребуется новый расчёт.', 'В досье события записи сражений раскрываются отдельно. Новый самостоятельный бой начинает уцелевшие корабли с ПОЛНОГО HP; продолжение текущего расчёта сохраняет ранения. Итоги локальные до экспорта и публикации.')],
    ['11. Лимиты и чтение отчёта', list('Редактор: 1–20 типов на флот, суммарно до 500 кораблей на флот; HP 1–100, пороги атаки / защиты 0–1000, нижний ≤ верхнего. Численность может быть 0, но пустой флот не вступает в бой.', 'В бою максимум 1500 кораблей и 2 млн потенциальных действий за раунд. У числа мультиатак нет отдельного фиксированного потолка: ограничена общая нагрузка. При ошибке уменьшите состав или число действий.', 'Полный интерактивный расчёт не ограничен старым лимитом 1000 раундов: его ограничивают завершение, ручная остановка и пауза после 50 неизменных раундов.', '«Уцелело» включает все живые корабли, в том числе сбежавшие; «Потеряно» — уничтоженные. «В тылу» — ещё отведённые, «Сбежало» — окончательно покинувшие поле, «Активно» — остальные живые.', 'Журнал сохраняет первые 5000 действий (не только выстрелы). Просмотр выбранного раунда показывает до 100 последних сохранённых записей этого раунда; более поздние действия могут не попасть в журнал, но расчёт и сводка продолжаются.')]
  ];
  const mainTopics = [
    ['Карта и клавиатура', table(['Действие', 'Управление'], [
      ['Двигать / масштабировать', 'Перетаскивание мышью или пальцем; колёсико / два пальца. Кнопки + и −.'],
      ['Поиск по названию', '<kbd>/</kbd>'],
      ['Навигация', '<kbd>N</kbd> / <kbd>Т</kbd>'],
      ['Слои', '<kbd>L</kbd> / <kbd>Д</kbd>'],
      ['Известная Галактика', '<kbd>G</kbd> / <kbd>П</kbd> или ◎'],
      ['Обзор Вселенной', '<kbd>0</kbd> или ⌖'],
      ['Приблизить / отдалить', '<kbd>+</kbd> / <kbd>=</kbd> и <kbd>−</kbd>'],
      ['Редактировать выбранное досье', '<kbd>E</kbd> / <kbd>У</kbd> (физическая клавиша E)'],
      ['Закрыть окно / досье', '<kbd>Esc</kbd> или ×']
    ]) + list('Горячие клавиши карты не срабатывают в полях ввода и открытых диалогах. E / У без выбранного объекта открывает пульт; с выбранным — его форму редактирования.', 'Кнопка ⛶ включает полноэкранный режим, если браузер разрешает. На телефоне нижние кнопки открывают объекты, слои и досье или переключают обзор. Навигация, слои и досье имеют собственные кнопки сворачивания / закрытия.')],
    ['Навигация, слои и досье', list('Ищите название системы, флота или события. Фильтры «Все», «Избранное», «Флоты», «События» меняют список; группы можно раскрывать по отдельности или кнопкой «Свернуть». Выбор в списке или на карте открывает досье и центрирует объект.', 'В слоях отдельно включаются области влияния, подписи систем, события и флоты. «Выделить державу» допускает несколько держав и приглушает остальные; «Все державы» снимает выделение. Это не меняет данные и не удаляет объекты.', 'В досье видны принадлежность, координаты, описание и связанные флоты. «Центрировать» возвращает камеру к объекту; название связанного флота открывает его карточку. У флота показаны типы кораблей и командир, у боевого события — история сражений.', '☆ / ★ переключает избранное только на этом устройстве / в этом браузере. Это не публикация. Описание, объекты системы, их места и ресурсы раскрываются отдельно; прокрутите досье до нижних разделов.')],
    ['Локальный редактор и вложенные объекты', '<ol><li>Откройте пульт ✎ для создания системы, флота или события. Для изменения выберите объект → E / У либо пульт → «Редактировать досье».</li><li>Заполните название и описание. У системы есть краткое описание для наведения, принадлежность, столичный статус и координаты; у события — тип (информационное / боевое), цвет и принадлежность.</li><li>Для позиции введите X 0–2559, Y 0–2047 или «Выбрать место на карте» и нажмите внутри Известной Галактики. Перетаскивание двигает камеру, не выбирает точку. «Отмена» возвращает форму.</li><li>Нажмите «Сохранить». Закрытие формы без сохранения не применяет правки.</li></ol>' + list('Состав системы редактируется В ЭТОЙ ЖЕ форме. «Создать объект» добавляет планету, звезду, газовый гигант, искусственный объект, спутник, пояс астероидов, чёрную дыру или туманность; задайте название, цвет, принадлежность и описание.', 'Внутри объекта добавляйте места и ресурсы: интересное место, город, базу, руины, шахту, минералы, энергию, воду, биоресурсы или промышленность. У каждой записи своё название, значок и описание. Это вложенное досье, не отдельная точка карты.', 'Перетаскивайте за ⠿: объекты меняют порядок, место / ресурс переносится на другой объект системы (также через «Перенести в объект»). Кнопки ↑ / ↓ меняют порядок объектов. Карточки можно свернуть по одной или все сразу. Вся вложенная структура применяется общей кнопкой «Сохранить» формы системы.', 'У флота выберите размещение в системе или событии, принадлежность, цвет и отношение; добавьте типы кораблей и, при необходимости, командира. Флот перемещается сменой размещения, не отдельными X / Y.', 'Удаление требует подтверждения. При удалении системы или события удаляются и прикреплённые флоты. Закрытие редактора территорий, напротив, сохраняет его правки автоматически.')],
    ['Территории: практический порядок', list('Пульт → «Редактор границ» → фракция → кисть / ластик → радиус → штрих на карте. В режиме рисования участок меняет владельца; в режиме «Камера» двигайте и масштабируйте карту.', 'Ручной слой сохраняется после штриха. «Перестроить по системам» заменяет его расчётом от ближайших систем; «Отмена» возвращает предыдущее состояние. Принадлежность самих систем от кисти не меняется.', 'Подробные ограничения, отмена и сохранение — в справке редактора границ.') + '<button type="button" class="guide-link" data-guide-open="territory-help">Открыть справку по территориям →</button>'],
    ['Сражение: быстрый старт', '<ol><li>Создайте боевое событие или выберите существующее → «Провести сражение».</li><li>Распределите флоты между 2–6 сторонами. Для ручного управления отметьте «Сторона игроков» и разместите минимум 30% кораблей стороны в центре (округление вверх).</li><li>Начните бой: откроется раунд 0. Задайте приказы / бонусы, затем проиграйте один раунд или включите полный расчёт.</li><li>Просматривайте историю и утвердите нужный раунд, чтобы сохранить потери и запись в событии.</li></ol>' + list('Успешная атака или подтверждённый крит снимает ровно 1 HP. Движение занимает одно действие, максимум один шаг на корабль за раунд; оставшиеся мультиатаки могут стрелять.', 'Свой тыл не стреляет: после трёх завершённых раундов подряд корабль сбегает. До этого его можно вернуть приказом. Бонусы и приказы действуют только на следующий новый раунд.', 'Победа — когда остальные стороны уничтожены или окончательно сбежали, не по доле HP. Пока итог не утверждён, карта не меняется.') + '<button type="button" class="guide-link" data-guide-open="combat-help">Открыть все правила боя →</button>'],
    ['Черновик, резервная копия и публикация', list('Сохранённые формы, утверждённые бои и границы хранятся локально в этом браузере. Они не синхронизируются между устройствами и не меняют опубликованный сайт автоматически.', 'Пульт → «Резервная копия (.json)» сохраняет данные, включая вложенные объекты, составы флотов, историю боёв и территории. Делайте копию перед обновлением сайта или очисткой браузера.', '«Восстановить из JSON» проверяет файл и после подтверждения заменяет текущий локальный черновик. «Отменить локальные изменения» возвращает опубликованную исходную версию; текущие правки будут потеряны.', '«Экспорт для GitHub Pages (.zip)» создаёт сайт с текущими данными. Распакуйте архив и загрузите его содержимое в корень сайта GitHub Pages. Простое скачивание архива ещё не публикует изменения.', 'Если браузер не сохранил черновик, не закрывайте страницу до экспорта JSON. Если ZIP недоступен при открытии локального файла, используйте опубликованный сайт или автономную версию и сохраните JSON.')]
  ];
  function replace(id, title, intro, items) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    const body = dialog.querySelector(':scope > .sector-window-body');
    if (!body) { console.warn(`guide-v31: ${id} requires sector-ui.js first`); return; }
    dialog.classList.add('guide-v31');
    body.classList.add('guide-body');
    body.innerHTML = `<div class="guide-intro"><h2>${title}</h2><p>${intro}</p></div>${topics(items)}<footer class="guide-end">Конец справки · Закрыть: × в заголовке или Esc</footer>`;
    body.setAttribute('aria-label', title);
    body.tabIndex = 0;
    body.addEventListener('click', event => {
      const link = event.target.closest('[data-guide-open]');
      if (link) open(link.dataset.guideOpen);
    });
    // Existing showModal wrappers reset the dialog, not its scroll body.
    new MutationObserver(() => {
      if (dialog.open) body.scrollTop = 0;
    }).observe(dialog, {attributes: true, attributeFilter: ['open']});
  }
  function open(id = 'help') {
    const dialog = document.getElementById(id);
    if (!dialog) return false;
    if (!dialog.open) dialog.showModal();
    const body = dialog.querySelector('.guide-body');
    if (body) body.scrollTop = 0;
    return true;
  }
  function install() {
    replace('help', 'Справочник голокарты', 'Выберите объект на карте или в навигации. Досье показывает его данные; пульт ✎ позволяет создавать и редактировать локальный черновик. Ниже — краткий обзор и раскрываемые темы.', mainTopics);
    replace('combat-help', 'Правила сражения', 'Расстановка → один или несколько раундов → просмотр → утверждение. Все правила ниже соответствуют текущему расчёту; раскройте нужную тему.', battleTopics);
    replace('territory-help', 'Работа с территориями', 'Кисть меняет слой границ, не досье систем. Начните с выбора фракции и инструмента; для навигации переключитесь в камеру.', territoryTopics);
  }
  window.GalaxyGuideV31 = Object.freeze({install, open});
  install();
})();

;
/* ui-v31.js */
/* UI decoration only: no data, dialog-flow, guide-layout or layer-default changes. */
(() => {
  'use strict';
  const obsoleteNote = 'Границы по системам; ручные правки — в редакторе территорий.';
  const fieldSelector = 'dialog input, dialog textarea, dialog select, #territory-tools input, #territory-tools select';
  let frame = 0;

  function decorate() {
    frame = 0;
    document.querySelectorAll('#layers .layer-note').forEach(note => {
      if (note.textContent.trim() === obsoleteNote) note.remove();
    });
    document.querySelectorAll('button').forEach(button => {
      const label = (button.getAttribute('aria-label') || button.textContent).trim();
      if (/^Удалить(?:\s|$)/u.test(label)) button.classList.add('ui-v31-danger');
      // A disabled button must not inherit any old enabled :hover rule.
      // Snapshot before hover; never derive an idle state from a hover state.
      if (!button.matches(':hover')) {
        const style = getComputedStyle(button);
        const values = {
          color: style.color, border: style.borderColor,
          bg: style.backgroundColor, shadow: style.boxShadow
        };
        Object.entries(values).forEach(([key, value]) => {
          const property = '--ui-v31-idle-' + key;
          if (button.style.getPropertyValue(property) !== value) {
            button.style.setProperty(property, value);
          }
        });
      }
    });
    document.querySelectorAll(fieldSelector).forEach(field => {
      if (field.classList.contains('ui-v31-field')) return;
      if (/^(checkbox|radio|range|color|file|hidden|button|submit|reset)$/u.test(field.type)) return;
      const width = field.getBoundingClientRect().width;
      const parentWidth = field.parentElement.getBoundingClientRect().width;
      // Only full-row or full-grid-cell fields. Keep 60/70px stats and
      // multiattack controls compact, even when their containing row is wide.
      if (width > 0 && parentWidth > 0 && width >= parentWidth * 0.88) {
        field.classList.add('ui-v31-field');
      }
    });
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(decorate);
  }
  const observer = new MutationObserver(records => {
    if (records.some(record => record.type === 'childList' ||
      ['open', 'hidden', 'disabled', 'aria-disabled'].includes(record.attributeName))) schedule();
  });
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['open', 'hidden', 'disabled', 'aria-disabled']
  });
  window.addEventListener('resize', schedule, { passive: true });
  document.addEventListener('pointerout', schedule, { passive: true });
  decorate();
})();

;
/* commander-registry.js */
'use strict';
(()=>{
function traits(){return window.BattleEngine.traits;}
function fleetFaction(f,d){if(Object.prototype.hasOwnProperty.call(f,'faction'))return f.faction||null;const s=[...(d.systems||[]),...(d.events||[])].find(s=>String(s.id)===String(f.system));return s?.factionGroup||s?.group||null;}
function compatible(){return true;}
function resolveFleet(f,d=window.galaxyApp?.getData()){const c=f.commanderId?(d?.commanders||[]).find(c=>c.id===f.commanderId):f.commander||null;return {...f,commander:c||null};}
function cosmetics(c){const description=c.description===undefined?'':c.description,portrait=c.portrait==null?null:c.portrait;if(typeof description!=='string'||description.length>1200)throw Error('Описание командующего: не более 1200 символов.');if(portrait!==null&&(typeof portrait!=='string'||portrait.length>600000||!/^data:image\/(png|jpeg|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(portrait)||!portrait.split(',')[1]))throw Error('Портрет: PNG, JPEG или WebP, не более 600 КБ.');return {description,portrait};}
function commanderLevel(c){const level=c?.level===undefined?5:c.level;if(!Number.isInteger(level)||level<1||level>10)throw Error('Уровень командующего: целое число от 1 до 10.');return level;}
function normalize(list,groups){if(list==null)return [];if(!Array.isArray(list)||list.length>2000)throw Error('Неверный реестр командующих.');const ids=new Set(),keys=new Set(groups.map(g=>g.key));return list.map(c=>{if(!c||typeof c.id!=='string'||!c.id.trim()||c.id.length>160||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>100||(c.factionGroup!=null&&!keys.has(c.factionGroup))||typeof c.personality!=='string'||(window.BattleEngine?.personalities&&!window.BattleEngine.personalities[c.personality]))throw Error('Некорректный командующий.');if(!Array.isArray(c.traits)||c.traits.length>4)throw Error('Выберите не более четырёх черт.');if(new Set(c.traits).size!==c.traits.length||c.traits.some(id=>!Object.hasOwn(traits(),id)))throw Error('Неизвестная или повторная черта командующего.');ids.add(c.id);return {...c,level:commanderLevel(c),id:c.id,name:c.name.trim(),factionGroup:c.factionGroup||null,personality:c.personality,traits:[...c.traits],...cosmetics(c)};});}
window.CommanderRegistry={resolveFleet,compatible,fleetFaction,normalize,cosmetics,traits,commanderLevel,open:()=>{}};
if(typeof document==='undefined')return;
const app=window.galaxyApp,$=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function traitHTML(ids){return (ids||[]).map(id=>{const t=traits()[id];if(!t)return '';return `<div class="commander-trait"><strong>${escape(t.name||id)}</strong><p class="trait-bonus">${escape(t.bonus||t.description||'')}</p><p class="trait-downside">${escape(t.downside||'Без штрафа.')}</p>${t.scope?`<p class="trait-scope">Где: ${escape(t.scope)}</p>`:''}${t.duration?`<p class="trait-duration">Когда: ${escape(t.duration)}</p>`:''}</div>`;}).join('');}
window.CommanderRegistry.traitHTML=traitHTML;
const dialog=document.createElement('dialog');dialog.id='commander-registry-dialog';dialog.className='sector-window';dialog.setAttribute('aria-labelledby','registry-title');dialog.innerHTML='<header class="dialog-head standard-header"><h2 id="registry-title">КОМАНДУЮЩИЕ</h2><button type="button" class="icon-btn" id="registry-close" aria-label="Закрыть">×</button></header><div class="sector-window-body"><div id="registry-list"><button type="button" id="registry-create">+ Создать командующего</button><p class="registry-note">До четырёх черт. Один командующий может возглавлять несколько флотов любой фракции. Фракция — только категория и герб.</p><div id="registry-categories"></div></div><form id="registry-form" hidden><button type="button" id="registry-back">← К списку</button><div class="registry-fields"><label>Имя<input id="registry-name" maxlength="100" required></label><label>Фракция<select id="registry-faction"></select></label><label>Характер<select id="registry-personality"></select></label><label>Уровень · 1–10<input id="registry-level" type="number" min="1" max="10" step="1" value="5" required></label></div><p id="registry-character-description"></p><fieldset><legend>Черты · не более 4</legend><div id="registry-traits" class="registry-trait-grid"></div></fieldset><p id="registry-error" role="alert"></p><button type="submit">Сохранить</button></form></div>';document.body.append(dialog);
let editingId=null,portrait=null,uploadGeneration=0,uploadPending=false;
const profile=document.createElement('div');profile.className='registry-profile-editor';profile.innerHTML='<div class="registry-portrait-control"><img id="registry-portrait-preview" class="commander-portrait" alt="Портрет командующего"><div><button id="registry-portrait-choose" type="button">Выбрать портрет</button><button id="registry-portrait-reset" type="button">Сбросить к гербу</button><input hidden id="registry-portrait-file" type="file" accept="image/png,image/jpeg,image/webp"><p>PNG / JPEG / WebP · изображение до 512 px</p></div></div><label for="registry-author-description">Авторское описание</label><textarea id="registry-author-description" maxlength="1200" rows="4" placeholder="История или описание, написанное автором"></textarea><p>До 1200 символов. Не заполняется автоматически.</p>';$('registry-character-description').after(profile);
function portraitSource(c){return c.portrait||window.FactionCrests?.get(c.factionGroup||null)||'';}
function portraitHTML(c){const src=portraitSource(c);return src?`<img class="commander-portrait" src="${escape(src)}" alt="Портрет командующего" loading="lazy">`:'';}
window.CommanderRegistry.portraitSource=portraitSource;
function previewPortrait(){const image=$('registry-portrait-preview'),src=portraitSource({portrait,factionGroup:$('registry-faction').value||null});image.hidden=!src;if(src)image.src=src;else image.removeAttribute('src');image.classList.toggle('is-crest',!portrait);}
async function preparePortrait(file){if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Выберите PNG, JPEG или WebP.');if(file.size>20000000)throw Error('Исходное изображение: не более 20 МБ.');const bitmap=await createImageBitmap(file);try{if(!bitmap.width||!bitmap.height)throw Error('Не удалось прочитать изображение.');const scale=Math.min(1,512/bitmap.width,512/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);for(const quality of [.86,.7,.5]){let encoded=canvas.toDataURL('image/webp',quality);if(!encoded.startsWith('data:image/webp;'))encoded=canvas.toDataURL('image/jpeg',quality);if(encoded.length<=600000){cosmetics({portrait:encoded});return encoded;}}throw Error('Не удалось уменьшить портрет до 600 КБ.');}finally{bitmap.close();}}
window.CommanderRegistry.preparePortrait=preparePortrait;
$('registry-portrait-choose').onclick=()=>$('registry-portrait-file').click();
$('registry-portrait-reset').onclick=()=>{uploadGeneration++;uploadPending=false;portrait=null;$('registry-portrait-file').value='';$('registry-error').textContent='';previewPortrait();};
$('registry-faction').addEventListener('change',previewPortrait);
$('registry-portrait-file').onchange=async()=>{const file=$('registry-portrait-file').files[0];if(!file)return;const generation=++uploadGeneration;uploadPending=true;$('registry-error').textContent='';try{const encoded=await preparePortrait(file);if(generation===uploadGeneration){portrait=encoded;previewPortrait();}}catch(error){if(generation===uploadGeneration)$('registry-error').textContent=error.message||'Не удалось прочитать изображение.';}finally{if(generation===uploadGeneration)uploadPending=false;$('registry-portrait-file').value='';}};
function commit(d){const clean=window.galaxyEditor.normalize({...d,version:7});app.replaceData({...d,...clean});if(!window.galaxyEditor.save())throw Error('Не удалось сохранить черновик.');return app.getData();}
function render(){uploadGeneration++;uploadPending=false;const d=app.getData();$('registry-list').hidden=false;$('registry-form').hidden=true;const categories=[...d.groups,{key:null,label:'Без принадлежности',color:'#a8dce7'}];$('registry-categories').innerHTML=categories.map(g=>{const cs=(d.commanders||[]).filter(c=>c.factionGroup===g.key);return `<section class="registry-category"><h3 style="border-color:${escape(g.color)}">${escape(g.label)} <span>${cs.length}</span></h3>${cs.length?cs.map(c=>{const assigned=d.fleets.filter(f=>f.commanderId===c.id),options=d.fleets.filter(f=>compatible(c,f,d)&&f.commanderId!==c.id);return `<article class="commander-card" data-commander-id="${escape(c.id)}"><div class="commander-card-head">${portraitHTML(c)}<h4>${escape(c.name)}<span class="commander-level">Уровень ${commanderLevel(c)}</span></h4><button type="button" data-action="edit">Изменить</button><button type="button" data-action="delete">Удалить</button></div><p class="commander-author-summary">${escape((c.description||'').slice(0,180))}${(c.description||'').length>180?'…':''}</p><p>${escape(window.BattleEngine?.personalities[c.personality]?.name||c.personality)} · ${escape(g.label)}</p><div class="registry-trait-grid">${traitHTML(c.traits)}</div><p>Назначен на флоты: ${assigned.length}</p>${assigned.map(f=>`<div class="registry-assignment"><span>${escape(f.name)}</span><button type="button" data-action="unassign" data-fleet-id="${escape(f.id)}">Снять</button></div>`).join('')}<div class="registry-assignment"><select aria-label="Назначить на флот">${options.length?'<option value="">Выберите любой флот</option>'+options.map(f=>`<option value="${escape(f.id)}">${escape(f.name)}${f.commanderId?' · сменить командующего':''}</option>`).join(''):'<option value="">Нет доступных флотов</option>'}</select><button type="button" data-action="assign" ${options.length?'':'disabled'}>Назначить</button></div></article>`;}).join(''):'<p class="registry-empty">Командующих пока нет.</p>'}</section>`;}).join('');}
function edit(c=null){uploadGeneration++;uploadPending=false;portrait=c?.portrait||null;$('registry-author-description').value=c?.description||'';editingId=c?.id||null;$('registry-list').hidden=true;$('registry-form').hidden=false;$('registry-error').textContent='';$('registry-name').value=c?.name||'';$('registry-level').value=commanderLevel(c);const d=app.getData();$('registry-faction').replaceChildren(new Option('Без принадлежности',''),...d.groups.map(g=>new Option(g.label,g.key)));$('registry-faction').value=c?.factionGroup||'';previewPortrait();$('registry-personality').replaceChildren(...Object.entries(window.BattleEngine?.personalities||{balanced:{name:'Сбалансированный'}}).map(([k,v])=>new Option(v.name,k)));$('registry-personality').value=c?.personality||'balanced';$('registry-personality').onchange();$('registry-traits').innerHTML=Object.keys(traits()).map(id=>`<label class="registry-trait-choice"><input type="checkbox" value="${escape(id)}" ${(c?.traits||[]).includes(id)?'checked':''}>${traitHTML([id])}</label>`).join('');limitTraits();}
function limitTraits(){const inputs=[...$('registry-traits').querySelectorAll('input')],n=inputs.filter(i=>i.checked).length;inputs.forEach(i=>i.disabled=n>=4&&!i.checked);}
$('registry-traits').onchange=limitTraits;
$('registry-personality').onchange=()=>{$('registry-character-description').textContent=window.BattleEngine?.personalities[$('registry-personality').value]?.description||'';};
$('registry-close').onclick=()=>dialog.close();$('registry-back').onclick=render;$('registry-create').onclick=()=>edit();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$('registry-form').onsubmit=e=>{e.preventDefault();try{if(uploadPending)throw Error('Дождитесь обработки портрета.');const d=app.getData(),c={level:Number($('registry-level').value),description:$('registry-author-description').value,portrait,id:editingId||'cmd-'+crypto.randomUUID(),name:$('registry-name').value.trim(),factionGroup:$('registry-faction').value||null,personality:$('registry-personality').value,traits:[...$('registry-traits').querySelectorAll('input:checked')].map(i=>i.value)};normalize([c],d.groups);d.commanders=[...(d.commanders||[]).filter(x=>x.id!==c.id),c];commit(d);render();}catch(e){$('registry-error').textContent=e.message;}};
$('registry-categories').onclick=e=>{const b=e.target.closest('button[data-action]'),card=b?.closest('[data-commander-id]');if(!card)return;const d=app.getData(),c=d.commanders.find(c=>c.id===card.dataset.commanderId);try{if(b.dataset.action==='edit')return edit(c);if(b.dataset.action==='delete'){const assigned=d.fleets.filter(f=>f.commanderId===c.id);if(!confirm(`Удалить «${c.name}»? Назначения на ${assigned.length} флотов будут сняты.`))return;d.commanders=d.commanders.filter(x=>x.id!==c.id);assigned.forEach(f=>{f.commanderId=null;f.commander=null;});}else if(b.dataset.action==='unassign'){if(!confirm('Снять командующего с флота?'))return;const f=d.fleets.find(f=>f.id===b.dataset.fleetId);f.commanderId=null;f.commander=null;}else{const f=d.fleets.find(f=>f.id===card.querySelector('select').value);if(!f)return;if((f.commanderId||f.commander)&&!confirm('Заменить текущего командующего?'))return;f.commanderId=c.id;}commit(d);render();}catch(err){app.toast(err.message);}};
window.CommanderRegistry.open=()=>{render();if(!dialog.open)dialog.showModal();};
const entry=document.createElement('button');entry.id='editor-commanders';entry.type='button';entry.textContent='Командующие · создать / назначить';entry.onclick=()=>{$('admin-dialog')?.close();window.CommanderRegistry.open();};const anchor=$('editor-new-fleet');if(anchor)anchor.after(entry);
document.addEventListener('galaxy-data-changed',()=>{if(dialog.open&&$('registry-form').hidden)render();});
document.dispatchEvent(new Event('commander-registry-ready'));
})();

;
/* guide-v34.js */
'use strict';
(()=>{function topic(title,html){const e=document.createElement('details');e.className='guide-topic';const s=document.createElement('summary');s.textContent=title;const b=document.createElement('div');b.className='guide-topic-content';b.innerHTML=html;e.append(s,b);return e;}const mechanics='<p>В пульте откройте «Командиры». Создайте командира в категории своей фракции, выберите характер и до четырёх черт. Затем назначьте его совместимым флотам. Один командир может управлять несколькими флотами; его черты действуют на корабли каждого назначенного флота.</p><p>Старые командиры, созданные прямо в редакторе флота, продолжают работать. Реестр хранится в локальном черновике, JSON и экспорте сайта. Изменение карточки обновляет назначенные флоты для будущих боёв, но не пересчитывает уже начатый бой или историю.</p><p>Приказ на перемещение кораблю в Столкновении может быть не выполнен. Проверка делается один раз за раунд перед попыткой движения. Чем ниже доля оставшегося HP, тем выше риск; черты командира его изменяют. При отказе корабль не двигается, но сохраняет свои атаки и стреляет по допустимым целям. Для приказов из арьергарда или тыла этой проверки нет.</p><p>Черты не меняют исходный бросок для критов. Разовый натиск включается только при входе в центр в текущем раунде, не от начальной расстановки; в новом раунде он сбрасывается. Числа и ограничения смотрите в карточках черт.</p>';for(const id of ['help','combat-help']){const body=document.querySelector('#'+id+' .guide-body');if(!body)continue;const heading=id==='help'?'Командиры, черты и дисциплина':'Командиры: реестр, черты и неповиновение';body.insertBefore(topic(heading,mechanics),body.querySelector('.guide-end'));body.insertBefore(topic('Настройка флота: принадлежность, управление и командир','<ul><li>В редакторе укажите размещение флота и его принадлежность. Управление задаётся отдельно: ручное или автоматическое; это не тип флота и не его отношение к другим сторонам.</li><li>Командира можно назначить независимо от ручного или автоматического управления. Выберите командира совместимой фракции из реестра или оставьте флот без командующего. Один командир может быть назначен нескольким флотам.</li><li>Состав задаётся типами кораблей: количество, прочность (HP), диапазоны атаки и защиты, модель и мультиатака. Название модели само по себе не даёт боевых бонусов.</li><li>Перед боем проверьте состав сторон и начальное размещение в секторе «Столкновение» и собственном арьергарде. Ручные приказы задаются на следующий раунд; характер и черты назначенного командира продолжают влиять на допустимые атаки.</li></ul>'),body.querySelector('.guide-end'));}const body=document.querySelector('#combat-help .guide-body');if(body){const old=[...body.querySelectorAll('.guide-topic')].find(d=>d.querySelector('summary')?.textContent.startsWith('7.'));if(old){const target=old.querySelector('.guide-topic-content');target.replaceChildren();const intro=document.createElement('p');intro.textContent='Характер задаёт приоритет целей и поведения. Командир не обязан быть лучшим в любой ситуации: оценивайте также сохранённые корабли, состав флота и условия сектора.';target.append(intro);for(const p of Object.values(BattleEngine.personalities||{})){const h=document.createElement('h4');h.textContent=p.name;const text=document.createElement('p');text.textContent=p.description;target.append(h,text);}}const chances=document.createElement('p');chances.textContent='Риск неповиновения теперь зависит от уровня командира, повреждений и черт. Подробная формула и предел 70% приведены в разделе «Уровни, черты кораблей и условия сражения».';body.insertBefore(chances,body.querySelector('.guide-end'));}})();

;
/* guide-v35.js */
'use strict';
(()=>{const body=document.querySelector('#combat-help .guide-body');if(!body)return;const section=document.createElement('details');section.className='guide-topic';section.innerHTML='<summary>Термины, баланс и черты командиров</summary><div class="guide-topic-content"><dl><dt>Столкновение</dt><dd>Общий центральный сектор. «Авангард» в названиях черт — корабли, находящиеся в Столкновении, а не отдельный сектор.</dd><dt>Собственный / чужой арьергард и тыл</dt><dd>Принадлежность сектора определяется стороной корабля. Черта для собственного сектора не распространяется на такой же сектор противника, если это явно не указано.</dd><dt>Результат броска атаки / защиты</dt><dd>Исходный бросок плюс все подходящие бонусы и штрафы. Черты не изменяют исходный диапазон и проверку максимума для критов.</dd><dt>Действие атаки</dt><dd>Одна возможность атаки в раунде. Обычное перемещение расходует её; максимум одно перемещение корабля за раунд сохраняется и для бесплатного возврата.</dd><dt>Отвод и окончательное бегство</dt><dd>В собственном тылу корабль отведён, ещё доступен врагу в том же тылу и может вернуться. Обычное окончательное бегство — после трёх завершённых раундов подряд; «Быстрая эвакуация» заменяет срок двумя и даёт указанный штраф защиты. После бегства вернуть корабль нельзя.</dd><dt>Бесплатный возврат</dt><dd>Только собственный тыл → собственный арьергард до бегства. «Экстренное возвращение» сохраняет все действия атаки, но даёт −2 к результатам бросков атаки до конца текущего раунда. В следующем раунде штраф сбрасывается. Дальнейшее перемещение в этом же раунде запрещено.</dd><dt>Неповиновение</dt><dd>Отказ выполнить явный приказ перемещения из Столкновения. Проверка один раз за раунд; отказ сохраняет атаки. Поправки вероятности в чертах указаны в %, итог ограничен 0–50%. Знак % в чертах означает прямую поправку к шансу: базовые 10% и снижение на 4% дают 6%, а не 9,6%.</dd><dt>Сложение черт</dt><dd>До четырёх разных черт. Подходящие поправки складываются с настройками стороны и разовыми бонусами раунда; условия каждой черты проверяются отдельно. Черты не восстанавливают HP и не возвращают сбежавших.</dd></dl><div id="trait-reference-v35"></div></div>';const policy=document.createElement('p');policy.textContent='При нескольких вражеских сторонах командиры используют вероятностный выбор с учётом своего характера и огневой угрозы, а не всегда стреляют в одну и ту же цель. Если есть цель, по которой возможен обычный урон, она предпочтительнее цели с гарантированно блокируемым обычным выстрелом. В дуэлях приоритеты характеров сохраняются. Черты отхода могут сохранять корабли ценой уступки поля.';section.querySelector('.guide-topic-content').prepend(policy);const list=section.querySelector('#trait-reference-v35');for(const t of Object.values(BattleEngine.traits)){const card=document.createElement('article');card.className='commander-trait';for(const [tag,text] of [['h4',t.name],['p',t.bonus],['p',t.downside],['p','Где: '+t.scope],['p','Когда: '+t.duration]]){const e=document.createElement(tag);e.textContent=text;card.append(e);}list.append(card);}body.insertBefore(section,body.querySelector('.guide-end'));const old=[...body.querySelectorAll('li')].find(e=>e.textContent.startsWith('После трёх таких раундов'));if(old)old.append(' При черте «Быстрая эвакуация» срок — два раунда; штраф защиты указан в справочнике черт.');})();

;
/* controls-v35.js */
'use strict';
/* UI-only decoration. Existing registry handlers continue owning every action. */
(() => {
  if (window.controlsV35Ready) return;
  window.controlsV35Ready = true;
  const paths = {
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3Z"/><path d="m14 5 5 5M4 15l5 5"/>',
    delete: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  function icon(button, kind) {
    if (button.dataset.controlsV35Icon === kind) return;
    const label = kind === 'close' ? 'Закрыть' : kind === 'edit' ? 'Изменить командующего' : 'Удалить командующего';
    button.classList.add('icon-btn');
    if (kind === 'close') button.classList.add('uniform-close');
    if (kind === 'delete') button.classList.add('ui-v31-danger');
    button.setAttribute('aria-label', label);
    button.title = label;
    button.dataset.controlsV35Icon = kind;
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + paths[kind] + '</svg>';
  }
  function decorate(root) {
    const buttons = root.matches?.('button') ? [root] : root.querySelectorAll?.('button');
    for (const button of buttons || []) {
      if (button.id === 'registry-close') icon(button, 'close');
      else if (button.dataset.action === 'edit' || button.dataset.action === 'delete') icon(button, button.dataset.action);
      else button.classList.add('primary-btn');
    }
  }
  let attached = null;
  function attach() {
    const dialog = document.getElementById('commander-registry-dialog');
    if (!dialog || dialog === attached) return;
    attached = dialog;
    decorate(dialog);
    // Only new registry subtrees: no attributes, polling, document-wide observer,
    // data writes or action listeners. SVG mutations contain no buttons.
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) decorate(node);
      }
    }).observe(dialog, {childList: true, subtree: true});
  }
  attach();
  document.addEventListener('commander-registry-ready', attach);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, {once: true});
})();

;
/* personality-v37.js */
'use strict';
(()=>{const descriptions={aggressive:{motto:'Ломает огневой кулак противника.',duel:'В дуэли приоритет — наиболее опасный по огневой мощи корабль: сумма порогов атаки × число атак. Не обязательно добивает самого раненого.',mass:'В массовом бою чаще выбирает опасные корабли, но распределяет огонь вероятностно. Это приоритет, а не приказ всем стрелять в одну цель.',retreat:'Отходит неохотно: при HP ≤12% проверяет шанс 12% один раз за раунд. Из Столкновения с вероятностью 25% сближается, если доступные цели находятся только в других секторах.'},cautious:{motto:'Использует повреждения и раньше бережёт свои корабли.',duel:'В дуэли приоритет — враг с наименьшей долей оставшегося HP. Например, 2/10 HP для него более раненная цель, чем 1/3 HP.',mass:'В массовом бою сочетает относительную повреждённость цели с её огневой угрозой; чаще пользуется уже ослабленными противниками, не закрепляясь на одной жертве.',retreat:'Раньше начинает отход: при HP ≤16% — шанс 18% за раунд. Тот же шанс действует при безнадёжном превосходстве всех оставшихся врагов по исходным порогам атаки и защиты.'},balanced:{motto:'Ищет удобную цель между бронёй и запасом HP.',duel:'В дуэли предпочитает минимальную сумму: нижний порог защиты + верхний порог защиты + 2 × текущие HP. Учитывает одновременно броню и объём работы до уничтожения.',mass:'В массовом бою соединяет доступность цели по защите и HP с её огневой угрозой. Выбор вероятностный: не обязан преследовать только слабейшего.',retreat:'Умеренно бережёт силы: при HP ≤12% — шанс отхода 12% один раз за раунд. Не имеет дополнительного случайного сближения агрессивного характера.'},tactician:{motto:'Добивает тех, кому осталось меньше попаданий.',duel:'В дуэли приоритет — минимальное абсолютное HP, независимо от максимума. Цель с 1/3 HP важнее цели с 2/10 HP: успешное попадание всегда снимает ровно 1 HP.',mass:'В массовом бою сочетает возможность быстрого добивания с огневой угрозой. Вероятностный выбор не позволяет всему флоту постоянно сходиться на одной цели.',retreat:'Сохраняет потрёпанные корабли: при HP ≤14% — шанс отхода 15% один раз за раунд. В отличие от осторожного сравнивает цели по абсолютному HP, не по доле.'}};function numberText(el,text){const parts=String(text).split(/(\d+(?:[.,]\d+)?%?)/g);for(const part of parts){if(/^\d/.test(part)){const n=document.createElement('span');n.className='personality-number';n.textContent=part;el.append(n);}else el.append(document.createTextNode(part));}}
function render(el,id){const d=descriptions[id];if(!el||!d)return;el.replaceChildren();el.classList.add('personality-guide');const lead=document.createElement('strong');lead.textContent=d.motto;el.append(lead);for(const [label,key] of [['Дуэль','duel'],['Массовый бой','mass'],['Движение и отход','retreat']]){const row=document.createElement('span');row.className='personality-row';const head=document.createElement('b');head.textContent=label+' · ';row.append(head);numberText(row,d[key]);el.append(row);}const common=document.createElement('span');common.className='personality-common';common.textContent='Все характеры предпочитают возможный обычный урон полностью блокируемому выстрелу. Без доступных целей сближаются; при заблокированном огне ищут выгодный сектор. Начатый отход продолжают к собственному тылу. Для стороны игроков автоматическое движение выключено, но приоритет целей сохраняется.';el.append(common);}
function refresh(){render(document.getElementById('registry-character-description'),document.getElementById('registry-personality')?.value);render(document.getElementById('commander-description'),document.getElementById('commander-personality')?.value);}let scheduled=false;const observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&!n.closest?.('.personality-guide')))){if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;refresh();});}}});observer.observe(document.body,{childList:true,subtree:true});document.addEventListener('change',e=>{if(['registry-personality','commander-personality'].includes(e.target.id))refresh();});document.addEventListener('galaxy-selection',()=>requestAnimationFrame(refresh));const combat=document.querySelector('#combat-help .guide-body');if(combat){const old=[...combat.querySelectorAll('.guide-topic')].find(e=>e.querySelector('summary')?.textContent.startsWith('7.'));if(old){const body=old.querySelector('.guide-topic-content');body.replaceChildren();for(const [id,d] of Object.entries(descriptions)){const title=document.createElement('h4');title.textContent=BattleEngine.personalities[id].name;const box=document.createElement('div');render(box,id);body.append(title,box);}}}window.PersonalityGuideV37={render,refresh};refresh();})();

;
/* trait-browser-v37.js */
'use strict';
/* Additive UI only: the registry owns checkbox limits, form state and saves. */
(() => {
  if (window.TraitBrowserV37) return;
  const terms = Object.freeze({disobedience:'Неповиновение',attack:'Атака',defense:'Защита',guard:'Арьергард',rear:'Тыл',center:'Столкновение'});
  // Explicit engine-field / scope mapping. Never infer effects from prose.
  // Lower disobedience / fewer escape rounds are beneficial; other numbers add.
  const mapping = Object.freeze({
    inspiring_leader:{group:'Дисциплина',effects:[['disobedience',['disobedience','center'],-1]]},
    decisive_assault:{group:'Столкновение',effects:[['entryAttack',['attack','center'],1]]},
    iron_discipline:{group:'Дисциплина',effects:[['disobedience',['disobedience','center'],-1],['attack',['attack'],1]]},
    reckless_charge:{group:'Столкновение',effects:[['centerAttack',['attack','center'],1],['disobedience',['disobedience','center'],-1]]},
    // screenDefense belongs to the defending own guard, not the shooter's center.
    protective_screen:{group:'Арьергард',effects:[['screenDefense',['defense','guard'],1],['ownGuardAttack',['attack','guard'],1]]},
    orderly_withdrawal:{group:'Дисциплина',effects:[['withdrawalDisobedience',['disobedience','center','rear'],-1]]},
    seasoned_crew:{group:'Дисциплина',effects:[['disobedience',['disobedience','center'],-1],['centerDefense',['defense','center'],1]]},
    independent_captains:{group:'Столкновение',effects:[['centerAttack',['attack','center'],1],['disobedience',['disobedience','center'],-1]]},
    vanguard_screen:{group:'Столкновение',effects:[['centerDefense',['defense','center'],1]]},
    vanguard_pressure:{group:'Столкновение',effects:[['centerAttack',['attack','center'],1],['centerDefense',['defense','center'],1]]},
    layered_armor:{group:'Арьергард',effects:[['ownGuardDefense',['defense','guard'],1],['ownGuardAttack',['attack','guard'],1]]},
    rear_fortification:{group:'Тыл',effects:[['rearIntruderDefense',['defense','rear'],1]]},
    rapid_evacuation:{group:'Тыл',effects:[['escapeRounds',['rear'],-1,3],['ownRearDefense',['defense','rear'],1]]},
    // A nonzero reentryAttack enables a free rear→own-guard step (engine nextRound).
    // Its numeric penalty then lasts in every sector; do not call it guard-only.
    emergency_reentry:{group:'Тыл',effects:[['reentryAttack',['attack'],1],['reentryAttack',['attack','rear','guard'],-1]]},
    rear_raiders:{group:'Тыл',effects:[['foreignRearAttack',['attack','rear'],1],['foreignRearDefense',['defense','rear'],1]]},
    cautious_recovery:{group:'Дисциплина',effects:[['recoveryDisobedience',['disobedience','center','guard','rear'],-1],['woundedCenterDefense',['defense','center'],1]]}
  });
  const groups = ['Дисциплина','Столкновение','Арьергард','Тыл'];
  const selected = new Set();
  function tagsFor(id) {
    const trait = window.BattleEngine?.traits?.[id];
    const result = new Map();
    for (const [key, categories, direction, baseline = 0] of mapping[id]?.effects || []) {
      const value = trait?.[key];
      if (typeof value !== 'number' || value === baseline) continue;
      const positive = (value - baseline) * direction > 0;
      for (const category of categories) result.set(category + ':' + positive, {category,positive});
    }
    return [...result.values()].sort((a,b) => Object.keys(terms).indexOf(a.category)-Object.keys(terms).indexOf(b.category) || Number(b.positive)-Number(a.positive));
  }
  function identify(card) {
    const input = card.closest('.registry-trait-choice')?.querySelector('input[type="checkbox"]');
    if (input && mapping[input.value]) return input.value;
    const name = card.querySelector('strong,h4,h3')?.textContent?.trim();
    return Object.keys(mapping).find(id => window.BattleEngine?.traits?.[id]?.name === name);
  }
  function decorate(card) {
    const id = identify(card);
    if (!id || card.dataset.traitV37 === id) return;
    card.dataset.traitV37 = id;
    const footer = document.createElement('div');
    footer.className = 'trait-tags-v37';
    footer.setAttribute('aria-label','Эффекты: плюс — преимущество, минус — недостаток');
    for (const {category,positive} of tagsFor(id)) {
      const tag = document.createElement('span');
      tag.className = 'trait-tag-v37 ' + (positive ? 'is-benefit' : 'is-drawback');
      tag.dataset.traitCategory = category;
      tag.dataset.polarity = positive ? 'positive' : 'negative';
      tag.textContent = (positive ? '+ ' : '− ') + terms[category];
      footer.append(tag);
    }
    card.append(footer);
  }
  function toolbar(grid) {
    const fieldset = grid.parentElement;
    let bar = fieldset.querySelector(':scope > .trait-browser-v37');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'trait-browser-v37';
    const chips = document.createElement('div');
    chips.className = 'trait-filters-v37';
    chips.setAttribute('role','group');
    chips.setAttribute('aria-label','Фильтры черт');
    for (const [key,label] of [['all','Все'],...Object.entries(terms)]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'trait-filter-v37';
      button.dataset.traitFilter = key;
      button.textContent = label;
      button.setAttribute('aria-controls','registry-traits');
      button.addEventListener('click', () => {
        if (key === 'all') selected.clear();
        else if (selected.has(key)) selected.delete(key);
        else selected.add(key);
        apply(grid,bar);
      });
      chips.append(button);
    }
    const note = document.createElement('p');
    note.className = 'trait-filter-note-v37';
    note.textContent = 'Фильтры работают по ИЛИ: преимущество или недостаток в любой выбранной категории. Скрытые черты остаются выбранными; общий лимит — 4. + преимущество · − недостаток.';
    const status = document.createElement('p');
    status.className = 'trait-filter-status-v37';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    bar.append(chips,note,status);
    grid.before(bar);
    return bar;
  }
  function organize(grid) {
    const choices = [...grid.querySelectorAll('.registry-trait-choice')];
    if (!choices.length) return;
    // Headers and labels stay under #registry-traits. Move the ORIGINAL labels;
    // never clone inputs or change checked/disabled or the registry's handlers.
    for (const group of groups) {
      let heading = [...grid.children].find(node => node.dataset.traitGroup === group);
      if (!heading) {
        heading = document.createElement('h3');
        heading.className = 'trait-group-title-v37';
        heading.dataset.traitGroup = group;
        heading.textContent = group;
      }
      const members = choices.filter(choice => mapping[choice.querySelector('input')?.value]?.group === group);
      if (!members.length) continue;
      if (!heading.isConnected) grid.append(heading,...members);
    }
    const bar = toolbar(grid);
    if (!grid.dataset.traitBrowserV37) {
      grid.dataset.traitBrowserV37 = 'ready';
      grid.addEventListener('change',() => status(grid,bar));
      // Watch width, not our own height writes: responsive reflow cannot loop.
      let lastWidth = -1;
      if (window.ResizeObserver) new ResizeObserver(entries => {
        const width = entries[0].contentRect.width;
        if (width !== lastWidth) { lastWidth = width; schedule(); }
      }).observe(grid);
    }
    apply(grid,bar);
  }
  function status(grid,bar) {
    const choices = [...grid.querySelectorAll('.registry-trait-choice')];
    const inputs = [...grid.querySelectorAll('input[type="checkbox"]')];
    const checked = inputs.filter(input => input.checked);
    const hidden = checked.filter(input => input.closest('.registry-trait-choice').hidden).length;
    const text = `Показано ${choices.filter(choice => !choice.hidden).length} из ${choices.length} · Выбрано ${checked.length}/4${hidden ? ` · Скрыто выбранных: ${hidden}` : ''}`;
    const target = bar.querySelector('.trait-filter-status-v37');
    if (target.textContent !== text) target.textContent = text;
  }
  function equalize(grid) {
    if (!grid.getClientRects().length) return;
    grid.style.removeProperty('--trait-card-height-v37');
    const heights = [...grid.querySelectorAll('.registry-trait-choice:not([hidden])')].map(node => node.getBoundingClientRect().height);
    if (heights.length) grid.style.setProperty('--trait-card-height-v37',Math.ceil(Math.max(...heights)) + 'px');
  }
  function apply(grid,bar) {
    for (const button of bar.querySelectorAll('[data-trait-filter]')) {
      const active = button.dataset.traitFilter === 'all' ? !selected.size : selected.has(button.dataset.traitFilter);
      button.setAttribute('aria-pressed',String(active));
    }
    for (const choice of grid.querySelectorAll('.registry-trait-choice')) {
      const id = choice.querySelector('input')?.value;
      const visible = !selected.size || tagsFor(id).some(tag => selected.has(tag.category));
      if (choice.hidden === visible) choice.hidden = !visible;
    }
    for (const heading of grid.querySelectorAll('.trait-group-title-v37')) {
      const visible = [...grid.querySelectorAll('.registry-trait-choice')].some(choice => !choice.hidden && mapping[choice.querySelector('input')?.value]?.group === heading.dataset.traitGroup);
      if (heading.hidden === visible) heading.hidden = !visible;
    }
    status(grid,bar);
    equalize(grid);
  }
  let pending = false;
  function refresh() {
    pending = false;
    document.querySelectorAll('.commander-trait').forEach(decorate);
    const grid = document.getElementById('registry-traits');
    if (grid) organize(grid);
  }
  function schedule() {
    if (pending) return;
    pending = true;
    queueMicrotask(refresh);
  }
  window.TraitBrowserV37 = Object.freeze({refresh:schedule,tagsFor,mapping,terms});
  function boot() {
    refresh();
    // Child-list only. Our footer/heading/text mutations do not contain traits,
    // so they cannot schedule themselves. One follow-up after moving cards is inert.
    new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches('.commander-trait,#registry-traits') || node.querySelector('.commander-trait,#registry-traits'))))) schedule();
    }).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('resize',schedule,{passive:true});
    document.addEventListener('commander-registry-ready',schedule);
    document.fonts?.ready.then(schedule);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();

;
/* factions-v41.js */
'use strict';
(()=>{
function validate(list){
 if(!Array.isArray(list)||!list.length||list.length>500)throw Error('Неверный список фракций (1–500).');
 const keys=new Set(),names=new Set();
 const clean=list.map(g=>{if(!g||typeof g.key!=='string'||!g.key.trim()||g.key.length>160||keys.has(g.key))throw Error('Неизвестный или повторный ключ фракции.');if(typeof g.label!=='string'||!g.label.trim()||g.label.length>100)throw Error('Название фракции: 1–100 символов.');const name=g.label.trim().toLocaleLowerCase('ru');if(names.has(name))throw Error('Фракция с таким названием уже существует.');if(typeof g.color!=='string'||!/^#[0-9a-f]{6}$/i.test(g.color))throw Error('Цвет фракции: #RRGGBB.');if(g.overlord!=null&&(typeof g.overlord!=='string'||!g.overlord))throw Error('Неверная фракция-сюзерен.');keys.add(g.key);names.add(name);return {...g,overlord:g.overlord??null};});
 const byKey=new Map(clean.map(g=>[g.key,g]));for(const g of clean){const seen=new Set([g.key]);let parent=g.overlord;while(parent!==null){if(!byKey.has(parent))throw Error('Фракция-сюзерен не существует.');if(seen.has(parent))throw Error('Подчинение фракций не может образовывать цикл или ссылаться на себя.');seen.add(parent);parent=byKey.get(parent).overlord;}}
 return clean;
}
window.FactionManager={validate,open:()=>{}};
if(typeof document==='undefined')return;
const app=window.galaxyApp,$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dialog=document.createElement('dialog');dialog.id='faction-manager-dialog';dialog.className='sector-window';dialog.setAttribute('aria-labelledby','faction-manager-title');dialog.innerHTML='<header class="dialog-head standard-header"><h2 id="faction-manager-title">УПРАВЛЕНИЕ ФРАКЦИЯМИ</h2><button type="button" class="icon-btn" id="faction-manager-close" aria-label="Закрыть">×</button></header><div class="sector-window-body"><p class="faction-manager-note">Независимые державы и вассалы. Принадлежность систем меняется в редакторе объекта; исходные названия и история сохраняются.</p><div class="faction-manager-layout"><section><button type="button" id="faction-manager-create">+ Создать фракцию</button><div id="faction-manager-list"></div></section><form id="faction-manager-form"><h3 id="faction-manager-form-title">Новая фракция</h3><label>Название<input id="faction-manager-name" maxlength="100" required autocomplete="off"></label><label>Цвет<input id="faction-manager-color" type="color" value="#78dfea" required></label><label>Сюзерен<select id="faction-manager-overlord"></select></label><p id="faction-manager-key"></p><p id="faction-manager-error" role="alert" aria-live="polite"></p><button type="submit">Сохранить фракцию</button></form></div></div>';document.body.append(dialog);
let editingKey=null;
// Close only when both gestures belong to the genuine backdrop, never content.
let backdropDown=false;
function beyond(event){const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;}
dialog.addEventListener('pointerdown',event=>{backdropDown=event.target===dialog&&beyond(event);});
dialog.addEventListener('pointercancel',()=>{backdropDown=false;});
dialog.addEventListener('close',()=>{backdropDown=false;});
dialog.addEventListener('click',event=>{const close=backdropDown&&event.target===dialog&&beyond(event);backdropDown=false;if(close)dialog.close();});
function render(){const d=app.getData(),byKey=new Map(d.groups.map(g=>[g.key,g]));$('faction-manager-list').innerHTML=d.groups.map(g=>`<button type="button" class="faction-manager-row${g.key===editingKey?' active':''}" data-key="${esc(g.key)}" style="--faction-color:${esc(g.color)}"><i></i><span><strong>${esc(g.label)}</strong><small>${g.overlord?'Вассал · '+esc(byKey.get(g.overlord)?.label||g.overlord):'Независимая фракция'}</small></span><span class="faction-manager-count">${d.systems.filter(s=>s.group===g.key).length}</span></button>`).join('');}
function edit(key=null){editingKey=key;const d=app.getData(),g=d.groups.find(g=>g.key===key);$('faction-manager-form-title').textContent=g?'Изменить фракцию':'Новая фракция';$('faction-manager-name').value=g?.label||'';$('faction-manager-color').value=g?.color||'#78dfea';$('faction-manager-overlord').replaceChildren(new Option('Независимая · без сюзерена',''),...d.groups.filter(p=>p.key!==key).map(p=>new Option(p.label,p.key)));$('faction-manager-overlord').value=g?.overlord||'';$('faction-manager-key').textContent=g?'Постоянный ключ: '+g.key:'Ключ будет создан автоматически и не изменится при переименовании.';$('faction-manager-error').textContent='';render();}
$('faction-manager-create').onclick=()=>edit();$('faction-manager-list').onclick=e=>{const b=e.target.closest('[data-key]');if(b)edit(b.dataset.key);};$('faction-manager-close').onclick=()=>dialog.close();
$('faction-manager-form').onsubmit=e=>{e.preventDefault();try{const d=app.getData(),old=d.groups.find(g=>g.key===editingKey),key=old?.key||'custom-g-'+crypto.randomUUID(),g={...old,key,label:$('faction-manager-name').value.trim(),color:$('faction-manager-color').value,overlord:$('faction-manager-overlord').value||null};d.groups=validate(old?d.groups.map(p=>p.key===key?g:p):[...d.groups,g]);window.galaxyEditor.applyDraft({...d,version:7});if(!window.galaxyEditor.save())throw Error('Изменения применены, но черновик не сохранён. Экспортируйте JSON.');edit(key);app.toast('Фракция сохранена в локальный черновик.');}catch(error){$('faction-manager-error').textContent=error.message;}};
window.FactionManager.open=()=>{edit();if(!dialog.open)dialog.showModal();};
const entry=document.createElement('button');entry.id='editor-factions';entry.type='button';entry.textContent='Фракции · державы и вассалы';entry.onclick=()=>{$('admin-dialog')?.close();window.FactionManager.open();};($('editor-commanders')||$('editor-new-fleet'))?.after(entry);
function affiliation(){const item=app.getSelected(),d=app.getData();let line=$('detail-overlord');if(!line){line=document.createElement('div');line.id='detail-overlord';$('detail-group').after(line);}const location=item?.isFleet?[...d.systems,...d.events].find(s=>String(s.id)===String(item.system)):item;const key=item?.isFleet&&Object.hasOwn(item,'faction')?item.faction:location?.factionGroup||location?.group;const g=d.groups.find(g=>g.key===key),parent=d.groups.find(p=>p.key===g?.overlord);line.hidden=!parent;line.textContent=parent?'Вассал державы: '+parent.label:'';}
document.addEventListener('galaxy-selection',affiliation);document.addEventListener('galaxy-data-changed',()=>{affiliation();if(dialog.open)render();});affiliation();
})();

;
/* earth-v41.js */
'use strict';
(()=>{const app=galaxyApp,d=app.getData();if(d.vassalSetupVersion===1)return;const earth=d.groups.find(g=>g.key==='Земляне');if(!earth)d.groups.push({key:'Земляне',label:'Земляне',color:'#a5cfae',overlord:'Ювианцы'});for(const s of d.systems)if([83,84].includes(s.id))s.group='Земляне';const t=d.territories;if(t){let idx=t.keys.indexOf('Земляне');if(idx<0){t.keys.push('Земляне');idx=t.keys.length-1;}const old=t.keys.indexOf('Ювианцы')+1;const points=d.systems.filter(s=>['Ювианцы','Земляне'].includes(s.group));for(let i=0;i<t.cells.length;i++){if(t.cells[i]!==old)continue;const x=i%t.width*8+4,y=Math.floor(i/t.width)*8+4;const nearest=points.reduce((best,p)=>!best||(p.x+5.5-x)**2+(p.y+5.5-y)**2<(best.x+5.5-x)**2+(best.y+5.5-y)**2?p:best,null);if(nearest?.group==='Земляне')t.cells[i]=idx+1;}}d.vassalSetupVersion=1;app.replaceData(d);galaxyEditor.save();})();

;
/* fleet-setup-v44.js */
'use strict';
(()=>{const d=galaxyApp.getData();for(const f of d.fleets)delete f.type;if(d.fleetSetupVersion===1){galaxyApp.replaceData(d);return;}const baseline=JSON.parse(document.getElementById('galaxy-data').textContent);const ids=['f4-0','f4-1','f4-2','f4-3'];for(const id of ids){const f=d.fleets.find(f=>f.id===id),template=baseline.fleets.find(f=>f.id===id);if(f&&template){f.faction=template.faction;f.commanderId=template.commanderId;f.commander=template.commander;f.count=template.count;f.shipTypes=template.shipTypes;}}const newIds=new Set(baseline.commanders.filter(c=>ids.some(id=>baseline.fleets.find(f=>f.id===id)?.commanderId===c.id)).map(c=>c.id));d.commanders=[...(d.commanders||[]).filter(c=>!newIds.has(c.id)),...baseline.commanders.filter(c=>newIds.has(c.id))];d.fleetSetupVersion=1;galaxyApp.replaceData(d);galaxyEditor.save();})();

;
/* battle-roster-v43.js */
'use strict';
(()=>{const app=galaxyApp,$=id=>document.getElementById(id);const tooltip=document.createElement('div');tooltip.id='battle-trait-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','tooltip');$('battle-dialog').append(tooltip);let active=null,hideTimer=0,openedAt=0,pinned=false;tooltip.onpointerenter=()=>clearTimeout(hideTimer);tooltip.onpointerleave=()=>hide();function hide(){clearTimeout(hideTimer);tooltip.hidden=true;active=null;pinned=false;}function show(button){clearTimeout(hideTimer);openedAt=performance.now();const t=BattleEngine.traits[button.dataset.traitId];if(!t)return;active=button;tooltip.replaceChildren();const close=document.createElement('button');close.className='icon-btn';close.textContent='×';close.setAttribute('aria-label','Закрыть подробности черты');close.onclick=hide;const title=document.createElement('h4');title.textContent=t.name;tooltip.append(close,title);for(const text of [t.bonus,t.downside,'Где: '+t.scope,'Когда: '+t.duration]){const p=document.createElement('p');p.textContent=text;tooltip.append(p);}tooltip.hidden=false;const r=button.getBoundingClientRect(),w=Math.min(330,innerWidth-24);tooltip.style.width=w+'px';const height=tooltip.getBoundingClientRect().height;tooltip.style.left=Math.max(12,Math.min(innerWidth-w-12,r.right+10+w<=innerWidth?r.right+10:r.left-w-10))+'px';const desiredTop=innerWidth<700?(r.bottom+10+height<=innerHeight?r.bottom+10:r.top-height-10):r.top;tooltip.style.top=Math.max(12,Math.min(innerHeight-height-12,desiredTop))+'px';}
function decorate(){const d=app.getData();for(const card of document.querySelectorAll('#battle-setup .battle-fleet')){if(card.querySelector('.battle-fleet-identity'))continue;const f=d.fleets.find(f=>String(f.id)===card.dataset.fleetId);if(!f)continue;const faction=CommanderRegistry.fleetFaction(f,d),g=d.groups.find(g=>g.key===faction),c=CommanderRegistry.resolveFleet(f,d).commander;const box=document.createElement('div');box.className='battle-fleet-identity';const badge=document.createElement('span');badge.className='battle-faction-badge';badge.textContent=g?.label||'Без принадлежности';badge.style.setProperty('--faction-color',g?.color||'#9cabb8');box.append(badge);if(c){const row=document.createElement('div');row.className='battle-commander-row';const src=c.portrait||FactionCrests.get(c.factionGroup||faction);if(src){const image=document.createElement('img');image.src=src;image.alt='Портрет командующего';row.append(image);}const name=document.createElement('strong');name.textContent=c.name;row.append(name);box.append(row);const traits=document.createElement('div');traits.className='battle-fleet-traits';for(const id of c.traits||[]){const t=BattleEngine.traits[id];if(!t)continue;const button=document.createElement('button');button.type='button';button.dataset.traitId=id;button.className='battle-trait-chip';button.textContent=t.name;button.onpointerenter=()=>show(button);button.onpointerleave=()=>{if(pinned)return;hideTimer=setTimeout(()=>{if(!tooltip.matches(":hover"))hide();},180);};button.onfocus=()=>show(button);button.onblur=hide;button.onclick=e=>{e.preventDefault();e.stopPropagation();pinned=true;show(button);};traits.append(button);}box.append(traits);}else{const n=document.createElement('span');n.className='battle-no-commander';n.textContent='Без командующего';box.append(n);}card.querySelector('strong').after(box);}}
let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate();});}).observe($('battle-setup'),{childList:true,subtree:true});$('battle-dialog').addEventListener('close',hide);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tooltip.hidden){hide();e.stopImmediatePropagation();}},true);document.addEventListener('scroll',e=>{if(performance.now()-openedAt>300&&!tooltip.contains(e.target))hide();},true);window.addEventListener('resize',hide);document.addEventListener('galaxy-data-changed',()=>{document.querySelectorAll('.battle-fleet-identity').forEach(e=>e.remove());decorate();});decorate();})();

;
/* trait-text-v44.js */
/* Canonical trait presentation only; registry and battle mechanics own state. */
'use strict';
(() => {
  if (window.TraitTextV44) return;
  const selector='.commander-trait,[id="commander-trait-detail"],#battle-trait-tooltip';
  const numberPattern=/[+−–-]?\d+(?:[.,]\d+)?\s*%?/g;
  function identify(pane) {
    const traits=window.BattleEngine?.traits||{};
    const explicit=pane.dataset.traitId||pane.dataset.trait||pane.dataset.traitV37;
    if (traits[explicit]) return traits[explicit];
    for (const heading of pane.querySelectorAll('h4,h3,strong')) {
      const name=heading.textContent.trim();
      const trait=Object.values(traits).find(t=>t.name===name);
      if (trait) return trait;
    }
    const value=pane.closest('.registry-trait-choice')?.querySelector('input')?.value;
    return traits[value];
  }
  function highlight(element) {
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while (walker.nextNode()) if (!walker.currentNode.parentElement.closest('.trait-number-v44')) nodes.push(walker.currentNode);
    let changed=false;
    for (const node of nodes) {
      const text=node.nodeValue;
      numberPattern.lastIndex=0;
      const matches=[...text.matchAll(numberPattern)];
      if (!matches.length) continue;
      const fragment=document.createDocumentFragment();let start=0;
      for (const match of matches) {
        fragment.append(document.createTextNode(text.slice(start,match.index)));
        const span=document.createElement('span');span.className='trait-number-v44';
        // Keep trailing whitespace outside the coloured number, without rewriting prose.
        const number=match[0].trimEnd();span.textContent=number;fragment.append(span);
        fragment.append(document.createTextNode(match[0].slice(number.length)));
        start=match.index+match[0].length;
      }
      fragment.append(document.createTextNode(text.slice(start)));node.replaceWith(fragment);changed=true;
    }
    return changed;
  }
  function list(items, className, label) {
    const ul=document.createElement('ul');ul.className=className+' trait-effects-v44';ul.setAttribute('aria-label',label);
    for (const text of items) {const li=document.createElement('li');li.textContent=text;highlight(li);ul.append(li);}
    return ul;
  }
  function paragraphKind(p,trait) {
    if (p.matches('.trait-bonus,.trait-detail-bonus')) return 'bonus';
    if (p.matches('.trait-downside,.trait-detail-downside')) return 'downside';
    // The help reference and battle tooltip have unclassified paragraphs. Match
    // complete canonical text only, never interpret author prose or HTML.
    if (p.className || p.closest('.commander-author-description')) return null;
    if (p.textContent===trait.bonus) return 'bonus';
    if (p.textContent===trait.downside) return 'downside';
    return null;
  }
  function decorate(pane) {
    const trait=identify(pane);if (!trait) return false;
    let changed=false;
    for (const p of [...pane.querySelectorAll('p')]) {
      if (p.closest(selector)!==pane) continue;
      const kind=paragraphKind(p,trait);
      if (kind==='bonus') {
        p.replaceWith(list(trait.bonusItems||[trait.bonus],'trait-bonus','Преимущества'));changed=true;
      } else if (kind==='downside') {
        const fragment=document.createDocumentFragment();
        const drawbacks=trait.downsideItems||[trait.downside];
        if (drawbacks.length) fragment.append(list(drawbacks,'trait-downside','Недостатки'));
        if (trait.limitationItems?.length) fragment.append(list(trait.limitationItems,'trait-limitation-v44','Ограничения'));
        if (!drawbacks.length&&!trait.limitationItems?.length) {
          const note=document.createElement('p');note.className='trait-no-downside-v44';note.textContent='Недостатков нет.';fragment.append(note);
        }
        p.replaceWith(fragment);changed=true;
      } else if (p.matches('.trait-scope,.trait-duration,.trait-detail-scope,.trait-detail-duration') || (!p.className && [trait.scope,trait.duration,'Где: '+trait.scope,'Когда: '+trait.duration].includes(p.textContent))) {
        if (highlight(p)) changed=true;
      }
    }
    if (changed&&pane.matches('[id="commander-trait-detail"],#battle-trait-tooltip')&&!pane.hidden) {
      // Generated popovers measured the original paragraphs. Bound the new list
      // without dispatching resize (the owner's resize handler dismisses them).
      const box=pane.getBoundingClientRect(),v=window.visualViewport;
      const top=v?.offsetTop||0,left=v?.offsetLeft||0,height=v?.height||innerHeight,width=v?.width||innerWidth;
      pane.style.maxHeight=Math.max(0,height-24)+'px';
      pane.style.top=Math.max(top+12,Math.min(box.top,top+height-box.height-12))+'px';
      pane.style.left=Math.max(left+12,Math.min(box.left,left+width-box.width-12))+'px';
    }
    return changed;
  }
  let pending=false;
  function refresh() {
    pending=false;let changed=false;
    document.querySelectorAll(selector).forEach(pane=>{if(decorate(pane))changed=true;});
    if (changed) window.TraitBrowserV37?.refresh();
  }
  function schedule() {if (!pending) {pending=true;queueMicrotask(refresh);}}
  window.TraitTextV44=Object.freeze({refresh:schedule});
  function boot() {
    refresh();
    new MutationObserver(records=>{
      if (records.some(record=>{
        if (record.type==='attributes') return record.target.matches(selector);
        if (record.target.nodeType===1&&record.target.closest(selector)) return true;
        return [...record.addedNodes].some(node=>node.nodeType===1&&(node.matches(selector)||node.querySelector(selector)));
      })) schedule();
    }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-trait-id','data-trait']});
    document.addEventListener('commander-registry-ready',schedule);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

;
/* fleet-scale-v46.js */
'use strict';
(()=>{const d=galaxyApp.getData(),base=JSON.parse(document.getElementById('galaxy-data').textContent);for(const f of d.fleets){f.hp=Math.max(10,f.hp||10);for(const t of f.shipTypes||[])t.hp=Math.max(10,t.hp||10);}let oldDraft=false;try{const raw=localStorage.getItem('ugalaxy-draft-v7');oldDraft=!!raw&&JSON.parse(raw).fleetScaleVersion!==46;}catch{}if(oldDraft||d.fleetScaleVersion!==46){for(const id of ['f4-0','f4-1','f4-2','f4-3']){const f=d.fleets.find(f=>f.id===id),b=base.fleets.find(f=>f.id===id);if(f&&b){for(const [i,t]of f.shipTypes.entries()){t.count=b.shipTypes[i]?.count||t.count;t.hp=b.shipTypes[i]?.hp||Math.max(10,t.hp);}f.count=f.shipTypes.reduce((n,t)=>n+t.count,0);}}d.fleetScaleVersion=46;galaxyApp.replaceData(d);galaxyEditor.save();}else galaxyApp.replaceData(d);})();

;
/* guide-v45.js */
'use strict';
(()=>{const body=document.querySelector('#combat-help .guide-body');if(!body)return;const d=document.createElement('details');d.className='guide-topic';d.innerHTML='<summary>Уровни, черты кораблей и условия сражения</summary><div class="guide-topic-content"><h4>Командир и послушание</h4><p>Командира можно назначить любому флоту. Фракция служит категорией реестра и источником герба, а не ограничением. При назначении используйте поиск по имени.</p><p>Уровень от 1 до 10 влияет на вероятность выполнения перемещения и выбора рекомендованной цели. Высокий уровень лучше оценивает позиции; низкий может принять несогласованное решение. Характер сохраняет свой стиль.</p><p>Неповиновение ограничено 0–70% после уровня и черт. Шанс до ограничения: 15% + 35% × доля потерянных HP + 3% × (5 − уровень) + поправки черт. Без командира используется уровень 1; старым командирам назначается уровень 5. На уровне 10 с дисциплиной риск можно снизить до 0%, на уровне 1 при тяжёлых повреждениях и рискованных чертах достигнуть 70%. При отказе перемещения корабль остаётся на месте и сохраняет атаки. При отказе от целеуказания выбирает другую доступную цель. Проценты черт складываются напрямую, не умножаются.</p><h4>Черты типов кораблей</h4><p>Черты задаются каждому типу в редакторе флота и действуют на все корабли этого типа. Ремонтные дроны и Силовые щиты запрещают окончательное бегство через собственный тыл. На третьем завершённом раунде непрерывного пребывания там дроны восстанавливают 1 HP (не выше максимума), щиты дают +5 к броску защиты до первого повреждающего попадания. Срабатывание одно за заход; выход сбрасывает отсчёт. Щиты не складываются.</p><p>Варп-прыжок даёт один бесплатный переход в любой сектор за раунд, без расхода атаки. Запрет варпа временно отключает это преимущество: остаётся обычное движение через соседний сектор с расходом атаки. Сбежавших вернуть нельзя.</p><h4>Условия сражения</h4><p>Перед боем и перед любым новым раундом можно включить или отключить условия. Они не пересчитывают историю.</p><p>Астероидный дождь создаёт 10 астероидов с 1–3 HP через каждые два раунда, в случайных секторах. Игроки задают приказ «Зачистить астероиды» для кораблей выбранного сектора. ИИ принимает решение исходя из характера, уровня и доли своих войск в секторе. Астероиды в секторе цели могут перехватить обычный выстрел: 15% за каждый астероид, максимум 45%. При зачистке выстрел расходует действие атаки и сравнивается с защитой 0; успешный выстрел снимает 1 HP астероида. Приказ «Приоритет цели» направляет огонь в выбранную вражескую сторону; корабль может ослушаться и выбрать другую доступную цель. Неразрушенные астероиды наносят урон кораблям своего сектора в конце раунда. Отключение дождя прекращает новые появления, но не удаляет уже появившиеся астероиды.</p><h4>Публикация изменений</h4><p>Данные карты находятся в assets/galaxy/. «Экспорт только изменений» выгружает изменённые файлы данных относительно опубликованной основы. Загрузите файлы с теми же путями поверх сайта. Для первого размещения или обновления кода используйте полную сборку; частичный экспорт не заменяет код приложения.</p></div>';body.insertBefore(d,body.querySelector('.guide-end'));for(const e of document.querySelectorAll('.guide-body p,.guide-body li,.guide-body dd')){if(e.closest('details')===d)continue;for(const n of [...e.childNodes])if(n.nodeType===3&&/0–50%/.test(n.textContent))n.textContent=n.textContent.replaceAll('0–50%','0–70%');}})();

;
/* partial-export-v45.js */
'use strict';
(()=>{
const collections=['systems','events','fleets','groups','commanders','territories'];
function split(data){const files={};for(const key of collections)files[key]=data[key]??(key==='territories'?null:[]);files.meta=Object.fromEntries(Object.entries(data).filter(([key])=>!collections.includes(key)&&key!=='version'));return files;}
function join(files){return {...files.meta,...Object.fromEntries(collections.map(key=>[key,files[key]]))};}
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
function comparable(value,key){if(!['systems','events','fleets','groups','commanders'].includes(key)||!Array.isArray(value))return stable(value);return stable([...value].sort((a,b)=>{const aa=stable(a.id??a.key),bb=stable(b.id??b.key);return aa<bb?-1:aa>bb?1:0;}));}
function changedFiles(base,current){const a=split(base),b=split(current),encode=new TextEncoder();return Object.keys(b).filter(key=>comparable(a[key],key)!==comparable(b[key],key)).map(key=>['assets/galaxy/'+key+'.json',encode.encode(JSON.stringify(b[key],null,2)+'\n')]);}
function allFiles(data){const encode=new TextEncoder();return Object.entries(split(data)).map(([key,value])=>['assets/galaxy/'+key+'.json',encode.encode(JSON.stringify(value,null,2)+'\n')]);}
window.GalaxyChanges={split,join,stable,changedFiles,allFiles};
if(typeof document==='undefined')return;
const app=window.galaxyApp,editor=window.galaxyEditor;
if(!app||!editor)return;
const button=document.createElement('button');button.id='editor-export-changes';button.type='button';button.textContent='Экспорт только изменений';button.title='ZIP содержит только изменённые JSON. Для опубликованного HTTP-сайта; автономный index.html не обновляется.';
button.onclick=()=>{try{const files=changedFiles(window.GalaxyPublishedBase||editor.publishedBase,editor.snapshot());if(!files.length){app.toast('Нет изменений относительно опубликованной версии.');return;}editor.exportIO.download(editor.exportIO.zip(files),'Карта-Вселенной-изменения-v45.zip');app.toast('Архив изменений готов: '+files.length+' JSON. Распакуйте поверх опубликованного HTTP-сайта. Автономный index.html обновляет полный экспорт.');}catch(e){app.toast(e.message);}};
document.getElementById('editor-export')?.after(button);
async function exportCompact(){const manifest=window.CompactSite;if(!manifest)return false;const io=editor.exportIO,decode=new TextDecoder(),encode=new TextEncoder(),snapshot=editor.snapshot();const template=decode.decode(await io.bytesFor('index.html')),doc=new DOMParser().parseFromString(template,'text/html');doc.getElementById('galaxy-data').textContent=JSON.stringify(join(split(snapshot))).replace(/</g,'\\u003c');const old=doc.getElementById('export-assets');if(old)old.remove();const source='<!doctype html>\n'+doc.documentElement.outerHTML;
const store={...io.embedded};store['index.html']=toBase64(encode.encode(source));const payload=doc.createElement('script');payload.type='application/json';payload.id='export-assets';payload.textContent=JSON.stringify(store);doc.body.append(payload);
const files=[['index.html',encode.encode('<!doctype html>\n'+doc.documentElement.outerHTML)],['.nojekyll',new Uint8Array()],...allFiles(snapshot)];for(const name of manifest.assets)files.push([name,await io.bytesFor(name)]);io.download(io.zip(files),'Карта-Вселенной-экспорт-GitHub.zip');app.toast('Полный компактный архив готов. JSON и автономная копия обновлены.');return true;}
function toBase64(bytes){let result='';for(let i=0;i<bytes.length;i+=32768)result+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(result);}
window.GalaxyChanges.exportCompact=exportCompact;
})();

;
/* help-v46.js */
'use strict';
/* Load after sector-ui and all older guide replacements. Numeric trait/AI prose
   is read from the current engine each time a guide is opened. */
(()=>{
if(window.HelpV46)return;
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function paragraph(host,text){host.append(el('p',text));}
function topic(host,title,texts=[]){const d=el('details',undefined,'guide-topic'),s=el('summary',title),b=el('div',undefined,'guide-topic-content');d.append(s,b);texts.forEach(t=>paragraph(b,t));host.append(d);return b;}
function reference(host,dictionary,kind){for(const [id,t] of Object.entries(dictionary||{})){const card=el('article',undefined,'commander-trait help-reference-v46');card.dataset.helpKind=kind;card.dataset.helpId=id;card.append(el('h4',t.name||id));let hasEffects=false;for(const [key,label,fallback] of [['bonusItems','Преимущества','bonus'],['downsideItems','Недостатки','downside'],['limitationItems','Ограничения',null]]){const items=t[key]??(fallback&&t[fallback]?[t[fallback]]:[]);if(items.length){hasEffects=true;const list=el('ul',undefined,key==='bonusItems'?'trait-bonus':key==='downsideItems'?'trait-downside':'trait-limitation-v44');list.setAttribute('aria-label',label);items.forEach(value=>list.append(el('li',value)));card.append(list);}}if(!hasEffects&&t.description)paragraph(card,t.description);for(const [key,label] of [['scope','Где: '],['duration','Когда: '],['probabilityNote','']])if(t[key])paragraph(card,label+t[key]);host.append(card);}}
function commanders(host){const b=topic(host,'Командующий: создание, портрет и назначение',[
'Откройте пульт ✎ → «Командующие» → «Создать командующего». Укажите имя, категорию фракции, характер и целый уровень 1–10; выберите до четырёх разных черт. Сохраните карточку. Старый командующий без уровня получает уровень 5.',
'Фракция — категория реестра и источник герба, а не ограничение назначения. Один командующий может возглавлять несколько флотов любых фракций. Изменение его карточки действует для будущих боёв; рассчитанная история не переписывается.',
'Портрет: PNG, JPEG или WebP. Изображение уменьшается до 512 px по длинной стороне. «Сбросить к гербу» убирает авторский портрет; смена фракции меняет только герб по умолчанию, загруженный портрет сохраняется. Авторское описание до 1200 символов хранится отдельно и не генерируется из характера.',
'В карточке назначьте любой флот либо откройте редактор флота и выберите командующего. Поиск по имени работает по всем фракциям независимо от выбранной категории; текущий выбор сохраняется, даже если не совпадает с поиском. «Без командующего» снимает назначение. Старый локальный командующий сохраняется до явной замены или переноса кнопкой «Добавить в реестр».'
]);
const obedience=topic(host,'Уровень, неповиновение и приоритет цели',[
'Уровень — не прибавка к HP, атаке или защите. Он влияет на дисциплину и качество автоматических решений; характер задаёт стиль поведения. Черты дают только описанные в их карточках эффекты и штрафы.',
'Шанс неповиновения = ограничить до 0–70% (15% + 35% × доля потерянных HP + 3% × (5 − уровень) + подходящие поправки черт). Доля потерянных HP = 1 − текущие HP / максимальные HP. Без командующего для дисциплины используется уровень 1. Поправки черт — процентные пункты, они складываются напрямую, не умножаются.',
'Дисциплина проверяется при явном приказе движения из «Столкновения»; проверка относится к конечной цели маршрута. При отказе корабль остаётся на месте и сохраняет разрешённые атаки. Из арьергарда или тыла этой проверки движения нет. Приказы и секторные условия черт проверяются отдельно.',
'«Приоритет цели» рекомендует вражескую сторону, а не гарантирует попадание в конкретный корабль. Корабль может ослушаться и выбрать из всех допустимых целей. Шанс проверки рассчитывается по дисциплине как для «Столкновения», даже если стрелок находится в другом секторе; специальные поправки отхода к фокусу не относятся.'
]);
if(window.BattleEngine?.disobedienceChance){const table=el('table'),head=el('tr');['Уровень','Полные HP: риск отказа','Половина HP: риск отказа'].forEach(t=>head.append(el('th',t)));table.append(head);for(const level of [1,5,10]){const row=el('tr');row.append(el('td',String(level)));for(const hp of [10,5]){const u={position:'center',sideId:'example',hp,maxHp:10,commander:{level,traits:[]}};row.append(el('td',(Math.round(window.BattleEngine.disobedienceChance(u,'guard:example')*1000)/10)+'%'));}table.append(row);}const wrap=el('div',undefined,'guide-table-wrap');wrap.append(table);obedience.append(wrap);paragraph(obedience,'Примеры без черт рассчитаны текущим движком при открытии справки.');}
const ai=topic(host,'Ручное управление и характеры ИИ',[
'Управление выбирают для стороны сражения: «Сторона игроков» получает явные приказы, автоматическая сторона сама решает движение и отход. Это не принадлежность флота. Командующего можно назначать в обоих режимах.',
'Без приказа сторона игроков не движется и не отступает автоматически, но атакует доступные цели; характер командующего влияет на выбор цели. Назначенный приказ движения отменяет автоматический отход на этот раунд. Автоматическая сторона учитывает уровень, характер, положение, повреждения, доступность целей и условия арены.',
'Ниже приведены действующие описания характеров из движка. Рекомендация вражеской стороны не гарантирует общий фокус: каждое разрешённое действие по-прежнему учитывает доступные цели и дисциплину. Явный «Приоритет цели» позволяет задать рекомендацию вручную.'
]);reference(ai,window.BattleEngine?.personalities,'personality');
const traits=topic(host,'Все черты командующих: преимущества, штрафы, условия',[
'Выберите до четырёх уникальных черт. Подходящие поправки складываются; собственный и чужой сектор различаются. «Авангард» означает корабли в общем «Столкновении», а не новый сектор. Учитывайте ограничения вместе с преимуществами.',
'Карточки ниже взяты из текущего движка. Они не меняют исходный диапазон броска для проверки максимума и подтверждения крита.'
]);reference(traits,window.BattleEngine?.traits,'commander');return b;}
function fleets(host){topic(host,'Флот и типы кораблей: заполнение редактора',[
'Пульт ✎ → «Создать флот» либо досье флота → редактирование. Укажите название, авторское описание, размещение в системе или событии, принадлежность и цвет. Отношение к другим флотам не задаёт управление: ручной или автоматический режим выбирают у стороны перед боем.',
'Состав задаётся типами кораблей: 1–20 типов, суммарно не более 500 кораблей на флот. Количество — целое 0–500; нулевой тип сохраняется, пустой флот в бой не входит. Для каждого типа укажите имя, максимальные HP 10–100, включительные диапазоны атаки и защиты 0–1000; нижний порог не выше верхнего.',
'«Малый», «Средний», «Большой» — вид модели, а не боевой бонус. Мультиатака включается отдельно: число действий — целое от 2. Обычный корабль имеет одно действие; общий предел нагрузки проверяется при запуске боя. Успешный выстрел снимает 1 HP независимо от разницы атаки и защиты.',
'При загрузке старого черновика максимальные HP ниже 10 поднимаются до 10. Численность, сохранённые ранения юнитов и история сражений не меняются. В новом самостоятельном бою уцелевшие начинают с полными HP; продолжение текущего расчёта сохраняет ранения.'
]);const ships=topic(host,'Черты типов: ремонтные дроны, силовые щиты и варп',[
'Черта назначается типу и действует на каждый его корабль. Можно сочетать разные черты. Проверяйте собственный тыл и ограничения окончательного бегства: сохранённый корабль может продолжать удерживать бой открытым. Числа и условия ниже читаются из текущего движка.'
]);reference(ships,window.BattleEngine?.shipTraits,'ship');}
function combat(host){topic(host,'Событие, состав сторон и начальная расстановка',[
'Создайте событие типа «Боевое» либо выберите существующее. В досье откройте «Провести сражение». Распределите доступные непустые флоты между 2–6 сторонами: перетаскиванием либо выбором стороны в карточке. Один флот участвует только на одной стороне; союзники одной стороны друг в друга не стреляют.',
'Состав стороны раскрывается по флотам и типам. Для ручного управления отметьте «Сторона игроков» и задайте количество каждого типа в «Столкновении», остальные остаются в собственном арьергарде. В центре необходимо минимум 30% кораблей всей стороны с округлением вверх; это не отдельный минимум для каждого типа. Автоматическая расстановка выполняется при старте. В тылу бой не начинается.',
'До старта настройте бонус защиты и штраф атаки собственного арьергарда, подтверждаемые криты и режим мультиатак. Старт показывает расстановку — раунд 0, без списания потерь. Затем рассчитывайте раунды, просматривайте журнал и утверждайте выбранный результат.'
]);topic(host,'Круглая арена: разрешённые цели и секторные штрафы',[
'У всех сторон общее «Столкновение»; у каждой стороны собственные арьергард и тыл. Из центра доступны враги в центре и арьергардах. Из арьергарда доступны центр и все арьергарды. В любом тылу доступны только враги того же тылового сектора; собственный тыл не стреляет.',
'Обычный маршрут: центр ↔ арьергард стороны ↔ тыл той же стороны. Между разными арьергардами путь проходит через центр. В чужой тыл входят через его арьергард. За раунд разрешено одно движение; обычное движение расходует действие атаки, оставшиеся мультиатаки могут стрелять. Бесплатные движения и исключения описаны в чертах.',
'Постоянный бонус защиты действует только на цель в её собственном арьергарде против стрелка из центра. Штраф атаки действует на стрелка в его собственном арьергарде при огне в другой арьергард; для центра или того же сектора его нет. Значения берутся из настроек стороны, а не назначаются моделью корабля. Черты и разовые бонусы складываются отдельно.',
'Атака и защита — целые броски в заданных диапазонах включительно. Итоговая атака строго выше защиты наносит 1 HP; равенство не наносит урон. Подтверждённый крит также снимает только 1 HP. Для крита важен исходный максимальный бросок, не сумма бонусов.'
]);topic(host,'Приказы, фокус, бонусы и следующий раунд',[
'Выберите сторону, флот, весь флот или конкретный тип. Задайте абсолютное условие текущих HP, количество и сектор назначения. Ноль в количестве приказа означает всех подходящих. Первый подходящий приказ получает корабль; последующие не перехватывают уже назначенный. Сбежавших выбирать нельзя.',
'Приказ движения задаёт конечную цель, но обычный корабль проходит только один допустимый шаг за раунд. Для продолжения маршрута приказ нужно повторить. «Приоритет цели» задаёт вражескую сторону, «Зачистить астероиды» — действие в выбранном секторе. При неповиновении фокусу выбор возвращается ко всем разрешённым врагам.',
'Разовые целые поправки атаки и защиты задаются всем кораблям, стороне, флоту или типу. Подходящие бонусы и штрафы складываются, не меняют максимальные HP, количество действий и исходные диапазоны критов. Приказы и разовые бонусы действуют только на следующий новый раунд, затем очередь очищается.'
]);const events=topic(host,'Условия арены и астероиды',[
'Условия выбирают перед боем и перед новым раундом; они не пересчитывают уже рассчитанную историю. Условия текущего движка приведены ниже.',
'Астероиды видны в секторах арены. Они могут перехватывать обычные выстрелы; приказ зачистки расходует действие атаки и обстреливает астероид. ИИ выбирает зачистку с учётом характера и обстановки. Выключение дождя прекращает новые появления, но не удаляет оставшиеся астероиды. Проверяйте журнал: препятствия, щиты, криты и секторные поправки учитываются отдельно.'
]);reference(events,window.BattleEngine?.eventTraits||window.BattleEngine?.stageTraits,'event');
// Optional richer canonical mechanics supplied by newer engine versions.
if(window.BattleEngine?.helpDescriptions)reference(events,window.BattleEngine.helpDescriptions,'mechanics');
topic(host,'Отвод, бегство, история и утверждение',[
'Живой корабль в собственном тылу отведён, но ещё не сбежал: его может атаковать враг в том же секторе. После трёх завершённых раундов подряд обычно происходит окончательное бегство; выход обнуляет счётчик. Черты могут менять срок или запрещать бегство. До бегства можно вернуть корабль приказом; после него вернуть нельзя.',
'Победа — когда все остальные стороны уничтожены или окончательно сбежали, а не сравнение долей HP. Отведённые, ещё не сбежавшие корабли мешают завершению. «Уцелело» включает активных, отведённых и сбежавших; «Потеряно» — только уничтоженных.',
'«Предыдущий» и «Следующий» показывают сохранённые раунды, не перебрасывают кубики. Новый раунд добавляется к концу расчёта с текущими ранениями. Полный расчёт можно остановить и продолжить с новыми приказами; остановка не объявляет победу по HP.',
'До утверждения карта и численность флотов не меняются. «Утвердить раунд N» сохраняет именно просматриваемый раунд, добавляет запись в историю события и вычитает только уничтоженные корабли по флотам и типам. Закрытие окна или возврат к расстановке не списывает потери. Если состав изменился после начала, проведите новый расчёт.',
'Черновик локальный: сохраните JSON для резервной копии, полную сборку для публикации кода и данных. Частичный экспорт заменяет только изменённые файлы данных, не код сайта. Обновление максимальных HP и командующих не переписывает историю уже утверждённых боёв.'
]);}
function renderBody(host,kind){host.replaceChildren();const intro=el('div',undefined,'guide-intro');intro.append(el('h2',kind==='commander'?'Справочник командующего':kind==='fleet'?'Создание и настройка флота':'Правила сражения'),el('p','Раскройте нужную тему. Характеры, черты и условия читаются из текущего движка при открытии.'));host.append(intro);if(kind!=='commander')fleets(host);commanders(host);if(kind!=='commander')combat(host);host.append(el('footer','Конец справки · × или Esc закрывают окно','guide-end'));window.TraitTextV44?.refresh();}
function makeDialog(id,title){const d=el('dialog');d.id=id;d.className='sector-window guide-v31 help-v46-dialog';d.setAttribute('aria-labelledby',id+'-title');const h=el('header',undefined,'dialog-head standard-header'),t=el('h2',title);t.id=id+'-title';const close=el('button','×','icon-btn');close.type='button';close.setAttribute('aria-label','Закрыть справку');close.onclick=()=>d.close();h.append(t,close);d.append(h,el('div',undefined,'sector-window-body guide-body legacy-help-wrap'));document.body.append(d);d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});return d;}
const commander=makeDialog('commander-help-v46','КОМАНДУЮЩИЕ · СПРАВКА'),fleet=makeDialog('fleet-help-v46','ФЛОТ · СПРАВКА');
function open(kind){const d=kind==='commander'?commander:fleet;renderBody(d.querySelector('.guide-body'),kind);if(!d.open)d.showModal();}
function button(header,id,label,kind){if(!header||$(id))return $(id);const b=el('button','?','icon-btn help-button-v46');b.id=id;b.type='button';b.title=label;b.setAttribute('aria-label',label);b.onclick=()=>open(kind);const close=header.querySelector('button:last-of-type');header.insertBefore(b,close);return b;}
button($('commander-registry-dialog')?.querySelector(':scope > header'),'registry-help-v46','Справка по созданию командующего','commander');
const fleetButton=button($('object-dialog')?.querySelector(':scope > .dialog-head'),'fleet-help-toggle-v46','Справка по созданию и редактированию флота','fleet');if(fleetButton)fleetButton.hidden=true;
document.addEventListener('fleet-form-open',e=>{if(fleetButton)fleetButton.hidden=e.detail.type!=='fleet';});
const battle=$('combat-help');function refreshCombat(){const body=battle?.querySelector('.guide-body,.sector-window-body,.legacy-help-wrap');if(body){body.classList.add('guide-body','legacy-help-wrap');renderBody(body,'combat');}}
if(battle){refreshCombat();new MutationObserver(()=>{if(battle.open)refreshCombat();}).observe(battle,{attributes:true,attributeFilter:['open']});}
// Add current links to the main guide without replacing its map/shortcut topics.
const main=$('help')?.querySelector('.guide-body');if(main){for(const old of [...main.querySelectorAll('.guide-topic')])if(/Командиры|Настройка флота/.test(old.querySelector('summary')?.textContent||''))old.remove();const b=topic(main,'Командующие и настройка флота',['Командующего можно назначить любому флоту. Уровни, дисциплина, все черты, состав кораблей и условия боя — в справочниках ниже.']);for(const [kind,label] of [['commander','Справочник командующего'],['fleet','Справочник флота и боя']]){const link=el('button',label,'guide-link');link.type='button';link.onclick=()=>open(kind);b.append(link);}}
window.HelpV46={open,refreshCombat,renderBody};
})();

;
/* nav-v46.js */
'use strict';
/* Faction index only: original app owns selection, markers and dossier cards. */
(()=>{
 const $=id=>document.getElementById(id),labels={systems:'Системы',objects:'Объекты',fleets:'Флоты',commanders:'Командующие',events:'События'},state=new Map();
 const normalize=s=>String(s??'').toLocaleLowerCase('ru').replace(/\s+/gu,' ').trim();
 const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=value;return n;};
 let latest=null,lastCounts={};
 function index(data){
  const groups=new Map((data.groups||[]).map(g=>[g.key,{...g,categories:Object.fromEntries(Object.keys(labels).map(k=>[k,[]]))}]));
  const bucket=key=>{key=key||null;if(!groups.has(key))groups.set(key,{key,label:key||'Без принадлежности',color:'#a8dce7',categories:Object.fromEntries(Object.keys(labels).map(k=>[k,[]]))});return groups.get(key);};
  const systems=new Map([...(data.systems||[]),...(data.events||[])].map(s=>[String(s.id),s]));
  for(const s of data.systems||[]){const group=bucket(s.group);group.categories.systems.push({kind:'systems',id:s.id,name:s.name,source:s});
   for(const [oi,o] of (s.objects||[]).entries()){group.categories.objects.push({kind:'objects',id:s.id,objectId:o.id,oi,name:o.name,source:o,system:s,context:s.name});
    for(const [fi,f] of (o.features||[]).entries())group.categories.objects.push({kind:'objects',id:s.id,objectId:o.id,featureId:f.id,oi,fi,name:f.name,source:f,system:s,context:s.name+' · '+o.name});
   }
  }
  for(const f of data.fleets||[]){const parent=systems.get(String(f.system)),key=Object.hasOwn(f,'faction')?f.faction:parent?.factionGroup||parent?.group;bucket(key).categories.fleets.push({kind:'fleets',id:f.id,name:f.name,source:f,context:parent?.name});}
  for(const c of data.commanders||[])bucket(c.factionGroup).categories.commanders.push({kind:'commanders',commanderId:c.id,name:c.name,source:c});
  for(const e of data.events||[])bucket(e.factionGroup||e.group).categories.events.push({kind:'events',id:e.id,name:e.name,source:e});
  return [...groups.values()];
 }
 function hint(counts){return Object.entries(labels).map(([k,label])=>label+': '+counts[k]).join(' · ')+'; объекты включают места и ресурсы внутри системы, без повторного счёта систем.';}
 function counts(groups){return Object.fromEntries(Object.keys(labels).map(k=>[k,groups.reduce((n,g)=>n+g.categories[k].length,0)]));}
 function fold(key,cls,title,total,open,badge){
  const d=el('details',cls);d.dataset.navKey=key;d.open=open;const s=el('summary');s.append(el('span','nav-chevron-v46','›'),el('span','group-dot'),el('span','nav-label-v46',title));
  if(badge)s.append(badge);else s.append(el('span','nav-badge-slot-v46'));
  s.append(el('span','group-total',total));d.append(s);
  d.addEventListener('toggle',()=>{if(!normalize($('search').value)&&d.isConnected)state.set(key,d.open);});return d;
 }
 function mark(target){if(!target)return;document.querySelectorAll('.nav-target-v46').forEach(n=>n.classList.remove('nav-target-v46'));target.classList.add('nav-target-v46');target.tabIndex=-1;target.scrollIntoView({block:'center',behavior:'auto'});target.focus({preventScroll:true});}
 function openCommander(id){window.CommanderRegistry?.open();const cards=[...document.querySelectorAll('#commander-registry-dialog [data-commander-id]')];const card=cards.find(c=>c.dataset.commanderId===id);if(card){for(let p=card.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;mark(card);}else window.galaxyApp.toast('Карточка командующего недоступна.');}
 function selectRow(row,select){
  if(row.kind==='commanders')return openCommander(row.commanderId);
  select(row.id);
  if(row.kind==='objects'){
   /* SystemObjects renders in source array order. Tag original nodes with exact canonical IDs. */
   const cards=[...document.querySelectorAll('#system-contents > .system-object-card')];
   for(const [oi,o] of (row.system.objects||[]).entries()){const card=cards[oi];if(!card)continue;card.dataset.objectId=o.id;const fs=[...card.querySelectorAll(':scope > .system-feature')];(o.features||[]).forEach((f,i)=>{if(fs[i])fs[i].dataset.featureId=f.id;});}
   const card=cards[row.oi];if(card){card.open=true;const feature=row.fi==null?null:card.querySelectorAll(':scope > .system-feature')[row.fi];if(feature)feature.open=true;mark(feature||card);}
  }
 }
 function render(options){
  latest=options;const {data,filter='all',favorites=new Set(),selected,select}=options,list=$('object-list'),q=normalize($('search').value),all=index(data);lastCounts=counts(all);
  const allowed=r=>(filter==='all'||filter==='favorites'&&r.id!=null&&favorites.has(String(r.id))&&r.kind!=='objects'||filter==='fleets'&&r.kind==='fleets'||filter==='events'&&r.kind==='events')&&(!q||normalize(r.name).includes(q));
  list.replaceChildren();let visibleCount=0;
  for(const g of all){const visible=Object.fromEntries(Object.keys(labels).map(k=>[k,g.categories[k].filter(allowed)])),total=Object.values(visible).reduce((n,a)=>n+a.length,0);if(!total)continue;visibleCount+=total;
   let badge=null;if(g.overlord){const parent=all.find(p=>p.key===g.overlord);badge=el('span','nav-vassal-v46');const title='Вассал · '+(parent?.label||g.overlord);badge.title=title;badge.setAttribute('aria-label',title);badge.setAttribute('role','img');badge.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 14 4-4m-7 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1"/></svg>';}
   const key=JSON.stringify(['group',g.key]),section=fold(key,'group nav-group-v46',g.label,total,q?!!total:state.get(key)??true,badge);section.dataset.group=g.key??'';section.style.setProperty('--group-color',g.color);section.querySelector('.group-total').title=hint(Object.fromEntries(Object.keys(labels).map(k=>[k,visible[k].length])));list.append(section);
   for(const k of Object.keys(labels)){const rows=visible[k];if(!rows.length)continue;const ck=JSON.stringify(['category',g.key,k]),category=fold(ck,'nav-category-v46',labels[k],rows.length,q?!!rows.length:state.get(ck)??true);category.dataset.category=k;section.append(category);
    const objectSystems=new Map(),objectBranches=new Map();
    for(const r of rows){let rowHost=category;
     if(k==='objects'){
      const sk=String(r.system.id);if(!objectSystems.has(sk)){const fk=JSON.stringify(['object-system',g.key,sk]),branch=fold(fk,'nav-object-branch-v46',r.system.name,rows.filter(x=>String(x.system.id)===sk).length,q?true:state.get(fk)??true);branch.dataset.navObjectSystem=sk;category.append(branch);objectSystems.set(sk,branch);}rowHost=objectSystems.get(sk);
      const ok=JSON.stringify([sk,r.objectId]);if(!objectBranches.has(ok)){const fk=JSON.stringify(['object',g.key,sk,r.objectId]),branch=fold(fk,'nav-object-branch-v46',r.system.objects[r.oi].name,rows.filter(x=>String(x.system.id)===sk&&x.objectId===r.objectId).length,q?true:state.get(fk)??true);branch.dataset.navObjectId=r.objectId;rowHost.append(branch);objectBranches.set(ok,branch);}rowHost=objectBranches.get(ok);
     }
     const button=el('button','object-row nav-row-v46');button.type='button';button.dataset.kind=r.kind;if(r.id!=null)button.dataset.id=r.id;if(r.objectId!=null)button.dataset.objectId=r.objectId;if(r.featureId!=null)button.dataset.featureId=r.featureId;if(r.commanderId!=null)button.dataset.commanderId=r.commanderId;
     button.classList.toggle('active',r.id!=null&&String(selected?.id)===String(r.id));button.append(el('span','row-dot'),el('span','row-name',r.name),el('span','row-star',r.id!=null&&favorites.has(String(r.id))?'★':''));button.title=r.context?r.name+' · '+r.context:r.name;button.setAttribute('aria-label',button.title);button.onclick=()=>selectRow(r,select);rowHost.append(button);
    }
   }
  }
  $('result-count').textContent='Найдено: '+visibleCount;$('result-count').title=hint(lastCounts);$('result-count').setAttribute('aria-label','Найдено записей: '+visibleCount+'. '+hint(lastCounts));$('favorite-count').textContent=favorites.size;
  if(!list.children.length)list.append(el('p','empty-state','Ничего не найдено. Попробуйте другое название.'));
 }
 function refresh(){const app=window.galaxyApp;if(!app)return;const opts=app.getNavigationState?.()||latest||{};render({...opts,data:app.getData(),select:id=>app.selectId(id)});}
 window.GalaxyNavV46={render,refresh,index,counts:()=>({...lastCounts}),openCommander};
 const search=$('search');search.placeholder='Системы, объекты, флоты, командующие…';search.setAttribute('aria-label','Найти систему, объект, место, флот, командующего или событие');
 $('collapse-groups').onclick=()=>{const ds=[...$('object-list').querySelectorAll('details')],open=!ds.some(d=>d.open);ds.forEach(d=>{d.open=open;if(!normalize(search.value))state.set(d.dataset.navKey,open);});$('collapse-groups').textContent=open?'Свернуть':'Раскрыть';};
 document.addEventListener('galaxy-data-changed',refresh);document.addEventListener('commander-registry-ready',refresh);refresh();
})();

;
/* polish-v47.js */
'use strict';
/* v47: native fleet drag edge scrolling and editing-window chrome only. */
(() => {
  if (window.GalaxyPolishV47) return;
  const editingIds = new Set([
    'object-dialog', 'admin-dialog', 'factions-dialog', 'faction-manager-dialog',
    'commander-registry-dialog', 'system-objects-dialog', 'battle-dialog',
    'battle-help', 'combat-help', 'territory-help', 'help', 'help-v46'
  ]);
  function markDialogs() {
    for (const dialog of document.querySelectorAll('dialog')) {
      if (!editingIds.has(dialog.id)) continue;
      dialog.classList.add('editing-window-v47');
      if (dialog.id === 'battle-dialog') {
        const body = dialog.querySelector(':scope > .sector-window-body');
        if (body) body.classList.add('battle-window-body');
      }
    }
  }
  markDialogs();
  new MutationObserver(markDialogs).observe(document.body, {childList: true});

  const dialog = document.getElementById('battle-dialog');
  let activeFleet = null, point = null, frame = 0, previousTime = 0;
  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  }
  function finish() {
    stopFrame();
    activeFleet = null;
    point = null;
  }
  function isFleetTransfer(event) {
    return !!activeFleet && !!event.dataTransfer &&
      Array.from(event.dataTransfer.types).includes('text/plain');
  }
  // Clip to the scrollport, its overflow ancestors and the visible viewport.
  function visibleRect(element) {
    const r = element.getBoundingClientRect();
    const vv = window.visualViewport;
    const clip = {
      left: Math.max(r.left, vv ? vv.offsetLeft : 0),
      right: Math.min(r.right, vv ? vv.offsetLeft + vv.width : innerWidth),
      top: Math.max(r.top, vv ? vv.offsetTop : 0),
      bottom: Math.min(r.bottom, vv ? vv.offsetTop + vv.height : innerHeight)
    };
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        clip.top = Math.max(clip.top, bounds.top);
        clip.bottom = Math.min(clip.bottom, bounds.bottom);
      }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
        clip.left = Math.max(clip.left, bounds.left);
        clip.right = Math.min(clip.right, bounds.right);
      }
    }
    return clip;
  }
  function scrollIntent() {
    if (!point || !dialog?.open || !activeFleet) return null;
    const hit = document.elementFromPoint(point.x, point.y);
    if (!hit || !dialog.contains(hit)) return null;
    const body = dialog.querySelector('.battle-window-body, .sector-window-body');
    if (!body?.contains(hit)) return null;
    // Native roster cards can live inside a separately scrolling pool, too.
    const candidates = [body];
    for (let element = hit; element && element !== body; element = element.parentElement) candidates.push(element);
    for (const element of candidates) {
      if (!/(auto|scroll)/.test(getComputedStyle(element).overflowY) ||
          element.scrollHeight <= element.clientHeight + 1) continue;
      const r = visibleRect(element);
      if (point.x < r.left || point.x > r.right || point.y < r.top || point.y > r.bottom) continue;
      const edge = Math.min(64, (r.bottom - r.top) / 4);
      if (edge <= 0) continue;
      const top = Math.max(0, 1 - (point.y - r.top) / edge);
      const bottom = Math.max(0, 1 - (r.bottom - point.y) / edge);
      const direction = bottom > top ? bottom : -top;
      if (!direction) continue;
      if ((direction < 0 && element.scrollTop <= 0) ||
          (direction > 0 && element.scrollTop >= element.scrollHeight - element.clientHeight - 1)) continue;
      return {element, speed: direction * 680};
    }
    return null;
  }
  function tick(time) {
    frame = 0;
    const intent = scrollIntent();
    if (!intent) { previousTime = 0; return; }
    const elapsed = previousTime ? Math.min(40, time - previousTime) : 16;
    previousTime = time;
    intent.element.scrollTop += intent.speed * elapsed / 1000;
    frame = requestAnimationFrame(tick);
  }
  if (dialog) {
    // Bubble: fleetCard's existing native handler has populated text/plain.
    dialog.addEventListener('dragstart', event => {
      const card = event.target.closest?.('#battle-setup .battle-fleet[draggable="true"]');
      finish();
      if (!card || !event.dataTransfer ||
          event.dataTransfer.getData('text/plain') !== card.dataset.fleetId) return;
      activeFleet = card.dataset.fleetId;
    });
    dialog.addEventListener('dragover', event => {
      if (!isFleetTransfer(event)) return;
      point = {x: event.clientX, y: event.clientY};
      const intent = scrollIntent();
      if (!intent) { stopFrame(); return; }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (!frame) frame = requestAnimationFrame(tick);
    });
    dialog.addEventListener('dragleave', event => {
      // Child-to-child native dragleave is not a departure from the window.
      if (event.relatedTarget && dialog.contains(event.relatedTarget)) return;
      if (event.target === dialog || !event.relatedTarget) stopFrame();
    });
    dialog.addEventListener('close', finish);
    dialog.addEventListener('cancel', finish);
  }
  document.addEventListener('drop', finish, true);
  document.addEventListener('dragend', finish, true);
  window.addEventListener('blur', finish);
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  window.GalaxyPolishV47 = Object.freeze({refresh: markDialogs});
})();
