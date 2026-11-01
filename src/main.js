import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800-italic.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import './style.css';
import './career.css';
import './vehicle-collection.css';
import './track-kit.css';
import './track-editor.css';
import './race.css';
import './mobile-gameplay.css';
import './results.css';
import './ghost.css';
import './preferences.css';
import './prl-theme.css';
import { mountBrandUI } from './prl-brand.js';
import {loadPreferences,savePreferences,normalizePreferences,selectGraphicsPreset,graphicsPolicy} from './preferences.js';
import {renderPreferences} from './preferences-ui.js';
import { ResultRecords,resultContext,createReport } from './results.js';
import { renderSessionResult } from './results-ui.js';
import { loadAILeaderboard } from './leaderboard.js';
import { SURFACES, WEATHER, PACES, VEHICLES } from './config.js';
import { Circuit } from './circuit.js';
import { DriveModel, LapTracker, formatTime } from './physics.js';
import { World } from './world.js';
import { EngineAudio } from './audio.js';
import { PerformanceStats, AdaptiveResolution } from './performance.js';
import { FixedStepClock, FIXED_STEP } from './timing.js';
import { GhostRecords, GhostRecorder, sampleGhost } from './ghost.js';

import { renderGarage,renderGarageDetail } from './vehicle-collection-ui.js';
import { renderPlayground } from './playground-ui.js';
import { loadPlayground,savePlayground,normalizePlayground,resolvePlayground,playgroundTracks } from './playground.js';
import { carIllustration } from './vehicles.js';
import { renderGarageRoster } from './vehicle-collection-ui.js';
import { readDrivingInput,bindTouchSteering,bindMouseDriving } from './input.js';
import {GamepadReader,createMenuNavigation} from './gamepad.js';
import { RaceSession } from './race.js';
import { readSavedEditorDocument,savedEditorTrackId } from './track-editor-state.js';
import { renderRaceHUD } from './race-ui.js';

const $ = id => document.getElementById(id);
const brandUI=mountBrandUI();
const icons = {
  camera: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 4L5.5 6H3.5A1.5 1.5 0 002 7.5v7A1.5 1.5 0 003.5 16h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0016.5 6H14l-1-2H7Z" stroke="currentColor" stroke-width="1.3"/><circle cx="10" cy="10.5" r="3" stroke="currentColor" stroke-width="1.3"/></svg>',
};
let storage;
try { storage = localStorage; } catch { storage = null; }
const playgroundOptions=loadPlayground(storage);
let preferences=loadPreferences(storage),preferencesOpen=false,preferencesTab='graphics',preferencesFocus;
const resultRecords=new ResultRecords(storage);
const ghostRecords=new GhostRecords(storage);
let ghostRecorder,ghostLap=null;
const initialPlayground=resolvePlayground(playgroundOptions,playgroundTracks(undefined,storage));
const settings=(initialPlayground.error?resolvePlayground({}):initialPlayground).settings;
let world, circuit, drive, laps, best = null, state = 'loading', countdown = 0, toastTime = 0, finishedTime = null;
let lastFrame = performance.now(), uiTimer = 0, mapProjection, mapBackground, modalFocus, garage;
let workbench,kitFocus,touchControls,mouseControls,garageContext='session',garageSurface=null;
let timingContext,previousPersonalLap=null,activeReport=null,leaderboardAbort;
let garageLoading=false,kitLoading=false;
let race=null;
const keys = new Set(), pointers = new Map(), audio = new EngineAudio();
const performanceStats = new PerformanceStats(), simulationClock = new FixedStepClock(), resolution = new AdaptiveResolution(devicePixelRatio,graphicsPolicy(preferences,devicePixelRatio));
const startButton = $('start-btn'); startButton.disabled = true;
$('camera-icon').innerHTML = icons.camera;
const gamepadReader=new GamepadReader();
let gamepadState=null,padFamily='standard',inputDevice=matchMedia('(pointer:coarse)').matches?'touch':'keyboard';
const inputPrompts=document.createElement('div');inputPrompts.id='game-input-prompts';inputPrompts.className='game-input-prompts';document.body.append(inputPrompts);
function fullGarage(){return !$('garage-overlay').classList.contains('hidden');}
function menuRoot(){
  if(!$('prl-splash').hidden)return $('prl-splash');
  if(preferencesOpen)return $('preferences-content');
  if(fullGarage())return $('garage-content');
  if(workbench?.visible)return $('track-kit-content');
  if(state==='finished')return $('result-content');
  if(state==='paused')return $('pause-overlay');
  if(state==='hub')return $('playground-hub');
  if(state==='ready')return $('intro');
  return null;
}
function updateInputPrompts(){
  document.body.dataset.input=inputDevice;
  const ps=padFamily==='playstation',confirm=ps?'✕':'A',back=ps?'○':'B';
  const menuHint=inputDevice==='gamepad'?`${confirm} Confirmar · ${back} Volver · ${ps?'L1 / R1':'LB / RB'} Cambiar categoría`:'← → Seleccionar · Enter Confirmar · Esc Volver';
  for(const node of document.querySelectorAll('.gamepad-context-hint'))node.textContent=menuHint;
  for(const node of document.querySelectorAll('.controller-status'))node.textContent=inputDevice==='gamepad'?(ps?'DualSense / PlayStation':'Mando estándar'):inputDevice==='touch'?'Controles táctiles':'Teclado y ratón · Mando: pulsa un botón';
  inputPrompts.textContent=inputDevice==='gamepad'?'Stick Girar · R2 / RT Acelerar · L2 / LT Frenar · Options / Menu Pausa':inputDevice==='mouse'?'Mantén clic izquierdo y mueve para girar · Clic derecho: freno':inputDevice==='touch'?'':'← → / A D Girar · ↓ / S Frenar · Esc Pausa';
}
function setInputDevice(device,family){const changed=device!==inputDevice||family&&family!==padFamily;if(family)padFamily=family;if(!changed)return;inputDevice=device;updateInputPrompts();}
function backFromMenu(){
  if(!$('prl-splash').hidden){if(state!=='loading')brandUI.dismiss();return;}
  if(preferencesOpen){closePreferences();return;}
  if(fullGarage()){closeGarage();return;}
  if(workbench?.visible){closeKit();return;}
  if(state==='finished'||state==='ready'){showHub();return;}
  if(state==='paused'){setState('running');return;}
  if(state==='running'||state==='countdown')pause();
}
const menuNavigation=createMenuNavigation({root:menuRoot,onBack:backFromMenu,onDevice:setInputDevice,
  onConfirm:element=>{if(fullGarage()&&element.dataset.inspect){selectVehicle(element.dataset.inspect);return true;}return false;},
  onTab:direction=>{
    const root=menuRoot(),selector=fullGarage()?'[data-collection-page]':preferencesOpen?'[data-preferences-tab]':state==='finished'?'[data-results-tab]':'[data-play-mode]';
    const tabs=[...root.querySelectorAll(selector)],index=tabs.findIndex(button=>button.getAttribute('aria-pressed')==='true');
    tabs[(index+direction+tabs.length)%tabs.length]?.click();
  }});
