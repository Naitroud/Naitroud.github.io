(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BattleEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const personalities=Object.freeze({
  aggressive:Object.freeze({id:'aggressive',name:'Агрессивный',description:'Избегает заведомо бесполезных выстрелов. В бою с несколькими противниками выбирает цель взвешенно: предпочтение характера и огневая угроза, без обязательного фокуса. В дуэли выбирает наиболее опасную цель. При HP ≤ 12% с вероятностью 12% начинает отход. Из сектора «Столкновение» в 25% случаев сближается с дальней целью.',advanceChance:0.25,retreatChance:.12,retreatHp:.12}),
  cautious:Object.freeze({id:'cautious',name:'Осторожный',description:'Избегает заведомо бесполезных выстрелов. В бою с несколькими противниками выбирает цель взвешенно: предпочтение характера и огневая угроза, без обязательного фокуса. В дуэли выбирает цель с наименьшей долей оставшегося HP. При HP ≤ 16% с вероятностью 18% за раунд начинает отход; при безнадёжном превосходстве противника — 18%.',advanceChance:0,retreatChance:.18,retreatHp:.16}),
  balanced:Object.freeze({id:'balanced',name:'Уравновешенный',description:'Избегает заведомо бесполезных выстрелов. В бою с несколькими противниками выбирает цель взвешенно: предпочтение характера и огневая угроза, без обязательного фокуса. В дуэли выбирает цель с минимальной суммой защиты и удвоенного оставшегося HP. При HP ≤ 12% с вероятностью 12% за раунд начинает отход.',advanceChance:0,retreatChance:.12,retreatHp:.12}),
  tactician:Object.freeze({id:'tactician',name:'Тактик',description:'Избегает заведомо бесполезных выстрелов. В бою с несколькими противниками выбирает цель взвешенно: предпочтение характера и огневая угроза, без обязательного фокуса. В дуэли выбирает доступную цель с наименьшим HP. При HP ≤ 14% с вероятностью 15% начинает отход.',advanceChance:0,retreatChance:.15,retreatHp:.14})
});
// Canonical UI text and engine modifiers share one immutable dictionary.
function trait(id,name,bonus,downside,scope,duration,effects={}){
  const probabilityNote=effects.disobedience||effects.withdrawalDisobedience||effects.recoveryDisobedience?'Изменение складывается с абсолютным шансом: например, 8% − 5% = 3%, не относительное умножение; итог ограничен 0–50%.':'';
  return {id,name,bonus,downside,scope,duration,probabilityNote,description:bonus+' '+downside+' '+scope+' '+duration+(probabilityNote?' '+probabilityNote:''),...effects};
}
const traits=freeze({
  inspiring_leader:trait('inspiring_leader','Внушительный лидер','Неповиновение −5%.','Недостатков нет.','Явный приказ движения из сектора «Столкновение».','Всё сражение.',{disobedience:-.05}),
  decisive_assault:trait('decisive_assault','Решительный натиск','Результат броска атаки +3 после первого входа в сектор «Столкновение» за раунд.','Начальное размещение в секторе «Столкновение» не даёт бонус.','Корабль, вошедший в сектор «Столкновение»; бонус сохраняется при последующем перемещении.','До конца текущего раунда; следующий раунд сбрасывает бонус.',{entryAttack:3}),
  iron_discipline:trait('iron_discipline','Железная дисциплина','Неповиновение −7%.','Результат броска атаки −1.','Неповиновение: явный приказ движения из сектора «Столкновение»; атака: любой сектор.','Всё сражение.',{disobedience:-.07,attack:-1}),
  reckless_charge:trait('reckless_charge','Безрассудный натиск','Результат броска атаки +1 в секторе «Столкновение».','Неповиновение +4%.','Авангард — корабли в секторе «Столкновение», а не отдельный сектор; неповиновение при явном приказе из сектора «Столкновение».','Всё сражение, пока соблюдается условие сектора.',{disobedience:.04,centerAttack:1}),
  protective_screen:trait('protective_screen','Защитный экран','Результат броска защиты +2 только против стрелка в секторе «Столкновение».','Результат броска атаки −1 в собственном арьергарде.','Собственный арьергард; бонус защиты не действует против стрелков из других секторов.','Всё сражение, пока корабль в собственном арьергарде.',{ownGuardAttack:-1,screenDefense:2}),
  orderly_withdrawal:trait('orderly_withdrawal','Организованный отход','Неповиновение −6% при явном приказе из сектора «Столкновение» в собственный тыл.','Срок окончательного бегства не сокращается: обычно 3 завершённых раунда подряд.','Собственный тыл — конечная цель приказа, даже если первый шаг ведёт в собственный арьергард.','Всё сражение.',{withdrawalDisobedience:-.06}),
  seasoned_crew:trait('seasoned_crew','Опытный экипаж','Неповиновение −3%; результат броска защиты +1 в секторе «Столкновение».','Недостатков нет.','Неповиновение: явный приказ из сектора «Столкновение»; защита: корабли в секторе «Столкновение».','Всё сражение.',{disobedience:-.03,centerDefense:1}),
  independent_captains:trait('independent_captains','Независимые капитаны','Результат броска атаки +2 в секторе «Столкновение».','Неповиновение +7%.','Корабли в секторе «Столкновение»; неповиновение при явном приказе движения из сектора «Столкновение».','Всё сражение, пока соблюдается условие сектора.',{disobedience:.07,centerAttack:2}),
  vanguard_screen:trait('vanguard_screen','Экран авангарда','Результат броска защиты +2 в секторе «Столкновение».','Недостатков нет.','Авангард — корабли в секторе «Столкновение», а не отдельный сектор.','Всё сражение, пока корабль в секторе «Столкновение».',{centerDefense:2}),
  vanguard_pressure:trait('vanguard_pressure','Давление авангарда','Результат броска атаки +2 в секторе «Столкновение».','Результат броска защиты −1 в секторе «Столкновение».','Авангард — корабли в секторе «Столкновение», а не отдельный сектор.','Всё сражение, пока корабль в секторе «Столкновение».',{centerAttack:2,centerDefense:-1}),
  layered_armor:trait('layered_armor','Многослойная броня','Результат броска защиты +1 против любого стрелка, которому разрешена атака.','Результат броска атаки −1 в собственном арьергарде.','Собственный арьергард; в отличие от Защитного экрана, защита не ограничена стрелком в секторе «Столкновение».','Всё сражение, пока корабль в собственном арьергарде.',{ownGuardAttack:-1,ownGuardDefense:1}),
  rear_fortification:trait('rear_fortification','Укрепление тыла','Результат броска защиты +3 против вторгшегося в тот же тыл противника.','Недостатков нет.','Только собственный тыл; чужой тыл бонуса не даёт.','Всё сражение, пока корабль в собственном тылу.',{rearIntruderDefense:3}),
  rapid_evacuation:trait('rapid_evacuation','Быстрая эвакуация','Окончательное бегство после 2 завершённых раундов подряд в собственном тылу вместо обычных 3.','Результат броска защиты −1 в собственном тылу.','Только собственный тыл; выход сбрасывает счётчик. Сохраняет корабли ценой участия в бою: уже сбежавшие корабли не возвращаются и не приносят победу.','Всё сражение; учитываются завершённые раунды подряд.',{escapeRounds:2,ownRearDefense:-1}),
  emergency_reentry:trait('emergency_reentry','Экстренное возвращение','Шаг из собственного тыла в собственный арьергард не расходует действие атаки.','Результат броска атаки −2 до конца текущего раунда во всех секторах.','Только разрешённое движение из собственного тыла; не более одного шага за раунд, без повторной попытки; уже сбежавшие корабли исключены.','Штраф действует весь остаток текущего раунда и сбрасывается в следующем; чужой тыл эффекта не даёт.',{reentryAttack:-2}),
  rear_raiders:trait('rear_raiders','Тыловые рейдеры','Результат броска атаки +2 в чужом тылу.','Результат броска защиты −1 в чужом тылу.','Только чужой тыл; собственный тыл эффекта не даёт.','Всё сражение, пока корабль в чужом тылу.',{foreignRearAttack:2,foreignRearDefense:-1}),
  cautious_recovery:trait('cautious_recovery','Осторожное восстановление','Неповиновение −4% при явном приказе из сектора «Столкновение» в собственный арьергард или собственный тыл; результат броска защиты +1 в секторе «Столкновение» при HP ≤ 50%.','HP не восстанавливается.','Снижение неповиновения зависит от конечной цели приказа; защита — только в секторе «Столкновение» при HP не выше половины максимума.','Всё сражение, пока соблюдаются условия приказа и HP.',{recoveryDisobedience:-.04,woundedCenterDefense:1})
});
function commander(f){
  if(f.commander==null)return null;
  const c=f.commander;
  if(typeof c!=='object'||typeof c.name!=='string'||!c.name.trim()||c.name.length>100||!Object.hasOwn(personalities,c.personality))throw Error('Некорректный командир: имя и характер обязательны.');
  const selected=c.traits===undefined?[]:c.traits;
  if(!Array.isArray(selected)||selected.length>4||new Set(selected).size!==selected.length||selected.some(id=>!Object.hasOwn(traits,id)))throw Error('Некорректные черты командира: максимум 4 уникальные известные черты.');
  if(c.id!==undefined&&(typeof c.id!=='string'||!c.id.trim()))throw Error('Некорректный ID командира.');
  return {name:c.name,personality:c.personality,traits:[...selected],...(c.id!==undefined?{id:c.id}:{})};
}
function traitSum(unit,key){return (unit.commander?.traits??[]).reduce((n,id)=>n+(traits[id]?.[key]??0),0);}
function traitAttack(unit,position=unit.position){return traitSum(unit,'attack')+(position==='center'?traitSum(unit,'centerAttack'):0)+(position==='guard:'+unit.sideId?traitSum(unit,'ownGuardAttack'):0)+(position.startsWith('rear:')&&position!=='rear:'+unit.sideId?traitSum(unit,'foreignRearAttack'):0)+(unit.emergencyReentryRound!=null?traitSum(unit,'reentryAttack'):0);}
function traitDefense(unit,from){return (unit.position==='center'?traitSum(unit,'centerDefense')+(unit.hp<=unit.maxHp*.5?traitSum(unit,'woundedCenterDefense'):0):0)+(unit.position==='guard:'+unit.sideId?traitSum(unit,'ownGuardDefense')+(from==='center'?traitSum(unit,'screenDefense'):0):0)+(unit.position==='rear:'+unit.sideId?traitSum(unit,'ownRearDefense')+(from===unit.position?traitSum(unit,'rearIntruderDefense'):0):unit.position.startsWith('rear:')?traitSum(unit,'foreignRearDefense'):0);}
function disobedienceChance(unit,destination){
  if(unit.position!=='center'||destination===unit.position||unit.escaped)return 0;
  const health=Math.max(0,Math.min(1,unit.hp/unit.maxHp));
  return Math.max(0,Math.min(.5,.02+.12*(1-health)+traitSum(unit,'disobedience')+(destination==='rear:'+unit.sideId?traitSum(unit,'withdrawalDisobedience'):0)+(['guard:'+unit.sideId,'rear:'+unit.sideId].includes(destination)?traitSum(unit,'recoveryDisobedience'):0)));
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
function decideMove(unit,enemies,targets,sides,random,retreatChecked){
  const p=unit.commander?personalities[unit.commander.personality]:null;
  if(unit.aiRetreat)return retreat(unit,sides);
  // Cautious disadvantage: every live enemy has attackMin > this ship's
  // defenseMax and defenseMin >= its attackMax (a visibly hopeless matchup).
  const outmatched=p?.id==='cautious'&&enemies.every(e=>e.attackMin>unit.defenseMax&&e.defenseMin>=unit.attackMax);
  if(p&&p.retreatChance>0&&(unit.hp/unit.maxHp<=p.retreatHp||outmatched)&&!retreatChecked.has(unit.id)){
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
  // Aggressive closes from center only: never shuttle out of a firing guard.
  if(p?.advanceChance&&unit.position==='center'&&targets.every(t=>t.position!==unit.position)&&random()<p.advanceChance)return advance(unit,enemies,sides,random);
  return null;
}
function freeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;
}
function counts(own){
  const living=own.filter(u=>u.hp>0),escaped=living.filter(u=>u.escaped).length,withdrawn=living.filter(u=>!u.escaped&&u.withdrawn).length;
  return {survivors:living.length,destroyed:own.length-living.length,active:living.length-withdrawn-escaped,withdrawn,escaped,remainingHp:own.reduce((n,u)=>n+Math.max(0,u.hp),0)};
}
function createBattle({fleets,sides,seed=1,critsEnabled=true,splitMultiAttacks=false}={}){
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
    for(const t of ts)for(let i=0;i<t.count;i++)units.push({id:String(id)+'#'+t.id+'#'+i,typeId:t.id,typeName:t.name,model:t.model,commander:c?{...c,traits:[...c.traits]}:null,multiAttack:t.multiAttack,attacks:t.attacks,fleetId:f.id,sideId:side.id,maxHp:t.hp,hp:t.hp,attackMin:t.attackMin,attackMax:t.attackMax,defenseMin:t.defenseMin,defenseMax:t.defenseMax,position:index++<Math.ceil(count*.3)?'center':'guard:'+side.id,withdrawn:false,escaped:false,rearTurns:0,aiRetreat:false,centerEntryRound:null,emergencyReentryRound:null});
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
  return freeze({rules:{critsEnabled,splitMultiAttacks},sides,seed,rngState:seed,requestedRounds:null,completedRounds:0,...results(units,sides),units,initialUnitZones:units.map(u=>u.position),roundSummaries:[],log:[],logTruncated:false});
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
function nextRound(previous,{commands=[],bonuses=[]}={}){
  if(!previous||!Array.isArray(previous.units)||!Number.isInteger(previous.rngState)||previous.rngState<0||previous.rngState>4294967295)throw Error('Некорректное состояние боя.');
  if(previous.units.some(u=>!Number.isSafeInteger(u.attacks)||u.attacks<1)||previous.units.filter(u=>u.hp>0&&!u.escaped).reduce((n,u)=>n+u.attacks,0)>2000000)throw Error('Лимит 2 млн действий за раунд.');
  if(!Array.isArray(commands)||!Array.isArray(bonuses)||commands.length>1500||bonuses.length>1500)throw Error('Некорректные команды или бонусы.');
  const destinations=new Set(['center',...previous.sides.flatMap(s=>['guard:'+s.id,'rear:'+s.id])]);
  for(const c of commands){validateScope(c,previous,true);if(!destinations.has(c.destination)||!['lt','gt','lte','gte','eq','any'].includes(c.hpOp)||!Number.isFinite(c.hpValue)||c.hpValue<0||(c.count!==null&&(!Number.isInteger(c.count)||c.count<0||c.count>1500)))throw Error('Некорректный приказ.');}
  for(const b of bonuses){validateScope(b,previous);if(!Number.isFinite(b.attack)||!Number.isFinite(b.defense))throw Error('Некорректный бонус.');}
  const assigned=new Map();
  for(const c of commands){const compare={lt:u=>u.hp<c.hpValue,gt:u=>u.hp>c.hpValue,lte:u=>u.hp<=c.hpValue,gte:u=>u.hp>=c.hpValue,eq:u=>u.hp===c.hpValue,any:()=>true}[c.hpOp];let count=c.count??Infinity;for(const u of previous.units)if(count>0&&u.hp>0&&!u.escaped&&!assigned.has(u.id)&&matches(u,c)&&compare(u)){assigned.set(u.id,c.destination);count--;}}
  if(previous.selectedRound!==undefined){const {selectedRound,...base}=previous;previous={...base,roundSummaries:base.roundSummaries.slice(0,selectedRound),log:base.log.filter(l=>l.round<=selectedRound),logTruncated:selectedRound?(base.roundSummaries[selectedRound-1].logTruncated??false):false};}
  if(previous.finished)return freeze(previous);
  const units=previous.units.map(u=>({...u,centerEntryRound:null,emergencyReentryRound:null})),sides=previous.sides,{critsEnabled,splitMultiAttacks}=previous.rules;
  let rngState=previous.rngState;
  const random=()=>{rngState=(rngState+0x6D2B79F5)>>>0;let t=rngState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
  const roll=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1));
  const log=[...previous.log],roundSummaries=[...previous.roundSummaries],round=previous.completedRounds+1;
  let logTruncated=previous.logTruncated;
  const record=entry=>{if(log.length<5000)log.push(entry);else logTruncated=true;};
  const living=units.filter(u=>u.hp>0&&!u.escaped),order=splitMultiAttacks?living.flatMap(u=>Array(u.attacks).fill(u)):[...living];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  let turn=0;const moved=new Set(),movementRefused=new Set(),retreatChecked=new Set(),disobedience={checked:0,refused:0,bySide:{}};
  for(const attacker of order){
    turn++;const shots=splitMultiAttacks?1:attacker.attacks;
    for(let shot=1;shot<=shots;shot++){
      if(attacker.hp<=0||attacker.escaped)break;
      const enemies=units.filter(u=>u.hp>0&&!u.escaped&&u.sideId!==attacker.sideId);if(!enemies.length)break;
      let targets=legalTargets(attacker,units),from=attacker.position;const player=sides.find(s=>s.id===attacker.sideId).isPlayer;
      if(!moved.has(attacker.id)&&!assigned.has(attacker.id)&&!player&&!attacker.withdrawn&&!attacker.commander){const uncertainty=random();if(uncertainty<.18){record({round,turn,shot,action:'skip',attacker:attacker.id,from,reason:'Нет командующего'});continue;}if(uncertainty<.28){const moves=legalMoves(attacker,sides).filter(p=>p!=='rear:'+attacker.sideId);if(moves.length){const to=moves[Math.floor(random()*moves.length)];attacker.position=to;moved.add(attacker.id);record({round,turn,shot,action:'move',attacker:attacker.id,from,to,withdrawn:false,reason:'Несогласованный манёвр'});continue;}}}
      const commanded=assigned.has(attacker.id);if(commanded)attacker.aiRetreat=false;
      let to=moved.has(attacker.id)||movementRefused.has(attacker.id)?null:commanded?pathStep(attacker,assigned.get(attacker.id),sides):player?null:decideMove(attacker,enemies,targets,sides,random,retreatChecked);
      if(to&&commanded&&from==='center'){
        const chance=disobedienceChance(attacker,assigned.get(attacker.id)),roll=random();
        disobedience.checked++;const sideStats=disobedience.bySide[attacker.sideId]??={checked:0,refused:0};sideStats.checked++;
        if(roll<chance){movementRefused.add(attacker.id);disobedience.refused++;sideStats.refused++;record({round,turn,shot,action:'disobey',attacker:attacker.id,from,to,destination:assigned.get(attacker.id),chance,roll,reason:'Приказ движения отклонён; корабль продолжает допустимые атаки'});to=null;}
      }
      if(to===from){record({round,turn,shot,action:'wait',attacker:attacker.id,from,reason:'Отступление'});continue;}
      if(to){
        const freeMovement=from==='rear:'+attacker.sideId&&to==='guard:'+attacker.sideId&&traitSum(attacker,'reentryAttack')!==0;
        attacker.position=to;if(to==='center'&&attacker.centerEntryRound===null)attacker.centerEntryRound=round;
        moved.add(attacker.id);attacker.withdrawn=to==='rear:'+attacker.sideId;if(!attacker.withdrawn)attacker.rearTurns=0;
        if(freeMovement)attacker.emergencyReentryRound=round;
        record({round,turn,shot,action:'move',attacker:attacker.id,from,to,withdrawn:attacker.withdrawn,...(commanded?{reason:'Приказ'}:{}),...(freeMovement?{freeMovement:true,attackPenalty:traitSum(attacker,'reentryAttack'),emergencyReentryRound:round,reason:'Экстренное возвращение: шаг не расходует действие атаки; результат броска атаки −2 до конца раунда'}:{})});
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
      const rawAttack=roll(attacker.attackMin,attacker.attackMax),rawDefense=roll(target.defenseMin,target.defenseMax);
      const attackerSide=sides.find(s=>s.id===attacker.sideId),targetSide=sides.find(s=>s.id===target.sideId);
      const attack=rawAttack+traitAttack(attacker)+(attacker.centerEntryRound===round?traitSum(attacker,'entryAttack'):0)+bonuses.filter(b=>matches(attacker,b)).reduce((n,b)=>n+b.attack,0)-(from==='guard:'+attacker.sideId&&target.position.startsWith('guard:')&&target.position!==from?attackerSide.guardPenalty:0),defense=rawDefense+traitDefense(target,from)+bonuses.filter(b=>matches(target,b)).reduce((n,b)=>n+b.defense,0)+(from==='center'&&target.position==='guard:'+target.sideId?targetSide.guardArmor:0);
      const criticalCandidate=critsEnabled&&rawAttack===attacker.attackMax,criticalChance=Math.min(100,Math.floor(attacker.attackMax/5)*5),confirmationRoll=criticalCandidate?roll(1,100):null,critical=criticalCandidate&&confirmationRoll<=criticalChance,damage=critical||attack>defense?1:0;
      target.hp=Math.max(0,target.hp-damage);
      record({round,turn,shot,action:'attack',attacker:attacker.id,target:target.id,from,targetPosition:target.position,rawAttack,rawDefense,attack,defense,attackPenalty:attacker.emergencyReentryRound===round?traitSum(attacker,'reentryAttack'):0,emergencyReentryRound:attacker.emergencyReentryRound,criticalCandidate,criticalChance,confirmationRoll,critical,damage,targetHp:target.hp});
    }
  }
  for(const u of units)if(u.hp>0&&!u.escaped){u.withdrawn=u.position==='rear:'+u.sideId;u.rearTurns=u.withdrawn?u.rearTurns+1:0;if(u.rearTurns>=((u.commander?.traits??[]).includes('rapid_evacuation')?traits.rapid_evacuation.escapeRounds:3)){u.escaped=true;u.withdrawn=false;record({round,action:'escape',unit:u.id,position:u.position,hp:u.hp});}}
  const summary=results(units,sides);
  roundSummaries.push({round,rngState,logTruncated,disobedience,unitCenterEntryRound:units.map(u=>u.centerEntryRound),unitEmergencyReentryRound:units.map(u=>u.emergencyReentryRound),unitHp:units.map(u=>u.hp),unitZones:units.map(u=>u.position),unitWithdrawn:units.map(u=>u.withdrawn),unitEscaped:units.map(u=>u.escaped),unitRearTurns:units.map(u=>u.rearTurns),unitAiRetreat:units.map(u=>u.aiRetreat),sides:summary.scores,fleetResults:summary.fleetResults});
  return freeze({...previous,rngState,completedRounds:round,...summary,units,roundSummaries,log,logTruncated});
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
  const units=r.units.map((u,i)=>({...u,hp:snapshot?snapshot.unitHp[i]:u.maxHp,position:snapshot?.unitZones?.[i]??r.initialUnitZones?.[i]??'guard:'+u.sideId,withdrawn:snapshot?.unitWithdrawn?.[i]??false,escaped:snapshot?.unitEscaped?.[i]??false,rearTurns:snapshot?.unitRearTurns?.[i]??0,aiRetreat:snapshot?.unitAiRetreat?.[i]??false,centerEntryRound:snapshot?.unitCenterEntryRound?.[i]??null,emergencyReentryRound:snapshot?.unitEmergencyReentryRound?.[i]??null}));
  return {...r,selectedRound:round,completedRounds:round,rngState:snapshot?.rngState??(round?r.rngState:r.seed),units,...results(units,r.sides)};
}
return {stats,types,createBattle,nextRound,simulate,summarize,legalTargets,legalMoves,personalities,traits,commander,resolveCommanders,disobedienceChance,counts};
});
