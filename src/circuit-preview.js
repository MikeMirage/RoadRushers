import { Circuit } from './circuit.js';
export function circuitPreview(track,{adaptive=false}={}){
  const circuit=new Circuit(track),points=circuit.samples.filter((_,i)=>i%4===0);
  const xs=points.map(p=>p.x),zs=points.map(p=>p.z),minX=Math.min(...xs),minZ=Math.min(...zs);
  const width=Math.max(...xs)-minX,height=Math.max(...zs)-minZ,viewHeight=adaptive?Math.max(85,Math.min(360,180*height/Math.max(1,width))):120;
  const scale=Math.min(154/Math.max(1,width),(viewHeight-26)/Math.max(1,height));
  const project=p=>`${((p.x-minX)*scale+(180-width*scale)/2).toFixed(2)},${((p.z-minZ)*scale+(viewHeight-height*scale)/2).toFixed(2)}`;
  const start=project(points[0]).split(',');
  return {length:(circuit.length/1000).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}),svg:`<svg viewBox="0 0 180 ${viewHeight}" fill="none" aria-hidden="true"><polyline points="${points.map(project).join(' ')} ${circuit.closed?project(points[0]):project(circuit.samples.at(-1))}" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><circle class="circuit-start" cx="${start[0]}" cy="${start[1]}" r="4" fill="currentColor"/></svg>`};
}
