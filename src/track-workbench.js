import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { PIECE_CATALOG,KIT_PRESETS,compileLayout,kitConfig,samplePiece,MAX_TRACK_PIECES,mirrorPiece } from './track-pieces.js';
import { Circuit } from './circuit.js';
import { roadRibbon,trackStructures } from './road-geometry.js';
import { buildEnvironment } from './environments.js';
import { polishScenery } from './scenery-polish.js';
import { enhanceLandscape } from './landscape-assets.js';
import { EnvironmentSystem } from './environment-system.js';
import { CLIMATES,themePreset,solarPosition } from './environment-config.js';
import { ManualPropLayer,propPreview } from './manual-props.js';
import { MAX_MANUAL_PROPS,propRoadWarnings } from './prop-catalog.js';
import { TrackEditorDocument,readEditorDocument,parseEditorFile,editorTrackConfig } from './track-editor-state.js';
import { editorShell,trackPanel,propsPanel,environmentPanel,escapeHTML } from './track-editor-ui.js';
import { SURFACES } from './config.js';

const dispose=group=>{if(!group)return;const gs=new Set(),ms=new Set();group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());group.removeFromParent();};
const clone=value=>structuredClone(value);
const rad=Math.PI/180;

/** Manual authoring uses the same course, atmosphere and props as the driving scene. */
export class TrackWorkbench {
  constructor(onTest,onClose){
    Object.assign(this,{onTest,onClose,visible:false,tab:'track',focusSection:null,selectedProp:null,placementType:null,transformMode:'translate',palettePiece:'straight-short',search:'',family:'',snap:true,propWarnings:[],details:{}});
    try{this.storage=localStorage;}catch{}this.document=new TrackEditorDocument(readEditorDocument(this.storage));
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.shadowMap.autoUpdate=false;
    const canvas=this.renderer.domElement;canvas.setAttribute('aria-label','Editor 3D: arrastra para orbitar, dos dedos para desplazar y pellizca para acercar.');canvas.tabIndex=0;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(45,1,.1,4000);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.maxPolarAngle=Math.PI/2-.025;this.controls.minDistance=3;this.controls.maxDistance=2400;
    this.ambient=new THREE.HemisphereLight('#d9e8ef','#7b8864',1.5);this.sun=new THREE.DirectionalLight('#fff2dc',3);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.06;this.scene.add(this.ambient,this.sun,this.sun.target);
    this.moon=new THREE.DirectionalLight('#a8c5eb',.05);this.moon.position.set(-50,100,40);this.scene.add(this.moon);
    this.atmosphere=new EnvironmentSystem(this.renderer,this.scene,this.camera,this.sun,this.ambient);
    this.grid=new THREE.GridHelper(1600,160,'#b6d9a3','#b6d9a3');this.grid.position.y=.08;this.grid.material.transparent=true;this.grid.material.opacity=.24;this.grid.visible=false;this.grid.raycast=()=>{};this.scene.add(this.grid);
    this.layer=new ManualPropLayer(this.scene,this.document.value.props);
    this.selectionBox=new THREE.Box3Helper(new THREE.Box3(),new THREE.Color('#d9ff80'));this.selectionBox.visible=false;this.scene.add(this.selectionBox);
    this.transform=new TransformControls(this.camera,canvas);this.scene.add(this.transform.getHelper());this.applySnap();
    this.transform.addEventListener('dragging-changed',e=>{this.controls.enabled=!e.value&&this.visible;if(e.value)this.document.begin();else if(this.visible){this.finish();this.suppressPick=true;}});
    this.transform.addEventListener('objectChange',()=>this.transformChanged());
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    canvas.addEventListener('pointerdown',e=>{this.activePointers??=new Set();this.activePointers.add(e.pointerId);this.multiTouch=this.activePointers.size>1||this.multiTouch;this.pointerStart={x:e.clientX,y:e.clientY,id:e.pointerId,time:performance.now()};this.suppressPick=false;});
    canvas.addEventListener('pointercancel',e=>{this.activePointers?.delete(e.pointerId);if(!this.activePointers?.size)this.multiTouch=false;this.pointerStart=null;});
    canvas.addEventListener('pointermove',e=>this.pointerMove(e));canvas.addEventListener('pointerup',e=>this.pointerUp(e));
    this.observer=new ResizeObserver(()=>this.resize());this.makePrecipitation();
  }
  $(id){return this.host?.querySelector(`#${id}`);}
  mount(host){
    this.host=host;this.visible=true;this.controls.enabled=true;host.classList.add('track-editor');host.innerHTML=editorShell(this.document.value);
    this.$('kit-stage').append(this.renderer.domElement);this.observer.observe(this.$('kit-stage'));
    host.onclick=e=>this.click(e);host.oninput=e=>this.input(e,false);host.onchange=e=>this.input(e,true);
    this.rebuildCourse();this.rebuildLandscape();this.configureEnvironment(true);this.renderPanel();this.renderSequence();this.status();this.resize();this.fit();this.attachSelection();
  }
  hide(){this.finish();this.visible=false;this.controls.enabled=false;this.transform.detach();this.observer.disconnect();this.cancelPlacement();}
  save(){const ok=this.document.save(this.storage);if(this.$('editor-save-status'))this.$('editor-save-status').textContent=ok?'Guardado en este navegador':'No se pudo guardar · Exporta una copia JSON';return ok;}
  finish(){if(this.courseDue)this.rebuildCourse();if(this.landscapeDue)this.rebuildLandscape();if(this.document.commit()){this.save();this.status();}this.gesture=null;}
  mutate(callback,{fit=false,props=false}={}){
    this.finish();try{this.document.change(callback);this.refresh({fit,props});this.save();}catch(error){this.error(error);}
  }
  refresh({fit=false,props=false}={}){
    const doc=this.document.value;this.focusSection=this.focusSection!=null&&this.focusSection<doc.pieces.length?this.focusSection:null;
    if(!doc.props.some(p=>p.id===this.selectedProp))this.selectedProp=null;
    if(props){this.transform.detach();this.layer.setRecords(doc.props);}
    this.rebuildCourse();this.landscapeDue=performance.now();this.configureEnvironment(true);this.renderSequence();this.renderPanel();this.status();this.attachSelection();if(fit)this.fit();
    this.host.querySelector('[data-editor-name]').value=doc.name;
  }
  renderPanel(){
    const panel=this.$('editor-panel');if(!panel)return;const scroll=panel.scrollTop;
    for(const d of panel.querySelectorAll('[data-editor-details]'))this.details[d.dataset.editorDetails]=d.open;
    panel.innerHTML=({track:trackPanel,props:propsPanel,environment:environmentPanel}[this.tab])(this);
    for(const d of panel.querySelectorAll('[data-editor-details]'))if(d.dataset.editorDetails in this.details)d.open=this.details[d.dataset.editorDetails];panel.scrollTop=scroll;
    for(const b of this.host.querySelectorAll('[data-editor-tab]'))b.setAttribute('aria-pressed',String(b.dataset.editorTab===this.tab));
  }
  renderSequence(){
    this.$('editor-sequence').innerHTML=this.document.value.pieces.map((p,i)=>`<button data-editor-section="${i}" aria-pressed="${i===this.focusSection}"><small>${String(i+1).padStart(2,'0')}</small>${escapeHTML(PIECE_CATALOG.find(d=>d.id===(p.id||p)).name)}</button>`).join('')||'<span>Empieza insertando un tramo de la biblioteca.</span>';
  }
  status(){
    if(!this.host)return;this.propWarnings=propRoadWarnings(this.document.value.props,this.circuit);
    const warning=this.host.querySelector('[data-editor-prop-warning]');if(warning)warning.hidden=!this.propWarnings.includes(this.selectedProp);
    const c=this.compiled,valid=c?.closed&&!c.errors.length;
    this.$('editor-validation').className=valid?'valid':'';
    this.$('editor-validation').textContent=c?.errors[0]||(valid?`✓ Circuito cerrado · ${c.length.toFixed(0)} m · ${c.sections.length} tramos${this.propWarnings.length?` · ${this.propWarnings.length} props cerca de la pista`:''}`:!c?.sections.length?'Añade módulos para construir tu circuito.':`Abierto · Cierre: ${c.gap.toFixed(1)} m / ${c.heightGap.toFixed(1)} m de altura / ${(c.angleGap/rad).toFixed(0)}°`);
    this.host.querySelector('[data-editor-action="test"]').disabled=!valid;
    this.host.querySelector('[data-editor-action="undo"]').disabled=!this.document.undoStack.length&&!this.document.pending;
    this.host.querySelector('[data-editor-action="redo"]').disabled=!this.document.redoStack.length;
  }
  error(error){this.$('editor-validation').className='';this.$('editor-validation').textContent=error.message||String(error);}
  click(e){
    const data=e.target.closest('button')?.dataset;if(!data)return;
    if(data.editorTab){this.finish();this.tab=data.editorTab;this.attachSelection();this.renderPanel();this.$('editor-panel').scrollTop=0;return;}
    if(data.editorSection!=null){this.finish();this.focusSection=Number(data.editorSection);this.selectedProp=null;this.tab='track';this.transform.detach();this.selectionBox.visible=false;this.recolorRoad();this.renderPanel();this.$('editor-panel').scrollTop=0;this.renderSequence();return;}
    if(data.editorPiece){this.palettePiece=data.editorPiece;this.renderPanel();return;}
    if(data.editorProp){this.startPlacement(data.editorProp);return;}
    if(data.editorSelectProp){this.selectProp(data.editorSelectProp);return;}
    if(data.editorTransform){this.transformMode=data.editorTransform;this.attachSelection();this.renderPanel();return;}
    const action=data.editorAction;if(!action)return;
    this.host.querySelector('.editor-file-menu')?.removeAttribute('open');
    if(action==='close'){this.onClose();return;}
    if(action==='fit'){this.fit();return;}if(action==='focus'){this.fit(true);return;}if(action==='top'){this.fit(false,true);return;}
    if(action==='save'){this.finish();this.save();return;}
    if(action==='export'){this.export();return;}
    if(action==='import'){this.$('editor-import-file').click();return;}
    if(action==='test'){this.finish();try{this.onTest(editorTrackConfig(this.document.value));}catch(error){this.error(error);}return;}
    if(action==='new'){this.cancelPlacement();this.selectedProp=null;this.focusSection=null;this.mutate(doc=>{doc.name='Mi circuito';doc.pieces=[];doc.props=[];},{fit:true,props:true});return;}
    if(action==='undo'||action==='redo'){this.finish();if(this.document[action]()){this.refresh({props:true});this.save();}return;}
    if(action==='cancel-place'){this.cancelPlacement();this.renderPanel();return;}
    if(action==='place-center'){this.placeAt(this.groundAt(this.controls.target.x,this.controls.target.z));return;}
    if(action==='add-piece'){
      if(this.document.value.pieces.length>=MAX_TRACK_PIECES)return;const at=this.focusSection==null?this.document.value.pieces.length:this.focusSection+1;
      this.mutate(doc=>{doc.pieces.splice(at,0,this.palettePiece);this.focusSection=at;});return;
    }
    const i=this.focusSection;
    if(['duplicate','mirror','previous','next','delete'].includes(action)&&i!=null){
      this.mutate(doc=>{
        if(action==='duplicate'&&doc.pieces.length<MAX_TRACK_PIECES){doc.pieces.splice(i+1,0,clone(doc.pieces[i]));this.focusSection=i+1;}
        if(action==='mirror')doc.pieces[i]=mirrorPiece(doc.pieces[i]);
        if(action==='delete'){doc.pieces.splice(i,1);this.focusSection=null;}
        const j=action==='previous'?i-1:action==='next'?i+1:-1;if(j>=0&&j<doc.pieces.length){[doc.pieces[i],doc.pieces[j]]=[doc.pieces[j],doc.pieces[i]];this.focusSection=j;}
      });return;
    }
    const p=this.document.value.props.find(p=>p.id===this.selectedProp);if(!p)return;
    if(action==='delete-prop'){this.mutate(doc=>{doc.props=doc.props.filter(v=>v.id!==p.id);},{props:true});return;}
    if(action==='ground-prop'){this.mutate(()=>{this.document.patchProp(p.id,{position:this.groundAt(p.position[0],p.position[2]).toArray(),grounded:true});},{props:true});return;}
    if(action==='duplicate-prop'&&this.document.value.props.length<MAX_MANUAL_PROPS){
      this.finish();const id=this.document.addProp(p.type,[p.position[0]+3,p.position[1],p.position[2]+3]);const copy=clone(p);copy.id=id;copy.position[0]+=3;copy.position[2]+=3;
      // Complete the duplicate within its existing undo entry.
      this.document.patchProp(id,copy);this.selectedProp=id;this.refresh({props:true});this.save();
    }
  }
  async input(e,final){
    const input=e.target;
    if(input.id==='editor-import-file'){if(final&&input.files[0]){try{const file=input.files[0];if(file.size>1024*1024)throw new Error('El archivo supera 1 MB.');const value=parseEditorFile(await file.text());this.cancelPlacement();this.selectedProp=null;this.focusSection=null;this.mutate(doc=>Object.assign(doc,value),{fit:true,props:true});}catch(error){this.error(error);}input.value='';}return;}
    if(input.hasAttribute('data-editor-grid')){this.grid.visible=input.checked;return;}
    if(input.hasAttribute('data-editor-snap')){this.snap=input.checked;this.applySnap();return;}
    if(input.hasAttribute('data-editor-search')){this.search=input.value;const start=input.selectionStart;this.renderPanel();const next=this.host.querySelector('[data-editor-search]');next.focus();next.setSelectionRange(start,start);return;}
    if(input.hasAttribute('data-editor-family')){if(final){this.family=input.value;this.renderPanel();}return;}
    if(input.hasAttribute('data-editor-preset')){if(final){const preset=KIT_PRESETS.find(p=>p.id===input.value);if(preset){this.cancelPlacement();this.focusSection=null;this.mutate(doc=>{doc.pieces=clone(preset.pieces);doc.name=preset.name;if(preset.environmentTheme)doc.environment=themePreset(preset.environmentTheme);},{fit:true});}}return;}
    if(input.hasAttribute('data-editor-name')){this.document.begin();this.document.value.name=input.value.slice(0,60);if(final)this.finish();return;}
    const {editScope:scope,editKey:key}=input.dataset;if(!scope||!key)return;
    if(!final&&input.tagName==='SELECT')return;
    if(input.type==='number'&&(input.value===''||input.validity.badInput||input.validity.rangeUnderflow||input.validity.rangeOverflow))return;
    const value=input.type==='checkbox'?input.checked:['range','number'].includes(input.type)?Number(input.value):input.value;
    this.document.begin();
    try{
      if(scope==='piece'){
        let v=value;const record=this.document.value.pieces[this.focusSection];if(key==='bank')v*=rad;if(record?.mirrored&&['bank','amplitude'].includes(key))v=-v;if(key==='widthFactorTo')v/=10;
        this.document.patchPiece(this.focusSection,{[key]:v===''?undefined:v});this.courseDue||=performance.now()+40;this.landscapeDue=performance.now()+350;
      }
      if(scope==='environment'){
        const state=this.document.value.environment;let patch={[key]:value};
        if(key==='theme')patch={...themePreset(value),quality:state.quality};
        if(key==='climate')patch={...CLIMATES[value],climate:value};
        if(key==='solarMode'&&value==='manual'){const s=solarPosition(state);Object.assign(patch,{sunAzimuth:s.azimuth,sunElevation:s.elevation});}
        if(key==='weather')Object.assign(patch,{precipitation:['rain','snow'].includes(value)?.75:0,wetness:value==='rain'?.9:0,snow:value==='snow'?.8:0,clouds:['rain','snow','fog'].includes(value)?.8:.25,fog:value==='fog'?.7:.15,...(value==='sunset'?{hour:18.2}:{})});
        this.document.patchEnvironment(patch);this.configureEnvironment(false);
        if(key==='theme')this.courseDue||=performance.now()+40;if(['theme','grassDensity','quality'].includes(key))this.landscapeDue=performance.now()+250;
      }
      if(scope==='prop'){
        const p=this.document.value.props.find(p=>p.id===this.selectedProp);if(!p)return;const patch={};
        if(['x','y','z'].includes(key)){patch.position=[...p.position];patch.position[{x:0,y:1,z:2}[key]]=value;if(key==='y')patch.grounded=false;else if(p.grounded)patch.position[1]=this.groundAt(patch.position[0],patch.position[2]).y;}
        else patch[key]=value;
        if(key==='grounded'&&value)patch.position=this.groundAt(p.position[0],p.position[2]).toArray();
        const record=this.document.patchProp(p.id,patch);this.layer.updateRecord(record);this.attachSelection();this.syncPropFields();this.renderer.shadowMap.needsUpdate=true;this.status();
      }
      for(const sibling of this.host.querySelectorAll(`[data-edit-scope="${scope}"][data-edit-key="${key}"]`))if(sibling!==input)sibling.value=input.value;
      const readout=this.host.querySelector('[data-editor-sun]');if(readout){const s=solarPosition(this.document.value.environment);readout.textContent=`Azimut ${s.azimuth.toFixed(0)}° · Elevación ${s.elevation.toFixed(1)}°`;}
      if(final){this.finish();if(scope==='piece')this.renderSequence();if(scope==='environment'){this.configureEnvironment(true);if(['theme','weather','solarMode','climate','quality'].includes(key))this.renderPanel();}if(scope==='prop'&&['grounded','y'].includes(key))this.renderPanel();this.status();}
    }catch(error){this.document.cancel();this.error(error);}
  }
  export(){this.finish();const blob=new Blob([JSON.stringify(this.document.value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${this.document.value.name.replace(/[^a-zA-Z0-9_-]/g,'_')||'circuito'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  applySnap(){if(!this.transform)return;this.transform.setTranslationSnap(this.snap?.5:null);this.transform.setRotationSnap(this.snap?15*rad:null);this.transform.setScaleSnap(this.snap?.1:null);}
  selectProp(id){this.finish();this.cancelPlacement();this.selectedProp=id;this.focusSection=null;this.tab='props';this.attachSelection();this.recolorRoad();this.renderSequence();this.status();this.renderPanel();this.$('editor-panel').scrollTop=0;}
  attachSelection(){
    const node=this.layer.nodes.get(this.selectedProp);if(!node||this.tab!=='props'){this.transform.detach();this.selectionBox.visible=false;return;}
    this.transform.attach(node);this.transform.setMode(this.transformMode);const p=this.document.value.props.find(p=>p.id===this.selectedProp);
    this.transform.showX=this.transformMode!=='rotate';this.transform.showY=this.transformMode!=='translate'||!p.grounded;this.transform.showZ=this.transformMode!=='rotate';
    if(this.transformMode==='rotate')this.transform.showY=true;this.selectionBox.box.copy(this.layer.boundsFor(this.selectedProp));this.selectionBox.visible=true;
  }
  transformChanged(){
    const node=this.transform.object,p=this.document.value.props.find(p=>p.id===this.selectedProp);if(!node||!p||!this.transform.dragging)return;
    this.document.begin();const position=node.position.toArray(),axis=this.transform.axis||'X';let scale=p.scale;
    if(this.transformMode==='scale')scale=Math.max(.2,Math.min(5,node.scale[axis==='Y'?'y':axis==='Z'?'z':'x']));
    if(p.grounded)position[1]=this.groundAt(position[0],position[2]).y;
    const record=this.document.patchProp(p.id,{position,rotation:node.rotation.y/rad,scale});this.layer.updateRecord(record);this.selectionBox.box.copy(this.layer.boundsFor(p.id));this.renderer.shadowMap.needsUpdate=true;this.syncPropFields();
  }
  syncPropFields(){
    const p=this.document.value.props.find(p=>p.id===this.selectedProp);if(!p)return;
    for(const input of this.host.querySelectorAll('[data-edit-scope="prop"]')){const key=input.dataset.editKey,value=key==='x'?p.position[0]:key==='y'?p.position[1]:key==='z'?p.position[2]:p[key];if(input.type==='checkbox')input.checked=value;else if(input!==document.activeElement)input.value=typeof value==='number'?+value.toFixed(3):value;}
  }
  startPlacement(type){this.finish();this.cancelPlacement();this.selectedProp=null;this.transform.detach();this.selectionBox.visible=false;this.placementType=type;this.renderer.domElement.style.cursor='crosshair';this.preview=propPreview(type);this.preview.visible=false;this.scene.add(this.preview);this.$('editor-scene-hint').textContent='Toca el terreno para colocar · Esc para cancelar';this.renderPanel();}
  cancelPlacement(){this.placementType=null;this.renderer.domElement.style.cursor='';dispose(this.preview);this.preview=null;if(this.$('editor-scene-hint'))this.$('editor-scene-hint').textContent='Arrastra para orbitar · Botón derecho / dos dedos para desplazar · Rueda para acercar';}
  groundAt(x,z){
    this.scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(x,2500,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(this.groundMeshes||[],false)[0];return new THREE.Vector3(x,hit?.point.y??-.07,z);
  }
  setRay(e){const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);}
  pointerMove(e){if(!this.visible||!this.placementType)return;this.setRay(e);this.scene.updateMatrixWorld(true);const hit=this.raycaster.intersectObjects(this.groundMeshes||[],false)[0],point=hit?.point?.clone()||this.raycaster.ray.intersectPlane(this.plane,new THREE.Vector3());if(!point)return;if(this.snap){point.x=Math.round(point.x*2)/2;point.z=Math.round(point.z*2)/2;}this.preview.position.copy(this.groundAt(point.x,point.z));this.preview.visible=true;}
  pointerUp(e){
    const start=this.pointerStart,multi=this.multiTouch;this.activePointers?.delete(e.pointerId);if(!this.activePointers?.size)this.multiTouch=false;this.pointerStart=null;if(multi||!start||start.id!==e.pointerId||e.button!==0||this.suppressPick||this.transform.dragging||Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;
    this.setRay(e);this.scene.updateMatrixWorld(true);
    if(this.placementType){this.pointerMove(e);if(this.preview.visible)this.placeAt(this.preview.position.clone());return;}
    if(this.transform.axis)return;
    const prop=this.layer.pick(this.raycaster),road=this.raycaster.intersectObjects(this.roadMeshes||[],false)[0];
    if(prop&&(!road||prop.distance<road.distance)){this.selectProp(prop.id);return;}
    if(road){this.focusSection=road.object.userData.sectionIndex;this.selectedProp=null;this.transform.detach();this.selectionBox.visible=false;this.tab='track';this.recolorRoad();this.renderSequence();this.renderPanel();}else{this.selectedProp=null;this.focusSection=null;this.attachSelection();this.recolorRoad();this.renderSequence();this.renderPanel();}
  }
  placeAt(position){if(!this.placementType||this.document.value.props.length>=MAX_MANUAL_PROPS)return;this.finish();try{const id=this.document.addProp(this.placementType,position.toArray());this.selectedProp=id;this.cancelPlacement();this.transform.detach();this.layer.setRecords(this.document.value.props);this.selectProp(id);this.save();this.renderer.shadowMap.needsUpdate=true;}catch(error){this.error(error);}}
  rebuildCourse(){
    this.courseDue=0;dispose(this.course);this.course=new THREE.Group();this.scene.add(this.course);this.roadMeshes=[];this.compiled=compileLayout(this.document.value.pieces);this.circuit=this.document.value.pieces.length?new Circuit({...kitConfig(this.document.value.pieces,this.document.value.name),surface:this.document.value.environment.theme==='reunion'?'mud':'asphalt'}):null;
    this.atmosphereCircuit=this.circuit||new Circuit(kitConfig(['straight-short']));
    if(this.circuit){const c=this.circuit;
      for(const section of c.layout.sections){const surfaceId=c.surfaceAt((section.from+.01)/c.length),surface=SURFACES[surfaceId]||SURFACES.asphalt,material=new THREE.MeshStandardMaterial({color:surface.color,roughness:surface.roughness,side:THREE.DoubleSide});const mesh=roadRibbon(c,u=>-c.widthAt(u)/2,u=>c.widthAt(u)/2,.035,material,[section.from/c.length,section.to/c.length]);mesh.userData.sectionIndex=section.index;mesh.userData.baseColor=surface.color;mesh.userData.surface=surfaceId;mesh.receiveShadow=true;this.course.add(mesh);this.roadMeshes.push(mesh);}
      const stripe=new THREE.MeshStandardMaterial({color:'#e8e4cb',side:THREE.DoubleSide,roughness:.8});this.course.add(roadRibbon(c,u=>-c.widthAt(u)/2+.3,u=>-c.widthAt(u)/2+.45,.065,stripe),roadRibbon(c,u=>c.widthAt(u)/2-.45,u=>c.widthAt(u)/2-.3,.065,stripe),trackStructures(c));
      for(const [u,color]of [[0,'#b4e87c'],[1,'#efa86e']]){const p=c.at(u),marker=new THREE.Mesh(new THREE.SphereGeometry(.65,12,8),new THREE.MeshBasicMaterial({color}));marker.position.set(p.x,p.y+.9,p.z);this.course.add(marker);}
    }
    this.recolorRoad();this.configureEnvironment(false);this.status();this.renderer.shadowMap.needsUpdate=true;
  }
  recolorRoad(){for(const mesh of this.roadMeshes||[]){mesh.material.color.set(mesh.userData.sectionIndex===this.focusSection?'#9ac67b':mesh.userData.baseColor);}}
  rebuildLandscape(){
    this.landscapeDue=0;dispose(this.landscape);this.landscape=new THREE.Group();this.scene.add(this.landscape);buildEnvironment(this.landscape,this.atmosphereCircuit,this.document.value.environment);polishScenery(this.landscape);this.groundMeshes=[];
    const landscape=this.landscape;void enhanceLandscape(landscape,this.atmosphereCircuit,this.document.value.environment,()=>this.landscape===landscape).then(changed=>{if(changed)this.renderer.shadowMap.needsUpdate=true;});
    this.landscape.traverse(o=>{if(o.isMesh&&['biome-ground','biome-water'].includes(o.material?.name))this.groundMeshes.push(o);});
    // Authored grounded props follow terrain changes without losing their X/Z, rotation or scale.
    for(const p of this.document.value.props)if(p.grounded){const y=this.groundAt(p.position[0],p.position[2]).y;if(Math.abs(y-p.position[1])>.001){const next=this.document.patchProp(p.id,{position:[p.position[0],y,p.position[2]]});this.layer.updateRecord(next);}}
    this.attachSelection();this.syncPropFields();this.status();this.renderer.shadowMap.needsUpdate=true;
  }
  configureEnvironment(reflections){
    if(!this.atmosphereCircuit)return;const state=this.document.value.environment;this.atmosphere.configure(state,this.atmosphereCircuit);if(reflections)this.atmosphere.refreshReflections();
    const night=this.atmosphere.solar.elevation<0;this.moon.intensity=night?1.6:.05;
    for(const mesh of this.roadMeshes){mesh.material.roughness=(SURFACES[mesh.userData.surface]?.roughness||.9)*(1-state.wetness*.68);mesh.material.emissive.set(night?'#27394c':'#000000');mesh.material.emissiveIntensity=night?.4:0;}
    this.precipitation.visible=['rain','snow'].includes(state.weather)&&state.precipitation>0;this.precipitation.material.size=state.weather==='snow'?.3:.16;this.precipitation.geometry.setDrawRange(0,Math.floor((state.quality==='mobile'?250:500)*state.precipitation));
  }
  makePrecipitation(){const positions=new Float32Array(500*3);for(let i=0;i<500;i++){positions[i*3]=(Math.random()-.5)*200;positions[i*3+1]=Math.random()*80;positions[i*3+2]=(Math.random()-.5)*200;}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));this.precipitation=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#dbe8ed',size:.2,transparent:true,opacity:.6,depthWrite:false}));this.precipitation.frustumCulled=false;this.scene.add(this.precipitation);}
  fit(selection=false,top=false){
    let box=new THREE.Box3();
    if(selection&&this.selectedProp)box=this.layer.boundsFor(this.selectedProp);
    else if(this.circuit){const section=selection?this.circuit.layout.sections[this.focusSection]:null;for(let i=0;i<=180;i++){const p=this.circuit.at(section?(section.from+(section.to-section.from)*i/180)/this.circuit.length:i/180);box.expandByPoint(new THREE.Vector3(p.x,p.y,p.z));}box.expandByScalar(8);}
    if(box.isEmpty()){box.min.set(-15,0,-15);box.max.set(15,1,15);}
    if(!selection)for(const p of this.document.value.props)box.union(this.layer.boundsFor(p.id));
    const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),direction=new THREE.Vector3(top?.001:.65,top?1:1.1,top?.001:1).normalize(),right=new THREE.Vector3(direction.z,0,-direction.x).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize(),tan=Math.tan(22.5*rad);let distance=16;
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const v=new THREE.Vector3(x*size.x/2,y*size.y/2,z*size.z/2),depth=v.dot(direction);distance=Math.max(distance,depth+Math.abs(v.dot(right))/(tan*this.camera.aspect),depth+Math.abs(v.dot(up))/tan);}distance*=1.12;
    this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance);this.camera.lookAt(center);this.controls.maxDistance=Math.max(1800,distance*2.5);this.controls.update();
  }
  resize(){if(!this.visible)return;const stage=this.$('kit-stage'),w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  handleKey(e){
    const editing=['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName),mod=e.ctrlKey||e.metaKey;
    if(mod&&e.code==='KeyS'){e.preventDefault();this.finish();this.save();return true;}
    if(!editing&&mod&&(e.code==='KeyZ'||e.code==='KeyY')){e.preventDefault();const action=e.code==='KeyY'||e.shiftKey?'redo':'undo';this.finish();if(this.document[action]()){this.refresh({props:true});this.save();}return true;}
    if(e.code==='Escape'){e.preventDefault();if(this.placementType){this.cancelPlacement();this.renderPanel();}else if(this.transform.dragging){this.transform.reset();this.document.cancel();this.refresh({props:true});}else this.onClose();return true;}
    if(editing)return false;
    if(['KeyG','KeyR','KeyS'].includes(e.code)&&this.selectedProp){e.preventDefault();this.transformMode={KeyG:'translate',KeyR:'rotate',KeyS:'scale'}[e.code];this.attachSelection();this.renderPanel();return true;}
    if(e.code==='Delete'||e.code==='Backspace'){const action=this.selectedProp?'delete-prop':this.focusSection!=null?'delete':null;if(action){e.preventDefault();this.host.querySelector(`[data-editor-action="${action}"]`)?.click();return true;}}
    return false;
  }
  update(dt=.016){
    if(!this.visible)return;const now=performance.now();if(this.courseDue&&now>=this.courseDue)this.rebuildCourse();if(this.landscapeDue&&now>=this.landscapeDue){this.rebuildLandscape();if(!this.document.pending)this.save();}
    this.controls.update();const distance=this.camera.position.distanceTo(this.controls.target),near=Math.max(.1,Math.min(40,distance*.015)),far=Math.max(1500,distance*5);if(Math.abs(this.camera.near-near)>.01||Math.abs(this.camera.far-far)>1){this.camera.near=near;this.camera.far=far;this.camera.updateProjectionMatrix();}
    if(this.precipitation.visible){const a=this.precipitation.geometry.attributes.position,slow=this.document.value.environment.weather==='snow';this.precipitation.position.set(this.controls.target.x,0,this.controls.target.z);for(let i=0;i<a.count;i++){a.array[i*3+1]-=dt*(slow?3:28);if(a.array[i*3+1]<0)a.array[i*3+1]=80;}a.needsUpdate=true;}
    this.atmosphere.update(dt,this.landscape,distance);this.atmosphere.render(dt);
  }
}
