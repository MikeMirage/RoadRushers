import './asset-library.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { environmentAssetCatalog, loadEnvironmentModel, applyEnvironmentPbr, instanceEnvironmentModel, disposeAssetGroup, assetUrl } from './environment-assets.js';
import { waterMaterial, updateBiomeMaterials } from './biome-shaders.js';
import { themePreset } from './environment-config.js';

const $ = id => document.getElementById(id), container = $('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;container.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#a6b5a5');scene.fog=new THREE.Fog('#a6b5a5',25,90);
const camera=new THREE.PerspectiveCamera(38,1,.02,200);camera.position.set(5,3.4,6);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=.25;
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.5;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight('#e5eeec','#6b7455',2));
const sun=new THREE.DirectionalLight('#ffebcb',4.2);sun.position.set(-4,9,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.5,far:40});sun.shadow.normalBias=.025;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:'#7c8a6c',roughness:.97}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;scene.add(floor);
const state=themePreset('amalfi'),water=new THREE.Mesh(new THREE.PlaneGeometry(150,150,80,80),waterMaterial(state));water.rotation.x=-Math.PI/2;water.position.y=-.01;water.visible=false;scene.add(water);
let active,display,sequence=0,catalog,filter='Todos';
const formatBytes=bytes=>`${(bytes/1e6).toFixed(1)} MB`;

function fit(bounds){const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),r=Math.max(size.x,size.y,size.z,.5);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(r*.95,r*.65,r*1.4));controls.maxDistance=Math.max(12,r*5);controls.update();}
async function choose(asset){
  active=asset;const ticket=++sequence;$('active-name').textContent=asset.name;$('status').textContent='Cargando recurso local…';
  document.querySelectorAll('.asset').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===asset.id)));
  try{
    let next;
    if(asset.kind==='model'){
      const level=$('far-lod').checked?1:0,template=await loadEnvironmentModel(asset.id,level);
      if(ticket!==sequence)return;
      next=instanceEnvironmentModel(template,[{x:0,y:0,z:0}],{height:asset.lods[0].dimensions[1],name:asset.id});
      $('active-kind').textContent=asset.family.toUpperCase();
      $('active-stats').textContent=`${asset.lods[level].triangles.toLocaleString('es')} tris · LOD ${level} · ${formatBytes(asset.bytes)} · CC0`;
    }else{
      next=new THREE.Group();
      const material=applyEnvironmentPbr(new THREE.MeshStandardMaterial({roughness:1}),asset.id,{repeat:[2,2],normalStrength:.8});
      const slab=new THREE.Mesh(new THREE.BoxGeometry(3.8,.14,3.8,16,1,16),material);slab.position.y=.07;slab.castShadow=slab.receiveShadow=true;next.add(slab);
      const sphere=new THREE.Mesh(new THREE.SphereGeometry(.72,64,40),applyEnvironmentPbr(new THREE.MeshStandardMaterial({roughness:1}),asset.id));sphere.position.set(0,.87,0);sphere.castShadow=true;next.add(sphere);
      $('active-kind').textContent='MATERIAL PBR';$('active-stats').textContent=`Color + normal GL + ARM · 1K · ${formatBytes(asset.bytes)} · CC0`;
    }
    if(display)disposeAssetGroup(display);display=next;scene.add(display);setWireframe();fit(new THREE.Box3().setFromObject(display));
    $('status').textContent='Arrastra para orbitar · rueda para acercar · doble clic para encuadrar';
    window.assetLibraryReady=asset.id;
  }catch(error){$('status').textContent=`No se pudo cargar ${asset.name}: ${error.message}`;console.error(error);}
}
function setWireframe(){display?.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)m.wireframe=$('wireframe').checked;});}
$('wireframe').addEventListener('change',setWireframe);$('far-lod').addEventListener('change',()=>active&&choose(active));
$('animate-water').addEventListener('change',()=>{water.visible=$('animate-water').checked;floor.visible=!water.visible;});
renderer.domElement.addEventListener('dblclick',()=>display&&fit(new THREE.Box3().setFromObject(display)));
function renderCatalog(){
  $('catalog').replaceChildren();
  for(const asset of catalog.assets.filter(a=>filter==='Todos'||(filter==='Materiales'?a.kind==='material':filter==='Modelos 3D'?a.kind==='model':a.family===filter))){
    const button=document.createElement('button');button.className='asset';button.dataset.id=asset.id;button.type='button';button.setAttribute('aria-pressed',String(active?.id===asset.id));
    const swatch=document.createElement('div');swatch.className='swatch';
    if(asset.kind==='material'||asset.preview){const img=document.createElement('img');img.src=assetUrl(asset.kind==='material'?asset.maps.color:asset.preview);img.alt='';img.loading='lazy';swatch.append(img);}
    else{const glyph=document.createElement('span');glyph.className='glyph';glyph.textContent=asset.family==='Vegetación'?'❧':asset.family==='Rocas'?'◈':'▱';swatch.append(glyph);}
    const tag=document.createElement('span');tag.className='tag';tag.textContent=asset.kind==='model'?'3D · 2 LOD':'PBR · 1K';
    const meta=document.createElement('div');meta.className='asset-meta';
    const family=document.createElement('small');family.textContent=asset.family;
    const title=document.createElement('h2');title.textContent=asset.name;
    const info=document.createElement('p');info.textContent=asset.kind==='model'?`${asset.lods[0].triangles.toLocaleString('es')} tris · ${formatBytes(asset.bytes)}`:`Color / normal / ARM · ${formatBytes(asset.bytes)}`;
    const source=document.createElement('a');source.className='asset-source';source.href=asset.source;source.target='_blank';source.rel='noreferrer';source.textContent='Poly Haven · CC0 ↗';source.addEventListener('click',event=>event.stopPropagation());
    meta.append(family,title,info);button.append(swatch,tag,meta);button.addEventListener('click',()=>choose(asset));
    // Source links sit beside the button to retain valid interactive markup.
    const card=document.createElement('article');card.style.position='relative';button.style.width='100%';
    card.append(button,source);source.style.cssText='display:block;padding:0 15px 14px;background:#213328;font-size:10px;color:#c2d5b3';
    $('catalog').append(card);
  }
}
environmentAssetCatalog().then(data=>{
  catalog=data;const models=data.assets.filter(a=>a.kind==='model').length;
  $('summary').textContent=`${models} modelos · ${data.assets.length-models} materiales PBR · CC0 · ${formatBytes(data.assets.reduce((sum,a)=>sum+a.bytes,0))}`;
  for(const name of ['Todos','Modelos 3D','Materiales','Vegetación','Rocas','Circuito']){
    const b=document.createElement('button');b.textContent=name;b.type='button';b.setAttribute('aria-pressed',String(name===filter));
    b.addEventListener('click',()=>{filter=name;[...$('filters').children].forEach(n=>n.setAttribute('aria-pressed',String(n===b)));renderCatalog();});$('filters').append(b);
  }
  renderCatalog();const requested=new URLSearchParams(location.search).get('asset');return choose(data.assets.find(a=>a.id===requested)||data.assets.find(a=>a.id==='pine_sapling_small'));
}).catch(error=>{$('status').textContent=`Biblioteca no disponible: ${error.message}`;console.error(error);});
new ResizeObserver(()=>{const width=container.clientWidth,height=container.clientHeight;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}).observe(container);
const clock=new THREE.Clock();renderer.setAnimationLoop(()=>{const time=clock.getElapsedTime();controls.update();if(water.visible)updateBiomeMaterials(water,state,time);renderer.render(scene,camera);});
