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