/** Keyboard, two touch zones and an optional relative trackpad share one input. */
export function readDrivingInput(keys,pointers){
  let left=keys.has('ArrowLeft')||keys.has('KeyA'),right=keys.has('ArrowRight')||keys.has('KeyD'),analog=0,brake=false;
  for(const value of pointers.values()){
    if(typeof value==='object'&&value){analog+=Number.isFinite(value.steer)?value.steer:0;brake||=Boolean(value.brake);}
    else{if(value===-1)left=true;if(value===1)right=true;}
  }
  return {steer:left||right?Number(right)-Number(left):Math.max(-1,Math.min(1,analog)),brake:brake||left&&right};
}
export function touchDirection(x,y,bounds){
  if(x<bounds.left||x>=bounds.right||y<bounds.top||y>=bounds.bottom)return 0;
  return x<(bounds.left+bounds.right)/2?-1:1;
}
/** A short dead zone filters finger jitter; the centre remains more precise. */
export function analogSteer(displacement,distance,deadZone=3){
  const amount=Math.max(0,Math.abs(displacement)-deadZone)/Math.max(1,distance-deadZone);
  return amount===0?0:Math.sign(displacement)*Math.min(1,amount)**1.25;
}
export function bindTouchSteering(container,pointers,isRunning,getOptions=()=>({touchMode:'buttons',sensitivity:1})){
  const active=new Map(),left=container.querySelector('#steer-left'),right=container.querySelector('#steer-right'),feedback=container.querySelector('#trackpad-feedback');
  let primary=null;
  const paint=()=>{
    left.classList.toggle('pressed',[...pointers.values()].includes(-1));right.classList.toggle('pressed',[...pointers.values()].includes(1));
    if(!feedback)return;
    const p=active.get(primary),input=pointers.get(primary),show=getOptions().touchMode==='trackpad'&&p&&input;
    feedback.hidden=!show;
    if(show){const rect=container.getBoundingClientRect();feedback.style.left=`${p.originX-rect.left}px`;feedback.style.top=`${p.originY-rect.top}px`;feedback.style.setProperty('--turn',`${input.steer*38}px`);feedback.querySelector('span').textContent=input.brake?'FRENO':`${Math.round(Math.abs(input.steer)*100)} %`;}
  };
  const update=()=>{
    pointers.clear();
    if(!isRunning()){paint();return;}
    const bounds=container.getBoundingClientRect(),options=getOptions();
    if(options.touchMode!=='trackpad'){
      for(const [id,p]of active){const direction=touchDirection(p.x,p.y,bounds);if(direction)pointers.set(id,direction);}
    }else{
      const inside=[...active].filter(([,p])=>touchDirection(p.x,p.y,bounds)!==0);
      if(!inside.some(([id])=>id===primary)){primary=inside[0]?.[0]??null;const p=active.get(primary);if(p){p.originX=p.x;p.originY=p.y;}}
      const p=active.get(primary);
      if(p&&inside.length){const distance=Math.max(64,Math.min(160,(bounds.right-bounds.left)*.28))/(options.sensitivity||1);pointers.set(primary,{steer:analogSteer(p.x-p.originX,distance),brake:inside.length>1});}
    }
    paint();
  };
  const move=e=>{const p=active.get(e.pointerId);if(!p)return;e.preventDefault();p.x=e.clientX;p.y=e.clientY;update();};
  const down=e=>{
    if(!isRunning()||(e.pointerType==='mouse'&&e.button!==0))return;
    e.preventDefault();active.set(e.pointerId,{x:e.clientX,y:e.clientY,originX:e.clientX,originY:e.clientY});
    if(primary==null)primary=e.pointerId;container.setPointerCapture(e.pointerId);update();
  };
  const release=e=>{active.delete(e.pointerId);if(primary===e.pointerId)primary=null;update();};
  const handlers={pointerdown:down,pointermove:move,pointerup:release,pointercancel:release,lostpointercapture:release,contextmenu:e=>e.preventDefault()};
  for(const [event,handler]of Object.entries(handlers))container.addEventListener(event,handler);
  const clear=()=>{const ids=[...active.keys()];active.clear();primary=null;pointers.clear();paint();for(const id of ids)if(container.hasPointerCapture(id))container.releasePointerCapture(id);};
  return {clear,dispose(){clear();for(const [event,handler]of Object.entries(handlers))container.removeEventListener(event,handler);}};
}
