import {gameAudioScene} from './music-library.js';
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
import './race-identifiers.css';
import './mobile-gameplay.css';
import './results.css';
import './ghost.css';
import './preferences.css';
import './prl-theme.css';
import './camera-controls.css';
import './club-ui.css';
import './studio-ui.css';
import './styled-select.css';
import { initStyledSelects,enhanceStyledSelects,closeStyledSelect,styledSelectOpen,styledSelectRoot } from './styled-select.js';
import { clubIcon,clubWordmark } from './club-ui.js';
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
import { cameraView,nextCameraMode } from './camera-views.js';
import { EngineAudio } from './audio.js';
import {renderAudioSettings,AUDIO_LEVELS} from './audio-settings-ui.js';
import './audio-settings.css';
import './pause-menu.css';
import './test-pilot.css';
import './league.css';
import './economy.css';
import {upgradedVehicle,freeRacePrizes,isFreeRaceEligible} from './economy-config.js';
import {EconomyCelebration} from './economy-celebration.js';
import {League,eventById} from './league.js';
import {renderLeague,renderReward} from './league-ui.js';
import {vehiclePowerClass} from './vehicle-regulations.js';
import {TestPilot,testPilotEnabled,testSessionStorage} from './test-pilot.js';
import { PerformanceStats, AdaptiveResolution } from './performance.js';
import { FixedStepClock, FIXED_STEP } from './timing.js';
import { GhostRecords, GhostRecorder, sampleGhost } from './ghost.js';

import { renderGarage,updateStudioDetail,renderStudioPanel } from './vehicle-collection-ui.js';
import { renderPlayground,renderHomeCarLink } from './playground-ui.js';
import { loadPlayground,savePlayground,normalizePlayground,resolvePlayground,playgroundTracks } from './playground.js';
import { carIllustration, preloadVehicles,vehicleAvailable } from './vehicles.js';
import { renderRaceSetup,SETUP_STEPS } from './race-setup-ui.js';
import { availableEligibleVehicles } from './vehicle-regulations.js';
import { readDrivingInput,bindTouchSteering,bindMouseDriving } from './input.js';
import {GamepadReader,createMenuNavigation} from './gamepad.js';
import { RaceSession,raceGridVehicles } from './race.js';
import { readSavedEditorDocument,savedEditorTrackId } from './track-editor-state.js';
import {findBundledEditorTrack} from './community-tracks.js';
import { renderRaceHUD } from './race-ui.js';

const $ = id => document.getElementById(id);
const brandUI=mountBrandUI();
initStyledSelects();
const icons = {
  camera: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 4L5.5 6H3.5A1.5 1.5 0 002 7.5v7A1.5 1.5 0 003.5 16h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0016.5 6H14l-1-2H7Z" stroke="currentColor" stroke-width="1.3"/><circle cx="10" cy="10.5" r="3" stroke="currentColor" stroke-width="1.3"/></svg>',
};
const testingWithAI=testPilotEnabled(location.search);
let testPilot=null;
let storage;
try { storage = localStorage; } catch { storage = null; }
if(testingWithAI){storage=testSessionStorage(storage);const badge=document.createElement('div');badge.id='test-pilot-status';badge.textContent='PRUEBA IA · SIN GUARDAR';badge.setAttribute('role','status');document.body.append(badge);}
const playgroundOptions=loadPlayground(storage);
const league=new League(storage,{legacyVehicle:playgroundOptions.vehicleId});
let leaguePage='home',leagueSelection=null,leagueMessage='',leagueAttempt=null,rankingMetric='xp',rankingTrack='all';
let leagueOrigin='home',workshopLoaner=null,economyBusy=false,resultsSettling=false,eventPreparation=null,preferencesSetupReturn=null,leagueReturn=null;
let historyGuard=false,historyRemoving=false;
function canNavigateBack(){return celebration.visible||preferencesOpen||fullGarage()||workbench?.visible||setupOpen||['finished','ready','paused'].includes(state)||state==='hub'&&(leagueSelection||leaguePage!=='home');}
function syncNavigation(){
 queueMicrotask(()=>{if(historyRemoving)return;const needed=canNavigateBack();if(needed&&!historyGuard){history.pushState({prlOverlay:true},'');historyGuard=true;}else if(!needed&&historyGuard){historyRemoving=true;historyGuard=false;history.back();}});
}
window.addEventListener('popstate',()=>{historyGuard=false;if(historyRemoving){historyRemoving=false;return;}if(canNavigateBack())backFromMenu();syncNavigation();});
function raceSetupVehicles(){const e=eventPreparation&&league.event(eventPreparation.id),run=league.state.run;return e?.loaner?VEHICLES.filter(v=>v.id===e.loaner):VEHICLES.filter(v=>league.owns(v.id)&&(!eventPreparation||!run||v.id===run.vehicleId));}
function rememberLeagueOrigin(selector){leagueOrigin=leaguePage;leagueReturn={scroll:$('playground-hub').scrollTop,selector};}
function leaveLeagueDetail(){leaguePage=leagueOrigin;leagueSelection=null;refreshPlayground();if(leagueReturn){$('playground-hub').scrollTop=leagueReturn.scroll;document.querySelector(leagueReturn.selector)?.focus({preventScroll:true});}}
function prepareLeague(id){
 const e=league.event(id),run=league.state.run?.eventId===id?league.state.run:null;
 eventPreparation={id,revision:league.state.revision};workshopLoaner=null;leagueAttempt=null;
 Object.assign(playgroundOptions,{trackId:run?.qualifying?e.qualifiers[run.stage]:e.qualifiers&&!run?e.qualifiers[0]:e.kind==='duel'?e.tracks[league.state.stats.races%e.tracks.length]:e.tracks[run?.stage||0],vehicleId:e.loaner||run?.vehicleId||$('league-event-car')?.value||playgroundOptions.vehicleId,mode:run?.qualifying||e.qualifiers&&!run||e.kind==='challenge'?'practice':'race',laps:run?.qualifying||e.qualifiers&&!run||e.kind==='challenge'?1:e.laps,count:e.kind==='duel'?2:4,carCategory:e.category,difficulty:['novice','club','expert'][e.tier],width:'original',weather:'clear',surface:'track',pace:'normal',interaction:'ghost',fieldLevels:'uniform'});
 showSetup('circuit');
}
const celebration=new EconomyCelebration({thumbnail:async id=>(await getGarage()).thumbnail(id),onNavigate:page=>{leaguePage=page;leagueSelection=null;showHub();},sound:()=>audio.ui('confirm'),onStateChange:()=>syncNavigation()});
async function economyAction(fn){
 if(economyBusy)return;economyBusy=true;
 try{const receipt=await league.execute(fn);refreshPlayground();if(receipt?.id)celebration.show(receipt,{animations:league.state.animations,saved:league.saved});}
 catch(error){leagueMessage=error.message;refreshPlayground();}finally{economyBusy=false;}
}

if(!league.owns(playgroundOptions.vehicleId))playgroundOptions.vehicleId=league.state.owned[0];
playgroundOptions.ownedVehicleIds=league.state.owned;
const linkedTrack=new URLSearchParams(location.search).get('track');
if(linkedTrack&&playgroundTracks(undefined,storage).some(track=>track.id===linkedTrack))Object.assign(playgroundOptions,{trackId:linkedTrack,width:'original'});
let preferences=loadPreferences(storage),preferencesOpen=false,preferencesTab='graphics',preferencesFocus,preferencesContext='settings';
let setupOpen=false,setupFocus,setupStep='circuit',thumbnailRequest=0,raceLaunching=false;
let lastGarageVehicle=null,garagePanel=null;
const resultRecords=new ResultRecords(storage);
const ghostRecords=new GhostRecords(storage);
let ghostRecorder,ghostLap=null;
const initialPlayground=resolvePlayground(playgroundOptions,playgroundTracks(undefined,storage));
const settings=(initialPlayground.error?resolvePlayground({}):initialPlayground).settings;
let world, circuit, drive, laps, best = null, state = 'loading', countdown = 0, toastTime = 0, finishedTime = null;
let lastFrame = performance.now(), uiTimer = 0, mapProjection, mapBackground, mapPalette, modalFocus, garage;
let workbench,kitFocus,touchControls,mouseControls,garageContext='session',garageSurface=null;
let timingContext,previousPersonalLap=null,activeReport=null,leaderboardAbort;
let garageLoading=false,kitLoading=false;
let vehicleLoadRequest=0;
let race=null;
const keys = new Set(), pointers = new Map(), audio = new EngineAudio();
audio.setOptions(preferences);
let audioInput='pointer';
window.addEventListener('pointerdown',()=>{audioInput='pointer';audio.unlock({scene:audioScene()});},{capture:true,passive:true});
window.addEventListener('keydown',e=>{audioInput='keyboard';if(!e.repeat)audio.unlock({scene:audioScene()});},true);
document.addEventListener('visibilitychange',()=>audio.setHidden(document.hidden));
document.addEventListener('focusin',e=>{if((audioInput==='keyboard'||inputDevice==='gamepad')&&e.target.matches('button,select,summary,input'))audio.ui('navigate');});
document.addEventListener('click',e=>{const b=e.target.closest('button,summary');if(!b||b.disabled||b.closest('#touch-steering'))return;const action=b.dataset.action||b.dataset.raceAction||b.dataset.editorAction||b.dataset.result||b.dataset.kit;const back=/close|back|cancel/.test((b.id+' '+Object.keys(b.dataset).join(' ')).toLowerCase())||['close','close-garage','hub','cancel-place'].includes(action);audio.ui(back?'back':'confirm');},true);
document.addEventListener('input',e=>{
  const key=e.target.dataset.audioLevel;if(!AUDIO_LEVELS.some(([id])=>id===key))return;
  preferences=normalizePreferences({...preferences,[key]:Number(e.target.value)/100});audio.setOptions(preferences);savePreferences(storage,preferences);
  e.target.closest('label').querySelector('output').textContent=`${Math.round(preferences[key]*100)}%`;audio.ui('navigate');
});