function pollGamepad(now,dt){
  let pads=[];try{pads=navigator.getGamepads?.()||[];}catch{/* Keyboard, mouse and touch remain available. */}
  const sample=gamepadReader.sample(pads,now);gamepadState=sample.pad;
  if(sample.disconnected&&inputDevice==='gamepad'&&['running','countdown'].includes(state)){setState('paused');toast('Mando desconectado · Carrera en pausa');}
  if(sample.active)setInputDevice('gamepad',sample.pad.family);
  for(const action of sample.actions){
    if(action==='pause'){if(['running','paused','countdown'].includes(state))pause();else if(state==='hub'&&!fullGarage())openPreferences();continue;}
    if(menuRoot()){menuNavigation.action(action);continue;}
    if(action==='back')pause();if(action==='reset')reset();if(action==='camera')toggleCamera();
  }
  if(inputDevice==='gamepad'&&gamepadState){
    if(garage?.visible&&!preferencesOpen&&!workbench?.visible)garage.orbit(gamepadState.orbitX,gamepadState.orbitY,dt);
    else{const area=menuRoot()?.querySelector('.preferences-body,.report-body,.play-config-body,.editor-panel');if(area)area.scrollTop+=gamepadState.orbitY*dt*450;}
  }
}
updateInputPrompts();

function applyGraphics(){
  const policy=graphicsPolicy(preferences,devicePixelRatio);resolution.configure(policy);
  for(const view of [world,garage,workbench]){
    if(!view?.renderer)continue;
    const renderer=view.renderer;renderer.setPixelRatio(resolution.ratio);view.atmosphere?.setGraphics(policy);view.setGraphics?.(policy);
    if(!view.setGraphics)renderer.shadowMap.enabled=policy.shadowSize>0;
  }
  if(garage?.visible)garage.resize();if(workbench?.visible)workbench.resize();
  updatePreferencesReadout();
}
function updatePreferencesReadout(){
  const output=$('graphics-readout');if(!preferencesOpen||!output||!world)return;
  const canvas=world.renderer.domElement;
  const samples=Math.min(preferences.samples,world.renderer.capabilities.maxSamples);
  output.textContent=`Objetivo ${preferences.targetFPS} fps · ${(1000/preferences.targetFPS).toFixed(1)} ms por frame · ${canvas.width} × ${canvas.height} px · ${world.renderer.getPixelRatio().toFixed(2)}×${preferences.resolution==='auto'?' · Automática':' · Fija'} · ${samples?'MSAA '+samples+'×':'Sin MSAA'}`;
}
function updateTouchGuide(){
  $('touch-guide').innerHTML=preferences.touchMode==='trackpad'?'<span>← TOCA PARA GIRAR →</span><span>CENTRO = RECTO</span><small>Segundo dedo para frenar</small>':'<span>← TOCA A LA IZQUIERDA</span><span>TOCA A LA DERECHA →</span><small>Las dos zonas a la vez para frenar</small>';
  $('touch-steering').setAttribute('aria-label',preferences.touchMode==='trackpad'?'Trackpad analógico de ancho completo en la mitad inferior; la posición marca el giro y el segundo dedo frena':'Dirección táctil: mitad inferior izquierda y derecha');
}
function paintPreferences(){
  const host=$('preferences-content'),open=host.querySelector('.preferences-advanced')?.open,scroll=host.querySelector('.preferences-body')?.scrollTop||0;
  host.innerHTML=renderPreferences(preferences,preferencesTab,{soundEnabled:audio.enabled});
  const advanced=host.querySelector('.preferences-advanced');if(advanced&&open)advanced.open=true;
  host.querySelector('.preferences-body').scrollTop=scroll;updatePreferencesReadout();
}
function openPreferences(){
  if(!world||state==='loading'||preferencesOpen)return;
  preferencesFocus=document.activeElement;if(state==='running')setState('paused');else if(state==='countdown')setState('ready');
  clearPointers();preferencesOpen=true;paintPreferences();$('preferences-overlay').classList.remove('hidden');
  for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=true;
  $('preferences-content').querySelector('[data-preferences-close]').focus();
}
function closePreferences(){
  preferencesOpen=false;$('preferences-overlay').classList.add('hidden');
  for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=false;
  if(preferencesFocus?.isConnected)preferencesFocus.focus();
}
function changePreferences(next){
  const before=preferences;preferences=normalizePreferences(next);clearPointers();
  const graphicsChanged=['quality','resolution','samples','effects','shadows','targetFPS'].some(k=>before[k]!==preferences[k]);
  if(graphicsChanged)applyGraphics();applyHUDPreferences();updateTouchGuide();const saved=savePreferences(storage,preferences);paintPreferences();
  $('preferences-save-status').textContent=saved?'Ajustes guardados.':'Aplicado durante esta sesión.';
}

