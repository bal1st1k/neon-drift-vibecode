/*! NEON DRIFT | Made by bal1st1k */
/* NEON DRIFT — deterministic racing simulation, classic browser script / CommonJS. */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const lerp = (a,b,t) => a+(b-a)*t;
  const angleDiff = (target,current) => Math.atan2(Math.sin(target-current),Math.cos(target-current));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const catalog = root.NDCatalog || (typeof require === 'function' ? require('./catalog.js') : null);
  const trafficSystem=root.NDTraffic||(typeof require==='function'?require('./traffic.js'):null);
  const referenceTracks = root.NDTracks || (typeof require === 'function' ? require('./tracks.js') : []);
  if (!catalog) throw new Error('Load catalog.js before engine.js');
  const { cars,engines,upgrades,getSwapPrice,getUpgradePrice } = catalog;
  let cardSystem=root.NDCards||null;
  if(!cardSystem&&typeof require==='function') {
    try {cardSystem=require('./tuning-cards.js');}
    catch(error) {if(error.code!=='MODULE_NOT_FOUND'||!error.message.includes("'./tuning-cards.js'"))throw error;}
  }
  const computeBuild=(carId,levels={},engineId,equippedCards={})=>cardSystem?cardSystem.computeBuild(carId,levels,engineId,equippedCards):catalog.computeBuild(carId,levels,engineId);

  // Manufacturer reference figures. Other models use a declared hp/tonne estimate.
  // The supplied catalogue's exact power and weight remain authoritative for builds.
  const performanceReferences={
    'ttrs-8j':{zeroToHundred:4.6,source:'for promt/Городской спорткласс/Новий Text Document.txt',note:'User reference for the original 2009 TT RS Coupé.'},
    ...Object.fromEntries(Object.entries(catalog.vwModels).map(([id, model]) => [id, {zeroToHundred:model.seconds,source:'for promt/Народный калибр/СТРОКИ ДЛЯ ТЕХБАЗЫ.txt'}])),
    'm3-e30':{zeroToHundred:6.5,source:'for promt/BMW Motorsport/общие ттх.txt',note:'User balance specification.'},
    'm3-e36':{zeroToHundred:5.5,source:'for promt/BMW Motorsport/общие ттх.txt',note:'User balance specification.'},
    'm3-e46':{zeroToHundred:5.1,source:'for promt/BMW Motorsport/общие ттх.txt',note:'User balance specification.'},
    'mustang-gt':{zeroToHundred:5.2,source:'for promt/американская лошадка/Ford Mustang GT (2005 S197).txt',note:'User balance specification; 245 km/h reference shown in shop, not a hard speed limiter.'},
    'fiat-coupe':{zeroToHundred:6.3,source:'for promt/И вам привет из Италии/общая.txt',note:'User balance specification.'},
    'alfa-155':{zeroToHundred:7.0,source:'for promt/И вам привет из Италии/общая.txt',note:'User balance specification.'},
    'alfa-gtv':{zeroToHundred:6.7,source:'for promt/И вам привет из Италии/общая.txt',note:'User balance specification.'},
    'delta-evo2':{zeroToHundred:5.7,source:'for promt/И вам привет из Италии/общая.txt',note:'User balance specification.'},
    '930-blackbird':{zeroToHundred:5.4,source:'https://www.porsche.com/stories/innovation/brief-history-of-porsche-911-turbo/',note:'Porsche heritage: 930 Turbo 3.3, 300 PS, 0–100 km/h 5.4 s.'},
    ae86:{zeroToHundred:8.3,source:'https://media.toyota.co.uk/60-years-12-generations-one-corolla/',note:'Toyota heritage: approximately 8.3 s to 62 mph.'},
    mrs:{zeroToHundred:7.9,source:'https://media.toyota.co.uk/new-mr2-roadster/',note:'Toyota 2000 launch specification: 140 PS MR2 Roadster, 0–62 mph 7.9 s.'},
    fd3s:{zeroToHundred:5.3,source:'https://uk.mazda-press.com/news/2020/100-years-of-mazda---the-mazda-rx-7/',note:'Mazda heritage: European FD, 239 PS/1300 kg, 0–100 km/h 5.3 s; equivalent power/weight to the supplied build.'}
  };
  const resistanceAt=speed=>2.4+Math.abs(speed)*0.004+speed*speed*0.000025;
  const driveAt=(coefficient,speed)=>coefficient/(1+Math.pow(Math.max(0,speed)/210,1.4));
  const tireYawScale = 1.3, tireYawOffset = 35;
  const calibrationCache=new Map();
  function calibrateAcceleration(targetSeconds) {
    const key=targetSeconds.toFixed(5);
    if(calibrationCache.has(key))return calibrationCache.get(key);
    const targetSpeed=100/0.44;
    const elapsed=coefficient=>{
      let speed=0,time=0;
      while(speed<targetSpeed&&time<60){speed+=Math.max(0,driveAt(coefficient,speed)-resistanceAt(speed))/120;time+=1/120;}
      return time;
    };
    let low=10,high=300;
    for(let iteration=0;iteration<23;iteration++) {
      const middle=(low+high)/2;
      if(elapsed(middle)>targetSeconds)low=middle;else high=middle;
    }
    const result=(low+high)/2;
    if(calibrationCache.size>=256)calibrationCache.delete(calibrationCache.keys().next().value);
    calibrationCache.set(key,result);
    return result;
  }

  const legacyTracks = [
    {id:'harbor',name:'Неоновый порт',subtitle:'Старый город. Три круга.',difficulty:'Лёгкая',accent:'#63f5c5',description:'Широкие дуги между доками и контейнерами.',scenerySeed:7181,closed:true,raceType:'circuit'},
    {id:'ridge',name:'Горный сигнал',subtitle:'Кольцевая трасса над городом.',difficulty:'Средняя',accent:'#b9a1ff',description:'Быстрые связки и затяжные повороты ночного перевала.',scenerySeed:9127,closed:true,raceType:'circuit'},
    {id:'downtown',name:'После полуночи',subtitle:'Три круга по ночному центру.',difficulty:'Сложная',accent:'#ff9969',description:'Городские связки, длинные прямые и поздние торможения.',scenerySeed:3691,closed:true,raceType:'circuit'}
  ];
  const tracks = [...legacyTracks,...referenceTracks];
  const legacyControlPoints = {
    harbor:[[-1420,-760],[-650,-1040],[230,-970],[1170,-810],[1510,-180],[1370,590],[720,1010],[-120,860],[-880,1030],[-1500,600],[-1280,-60],[-1660,-360]],
    ridge:[[-1450,-820],[-620,-1080],[140,-770],[960,-1030],[1460,-510],[1090,90],[1530,680],[670,1060],[-130,730],[-960,980],[-1490,420],[-1100,-90],[-1610,-370]],
    downtown:[[-1400,-810],[-470,-860],[180,-580],[1190,-870],[1510,-260],[1060,210],[1410,810],[500,1030],[-190,660],[-1220,930],[-1540,290],[-1110,-180]]
  };

  // Low-tension Hermite form preserves the hand-traced hairpins without long overshoots.
  function curvePoint(p0,p1,p2,p3,t,tension=0.28) {
    const t2=t*t,t3=t2*t;
    const h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
    return {
      x:h00*p1[0]+h10*(p2[0]-p0[0])*tension+h01*p2[0]+h11*(p3[0]-p1[0])*tension,
      y:h00*p1[1]+h10*(p2[1]-p0[1])*tension+h01*p2[1]+h11*(p3[1]-p1[1])*tension
    };
  }

  function createTrack(id='akina') {
    const meta=tracks.find(item=>item.id===id)||tracks.find(item=>item.id==='akina')||tracks[0];
    const closed=meta.closed!==false;
    const raw=meta.controlPoints||legacyControlPoints[meta.id];
    const controls=raw.map(point=>Array.isArray(point)?point:[point.x,point.y]);
    const dense=[];
    const segments=closed?controls.length:controls.length-1;
    const getControl=index=>controls[closed?(index+controls.length)%controls.length:clamp(index,0,controls.length-1)];
    for(let i=0;i<segments;i++) {
      const a=getControl(i),b=getControl(i+1);
      const steps=clamp(Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/12),12,120);
      for(let j=0;j<steps;j++)dense.push(curvePoint(getControl(i-1),a,b,getControl(i+2),j/steps,meta.tension||0.28));
    }
    dense.push(closed?{...dense[0]}:{x:controls[controls.length-1][0],y:controls[controls.length-1][1]});
    const denseDistances=[0];
    for(let i=1;i<dense.length;i++)denseDistances.push(denseDistances[i-1]+distance(dense[i-1],dense[i]));
    const total=denseDistances[denseDistances.length-1];
    const sampleCount=legacyControlPoints[meta.id]?320:clamp(Math.ceil(total/24)+(closed?0:1),360,1600);
    const points=[];
    let cursor=0;
    for(let i=0;i<sampleCount;i++) {
      const wanted=total*i/(closed?sampleCount:sampleCount-1);
      while(cursor<dense.length-2&&denseDistances[cursor+1]<wanted)cursor++;
      const t=clamp((wanted-denseDistances[cursor])/Math.max(0.0001,denseDistances[cursor+1]-denseDistances[cursor]),0,1);
      points.push({x:lerp(dense[cursor].x,dense[cursor+1].x,t),y:lerp(dense[cursor].y,dense[cursor+1].y,t),distance:wanted});
    }
    let length=0;
    const segmentLengths=[];
    for(let i=0;i<points.length;i++) {
      const next=points[closed?(i+1)%points.length:Math.min(i+1,points.length-1)];
      const previous=points[closed?(i-1+points.length)%points.length:Math.max(i-1,0)];
      const angle=Math.atan2(next.y-previous.y,next.x-previous.x);
      Object.assign(points[i],{angle,normalX:-Math.sin(angle),normalY:Math.cos(angle),distance:length});
      if(closed||i<points.length-1) {
        const size=distance(points[i],next);
        segmentLengths.push(size);length+=size;
      }
    }
    const gateCount=legacyControlPoints[meta.id]?12:clamp(Math.ceil(length/650),12,30);
    const checkpoints=Array.from({length:gateCount+(closed?0:1)},(_,index)=>{
      const pointIndex=Math.round(index*(closed?points.length:points.length-1)/gateCount)%points.length;
      return {...points[pointIndex],index,pointIndex};
    });
    const padding=380;
    const bounds={minX:Math.min(...points.map(p=>p.x))-padding,minY:Math.min(...points.map(p=>p.y))-padding,maxX:Math.max(...points.map(p=>p.x))+padding,maxY:Math.max(...points.map(p=>p.y))+padding};
    const first=points[0],last=points[points.length-1];
    return {...meta,closed,raceType:closed?'circuit':'sprint',width:meta.width||220,points,length,bounds,checkpoints,segmentLengths,
      start:{x:first.x,y:first.y,angle:first.angle},finish:{x:last.x,y:last.y,angle:last.angle},
      controlPoints:controls.map(p=>({x:p[0],y:p[1]}))};
  }

  function sampleTrack(track,requestedDistance) {
    const points=track.points;
    if(!track.closed&&requestedDistance<0) {
      const first=points[0];
      return {...first,x:first.x+Math.cos(first.angle)*requestedDistance,y:first.y+Math.sin(first.angle)*requestedDistance,index:0,distance:0};
    }
    const s=track.closed?((requestedDistance%track.length)+track.length)%track.length:clamp(requestedDistance,0,track.length);
    let low=0,high=points.length-1;
    while(low<high) {const middle=Math.ceil((low+high)/2);if(points[middle].distance<=s)low=middle;else high=middle-1;}
    if(!track.closed&&low===points.length-1)return {...points[low],distance:s,index:low};
    const point=points[low],next=points[(low+1)%points.length];
    const t=clamp((s-point.distance)/Math.max(0.0001,track.segmentLengths[low]),0,1);
    const angle=point.angle+angleDiff(next.angle,point.angle)*t;
    return {x:lerp(point.x,next.x,t),y:lerp(point.y,next.y,t),angle,normalX:-Math.sin(angle),normalY:Math.cos(angle),distance:s,index:low};
  }

  const lineGeometry = new Map();
  function candidateLines(track) {
    if (lineGeometry.has(track.id)) return lineGeometry.get(track.id);
    const { points, width, closed } = track, count = points.length;
    const at = index => closed ? (index + count) % count : clamp(index, 0, count - 1);
    const bend = points.map((_, i) => clamp(angleDiff(points[at(i + 3)].angle, points[at(i - 3)].angle) / .7, -1, 1));
    const lines = Array.from({ length: 10 }, (_, variant) => {
      const look = 4 + variant % 4, apex = .065 + variant * .012, bias = (variant - 4.5) * .021;
      // Keep a centerline candidate and avoid sharp lateral corrections on hairpins.
      const offsets = bend.map((turn, i) => variant === 0 ? 0
        : width * clamp(bias + apex * turn - .07 * (bend[at(i - look)] + bend[at(i + look)]), -.24, .24));
      const route = points.map((point, i) => {
        const offset = (offsets[at(i - 2)] + offsets[at(i + 2)] + 2 * (offsets[at(i - 1)] + offsets[at(i + 1)]) + 3 * offsets[i]) / 9;
        return { x: point.x + point.normalX * offset, y: point.y + point.normalY * offset };
      });
      const segments = track.segmentLengths.map((_, i) => distance(route[i], route[at(i + 1)]));
      route.forEach((point, i) => {
        const prev = route[at(i - 1)], next = route[at(i + 1)];
        point.angle = Math.atan2(next.y - prev.y, next.x - prev.x);
      });
      return { points: route, segments };
    });
    lineGeometry.set(track.id, lines);
    return lines;
  }

  function matchRivals(build, pool) {
    const distanceToBuild = car => Math.abs(Math.log((car.stockPowerHp / car.weightKg) / build.powerToWeight))
      + .45 * Math.abs(Math.log(car.weightKg / build.weightKg))
      + .12 * (car.drivetrain !== build.car.drivetrain);
    return [...pool].sort((a, b) => distanceToBuild(a) - distanceToBuild(b));
  }

  const duelDelay = 1.5;
  const ghostStep = .125, ghostFrameLimit = 4800;

  function nearestPoint(track,x,y,hint=null) {
    let bestSquared=Infinity,best=null;
    const points=track.points,count=track.closed?points.length:points.length-1;
    const inspect=i=>{
      const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y;
      const denominator=dx*dx+dy*dy;
      if(denominator<0.000001)return;
      const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/denominator,0,1),px=a.x+dx*t,py=a.y+dy*t;
      const squared=(x-px)*(x-px)+(y-py)*(y-py);
      if(squared<bestSquared) {
        bestSquared=squared;
        const size=Math.sqrt(denominator);
        best={x:px,y:py,index:i,t,distance:a.distance+track.segmentLengths[i]*t,offset:((x-px)*(-dy)+(y-py)*dx)/size,angle:Math.atan2(dy,dx),normalX:-dy/size,normalY:dx/size};
      }
    };
    if(Number.isInteger(hint)) {
      // A local search cannot jump from one side of a hairpin to the next.
      for(let delta=-8;delta<=10;delta++) {
        const i=track.closed?(hint+delta+count)%count:hint+delta;
        if(i>=0&&i<count)inspect(i);
      }
    }
    if(!best||bestSquared>Math.pow(track.width*4,2))for(let i=0;i<count;i++)inspect(i);
    best.separation=Math.sqrt(bestSquared);
    return best;
  }

  function seededRandom(seed) {
    let state=(Number(seed)||42)>>>0;
    return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  }
  const normalized=value=>Number.isFinite(Number(value))?clamp(Number(value),0,1):0;

  class Engine {
    constructor(options={}) {
      this.options={trackId:options.trackId||'akina',carId:options.carId||'ae85',engineId:options.engineId,paint:options.paint,upgrades:{...options.upgrades},cards:{...options.cards},mode:options.mode||'race',seed:options.seed===undefined?42:options.seed,weather:options.weather,duelRole:options.duelRole,ghost:options.ghost};
      this.reset();
    }

    reset() {
      this.track=createTrack(this.options.trackId);
      this.upgrades=Object.fromEntries(upgrades.map(item=>{
        const numeric=Number(this.options.upgrades[item.id]);
        return [item.id,Number.isFinite(numeric)?clamp(Math.floor(numeric),0,item.maxLevel):0];
      }));
      this.effectiveUpgrades=cardSystem?cardSystem.getLevels(this.upgrades,this.options.cards):{...this.upgrades};
      this.build=computeBuild(this.options.carId,this.upgrades,this.options.engineId,this.options.cards);
      this.car=this.build.car;
      if(this.car.tuningLocked){this.upgrades=Object.fromEntries(upgrades.map(item=>[item.id,0]));this.effectiveUpgrades={...this.upgrades};}
      this.engineId=this.build.engineId;
      this.mode=this.options.mode;
      this.weather=['rain','fog'].includes(this.options.weather)?this.options.weather:'dry';
      this.surfaceGrip=this.weather==='rain'?0.78:1;
      this.duelRole=this.mode==='duel'?(this.options.duelRole==='chase'?'chase':'lead'):null;
      this.launchDelay=this.duelRole==='chase'?duelDelay:0;
      this.playerFinish=null;
      this.bestGhost=this.mode==='time-attack'?this.options.ghost||null:null;
      this.ghost=null;
      this._ghostFrames=[];
      this.random=seededRandom(this.options.seed);
      this.state='countdown';this.countdown=3;this.time=0;this.lap=1;this.totalLaps=this.track.closed?3:1;
      this.bestLap=null;this.lapTimes=[];this.checkpoint=0;this.position=1;this.driftScore=0;this.combo=1;this.credits=0;this.result=null;this.particles=[];this.splits=[];
      this._nextCheckpoint=1;this._lapStart=0;this._driftTime=0;this._driftGrace=0;this._particleClock=0;this._collisionCooldown=0;this._raceDistance=0;
      const start=this.track.start;
      this._nearest=nearestPoint(this.track,start.x,start.y);
      this.player={x:start.x,y:start.y,px:start.x,py:start.y,angle:start.angle,vx:0,vy:0,speed:0,steer:0,yawRate:0,drifting:false,boosting:false,braking:false,throttle:0,nitro:1,integrity:1,color:this.car.color,progress:0,lap:1,offroad:false,collision:false,name:'ТЫ',sprite:catalog.getCarSprite(this.car,this.options.paint,true),spriteAngle:this.car.raceSprite?0:this.car.spriteAngle||0,carId:this.car.id};
      const opponentColors=['#ff6a93','#f4d67d','#7ba9ff'],opponentNames=['NOVA','GHOST','ECHO'];
      const rivalPool=cars.filter(car=>car.id!==this.car.id).slice();
      for(let i=rivalPool.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[rivalPool[i],rivalPool[j]]=[rivalPool[j],rivalPool[i]];}
      const matched=['duel','random'].includes(this.mode);
      const opponentCount=['time-attack','vw-trial'].includes(this.mode)?0:this.mode==='duel'?1:opponentColors.length;
      const lineup=matched?matchRivals(this.build,rivalPool):rivalPool;
      this.rivals=opponentColors.slice(0,opponentCount).map((color,index)=>{
        // Closed circuits wrap behind the line; sprints have no road there.
        const raceDistance=this.duelRole?0:this.track.closed?-90-index*80:45+Math.floor(index/2)*65;
        const point=sampleTrack(this.track,raceDistance),lane=(index===1?1:-1)*this.track.width*0.22;
        const rivalCar=lineup[index];
        return {id:index,name:opponentNames[index],color,x:point.x+point.normalX*lane,y:point.y+point.normalY*lane,px:point.x,py:point.y,angle:point.angle,vx:0,vy:0,speed:0,steer:0,drifting:false,boosting:false,braking:false,throttle:0,nitro:1,integrity:1,progress:0,lap:1,raceDistance,gridStart:raceDistance,gridLane:this.duelRole?this.track.width*.28:lane,releaseAt:this.duelRole==='lead'?duelDelay:0,finished:false,finishTime:null,sprite:rivalCar.raceSprite||rivalCar.sprite,spriteAngle:rivalCar.raceSprite?0:rivalCar.spriteAngle||0,carId:rivalCar.id};
      });
      const m=this.build.multipliers,hpPerTonne=this.build.hpPerTonne;
      this._maxSpeed=clamp((270+hpPerTonne*0.78)*(1+(m.transmission-1)*0.16),300,650);
      const stockRatio=this.car.stockPowerHp/this.car.weightKg*1000;
      const reference=performanceReferences[this.car.id];
      const stockSeconds=reference?reference.zeroToHundred:8.3*Math.pow((130/960*1000)/stockRatio,0.9)*(this.car.drivetrain==='AWD'?0.90:this.car.drivetrain==='FF'?1.03:1);
      const targetSeconds=clamp(stockSeconds*Math.pow(stockRatio/hpPerTonne,0.72)/Math.pow(m.acceleration*m.transmission,0.28)/(1+(m.grip-1)*0.08),this.car.drivetrain==='AWD'?3.2:3.6,30);
      this.performance={zeroToHundred:targetSeconds,stockZeroToHundred:stockSeconds,source:reference?reference.source:null,basis:reference?(reference.source.startsWith('for promt/')?'user-reference':'manufacturer-reference'):'power-to-weight-estimate'};
      this._acceleration=calibrateAcceleration(targetSeconds);
      const massRatio=1100/this.build.weightKg;
      this._handling=clamp((0.9+(this.build.stats.handling||65)*0.0045)*m.handling*Math.pow(massRatio,0.3),0.85,2.1);
      this._grip=clamp(11*m.grip*Math.pow(massRatio,0.25),8.5,23);
      this._lateralAcceleration=650*m.grip*Math.pow(massRatio,0.25)*this.surfaceGrip;
      this._steerResponse=clamp(8.5*Math.pow(massRatio,0.55)*Math.sqrt(m.handling),5,15);
      this._yawResponse=clamp(7.2*Math.pow(massRatio,1.3)*Math.sqrt(m.handling),3.5,14);
      if(this.car.drivetrain==='RR'){this._yawResponse*=.91;this._grip*=1.035;}
      this._brakeStrength=85*m.braking*Math.pow(massRatio,0.12)*this.surfaceGrip;
      this._nitroPower=m.nitroPower;this._nitroDuration=m.nitroDuration;this._differential=m.differential;
      this.traffic=[];
      if(this.track.traffic&&trafficSystem&&this.mode!=='time-attack'){
        // Equal cruise speed preserves the gaps: faster lanes must not close
        // the randomly chosen escape lane later in the race.
        this._trafficSpeed=150+this.random()*40;
        this._trafficFreeLane=Math.floor(this.random()*3);
        let distance=360;
        for(let wave=0;wave<6;wave++){
          for(let slot=0;slot<2;slot++){
            const model=trafficSystem.vehicles[Math.floor(this.random()*trafficSystem.vehicles.length)];
            this.traffic.push({...model,sprite:model.raceSprite,spriteAngle:0,id:'civil-'+(wave*2+slot),wave,speed:this._trafficSpeed});
          }
          this._placeTrafficWave(wave,distance);
          distance=Math.max(...this.traffic.map(car=>car.routeDistance))+380+this.random()*180;
        }
      }
      this._buildSpeedProfile();
      this.racingLines=this.rivals.length?this._rankRacingLines():[];
      const alternateRanks=[1,2,3,4,5,6,7,8,9];
      for(const rival of this.rivals){
        const rank=this.mode==='duel'?Math.floor(this.random()*3):rival.id===0?0:alternateRanks.splice(Math.floor(this.random()*alternateRanks.length),1)[0];
        rival.lineRank=rank+1;
        const point=this._rivalPoint(rival,rival.raceDistance);
        Object.assign(rival,{x:point.x,y:point.y,px:point.x,py:point.y,angle:point.angle});
      }
      if(this.mode==='time-attack')this._startGhostLap();
      this._updatePosition();
      return this;
    }

    update(dt,input={}) {
      if(this.state==='finished'||!Number.isFinite(dt)||dt<=0)return this.getHUD();
      let remaining=Math.min(dt,0.5);
      const controls={throttle:normalized(input.throttle),brake:normalized(input.brake),left:normalized(input.left),right:normalized(input.right),drift:normalized(input.drift),boost:normalized(input.boost)};
      while(remaining>0.0000001&&this.state!=='finished') {
        const step=Math.min(remaining,1/120);this._step(step,controls);remaining-=step;
      }
      return this.getHUD();
    }

    _step(dt,input) {
      if(this.state==='countdown') {
        this.countdown=Math.max(0,this.countdown-dt);
        if(this.countdown<0.000001){this.countdown=0;this.state='running';}
        return;
      }
      this.time+=dt;this._collisionCooldown=Math.max(0,this._collisionCooldown-dt);
      if(this.playerFinish!==null){
        this._updateRivals(dt);
        if(this.rivals[0].finished)this._finish();
        return;
      }
      if(this.time>=this.launchDelay)this._updatePlayer(dt,input);
      this._updateRivals(dt);this._updateTraffic(dt);
      if(this.mode==='time-attack')this._updateGhost();
      this._updateCheckpoints();this._updatePosition();this._updateParticles(dt);
    }

    _yawRate(speed,drifting=false) {
      const speedFactor=clamp(Math.abs(speed)/125,0,1),ease=1/(1+Math.max(Math.abs(speed)-300,0)*0.0015);
      const mechanical=(0.16+speedFactor*2.75)*this._handling*ease*(drifting?1.1:1);
      const tireLimit=this._lateralAcceleration*tireYawScale/(Math.abs(speed)+tireYawOffset);
      return Math.min(mechanical,tireLimit);
    }

    _buildSpeedProfile() {
      const points=this.track.points,count=points.length;
      this._speedProfile=points.map((point,index)=>{
        const previous=points[this.track.closed?(index-1+count)%count:Math.max(0,index-1)];
        const next=points[this.track.closed?(index+1)%count:Math.min(count-1,index+1)];
        const span=Math.max(1,distance(previous,point)+distance(point,next));
        const curvature=Math.abs(angleDiff(next.angle,previous.angle))/span;
        let limit=Math.min(this._maxSpeed*0.94,Math.sqrt(this._lateralAcceleration/Math.max(curvature,0.000001)));
        if(curvature>0.0001) {
          for(let pass=0;pass<3;pass++)limit=Math.min(limit,this._yawRate(limit)*0.88/curvature);
        }
        return Math.max(65,limit);
      });
      // The player's autopilot needs to brake before corner entry.
      for(let pass=0;pass<(this.track.closed?4:1);pass++) {
        for(let index=count-1;index>=0;index--) {
          if(!this.track.closed&&index===count-1)continue;
          const next=(index+1)%count;
          const brakingDistance=this.track.segmentLengths[index];
          const reachable=Math.sqrt(this._speedProfile[next]**2+2*this._brakeStrength*0.64*brakingDistance);
          this._speedProfile[index]=Math.min(this._speedProfile[index],reachable);
        }
      }
    }

    _speedTargetAt(routeDistance) {
      const point=sampleTrack(this.track,routeDistance),index=point.index;
      if(!this.track.closed&&index>=this.track.points.length-1)return this._speedProfile[this._speedProfile.length-1];
      const t=clamp((point.distance-this.track.points[index].distance)/this.track.segmentLengths[index],0,1);
      return lerp(this._speedProfile[index],this._speedProfile[(index+1)%this._speedProfile.length],t);
    }

    _rankRacingLines() {
      const { closed } = this.track;
      const tireGrip = this._lateralAcceleration * tireYawScale, halfOffset = tireYawOffset / 2;
      return candidateLines(this.track).map(line => {
        const count = line.points.length;
        const limits = line.points.map((point, i) => {
          const prev = (i - 1 + count) % count, next = (i + 1) % count;
          const curve = Math.abs(angleDiff(line.points[closed || i < count - 1 ? next : i].angle,
            line.points[closed || i > 0 ? prev : i].angle));
          const span = (line.segments[i] || 0) + (i > 0 || closed ? line.segments[prev] : 0);
          const curvature = Math.max(curve, .00001) / Math.max(span, 1);
          // Solve speed * curvature <= tireGrip / (speed + tireYawOffset).
          return clamp(Math.sqrt(tireGrip / curvature + halfOffset ** 2) - halfOffset, 65, this._maxSpeed);
        });
        for (let pass = 0; pass < (closed ? 2 : 1); pass++) {
          for (let i = line.segments.length - 1; i >= 0; i--) {
            const next = (i + 1) % count;
            limits[i] = Math.min(limits[i], Math.sqrt(limits[next] ** 2 + 2 * this._brakeStrength * .95 * line.segments[i]));
          }
          for (let i = 0; i < line.segments.length; i++) {
            const next = (i + 1) % count;
            const drive = Math.max(0, driveAt(this._acceleration, limits[i]) - resistanceAt(limits[i]));
            limits[next] = Math.min(limits[next], Math.sqrt(limits[i] ** 2 + 2 * drive * line.segments[i]));
          }
        }
        const estimate = line.segments.reduce((seconds, length, i) => seconds + 2 * length / (limits[i] + limits[(i + 1) % count]), 0);
        return { points: line.points, limits, estimate };
      }).sort((a,b) => a.estimate - b.estimate);
    }

    _rivalPoint(rival, distance) {
      const point=sampleTrack(this.track,distance);
      const line=this.racingLines[rival.lineRank-1];
      const nextIndex=this.track.closed?(point.index+1)%line.points.length:Math.min(point.index+1,line.points.length-1);
      const here=line.points[point.index],next=line.points[nextIndex];
      const t=clamp((point.distance-this.track.points[point.index].distance)/(this.track.segmentLengths[point.index]||1),0,1);
      const grid=clamp(1-(distance-rival.gridStart)/185,0,1)**2;
      return {x:lerp(lerp(here.x,next.x,t),point.x+point.normalX*rival.gridLane,grid),
        y:lerp(lerp(here.y,next.y,t),point.y+point.normalY*rival.gridLane,grid),
        angle:here.angle+angleDiff(next.angle,here.angle)*t,
        distance:point.distance,target:lerp(line.limits[point.index],line.limits[nextIndex],t)};
    }

    _ghostFrame(t) {
      const { x, y, angle } = this.player;
      return [Math.round(t * 1000), Math.round(x * 10), Math.round(y * 10), Math.round(angle * 1000)];
    }

    _startGhostLap() {
      this._ghostFrames=[this._ghostFrame(0)];
      const car=this.bestGhost&&cars.find(item=>item.id===this.bestGhost.carId);
      this.ghost=car?{sprite:catalog.getCarSprite(car,this.bestGhost.paint,true),spriteAngle:car.raceSprite?0:car.spriteAngle||0,
        color:car.color,x:0,y:0,angle:0,visible:false}:null;
      this._updateGhost();
    }

    _updateGhost() {
      const elapsed=this.time-this._lapStart;
      if(this._ghostFrames.length<ghostFrameLimit&&elapsed>=this._ghostFrames.length*ghostStep){
        this._ghostFrames.push(this._ghostFrame(elapsed));
      }
      if(!this.ghost)return;
      const frames=this.bestGhost.frames, now=elapsed*1000;
      this.ghost.visible=now<=frames[frames.length-1][0];
      if(!this.ghost.visible)return;
      let left=0,right=frames.length-1;
      while(right-left>1){
        const mid=(left+right)>>1;
        if(frames[mid][0]<=now)left=mid;else right=mid;
      }
      const a=frames[left],b=frames[right],t=clamp((now-a[0])/Math.max(1,b[0]-a[0]),0,1);
      Object.assign(this.ghost,{x:lerp(a[1],b[1],t)/10,y:lerp(a[2],b[2],t)/10,angle:(a[3]+angleDiff(b[3]/1000,a[3]/1000)*1000*t)/1000});
    }

    _saveGhostLap(lapTime) {
      if(this.mode!=='time-attack'||this._ghostFrames.length>=ghostFrameLimit||lapTime>= (this.bestGhost?.time??Infinity))return;
      const last=this._ghostFrame(lapTime),frames=this._ghostFrames;
      if(last[0]>frames[frames.length-1][0])frames.push(last);else frames[frames.length-1]=last;
      this.bestGhost={time:lapTime,carId:this.car.id,paint:this.options.paint,frames};
    }

    _updatePlayer(dt,input) {
      const p=this.player;p.px=p.x;p.py=p.y;
      const nearest=nearestPoint(this.track,p.x,p.y,this._nearest.index);
      const onShoulder=nearest.separation>this.track.width*0.5;
      p.offroad=onShoulder;p.collision=false;p.throttle=input.throttle;p.braking=input.brake>0.15;
      const forwardX=Math.cos(p.angle),forwardY=Math.sin(p.angle);
      let forwardSpeed=p.vx*forwardX+p.vy*forwardY;
      const sideSpeed=-p.vx*forwardY+p.vy*forwardX;
      p.steer=lerp(p.steer,input.right-input.left,1-Math.exp(-dt*this._steerResponse));
      p.drifting=input.drift>0.1&&Math.abs(forwardSpeed)>100&&(Math.abs(p.steer)>0.06||Math.abs(sideSpeed)>18);
      p.boosting=input.boost>0.1&&p.nitro>0.005&&input.throttle>0.1&&forwardSpeed>20&&!onShoulder;
      const desiredYaw=p.steer*this._yawRate(forwardSpeed,p.drifting)*(forwardSpeed<-10?-1:1);
      p.yawRate=lerp(p.yawRate,desiredYaw,1-Math.exp(-dt*this._yawResponse));
      p.angle+=p.yawRate*dt;
      p.angle=Math.atan2(Math.sin(p.angle),Math.cos(p.angle));
      const driveForce=driveAt(this._acceleration,forwardSpeed);
      let acceleration=input.throttle*driveForce*(onShoulder?0.55:1);
      if(input.brake>0)acceleration-=(forwardSpeed>12?this._brakeStrength:Math.min(45,this._acceleration*0.75))*input.brake;
      if(p.boosting) {
        acceleration+=driveForce*0.48*this._nitroPower;
        p.nitro=Math.max(0,p.nitro-dt*0.29/this._nitroDuration);
      } else p.nitro=Math.min(1,p.nitro+dt*(p.drifting?0.115:0.055));
      const resistance=resistanceAt(forwardSpeed)*(onShoulder?5.5:1);
      if(Math.abs(forwardSpeed)>0.1)acceleration-=Math.sign(forwardSpeed)*resistance;
      forwardSpeed+=acceleration*dt;
      if(!input.throttle&&!input.brake&&Math.abs(forwardSpeed)<0.7)forwardSpeed=0;
      const maxSpeed=this._maxSpeed*(p.boosting?1.28:1)*(onShoulder?0.64:1);
      if(forwardSpeed>maxSpeed)forwardSpeed=Math.max(maxSpeed,forwardSpeed-dt*280);
      forwardSpeed=Math.max(-75,forwardSpeed);
      let lateralSpeed=sideSpeed*Math.exp(-dt*(p.drifting?2.15*this._differential:this._grip)*this.surfaceGrip);
      if(p.drifting)lateralSpeed+=-p.steer*Math.abs(forwardSpeed)*dt*1.25/this._differential;
      const newForwardX=Math.cos(p.angle),newForwardY=Math.sin(p.angle);
      p.vx=newForwardX*forwardSpeed-newForwardY*lateralSpeed;p.vy=newForwardY*forwardSpeed+newForwardX*lateralSpeed;
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      const corrected=nearestPoint(this.track,p.x,p.y,nearest.index),barrier=this.track.width*0.5+Math.min(44,this.track.width*0.27);
      if(corrected.separation>barrier) {
        const dx=p.x-corrected.x,dy=p.y-corrected.y,size=Math.max(0.001,Math.hypot(dx,dy)),nx=dx/size,ny=dy/size;
        p.x=corrected.x+nx*barrier;p.y=corrected.y+ny*barrier;
        const outwardSpeed=p.vx*nx+p.vy*ny;
        if(outwardSpeed>0){p.vx-=nx*outwardSpeed*1.04;p.vy-=ny*outwardSpeed*1.04;}
        p.vx*=Math.exp(-dt*1.6);p.vy*=Math.exp(-dt*1.6);p.integrity=Math.max(0.25,p.integrity-dt*0.2);p.collision=true;
        if(this._collisionCooldown<=0&&Math.hypot(p.vx,p.vy)>100){this._emitParticles(5,p.x,p.y,'#ffd6a0',130);this._collisionCooldown=0.12;}
      } else p.integrity=Math.min(1,p.integrity+dt*0.012);
      p.speed=p.vx*Math.cos(p.angle)+p.vy*Math.sin(p.angle);
      this._nearest=nearestPoint(this.track,p.x,p.y,corrected.index);
      p.progress=this._nearest.distance/this.track.length;p.lap=this.lap;
      if(p.drifting&&!onShoulder&&Math.abs(lateralSpeed)>10) {
        this._driftTime+=dt;this._driftGrace=1.4;this.combo=clamp(1+Math.floor(this._driftTime/1.6),1,5);
        this.driftScore+=dt*(Math.abs(lateralSpeed)*0.6+Math.abs(p.speed)*0.12)*this.combo;
      } else {this._driftGrace-=dt;if(this._driftGrace<=0){this._driftTime=0;this.combo=1;}}
    }

    _updateRivals(dt) {
      for(const rival of this.rivals) {
        if(rival.finished||this.time<rival.releaseAt)continue;
        rival.px=rival.x;rival.py=rival.y;
        const ahead=this._rivalPoint(rival,rival.raceDistance+40),far=this._rivalPoint(rival,rival.raceDistance+140);
        const curve=Math.abs(angleDiff(far.angle,ahead.angle));
        let targetSpeed=this._rivalPoint(rival,rival.raceDistance).target;
        const nitroReady = rival.nitro > (rival.boosting ? .02 : .35);
        rival.boosting=curve<.07&&rival.speed>250&&nitroReady&&targetSpeed>this._maxSpeed*.88
          &&this._rivalPoint(rival,rival.raceDistance+650).target>this._maxSpeed*.88;
        if(rival.boosting){targetSpeed*=1.28;rival.nitro=Math.max(0,rival.nitro-dt*0.29/this._nitroDuration);}
        else rival.nitro=Math.min(1,rival.nitro+dt*0.055);
        const drive=driveAt(this._acceleration,rival.speed)*(rival.boosting?1+0.48*this._nitroPower:1);
        const resistance=resistanceAt(rival.speed);
        const acceleration=clamp((targetSpeed-rival.speed)/dt,-this._brakeStrength-resistance,drive-resistance);
        rival.braking=acceleration<-resistance;
        rival.speed=clamp(rival.speed+acceleration*dt,0,this._maxSpeed*1.28);
        // No distance correction or rubber-banding: pace is fixed at the starting grid.
        rival.raceDistance+=rival.speed*dt;
        const maximum=this.track.length*this.totalLaps;
        if(rival.raceDistance>=maximum){rival.raceDistance=maximum;rival.finished=true;rival.finishTime=this.time;}
        const point=this._rivalPoint(rival,rival.raceDistance);
        rival.x=point.x;rival.y=point.y;rival.angle=point.angle;
        rival.vx=Math.cos(point.angle)*rival.speed;rival.vy=Math.sin(point.angle)*rival.speed;
        rival.steer=clamp(angleDiff(far.angle,point.angle),-1,1);
        rival.throttle=rival.finished?0:clamp((acceleration+resistance)/drive,0,1);
        rival.drifting=curve>0.7&&rival.speed>150;
        if(rival.finished){rival.speed=0;rival.vx=0;rival.vy=0;rival.boosting=false;rival.braking=true;}
        rival.progress=point.distance/this.track.length;rival.lap=clamp(1+Math.floor(Math.max(0,rival.raceDistance)/this.track.length),1,this.totalLaps);
      }
    }

    _placeTrafficWave(wave,distance) {
      // Use two lanes only. Change the open lane between waves, while keeping
      // at least 380 route units of clear road for a lane change between them.
      this._trafficFreeLane=(this._trafficFreeLane+1+Math.floor(this.random()*2))%3;
      const lanes=[0,1,2].filter(lane=>lane!==this._trafficFreeLane);
      if(this.random()<.5)lanes.reverse();
      this.traffic.filter(car=>car.wave===wave).forEach((car,index)=>{
        car.laneIndex=lanes[index];car.lane=(car.laneIndex-1)*this.track.width/3;
        car.routeDistance=distance+this.random()*60;
        const point=sampleTrack(this.track,car.routeDistance);
        car.x=car.px=point.x+point.normalX*car.lane;car.y=car.py=point.y+point.normalY*car.lane;car.angle=point.angle;
        car.active=car.routeDistance<this.track.length-120;
      });
    }

    _updateTraffic(dt) {
      if(!this.traffic.length)return;
      const reference=this._nearest.distance,racers=[this.player,...this.rivals];
      for(const car of this.traffic)car.routeDistance+=car.speed*dt;
      // Recycle a whole pair only once both cars are safely behind the player.
      // Place it beyond every other wave, rather than checking its lane alone.
      for(let wave=0;wave<6;wave++){
        const group=this.traffic.filter(car=>car.wave===wave);
        if(group.length&&group.every(car=>car.routeDistance<reference-650)){
          const farthest=Math.max(reference+1700,...this.traffic.filter(car=>car.wave!==wave).map(car=>car.routeDistance));
          this._placeTrafficWave(wave,farthest+380+this.random()*180);
        }
      }
      for(const car of this.traffic){
        car.active=car.routeDistance<this.track.length-120;
        if(!car.active)continue;
        const point=sampleTrack(this.track,car.routeDistance);
        car.px=car.x;car.py=car.y;car.x=point.x+point.normalX*car.lane;car.y=point.y+point.normalY*car.lane;car.angle=point.angle;
        car.vx=Math.cos(point.angle)*car.speed;car.vy=Math.sin(point.angle)*car.speed;
        for(const racer of racers){
          const hit=trafficSystem.overlap(racer,car);if(!hit)continue;
          racer.x+=hit.x*(hit.depth+.1);racer.y+=hit.y*(hit.depth+.1);
          const relative=(racer.vx-car.vx)*hit.x+(racer.vy-car.vy)*hit.y;
          if(relative<0){racer.vx-=hit.x*relative;racer.vy-=hit.y*relative;}
          racer.speed=Math.max(0,racer.vx*Math.cos(racer.angle)+racer.vy*Math.sin(racer.angle));
          if(racer===this.player){
            racer.collision=true;racer.boosting=false;
            if(this._collisionCooldown<=0&&relative<-10){racer.integrity=Math.max(.25,racer.integrity-Math.min(.12,Math.abs(relative)*.00035));this._emitParticles(5,racer.x,racer.y,'#ffd6a0',100);this._collisionCooldown=.3;}
            this._nearest=nearestPoint(this.track,racer.x,racer.y,this._nearest.index);racer.progress=this._nearest.distance/this.track.length;
          }else{racer.lane=clamp(racer.lane+(hit.x*point.normalX+hit.y*point.normalY)*(hit.depth+.1),-this.track.width*.39,this.track.width*.39);}
        }
      }
    }

    _updateCheckpoints() {
      const target=this.track.checkpoints[this._nextCheckpoint];
      if(!target)return;
      const radius=this.track.width*1.12;
      let routeDelta=Math.abs(this._nearest.distance-target.distance);
      if(this.track.closed)routeDelta=Math.min(routeDelta,this.track.length-routeDelta);
      const facing=Math.cos(angleDiff(this.player.angle,target.angle));
      const finalSprintGate=!this.track.closed&&this._nextCheckpoint===this.track.checkpoints.length-1;
      const atGate=distance(this.player,target)<radius&&routeDelta<radius&&facing>-0.2&&(!finalSprintGate||this._nearest.distance>=this.track.length-28);
      if(atGate) {
        this.checkpoint=this._nextCheckpoint;this.splits.push(this.time);
        if(finalSprintGate){this.lapTimes.push(this.time);this.bestLap=this.time;this._saveGhostLap(this.time);this._finish();return;}
        if(this.track.closed&&this._nextCheckpoint===0) {
          const lapTime=this.time-this._lapStart;this.lapTimes.push(lapTime);this.bestLap=Math.min(...this.lapTimes);this._saveGhostLap(lapTime);this._lapStart=this.time;
          if(this.lap>=this.totalLaps){this._finish();return;}
          if(this.mode==='time-attack')this._startGhostLap();
          this.lap++;this.player.lap=this.lap;
        }
        this._nextCheckpoint=this.track.closed?(this._nextCheckpoint+1)%this.track.checkpoints.length:this._nextCheckpoint+1;
      }
      let localDistance=this._nearest.distance;
      if(this.track.closed&&this._nextCheckpoint===1&&localDistance>this.track.length*0.85)localDistance-=this.track.length;
      this._raceDistance=(this.lap-1)*this.track.length+localDistance;
    }

    _updatePosition() {this.position=1+this.rivals.filter(rival=>rival.finished||rival.raceDistance>this._raceDistance).length;}

    _finish() {
      this._raceDistance=this.track.length*this.totalLaps;this._updatePosition();this.player.boosting=false;this.player.throttle=0;
      if(this.duelRole){
        if(this.playerFinish===null)this.playerFinish=this.time;
        this.player.vx=this.player.vy=this.player.speed=0;
        if(!this.rivals[0].finished)return;
      }
      this.state='finished';
      this.credits=this.track.family==='wangan'?1500:[1000,250,175,120][this.position-1]+Math.min(150,Math.floor(this.driftScore/100));
      this.result={time:this.time,bestLap:this.bestLap,position:this.position,driftScore:Math.floor(this.driftScore),credits:this.credits,medal:['gold','silver','bronze','finish'][this.position-1],lapTimes:[...this.lapTimes],raceType:this.track.raceType,carId:this.car.id,engineId:this.engineId};
      if(this.duelRole){
        const margin=this.rivals[0].finishTime-this.playerFinish+(this.duelRole==='chase'?duelDelay:-duelDelay);
        this.result.duel={role:this.duelRole,margin,won:margin>1/120};
        this.result.time=this.playerFinish;
      }
    }

    _emitParticles(count,x,y,color,spread) {
      for(let i=0;i<count&&this.particles.length<130;i++) {
        const angle=this.random()*TAU,velocity=spread*(0.2+this.random()*0.8),life=0.25+this.random()*0.45;
        this.particles.push({x,y,vx:Math.cos(angle)*velocity,vy:Math.sin(angle)*velocity,color,life,maxLife:life,size:1.5+this.random()*2.5});
      }
    }

    _updateParticles(dt) {
      this._particleClock+=dt;
      if(this._particleClock>0.038) {
        this._particleClock=0;const p=this.player;
        if(p.drifting)this._emitParticles(2,p.x-Math.cos(p.angle)*17,p.y-Math.sin(p.angle)*17,'#b8c0cf',35);
        if(p.boosting)this._emitParticles(2,p.x-Math.cos(p.angle)*27,p.y-Math.sin(p.angle)*27,'#69dfff',55);
      }
      for(const particle of this.particles){particle.life-=dt;particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.vx*=Math.exp(-dt*3);particle.vy*=Math.exp(-dt*3);}
      this.particles=this.particles.filter(particle=>particle.life>0);
    }

    getAutopilotInput() {
      if(this.state==='finished')return {};
      const nearest=nearestPoint(this.track,this.player.x,this.player.y,this._nearest.index),speed=Math.abs(this.player.speed);
      let desiredSpeed=this._speedTargetAt(nearest.distance);
      const lookahead=clamp(55+speed*0.2,58,this.track.width<=130?135:180);
      const target=sampleTrack(this.track,nearest.distance+lookahead);
      const desiredAngle=Math.atan2(target.y-this.player.y,target.x-this.player.x),error=angleDiff(desiredAngle,this.player.angle);
      const yaw=2*Math.max(speed,60)*Math.sin(error)/lookahead;
      const damping=(this.player.yawRate-yaw)*0.12;
      const steer=clamp((yaw-damping)/Math.max(0.3,this._yawRate(speed)),-1,1);
      if(Math.abs(error)>0.65)desiredSpeed=Math.min(desiredSpeed,130);
      const nearAngle=sampleTrack(this.track,nearest.distance+60).angle,farAngle=sampleTrack(this.track,nearest.distance+350).angle;
      const boost=Math.abs(angleDiff(farAngle,nearAngle))<0.07&&Math.abs(error)<0.06&&this.player.nitro>0.4&&speed>250&&desiredSpeed>this._maxSpeed*0.9&&this._speedTargetAt(nearest.distance+650)>this._maxSpeed*0.88;
      if(boost)desiredSpeed*=1.18;
      return {throttle:speed<desiredSpeed+3?1:0,brake:speed>desiredSpeed+8?clamp((speed-desiredSpeed)/45,0,1):0,left:Math.max(0,-steer),right:Math.max(0,steer),drift:0,boost:boost?1:0};
    }

    getHUD() {
      return {state:this.state,countdown:this.countdown,time:this.time,lap:this.lap,totalLaps:this.totalLaps,speed:Math.round(Math.abs(this.player.speed)*0.44),nitro:this.player.nitro,integrity:this.player.integrity,position:this.position,totalRacers:this.rivals.length+1,driftScore:Math.floor(this.driftScore),combo:this.combo,bestLap:this.bestLap,progress:this.state==='finished'?1:clamp(this._raceDistance/(this.track.length*this.totalLaps),0,1),result:this.result,checkpoint:this.checkpoint,raceType:this.track.raceType,stageLabel:this.track.closed?`${this.lap} / ${this.totalLaps}`:'СПРИНТ',split:this.splits.length?this.splits[this.splits.length-1]:null};
    }
  }

  const api={tracks,cars,engines,upgrades,Engine,createTrack,clamp,angleDiff,computeBuild,getSwapPrice,getUpgradePrice,performanceReferences};
  root.NDCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
