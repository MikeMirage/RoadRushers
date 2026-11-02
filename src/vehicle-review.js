import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ORIGINAL_VEHICLES } from './config.js';
import { buildVehicle } from './vehicles.js';
import { NEW_VEHICLES, VEHICLE_BATCHES } from './vehicle-catalog.js';
import { buildCollectionVehicle, disposeVehicle } from './vehicle-modeler.js';

// Review the actual game meshes, with two angles per model and an exportable contact sheet.
const style=document.createElement('style');style.textContent=`*{box-sizing:border-box}body{margin:0;background:#e4e7db;color:#263e34;font-family:system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:27px}header{display:flex;align-items:end;justify-content:space-between;gap:20px}h1{font-size:32px;letter-spacing:-1px;margin:7px 0}p{font-size:12px;color:#5b7062;margin:6px 0 20px}.eyebrow{font-size:10px;letter-spacing:2px}nav{display:flex;gap:7px;flex-wrap:wrap;margin:18px 0}button,a{font:inherit;color:inherit}button{background:transparent;border:1px solid #abb9a9;padding:9px 12px;border-radius:4px;font-size:11px;cursor:pointer}button[aria-pressed=true]{background:#284437;color:#edf0d8}#sheet{display:block;width:100%;height:auto;border-radius:6px}a{font-size:11px}#download-sheet{padding:11px 15px;background:#284437;color:#edf0d8;text-decoration:none;border-radius:4px;white-space:nowrap}.review-tools{display:flex;align-items:center;gap:14px;margin-bottom:18px;font-size:11px}.review-tools label{display:flex;align-items:center;gap:5px}#status{font-size:11px}@media(max-width:600px){main{padding:16px}header{display:block}h1{font-size:26px}#download-sheet{display:inline-block;margin:8px 0}}`;
document.head.append(style);
document.querySelector('#vehicle-review').innerHTML=`<main><header><div><span class="eyebrow">ROADRUSHERS / MOTOR ARCHIVE</span><h1>Tres coches. Tres caracteres.</h1><p>Serie base revisada · Modelos reales del juego · Frente y trasera · Arcilla y malla</p></div><a id="download-sheet" download>Descargar lámina PNG ↓</a></header><nav aria-label="Tandas"><button data-batch="originals" aria-pressed="true">00 · Los tres iniciales</button>${VEHICLE_BATCHES.map((b,i)=>`<button data-batch="${b.id}" aria-pressed="false">0${i+1} · ${b.name}</button>`).join('')}</nav><div class="review-tools"><label><input id="wireframe" type="checkbox">Malla</label><label><input id="clay" type="checkbox">Arcilla</label><span id="status"></span><a href="${import.meta.env.BASE_URL}">Abrir el juego ↗</a></div><img id="sheet" alt="Lámina con diez miniaturas, dos ángulos por modelo"></main>`;

const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(520,340);renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color('#e4e7db');
const studio=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.05);scene.environment=environment.texture;scene.environmentIntensity=.65;studio.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fff7e5','#869780',1.2));const key=new THREE.DirectionalLight('#fff3de',2);key.position.set(-3,7,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:20});key.shadow.bias=-.0004;key.shadow.normalBias=.015;scene.add(key);const fill=new THREE.DirectionalLight('#d6eaf2',1.2);fill.position.set(6,4,-5);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:'#e4e7db',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;floor.receiveShadow=true;scene.add(floor);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const camera=new THREE.PerspectiveCamera(32,520/340,.05,100),clay=new THREE.MeshStandardMaterial({color:'#abb4ad',roughness:.8});
let current='originals';const selectedModel=new URLSearchParams(location.search).get('model');
function drawSheet(){
  const canvas=document.createElement('canvas');const originals=current==='originals';canvas.width=originals?1560:2080;canvas.height=originals?(selectedModel?720:2690):2180;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#e4e7db';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#263e34';ctx.font='600 18px system-ui';ctx.fillText('ROADRUSHERS / MOTOR ARCHIVE',40,42);
  const batch=originals?{name:'Los tres iniciales',subtitle:'Pick-up clásica / Sedán de rally / Roadster V8'}:VEHICLE_BATCHES.find(b=>b.id===current),number=originals?0:VEHICLE_BATCHES.indexOf(batch)+1;
  ctx.font='600 38px system-ui';ctx.fillText(`0${number} — ${batch.name}`,40,100);ctx.font='20px system-ui';ctx.fillStyle='#647566';ctx.fillText(batch.subtitle,40,137);
  const wire=document.querySelector('#wireframe').checked,gray=document.querySelector('#clay').checked;
  const vehicles=originals?(selectedModel?ORIGINAL_VEHICLES.filter(v=>v.id===selectedModel):ORIGINAL_VEHICLES):NEW_VEHICLES.filter(v=>v.batch===current);
  renderer.setSize(originals?780:520,originals?440:340);camera.aspect=originals?780/440:520/340;camera.updateProjectionMatrix();
  for(const [i,v]of vehicles.entries()){
    const model=originals?buildVehicle(v):buildCollectionVehicle(v);scene.add(model.group);
    const restore=[];model.group.traverse(o=>{if(o.isMesh){restore.push([o,o.material]);if(gray)o.material=clay;o.material.wireframe=wire;}});
    const x=originals?0:i%2*1040,y=170+(originals?i*492:Math.floor(i/2)*394);
    for(const [j,angle]of [Math.PI*.22,Math.PI*1.18].entries()){
      camera.position.set(Math.sin(angle)*(originals?5.5:5.8),originals?2.20:3.35,Math.cos(angle)*(originals?5.5:5.8));camera.lookAt(0,originals?.56:v.design.cabin[4]*.43,0);renderer.render(scene,camera);
      ctx.drawImage(renderer.domElement,x+j*(originals?780:520),y,originals?780:520,originals?440:340);
    }
    restore.forEach(([o,m])=>{o.material=m;});disposeVehicle(model);
    ctx.fillStyle='#263e34';ctx.font='600 22px system-ui';ctx.fillText(`${String(v.number??i+1).padStart(2,'0')} / ${v.name}`,x+24,y+(originals?440:340));
    ctx.fillStyle='#647566';ctx.font='16px system-ui';ctx.fillText(originals?v.category+' · '+v.character.strength:v.inspiration,x+24,y+(originals?467:367));
  }
  ctx.font='16px system-ui';ctx.fillStyle='#647566';ctx.fillText(originals?'Carrocería suspendida · Ruedas independientes · Ópticas · Habitáculo · Sin insignias':'Pintura · Wrapping UV · Neumáticos · Llantas · Lunas · Anclajes de trails',40,canvas.height-20);
  const data=canvas.toDataURL('image/png');document.querySelector('#sheet').src=data;
  const download=document.querySelector('#download-sheet');download.href=data;download.download=`roadrushers-tanda-0${number}${wire?'-wire':gray?'-clay':''}.png`;
  document.querySelector('#status').textContent=`${originals?'Serie base':`Tanda 0${number}`} · ${vehicles.length} modelos · ${vehicles.length*2} vistas`;
  document.querySelector('#sheet').alt=`${vehicles.length} coches del juego, vista delantera y trasera${gray?', acabado en arcilla':''}`;
}
document.querySelector('nav').addEventListener('click',e=>{const b=e.target.closest('[data-batch]');if(!b)return;current=b.dataset.batch;for(const n of document.querySelectorAll('[data-batch]'))n.setAttribute('aria-pressed',String(n===b));drawSheet();});
for(const id of ['wireframe','clay'])document.querySelector(`#${id}`).addEventListener('change',drawSheet);
drawSheet();