const performanceStats = new PerformanceStats(), simulationClock = new FixedStepClock(), resolution = new AdaptiveResolution(devicePixelRatio,graphicsPolicy(preferences,devicePixelRatio));
const startButton = $('start-btn'); startButton.disabled = true;
document.querySelector('.brand').innerHTML=clubWordmark();
$('preferences-btn').innerHTML=clubIcon('gear-six');
$('camera-icon').innerHTML = icons.camera;
const gamepadReader=new GamepadReader();
let gamepadState=null,padFamily='standard',inputDevice=matchMedia('(pointer:coarse)').matches?'touch':'keyboard';
const inputPrompts=document.createElement('div');inputPrompts.id='game-input-prompts';inputPrompts.className='game-input-prompts';document.body.append(inputPrompts);
function fullGarage(){return !$('garage-overlay').classList.contains('hidden');}
function menuRoot(){
  if(celebration.visible)return celebration.dialog;
  if(styledSelectRoot())return styledSelectRoot();
  if(!$('prl-splash').hidden)return $('prl-splash');
  if(preferencesOpen)return $('preferences-content');
  if(fullGarage())return $('garage-content');
  if(workbench?.visible)return $('track-kit-content');
  if(setupOpen)return $('club-setup');
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
  if(testingWithAI){inputPrompts.textContent='Prueba IA · Esc: pausa · C: cámara';return;}
  inputPrompts.textContent=inputDevice==='gamepad'?'Stick Girar · R2 / RT Acelerar · L2 / LT Frenar · Options / Menu Pausa':inputDevice==='mouse'?'Mantén clic izquierdo y mueve para girar · Clic derecho: freno':inputDevice==='touch'?'':'← → / A D Girar · ↓ / S Frenar · Esc Pausa';
}
function setInputDevice(device,family){const changed=device!==inputDevice||family&&family!==padFamily;if(family)padFamily=family;if(!changed)return;inputDevice=device;updateInputPrompts();}
function backFromMenu(){
  audio.ui('back');
  if(celebration.visible){celebration.close();return;}
  if(styledSelectOpen()){closeStyledSelect(true);return;}
  if(!$('prl-splash').hidden){if(state!=='loading')brandUI.dismiss();return;}
  if(preferencesOpen){closePreferences();return;}
  if(fullGarage()){if(garagePanel)closeStudioPanel();else closeGarage();return;}
  if(workbench?.visible){closeKit();return;}
  if(setupOpen){backSetup();return;}
  if(state==='finished'||state==='ready'){showHub();return;}
  if(state==='hub'&&(leagueSelection||leaguePage!=='home')){if(leagueSelection)leaveLeagueDetail();else{leaguePage='home';refreshPlayground();}return;}
  if(state==='paused'){setState('running');return;}
  if(state==='running'||state==='countdown')pause();
}
const menuNavigation=createMenuNavigation({root:menuRoot,onBack:backFromMenu,onDevice:setInputDevice,
  onConfirm:()=>false,
  onTab:direction=>{
    if(fullGarage()){if(!garagePanel)inspectVehicle(garage.neighbor(direction));return;}
    const root=menuRoot(),selector=preferencesOpen?'[data-preferences-tab]':state==='finished'?'[data-results-tab]':state==='hub'?'.league-nav button':'[data-play-mode]';
    const tabs=[...root.querySelectorAll(selector)],index=tabs.findIndex(button=>button.getAttribute('aria-pressed')==='true'||button.hasAttribute('aria-current'));
    tabs[(index+direction+tabs.length)%tabs.length]?.click();
  }});
