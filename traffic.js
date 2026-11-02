/*! NEON DRIFT | Made by bal1st1k */
/* NEON DRIFT — civil highway traffic, separate from collectible cars. */
(function(root){
  'use strict';
  const vehicles=Array.from({length:10},(_,index)=>({id:'traffic-'+(index+1),sprite:'for promt/wangan midnight/спрайты для потока/traffic-'+String(index+1).padStart(2,'0')+'.jpg',raceSprite:'assets/traffic/'+(index+1)+'.png',spriteAngle:-Math.PI/2,halfLength:index<4?31:23,halfWidth:index<4?13:11,color:'#c6d4ce'}));
  // Oriented rectangle SAT: return the shortest separating displacement for A.
  function overlap(a,b){
    const dx=a.x-b.x,dy=a.y-b.y;
    if(Math.abs(dx)>110||Math.abs(dy)>110)return null;
    const axes=[[Math.cos(a.angle),Math.sin(a.angle)],[-Math.sin(a.angle),Math.cos(a.angle)],[Math.cos(b.angle),Math.sin(b.angle)],[-Math.sin(b.angle),Math.cos(b.angle)]];
    let depth=Infinity,normal=null;
    for(const [x,y] of axes){
      const extent=o=>(o.halfLength||23)*Math.abs(x*Math.cos(o.angle)+y*Math.sin(o.angle))+(o.halfWidth||12)*Math.abs(-x*Math.sin(o.angle)+y*Math.cos(o.angle));
      const projected=dx*x+dy*y,amount=extent(a)+extent(b)-Math.abs(projected);
      if(amount<=0)return null;
      if(amount<depth){depth=amount;const sign=projected>=0?1:-1;normal={x:x*sign,y:y*sign};}
    }
    return {...normal,depth};
  }
  const api={vehicles,overlap};root.NDTraffic=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
