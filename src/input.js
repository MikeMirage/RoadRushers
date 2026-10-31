/** Keyboard and multitouch share the same two controls, including mixed input. */
export function readDrivingInput(keys, pointers) {
  let left=keys.has('ArrowLeft')||keys.has('KeyA'),right=keys.has('ArrowRight')||keys.has('KeyD');
  for(const direction of pointers.values()){
    if(direction===-1)left=true;
    if(direction===1)right=true;
  }
  return {steer:Number(right)-Number(left),brake:left&&right};
}