function pollGamepad(now,dt){
  let pads=[];try{pads=navigator.getGamepads?.()||[];}catch{/* Keyboard, mouse and touch remain available. */}
  const sample=gamepadReader.sample(pads,now);gamepadState=sample.pad;
  if(sample.disconnected&&inputDevice==='gamepad'&&['running','countdown'].includes(state)){setState('paused');toast('Mando desconectado · Carrera en pausa');}
  if(sample.active){setInputDevice('gamepad',sample.pad.family);audio.unlock({scene:audioScene()});}
  for(const action of sample.actions){
    if(action==='pause'){
      audio.ui('confirm');
      if(preferencesOpen)closePreferences();else if(fullGarage())closeGarage();else if(workbench?.visible)closeKit();
      else if(['running','paused','countdown'].includes(state))pause();else if(state==='hub')openPreferences();
      continue;
    }
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
  host.innerHTML=renderPreferences(preferences,preferencesTab,{soundEnabled:audio.enabled,profile:preferencesContext==='profile'});
  if(preferencesTab==='audio'){const settings=host.querySelector('.audio-settings');settings.insertAdjacentHTML('afterbegin','<div class="pause-music"><span class="pause-music-label">BANDA SONORA</span><p id="pause-current-music" aria-live="polite" aria-atomic="true">Sin canción seleccionada</p><button type="button" id="pause-next-music" class="text-button">Siguiente canción <span aria-hidden="true">→</span></button><small>Siguiente respeta los temas de esta pantalla</small><label class="pause-music-test"><input type="checkbox" id="pause-all-music"> Escuchar también lobby y resultados</label></div>' );settings.querySelector('#pause-next-music').addEventListener('click',()=>{audio.unlock({scene:audioScene()});audio.nextMusic({all:$('pause-all-music')?.checked===true});updatePauseMusic();});settings.querySelector('#pause-all-music').addEventListener('change',e=>{audio.setMusicScope({all:e.target.checked});updatePauseMusic();});updatePauseMusic();}
  const advanced=host.querySelector('.preferences-advanced');if(advanced&&open)advanced.open=true;
  host.querySelector('.preferences-body').scrollTop=scroll;updatePreferencesReadout();updateInputPrompts();
}
function openPreferences(context){
  if(!world||state==='loading'||preferencesOpen)return;
  preferencesContext=context==='profile'?'profile':'settings';
  if(preferencesContext==='profile')preferencesTab='game';
  preferencesSetupReturn=setupOpen?{step:setupStep,event:eventPreparation}:null;
  closeSetup(false);
  preferencesFocus=document.activeElement;if(state==='running')setState('paused');else if(state==='countdown')setState('ready');
  clearPointers();preferencesOpen=true;syncNavigation();paintPreferences();$('preferences-overlay').classList.remove('hidden');
  for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=true;
  $('preferences-content').querySelector('[data-preferences-close]').focus();
}
function closePreferences(){
  closeStyledSelect();
  preferencesOpen=false;syncNavigation();$('preferences-overlay').classList.add('hidden');
  for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=false;
  if(state==='paused')$('resume-btn').focus({preventScroll:true});
  else if(preferencesFocus?.isConnected&&preferencesFocus.getClientRects().length)preferencesFocus.focus();
  else if(state==='hub')$('playground-hub').querySelector('[data-play-action=preferences]')?.focus({preventScroll:true});
  if(preferencesSetupReturn){const origin=preferencesSetupReturn;preferencesSetupReturn=null;eventPreparation=origin.event;showSetup(origin.step);}
}
function changePreferences(next){
  const before=preferences;preferences=normalizePreferences(next);audio.setOptions(preferences);clearPointers();
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
function toggleSound(){
  preferences=normalizePreferences({...preferences,soundEnabled:!preferences.soundEnabled});audio.setOptions(preferences);if(preferences.soundEnabled)audio.unlock({scene:audioScene()});savePreferences(storage,preferences);
  if(preferencesOpen){paintPreferences();$('preferences-content').querySelector('[data-sound-toggle]')?.focus();}
  const button=$('pause-audio-settings')?.querySelector('[data-sound-toggle]');if(button){button.setAttribute('aria-pressed',String(preferences.soundEnabled));button.textContent=`Sonido: ${preferences.soundEnabled?'activado':'silenciado'}`;}
}
function audioScene(){
  return gameAudioScene({state,garageOpen:fullGarage(),editorOpen:workbench?.visible,track:settings.track,weather:settings.weather,mode:settings.mode});
}
function updatePauseMusic(){
  const track=audio.currentMusic,label=track?`${track.title} · Versión ${track.variant}`:'Sin canción seleccionada',node=$('pause-current-music');
  if(!node)return;
  if(node.textContent!==label)node.textContent=label;
  $('pause-next-music').disabled=!track;
}
function updateAudio(running=state==='running'){
  if(!drive||!circuit){audio.update({speed:0,running:false,scene:audioScene()});updatePauseMusic();return;}
  const progress=drive.road?.progress||0,roadWidth=circuit.widthAt(progress),edgeGap=roadWidth/2-Math.abs(drive.road?.offset||0);
  audio.update({speed:drive.speed,slip:drive.slip,impact:drive.impact,edgeHitId:drive.edgeHitId,edgeImpact:drive.edgeImpact,edgeScrape:drive.edgeScrape,edgePan:drive.edgePan,edgeTouching:drive.edgeTouching,landing:drive.landing,grounded:drive.grounded,
    surface:circuit.surfaceAt(progress,settings.surface),weather:settings.weather,wetness:settings.weather==='rain' ? .8 : settings.weather==='snow' ? .55 : 0,
    kerb:edgeGap<1.05&&edgeGap>.02,braking:drive.braking,throttle:inputDevice==='gamepad'&&gamepadState?gamepadState.throttle:1,running,scene:audioScene()});
  updatePauseMusic();
}

async function paintLeagueCollection(){
  const images=[...$('playground-hub').querySelectorAll('[data-league-thumbnail]')];
  const view=await getGarage();
  for(const image of images){if(!image.isConnected)return;try{const url=await view.thumbnail(image.dataset.leagueThumbnail);if(!image.isConnected)return;image.src=url;image.hidden=false;image.nextElementSibling.hidden=true;}catch{if(image.isConnected)image.nextElementSibling.textContent='Vista 3D disponible al abrir';}await new Promise(resolve=>setTimeout(resolve,0));}
}
async function launchLeague(id,quoteRevision,selectedVehicle){
  if(raceLaunching||economyBusy)return;economyBusy=true;workshopLoaner=null;
  try{
    const e=league.event(id),run=league.state.run;
    const chosen=e.loaner||(run?.eventId===id?run.vehicleId:selectedVehicle||$('league-event-car')?.value)||league.state.owned.find(id=>['any','same-model'].includes(e.category)||vehiclePowerClass(VEHICLES.find(v=>v.id===id))===e.category);
    leagueAttempt=await league.execute(()=>league.begin(id,chosen,{quoteRevision}));
    Object.assign(playgroundOptions,{vehicleId:leagueAttempt.vehicleId,trackId:leagueAttempt.trackId,mode:leagueAttempt.mode,laps:leagueAttempt.laps,count:leagueAttempt.count,carCategory:leagueAttempt.category,width:'original',theme:'basic',weather:'clear',surface:'track',pace:'normal',difficulty:leagueAttempt.difficulty,interaction:'ghost',fieldLevels:'uniform'});
    await launchPlayground();
  }catch(error){leagueMessage=error.message;refreshPlayground();}finally{economyBusy=false;}
}
function refreshPlayground(){
  if(garageSurface==='home'){garage?.hide();garageSurface=null;}
  const hub=$('playground-hub'),opened=[...hub.querySelectorAll('details[open]')].map(d=>d.className);
  const scroll=hub.querySelector('.setup-body:not(.hidden)')?.scrollTop||0;
  playgroundOptions.ownedVehicleIds=league.state.owned;
  hub.innerHTML=renderLeague({league,page:leaguePage,selection:leagueSelection,message:leagueMessage,rankingMetric,rankingTrack,options:playgroundOptions,tracks:playgroundTracks(settings.track,storage),ready:state!=='loading',step:setupStep});
  if(hub.querySelector('[data-league-thumbnail]'))paintLeagueCollection();
  for(const detail of hub.querySelectorAll('details'))detail.open=opened.includes(detail.className);
  const area=hub.querySelector('.setup-body:not(.hidden)');if(area)area.scrollTop=scroll;
  if(setupOpen)showSetup(setupStep,false);
  const vehicle=VEHICLES.find(v=>v.id===playgroundOptions.vehicleId);
  if(vehicle&&$('club-nav-car')){$('club-nav-car').querySelector('strong').textContent=vehicle.name;$('club-nav-car').querySelector('small').textContent='Tu miniatura';}
  updateInputPrompts();if(state==='hub'&&!setupOpen)mountHomeGarage();syncNavigation();
}
function syncPlaygroundScroll(){}
function hubFocusMode(mode){$('playground-hub').querySelector(`[data-play-mode="${mode}"]`)?.focus({preventScroll:true});}
function syncHomeCarSelection(){
  const vehicle=VEHICLES.find(v=>v.id===playgroundOptions.vehicleId),caption=document.querySelector('.club-home-car-link');
  if(vehicle&&caption)caption.outerHTML=renderHomeCarLink(vehicle);
}
function showSetup(step='circuit',focus=true){
  if(raceLaunching)return;
  const previousStep=setupStep,wasOpen=setupOpen;
  if(!setupOpen)setupFocus=document.activeElement;
  setupStep=SETUP_STEPS.includes(step)?step:'circuit';setupOpen=true;
  if(setupStep==='car'){
    const cars=availableEligibleVehicles(raceSetupVehicles(),playgroundOptions.carCategory);
    if(!cars.length){setupStep='rules';toast('No tienes coches de esta categoría. Elige otra o visita el garaje.');}
    else if(!cars.some(v=>v.id===playgroundOptions.vehicleId)){playgroundOptions.vehicleId=cars[0].id;savePlayground(storage,playgroundOptions);}
    syncHomeCarSelection();
  }
  playgroundOptions.ownedVehicleIds=raceSetupVehicles().map(v=>v.id);
  const sheet=$('club-setup');if(!sheet)return;
  sheet.outerHTML=renderRaceSetup(playgroundOptions,playgroundTracks(settings.track,storage),{step:setupStep,ready:state!=='loading'});
  $('club-setup').classList.remove('hidden');
  if(!wasOpen||previousStep!==setupStep){$('club-setup').classList.add('animate-step');$('club-setup').style.setProperty('--step-offset',!wasOpen||SETUP_STEPS.indexOf(setupStep)>=SETUP_STEPS.indexOf(previousStep)?'12px':'-12px');}
  if(eventPreparation){
    const e=league.event(eventPreparation.id),fee=league.quote(e.id,playgroundOptions.vehicleId).fee;
    for(const control of $('club-setup').querySelectorAll('[data-playground]'))if(control.dataset.playground!=='camera')control.disabled=true;
    $('club-setup').querySelector('[data-play-action="kit"]')?.remove();
    $('club-setup').querySelector('.race-setup-footer').insertAdjacentHTML('afterbegin',`<p class="economy-setup-note">${e.name} · ${playgroundOptions.count} pilotos · N${e.cap||1} máximo · Confirmación: ${fee} CR</p>`);
    if(setupStep==='car')$('club-setup').querySelector('[data-setup-next]').textContent=fee?`Inscribirme y correr · ${fee} CR`:'Salir a pista';
  }
  if(!eventPreparation){const prizes=freeRacePrizes(league.state);$('club-setup').querySelector('.race-setup-footer').insertAdjacentHTML('afterbegin',`<p class="economy-setup-note">${isFreeRaceEligible(playgroundOptions)?`Entrada gratis · ${prizes[3]}–${prizes[0]} CR + 2 cartas al terminar`:'Entrenamiento / configuración libre · sin premios económicos'}</p>`);}
  enhanceStyledSelects($('club-setup'));syncNavigation();
  $('playground-form').inert=true;document.querySelector('#playground-hub>.club-navigation').inert=true;document.querySelector('header.topbar').inert=true;
  if(garageSurface==='home'){garage?.hide();garageSurface=null;}
  if(focus)$('club-setup').querySelector('[data-setup-back]')?.focus({preventScroll:true});
  if(setupStep==='car')paintRaceCards();
}
function closeSetup(restore=true){
  if(!setupOpen||raceLaunching)return;
  closeStyledSelect();setupOpen=false;eventPreparation=null;thumbnailRequest++;syncNavigation();$('club-setup')?.classList.add('hidden');
  const form=$('playground-form'),nav=document.querySelector('#playground-hub>.club-navigation');
  if(form)form.inert=false;if(nav)nav.inert=false;document.querySelector('header.topbar').inert=false;
  if(restore&&setupFocus?.isConnected)setupFocus.focus({preventScroll:true});
  if(state==='hub')mountHomeGarage();
}
function backSetup(){
  if(!$('race-car-facts')?.classList.contains('hidden')){closeRaceFacts();return;}
  const index=SETUP_STEPS.indexOf(setupStep);if(index>0)showSetup(SETUP_STEPS[index-1]);else closeSetup();
}
async function paintRaceCards(){
  const request=++thumbnailRequest,view=await getGarage();
  const images=[...$('race-car-grid')?.querySelectorAll('[data-race-thumbnail]')||[]];
  for(const image of images){
    if(request!==thumbnailRequest||!setupOpen||setupStep!=='car')return;
    try{const source=await view.thumbnail(image.dataset.raceThumbnail);if(!image.isConnected||request!==thumbnailRequest)return;image.src=source;image.hidden=false;image.nextElementSibling.hidden=true;}
    catch{if(image.isConnected)image.nextElementSibling.textContent='Vista no disponible';}
    await new Promise(resolve=>setTimeout(resolve,0));
  }
}
function chooseRaceCar(id){
  if(raceLaunching||!availableEligibleVehicles(raceSetupVehicles(),playgroundOptions.carCategory).some(v=>v.id===id))return;
  playgroundOptions.vehicleId=id;savePlayground(storage,playgroundOptions);
    syncHomeCarSelection();
  for(const button of $('race-car-grid').querySelectorAll('[data-race-car]')){
    const selected=button.dataset.raceCar===id;button.setAttribute('aria-pressed',String(selected));button.querySelector('.race-card-check')?.remove();
    if(selected)button.insertAdjacentHTML('beforeend',`<span class="race-card-check">${clubIcon('check')}<span class="sr-only">Seleccionado</span></span>`);
  }
  $('race-car-selected-name').textContent=VEHICLES.find(v=>v.id===id).name;
}
function showRaceFacts(){
  const panel=$('race-car-facts');panel.innerHTML=renderStudioPanel(playgroundOptions.vehicleId,'facts');panel.classList.remove('hidden');
  panel.querySelectorAll('[data-studio-close-panel]').forEach(button=>button.dataset.raceCloseFacts='');
  for(const node of $('club-setup').querySelectorAll('.race-setup-header,.race-setup-progress,.setup-cars,.race-setup-footer'))node.inert=true;
  panel.querySelector('button').focus();
}
function closeRaceFacts(){
  $('race-car-facts')?.classList.add('hidden');for(const node of $('club-setup').querySelectorAll('.race-setup-header,.race-setup-progress,.setup-cars,.race-setup-footer'))node.inert=false;
  $('club-setup').querySelector('[data-race-facts]')?.focus();
}

function showHub(){
  if(!world||state==='loading')return;
  closeSetup(false);
  if(!league.owns(playgroundOptions.vehicleId))playgroundOptions.vehicleId=league.state.owned[0];
  celebration.close();workshopLoaner=null;stopResultCalculation();leagueAttempt=null;closeGarage();closeKit();refreshPlayground();setState('hub');$('playground-hub').scrollTop=0;
}
async function launchPlayground(startNow=true){
  if(!world||state==='loading'||raceLaunching)return;
  if(!leagueAttempt&&!workshopLoaner&&!league.owns(playgroundOptions.vehicleId)){toast('Selecciona un coche de tu garaje.');return;}
  const prepared=resolvePlayground(playgroundOptions,playgroundTracks(settings.track,storage));if(prepared.error){toast(prepared.error);return;}
  raceLaunching=true;const button=$('club-setup')?.querySelector('[data-setup-next]');
  if(button){button.disabled=true;button.textContent='Preparando salida…';}
  const request=++vehicleLoadRequest;
  try{
    const vehicles=prepared.settings.mode==='race'?raceGridVehicles(prepared.settings.vehicle,prepared.settings.raceRules):[prepared.settings.vehicle];
    await Promise.all([...new Set(vehicles)].map(vehicle=>preloadVehicles(vehicle)));
    if(request!==vehicleLoadRequest)return;
    if(!leagueAttempt&&!workshopLoaner){leagueAttempt=await league.execute(()=>league.begin('quick',prepared.options.vehicleId,prepared.options));}
    Object.assign(playgroundOptions,prepared.options);savePlayground(storage,playgroundOptions);Object.assign(settings,prepared.settings);
    const effective=workshopLoaner?1:leagueAttempt?.level||1,cap=leagueAttempt?.cap||5;
    settings.vehicle=upgradedVehicle(settings.vehicle,effective,cap);
    settings.raceRules={...settings.raceRules,count:leagueAttempt?.count||settings.raceRules.count,seed:leagueAttempt?.seed||38171,vehiclePool:settings.raceRules.vehiclePool.map(v=>upgradedVehicle(v,effective,cap))};
    raceLaunching=false;closeSetup(false);closeGarage();makeSession(true);if(startNow)start();
  }catch(error){console.error(error);toast(error.message||'No se ha podido preparar la salida. Vuelve a intentarlo.');}
  finally{raceLaunching=false;if(button?.isConnected){button.disabled=false;button.innerHTML=`Salir a pista ${clubIcon('flag-checkered')}`;}}
}

async function selectVehicle(vehicleId){
  if(!league.owns(vehicleId)){toast('Compra o gana este coche para seleccionarlo.');return;}
  const vehicle=VEHICLES.find(v=>v.id===vehicleId);if(!world||state==='loading'||!vehicle)return;
  const request=++vehicleLoadRequest;
  try{await preloadVehicles(vehicle);}catch{toast('No se ha podido cargar el coche.');return;}
  if(request!==vehicleLoadRequest)return;
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
  const host=$('home-car-stage');if(!host||state!=='hub'||fullGarage()||setupOpen)return;
  try{const view=await getGarage();if(!host.isConnected||state!=='hub'||fullGarage()||setupOpen)return;
    host.innerHTML='';garageSurface='home';await view.mount(host,playgroundOptions.vehicleId,{presentation:'home'});applyGraphics();
  }catch{/* The selected car illustration remains usable if the 3D preview fails. */}
}
async function openGarage(inspectId,context) {
  if (!world || state === 'loading') return;
  if (fullGarage()||garageLoading) return;
  garageLoading=true;
  try{await getGarage();}catch{toast('No se ha podido abrir el garaje.');return;}finally{garageLoading=false;}
  garageContext=context||(state==='hub'?'hub':'session');garagePanel=null;
  modalFocus=document.activeElement;
  if(state==='running')setState('paused');else if(state==='countdown')setState('ready');
  const selected=typeof inspectId==='string'&&VEHICLES.some(v=>v.id===inspectId)?inspectId:league.owns(lastGarageVehicle)?lastGarageVehicle:league.owns(playgroundOptions.vehicleId)?playgroundOptions.vehicleId:league.state.owned[0];
  const allowed=league.owns(selected)?league.state.owned:[selected];
  $('garage-content').innerHTML=renderGarage(null,selected,{testing:!league.owns(selected),ownedVehicleIds:allowed});$('garage-content').querySelector('.studio-actions').insertAdjacentHTML('beforeend',league.owns(selected)?'<button type="button" class="league-use-car" data-league-use>Usar en carrera</button>':'<button type="button" class="league-use-car" data-league-test>Probar en pista · sin premios</button>');$('garage-overlay').classList.remove('hidden');garageSurface='garage';
  for(const node of document.querySelectorAll('header.topbar, main, #result-overlay'))node.inert=true;
  try{await garage.mount($('garage-stage'),selected,{presentation:'garage',allowedIds:allowed});}catch(error){console.error(error);toast('No se ha podido cargar el coche del garaje.');closeGarage();return;}
  if(!fullGarage())return;updateGarage();applyGraphics();
  $('garage-content').querySelector('[data-action="close-garage"]')?.focus({preventScroll:true});updateInputPrompts();syncNavigation();
}

function closeGarage() {
  closeStyledSelect();
  const wasOpen = !$('garage-overlay').classList.contains('hidden');
  $('garage-overlay').classList.add('hidden');
  if(garageSurface==='garage'){garage?.hide();garageSurface=null;}
  for (const node of document.querySelectorAll('header.topbar, main, #result-overlay')) node.inert=false;
  if (wasOpen && modalFocus?.isConnected) modalFocus.focus();
  garagePanel=null;if(wasOpen&&state==='hub')mountHomeGarage();syncNavigation();
}
async function openKit() {
  if(!world||state==='loading'||workbench?.visible||kitLoading)return;
  closeSetup(false);
  kitLoading=true;
  let TrackWorkbench;
  try{({TrackWorkbench}=await import('./track-workbench.js'));}catch{toast('No se ha podido abrir el editor.');return;}finally{kitLoading=false;}
  closeGarage();kitFocus=document.activeElement;
  if(state==='running')setState('paused');else if(state==='countdown')setState('ready');
  workbench ||= new TrackWorkbench(config=>{
    const bundled=findBundledEditorTrack(workbench.document.value);
    closeKit();Object.assign(playgroundOptions,{trackId:bundled?.id||config.id,width:'original',theme:config.circuitDressing?'grass':'basic',weather:'clear',surface:'track'});settings.track=bundled||config;launchPlayground();
  },closeKit,{basicOnly:true});
  const selectedTrack=playgroundTracks(settings.track,storage).find(track=>track.id===playgroundOptions.trackId);
  const savedDocument=readSavedEditorDocument(storage,playgroundOptions.trackId)||selectedTrack?.editorDocument;
  if(savedDocument)workbench.loadDocument(savedDocument);
  $('track-kit-overlay').classList.remove('hidden');workbench.mount($('track-kit-content'));
  applyGraphics();
  for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=true;
  $('track-kit-content').querySelector('[data-kit="close"]').focus();syncNavigation();
}
function closeKit() {
  const open=workbench?.visible;$('track-kit-overlay').classList.add('hidden');workbench?.hide();
  if(open){
    if(workbench.document.value.pieces.length){
      const bundled=findBundledEditorTrack(workbench.document.value);if(!bundled)workbench.save();
      playgroundOptions.trackId=bundled?.id||savedEditorTrackId(workbench.document.value);playgroundOptions.width='original';savePlayground(storage,playgroundOptions);
    }
    for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=false;refreshPlayground();if(kitFocus?.isConnected)kitFocus.focus();}
}
async function inspectVehicle(id){
  if(!id||garagePanel)return;
  $('studio-loading')?.classList.remove('hidden');
  try{await garage.select(id);if(fullGarage())updateGarage();}catch(error){console.error(error);toast('No se ha podido cargar este coche.');}
  finally{$('studio-loading')?.classList.add('hidden');}
}
function updateGarage(){
  if(!fullGarage())return;
  const changed=lastGarageVehicle!==garage.selectedId;
  if(changed)$('garage-content').querySelector('.studio-body').scrollTop=0;
  lastGarageVehicle=garage.selectedId;
  updateStudioDetail($('garage-detail'),garage.selectedId,{animate:changed&&!matchMedia('(prefers-reduced-motion: reduce)').matches});
  if(changed&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    for(const node of $('garage-detail').querySelectorAll('h2,.studio-car-era')){node.getAnimations().forEach(a=>a.cancel());node.animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.2,.75,.2,1)'});}
  }
  const category=$('garage-content').querySelector('[data-collection-category]');category.innerHTML='<option value="owned">Tu colección</option>';category.value='owned';
  const index=garage.pageVehicles.findIndex(v=>v.id===garage.selectedId),count=garage.pageVehicles.length;
  $('studio-category-count').innerHTML=`${clubIcon('car-profile')}${count}`;
  $('studio-category-count').setAttribute('aria-label',`${count} coches disponibles`);
  $('studio-position-count').textContent=`${String(index+1).padStart(2,'0')} / ${String(count).padStart(2,'0')}`;
  const previous=$('garage-content').querySelector('[data-studio-direction="-1"]');
  const next=$('garage-content').querySelector('[data-studio-direction="1"]');
  const focused=document.activeElement;
  previous.disabled=index===0;next.disabled=index===count-1;
  if((focused===previous||focused===next)&&focused.disabled){
    const neighbor=focused===next?previous:next;
    (neighbor.disabled?category.parentElement.querySelector('.prl-select-trigger'):neighbor)?.focus({preventScroll:true});
  }
  updateInputPrompts();
}
function openStudioPanel(mode){
  garagePanel=mode;
  $('garage-content').querySelector('.studio-body').scrollTop=0;
  const panel=$('garage-panel');panel.innerHTML=renderStudioPanel(garage.selectedId,mode,garage.modelData.get(garage.selectedId)?.customization);
  panel.classList.remove('hidden');panel.querySelector('details.vehicle-workshop')?.setAttribute('open','');
  for(const node of $('garage-content').children)if(node!==panel&&!node.classList.contains('studio-body'))node.inert=true;
  for(const button of $('garage-content').querySelectorAll('[data-studio-direction]'))button.inert=true;
  garage.setView('customize');$('studio-gesture-hint').textContent='Arrastra para girar · Pellizca para acercar';
  panel.querySelector('button')?.focus();
}
function closeStudioPanel(){
  closeStyledSelect();
  const mode=garagePanel;garagePanel=null;$('garage-panel')?.classList.add('hidden');
  for(const node of $('garage-content').children)node.inert=false;
  for(const button of $('garage-content').querySelectorAll('[data-studio-direction]'))button.inert=false;
  garage.setView('detail');$('studio-gesture-hint').textContent='Desliza para cambiar';
  $('garage-content').querySelector(`[data-studio-panel="${mode}"]`)?.focus();
}

function updateOptions() {
  $('track-name').textContent=settings.track.name;
  const label=settings.surface==='track'?(settings.track.zones.length?'Trazado mixto':'Asfalto'):SURFACES[settings.surface].name;
  $('conditions-label').textContent=`${settings.vehicle.name} · ${label} · ${WEATHER[settings.weather].name}`;
  $('difficulty').textContent=settings.track.difficulty.toUpperCase();
  $('track-length').textContent=`${(circuit.length/1000).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})} km`;
  const competing=settings.mode==='race';
  document.body.dataset.mode=settings.mode;
  updateCameraUI();
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
  syncNavigation();
  const previous=state;
  if(['hub','ready','finished'].includes(next)&&$('pause-all-music'))$('pause-all-music').checked=false;
  if(next==='finished'&&previous!=='finished')audio.ui('notify');
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
  $('footer-label').textContent=next==='running'?`${settings.vehicle.name.toUpperCase()} · TU SIGUIENTE CURVA`:'BUSCA TU PROPIA TRAZADA';
  updateAudio(next==='running');keys.clear();clearPointers();
  updateInputPrompts();if(next==='hub')mountHomeGarage();
  if(next==='paused'){$('pause-session-summary').textContent=`${settings.track.name} · ${settings.vehicle.name}`;$('restart-pause-btn').querySelector('strong').textContent=race?'Reiniciar carrera':'Reiniciar sesión';$('resume-btn').focus({preventScroll:true});}
  else if(previous==='paused'&&next==='running')$('pause-btn').focus({preventScroll:true});
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
  testPilot=testingWithAI?new TestPilot(circuit):null;
  world.cameraReady=false;world.resetDrivingEffects();simulationClock.reset();readBest();updateOptions();setState('ready');updateHUD();drawMap();
}
function toast(message,announce=true){if(announce)audio.ui('notify');$('toast').textContent=message;$('toast').classList.remove('hidden');toastTime=3.2;}
function start(){if(state!=='ready')return;setState('countdown');countdown=3;$('countdown').textContent='3';audio.countdown(3);}
function reset(startAgain=true){if(state==='finished'&&leagueAttempt){const id=leagueAttempt.eventId;leagueAttempt=null;if(id==='quick')launchPlayground();else launchLeague(id);return;}testPilot?.reset();if(!drive||state==='loading'||state==='hub')return;stopResultCalculation();if(race)race.reset();else drive.reset(circuit);laps.reset();finishedTime=null;resetGhost();readBest();world.cameraReady=false;world.resetDrivingEffects();simulationClock.reset();setState('ready');updateHUD();drawMap();if(startAgain)start();}

function resetGhost(){
  ghostRecorder=new GhostRecorder(drive);
  ghostLap=race?null:ghostRecords.get(timingContext);
}
function recordGhost(elapsed,crossing){
  if(testingWithAI)return;
  const recorded=ghostRecorder.step(elapsed,drive,crossing);
  if(recorded&&ghostRecords.recordLap(timingContext,recorded)&&!race)ghostLap=recorded;
}
function pause(){if(state==='running')setState('paused');else if(state==='paused')setState('running');else if(state==='countdown')setState('ready');}
function updateCameraUI(){
  const current=cameraView(settings.camera),next=cameraView(nextCameraMode(settings.camera)),button=$('camera-btn');
  $('camera-label').textContent=current.shortLabel;
  button.dataset.camera=current.id;
  button.setAttribute('aria-label',`Cámara: ${current.label}. Cambiar a ${next.label} (C)`);
  button.title=`${current.label} · Cambiar a ${next.label} (C)`;
}
function toggleCamera(){
  if(!world||state==='loading')return;
  settings.camera=nextCameraMode(settings.camera);playgroundOptions.camera=settings.camera;
  savePlayground(storage,playgroundOptions);updateCameraUI();if(state==='hub')refreshPlayground();
}

function stopResultCalculation(){leaderboardAbort?.abort();leaderboardAbort=null;activeReport=null;}
function paintResult(resetScroll=false){
  if(!activeReport)return;
  const scroll=$('result-content').querySelector('.report-body')?.scrollTop||0;
  $('result-content').innerHTML=renderSessionResult(activeReport);
  if(activeReport.leagueReceipt){$('result-content').querySelector('.report-summary').insertAdjacentHTML('beforebegin',renderReward(activeReport.leagueReceipt));$('result-content').querySelector('[data-result=retry]').textContent=activeReport.leagueReceipt.qualifying&&!activeReport.leagueReceipt.qualified?'Reintentar corte':league.state.run&&leagueAttempt?.eventId!=='quick'?'Siguiente fase':'Volver a competir';
    if(activeReport.leagueReceipt.qualifying){$('result-content').querySelector('h2').textContent=activeReport.leagueReceipt.qualified?'Clasificatoria superada':'Objetivo no alcanzado';$('result-content').querySelector('.report-header .eyebrow').textContent='CLASIFICATORIA · '+settings.track.name;}
    else if(eventById(leagueAttempt?.eventId)?.kind==='challenge'){$('result-content').querySelector('h2').textContent=activeReport.leagueReceipt.medal?'Reto completado':'Objetivo no alcanzado';$('result-content').querySelector('.report-header .eyebrow').textContent='RETO · '+settings.track.name;}$('result-content').querySelector('[data-result=hub]').textContent='Volver al inicio';}
  $('result-content').querySelector('.report-body').scrollTop=resetScroll?0:scroll;
}
function calculateRanking(report){
  leaderboardAbort?.abort();leaderboardAbort=new AbortController();report.leaderboard={status:'loading',entries:[]};
  loadAILeaderboard(report.context,{storage,signal:leaderboardAbort.signal}).then(entries=>{
    if(activeReport!==report)return;report.leaderboard={status:'ready',entries};if(report.tab==='ranking')paintResult();
  }).catch(error=>{if(error.name==='AbortError'||activeReport!==report)return;report.leaderboard={status:'error',error:error.message,entries:[]};if(report.tab==='ranking')paintResult();});
}
async function showTimingResults(complete){
  if(resultsSettling)return;resultsSettling=true;
  const totalTime=race?(race.player.finishTime??race.elapsed):laps.elapsed;if(totalTime<=0){resultsSettling=false;return;}
  const lapTimes=race?race.player.tracker.lapTimes:laps.lapTimes;
  const racers=race?race.standings().map(r=>({id:r.id,name:r.name,isPlayer:r.isPlayer,level:r.level,finishTime:r.finishTime})):[];
  activeReport=createReport({context:timingContext,lapTimes,totalTime,complete,position:race?.position,racers,records:resultRecords,previousBestLap:previousPersonalLap});
  if(leagueAttempt){setState('paused');try{activeReport.leagueReceipt=await league.execute(()=>league.settle(leagueAttempt.id,{complete,lapTimes,position:race?.position||4,racers,contextSignature:timingContext.key}));}catch(error){toast(error.message);}}
  resultsSettling=false;
  finishedTime=totalTime;best=activeReport.personalBest;$('best-time').textContent=formatTime(best);
  $('result-content').classList.remove('race-result-modal');$('result-content').classList.add('session-result-modal');
  $('result-overlay').setAttribute('aria-label','Tiempos y clasificación');paintResult(true);setState('finished');updateHUD();
  $('result-content').querySelector('h2').focus({preventScroll:true});calculateRanking(activeReport);
  if(activeReport.leagueReceipt)celebration.show(activeReport.leagueReceipt,{animations:league.state.animations,saved:league.saved});
}
function finish(lap){
  if(leagueAttempt?.mode==='practice'){showTimingResults(true);return;}
  if(testingWithAI&&!race){toast(`Vuelta de prueba IA · ${formatTime(lap)}`);return;}
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
  $('ghost-status').textContent=testingWithAI?'PRUEBA IA · SIN RÉCORDS':ghostLap?`◇ TU FANTASMA · ${formatTime(ghostLap.duration)}`:'◇ FANTASMA: COMPLETA UNA VUELTA';
  $('ghost-status').title=testingWithAI?'La IA conduce esta prueba sin guardar récords ni fantasmas.':ghostLap?(ghostRecords.saveAvailable?'Tu mejor vuelta guardada en este navegador.':'Fantasma disponible durante esta sesión; no se ha podido guardar.'):'Tu primera vuelta completa creará el fantasma automáticamente.';
  const wrongWay=race?race.player.tracker.wrongWay:laps.wrongWay;
  const status=$('driving-status');status.classList.toggle('warning',wrongWay||drive.impact>.15);
  status.classList.toggle('braking',drive.braking&&drive.grounded);
  $('drive-mode-label').textContent=testingWithAI?'IA':drive.braking?'FRENO':'AUTO';
  const underpass=circuit.layout?.crossings.some(c=>drive.y<c.upperY-3&&Math.hypot(drive.x-c.x,drive.z-c.z)<circuit.config.width*.9);
  $('status-text').textContent=wrongWay?'SENTIDO CONTRARIO':!drive.grounded?'EN EL AIRE':drive.braking?'FRENANDO':drive.impact>.15?'ABRE LA TRAZADA':underpass?'PASO INFERIOR':drive.slip>.3?'DERRAPANDO':drive.y>4?'TRAMO ELEVADO':`${SURFACES[surface].name.toUpperCase()} · EN PISTA`;
}
function cacheMap(){
  const theme=getComputedStyle(document.documentElement);
  mapPalette={blue:theme.getPropertyValue('--prl-blue').trim(),pink:theme.getPropertyValue('--prl-pink').trim(),ink:theme.getPropertyValue('--ui-ink').trim()};
  mapBackground=document.createElement('canvas');mapBackground.width=360;mapBackground.height=250;
  const ctx=mapBackground.getContext('2d'),p=mapProjection,project=(x,z)=>[p.dx+(x-p.minX)*p.scale,p.dz+(z-p.minZ)*p.scale];
  ctx.clearRect(0,0,360,250);ctx.beginPath();circuit.samples.forEach((v,i)=>{const[x,y]=project(v.x,v.z);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.lineWidth=14;ctx.strokeStyle='#9bdaff20';ctx.stroke();ctx.lineWidth=4;ctx.strokeStyle=mapPalette.blue;ctx.stroke();
  for(const crossing of circuit.layout?.crossings||[]){const a=circuit.at(crossing.upperProgress-.015),b=circuit.at(crossing.upperProgress+.015);ctx.beginPath();ctx.moveTo(...project(a.x,a.z));ctx.lineTo(...project(b.x,b.z));ctx.lineWidth=11;ctx.strokeStyle='#242a32';ctx.stroke();ctx.lineWidth=5;ctx.strokeStyle=mapPalette.ink;ctx.stroke();}
  const start=circuit.at(0),[sx,sy]=project(start.x,start.z);ctx.beginPath();ctx.moveTo(sx-start.normal.x*9,sy-start.normal.z*9);ctx.lineTo(sx+start.normal.x*9,sy+start.normal.z*9);ctx.strokeStyle=mapPalette.ink;ctx.lineWidth=4;ctx.stroke();
}
function drawMap(){
  if(!preferences.showMinimap)return;
  const ctx=$('minimap').getContext('2d'),p=mapProjection,project=(x,z)=>[p.dx+(x-p.minX)*p.scale,p.dz+(z-p.minZ)*p.scale];
  ctx.clearRect(0,0,360,250);ctx.drawImage(mapBackground,0,0);
  for(const rival of race?.rivals||[]){const[x,y]=project(rival.drive.x,rival.drive.z);ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle=rival.color;ctx.fill();}
  const ghost=!race&&['countdown','running','paused'].includes(state)&&sampleGhost(ghostLap,laps.time);
  if(ghost){const[x,y]=project(ghost.x,ghost.z);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.strokeStyle=mapPalette.blue;ctx.lineWidth=1.5;ctx.stroke();}
  const[x,y]=project(drive.x,drive.z);ctx.save();ctx.translate(x,y);ctx.rotate(-drive.heading);ctx.beginPath();ctx.moveTo(0,9);ctx.lineTo(-6,-5);ctx.lineTo(6,-5);ctx.closePath();ctx.fillStyle=mapPalette.pink;ctx.fill();ctx.strokeStyle=mapPalette.ink;ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
}

function setupInput(){
  window.addEventListener('keydown',e=>{
    if(celebration.visible){if(e.code==='Escape'){e.preventDefault();celebration.close();}return;}
    if(styledSelectOpen())return;
    if(preferencesOpen){
      if(e.code==='Escape'){e.preventDefault();closePreferences();}
      if(e.code==='Tab'){const items=[...$('preferences-content').querySelectorAll('button:not(:disabled),select,input:not(:disabled)')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(fullGarage()){
      if(e.code==='Escape'){e.preventDefault();if(garagePanel)closeStudioPanel();else cancelGarage();return;}
      if(e.code==='Tab'){
        const root=garagePanel?$('garage-panel'):$('garage-content');
        const items=[...root.querySelectorAll('button:not(:disabled),input,select,summary')].filter(el=>el.getClientRects().length&&!el.closest('[inert]')),first=items[0],last=items.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
      if(!garagePanel&&!['INPUT','SELECT'].includes(document.activeElement?.tagName)&&['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();inspectVehicle(garage.neighbor(e.code==='ArrowRight'?1:-1));}
      return;
    }
    if(setupOpen){
      if(e.code==='Escape'){e.preventDefault();backSetup();return;}
      if(e.code==='Tab'){
        const items=[...$('club-setup').querySelectorAll('button:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[inert]')),first=items[0],last=items.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
      return;
    }
    if(state==='finished'){
      if(e.code==='Escape'){e.preventDefault();showHub();}
      if(e.code==='Tab'){const items=[...$('result-content').querySelectorAll('button:not(:disabled),[tabindex="0"]')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(state==='paused'&&e.code==='Tab'&&menuRoot()===$('pause-overlay')){
      const items=[...$('pause-overlay').querySelectorAll('button:not(:disabled),summary,input:not(:disabled)')].filter(el=>el.getClientRects().length),first=items[0],last=items.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      return;
    }
    if(workbench?.visible){
      if(workbench.handleKey(e))return;
      if(e.code==='Tab'){const buttons=[...$('track-kit-content').querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled):not([hidden]),summary,canvas')].filter(el=>el.getClientRects().length),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(['INPUT','SELECT','TEXTAREA','SUMMARY'].includes(document.activeElement?.tagName))return;
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
  $('start-btn').addEventListener('click',start);$('camera-btn').addEventListener('click',toggleCamera);$('hub-btn').addEventListener('click',showHub);$('intro-back').addEventListener('click',showHub);
  $('end-session-btn').addEventListener('click',()=>{if(state==='paused'){leaguePage='home';leagueSelection=null;showHub();}});
  $('intro-race-btn').addEventListener('click',()=>{playgroundOptions.mode='race';savePlayground(storage,playgroundOptions);showHub();});
  for(const id of['reset-btn','restart-pause-btn'])$(id).addEventListener('click',()=>reset());$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',()=>setState('running'));
  $('preferences-btn').addEventListener('click',openPreferences);$('pause-preferences-btn').addEventListener('click',()=>{preferencesTab='game';openPreferences();});
  $('preferences-overlay').addEventListener('click',e=>{
    if(e.target===$('preferences-overlay')||e.target.closest('[data-preferences-close]')){closePreferences();return;}
    if(e.target.closest('[data-sound-toggle]'))toggleSound();
    const tab=e.target.closest('[data-preferences-tab]')?.dataset.preferencesTab;if(tab){preferencesTab=tab;paintPreferences();$('preferences-content').querySelector(`[data-preferences-tab="${tab}"]`).focus();}
    const preset=e.target.closest('[data-graphics-preset]')?.dataset.graphicsPreset;if(preset){changePreferences(selectGraphicsPreset(preferences,preset));$('preferences-content').querySelector(`[data-graphics-preset="${preset}"]`).focus();}
    const mode=e.target.closest('[data-touch-mode]')?.dataset.touchMode;if(mode){changePreferences({...preferences,touchMode:mode});$('preferences-content').querySelector(`[data-touch-mode="${mode}"]`).focus();}
  });
  $('preferences-overlay').addEventListener('change',e=>{const key=e.target.dataset.preference;if(!key)return;const value=['samples','sensitivity','targetFPS'].includes(key)?Number(e.target.value):typeof preferences[key]==='boolean'?e.target.value==='true':e.target.value;changePreferences({...preferences,[key]:value});$('preferences-content').querySelector(`[data-preference="${key}"]`)?.focus();});
  $('playground-hub').addEventListener('click',e=>{
    const metric=e.target.closest('[data-ranking-metric]')?.dataset.rankingMetric;if(metric){rankingMetric=metric;refreshPlayground();return;}
    const page=e.target.closest('[data-league-page]')?.dataset.leaguePage;
    if(page){leaguePage=page;leagueSelection=null;leagueMessage='';refreshPlayground();$('playground-hub').scrollTop=0;return;}
    if(e.target.closest('[data-league-back]')){leaveLeagueDetail();return;}
    const carDetail=e.target.closest('[data-league-car]')?.dataset.leagueCar;if(carDetail){rememberLeagueOrigin(`[data-league-car="${carDetail}"]`);leagueSelection='car:'+carDetail;refreshPlayground();$('playground-hub').scrollTop=0;return;}
    const unlock=e.target.closest('[data-economy-unlock]')?.dataset.economyUnlock;if(unlock){economyAction(()=>league.unlock(unlock));return;}
    const upgrade=e.target.closest('[data-economy-upgrade]')?.dataset.economyUpgrade;if(upgrade){economyAction(()=>league.upgrade(upgrade));return;}
    const focus=e.target.closest('[data-economy-focus]')?.dataset.economyFocus;if(focus){economyAction(()=>league.setFocus(focus));return;}
    if(e.target.closest('[data-economy-export]')){const url=URL.createObjectURL(new Blob([league.export()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='prl-progreso-local.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    const event=e.target.closest('[data-league-event]')?.dataset.leagueEvent;
    if(event){rememberLeagueOrigin(`[data-league-event="${event}"]`);leagueSelection=event;leaguePage='events';leagueMessage='';refreshPlayground();$('playground-hub').scrollTop=0;return;}
    const launch=e.target.closest('[data-league-launch]')?.dataset.leagueLaunch;if(launch){prepareLeague(launch);return;}
    if(e.target.closest('[data-league-quick]')||e.target.closest('[data-league-practice]')){leagueAttempt=null;workshopLoaner=null;Object.assign(playgroundOptions,{mode:e.target.closest('[data-league-practice]')?'practice':'race',count:4,laps:1,difficulty:'novice',carCategory:'same-model',weather:'clear',surface:'track',pace:'normal',width:'original'});showSetup();return;}
    if(e.target.closest('[data-league-retire]')){if(confirm('¿Retirarte de la competición? La entrada pagada no se devuelve. Cerrar la ficha permite continuar más tarde.'))economyAction(()=>{league.retire();leagueMessage='Competición retirada.';});return;}
    const buy=e.target.closest('[data-league-buy]')?.dataset.leagueBuy;if(buy){try{const car=league.buy(buy);leagueMessage=car.name+' ya está en tu garaje.';audio.ui('confirm');}catch(error){leagueMessage=error.message;}refreshPlayground();return;}
    const inspect=e.target.closest('[data-league-inspect]')?.dataset.leagueInspect;if(inspect){openGarage(inspect,'hub');return;}
    const mode=e.target.closest('[data-play-mode]');if(mode){playgroundOptions.mode=mode.dataset.playMode;savePlayground(storage,playgroundOptions);refreshPlayground();hubFocusMode(mode.dataset.playMode);}
    const action=e.target.closest('[data-play-action]')?.dataset.playAction;
    if(action==='garage')openGarage();if(action==='kit')openKit();if(action==='preferences')openPreferences();
    if(action==='tracks')showSetup('circuit');if(action==='close-setup')closeSetup();
    if(e.target.closest('[data-setup-back]'))backSetup();
    const step=e.target.closest('[data-setup-go]');if(step&&!step.disabled)showSetup(step.dataset.setupGo);
    if(e.target.closest('[data-setup-next]')){const next=SETUP_STEPS[SETUP_STEPS.indexOf(setupStep)+1];if(next)showSetup(next);else if(eventPreparation)launchLeague(eventPreparation.id,eventPreparation.revision,playgroundOptions.vehicleId);else launchPlayground();}
    const car=e.target.closest('[data-race-car]');if(car)chooseRaceCar(car.dataset.raceCar);
    if(e.target.closest('[data-race-facts]'))showRaceFacts();
    if(e.target.closest('[data-race-close-facts]'))closeRaceFacts();
    if(e.target===$('club-setup'))closeSetup();
  });
  document.body.addEventListener('click',e=>{
    const target=e.target.closest('[data-club-nav]');if(!target||state==='loading')return;
    const destination=target.dataset.clubNav;
    if(destination==='garage'){leaguePage='collection';leagueSelection=null;showHub();return;}
    if(destination==='events'||destination==='rankings'){leaguePage=destination;leagueSelection=null;showHub();return;}
    if(destination==='race'){leaguePage='home';leagueSelection=null;showHub();return;}
    if(destination==='tracks'){leaguePage='events';leagueSelection=null;showHub();return;}
    if(destination==='profile'){leaguePage='profile';leagueSelection=null;showHub();}
  });
  $('playground-hub').addEventListener('change',e=>{
    if(e.target.hasAttribute('data-ranking-track')){rankingTrack=e.target.value;refreshPlayground();return;}
    if(e.target.hasAttribute('data-economy-animations')){economyAction(()=>league.setAnimations(e.target.value==='true'));return;}
    const key=e.target.dataset.playground;if(!key)return;
    const value=['width','count','laps'].includes(key)&&e.target.value!=='original'?Number(e.target.value):e.target.value;
    Object.assign(playgroundOptions,normalizePlayground({...playgroundOptions,[key]:value},playgroundTracks(settings.track,storage)));
    if(key==='trackId'&&resolvePlayground(playgroundOptions,playgroundTracks(settings.track,storage)).error)playgroundOptions.width='original';
    savePlayground(storage,playgroundOptions);refreshPlayground();$('playground-hub').querySelector(`[data-playground="${key}"]`)?.focus();
  });
  $('playground-hub').addEventListener('submit',e=>{e.preventDefault();if(e.target.matches('[data-league-name]')){const name=new FormData(e.target).get('driver');economyAction(()=>{league.rename(name);leagueMessage='Nombre guardado.';});}else showSetup('circuit');});
  $('garage-overlay').addEventListener('click',async e=>{
    if(e.target.closest('[data-league-test]')){workshopLoaner=garage.selectedId;leagueAttempt=null;Object.assign(playgroundOptions,{vehicleId:workshopLoaner,trackId:'puerto',mode:'practice',laps:1,pace:'normal',weather:'clear',surface:'track',width:'original'});closeGarage();await launchPlayground();return;}
    if(e.target.closest('[data-league-use]')){await selectVehicle(garage.selectedId);return;}
    if(e.target.closest('[data-action="close-garage"]')||e.target===$('garage-overlay')){cancelGarage();return;}
    const direction=e.target.closest('[data-studio-direction]');if(direction&&!direction.disabled)inspectVehicle(garage.neighbor(Number(direction.dataset.studioDirection)));
    const panel=e.target.closest('[data-studio-panel]');if(panel)openStudioPanel(panel.dataset.studioPanel);
    if(e.target.closest('[data-studio-close-panel]'))closeStudioPanel();
  });
  $('garage-overlay').addEventListener('input',e=>{
    const key=e.target.dataset.custom;if(!key)return;
    const value=['glassOpacity','rideHeight'].includes(key)?Number(e.target.value):e.target.value;
    const saved=garage.customize({[key]:value});
    $('workshop-status').textContent=saved?'Ajustes guardados en este navegador.':'Ajustes aplicados durante esta sesión.';
  });
  $('garage-overlay').addEventListener('change',async e=>{
    if(e.target.hasAttribute('data-collection-category')){try{await garage.showPage(e.target.value);updateGarage();}catch{toast('No se ha podido cargar esta colección.');}return;}
    if(e.target.id!=='vehicle-wrap-file')return;
    try{await garage.uploadWrap(e.target.files[0]);if($('workshop-status'))$('workshop-status').textContent='Textura UV aplicada durante esta sesión.';}catch(error){if($('workshop-status'))$('workshop-status').textContent=error.message;}
  });
  $('result-overlay').addEventListener('click',e=>{
    if(!activeReport)return;
    const tab=e.target.closest('[data-results-tab]')?.dataset.resultsTab,metric=e.target.closest('[data-results-metric]')?.dataset.resultsMetric;
    if(['times','ranking','field'].includes(tab)){activeReport.tab=tab;paintResult(true);$('result-content').querySelector(`[data-results-tab="${tab}"]`).focus({preventScroll:true});}
    if(['lap','total'].includes(metric)){activeReport.metric=metric;paintResult(true);$('result-content').querySelector(`[data-results-metric="${metric}"]`).focus({preventScroll:true});}
    if(e.target.closest('[data-results-reload]')){calculateRanking(activeReport);paintResult(true);}
    const action=e.target.closest('[data-result]')?.dataset.result;if(action==='hub'){leaguePage='home';leagueSelection=null;showHub();}if(action==='retry'){if(leagueAttempt){const id=leagueAttempt.eventId;leagueAttempt=null;if(id==='quick'){showHub();showSetup();}else launchLeague(id);}else reset();}
  });
}

function frame(now){
  if(document.hidden){lastFrame=now;requestAnimationFrame(frame);return;}
  if(!['running','countdown'].includes(state)&&!workbench?.visible&&now-lastFrame<1000/(garage?.visible?60:30)){requestAnimationFrame(frame);return;}
  const cpuStart=performance.now(),rawDt=(now-lastFrame)/1000,dt=Math.min(rawDt,.25);lastFrame=now;
  pollGamepad(now,dt);
  if(state==='countdown'){const previous=Math.ceil(countdown);countdown-=dt;const step=Math.max(0,Math.ceil(countdown));if(step!==previous)audio.countdown(step);$('countdown').textContent=step>0?String(step):'';if(countdown<=0){setState('running');toast(matchMedia('(pointer:coarse),(max-width:760px),(max-width:1000px) and (max-height:500px)').matches?'¡A rodar!':'¡A rodar! ← → para girar',false);}}
  if(state==='running'){
    const input=inputDevice==='gamepad'&&gamepadState?{steer:gamepadState.steer,brake:gamepadState.brake>.05?gamepadState.brake:0,throttle:gamepadState.throttle}:readDrivingInput(keys,pointers),steps=simulationClock.advance(dt);
    for(let i=0;i<steps;i++){
      const drivingInput=testPilot?testPilot.input(FIXED_STEP,drive,{race,surface:settings.surface,weather:settings.weather,pace:settings.pace}):input;
      if(race){
        const previous=race.player.tracker.lapTimes.length,done=race.step(FIXED_STEP,drivingInput,settings.surface,settings.weather,settings.pace);
        const completed=race.player.tracker.lapTimes.length>previous;
        recordGhost(race.elapsed,completed?race.player.tracker.lapStartedAt:null);
        if(completed)resultRecords.recordLap(timingContext,race.player.tracker.lapTimes.at(-1));
        if(done){finish(race.player.finishTime);break;}
      }
      else{
        drive.step(FIXED_STEP,drivingInput.steer,settings.surface,settings.weather,settings.pace,drivingInput.brake,drivingInput.throttle??1);
        if(drive.respawned){laps.rewind(drive.road.progress);toast('No has alcanzado la recepción · Reintenta el salto con más velocidad');}
        const lap=laps.step(FIXED_STEP,drive.road.progress);
        recordGhost(laps.elapsed,lap?laps.lapStartedAt:null);
        if(lap){finish(lap);if(state!=='running')break;}
      }
    }
  }
  if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.add('hidden');}
  uiTimer+=dt;if(uiTimer>1/20){if(['running','countdown'].includes(state)){updateHUD();drawMap();}updatePreferencesReadout();uiTimer=0;}
  updateAudio(state==='running');const renderDrive=drive.interpolated(state==='running'||state==='paused'?simulationClock.alpha:1);
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