function recordKey() { return `roadrushers.v3.${settings.track.id}.${settings.vehicle.id}.${settings.surface}.${settings.weather}.${settings.pace}`; }
function readBest() {
  best = resultRecords.get(timingContext).bestLap;
  if(settings.mode==='practice')try { const value = Number(storage?.getItem(recordKey())); if (value > 0 && value < 3600 && Number.isFinite(value)) best = Math.min(best??Infinity,value); } catch { /* Session-only records remain available. */ }
  previousPersonalLap=best;
  $('best-time').textContent = formatTime(best);
}

function applyHUDPreferences(){
  document.body.dataset.minimap=String(preferences.showMinimap);
  document.body.dataset.speed=String(preferences.showSpeed);
  performanceStats.setEnabled(preferences.showStats,{detailed:preferences.statsDetailed});
}
function toggleSound(){audio.toggle();if(preferencesOpen){paintPreferences();$('preferences-content').querySelector('[data-sound-toggle]').focus();}}

function refreshPlayground(){
  if(garageSurface==='home'){garage?.hide();garageSurface=null;}
  const hub=$('playground-hub'),opened=[...hub.querySelectorAll('details[open]')].map(d=>d.dataset.playDetails),scroll=hub.querySelector('.play-config-body')?.scrollTop||0;
  hub.innerHTML=renderPlayground(playgroundOptions,playgroundTracks(settings.track,storage),state!=='loading');
  for(const detail of hub.querySelectorAll('details'))detail.open=opened.includes(detail.dataset.playDetails);
  hub.querySelector('.play-config-body').scrollTop=scroll;
  requestAnimationFrame(syncPlaygroundScroll);
  updateInputPrompts();if(state==='hub')mountHomeGarage();
}
function syncPlaygroundScroll(){
  const area=$('playground-hub').querySelector('.play-config-body'),hint=$('playground-hub').querySelector('.play-scroll-hint');
  if(area&&hint)hint.hidden=area.scrollHeight-area.scrollTop-area.clientHeight<8;
}
function hubFocusMode(mode){$('playground-hub').querySelector(`[data-play-mode="${mode}"]`)?.focus({preventScroll:true});}
function showHub(){
  if(!world||state==='loading')return;
  stopResultCalculation();closeGarage();closeKit();refreshPlayground();setState('hub');
}
function launchPlayground(startNow=true){
  if(!world||state==='loading')return;
  const prepared=resolvePlayground(playgroundOptions,playgroundTracks(settings.track,storage));if(prepared.error)return;
  Object.assign(playgroundOptions,prepared.options);savePlayground(storage,playgroundOptions);
  Object.assign(settings,prepared.settings);
  closeGarage();makeSession(true);if(startNow)start();
}
function selectVehicle(vehicleId){
  const vehicle=VEHICLES.find(v=>v.id===vehicleId);if(!world||state==='loading'||!vehicle)return;
  const destination=garageContext;settings.vehicle=vehicle;playgroundOptions.vehicleId=vehicleId;savePlayground(storage,playgroundOptions);
  closeGarage();makeSession(false);
  if(destination==='hub'){refreshPlayground();setState('hub');$('playground-hub').querySelector('.primary-button')?.focus({preventScroll:true});}
}
function cancelGarage(){closeGarage();}
async function getGarage(){
  const {GarageView}=await import('./garage.js');
  garage ||= new GarageView(id=>{if(garageSurface==='home')openGarage(id,'hub');else inspectVehicle(id);});
  return garage;
}
async function mountHomeGarage(){
  const host=$('home-car-stage');if(!host||state!=='hub'||fullGarage())return;
  try{const view=await getGarage();if(!host.isConnected||state!=='hub'||fullGarage())return;
    host.innerHTML='';garageSurface='home';view.mount(host,playgroundOptions.vehicleId);applyGraphics();
  }catch{/* The selected car illustration remains usable if the 3D preview fails. */}
}
async function openGarage(inspectId,context) {
  if (!world || state === 'loading') return;
  if (fullGarage()||garageLoading) return;
  garageLoading=true;
  try{await getGarage();}catch{toast('No se ha podido abrir el garaje.');return;}finally{garageLoading=false;}
  garageContext=context||(state==='hub'?'hub':'session');
  modalFocus = document.activeElement;
  if (state === 'running') setState('paused'); else if (state === 'countdown') setState('ready');
  $('garage-content').innerHTML = renderGarage(null,playgroundOptions.vehicleId,{testing:true});
  $('garage-overlay').classList.remove('hidden');
  garageSurface='garage';
  garage.mount($('garage-stage'),playgroundOptions.vehicleId);
  applyGraphics();
  if(typeof inspectId==='string'&&VEHICLES.some(v=>v.id===inspectId))inspectVehicle(inspectId);
  for (const node of document.querySelectorAll('header.topbar, main, #result-overlay')) node.inert=true;
  $('garage-content').querySelector(`[data-inspect="${garage.selectedId}"]`)?.focus({preventScroll:true});updateInputPrompts();
}
function closeGarage() {
  const wasOpen = !$('garage-overlay').classList.contains('hidden');
  $('garage-overlay').classList.add('hidden');
  if(garageSurface==='garage'){garage?.hide();garageSurface=null;}
  for (const node of document.querySelectorAll('header.topbar, main, #result-overlay')) node.inert=false;
  if (wasOpen && modalFocus?.isConnected) modalFocus.focus();
  if(wasOpen&&state==='hub')mountHomeGarage();
}
async function openKit() {
  if(!world||state==='loading'||workbench?.visible||kitLoading)return;
  kitLoading=true;
  let TrackWorkbench;
  try{({TrackWorkbench}=await import('./track-workbench.js'));}catch{toast('No se ha podido abrir el editor.');return;}finally{kitLoading=false;}
  closeGarage();kitFocus=document.activeElement;
  if(state==='running')setState('paused');else if(state==='countdown')setState('ready');
  workbench ||= new TrackWorkbench(config=>{
    closeKit();Object.assign(playgroundOptions,{trackId:config.id,width:'original',theme:'basic',weather:'clear',surface:'track'});settings.track=config;launchPlayground();
  },closeKit,{basicOnly:true});
  const savedDocument=readSavedEditorDocument(storage,playgroundOptions.trackId);
  if(savedDocument)workbench.loadDocument(savedDocument);
  $('track-kit-overlay').classList.remove('hidden');workbench.mount($('track-kit-content'));
  applyGraphics();
  for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=true;
  $('track-kit-content').querySelector('[data-kit="close"]').focus();
}
function closeKit() {
  const open=workbench?.visible;$('track-kit-overlay').classList.add('hidden');workbench?.hide();
  if(open){
    if(workbench.document.value.pieces.length){playgroundOptions.trackId=savedEditorTrackId(workbench.document.value);playgroundOptions.width='original';savePlayground(storage,playgroundOptions);}
    for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=false;refreshPlayground();if(kitFocus?.isConnected)kitFocus.focus();}
}
function inspectVehicle(id) {
  garage.select(id); updateGarage();
}
function updateGarage() {
  const focused=document.activeElement?.dataset.inspect;
  $('garage-detail').innerHTML=renderGarageDetail(null,garage.selectedId,garage.mode,garage.modelData.get(garage.selectedId)?.customization,{testing:true});
  $('collection-roster').innerHTML=renderGarageRoster(null,garage.selectedId,garage.page,true);
  for(const button of document.querySelectorAll('[data-collection-page]'))button.setAttribute('aria-pressed',String(button.dataset.collectionPage===garage.page));
  $('collection-edition-label').textContent=garage.page==='originals'?'MINIATURE SERIES · 01':`TANDA 0${VEHICLES.find(v=>v.id===garage.selectedId).batchIndex+1} · 10 MODELOS`;
  $('garage-content').scrollTop=0;
  for(const button of document.querySelectorAll('[data-inspect]')) {
    const selected=button.dataset.inspect===garage.selectedId;
    button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
  }
  for(const button of document.querySelectorAll('.collection-view-switch [data-garage-view]'))button.setAttribute('aria-pressed',String(button.dataset.garageView===garage.mode));
  if(focused){const button=$('collection-roster').querySelector(`[data-inspect="${focused}"]`);button?.focus({preventScroll:true});button?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}
  updateInputPrompts();
}

