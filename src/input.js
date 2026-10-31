/** Keyboard and multitouch share the same two controls, including mixed input. */
export function readDrivingInput(keys, pointers) {
  let left=keys.has('ArrowLeft')||keys.has('KeyA'),right=keys.has('ArrowRight')||keys.has('KeyD');
  for(const direction of pointers.values()){
    if(direction===-1)left=true;
    if(direction===1)right=true;
  }
  return {steer:Number(right)-Number(left),brake:left&&right};
}

/** Screen-space controls remain under the fingers when the device rotates. */
export function touchDirection(x,y,bounds){
  if(x<bounds.left||x>=bounds.right||y<bounds.top||y>=bounds.bottom)return 0;
  return x<(bounds.left+bounds.right)/2?-1:1;
}

export function bindTouchSteering(container,pointers,isRunning){
  const active=new Set(),left=container.querySelector('#steer-left'),right=container.querySelector('#steer-right');
  const paint=()=>{left.classList.toggle('pressed',[...pointers.values()].includes(-1));right.classList.toggle('pressed',[...pointers.values()].includes(1));};
  const move=e=>{
    if(!active.has(e.pointerId))return;
    e.preventDefault();const direction=isRunning()?touchDirection(e.clientX,e.clientY,container.getBoundingClientRect()):0;
    if(direction)pointers.set(e.pointerId,direction);else pointers.delete(e.pointerId);paint();
  };
  const down=e=>{
    if(!isRunning()||(e.pointerType==='mouse'&&e.button!==0))return;
    e.preventDefault();active.add(e.pointerId);container.setPointerCapture(e.pointerId);move(e);
  };
  const release=e=>{active.delete(e.pointerId);pointers.delete(e.pointerId);paint();};
  const context=e=>e.preventDefault();
  const handlers={pointerdown:down,pointermove:move,pointerup:release,pointercancel:release,lostpointercapture:release,contextmenu:context};
  for(const [event,handler]of Object.entries(handlers))container.addEventListener(event,handler);
  const clear=()=>{
    const ids=[...active];active.clear();pointers.clear();paint();
    for(const id of ids)if(container.hasPointerCapture(id))container.releasePointerCapture(id);
  };
  return {clear,dispose(){clear();for(const [event,handler]of Object.entries(handlers))container.removeEventListener(event,handler);}};
}
