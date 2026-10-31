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
import './environment-studio.css';
import './track-kit.css';
import './track-editor.css';
import './race.css';
import './playground.css';
import './mobile-gameplay.css';
import './results.css';
import './ghost.css';
import { ResultRecords,resultContext,createReport } from './results.js';
import { renderSessionResult } from './results-ui.js';
import { loadAILeaderboard } from './leaderboard.js';
import { TRACKS, SURFACES, WEATHER, PACES, VEHICLES } from './config.js';
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
import { GarageView } from './garage.js';
import { renderGarageRoster } from './vehicle-collection-ui.js';
import { EnvironmentStudio } from './environment-studio.js';
import { TrackWorkbench } from './track-workbench.js';
import { readDrivingInput,bindTouchSteering } from './input.js';
import { RaceSession,makeRaceTrack } from './race.js';
import { availableRaceTracks,renderRaceSetup,renderRaceHUD } from './race-ui.js';

const $ = id => document.getElementById(id);
const icons = {
  camera: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 4L5.5 6H3.5A1.5 1.5 0 002 7.5v7A1.5 1.5 0 003.5 16h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0016.5 6H14l-1-2H7Z" stroke="currentColor" stroke-width="1.3"/><circle cx="10" cy="10.5" r="3" stroke="currentColor" stroke-width="1.3"/></svg>',
  mute: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M9 4L5 7H2v6h3l4 3V4ZM13 8L17 12M17 8L13 12" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  sound: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M9 4L5 7H2v6h3l4 3V4ZM12 7c2 1.5 2 4.5 0 6M15 4c4 3 4 9 0 12" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
};
let storage;
try { storage = localStorage; } catch { storage = null; }
const playgroundOptions=loadPlayground(storage);
const resultRecords=new ResultRecords(storage);
const ghostRecords=new GhostRecords(storage);
let ghostRecorder,ghostLap=null;
const settings=resolvePlayground(playgroundOptions).settings;
let world, circuit, drive, laps, best = null, state = 'loading', countdown = 0, toastTime = 0, finishedTime = null;
let lastFrame = performance.now(), uiTimer = 0, mapProjection, modalFocus, garage;
let workbench,kitFocus,touchControls,garageContext='session';
let timingContext,previousPersonalLap=null,activeReport=null,leaderboardAbort;
let environmentStudio,environmentFocus;
let race=null,raceSetupOpen=false,raceSetupFocus,raceTracks=[];
const raceOptions={count:12,interaction:'ghost',laps:3,width:'original',trackId:null,difficulty:'club',fieldLevels:'mixed'};
const keys = new Set(), pointers = new Map(), audio = new EngineAudio();
const performanceStats = new PerformanceStats(), simulationClock = new FixedStepClock(), resolution = new AdaptiveResolution(devicePixelRatio);
const startButton = $('start-btn'); startButton.disabled = true;
$('camera-icon').innerHTML = icons.camera; $('sound-btn').innerHTML = icons.mute;
const thumbnails = new Map();

function recordKey() { return `roadrushers.v3.${settings.track.id}.${settings.vehicle.id}.${settings.surface}.${settings.weather}.${settings.pace}`; }
function readBest() {
  best = resultRecords.get(timingContext).bestLap;
  if(settings.mode==='practice')try { const value = Number(storage?.getItem(recordKey())); if (value > 0 && value < 3600 && Number.isFinite(value)) best = Math.min(best??Infinity,value); } catch { /* Session-only records remain available. */ }
  previousPersonalLap=best;
  $('best-time').textContent = formatTime(best);
}

