(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BattleEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const personalities=Object.freeze({
  aggressive:Object.freeze({id:'aggressive',name:'Агрессивный',description:'Не отступает. При доступной дальней цели в 25% случаев сближается вместо выстрела.',advanceChance:0.25,retreatChance:0,retreatHp:0}),
  cautious:Object.freeze({id:'cautious',name:'Осторожный',description:'При HP ≤ 60% или явном превосходстве противника в 80% случаев отходит на один сектор к своему тылу.',advanceChance:0,retreatChance:0.8,retreatHp:0.6}),
  balanced:Object.freeze({id:'balanced',name:'Уравновешенный',description:'Обычно атакует; при HP ≤ 35% в 35% случаев отходит к своему тылу.',advanceChance:0,retreatChance:0.35,retreatHp:0.35}),
  tactician:Object.freeze({id:'tactician',name:'Тактик',description:'Выбирает доступную цель с наименьшим HP. При HP ≤ 30% в 50% случаев отходит к своему тылу.',advanceChance:0,retreatChance:0.5,retreatHp:0.3})
});
function commander(f){
  if(f.commander==null)return null;
  const c=f.commander;
  if(typeof c!=='object'||typeof c.name!=='string'||!c.name.trim()||c.name.length>100||!Object.hasOwn(personalities,c.personality))throw Error('Некорректный командир: имя и характер обязательны.');
  return {name:c.name,personality:c.personality};
}
function stats(f){
  const s={count:f.count??10,attackMin:f.attackMin??5,attackMax:f.attackMax??20,defenseMin:f.defenseMin??5,defenseMax:f.defenseMax??20,hp:f.hp??3};
  for(const [k,v] of Object.entries(s))if(!Number.isInteger(v)||v<(k==='hp'?1:0)||v>(k==='count'?500:k==='hp'?100:1000))throw Error('Некорректный параметр '+k);
  if(s.attackMin>s.attackMax||s.defenseMin>s.defenseMax)throw Error('Нижний порог выше верхнего.');
  s.multiAttack=f.multiAttack===true;s.attacks=s.multiAttack?Number(f.attacks??2):1;
  if(!Number.isSafeInteger(s.attacks)||s.attacks<(s.multiAttack?2:1))throw Error('Мультиатака: целое количество от 2.');
  s.model=f.model??'medium';
  if(!['small','medium','large'].includes(s.model))throw Error('Некорректная модель корабля.');
  commander(f);
  if(f.shipTypes!==undefined)s.count=types(f).reduce((n,t)=>n+t.count,0);
  return s;
}
function types(f){
  if(f.shipTypes===undefined)return [{id:'legacy',name:'Основной тип',...stats(f)}];
  if(!Array.isArray(f.shipTypes)||!f.shipTypes.length||f.shipTypes.length>20)throw Error('Нужно 1–20 типов кораблей.');
  const ids=new Set();
  const ts=f.shipTypes.map(t=>{
    if(!t||typeof t.id!=='string'||!t.id.trim()||ids.has(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>100)throw Error('Неверное название или ID типа кораблей.');
    ids.add(t.id);return {id:t.id,name:t.name,...stats({...t,shipTypes:undefined})};
  });
  if(ts.reduce((n,t)=>n+t.count,0)>500)throw Error('Максимум 500 кораблей на флот.');
  return ts;
}
// Shared circular center is one sector. Guard can fire into center, not vice versa.
function legalTargets(attacker,units){
  if(attacker.hp<=0||attacker.withdrawn||attacker.position==='rear:'+attacker.sideId)return [];
  return units.filter(u=>u.hp>0&&u.sideId!==attacker.sideId&&(u.position===attacker.position||(attacker.position.startsWith('guard:')&&u.position==='center')));
}
function legalMoves(unit,sides){
  if(unit.hp<=0||unit.withdrawn||unit.position==='rear:'+unit.sideId)return [];
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
  if(unit.position==='guard:'+unit.sideId)return 'rear:'+unit.sideId;
  if(unit.position==='center')return 'guard:'+unit.sideId;
  if(unit.position.startsWith('guard:'))return 'center';
  return legalMoves(unit,sides)[0]??null;
}
function decideMove(unit,enemies,targets,sides,random){
  const p=unit.commander?personalities[unit.commander.personality]:null;
  // Cautious disadvantage: every live enemy has attackMin > this ship's
  // defenseMax and defenseMin >= its attackMax (a visibly hopeless matchup).
  const outmatched=p?.id==='cautious'&&enemies.every(e=>e.attackMin>unit.defenseMax&&e.defenseMin>=unit.attackMax);
  if(p&&p.retreatChance>0&&(unit.hp/unit.maxHp<=p.retreatHp||outmatched)&&random()<p.retreatChance)return retreat(unit,sides);
  if(!targets.length)return advance(unit,enemies,sides,random);
  if(p?.advanceChance&&targets.every(t=>t.position!==unit.position)&&random()<p.advanceChance)return advance(unit,enemies,sides,random);
  return null;
}
function counts(own){
  const living=own.filter(u=>u.hp>0),withdrawn=living.filter(u=>u.withdrawn).length;
  return {survivors:living.length,destroyed:own.length-living.length,active:living.length-withdrawn,withdrawn,remainingHp:own.reduce((n,u)=>n+u.hp,0)};
}
function results(units,sides){
  const scores=sides.map(s=>{
    const own=units.filter(u=>u.sideId===s.id),c=counts(own),initialHp=own.reduce((n,u)=>n+u.maxHp,0);
    return {...s,hp:c.remainingHp,initialHp,integrity:initialHp?c.remainingHp/initialHp:0,alive:c.survivors,total:own.length,active:c.active,withdrawn:c.withdrawn};
  });
  const top=Math.max(...scores.map(s=>s.integrity)),leaders=scores.filter(s=>Math.abs(s.integrity-top)<1e-10),winnerId=leaders.length===1&&top>0?leaders[0].id:null;
  const fleetResults=[...new Set(units.map(u=>String(u.fleetId)))].map(id=>{
    const own=units.filter(u=>String(u.fleetId)===id),c=counts(own);
    return {id,sideId:own[0].sideId,initial:own.length,...c,shipTypes:[...new Set(own.map(u=>u.typeId))].map(tid=>{
      const ts=own.filter(u=>u.typeId===tid);return {id:tid,name:ts[0].typeName,model:ts[0].model,initial:ts.length,...counts(ts)};
    }),disposition:!c.survivors?'Сокрушены':winnerId===null?'Ничья':own[0].sideId===winnerId?'Победитель':'Сбежали / сдались'};
  });
  return {scores,fleetResults,winnerId,winnerName:winnerId!==null?scores.find(s=>s.id===winnerId).name:'Ничья'};
}
function simulate({fleets,sides,rounds,seed=1,critsEnabled=true,splitMultiAttacks=false}){
  if(!Number.isInteger(rounds)||rounds<1||rounds>1000)throw Error('Раунды: от 1 до 1000.');
  if(!Array.isArray(sides)||sides.length<2||sides.length>6||new Set(sides.map(s=>String(s.id))).size!==sides.length||sides.some(s=>typeof s.id!=='string'||!s.id.trim()||typeof s.name!=='string'||!s.name.trim()||!Array.isArray(s.fleetIds)||!s.fleetIds.length))throw Error('Нужны 2–6 непустых сторон.');
  if(!Array.isArray(fleets)||fleets.some(f=>!f||f.id==null)||new Set(fleets.map(f=>String(f.id))).size!==fleets.length)throw Error('Неверный список флотов.');
  const used=new Set(),units=[],map=new Map(fleets.map(f=>[String(f.id),f]));
  let state=Number(seed)>>>0;
  const random=()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
  const roll=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1));
  for(const side of sides)for(const id of side.fleetIds){
    if(used.has(String(id)))throw Error('Флот не может участвовать в двух сторонах.');used.add(String(id));
    const f=map.get(String(id));if(!f)throw Error('Флот не найден.');
    const ts=types(f),fleetCommander=commander(f);if(!ts.some(t=>t.count))throw Error('Уничтоженный флот не может участвовать в бою.');
    for(const s of ts)for(let i=0;i<s.count;i++)units.push({id:String(id)+'#'+s.id+'#'+i,typeId:s.id,typeName:s.name,model:s.model,commander:fleetCommander?{...fleetCommander}:null,multiAttack:s.multiAttack,attacks:s.attacks,fleetId:f.id,sideId:side.id,maxHp:s.hp,hp:s.hp,attackMin:s.attackMin,attackMax:s.attackMax,defenseMin:s.defenseMin,defenseMax:s.defenseMax,position:'guard:'+side.id,withdrawn:false});
  }
  if(units.length>1500)throw Error('Максимум 1500 кораблей в одном бою.');
  if(units.reduce((n,u)=>n+u.attacks,0)*rounds>2000000)throw Error('Слишком большой расчёт: уменьшите раунды, корабли или мультиатаки (лимит 2 млн действий).');
  const log=[],roundSummaries=[];let completedRounds=0,logTruncated=false;
  const record=entry=>{if(log.length<5000)log.push(entry);else logTruncated=true;};
  for(let round=1;round<=rounds;round++){
    if(new Set(units.filter(u=>u.hp>0).map(u=>u.sideId)).size<2||!units.some(u=>u.hp>0&&!u.withdrawn))break;
    const living=units.filter(u=>u.hp>0&&!u.withdrawn),order=splitMultiAttacks?living.flatMap(u=>Array(u.attacks).fill(u)):[...living];
    for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    let turn=0;
    for(const attacker of order){
      turn++;const shots=splitMultiAttacks?1:attacker.attacks;
      for(let shot=1;shot<=shots;shot++){
        if(attacker.hp<=0||attacker.withdrawn)break;
        const enemies=units.filter(u=>u.hp>0&&u.sideId!==attacker.sideId);if(!enemies.length)break;
        const targets=legalTargets(attacker,units),from=attacker.position;if(!attacker.commander){const uncertainty=random();if(uncertainty<.18){record({round,turn,shot,action:'skip',attacker:attacker.id,from,reason:'Нет командующего'});continue;}if(uncertainty<.28){const moves=legalMoves(attacker,sides).filter(p=>p!=='rear:'+attacker.sideId);if(moves.length){const to=moves[Math.floor(random()*moves.length)];attacker.position=to;record({round,turn,shot,action:'move',attacker:attacker.id,from,to,withdrawn:false,reason:'Несогласованный манёвр'});continue;}}}
        const to=decideMove(attacker,enemies,targets,sides,random);
        if(to){
          attacker.position=to;attacker.withdrawn=to==='rear:'+attacker.sideId;
          record({round,turn,shot,action:'move',attacker:attacker.id,from,to,withdrawn:attacker.withdrawn});
          continue;
        }
        if(!targets.length)continue;
        const weakest=Math.min(...targets.map(t=>t.hp));
        const available=attacker.commander?.personality==='tactician'?targets.filter(t=>t.hp===weakest):targets;
        const target=available[Math.floor(random()*available.length)],attack=roll(attacker.attackMin,attacker.attackMax),defense=roll(target.defenseMin,target.defenseMax);
        const criticalCandidate=critsEnabled&&attack===attacker.attackMax,criticalChance=Math.min(100,Math.floor(attacker.attackMax/5)*5),confirmationRoll=criticalCandidate?roll(1,100):null,critical=criticalCandidate&&confirmationRoll<=criticalChance,damage=critical||attack>defense?1:0;
        target.hp=Math.max(0,target.hp-damage);
        record({round,turn,shot,action:'attack',attacker:attacker.id,target:target.id,from,targetPosition:target.position,attack,defense,criticalCandidate,criticalChance,confirmationRoll,critical,damage,targetHp:target.hp});
      }
    }
    completedRounds=round;
    const summary=results(units,sides);
    roundSummaries.push({round,unitHp:units.map(u=>u.hp),unitZones:units.map(u=>u.position),unitWithdrawn:units.map(u=>u.withdrawn),sides:summary.scores,fleetResults:summary.fleetResults});
  }
  return {rules:{critsEnabled,splitMultiAttacks},sides:JSON.parse(JSON.stringify(sides)),seed:Number(seed)>>>0,requestedRounds:rounds,completedRounds,...results(units,sides),units,roundSummaries,log,logTruncated};
}
function summarize(r,round){
  if(!Number.isInteger(round)||round<0||round>r.roundSummaries.length)throw Error('Раунд не найден.');
  const snapshot=round?r.roundSummaries[round-1]:null;
  const units=r.units.map((u,i)=>({...u,hp:snapshot?snapshot.unitHp[i]:u.maxHp,position:snapshot?.unitZones?.[i]??'guard:'+u.sideId,withdrawn:snapshot?.unitWithdrawn?.[i]??false}));
  return {...r,selectedRound:round,completedRounds:round,units,...results(units,r.sides)};
}
return {stats,types,simulate,summarize,legalTargets,legalMoves,personalities,commander};
});