function updateOptions() {
  $('track-name').textContent=settings.track.name;
  const label=settings.surface==='track'?(settings.track.zones.length?'Trazado mixto':'Asfalto'):SURFACES[settings.surface].name;
  $('conditions-label').textContent=`${settings.vehicle.name} · ${label} · ${WEATHER[settings.weather].name}`;
  $('difficulty').textContent=settings.track.difficulty.toUpperCase();
  $('track-length').textContent=`${(circuit.length/1000).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})} km`;
  const competing=settings.mode==='race';
  document.body.dataset.mode=settings.mode;
  $('camera-label').textContent=settings.camera==='chase'?'3ª persona':'Aérea';
  $('camera-btn').setAttribute('aria-label',`Cámara ${settings.camera==='chase'?'tercera persona':'aérea'}, cambiar con C`);
  $('session-kind').innerHTML=competing?`<i></i> CARRERA IA · ${race.count} COCHES`:'<i></i> PRUEBAS DE CONDUCCIÓN';
  $('intro-kicker').textContent=competing?`PARRILLA IA · ${race.lapCount} VUELTAS`:'ENTRENAMIENTO LIBRE';
  $('intro-title').textContent=settings.track.name;$('intro-description').textContent=settings.track.subtitle;
  $('intro-targets').innerHTML=competing?`<div class="race-briefing"><span><strong>${race.count}</strong>COCHES</span><span><strong>${race.lapCount}</strong>VUELTAS</span><span><strong>${race.interaction==='ghost'?'◇':'↔'}</strong>${race.interaction==='ghost'?'GHOSTS':'CONTACTO'}</span></div>`:`<span class="practice-note">${ghostLap?`Compite contra el fantasma de tu mejor vuelta · ${formatTime(ghostLap.duration)}.`:'Completa una vuelta para crear tu fantasma. Tu mejor trazada se guarda automáticamente.'}</span>`;
  $('intro-car').innerHTML=`${carIllustration(settings.vehicle)}<span><strong>${settings.vehicle.name}</strong>${settings.vehicle.description}</span>`;
  startButton.innerHTML=competing?'Tomar la salida <span>↗</span>':'Salir a pista <span>↗</span>';
  $('intro-race-btn').classList.remove('hidden');$('intro-race-btn').textContent=competing?'Configurar parrilla →':'Competir contra IA →';
  document.querySelector('.current-time>.tiny-label').textContent=competing?'TIEMPO DE CARRERA':'TIEMPO ACTUAL';
}

