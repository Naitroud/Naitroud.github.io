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
