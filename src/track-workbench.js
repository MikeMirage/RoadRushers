import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PIECE_CATALOG,PIECE_FAMILIES,KIT_PRESETS,compileLayout,kitConfig,samplePiece,MAX_TRACK_PIECES,mirrorPiece } from './track-pieces.js';
import { Circuit } from './circuit.js';
import { roadRibbon,trackStructures } from './road-geometry.js';
import { buildVehicle } from './vehicles.js';
import { VEHICLES } from './config.js';
import { ENVIRONMENT_THEMES, themePreset } from './environment-config.js';

const colors={Rectas:'#799eaa',Curvas:'#c5a569','Técnicos':'#82a88a',Verticales:'#7d9fbb',Relieve:'#cb9276',Peraltes:'#a8ad73',Espirales:'#a291b5',Estructuras:'#96aca6',Anchuras:'#b6b68d',Superficies:'#a99072'};
const $=id=>document.getElementById(id);
const label=piece=>PIECE_CATALOG.find(p=>p.id===(typeof piece==='string'?piece:piece.id)).name;
const dispose=group=>{const gs=new Set(),ms=new Set();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());group.removeFromParent();};

export class TrackWorkbench {
  constructor(onTest,onClose) {
    this.onTest=onTest;this.onClose=onClose;this.visible=false;this.mode='circuit';this.selected='jump';
    this.pieces=structuredClone(KIT_PRESETS[1].pieces);this.name=KIT_PRESETS[1].name;this.undoStack=[];
    this.drafts={};this.biome='meadow';this.theme='grandprix';
    try{const save=JSON.parse(localStorage.getItem('roadrushers.track-kit.v1'));if(Array.isArray(save?.pieces)&&save.pieces.length<=MAX_TRACK_PIECES){compileLayout(save.pieces);this.pieces=save.pieces;this.biome=save.biome||'meadow';this.theme=ENVIRONMENT_THEMES[save.theme]?save.theme:'grandprix';this.name=typeof save.name==='string'?save.name.slice(0,60):'Mi montaje';}}catch{}
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.domElement.setAttribute('aria-label','Banco 3D de tramos. Arrastra para girar, pellizca o usa la rueda para acercar.');
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#cad8d1');
    this.scene.add(new THREE.HemisphereLight('#f4f3de','#718a80',2));const sun=new THREE.DirectionalLight('#fff3df',2.2);sun.position.set(-50,90,50);this.scene.add(sun);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),new THREE.MeshStandardMaterial({color:'#c1d0c7',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.8;this.scene.add(floor);
    const grid=new THREE.GridHelper(1200,120,'#9cad9f','#b3c5b9');grid.position.y=-.79;this.scene.add(grid);
    this.camera=new THREE.PerspectiveCamera(42,1,.1,4000);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.enablePan=true;this.controls.maxPolarAngle=Math.PI/2-.025;
    this.reference=buildVehicle(VEHICLES[0]).group;this.scene.add(this.reference);
    this.observer=new ResizeObserver(()=>this.resize());
  }

  mount(host) {
    this.host=host;this.visible=true;
    host.innerHTML=`<div class="kit-heading"><div><span class="eyebrow">ROADRUSHERS / SISTEMA MODULAR</span><h2>Kit de circuitos.</h2></div><button class="icon-button" data-kit="close" aria-label="Cerrar kit de circuitos">×</button></div><div class="kit-toolbar"><div class="kit-modes" role="group" aria-label="Vista del kit"><button data-kit-mode="library">Tipos de tramo <span>${PIECE_CATALOG.length}</span></button><button data-kit-mode="circuit">Mi montaje</button></div><div class="kit-presets"><label for="kit-preset">MONTAJES DE PRUEBA</label><button class="kit-new" data-kit="new">Nuevo montaje</button><select id="kit-preset"><option value="">Cargar un montaje…</option>${KIT_PRESETS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></div></div><div class="kit-layout"><aside class="kit-catalog" aria-label="Biblioteca de tramos">${PIECE_FAMILIES.map(f=>`<section><h3>${f}</h3>${PIECE_CATALOG.filter(p=>p.family===f).map(p=>`<button data-piece="${p.id}"><i style="background:${colors[f]}"></i>${p.name}<span>↗</span></button>`).join('')}</section>`).join('')}</aside><div class="kit-canvas-column"><div class="kit-stage-wrap"><div id="kit-stage"></div><span id="kit-view-title"></span><span class="kit-gesture">Cuadrícula 10 m · Entrada verde / salida ámbar · Arrastra y acerca</span><button class="kit-fit" data-kit="fit" aria-label="Centrar vista 3D">⌖ Centrar</button></div><div id="kit-inspector"></div><div class="kit-assembly"><div class="kit-sequence-heading"><span>ORDEN DEL MONTAJE <b id="kit-piece-count"></b></span><div><button data-kit="undo">Deshacer</button><button data-kit="remove">Quitar último</button></div></div><div id="kit-sequence"></div></div></div></div><div class="kit-footer"><p id="kit-validation" role="status"></p><button class="primary-button" data-kit="test">Probar montaje <span>↗</span></button></div>`;
    $('kit-stage').appendChild(this.renderer.domElement);this.observer.observe($('kit-stage'));
    const catalog=host.querySelector('.kit-catalog'),search=document.createElement('input');search.type='search';search.placeholder='Buscar entre 119 módulos…';search.setAttribute('aria-label','Buscar módulos de pista');search.className='kit-search';catalog.prepend(search);
    search.placeholder=`Buscar entre ${PIECE_CATALOG.length} módulos…`;search.oninput=()=>{const query=search.value.toLocaleLowerCase('es');for(const b of catalog.querySelectorAll('[data-piece]'))b.hidden=!b.textContent.toLocaleLowerCase('es').includes(query);for(const s of catalog.querySelectorAll('section'))s.hidden=![...s.querySelectorAll('button')].some(b=>!b.hidden);};
    host.querySelector('.kit-sequence-heading>div').insertAdjacentHTML('afterbegin','<button data-kit="move-back" aria-label="Mover tramo antes">←</button><button data-kit="move-forward" aria-label="Mover tramo después">→</button><button data-kit="duplicate">Duplicar</button><button data-kit="mirror">Reflejar</button><button data-kit="delete">Eliminar</button>');
    host.querySelector('.kit-presets').insertAdjacentHTML('beforeend',`<select id="kit-biome" aria-label="Bioma del montaje">${[['meadow','Pradera'],['forest','Bosque'],['coast','Costa'],['desert','Desierto'],['alpine','Alpino'],['autumn','Otoño'],['workshop','Banco neutro']].map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select>`);$('kit-biome').value=this.biome;
    $('kit-biome').innerHTML=Object.entries(ENVIRONMENT_THEMES).map(([id,t])=>`<option value="${id}" ${id===this.theme?'selected':''}>${t.name}</option>`).join('');$('kit-biome').setAttribute('aria-label','Entorno del montaje');
    $('kit-biome').onchange=e=>{this.theme=e.target.value;this.biome=ENVIRONMENT_THEMES[this.theme].biome;this.save();};
    host.onchange=e=>{const key=e.target.dataset.pieceParam;if(!key)return;const value=Number(e.target.value);if(!Number.isFinite(value))return;const chosen=this.mode==='circuit'&&this.focusSection!=null;const previous=chosen?this.pieces[this.focusSection]:{id:this.selected,...this.drafts[this.selected]};try{samplePiece({...(typeof previous==='string'?{id:previous}:previous),[key]:value});}catch(error){$('kit-validation').textContent=error.message;return;}if(chosen){this.remember();const previous=this.pieces[this.focusSection];this.pieces[this.focusSection]={...(typeof previous==='string'?{id:previous}:previous),[key]:value};this.name='Mi montaje';this.save();}else{this.drafts[this.selected]={...this.drafts[this.selected],[key]:value};}this.refresh();};
    host.onclick=e=>this.click(e);$('kit-preset').onchange=e=>{const preset=KIT_PRESETS.find(p=>p.id===e.target.value);if(preset){this.remember();this.pieces=structuredClone(preset.pieces);this.name=preset.name;if(preset.environmentTheme){this.theme=preset.environmentTheme;this.biome=ENVIRONMENT_THEMES[this.theme].biome;$('kit-biome').value=this.theme;}this.mode='circuit';this.focusSection=null;this.refresh();this.save();}};
    this.refresh();this.resize();
  }

  hide(){this.visible=false;this.controls.enabled=false;this.observer.disconnect();}
  save(){try{localStorage.setItem('roadrushers.track-kit.v1',JSON.stringify({pieces:this.pieces,name:this.name,biome:this.biome,theme:this.theme}));}catch{}}
  remember(){this.undoStack.push({pieces:structuredClone(this.pieces),name:this.name});if(this.undoStack.length>32)this.undoStack.shift();}

  click(e){
    const type=e.target.closest('[data-piece]');if(type){this.selected=type.dataset.piece;this.mode='library';this.refresh();return;}
    const mode=e.target.closest('[data-kit-mode]');if(mode){this.mode=mode.dataset.kitMode;if(this.mode==='circuit')this.focusSection=null;this.refresh();return;}
    const item=e.target.closest('[data-section]');if(item){this.focusSection=Number(item.dataset.section);this.selected=typeof this.pieces[this.focusSection]==='string'?this.pieces[this.focusSection]:this.pieces[this.focusSection].id;this.mode='circuit';this.refresh();return;}
    const action=e.target.closest('[data-kit]')?.dataset.kit;
    if(action==='close')this.onClose();
    if(action==='new'){this.remember();this.pieces=[];this.name='Mi montaje';this.focusSection=null;this.mode='circuit';this.refresh();this.save();}
    if(action==='fit')this.fit();
    if(action==='add'&&this.pieces.length<MAX_TRACK_PIECES){this.remember();const item=this.drafts[this.selected]?{id:this.selected,...this.drafts[this.selected]}:this.selected;const at=this.focusSection!=null?this.focusSection+1:this.pieces.length;this.pieces.splice(at,0,item);this.name='Mi montaje';this.mode='circuit';this.focusSection=at;this.refresh();this.save();}
    if(['duplicate','mirror','delete','move-back','move-forward'].includes(action)&&this.focusSection!=null){
      const i=this.focusSection;this.remember();
      if(action==='duplicate'&&this.pieces.length<MAX_TRACK_PIECES){this.pieces.splice(i+1,0,structuredClone(this.pieces[i]));this.focusSection++;}
      if(action==='mirror')this.pieces[i]=mirrorPiece(this.pieces[i]);
      if(action==='delete'){this.pieces.splice(i,1);this.focusSection=null;}
      const j=action==='move-back'?i-1:action==='move-forward'?i+1:-1;if(j>=0&&j<this.pieces.length){[this.pieces[i],this.pieces[j]]=[this.pieces[j],this.pieces[i]];this.focusSection=j;}
      this.name='Mi montaje';this.refresh();this.save();
    }
    if(action==='remove'&&this.pieces.length){this.remember();this.pieces.pop();this.name='Mi montaje';this.focusSection=null;this.mode='circuit';this.refresh();this.save();}
    if(action==='undo'&&this.undoStack.length){Object.assign(this,this.undoStack.pop());this.focusSection=null;this.mode='circuit';this.refresh();this.save();}
    if(action==='test'&&this.compiled.closed&&!this.compiled.errors.length){const visual=themePreset(this.theme);this.onTest({...kitConfig(structuredClone(this.pieces),this.name),biome:visual.biome,environmentTheme:this.theme,weather:visual.weather,surface:this.theme==='reunion'?'mud':'asphalt'});}
  }

  refresh(){
    this.compiled=compileLayout(this.pieces);
    $('kit-preset').value=KIT_PRESETS.find(p=>JSON.stringify(p.pieces)===JSON.stringify(this.pieces))?.id||'';
    for(const b of this.host.querySelectorAll('[data-kit-mode]'))b.setAttribute('aria-pressed',String(b.dataset.kitMode===this.mode));
    for(const b of this.host.querySelectorAll('[data-piece]'))b.setAttribute('aria-pressed',String(b.dataset.piece===this.selected));
    const definition=PIECE_CATALOG.find(p=>p.id===this.selected),preview=samplePiece({id:this.selected,...this.drafts[this.selected]});
    const chosen=this.mode==='library'?null:this.compiled.sections[this.focusSection];
    const piece=chosen?.spec||preview.spec;
    const stats=this.mode==='library'||chosen;
    $('kit-view-title').textContent=this.mode==='library'?definition.name:this.name;
    $('kit-inspector').innerHTML=stats?`<div class="kit-piece-info"><div><span class="eyebrow">${piece.family.toUpperCase()} · ANCHO 10 M</span><h3>${piece.name}</h3><p>${piece.description}</p></div><dl><div><dt>Longitud</dt><dd>${(chosen?chosen.to-chosen.from:preview.length).toFixed(1)} m</dd></div><div><dt>${piece.kind==='curve'?'Radio':'Desnivel'}</dt><dd>${piece.kind==='curve'?`${piece.radius} m`:`${piece.rise||piece.height||0} m`}</dd></div><div><dt>Giro de salida</dt><dd>${piece.angle||0}°</dd></div></dl><button class="kit-add" data-kit="add" ${this.pieces.length>=MAX_TRACK_PIECES?'disabled':''}>+ Añadir al montaje</button></div>`:`<div class="kit-mount-info"><p>${KIT_PRESETS.find(p=>p.name===this.name)?.description||'Conecta tramos y vuelve a la entrada con la misma orientación y altura.'}</p><dl><div><dt>Longitud</dt><dd>${this.compiled.length.toFixed(0)} m</dd></div><div><dt>Cota máxima</dt><dd>${Math.max(0,this.compiled.maxHeight).toFixed(1)} m</dd></div><div><dt>Pendiente máx.</dt><dd>${(this.compiled.maxGrade*100).toFixed(0)}%</dd></div><div><dt>Cruces elevados</dt><dd>${this.compiled.crossings.filter(c=>c.clearance>=4).length}</dd></div></dl></div>`;
    if(stats){
      const fields=piece.kind==='curve'?[['radius','Radio (m)',7,100,1],['angle','Giro (°)',5,360,5],['rise','Desnivel (m)',-12,12,1],['bank','Peralte (rad)',-.5,.5,.02]]:[['length','Longitud (m)',4,160,1],...(piece.kind==='ramp'?[['rise','Desnivel (m)',-12,12,1]]:[])];
      $('kit-inspector').insertAdjacentHTML('beforeend',`<div class="kit-parameters">${fields.map(([key,label,min,max,step])=>`<label>${label}<input type="number" data-piece-param="${key}" min="${min}" max="${max}" step="${step}" value="${piece[key]||0}"></label>`).join('')}</div>`);
    }
    $('kit-piece-count').textContent=`${this.pieces.length} / ${MAX_TRACK_PIECES}`;
    const add=this.host.querySelector('[data-kit="add"]');if(add)add.disabled=this.pieces.length>=MAX_TRACK_PIECES;
    for(const name of ['duplicate','mirror','delete','move-back','move-forward'])this.host.querySelector(`[data-kit="${name}"]`).disabled=this.focusSection==null;
    $('kit-sequence').innerHTML=this.pieces.length?this.pieces.map((p,i)=>`<button data-section="${i}" class="${this.focusSection===i?'selected':''}"><small>${String(i+1).padStart(2,'0')}</small>${label(p)}</button>`).join(''):'<span class="kit-empty">Selecciona un tipo de tramo y añádelo al montaje.</span>';
    const valid=this.compiled.closed&&!this.compiled.errors.length;
    this.host.querySelector('[data-kit="test"]').disabled=!valid;
    this.host.querySelector('[data-kit="remove"]').disabled=!this.pieces.length;this.host.querySelector('[data-kit="undo"]').disabled=!this.undoStack.length;
    $('kit-validation').className=valid?'valid':'';
    $('kit-validation').textContent=this.compiled.errors[0]||(valid?`✓ Circuito cerrado · Conexiones alineadas${this.compiled.crossings.length?` · Altura libre ${Math.min(...this.compiled.crossings.map(c=>c.clearance))-.65} m`:''}`:`Montaje abierto · Faltan ${this.compiled.gap.toFixed(1)} m en planta · ${this.compiled.heightGap.toFixed(1)} m de altura · ${(this.compiled.angleGap*180/Math.PI).toFixed(0)}° de orientación`);
    this.buildView();
  }

  buildView(){
    if(this.course)dispose(this.course);this.course=new THREE.Group();this.scene.add(this.course);
    if(!this.pieces.length&&this.mode==='circuit'){this.reference.visible=false;this.circuit=null;this.fit();return;}
    const selected=samplePiece({id:this.selected,...this.drafts[this.selected]}).spec;
    const config=this.mode==='library'?{...kitConfig([{id:this.selected,...this.drafts[this.selected]}]),startHeight:Math.max(0,-(selected.rise||0),selected.kind==='bridge'?6:0)}:kitConfig(this.pieces);
    this.circuit=new Circuit(config);const c=this.circuit;
    for(const section of c.layout.sections){
      const active=this.mode==='library'||section.index===this.focusSection;
      const material=new THREE.MeshStandardMaterial({color:active?colors[section.spec.family]:'#435d59',roughness:.85,side:THREE.DoubleSide});
      this.course.add(roadRibbon(c,u=>-c.widthAt(u)/2,u=>c.widthAt(u)/2,.035,material,[section.from/c.length,section.to/c.length]));
      const joint=c.at(section.from/c.length);const seam=roadRibbon(c,u=>-c.widthAt(u)/2,u=>c.widthAt(u)/2,.065,new THREE.MeshBasicMaterial({color:'#e4e6cb',side:THREE.DoubleSide}),[section.from/c.length,Math.min(1,(section.from+.16)/c.length)]);this.course.add(seam);
    }
    const line=new THREE.MeshBasicMaterial({color:'#e7e9d6',side:THREE.DoubleSide});
    this.course.add(roadRibbon(c,u=>-c.widthAt(u)/2+.35,u=>-c.widthAt(u)/2+.5,.055,line),roadRibbon(c,u=>c.widthAt(u)/2-.5,u=>c.widthAt(u)/2-.35,.055,line),trackStructures(c));
    const focused=this.mode==='circuit'?c.layout.sections[this.focusSection]:null;
    const entry=c.at(focused?focused.from/c.length:0),exit=c.at(focused?focused.to/c.length:1);
    for(const [p,color]of [[entry,'#b4e87c'],[exit,'#eaab7c']]){
      const marker=new THREE.Mesh(new THREE.SphereGeometry(.65,12,8),new THREE.MeshBasicMaterial({color}));marker.position.set(p.x,p.y+.9,p.z);this.course.add(marker);
    }
    this.reference.visible=true;const car=c.at(focused?Math.min((focused.from+3)/c.length,focused.to/c.length):Math.min(3/c.length,.1));this.reference.position.set(car.x,car.y+.1,car.z);this.reference.rotation.set(-car.pitch,car.heading,car.bank,'YXZ');
    this.fit();
  }

  fit(){
    const c=this.circuit,section=this.mode==='circuit'?c?.layout.sections[this.focusSection]:null;
    const samples=c?Array.from({length:181},(_,i)=>c.at(section?(section.from+(section.to-section.from)*i/180)/c.length:i/180)):[];
    const box=new THREE.Box3();for(const p of samples)box.expandByPoint(new THREE.Vector3(p.x,p.y,p.z));
    if(box.isEmpty()){box.min.set(-10,0,-10);box.max.set(10,0,10);}
    const center=box.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(.65,1.15,1).normalize();
    const right=new THREE.Vector3(direction.z,0,-direction.x).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize(),tan=Math.tan(THREE.MathUtils.degToRad(21));
    let distance=18;
    for(const p of samples)for(const side of [-6,6]){
      const v=new THREE.Vector3(p.x+p.normal.x*side,p.y+1,p.z+p.normal.z*side).sub(center),depth=v.dot(direction);
      distance=Math.max(distance,depth+(Math.abs(v.dot(right))+2)/(tan*this.camera.aspect),depth+(Math.abs(v.dot(up))+2)/tan);
    }
    distance*=1.12;this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance);this.camera.lookAt(center);
    this.controls.minDistance=8;this.controls.maxDistance=distance*3;this.controls.update();
  }
  resize(){if(!this.visible)return;const host=$('kit-stage'),w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.fit();}
  update(){if(!this.visible)return;this.controls.update();this.renderer.render(this.scene,this.camera);}
}