function trackSVG(config) {
  if (thumbnails.has(config.id)) return thumbnails.get(config.id);
  const c = new Circuit(config), points = c.samples.filter((_, i) => i % 8 === 0);
  const xs = points.map(p => p.x), zs = points.map(p => p.z);
  const minX = Math.min(...xs), minZ = Math.min(...zs), w = Math.max(...xs)-minX, h = Math.max(...zs)-minZ, scale = Math.min(44/w,30/h);
  const coords = points.map(p => `${((p.x-minX)*scale+(50-w*scale)/2).toFixed(1)},${((p.z-minZ)*scale+(36-h*scale)/2).toFixed(1)}`).join(' ');
  const svg = `<svg class="track-thumbnail" viewBox="0 0 50 36" fill="none" aria-hidden="true"><polygon points="${coords}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  thumbnails.set(config.id, svg); return svg;
}

function refreshPlayground(){ $('playground-hub').innerHTML=renderPlayground(playgroundOptions,playgroundTracks(settings.track),state!=='loading'); }
function showHub(){
  if(!world||state==='loading')return;
  stopResultCalculation();closeGarage();closeKit();closeRaceSetup();if(environmentStudio?.visible)closeEnvironment();setLab(false);refreshPlayground();setState('hub');
}
function launchPlayground(startNow=true){
  if(!world||state==='loading')return;
  const prepared=resolvePlayground(playgroundOptions,playgroundTracks(settings.track));if(prepared.error)return;
  Object.assign(playgroundOptions,prepared.options);savePlayground(storage,playgroundOptions);
  Object.assign(settings,prepared.settings);Object.assign(raceOptions,playgroundOptions);
  closeGarage();closeRaceSetup();makeSession(true);setLab(false);if(startNow)start();
}
function selectVehicle(vehicleId){
  const vehicle=VEHICLES.find(v=>v.id===vehicleId);if(!world||state==='loading'||!vehicle)return;
  const destination=garageContext;settings.vehicle=vehicle;playgroundOptions.vehicleId=vehicleId;savePlayground(storage,playgroundOptions);
  closeGarage();makeSession(false);setLab(false);
  if(destination==='hub'){refreshPlayground();setState('hub');}else if(destination==='race-setup')openRaceSetup();
}
function cancelGarage(){const destination=garageContext;closeGarage();if(destination==='race-setup')openRaceSetup();}
function openGarage(inspectId,context) {
  if (!world || state === 'loading') return;
  if (garage?.visible) return;
  garageContext=context||(state==='hub'?'hub':'session');
  modalFocus = document.activeElement;
  if (state === 'running') setState('paused'); else if (state === 'countdown') setState('ready');
  $('garage-content').innerHTML = renderGarage(null,playgroundOptions.vehicleId,{testing:true});
  $('garage-overlay').classList.remove('hidden');
  garage ||= new GarageView(inspectVehicle);
  garage.mount($('garage-stage'),playgroundOptions.vehicleId);
  if(typeof inspectId==='string'&&VEHICLES.some(v=>v.id===inspectId))inspectVehicle(inspectId);
  for (const node of document.querySelectorAll('header.topbar, main, #result-overlay')) node.inert=true;
  $('garage-content').querySelector('[data-action="close-garage"]').focus();
}
function closeGarage() {
  const wasOpen = !$('garage-overlay').classList.contains('hidden');
  $('garage-overlay').classList.add('hidden');
  garage?.hide();
  for (const node of document.querySelectorAll('header.topbar, main, #result-overlay')) node.inert=false;
  if (wasOpen && modalFocus?.isConnected) modalFocus.focus();
}
function openKit() {
  if(!world||state==='loading'||workbench?.visible)return;
  closeGarage();kitFocus=document.activeElement;
  if(state==='running')setState('paused');else if(state==='countdown')setState('ready');
  workbench ||= new TrackWorkbench(config=>{
    closeKit();Object.assign(playgroundOptions,{trackId:config.id,width:'original',theme:'track',weather:'track',surface:'track'});settings.track=config;launchPlayground();
  },closeKit);
  $('track-kit-overlay').classList.remove('hidden');workbench.mount($('track-kit-content'));
  for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=true;
  $('track-kit-content').querySelector('[data-kit="close"]').focus();
}
function openEnvironment(){
  if(!world||state==='loading')return;if(environmentStudio?.visible){closeEnvironment();return;}
  closeGarage();closeKit();closeRaceSetup();environmentFocus=document.activeElement;
  if(state==='hub')launchPlayground(false);else if(state!=='ready')setState('ready');setLab(false);
  environmentStudio??=new EnvironmentStudio((visual,final)=>{
    const surface=visual.theme==='reunion'?'mud':settings.surface==='mud'?'track':settings.surface;
    if(settings.weather!==visual.weather||settings.surface!==surface){settings.weather=visual.weather;settings.surface=surface;makeSession(false);}
    Object.assign(playgroundOptions,{theme:visual.theme,weather:visual.weather,surface});savePlayground(storage,playgroundOptions);
    world.applyEnvironment(visual,final);
  },closeEnvironment,()=>world.fitEnvironmentView(),world.environmentSettings);
  $('environment-studio').classList.remove('hidden');document.body.dataset.environmentStudio='true';$('environment-btn').setAttribute('aria-expanded','true');
  for(const n of document.querySelectorAll('main,header.topbar'))n.inert=true;
  environmentStudio.mount($('environment-studio'),`${settings.track.id}:${settings.track.environmentTheme||'free'}`,world.environmentSettings);world.setEditorView(true,drive);$('environment-studio').querySelector('[data-env-action="close"]').focus();
}
function closeEnvironment(){
  environmentStudio?.hide();$('environment-studio').classList.add('hidden');delete document.body.dataset.environmentStudio;$('environment-btn').setAttribute('aria-expanded','false');
  world?.setEditorView(false);
  for(const n of document.querySelectorAll('main,header.topbar'))n.inert=false;
  if(environmentFocus?.isConnected)environmentFocus.focus();
}
function closeKit() {
  const open=workbench?.visible;$('track-kit-overlay').classList.add('hidden');workbench?.hide();
  if(open){for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=false;if(kitFocus?.isConnected)kitFocus.focus();}
}
function refreshRaceSetup(){
  const active=document.activeElement,attribute=['raceCount','raceLaps','raceInteraction','raceWidth','raceDifficulty'].find(key=>active?.dataset?.[key]!=null);
  const focusId=active?.id,focusValue=attribute?active.dataset[attribute]:null;
  $('race-setup-content').innerHTML=renderRaceSetup(raceOptions,raceTracks,settings.vehicle);
  if(focusId)$('race-setup-content').querySelector(`#${focusId}`)?.focus();
  else if(attribute){const key=attribute.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`);$('race-setup-content').querySelector(`[data-${key}="${focusValue}"]`)?.focus();}
}
function openRaceSetup(useCurrent=false){
  if(!world||state==='loading'||raceSetupOpen)return;
  closeGarage();closeKit();raceSetupFocus=document.activeElement;
  if(state==='running')setState('paused');else if(state==='countdown')setState('ready');
  raceTracks=availableRaceTracks(settings.track);
  if(useCurrent||!raceOptions.trackId)raceOptions.trackId=(settings.track.raceBaseConfig||settings.track).id;
  if(!raceTracks.some(t=>t.id===raceOptions.trackId))raceOptions.trackId=raceTracks[0].id;
  raceSetupOpen=true;refreshRaceSetup();$('race-setup-overlay').classList.remove('hidden');
  for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=true;
  $('race-setup-content').querySelector('[data-race-action="close"]').focus();
}
function closeRaceSetup(){
  const wasOpen=raceSetupOpen;raceSetupOpen=false;$('race-setup-overlay').classList.add('hidden');
  if(wasOpen){for(const node of document.querySelectorAll('header.topbar,main,#result-overlay'))node.inert=false;if(raceSetupFocus?.isConnected)raceSetupFocus.focus();}
}
function launchRace(){
  const base=raceTracks.find(t=>t.id===raceOptions.trackId)||raceTracks[0],variant=makeRaceTrack(base,raceOptions.width);
  if(variant.error)return;
  Object.assign(playgroundOptions,raceOptions,{mode:'race',vehicleId:settings.vehicle.id});closeRaceSetup();launchPlayground();
}
function inspectVehicle(id) {
  garage.select(id); updateGarage();
}
function updateGarage() {
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
}

function setupOptions() {
  $('track-options').innerHTML = TRACKS.map(t=>`<button class="track-option" data-track="${t.id}" aria-label="Circuito ${t.name}" aria-pressed="false">${trackSVG(t)}<span class="track-copy"><strong>${t.name}</strong><span>${t.region}</span></span><span class="track-check"></span></button>`).join('');
  $('surface-options').innerHTML = Object.entries(SURFACES).map(([id,s])=>`<button class="surface-option" data-surface="${id}" aria-label="Superficie ${s.name}" title="${s.label}" aria-pressed="false"><span class="surface-symbol">${s.symbol}</span><span>${s.name}</span></button>`).join('');
  $('weather-options').innerHTML = Object.entries(WEATHER).map(([id,w])=>`<button class="weather-option" data-weather="${id}" aria-label="Clima ${w.name}" aria-pressed="false"><span>${w.icon}</span><span>${w.name}</span></button>`).join('');
  $('pace-options').innerHTML = Object.entries(PACES).map(([id,p])=>`<button data-pace="${id}" aria-label="Ritmo ${p.name}" aria-pressed="false">${p.name}</button>`).join('');
  for (const button of document.querySelectorAll('[data-track]')) button.addEventListener('click',()=>{
    if (state === 'loading' || settings.mode !== 'practice') return;
    const track = TRACKS.find(t=>t.id===button.dataset.track); if(track===settings.track)return;
    settings.track=track;settings.surface='track';settings.weather=track.weather;makeSession(true);
  });
  for (const field of ['surface','weather','pace']) for (const button of document.querySelectorAll(`[data-${field}]`)) button.addEventListener('click',()=>{
    if (state==='loading'||settings.mode!=='practice'||settings[field]===button.dataset[field])return;
    settings[field]=button.dataset[field];makeSession(false);
  });
  $('track-surface-btn').addEventListener('click',()=>{if(settings.mode==='practice'){settings.surface='track';makeSession(false);}});
}

function updateOptions() {
  for(const field of ['track','surface','weather','pace']) for(const button of document.querySelectorAll(`[data-${field}]`)) {
    const selected=button.dataset[field]===(field==='track'?settings.track.id:settings[field]);
    button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
    if(field==='track')button.querySelector('.track-check').textContent=selected?'✓':'';
  }
  $('track-surface-btn').classList.toggle('selected',settings.surface==='track');
  $('track-surface-btn').setAttribute('aria-pressed',String(settings.surface==='track'));
  $('track-name').textContent=settings.track.name;
  const label=settings.surface==='track'?(settings.track.zones.length?'Trazado mixto':'Asfalto'):SURFACES[settings.surface].name;
  $('conditions-label').textContent=`${settings.vehicle.name} · ${label} · ${WEATHER[settings.weather].name}`;
  $('difficulty').textContent=settings.track.difficulty.toUpperCase();
  $('track-length').textContent=`${(circuit.length/1000).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})} km`;
  $('grip-label').textContent=settings.surface==='track'?'POR SECTOR':`AGARRE ${SURFACES[settings.surface].grip>6?'ALTO':SURFACES[settings.surface].grip>2.5?'MEDIO':'BAJO'}`;
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

function setLab(open) {
  if(settings.mode!=='practice' && open)return;
  $('lab').classList.toggle('hidden',!open);$('lab-btn').classList.toggle('active',open);$('lab-btn').setAttribute('aria-expanded',String(open));
}
function clearPointers(){if(touchControls)touchControls.clear();else pointers.clear();}
function setState(next) {
  state=next;document.body.dataset.state=next;
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
}
function makeSession(rebuild) {
  stopResultCalculation();
  world.setVehicle(settings.vehicle);
  if(rebuild||!circuit){
    circuit=new Circuit(settings.track);world.build(circuit,settings.surface,settings.weather);
    const xs=circuit.samples.map(p=>p.x),zs=circuit.samples.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
    const scale=Math.min(290/(maxX-minX),180/(maxZ-minZ));mapProjection={minX,minZ,scale,dx:(360-(maxX-minX)*scale)/2,dz:(250-(maxZ-minZ)*scale)/2};
  }else world.setConditions(settings.surface,settings.weather);
  race=settings.mode==='race'?new RaceSession(circuit,settings.vehicle,settings.raceRules):null;
  drive=race?race.player.drive:new DriveModel(circuit,settings.vehicle);laps=new LapTracker();finishedTime=null;world.setRivals(race);
  timingContext=resultContext(settings,circuit);
  resetGhost();world.setGhost(!race);
  world.cameraReady=false;world.resetDrivingEffects();simulationClock.reset();readBest();updateOptions();setState('ready');updateHUD();drawMap();
}
function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');toastTime=3.2;}
function start(){if(state!=='ready')return;setLab(false);setState('countdown');countdown=3;$('countdown').textContent='3';}
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
function drawMap(){
  const ctx=$('minimap').getContext('2d'),p=mapProjection,project=(x,z)=>[p.dx+(x-p.minX)*p.scale,p.dz+(z-p.minZ)*p.scale];
  ctx.clearRect(0,0,360,250);ctx.beginPath();circuit.samples.forEach((v,i)=>{const[x,y]=project(v.x,v.z);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.lineWidth=14;ctx.strokeStyle='#9eb58f22';ctx.stroke();ctx.lineWidth=4;ctx.strokeStyle='#d7e8c580';ctx.stroke();
  for(const crossing of circuit.layout?.crossings||[]){const a=circuit.at(crossing.upperProgress-.015),b=circuit.at(crossing.upperProgress+.015);ctx.beginPath();ctx.moveTo(...project(a.x,a.z));ctx.lineTo(...project(b.x,b.z));ctx.lineWidth=11;ctx.strokeStyle='#203c32';ctx.stroke();ctx.lineWidth=5;ctx.strokeStyle='#a5d5d1';ctx.stroke();}
  const start=circuit.at(0),[sx,sy]=project(start.x,start.z);ctx.beginPath();ctx.moveTo(sx-start.normal.x*9,sy-start.normal.z*9);ctx.lineTo(sx+start.normal.x*9,sy+start.normal.z*9);ctx.strokeStyle='#f8ffe3';ctx.lineWidth=4;ctx.stroke();
  for(const rival of race?.rivals||[]){const[x,y]=project(rival.drive.x,rival.drive.z);ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle=rival.color;ctx.fill();}
  const ghost=!race&&['countdown','running','paused'].includes(state)&&sampleGhost(ghostLap,laps.time);
  if(ghost){const[x,y]=project(ghost.x,ghost.z);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.strokeStyle='#8be1ee';ctx.lineWidth=1.5;ctx.stroke();}
  const[x,y]=project(drive.x,drive.z);ctx.save();ctx.translate(x,y);ctx.rotate(-drive.heading);ctx.beginPath();ctx.moveTo(0,9);ctx.lineTo(-6,-5);ctx.lineTo(6,-5);ctx.closePath();ctx.fillStyle=settings.vehicle.color;ctx.fill();ctx.restore();
}

function setupInput(){
  window.addEventListener('keydown',e=>{
    if(state==='finished'){
      if(e.code==='Escape'){e.preventDefault();showHub();}
      if(e.code==='Tab'){const items=[...$('result-content').querySelectorAll('button:not(:disabled),[tabindex="0"]')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(environmentStudio?.visible){
      if(e.code==='Escape'){e.preventDefault();closeEnvironment();}
      if(e.code==='Tab'){const items=[...$('environment-studio').querySelectorAll('button:not(:disabled),select,input:not(:disabled)')].filter(n=>n.getClientRects().length),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(raceSetupOpen){
      if(e.code==='Escape'){e.preventDefault();closeRaceSetup();}
      if(e.code==='Tab'){const items=[...$('race-setup-content').querySelectorAll('button:not(:disabled),select')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(workbench?.visible){
      if(workbench.handleKey(e))return;
      if(e.code==='Tab'){const buttons=[...$('track-kit-content').querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled):not([hidden]),summary,canvas')].filter(el=>el.getClientRects().length),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(!$('garage-overlay').classList.contains('hidden')){
      if(e.code==='Escape'){e.preventDefault();cancelGarage();}
      if(e.code==='Tab'){
        const buttons=[...$('garage-content').querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
      return;
    }
    if(['ArrowLeft','ArrowRight','Space','KeyA','KeyD','KeyC','KeyR','Escape','Enter'].includes(e.code)){
      if(e.code==='Enter'&&document.activeElement?.tagName==='BUTTON')return;
      e.preventDefault();if(!e.repeat){if(e.code==='KeyC')toggleCamera();if(e.code==='KeyR')reset();if(e.code==='Space'||e.code==='Escape')pause();if(e.code==='Enter')start();}keys.add(e.code);
    }
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  const blur=()=>{keys.clear();clearPointers();if(state==='running')setState('paused');if(state==='countdown')setState('ready');};
  window.addEventListener('blur',blur);document.addEventListener('visibilitychange',()=>{if(document.hidden)blur();});
  touchControls=bindTouchSteering($('touch-steering'),pointers,()=>state==='running');
  window.addEventListener('resize',clearPointers);
  $('start-btn').addEventListener('click',start);$('camera-btn').addEventListener('click',toggleCamera);$('hub-btn').addEventListener('click',showHub);$('garage-btn').addEventListener('click',openGarage);$('intro-back').addEventListener('click',showHub);$('pause-hub-btn').addEventListener('click',showHub);
  $('track-kit-btn').addEventListener('click',openKit);
  $('environment-btn').addEventListener('click',openEnvironment);
  $('end-session-btn').addEventListener('click',()=>{if(state==='paused')showTimingResults(false);});
  $('intro-race-btn').addEventListener('click',()=>openRaceSetup(true));
  $('race-setup-overlay').addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||button.disabled)return;
    const action=button.dataset.raceAction;
    if(action==='close')closeRaceSetup();if(action==='garage'){closeRaceSetup();openGarage(undefined,'race-setup');}if(action==='launch')launchRace();
    for(const [key,field]of [['raceCount','count'],['raceLaps','laps'],['raceInteraction','interaction'],['raceWidth','width'],['raceDifficulty','difficulty']])if(button.dataset[key]!=null){const value=button.dataset[key];raceOptions[field]=field==='count'||field==='laps'||field==='width'&&value!=='original'?Number(value):value;refreshRaceSetup();}
  });
  $('race-setup-overlay').addEventListener('change',e=>{if(e.target.id==='race-track-select'){raceOptions.trackId=e.target.value;refreshRaceSetup();}if(e.target.id==='race-levels-select'){raceOptions.fieldLevels=e.target.value;refreshRaceSetup();}});
  $('lab-btn').addEventListener('click',()=>setLab($('lab').classList.contains('hidden')));$('lab-close').addEventListener('click',()=>setLab(false));
  for(const id of['reset-btn','restart-pause-btn'])$(id).addEventListener('click',()=>reset());$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',()=>setState('running'));
  $('sound-btn').addEventListener('click',()=>{const enabled=audio.toggle();$('sound-btn').innerHTML=enabled?icons.sound:icons.mute;$('sound-btn').setAttribute('aria-label',enabled?'Silenciar sonido':'Activar sonido');$('sound-btn').title=enabled?'Silenciar sonido':'Activar sonido';$('sound-btn').setAttribute('aria-pressed',String(enabled));});
  $('playground-hub').addEventListener('click',e=>{
    const mode=e.target.closest('[data-play-mode]');if(mode){playgroundOptions.mode=mode.dataset.playMode;savePlayground(storage,playgroundOptions);refreshPlayground();}
    const action=e.target.closest('[data-play-action]')?.dataset.playAction;
    if(action==='garage')openGarage();if(action==='kit')openKit();if(action==='environment')openEnvironment();
  });
  $('playground-hub').addEventListener('change',e=>{
    const key=e.target.dataset.playground;if(!key)return;
    const value=['width','count','laps'].includes(key)&&e.target.value!=='original'?Number(e.target.value):e.target.value;
    Object.assign(playgroundOptions,normalizePlayground({...playgroundOptions,[key]:value},playgroundTracks(settings.track)));
    if(key==='trackId'&&resolvePlayground(playgroundOptions,playgroundTracks(settings.track)).error)playgroundOptions.width='original';
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
  const cpuStart=performance.now(),rawDt=(now-lastFrame)/1000,dt=Math.min(rawDt,.25);lastFrame=now;
  if(state==='countdown'){countdown-=dt;$('countdown').textContent=countdown>0?String(Math.ceil(countdown)):'';if(countdown<=0){setState('running');toast(matchMedia('(pointer:coarse),(max-width:760px),(max-width:1000px) and (max-height:500px)').matches?'¡A rodar!':'¡A rodar! ← → para girar');}}
  if(state==='running'){
    const input=readDrivingInput(keys,pointers),steps=simulationClock.advance(dt);
    for(let i=0;i<steps;i++){
      if(race){
        const previous=race.player.tracker.lapTimes.length,done=race.step(FIXED_STEP,input,settings.surface,settings.weather,settings.pace);
        const completed=race.player.tracker.lapTimes.length>previous;
        recordGhost(race.elapsed,completed?race.player.tracker.lapStartedAt:null);
        if(completed)resultRecords.recordLap(timingContext,race.player.tracker.lapTimes.at(-1));
        if(done){finish(race.player.finishTime);break;}
      }
      else{
        drive.step(FIXED_STEP,input.steer,settings.surface,settings.weather,settings.pace,input.brake);
        const lap=laps.step(FIXED_STEP,drive.road.progress);
        recordGhost(laps.elapsed,lap?laps.lapStartedAt:null);
        if(lap){finish(lap);if(state!=='running')break;}
      }
    }
  }
  if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.add('hidden');}
  uiTimer+=dt;if(uiTimer>1/20){updateHUD();drawMap();uiTimer=0;}
  audio.update(drive.speed,state==='running');const renderDrive=drive.interpolated(state==='running'||state==='paused'?simulationClock.alpha:1);
  if(workbench?.visible)workbench.update(dt);
  else if(garage?.visible)garage.update(dt);
  else {
    const ghostTime=state==='running'||state==='paused'?Math.max(0,laps.time-FIXED_STEP*(1-simulationClock.alpha)):0;
    world.ghost?.update(ghostLap,ghostTime,['countdown','running','paused'].includes(state));
    world.update(dt,renderDrive,settings.camera,state==='running',state!=='paused',state==='running'||state==='paused'?simulationClock.alpha:1);
    const ratio=resolution.sample(rawDt);if(Math.abs(world.renderer.getPixelRatio()-ratio)>.01)world.renderer.setPixelRatio(ratio);
  }
  performanceStats.sample(rawDt,performance.now()-cpuStart,workbench?.visible?workbench.renderer:garage?.visible?garage.renderer:world.renderer);
  requestAnimationFrame(frame);
}
async function init(){
  try{
    setupOptions();setupInput();refreshPlayground();world=new World($('game'));await world.loadCar(settings.vehicle);makeSession(true);setLab(false);startButton.disabled=false;
    $('loading-status').textContent=innerWidth<=760?'Mitad inferior izquierda / derecha · Ambas: freno':'← → / A D girar · Ambas: frenar · R reintentar';refreshPlayground();setState('hub');lastFrame=performance.now();requestAnimationFrame(frame);
  }catch(error){console.error(error);$('fatal-error').classList.remove('hidden');$('error-message').textContent=`No se ha podido preparar la carrera. ${error.message}`;}
}
init();
