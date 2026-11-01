/** Keyboard, two touch zones and a full-width absolute trackpad share one input. */
export function readDrivingInput(keys,pointers){
  let left=keys.has('ArrowLeft')||keys.has('KeyA'),right=keys.has('ArrowRight')||keys.has('KeyD'),analog=0,brake=keys.has('ArrowDown')||keys.has('KeyS');
  for(const value of pointers.values()){
    if(typeof value==='object'&&value){analog+=Number.isFinite(value.steer)?value.steer:0;brake||=Boolean(value.brake);}
    else{if(value===-1)left=true;if(value===1)right=true;}
  }
  return {steer:left||right?Number(right)-Number(left):Math.max(-1,Math.min(1,analog)),brake:brake||left&&right};
}

/** Mouse-only driving uses a held primary button for absolute steering and
 * the secondary button for braking. HUD clicks never reach this container. */
export function bindMouseDriving(container,pointers,isRunning){
  let active=null,position=0,buttons=0;
  const update=()=>{
    if(!isRunning()||!buttons){pointers.delete('mouse');return;}
    const bounds=container.getBoundingClientRect();
    pointers.set('mouse',{steer:buttons&1?trackpadSteer(position,bounds):0,brake:Boolean(buttons&2)});
  };
  const down=event=>{
    if(event.pointerType!=='mouse'||!isRunning())return;
    event.preventDefault();active=event.pointerId;buttons=event.buttons;position=event.clientX;
    container.setPointerCapture(active);update();
  };
  const move=event=>{if(event.pointerType!=='mouse'||event.pointerId!==active)return;buttons=event.buttons;position=event.clientX;update();};
  const release=event=>{if(event.pointerId!==active)return;buttons=event.type==='pointerup'?event.buttons:0;update();if(!buttons)active=null;};
  const clear=()=>{const id=active;active=null;buttons=0;pointers.delete('mouse');if(id!==null&&container.hasPointerCapture(id))container.releasePointerCapture(id);};
  const handlers={pointerdown:down,pointermove:move,pointerup:release,pointercancel:release,lostpointercapture:release,contextmenu:event=>{if(isRunning())event.preventDefault();}};
  for(const [name,handler]of Object.entries(handlers))container.addEventListener(name,handler);
  return {clear,dispose(){clear();for(const [name,handler]of Object.entries(handlers))container.removeEventListener(name,handler);}};
}
export function touchDirection(x,y,bounds){
  if(x<bounds.left||x>=bounds.right||y<bounds.top||y>=bounds.bottom)return 0;
  return x<(bounds.left+bounds.right)/2?-1:1;
}
/** The screen centre is neutral. Sensitivity changes the response curve while
 * preserving the whole width and maximum steering at both edges. */
export function trackpadSteer(x,bounds,sensitivity=1){
  const distance=(bounds.right-bounds.left)/2;if(distance<=0)return 0;
  const displacement=x-(bounds.left+bounds.right)/2,deadZone=Math.min(3,distance*.05);
  const amount=Math.max(0,Math.abs(displacement)-deadZone)/(distance-deadZone);
  const response=Number.isFinite(sensitivity)&&sensitivity>0?sensitivity:1;
  return amount===0?0:Math.sign(displacement)*Math.min(1,amount)**(1/response);
}
export function bindTouchSteering(container,pointers,isRunning,getOptions=()=>({touchMode:'buttons',sensitivity:1})){
  const active=new Map(),left=container.querySelector('#steer-left'),right=container.querySelector('#steer-right'),feedback=container.querySelector('#trackpad-feedback');
  let primary=null;
  const paint=()=>{
    left.classList.toggle('pressed',[...pointers.values()].includes(-1));right.classList.toggle('pressed',[...pointers.values()].includes(1));
    if(!feedback)return;
    const p=active.get(primary),input=pointers.get(primary),show=getOptions().touchMode==='trackpad'&&p&&input;
    feedback.hidden=!show;
    if(show){const rect=container.getBoundingClientRect();feedback.style.top=`${p.y-rect.top}px`;feedback.style.setProperty('--target',`${(p.x-rect.left)/(rect.right-rect.left)*100}%`);feedback.querySelector('span').textContent=input.brake?'FRENO':`${input.steer<0?'← ':''}${Math.round(Math.abs(input.steer)*100)} %${input.steer>0?' →':''}`;}
  };
  const update=()=>{
    pointers.clear();
    if(!isRunning()){paint();return;}
    const bounds=container.getBoundingClientRect(),options=getOptions();
    if(options.touchMode!=='trackpad'){
      for(const [id,p]of active){const direction=touchDirection(p.x,p.y,bounds);if(direction)pointers.set(id,direction);}
    }else{
      const inside=[...active].filter(([,p])=>p.x>=bounds.left&&p.x<=bounds.right&&p.y>=bounds.top&&p.y<bounds.bottom);
      if(!inside.some(([id])=>id===primary))primary=inside[0]?.[0]??null;
      const p=active.get(primary);
      if(p&&inside.length)pointers.set(primary,{steer:trackpadSteer(p.x,bounds,options.sensitivity),brake:inside.length>1});
    }
    paint();
  };
  const move=e=>{const p=active.get(e.pointerId);if(!p)return;e.preventDefault();p.x=e.clientX;p.y=e.clientY;update();};
  const down=e=>{
    if(!isRunning()||(e.pointerType==='mouse'&&e.button!==0))return;
    e.preventDefault();active.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(primary==null)primary=e.pointerId;container.setPointerCapture(e.pointerId);update();
  };
  const release=e=>{active.delete(e.pointerId);if(primary===e.pointerId)primary=null;update();};
  const handlers={pointerdown:down,pointermove:move,pointerup:release,pointercancel:release,lostpointercapture:release,contextmenu:e=>e.preventDefault()};
  for(const [event,handler]of Object.entries(handlers))container.addEventListener(event,handler);
  const clear=()=>{const ids=[...active.keys()];active.clear();primary=null;pointers.clear();paint();for(const id of ids)if(container.hasPointerCapture(id))container.releasePointerCapture(id);};
  return {clear,dispose(){clear();for(const [event,handler]of Object.entries(handlers))container.removeEventListener(event,handler);}};
}