function clearPointers(){touchControls?.clear();mouseControls?.clear();pointers.clear();}
function setState(next) {
  if(next!=='hub'&&garageSurface==='home'){garage?.hide();garageSurface=null;}
  state=next;document.body.dataset.state=next;
  if(next==='running')performanceStats.reset();
  $('intro').classList.toggle('hidden',next!=='ready');
  $('playground-hub').classList.toggle('hidden',next!=='hub'&&next!=='loading');
  $('driving-status').classList.toggle('hidden',next!=='running');
  $('pause-overlay').classList.toggle('hidden',next!=='paused');
  $('countdown').classList.toggle('hidden',next!=='countdown');
  $('result-overlay').classList.toggle('hidden',next!=='finished');
  $('race-hud').classList.toggle('hidden',!race||!['countdown','running','paused','finished'].includes(next));
  $('pause-btn').setAttribute('aria-label',next==='paused'?'Continuar':'Pausar');$('pause-btn').textContent=next==='paused'?'▷':'Ⅱ';
  $('end-session-btn').textContent=race?'Retirarse y ver tiempos':'Finalizar y ver tiempos';$('end-session-btn').disabled=(race?race.elapsed:laps?.elapsed||0)<=0;
  $('footer-label').textContent=next==='running'?`${settings.vehicle.name.toUpperCase()} · TU SIGUIENTE CURVA`:'BUSCA TU PROPIA TRAZADA';
  audio.update(drive?.speed||0,next==='running');keys.clear();clearPointers();
  updateInputPrompts();if(next==='hub')mountHomeGarage();
}
function makeSession(rebuild) {
  stopResultCalculation();
  world.setVehicle(settings.vehicle);
  if(rebuild||!circuit){
    circuit=new Circuit(settings.track);world.build(circuit,settings.surface,settings.weather);
    const xs=circuit.samples.map(p=>p.x),zs=circuit.samples.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
    const scale=Math.min(290/(maxX-minX),180/(maxZ-minZ));mapProjection={minX,minZ,scale,dx:(360-(maxX-minX)*scale)/2,dz:(250-(maxZ-minZ)*scale)/2};
    cacheMap();
  }else world.setConditions(settings.surface,settings.weather);
  race=settings.mode==='race'?new RaceSession(circuit,settings.vehicle,settings.raceRules):null;
  drive=race?race.player.drive:new DriveModel(circuit,settings.vehicle);laps=new LapTracker();finishedTime=null;world.setRivals(race);
  timingContext=resultContext(settings,circuit);
  resetGhost();world.setGhost(!race);
  world.cameraReady=false;world.resetDrivingEffects();simulationClock.reset();readBest();updateOptions();setState('ready');updateHUD();drawMap();
}
function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');toastTime=3.2;}
function start(){if(state!=='ready')return;setState('countdown');countdown=3;$('countdown').textContent='3';}
function reset(startAgain=true){if(!drive||state==='loading'||state==='hub')return;stopResultCalculation();if(race)race.reset();else drive.reset(circuit);laps.reset();finishedTime=null;resetGhost();readBest();world.cameraReady=false;world.resetDrivingEffects();simulationClock.reset();setState('ready');updateHUD();drawMap();if(startAgain)start();}

function resetGhost(){
  ghostRecorder=new GhostRecorder(drive);
  ghostLap=race?null:ghostRecords.get(timingContext);
}
function recordGhost(elapsed,crossing){
  const recorded=ghostRecorder.step(elapsed,drive,crossing);
  if(recorded&&ghostRecords.recordLap(timingContext,recorded)&&!race)ghostLap=recorded;
}
function pause(){if(state==='running')setState('paused');else if(state==='paused')setState('running');else if(state==='countdown')setState('ready');}
function toggleCamera(){settings.camera=settings.camera==='topdown'?'chase':'topdown';playgroundOptions.camera=settings.camera;savePlayground(storage,playgroundOptions);$('camera-label').textContent=settings.camera==='chase'?'3ª persona':'Aérea';$('camera-btn').setAttribute('aria-label',`Cámara ${settings.camera==='chase'?'tercera persona':'aérea'}, cambiar con C`);if(state==='hub')refreshPlayground();}

function stopResultCalculation(){leaderboardAbort?.abort();leaderboardAbort=null;activeReport=null;}
function paintResult(resetScroll=false){
  if(!activeReport)return;
  const scroll=$('result-content').querySelector('.report-body')?.scrollTop||0;
  $('result-content').innerHTML=renderSessionResult(activeReport);
  $('result-content').querySelector('.report-body').scrollTop=resetScroll?0:scroll;
}
function calculateRanking(report){
  leaderboardAbort?.abort();leaderboardAbort=new AbortController();report.leaderboard={status:'loading',entries:[]};
  loadAILeaderboard(report.context,{storage,signal:leaderboardAbort.signal}).then(entries=>{
    if(activeReport!==report)return;report.leaderboard={status:'ready',entries};if(report.tab==='ranking')paintResult();
  }).catch(error=>{if(error.name==='AbortError'||activeReport!==report)return;report.leaderboard={status:'error',error:error.message,entries:[]};if(report.tab==='ranking')paintResult();});
}
function showTimingResults(complete){
  const totalTime=race?(race.player.finishTime??race.elapsed):laps.elapsed;if(totalTime<=0)return;
  const lapTimes=race?race.player.tracker.lapTimes:laps.lapTimes;
  const racers=race?race.standings().map(r=>({id:r.id,name:r.name,isPlayer:r.isPlayer,level:r.level,finishTime:r.finishTime})):[];
  activeReport=createReport({context:timingContext,lapTimes,totalTime,complete,position:race?.position,racers,records:resultRecords,previousBestLap:previousPersonalLap});
  finishedTime=totalTime;best=activeReport.personalBest;$('best-time').textContent=formatTime(best);
  $('result-content').classList.remove('race-result-modal');$('result-content').classList.add('session-result-modal');
  $('result-overlay').setAttribute('aria-label','Tiempos y clasificación');paintResult(true);setState('finished');updateHUD();
  $('result-content').querySelector('h2').focus({preventScroll:true});calculateRanking(activeReport);
}
function finish(lap){
  if(race){showTimingResults(true);return;}
  resultRecords.recordLap(timingContext,lap);
  const newRecord=best==null||lap<best;
  if(newRecord){best=lap;try{storage?.setItem(recordKey(),String(lap));}catch{}$('best-time').textContent=formatTime(best);}
  const ghostNote=ghostLap?.duration===lap?(ghostRecords.saveAvailable?' · fantasma guardado':' · fantasma solo en esta sesión'):'';
  toast(`${newRecord?'✦ Nuevo récord':'Vuelta completada'} · ${formatTime(lap)}${ghostNote}`);
}

