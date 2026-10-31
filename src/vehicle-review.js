import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { NEW_VEHICLES, VEHICLE_BATCHES } from './vehicle-catalog.js';
import { buildCollectionVehicle, disposeVehicle } from './vehicle-modeler.js';

// Review the actual game meshes, with two angles per model and an exportable contact sheet.
const style=document.createElement('style');style.textContent=`*{box-sizing:border-box}body{margin:0;background:#e4e7db;color:#263e34;font-family:system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:27px}header{display:flex;align-items:end;justify-content:space-between;gap:20px}h1{font-size:32px;letter-spacing:-1px;margin:7px 0}p{font-size:12px;color:#5b7062;margin:6px 0 20px}.eyebrow{font-size:10px;letter-spacing:2px}nav{display:flex;gap:7px;flex-wrap:wrap;margin:18px 0}button,a{font:inherit;color:inherit}button{background:transparent;border:1px solid #abb9a9;padding:9px 12px;border-radius:4px;font-size:11px;cursor:pointer}button[aria-pressed=true]{background:#284437;color:#edf0d8}#sheet{display:block;width:100%;height:auto;border-radius:6px}a{font-size:11px}#download-sheet{padding:11px 15px;background:#284437;color:#edf0d8;text-decoration:none;border-radius:4px;white-space:nowrap}.review-tools{display:flex;align-items:center;gap:14px;margin-bottom:18px;font-size:11px}.review-tools label{display:flex;align-items:center;gap:5px}#status{font-size:11px}@media(max-width:600px){main{padding:16px}header{display:block}h1{font-size:26px}#download-sheet{display:inline-block;margin:8px 0}}`;
document.head.append(style);
document.querySelector('#vehicle-review').innerHTML=`<main><header><div><span class="eyebrow">ROADRUSHERS / MOTOR ARCHIVE</span><h1>50 siluetas. Cinco tandas.</h1><p>Geometría del juego · Frente y trasera de cada miniatura · Sin insignias de fabricante</p></div><a id="download-sheet" download>Descargar lámina PNG ↓</a></header><nav aria-label="Tandas">${VEHICLE_BATCHES.map((b,i)=>`<button data-batch="${b.id}" aria-pressed="${i===0}">0${i+1} · ${b.name}</button>`).join('')}</nav><div class="review-tools"><label><input id="wireframe" type="checkbox">Malla</label><label><input id="clay" type="checkbox">Arcilla</label><span id="status"></span><a href="${import.meta.env.BASE_URL}">Abrir el juego ↗</a></div><img id="sheet" alt="Lámina con diez miniaturas, dos ángulos por modelo"></main>`;

const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(520,340);renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color('#e4e7db');
const studio=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.05);scene.environment=environment.texture;scene.environmentIntensity=.5;studio.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fff7e5','#869780',2));const key=new THREE.DirectionalLight('#fff3de',2.5);key.position.set(-3,7,5);scene.add(key);const fill=new THREE.DirectionalLight('#d6eaf2',1.2);fill.position.set(6,4,-5);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:'#e4e7db',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);
const camera=new THREE.PerspectiveCamera(32,520/340,.05,100),clay=new THREE.MeshStandardMaterial({color:'#abb4ad',roughness:.8});
let current='heritage';
function drawSheet(){
  const canvas=document.createElement('canvas');canvas.width=2080;canvas.height=2180;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#e4e7db';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#263e34';ctx.font='600 18px system-ui';ctx.fillText('ROADRUSHERS / MOTOR ARCHIVE',40,42);
  const batch=VEHICLE_BATCHES.find(b=>b.id===current),number=VEHICLE_BATCHES.indexOf(batch)+1;
  ctx.font='600 38px system-ui';ctx.fillText(`0${number} — ${batch.name}`,40,100);ctx.font='20px system-ui';ctx.fillStyle='#647566';ctx.fillText(batch.subtitle,40,137);
  const wire=document.querySelector('#wireframe').checked,gray=document.querySelector('#clay').checked;
  for(const [i,v]of NEW_VEHICLES.filter(v=>v.batch===current).entries()){
    const model=buildCollectionVehicle(v);scene.add(model.group);
    const restore=[];model.group.traverse(o=>{if(o.isMesh){restore.push([o,o.material]);if(gray)o.material=clay;o.material.wireframe=wire;}});
    const x=i%2*1040,y=170+Math.floor(i/2)*394;
    for(const [j,angle]of [Math.PI*.22,Math.PI*1.18].entries()){
      camera.position.set(Math.sin(angle)*5.8,3.35,Math.cos(angle)*5.8);camera.lookAt(0,v.design.cabin[4]*.43,0);renderer.render(scene,camera);
      ctx.drawImage(renderer.domElement,x+j*520,y,520,340);
    }
    restore.forEach(([o,m])=>{o.material=m;});disposeVehicle(model);
    ctx.fillStyle='#263e34';ctx.font='600 22px system-ui';ctx.fillText(`${String(v.number).padStart(2,'0')} / ${v.name}`,x+24,y+340);
    ctx.fillStyle='#647566';ctx.font='16px system-ui';ctx.fillText(v.inspiration,x+24,y+367);
  }
  ctx.font='16px system-ui';ctx.fillStyle='#647566';ctx.fillText('Pintura · Wrapping UV · Neumáticos · Llantas · Lunas · Anclajes de trails',40,2160);
  const data=canvas.toDataURL('image/png');document.querySelector('#sheet').src=data;
  const download=document.querySelector('#download-sheet');download.href=data;download.download=`roadrushers-tanda-0${number}${wire?'-wire':gray?'-clay':''}.png`;
  document.querySelector('#status').textContent=`Tanda 0${number} · 10 modelos · 20 vistas`;
}
document.querySelector('nav').addEventListener('click',e=>{const b=e.target.closest('[data-batch]');if(!b)return;current=b.dataset.batch;for(const n of document.querySelectorAll('[data-batch]'))n.setAttribute('aria-pressed',String(n===b));drawSheet();});
for(const id of ['wireframe','clay'])document.querySelector(`#${id}`).addEventListener('change',drawSheet);
drawSheet();
