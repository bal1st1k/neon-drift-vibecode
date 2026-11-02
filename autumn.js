/*! NEON DRIFT | Made by bal1st1k */
/* Lightweight seasonal decoration; CSS animates a fixed pool, never the race renderer. */
(function(root){
  'use strict';
  const shapes=[
    'M16 3l3 8 5-4-1 8 6 1-9 8-3-1-1 7-1-7-3 1-9-8 6-1-1-8 5 4z',
    'M16 28C3 21 4 8 26 3c2 18-2 24-10 25z',
    'M16 28C10 21 2 18 3 10L11 3l5 4 5-4 8 7c1 8-7 11-13 18z'
  ];
  class Leaves{
    constructor(element,menuHost,modalHost){
      this.element=element;this.menuHost=menuHost;this.modalHost=modalHost;
      this.motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
      let seed=29102026;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
      const colors=['#e5ba54','#d69442','#b86639','#b34c35'];
      element.innerHTML=Array.from({length:26},(_,i)=>{
        const duration=23+random()*17,delay=-random()*duration,x=i===0?89:i===1?6:random()*100,size=i<2?31:14+random()*16;
        return `<span class="autumn-leaf" style="left:${x.toFixed(2)}%;--leaf-size:${size.toFixed(1)}px;--leaf-duration:${duration.toFixed(2)}s;--leaf-delay:${delay.toFixed(2)}s;--leaf-wind:${(-65+random()*130).toFixed(1)}px;--leaf-spin:${(-120+random()*240).toFixed(1)}deg;--leaf-opacity:${(.38+random()*.42).toFixed(2)};--leaf-color:${colors[i%colors.length]}"><svg viewBox="0 0 32 34" fill="currentColor" aria-hidden="true"><path d="${shapes[i%shapes.length]}"/><path d="M16 30V13m0 7-5-5m5 2 5-6" fill="none" stroke="#5d4026" stroke-width=".85" opacity=".5"/></svg></span>`;
      }).join('');
    }
    setContext({racing=false,modal=null,reducedMotion=false,hidden=false}={}){
      const host=modal?this.modalHost:this.menuHost;
      if(this.element.parentElement!==host)host.appendChild(this.element);
      this.element.dataset.mode=modal?'modal':'menu';
      this.element.hidden=!!(hidden||reducedMotion||this.motion?.matches||(racing&&modal!=='pause'));
      this.element.dataset.active=String(!this.element.hidden);
    }
  }
  root.NDAutumn={Leaves};
})(globalThis);