function updateHUD(){
  $('lap-number').textContent=race?`${race.player.tracker.lapNumber(race.lapCount)}/${race.lapCount}`:String(laps.lap).padStart(2,'0');
  $('lap-time').textContent=formatTime(finishedTime??(race?race.elapsed:laps.time));
  if(race)$('race-hud').innerHTML=renderRaceHUD(race);
  $('speed').textContent=String(Math.round(drive.speed*3.6)).padStart(3,'0');
  const surface=circuit.surfaceAt(drive.road.progress,settings.surface);
  $('speed-fill').style.width=`${Math.min(100,drive.speed/(SURFACES[surface].speed*settings.vehicle.speed*PACES[settings.pace].speed)*100)}%`;
  $('last-time').textContent=laps.last?`Última: ${formatTime(laps.last)}`:'Primera vuelta pendiente';
  $('ghost-status').hidden=Boolean(race);
  $('ghost-status').textContent=ghostLap?`◇ TU FANTASMA · ${formatTime(ghostLap.duration)}`:'◇ FANTASMA: COMPLETA UNA VUELTA';
  $('ghost-status').title=ghostLap?(ghostRecords.saveAvailable?'Tu mejor vuelta guardada en este navegador.':'Fantasma disponible durante esta sesión; no se ha podido guardar.'):'Tu primera vuelta completa creará el fantasma automáticamente.';
  const wrongWay=race?race.player.tracker.wrongWay:laps.wrongWay;
  const status=$('driving-status');status.classList.toggle('warning',wrongWay||drive.impact>.15);
  status.classList.toggle('braking',drive.braking&&drive.grounded);
  $('drive-mode-label').textContent=drive.braking?'FRENO':'AUTO';
  const underpass=circuit.layout?.crossings.some(c=>drive.y<c.upperY-3&&Math.hypot(drive.x-c.x,drive.z-c.z)<circuit.config.width*.9);
  $('status-text').textContent=wrongWay?'SENTIDO CONTRARIO':!drive.grounded?'EN EL AIRE':drive.braking?'FRENANDO':drive.impact>.15?'ABRE LA TRAZADA':underpass?'PASO INFERIOR':drive.slip>.3?'DERRAPANDO':drive.y>4?'TRAMO ELEVADO':`${SURFACES[surface].name.toUpperCase()} · EN PISTA`;
}
function cacheMap(){
  mapBackground=document.createElement('canvas');mapBackground.width=360;mapBackground.height=250;
  const ctx=mapBackground.getContext('2d'),p=mapProjection,project=(x,z)=>[p.dx+(x-p.minX)*p.scale,p.dz+(z-p.minZ)*p.scale];
  ctx.clearRect(0,0,360,250);ctx.beginPath();circuit.samples.forEach((v,i)=>{const[x,y]=project(v.x,v.z);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.lineWidth=14;ctx.strokeStyle='#0077b51c';ctx.stroke();ctx.lineWidth=4;ctx.strokeStyle='#477394';ctx.stroke();
  for(const crossing of circuit.layout?.crossings||[]){const a=circuit.at(crossing.upperProgress-.015),b=circuit.at(crossing.upperProgress+.015);ctx.beginPath();ctx.moveTo(...project(a.x,a.z));ctx.lineTo(...project(b.x,b.z));ctx.lineWidth=11;ctx.strokeStyle='#19212c';ctx.stroke();ctx.lineWidth=5;ctx.strokeStyle='#009de2';ctx.stroke();}
  const start=circuit.at(0),[sx,sy]=project(start.x,start.z);ctx.beginPath();ctx.moveTo(sx-start.normal.x*9,sy-start.normal.z*9);ctx.lineTo(sx+start.normal.x*9,sy+start.normal.z*9);ctx.strokeStyle='#19212c';ctx.lineWidth=4;ctx.stroke();
}
function drawMap(){
  if(!preferences.showMinimap)return;
  const ctx=$('minimap').getContext('2d'),p=mapProjection,project=(x,z)=>[p.dx+(x-p.minX)*p.scale,p.dz+(z-p.minZ)*p.scale];
  ctx.clearRect(0,0,360,250);ctx.drawImage(mapBackground,0,0);
  for(const rival of race?.rivals||[]){const[x,y]=project(rival.drive.x,rival.drive.z);ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle=rival.color;ctx.fill();}
  const ghost=!race&&['countdown','running','paused'].includes(state)&&sampleGhost(ghostLap,laps.time);
  if(ghost){const[x,y]=project(ghost.x,ghost.z);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.strokeStyle='#0077b5';ctx.lineWidth=1.5;ctx.stroke();}
  const[x,y]=project(drive.x,drive.z);ctx.save();ctx.translate(x,y);ctx.rotate(-drive.heading);ctx.beginPath();ctx.moveTo(0,9);ctx.lineTo(-6,-5);ctx.lineTo(6,-5);ctx.closePath();ctx.fillStyle=settings.vehicle.color;ctx.fill();ctx.restore();
}

function setupInput(){
  window.addEventListener('keydown',e=>{
    if(preferencesOpen){
      if(e.code==='Escape'){e.preventDefault();closePreferences();}
      if(e.code==='Tab'){const items=[...$('preferences-content').querySelectorAll('button:not(:disabled),select')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(state==='finished'){
      if(e.code==='Escape'){e.preventDefault();showHub();}
      if(e.code==='Tab'){const items=[...$('result-content').querySelectorAll('button:not(:disabled),[tabindex="0"]')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(workbench?.visible){
      if(workbench.handleKey(e))return;
      if(e.code==='Tab'){const buttons=[...$('track-kit-content').querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled):not([hidden]),summary,canvas')].filter(el=>el.getClientRects().length),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(['INPUT','SELECT','TEXTAREA','SUMMARY'].includes(document.activeElement?.tagName))return;
    if(!$('garage-overlay').classList.contains('hidden')){
      if(e.code==='Escape'){e.preventDefault();cancelGarage();}
      if(e.code==='Tab'){
        const buttons=[...$('garage-content').querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
      return;
    }
    if(state==='hub'||state==='loading')return;
    if(['ArrowLeft','ArrowRight','ArrowDown','Space','KeyA','KeyD','KeyS','KeyC','KeyR','Escape','Enter'].includes(e.code)){
      if(['Enter','Space'].includes(e.code)&&document.activeElement?.tagName==='BUTTON')return;
      e.preventDefault();if(!e.repeat){if(e.code==='KeyC')toggleCamera();if(e.code==='KeyR')reset();if(e.code==='Space'||e.code==='Escape')pause();if(e.code==='Enter')start();}keys.add(e.code);
    }
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  const blur=()=>{keys.clear();clearPointers();if(state==='running')setState('paused');if(state==='countdown')setState('ready');};
  window.addEventListener('blur',blur);document.addEventListener('visibilitychange',()=>{if(document.hidden)blur();});
  touchControls=bindTouchSteering($('touch-steering'),pointers,()=>state==='running',()=>preferences);
  mouseControls=bindMouseDriving($('game'),pointers,()=>state==='running');
  window.addEventListener('resize',()=>{clearPointers();applyGraphics();syncPlaygroundScroll();});
  $('playground-hub').addEventListener('scroll',syncPlaygroundScroll,true);
  $('playground-hub').addEventListener('toggle',()=>requestAnimationFrame(syncPlaygroundScroll),true);
  document.fonts.ready.then(syncPlaygroundScroll);
  $('start-btn').addEventListener('click',start);$('camera-btn').addEventListener('click',toggleCamera);$('hub-btn').addEventListener('click',showHub);$('intro-back').addEventListener('click',showHub);$('pause-hub-btn').addEventListener('click',showHub);
  $('end-session-btn').addEventListener('click',()=>{if(state==='paused')showTimingResults(false);});
  $('intro-race-btn').addEventListener('click',()=>{playgroundOptions.mode='race';savePlayground(storage,playgroundOptions);showHub();});
  for(const id of['reset-btn','restart-pause-btn'])$(id).addEventListener('click',()=>reset());$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',()=>setState('running'));
  $('preferences-btn').addEventListener('click',openPreferences);$('pause-preferences-btn').addEventListener('click',openPreferences);
  $('preferences-overlay').addEventListener('click',e=>{
    if(e.target===$('preferences-overlay')||e.target.closest('[data-preferences-close]')){closePreferences();return;}
    if(e.target.closest('[data-sound-toggle]'))toggleSound();
    const tab=e.target.closest('[data-preferences-tab]')?.dataset.preferencesTab;if(tab){preferencesTab=tab;paintPreferences();$('preferences-content').querySelector(`[data-preferences-tab="${tab}"]`).focus();}
    const preset=e.target.closest('[data-graphics-preset]')?.dataset.graphicsPreset;if(preset){changePreferences(selectGraphicsPreset(preferences,preset));$('preferences-content').querySelector(`[data-graphics-preset="${preset}"]`).focus();}
    const mode=e.target.closest('[data-touch-mode]')?.dataset.touchMode;if(mode){changePreferences({...preferences,touchMode:mode});$('preferences-content').querySelector(`[data-touch-mode="${mode}"]`).focus();}
  });
  $('preferences-overlay').addEventListener('change',e=>{const key=e.target.dataset.preference;if(!key)return;const value=['samples','sensitivity','targetFPS'].includes(key)?Number(e.target.value):typeof preferences[key]==='boolean'?e.target.value==='true':e.target.value;changePreferences({...preferences,[key]:value});$('preferences-content').querySelector(`[data-preference="${key}"]`)?.focus();});
  $('playground-hub').addEventListener('click',e=>{
    const mode=e.target.closest('[data-play-mode]');if(mode){playgroundOptions.mode=mode.dataset.playMode;savePlayground(storage,playgroundOptions);refreshPlayground();hubFocusMode(mode.dataset.playMode);}
    const action=e.target.closest('[data-play-action]')?.dataset.playAction;
    if(action==='garage')openGarage();if(action==='kit')openKit();if(action==='preferences')openPreferences();
  });
  $('playground-hub').addEventListener('change',e=>{
    const key=e.target.dataset.playground;if(!key)return;
    const value=['width','count','laps'].includes(key)&&e.target.value!=='original'?Number(e.target.value):e.target.value;
    Object.assign(playgroundOptions,normalizePlayground({...playgroundOptions,[key]:value},playgroundTracks(settings.track,storage)));
    if(key==='trackId'&&resolvePlayground(playgroundOptions,playgroundTracks(settings.track,storage)).error)playgroundOptions.width='original';
    savePlayground(storage,playgroundOptions);refreshPlayground();$('playground-hub').querySelector(`[data-playground="${key}"]`)?.focus();
  });
  $('playground-hub').addEventListener('submit',e=>{e.preventDefault();launchPlayground();});
  $('garage-overlay').addEventListener('click',e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action==='close-garage'||e.target===$('garage-overlay')){cancelGarage();return;}
    const page=e.target.closest('[data-collection-page]');if(page){garage.showPage(page.dataset.collectionPage);updateGarage();}
    const inspect=e.target.closest('[data-inspect]');if(inspect)inspectVehicle(inspect.dataset.inspect);
    const view=e.target.closest('[data-garage-view]');if(view){garage.setView(view.dataset.garageView);updateGarage();}
    const pilot=e.target.closest('[data-pilot]');if(pilot&&!pilot.disabled)selectVehicle(pilot.dataset.pilot);
  });
  $('garage-overlay').addEventListener('focusin',e=>{
    const id=e.target.dataset.inspect;if(id&&garage?.selectedId!==id)inspectVehicle(id);
  });
  $('garage-overlay').addEventListener('dblclick',e=>{const id=e.target.closest('[data-inspect]')?.dataset.inspect;if(id)selectVehicle(id);});
  $('garage-overlay').addEventListener('input',e=>{
    const key=e.target.dataset.custom;if(!key)return;
    const value=key==='glassOpacity'?Number(e.target.value):e.target.value;
    const saved=garage.customize({[key]:value});
    $('workshop-status').textContent=saved?'Ajustes guardados en este navegador.':'Ajustes aplicados durante esta sesión.';
  });
  $('garage-overlay').addEventListener('change',async e=>{
    if(e.target.id!=='vehicle-wrap-file')return;
    try{await garage.uploadWrap(e.target.files[0]);if($('workshop-status'))$('workshop-status').textContent='Textura UV aplicada durante esta sesión.';}catch(error){if($('workshop-status'))$('workshop-status').textContent=error.message;}
  });
  $('result-overlay').addEventListener('click',e=>{
    if(!activeReport)return;
    const tab=e.target.closest('[data-results-tab]')?.dataset.resultsTab,metric=e.target.closest('[data-results-metric]')?.dataset.resultsMetric;
    if(['times','ranking','field'].includes(tab)){activeReport.tab=tab;paintResult(true);$('result-content').querySelector(`[data-results-tab="${tab}"]`).focus({preventScroll:true});}
    if(['lap','total'].includes(metric)){activeReport.metric=metric;paintResult(true);$('result-content').querySelector(`[data-results-metric="${metric}"]`).focus({preventScroll:true});}
    if(e.target.closest('[data-results-reload]')){calculateRanking(activeReport);paintResult(true);}
    const action=e.target.closest('[data-result]')?.dataset.result;if(action==='hub')showHub();if(action==='retry')reset();
  });
}

function frame(now){
  if(document.hidden){lastFrame=now;requestAnimationFrame(frame);return;}
  if(!['running','countdown'].includes(state)&&!workbench?.visible&&now-lastFrame<1000/(garage?.visible?60:30)){requestAnimationFrame(frame);return;}
  const cpuStart=performance.now(),rawDt=(now-lastFrame)/1000,dt=Math.min(rawDt,.25);lastFrame=now;
  pollGamepad(now,dt);
  if(state==='countdown'){countdown-=dt;$('countdown').textContent=countdown>0?String(Math.ceil(countdown)):'';if(countdown<=0){setState('running');toast(matchMedia('(pointer:coarse),(max-width:760px),(max-width:1000px) and (max-height:500px)').matches?'¡A rodar!':'¡A rodar! ← → para girar');}}
  if(state==='running'){
    const input=inputDevice==='gamepad'&&gamepadState?{steer:gamepadState.steer,brake:gamepadState.brake>.05?gamepadState.brake:0,throttle:gamepadState.throttle}:readDrivingInput(keys,pointers),steps=simulationClock.advance(dt);
    for(let i=0;i<steps;i++){
      if(race){
        const previous=race.player.tracker.lapTimes.length,done=race.step(FIXED_STEP,input,settings.surface,settings.weather,settings.pace);
        const completed=race.player.tracker.lapTimes.length>previous;
        recordGhost(race.elapsed,completed?race.player.tracker.lapStartedAt:null);
        if(completed)resultRecords.recordLap(timingContext,race.player.tracker.lapTimes.at(-1));
        if(done){finish(race.player.finishTime);break;}
      }
      else{
        drive.step(FIXED_STEP,input.steer,settings.surface,settings.weather,settings.pace,input.brake,input.throttle??1);
        if(drive.respawned){laps.rewind(drive.road.progress);toast('No has alcanzado la recepción · Reintenta el salto con más velocidad');}
        const lap=laps.step(FIXED_STEP,drive.road.progress);
        recordGhost(laps.elapsed,lap?laps.lapStartedAt:null);
        if(lap){finish(lap);if(state!=='running')break;}
      }
    }
  }
  if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.add('hidden');}
  uiTimer+=dt;if(uiTimer>1/20){if(['running','countdown'].includes(state)){updateHUD();drawMap();}updatePreferencesReadout();uiTimer=0;}
  audio.update(drive.speed,state==='running');const renderDrive=drive.interpolated(state==='running'||state==='paused'?simulationClock.alpha:1);
  if(workbench?.visible)workbench.update(dt);
  else if(garage?.visible)garage.update(dt);
  else {
    const ghostTime=state==='running'||state==='paused'?Math.max(0,laps.time-FIXED_STEP*(1-simulationClock.alpha)):0;
    world.ghost?.update(ghostLap,ghostTime,['countdown','running','paused'].includes(state));
    world.update(dt,renderDrive,settings.camera,state==='running',state!=='paused',state==='running'||state==='paused'?simulationClock.alpha:1);
    const ratio=state==='running'?resolution.sample(rawDt):resolution.ratio;if(Math.abs(world.renderer.getPixelRatio()-ratio)>.01)world.renderer.setPixelRatio(ratio);
  }
  if(state==='running')performanceStats.sample(rawDt,performance.now()-cpuStart,workbench?.visible?workbench.renderer:garage?.visible?garage.renderer:world.renderer);
  requestAnimationFrame(frame);
}
async function init(){
  try{
    setupInput();applyHUDPreferences();updateTouchGuide();refreshPlayground();world=new World($('game'),graphicsPolicy(preferences,devicePixelRatio));applyGraphics();await world.loadCar(settings.vehicle);makeSession(true);startButton.disabled=false;
    $('loading-status').textContent=innerWidth<=760?'Mitad inferior izquierda / derecha · Ambas: freno':'← → / A D girar · Ambas: frenar · R reintentar';refreshPlayground();setState('hub');brandUI.setReady();lastFrame=performance.now();requestAnimationFrame(frame);
  }catch(error){brandUI.dismiss();console.error(error);$('fatal-error').classList.remove('hidden');$('error-message').textContent=`No se ha podido preparar la carrera. ${error.message}`;}
}
init();
