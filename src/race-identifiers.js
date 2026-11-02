import * as THREE from 'three';

export function createPlayerMarker(){
  // A short, thin rear arc on the road. Opaque car geometry occludes it.
  const marker=new THREE.Mesh(new THREE.RingGeometry(1.70,1.74,48,1,Math.PI*.12,Math.PI*.76),
    new THREE.MeshBasicMaterial({color:'#ff78b5',depthTest:true,depthWrite:false,transparent:true,opacity:.28,toneMapped:false}));
  marker.name='player-ground-marker';marker.rotation.x=-Math.PI/2;marker.renderOrder=1;marker.visible=false;return marker;
}

export function rivalLabelPlacement(pose,vehicle,camera,width,height){
  const head=(vehicle.design?.cabin[4]??1.45)+.4;
  const point=new THREE.Vector3(pose.x,pose.y+head,pose.z),distance=point.distanceTo(camera.getWorldPosition(new THREE.Vector3()));
  if(distance>180)return null;
  point.project(camera);
  if(point.z< -1||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1)return null;
  const x=(point.x+1)*width/2,y=(1-point.y)*height/2;
  if(x<14||x>width-14||y<75||y>height-44)return null;
  return {x,y,distance};
}

/** Lightweight screen-space names, with no extra WebGL context or text textures. */
export class RivalNameTags{
  constructor(container){
    this.layer=document.createElement('div');this.layer.className='rival-name-layer';this.layer.setAttribute('aria-hidden','true');container.append(this.layer);this.labels=[];
  }
  setSession(session){
    this.session=session;this.layer.replaceChildren();this.labels=[];
    for(const racer of session?.rivals||[]){
      const element=document.createElement('span');element.className='rival-name-tag';element.textContent=racer.name;element.hidden=true;this.layer.append(element);this.labels.push({racer,element});
    }
  }
  update(camera,width,height,alpha){
    const candidates=[];
    for(const label of this.labels){
      const pose=label.racer.drive.interpolated(alpha),p=rivalLabelPlacement(pose,label.racer.drive.vehicle,camera,width,height);
      label.element.hidden=true;if(p)candidates.push({...label,...p});
    }
    candidates.sort((a,b)=>a.distance-b.distance);const occupied=[];
    for(const label of candidates){
      if(occupied.length>=8)break;
      const half=Math.min(42,label.racer.name.length*3.1+6),rect={left:label.x-half,right:label.x+half,top:label.y-18,bottom:label.y+2};
      if(rect.left<4||rect.right>width-4)continue;
      if(occupied.some(r=>rect.left<r.right+3&&rect.right>r.left-3&&rect.top<r.bottom+3&&rect.bottom>r.top-3))continue;
      occupied.push(rect);label.element.hidden=false;
      label.element.style.transform=`translate3d(${label.x.toFixed(1)}px,${label.y.toFixed(1)}px,0) translate(-50%,-100%)`;
      label.element.style.opacity=String(Math.min(.85,Math.max(.25,1-label.distance/220)));
    }
  }
}
