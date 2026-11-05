'use strict';
(() => {
 const data=JSON.parse(document.getElementById('galaxy-data').textContent);
 const $=id=>document.getElementById(id);
 const groups=new Map(data.groups.map(g=>[g.key,g]));
 let items=[...data.systems.map(s=>({...s,isFleet:false})),...data.fleets.map(f=>({...f,isFleet:true,group:'Флоты'}))];
 let byId=new Map(items.map(i=>[String(i.id),i]));
 const markerNodes=new Map();
 let selected=null,filter='all',faction=null,scale=1,tx=0,ty=0,drag=null,toastTimer;
 let favorites=new Set();
 try{favorites=new Set(JSON.parse(localStorage.getItem('ugalaxy-favorites-v1')||'[]'));}catch{}
 const viewport=$('viewport'),world=$('world');
 const mobileMode=matchMedia('(max-width:700px), (max-width:950px) and (max-height:500px)');
 const isMobile=()=>mobileMode.matches;
 function dockState(){const nav=$('nav-toggle').getAttribute('aria-expanded')==='true',layers=!$('layers').hidden,dossier=!$('inspector').hidden;$('mobile-nav').setAttribute('aria-expanded',String(nav));$('mobile-layers').setAttribute('aria-expanded',String(layers));$('mobile-dossier').disabled=!selected;[['mobile-nav',nav],['mobile-layers',layers],['mobile-dossier',dossier]].forEach(([id,on])=>$(id).classList.toggle('active',on));}
 function hideDossier(){ $('inspector').hidden=true;document.body.classList.remove('inspecting');dockState();}
 function showDossier(){if(!selected)return;if(isMobile())setNav(false);setLayers(false);$('inspector').hidden=false;document.body.classList.add('inspecting');dockState();}
 function setLayers(open){if(open){if(isMobile())setNav(false);hideDossier();}$('layers').hidden=!open;$('layers-toggle').setAttribute('aria-expanded',String(open));if(open){$('layers-content').hidden=false;$('layers-collapse').setAttribute('aria-expanded','true');$('layers-collapse').textContent='−';}dockState();}
 $('layers-close').onclick=()=>setLayers(false);$('layers-toggle').onclick=()=>setLayers($('layers').hidden);$('mobile-layers').onclick=()=>setLayers($('layers').hidden);
 $('layers-collapse').onclick=()=>{const open=$('layers-content').hidden;$('layers-content').hidden=!open;$('layers-collapse').textContent=open?'−':'+';$('layers-collapse').setAttribute('aria-expanded',String(open));};
 $('inspector-collapse').onclick=()=>{const folded=$('inspector').classList.toggle('folded');$('inspector-collapse').textContent=folded?'+':'−';$('inspector-collapse').setAttribute('aria-expanded',String(!folded));};
 $('mobile-nav').onclick=()=>setNav($('nav-toggle').getAttribute('aria-expanded')!=='true');$('mobile-dossier').onclick=()=>{$('inspector').hidden?showDossier():hideDossier();};
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
 const systemOf=i=>i.isFleet?data.systems.find(s=>String(s.id)===String(i.system)):i;
 const groupOf=i=>groups.get(systemOf(i).group);
 const text=(el,value)=>{el.textContent=value;return el;};
 const node=(tag,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;return el;};
 $('era').textContent=data.era;
 $('system-count').textContent=data.systems.length+' систем';
 function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);}
 function sorted(list){const order=new Map(data.groups.map((g,i)=>[g.key,i]));return [...list].sort((a,b)=>{
  const group=(order.get(a.group)??99)-(order.get(b.group)??99);if(group)return group;
  const rank=i=>i.order?.startsWith('last')?2:i.order!=null?0:1;
  const diff=rank(a)-rank(b);if(diff)return diff;
  if(rank(a)===0){const n=Number(a.order)-Number(b.order);if(n)return n;}
  if(rank(a)===2){const n=Number(a.order?.split(':')[1]||Infinity)-Number(b.order?.split(':')[1]||Infinity);if(n)return n;}
  return a.name.localeCompare(b.name,'ru');
 });}
 function matches(item){const q=$('search').value.trim().toLocaleLowerCase('ru');return (!q||item.name.toLocaleLowerCase('ru').includes(q))&&(filter!=='favorites'||favorites.has(String(item.id)))&&(filter!=='fleets'||item.isFleet);}
 function renderList(){
  const open=new Set([...$('object-list').querySelectorAll('details[open]')].map(d=>d.dataset.group));
  const first=!$('object-list').children.length;
  const visible=sorted(items.filter(matches));$('object-list').replaceChildren();
  $('result-count').textContent=`Объекты: ${visible.length} / ${items.length}`;
  $('favorite-count').textContent=favorites.size;
  if(!visible.length){$('object-list').append(text(node('div','empty-state'),filter==='favorites'?'В избранном пока нет объектов. Отметьте систему звездой в её карточке.':'Объекты не найдены. Попробуйте другое название.'));return;}
  let section=null,last=null;
  visible.forEach(item=>{
   if(item.group!==last){last=item.group;section=node('details','group');section.dataset.group=last;section.style.setProperty('--group-color',item.isFleet?'#a8dce7':groupOf(item).color);section.open=first||!!$('search').value||filter!=='all'||open.has(last);
    const summary=node('summary');summary.append(node('span','group-dot'),text(node('span'),groups.get(last)?.label||last),text(node('span','group-total'),visible.filter(i=>i.group===last).length));section.append(summary);$('object-list').append(section);}
   const row=node('button','object-row');row.dataset.id=item.id;row.classList.toggle('active',String(selected?.id)===String(item.id));row.style.setProperty('--group-color',groupOf(item).color);
   row.append(node('span','row-dot'),text(node('span','row-name'),item.name.trim()));
   if(favorites.has(String(item.id)))row.append(text(node('span','row-star'),'★'));
   else if(item.order==='0'){const el=node('span','capital');el.innerHTML=crown;el.title='Столица';row.append(el);}
   row.addEventListener('click',()=>select(item));section.append(row);
  });
 }
 function setFilter(value){filter=value;['all','favorite','fleet'].forEach((key,i)=>$(key+'-filter').classList.toggle('selected',['all','favorites','fleets'][i]===filter));renderList();}
 $('all-filter').onclick=()=>setFilter('all');$('favorite-filter').onclick=()=>setFilter('favorites');$('fleet-filter').onclick=()=>setFilter('fleets');$('search').addEventListener('input',renderList);
 $('collapse-groups').onclick=()=>{const details=[...$('object-list').querySelectorAll('details')],close=details.some(d=>d.open);details.forEach(d=>d.open=!close);$('collapse-groups').textContent=close?'Раскрыть':'Свернуть';};
 function setNav(open){if(open&&isMobile()){setLayers(false);hideDossier();}$('navigation').classList.toggle('closed',!open);$('navigation').inert=!open;$('nav-toggle').setAttribute('aria-expanded',String(open));document.body.classList.toggle('nav-closed',!open);dockState();}
 $('nav-toggle').onclick=()=>setNav($('nav-toggle').getAttribute('aria-expanded')!=='true');
 function applyTransform(){world.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;world.style.setProperty('--inverse-scale',Math.max(.55,1/scale));world.style.setProperty('--overview-label-scale',Math.min(3,1/scale));world.classList.toggle('universe-overview',scale<.19);$('zoom-status').textContent=`${Math.round(scale*100)}%`;}
 function constrain(){const w=viewport.clientWidth,h=viewport.clientHeight;tx=Math.min(w-90-universe.x*scale,Math.max(90-(universe.x+universe.width)*scale,tx));ty=Math.min(h-90-universe.y*scale,Math.max(90-(universe.y+universe.height)*scale,ty));}
 function fit(animate=true){cameraMode='universe';overview(universe,animate);}
 function galaxyHome(animate=true){cameraMode='galaxy';overview(galaxy,animate);}
 function zoom(factor,x=viewport.clientWidth/2,y=viewport.clientHeight/2){cancelFlight();cameraMode='manual';const next=Math.min(3.5,Math.max(.035,scale*factor));tx=x-(x-tx)*next/scale;ty=y-(y-ty)*next/scale;scale=next;constrain();applyTransform();}
 function center(item,animate=true){cameraMode='system';const s=systemOf(item),next=Math.max(scale,.9),mobile=isMobile();const landscape=mobile&&innerWidth>innerHeight,left=$('nav-toggle').getAttribute('aria-expanded')==='true'&&!mobile?340:0,right=landscape&&!$('inspector').hidden?Math.min(340,innerWidth*.42):mobile?0:360,x=left+(viewport.clientWidth-left-right)/2,y=mobile&&!landscape?viewport.clientHeight*.25:viewport.clientHeight*.48;flyTo({scale:next,tx:x-(s.x+6)*next,ty:y-(s.y+6)*next},{animate,jump:true});}
 $('fit').onclick=()=>fit();$('galaxy-home').onclick=()=>galaxyHome();$('zoom-in').onclick=()=>zoom(1.25);$('zoom-out').onclick=()=>zoom(.8);
 viewport.addEventListener('wheel',e=>{e.preventDefault();const rect=viewport.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-rect.left,e.clientY-rect.top);$('peek').hidden=true;},{passive:false});
 const pointers=new Map();let pinch=null;
 viewport.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;cancelFlight();cameraMode='manual';pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,tx,ty,moved:false};viewport.classList.add('dragging');if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y)};}$('peek').hidden=true;});
 viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),r=viewport.getBoundingClientRect();zoom(distance/pinch.distance,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinch.distance=distance;if(drag)drag.moved=true;return;}if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;tx=drag.tx+dx;ty=drag.ty+dy;constrain();applyTransform();});
 function endPointer(e){pointers.delete(e.pointerId);pinch=null;drag=null;viewport.classList.remove('dragging');if(pointers.size===1){const a=[...pointers.values()][0];drag={x:a.x,y:a.y,tx,ty,moved:true};}}
 viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);
 function peek(item,el){const r=el.getBoundingClientRect(),v=viewport.getBoundingClientRect();$('peek').replaceChildren(text(node('small'),groupOf(item).label),text(node('span'),item.name.trim()));$('peek').hidden=false;$('peek').style.left=Math.max(12,Math.min(viewport.clientWidth-275,r.left-v.left+28))+'px';$('peek').style.top=Math.max(12,Math.min(viewport.clientHeight-70,r.top-v.top-20))+'px';}
 function renderMarkers(){markerNodes.clear();$('markers').replaceChildren();
 data.systems.forEach(s=>{const b=node('button','system-marker');b.style.left=(s.x+6)+'px';b.style.top=(s.y+6)+'px';b.style.setProperty('--marker-color',groups.get(s.group).color);b.setAttribute('aria-label',s.name.trim());b.dataset.id=s.id;b.append(text(node('span','system-label'),s.name.trim()));b.onclick=e=>{e.stopPropagation();select(byId.get(String(s.id)));};b.onpointerenter=()=>peek(s,b);b.onpointerleave=()=>{$('peek').hidden=true;};b.onfocus=()=>peek(s,b);b.onblur=()=>{$('peek').hidden=true;};$('markers').append(b);markerNodes.set(String(s.id),b);});
 data.fleets.forEach(f=>{const s=data.systems.find(s=>String(s.id)===String(f.system)),b=node('button','fleet-marker');b.style.left=(s.x+f.offset)+'px';b.style.top=(s.y-16)+'px';b.classList.add(f.type.includes('enemy')?'enemy':f.type.includes('Friend')?'friend':f.type.includes('Neutral')?'neutral':'ally');b.innerHTML=ship;b.setAttribute('aria-label',f.name);b.onclick=e=>{e.stopPropagation();select(byId.get(f.id));};b.onpointerenter=()=>peek(byId.get(f.id),b);b.onpointerleave=()=>{$('peek').hidden=true;};$('markers').append(b);markerNodes.set(f.id,b);});
 }
 function refreshData(next){const oldId=selected?.id;data.systems=next.systems;data.fleets=next.fleets;items=[...data.systems.map(s=>({...s,isFleet:false})),...data.fleets.map(f=>({...f,isFleet:true,group:'Флоты'}))];byId=new Map(items.map(i=>[String(i.id),i]));selected=byId.get(String(oldId))||null;renderMarkers();renderList();$('system-count').textContent=data.systems.length+' систем';if(selected)select(selected);else hideDossier();}
 function updateSelection(){markerNodes.forEach((el,id)=>{el.classList.toggle('selected',selected&&(String(selected.id)===id||(selected.isFleet&&String(selected.system)===id)));if(el.classList.contains('system-marker'))el.classList.toggle('dimmed',!!faction&&byId.get(id).group!==faction);});$('object-list').querySelectorAll('.object-row').forEach(el=>el.classList.toggle('active',String(selected?.id)===el.dataset.id));}
 function select(item){selected=item;$('peek').hidden=true;$('inspector').classList.remove('folded');$('inspector-collapse').textContent='−';$('inspector-collapse').setAttribute('aria-expanded','true');showDossier();const s=systemOf(item),g=groupOf(item);const capital=!item.isFleet&&item.order==='0';$('capital-badge').hidden=!capital;$('capital-badge').innerHTML=crown+'<span>СТОЛИЧНАЯ СИСТЕМА</span>';$('inspector-emblem').dataset.capital=String(capital);$('inspector-emblem').innerHTML='<svg class="system-model" viewBox="0 0 140 140"><circle class="model-core" cx="70" cy="70" r="20"/><ellipse cx="70" cy="70" rx="59" ry="22" transform="rotate(-28 70 70)"/><ellipse cx="70" cy="70" rx="49" ry="32" transform="rotate(42 70 70)"/><circle cx="25" cy="84" r="4"/><circle cx="111" cy="94" r="3"/>'+(capital?'<path class="model-crown" d="m53 54 7 7 10-13 10 13 7-7-4 23H57l-4-23Zm4 27h26"/><circle class="capital-ring" cx="70" cy="70" r="64"/>':'<path d="M56 70h28M70 56v28"/>')+'</svg>';document.documentElement.style.setProperty('--selected-color',g.color);$('object-type').textContent=item.isFleet?'ДОСЬЕ ФЛОТА':'ДОСЬЕ СИСТЕМЫ';$('detail-group').textContent=g.label;
  if(item.isFleet)$('detail-title').textContent=item.name;else{$('detail-title').innerHTML=item.titleHtml;$('detail-title').querySelectorAll('a').forEach(a=>a.rel='noopener noreferrer');}
  $('detail-coordinates').textContent=`X ${String(s.x).padStart(4,'0')} / Y ${String(s.y).padStart(4,'0')}${item.isFleet?' · '+s.name.trim():''}`;
  $('detail-description').textContent=item.description||'Описание не задано в исходной карте.';$('description-panel').open=true;
  $('detail-fleets').replaceChildren();if(!item.isFleet)data.fleets.filter(f=>f.system===item.id).forEach(f=>{const b=text(node('button'),f.name.trim()+' ↗');b.onclick=()=>select(byId.get(f.id));$('detail-fleets').append(b);});
  $('selection-status').textContent=item.name.trim();updateFavoriteButton();updateSelection();center(item);$('inspector').scrollTop=0;
 }
 function closeInspector(){hideDossier();}
 $('close-inspector').onclick=closeInspector;$('focus-object').onclick=()=>selected&&center(selected);
 function updateFavoriteButton(){const saved=selected&&favorites.has(String(selected.id));$('favorite-object').textContent=saved?'★':'☆';$('favorite-object').setAttribute('aria-pressed',String(!!saved));$('favorite-object').setAttribute('aria-label',saved?'Удалить из избранного':'Добавить в избранное');}
 $('favorite-object').onclick=()=>{if(!selected)return;const id=String(selected.id);favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('ugalaxy-favorites-v1',JSON.stringify([...favorites]));}catch{toast('Браузер не разрешил сохранить избранное.');}updateFavoriteButton();renderList();};
 $('influence-toggle').onchange=()=>{$('influence-map').classList.toggle('off',!$('influence-toggle').checked);};$('labels-toggle').onchange=()=>world.classList.toggle('show-labels',$('labels-toggle').checked);$('fleets-toggle').onchange=()=>world.classList.toggle('hide-fleets',!$('fleets-toggle').checked);
 $('faction-toggle').onclick=()=>{$('faction-list').hidden=!$('faction-list').hidden;$('faction-toggle').setAttribute('aria-expanded',String(!$('faction-list').hidden));};
 function setFaction(key){faction=key;$('faction-list').querySelectorAll('button').forEach(b=>b.classList.toggle('active',(b.dataset.key||null)===key));$('faction-toggle').firstChild.textContent=key?(groups.get(key).label+' '):'Выделить державу ';updateSelection();if(key){const sys=data.systems.filter(s=>s.group===key);if(sys.length){const centerX=sys.reduce((n,s)=>n+s.x,0)/sys.length,centerY=sys.reduce((n,s)=>n+s.y,0)/sys.length;cameraMode='faction';const next=Math.max(scale,.6);flyTo({scale:next,tx:viewport.clientWidth*.52-centerX*next,ty:viewport.clientHeight*.45-centerY*next},{jump:true});}}}
 [{key:'',label:'Все державы',color:'#78dfea'},...data.groups].forEach(g=>{const b=node('button');b.dataset.key=g.key;b.style.setProperty('--group-color',g.color);b.append(node('i'),text(node('span'),g.label));b.onclick=()=>setFaction(g.key||null);$('faction-list').append(b);});
 $('help-toggle').onclick=()=>{$('help').showModal();};$('close-help').onclick=()=>$('help').close();$('help').addEventListener('click',e=>{if(e.target===$('help')){const r=$('help').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('help').close();}});
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Полноэкранный режим недоступен в этом браузере.');}};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('help').open)$('help').close();else closeInspector();return;}if(e.target.matches('input,textarea,select')||document.querySelector('dialog[open]'))return;if(e.key==='/'){e.preventDefault();setNav(true);$('search').focus();}if(e.key.toLowerCase()==='n'||e.key.toLowerCase()==='т')setNav($('nav-toggle').getAttribute('aria-expanded')!=='true');if(e.key==='+'||e.key==='=')zoom(1.25);if(e.key==='-')zoom(.8);if(e.key.toLowerCase()==='l'||e.key.toLowerCase()==='д')setLayers($('layers').hidden);if(e.key==='0')fit();if(e.key.toLowerCase()==='g'||e.key.toLowerCase()==='п')galaxyHome();});
 $('base-map').addEventListener('error',()=>toast('Не удалось загрузить изображение карты. Проверьте папку assets.'));
 $('influence-map').addEventListener('error',()=>{$('influence-toggle').checked=false;$('influence-toggle').disabled=true;$('influence-map').classList.add('off');});
 new ResizeObserver(()=>{if(cameraMode==='system'&&selected)center(selected,false);else if(cameraMode==='universe')fit(false);else if(cameraMode==='galaxy')galaxyHome(false);else{cancelFlight();constrain();applyTransform();}}).observe(viewport);
 reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)cancelFlight();});
 function updateScrollHint(){const el=$('inspector');$('scroll-hint').hidden=el.hidden||el.classList.contains('folded')||el.scrollHeight<=el.clientHeight+40||el.scrollTop+el.clientHeight>=el.scrollHeight-38;}
 $('inspector').addEventListener('scroll',updateScrollHint);$('description-panel').addEventListener('toggle',()=>requestAnimationFrame(updateScrollHint));
 new ResizeObserver(()=>requestAnimationFrame(updateScrollHint)).observe($('inspector'));
 renderMarkers();renderList();window.galaxyApp={getData:()=>JSON.parse(JSON.stringify(data)),getSelected:()=>selected,replaceData:refreshData,selectId:id=>{const i=byId.get(String(id));if(i)select(i);},hidePanels:()=>{setNav(false);setLayers(false);hideDossier();},mapPoint:(x,y)=>{const r=viewport.getBoundingClientRect();return {x:Math.round((x-r.left-tx)/scale-6),y:Math.round((y-r.top-ty)/scale-6)};},toast};if(isMobile()){setNav(false);setLayers(false);}dockState();galaxyHome(false);
 mobileMode.addEventListener('change',()=>{setNav(false);setLayers(false);hideDossier();galaxyHome(false);});
 if(window.visualViewport){const syncHeight=()=>{document.documentElement.style.setProperty('--app-height',window.visualViewport.height+'px');};window.visualViewport.addEventListener('resize',syncHeight);syncHeight();}
})();
