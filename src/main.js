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
import './race.css';
import { TRACKS, SURFACES, WEATHER, PACES, VEHICLES, CHAMPIONSHIP } from './config.js';
import { Circuit } from './circuit.js';
import { DriveModel, LapTracker, formatTime } from './physics.js';
import { World } from './world.js';
import { EngineAudio } from './audio.js';
import { PerformanceStats, AdaptiveResolution } from './performance.js';
import { FixedStepClock, FIXED_STEP } from './timing.js';

import { Career } from './career.js';
import { renderHub, renderGarage, renderGarageDetail, renderTargets, renderResult } from './career-ui.js';
import { carIllustration } from './vehicles.js';
import { GarageView } from './garage.js';
import { renderGarageRoster } from './vehicle-collection-ui.js';
import { EnvironmentStudio } from './environment-studio.js';
import { TrackWorkbench } from './track-workbench.js';
import { readDrivingInput } from './input.js';
import { RaceSession,makeRaceTrack } from './race.js';
import { availableRaceTracks,renderRaceSetup,renderRaceHUD,renderRaceResult } from './race-ui.js';

const $ = id => document.getElementById(id);
const icons = {
  camera: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 4L5.5 6H3.5A1.5 1.5 0 002 7.5v7A1.5 1.5 0 003.5 16h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0016.5 6H14l-1-2H7Z" stroke="currentColor" stroke-width="1.3"/><circle cx="10" cy="10.5" r="3" stroke="currentColor" stroke-width="1.3"/></svg>',
  mute: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M9 4L5 7H2v6h3l4 3V4ZM13 8L17 12M17 8L13 12" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  sound: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M9 4L5 7H2v6h3l4 3V4ZM12 7c2 1.5 2 4.5 0 6M15 4c4 3 4 9 0 12" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
};
let storage;
try { storage = localStorage; } catch { storage = null; }
const career = new Career(storage);
const settings = { track: TRACKS[0], vehicle: VEHICLES[0], surface: 'track', weather: 'clear', pace: 'normal', camera: 'topdown', mode: 'career' };
let activeEvent = CHAMPIONSHIP.events[0], world, circuit, drive, laps, best = null, state = 'loading', countdown = 0, toastTime = 0, finishedTime = null;
let lastFrame = performance.now(), uiTimer = 0, mapProjection, modalFocus, garage;
let workbench,kitFocus;
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
  best = null;
  if (settings.mode === 'career') best = career.best(activeEvent.id);
  else if(settings.mode==='practice')try { const value = Number(storage?.getItem(recordKey())); if (value > 0 && value < 3600 && Number.isFinite(value)) best = value; } catch { /* Session-only records remain available. */ }
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

function refreshCareer() { $('career-hub').innerHTML = renderHub(career, trackSVG, state !== 'loading'); }
function showHub() {
  if (!world || state === 'loading') return;
  closeGarage(); setLab(false); refreshCareer(); setState('hub');
}
function selectEvent(id) {
  if (!career.eventAvailable(id) || !world || state === 'loading') return;
  activeEvent = CHAMPIONSHIP.events.find(e => e.id === id);
  if (!activeEvent) return;
  const track = TRACKS.find(t => t.id === activeEvent.track), rebuild = track !== settings.track;
  Object.assign(settings, { mode:'career', track, vehicle:VEHICLES.find(v=>v.id===activeEvent.vehicle), weather:activeEvent.weather, surface:'track', pace:'normal' });
  closeGarage(); makeSession(rebuild); setLab(false);
}
function practice(vehicleId = settings.vehicle.id) {
  if (!world || state === 'loading' || !(career.unlocked.includes(vehicleId)||VEHICLES.some(v=>v.id===vehicleId&&v.prototype))) return;
  Object.assign(settings, { mode:'practice', vehicle:VEHICLES.find(v=>v.id===vehicleId), surface:'track', weather:settings.track.weather, pace:'normal' });
  closeGarage(); makeSession(false); setLab(false);
}
function openGarage(inspectId) {
  if (!world || state === 'loading') return;
  if (garage?.visible) return;
  modalFocus = document.activeElement;
  if (state === 'running') setState('paused'); else if (state === 'countdown') setState('ready');
  $('garage-content').innerHTML = renderGarage(career, settings.vehicle.id);
  $('garage-overlay').classList.remove('hidden');
  garage ||= new GarageView(inspectVehicle);
  garage.mount($('garage-stage'), settings.vehicle.id);
  if(typeof inspectId==='string'&&VEHICLES.some(v=>v.id===inspectId))inspectVehicle(inspectId);
  for (const node of document.querySelectorAll('header, main, #result-overlay')) node.inert=true;
  $('garage-content').querySelector('[data-action="close-garage"]').focus();
}
function closeGarage() {
  const wasOpen = !$('garage-overlay').classList.contains('hidden');
  $('garage-overlay').classList.add('hidden');
  garage?.hide();
  for (const node of document.querySelectorAll('header, main, #result-overlay')) node.inert=false;
  if (wasOpen && modalFocus?.isConnected) modalFocus.focus();
}
function openKit() {
  if(!world||state==='loading'||workbench?.visible)return;
  closeGarage();kitFocus=document.activeElement;
  if(state==='running')setState('paused');else if(state==='countdown')setState('ready');
  workbench ||= new TrackWorkbench(config=>{
    closeKit();Object.assign(settings,{mode:'practice',track:config,surface:'track',weather:config.weather||'clear',pace:'normal'});makeSession(true);setLab(false);
  },closeKit);
  $('track-kit-overlay').classList.remove('hidden');workbench.mount($('track-kit-content'));
  for(const node of document.querySelectorAll('header,main,#result-overlay'))node.inert=true;
  $('track-kit-content').querySelector('[data-kit="close"]').focus();
}
function openEnvironment(){
  if(!world||state==='loading')return;if(environmentStudio?.visible){closeEnvironment();return;}
  closeGarage();closeKit();closeRaceSetup();environmentFocus=document.activeElement;
  Object.assign(settings,{mode:'practice'});makeSession(false);setLab(false);
  environmentStudio??=new EnvironmentStudio((visual,final)=>{
    const surface=visual.theme==='reunion'?'mud':settings.surface==='mud'?'track':settings.surface;
    if(settings.weather!==visual.weather||settings.surface!==surface){settings.weather=visual.weather;settings.surface=surface;makeSession(false);}
    world.applyEnvironment(visual,final);
  },closeEnvironment,()=>world.fitEnvironmentView(),world.environmentSettings);
  $('environment-studio').classList.remove('hidden');document.body.dataset.environmentStudio='true';$('environment-btn').setAttribute('aria-expanded','true');
  for(const n of document.querySelectorAll('main,header'))n.inert=true;
  environmentStudio.mount($('environment-studio'));world.setEditorView(true,drive);$('environment-studio').querySelector('[data-env-action="close"]').focus();
}
function closeEnvironment(){
  environmentStudio?.hide();$('environment-studio').classList.add('hidden');delete document.body.dataset.environmentStudio;$('environment-btn').setAttribute('aria-expanded','false');
  world?.setEditorView(false);
  for(const n of document.querySelectorAll('main,header'))n.inert=false;
  if(environmentFocus?.isConnected)environmentFocus.focus();
}
function closeKit() {
  const open=workbench?.visible;$('track-kit-overlay').classList.add('hidden');workbench?.hide();
  if(open){for(const node of document.querySelectorAll('header,main,#result-overlay'))node.inert=false;if(kitFocus?.isConnected)kitFocus.focus();}
}
function refreshRaceSetup(){
  const active=document.activeElement,attribute=['raceCount','raceLaps','raceInteraction','raceWidth'].find(key=>active?.dataset?.[key]!=null);
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
  for(const node of document.querySelectorAll('header,main,#result-overlay'))node.inert=true;
  $('race-setup-content').querySelector('[data-race-action="close"]').focus();
}
function closeRaceSetup(){
  const wasOpen=raceSetupOpen;raceSetupOpen=false;$('race-setup-overlay').classList.add('hidden');
  if(wasOpen){for(const node of document.querySelectorAll('header,main,#result-overlay'))node.inert=false;if(raceSetupFocus?.isConnected)raceSetupFocus.focus();}
}
function launchRace(){
  const base=raceTracks.find(t=>t.id===raceOptions.trackId)||raceTracks[0],variant=makeRaceTrack(base,raceOptions.width);
  if(variant.error)return;
  closeRaceSetup();Object.assign(settings,{mode:'race',track:variant.config,surface:'track',weather:base.weather,pace:'normal',raceRules:{...raceOptions}});
  makeSession(true);setLab(false);
}
function inspectVehicle(id) {
  garage.select(id); updateGarage();
}
function updateGarage() {
  $('garage-detail').innerHTML=renderGarageDetail(career,garage.selectedId,garage.mode,garage.modelData.get(garage.selectedId)?.customization);
  $('collection-roster').innerHTML=renderGarageRoster(career,garage.selectedId,garage.page);
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
  const official=settings.mode==='career', competing=settings.mode==='race',index=CHAMPIONSHIP.events.indexOf(activeEvent);
  document.body.dataset.mode=settings.mode;
  $('session-kind').innerHTML=official?`<i></i> COPA DE INICIACIÓN · ${index+1} / 3`:competing?`<i></i> CARRERA IA · ${race.count} COCHES`:'<i></i> ENTRENAMIENTO LIBRE';
  $('intro-kicker').textContent=official?`COPA DE INICIACIÓN · PRUEBA 0${index+1}`:competing?`PARRILLA IA · ${race.lapCount} ${race.lapCount===1?'VUELTA':'VUELTAS'}`:'ENTRENAMIENTO · TU PROPIA TRAZADA';
  $('intro-title').textContent=settings.track.name;
  $('intro-description').textContent=settings.track.subtitle;
  $('intro-targets').innerHTML=official?renderTargets(settings.track):competing?`<div class="race-briefing"><span><strong>${race.count}</strong>COCHES</span><span><strong>${race.lapCount}</strong>${race.lapCount===1?'VUELTA':'VUELTAS'}</span><span><strong>${race.interaction==='ghost'?'◇':'↔'}</strong>${race.interaction==='ghost'?'GHOSTS':'CONTACTO'}</span></div>`:'<span class="practice-note">Aprende el circuito. Prueba tu coche. Mejora tu récord.</span>';
  $('intro-car').innerHTML=`${carIllustration(settings.vehicle)}<span><strong>${settings.vehicle.name}</strong>${official?'Coche y condiciones oficiales':settings.vehicle.description}</span>`;
  startButton.innerHTML=official?'Comenzar prueba <span>↗</span>':competing?'Tomar la salida <span>↗</span>':'Salir a pista <span>↗</span>';
  $('intro-race-btn').classList.toggle('hidden',official);$('intro-race-btn').textContent=competing?'Configurar parrilla →':'Competir contra IA →';
  document.querySelector('.current-time>.tiny-label').textContent=competing?'TIEMPO DE CARRERA':'TIEMPO ACTUAL';
}
function setLab(open) {
  if(settings.mode!=='practice' && open)return;
  $('lab').classList.toggle('hidden',!open);$('lab-btn').classList.toggle('active',open);$('lab-btn').setAttribute('aria-expanded',String(open));
}
function clearPointers(){pointers.clear();for(const id of ['steer-left','steer-right'])$(id).classList.remove('pressed');}
function setState(next) {
  state=next;document.body.dataset.state=next;
  $('intro').classList.toggle('hidden',next!=='ready');
  $('career-hub').classList.toggle('hidden',next!=='hub'&&next!=='loading');
  $('driving-status').classList.toggle('hidden',next!=='running');
  $('pause-overlay').classList.toggle('hidden',next!=='paused');
  $('countdown').classList.toggle('hidden',next!=='countdown');
  $('result-overlay').classList.toggle('hidden',next!=='finished');
  $('race-hud').classList.toggle('hidden',!race||!['countdown','running','paused','finished'].includes(next));
  $('pause-btn').setAttribute('aria-label',next==='paused'?'Continuar':'Pausar');$('pause-btn').textContent=next==='paused'?'▷':'Ⅱ';
  $('footer-label').textContent=next==='running'?`${settings.vehicle.name.toUpperCase()} · TU SIGUIENTE CURVA`:'BUSCA TU PROPIA TRAZADA';
  audio.update(drive?.speed||0,next==='running');keys.clear();clearPointers();
}
function makeSession(rebuild) {
  world.setVehicle(settings.vehicle);
  if(rebuild||!circuit){
    circuit=new Circuit(settings.track);world.build(circuit,settings.surface,settings.weather);
    const xs=circuit.samples.map(p=>p.x),zs=circuit.samples.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
    const scale=Math.min(290/(maxX-minX),180/(maxZ-minZ));mapProjection={minX,minZ,scale,dx:(360-(maxX-minX)*scale)/2,dz:(250-(maxZ-minZ)*scale)/2};
  }else world.setConditions(settings.surface,settings.weather);
  race=settings.mode==='race'?new RaceSession(circuit,settings.vehicle,settings.raceRules):null;
  drive=race?race.player.drive:new DriveModel(circuit,settings.vehicle);laps=new LapTracker();finishedTime=null;world.setRivals(race);
  world.cameraReady=false;world.resetDrivingEffects();simulationClock.reset();readBest();updateOptions();setState('ready');updateHUD();drawMap();
}
function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');toastTime=3.2;}
function start(){if(state!=='ready')return;setLab(false);setState('countdown');countdown=3;$('countdown').textContent='3';}
function reset(startAgain=true){if(!drive||state==='loading'||state==='hub')return;if(race)race.reset();else drive.reset(circuit);laps.reset();finishedTime=null;world.cameraReady=false;world.resetDrivingEffects();simulationClock.reset();setState('ready');updateHUD();drawMap();if(startAgain)start();}
function pause(){if(state==='running')setState('paused');else if(state==='paused')setState('running');else if(state==='countdown')setState('ready');}
function toggleCamera(){settings.camera=settings.camera==='topdown'?'chase':'topdown';$('camera-label').textContent=settings.camera==='chase'?'3ª persona':'Aérea';$('camera-btn').setAttribute('aria-label',`Cámara ${settings.camera==='chase'?'tercera persona':'aérea'}, cambiar con C`);}

function finish(lap) {
  $('result-content').classList.toggle('race-result-modal',Boolean(race));
  $('result-overlay').setAttribute('aria-label',race?'Resultado de la carrera':'Resultado de la prueba');
  if(race){
    finishedTime=race.player.finishTime;$('result-content').innerHTML=renderRaceResult(race,settings.track);setState('finished');updateHUD();$('result-content').scrollTop=0;$('result-content').querySelector('h2').focus({preventScroll:true});return;
  }
  const newRecord=best==null||lap<best;
  if(settings.mode==='practice'){
    if(newRecord){best=lap;try{storage?.setItem(recordKey(),String(lap));}catch{}$('best-time').textContent=formatTime(best);}
    toast(`${newRecord?'✦ Nuevo récord':'Vuelta completada'} · ${formatTime(lap)}`);return;
  }
  let award;
  try{award=career.record(activeEvent.id,lap,settings);}catch(error){reset(false);toast(error.message);return;}
  finishedTime=lap;best=career.best(activeEvent.id);$('best-time').textContent=formatTime(best);refreshCareer();
  $('result-content').innerHTML=renderResult({time:lap,track:settings.track,vehicle:settings.vehicle,event:activeEvent,index:CHAMPIONSHIP.events.indexOf(activeEvent),award,career,newRecord});
  setState('finished');updateHUD();$('result-content').querySelector('.primary-button').focus();
}
function updateHUD(){
  $('lap-number').textContent=race?`${race.player.tracker.lapNumber(race.lapCount)}/${race.lapCount}`:settings.mode==='career'?'01':String(laps.lap).padStart(2,'0');
  $('lap-time').textContent=formatTime(finishedTime??(race?race.elapsed:laps.time));
  if(race)$('race-hud').innerHTML=renderRaceHUD(race);
  $('speed').textContent=String(Math.round(drive.speed*3.6)).padStart(3,'0');
  const surface=circuit.surfaceAt(drive.road.progress,settings.surface);
  $('speed-fill').style.width=`${Math.min(100,drive.speed/(SURFACES[surface].speed*settings.vehicle.speed*PACES[settings.pace].speed)*100)}%`;
  $('last-time').textContent=settings.mode==='career'?`Bronce: ${formatTime(settings.track.medals.bronze)}`:laps.last?`Última: ${formatTime(laps.last)}`:'Primera vuelta pendiente';
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
  const[x,y]=project(drive.x,drive.z);ctx.save();ctx.translate(x,y);ctx.rotate(-drive.heading);ctx.beginPath();ctx.moveTo(0,9);ctx.lineTo(-6,-5);ctx.lineTo(6,-5);ctx.closePath();ctx.fillStyle=settings.vehicle.color;ctx.fill();ctx.restore();
}

function setupInput(){
  window.addEventListener('keydown',e=>{
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
      if(e.code==='Escape'){e.preventDefault();closeKit();}
      if(e.code==='Tab'){const buttons=[...$('track-kit-content').querySelectorAll('button:not(:disabled),select')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      return;
    }
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(!$('garage-overlay').classList.contains('hidden')){
      if(e.code==='Escape'){e.preventDefault();closeGarage();}
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
  for(const[id,value]of[['steer-left',-1],['steer-right',1]]){
    const button=$(id);button.addEventListener('pointerdown',e=>{if(state!=='running')return;e.preventDefault();button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,value);button.classList.add('pressed');});
    const release=e=>{pointers.delete(e.pointerId);button.classList.remove('pressed');};for(const name of['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,release);
  }
  $('start-btn').addEventListener('click',start);$('camera-btn').addEventListener('click',toggleCamera);$('hub-btn').addEventListener('click',showHub);$('garage-btn').addEventListener('click',openGarage);$('intro-back').addEventListener('click',showHub);$('pause-hub-btn').addEventListener('click',showHub);
  $('track-kit-btn').addEventListener('click',openKit);
  $('environment-btn').addEventListener('click',openEnvironment);
  $('intro-race-btn').addEventListener('click',()=>openRaceSetup(true));
  $('race-setup-overlay').addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||button.disabled)return;
    const action=button.dataset.raceAction;
    if(action==='close')closeRaceSetup();if(action==='garage'){closeRaceSetup();openGarage();}if(action==='launch')launchRace();
    for(const [key,field]of [['raceCount','count'],['raceLaps','laps'],['raceInteraction','interaction'],['raceWidth','width'],['raceDifficulty','difficulty']])if(button.dataset[key]!=null){const value=button.dataset[key];raceOptions[field]=field==='count'||field==='laps'||field==='width'&&value!=='original'?Number(value):value;refreshRaceSetup();}
  });
  $('race-setup-overlay').addEventListener('change',e=>{if(e.target.id==='race-track-select'){raceOptions.trackId=e.target.value;refreshRaceSetup();}if(e.target.id==='race-levels-select'){raceOptions.fieldLevels=e.target.value;refreshRaceSetup();}});
  $('lab-btn').addEventListener('click',()=>setLab($('lab').classList.contains('hidden')));$('lab-close').addEventListener('click',()=>setLab(false));
  for(const id of['reset-btn','restart-pause-btn'])$(id).addEventListener('click',()=>reset());$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',()=>setState('running'));
  $('sound-btn').addEventListener('click',()=>{const enabled=audio.toggle();$('sound-btn').innerHTML=enabled?icons.sound:icons.mute;$('sound-btn').setAttribute('aria-label',enabled?'Silenciar sonido':'Activar sonido');$('sound-btn').title=enabled?'Silenciar sonido':'Activar sonido';$('sound-btn').setAttribute('aria-pressed',String(enabled));});
  $('career-hub').addEventListener('click',e=>{const event=e.target.closest('[data-event]');if(event&&!event.disabled)selectEvent(event.dataset.event);const target=e.target.closest('[data-action]');if(target?.dataset.action==='practice'||target?.dataset.action==='garage')openGarage(target.dataset.garageCar);if(target?.dataset.action==='race')openRaceSetup();});
  $('garage-overlay').addEventListener('click',e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action==='close-garage'||e.target===$('garage-overlay')){closeGarage();return;}
    const page=e.target.closest('[data-collection-page]');if(page){garage.showPage(page.dataset.collectionPage);updateGarage();}
    const inspect=e.target.closest('[data-inspect]');if(inspect)inspectVehicle(inspect.dataset.inspect);
    const view=e.target.closest('[data-garage-view]');if(view){garage.setView(view.dataset.garageView);updateGarage();}
    const pilot=e.target.closest('[data-pilot]');if(pilot&&!pilot.disabled)practice(pilot.dataset.pilot);
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
  $('result-overlay').addEventListener('click',e=>{if(e.target.closest('[data-action="garage"]'))openGarage();if(e.target.closest('[data-race-action="configure"]'))openRaceSetup(true);const action=e.target.closest('[data-result]')?.dataset.result;if(action==='hub')showHub();if(action==='retry')reset();if(action==='next'){const next=CHAMPIONSHIP.events[CHAMPIONSHIP.events.indexOf(activeEvent)+1];if(next)selectEvent(next.id);}});
}

function frame(now){
  const cpuStart=performance.now(),rawDt=(now-lastFrame)/1000,dt=Math.min(rawDt,.25);lastFrame=now;
  if(state==='countdown'){countdown-=dt;$('countdown').textContent=countdown>0?String(Math.ceil(countdown)):'';if(countdown<=0){setState('running');toast('¡A rodar! ← → para girar');}}
  if(state==='running'){
    const input=readDrivingInput(keys,pointers),steps=simulationClock.advance(dt);
    for(let i=0;i<steps;i++){
      if(race){if(race.step(FIXED_STEP,input,settings.surface,settings.weather,settings.pace)){finish(race.player.finishTime);break;}}
      else{drive.step(FIXED_STEP,input.steer,settings.surface,settings.weather,settings.pace,input.brake);const lap=laps.step(FIXED_STEP,drive.road.progress);if(lap){finish(lap);if(state!=='running')break;}}
    }
  }
  if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.add('hidden');}
  uiTimer+=dt;if(uiTimer>1/20){updateHUD();drawMap();uiTimer=0;}
  audio.update(drive.speed,state==='running');const renderDrive=drive.interpolated(state==='running'||state==='paused'?simulationClock.alpha:1);
  if(workbench?.visible)workbench.update(dt);
  else if(garage?.visible)garage.update(dt);
  else {
    world.update(dt,renderDrive,settings.camera,state==='running',state!=='paused',state==='running'||state==='paused'?simulationClock.alpha:1);
    const ratio=resolution.sample(rawDt);if(Math.abs(world.renderer.getPixelRatio()-ratio)>.01)world.renderer.setPixelRatio(ratio);
  }
  performanceStats.sample(rawDt,performance.now()-cpuStart,workbench?.visible?workbench.renderer:garage?.visible?garage.renderer:world.renderer);
  requestAnimationFrame(frame);
}
async function init(){
  try{
    setupOptions();setupInput();refreshCareer();world=new World($('game'));await world.loadCar(settings.vehicle);makeSession(true);setLab(false);startButton.disabled=false;
    $('loading-status').textContent=innerWidth<=760?'Una flecha gira · Las dos juntas frenan':'← → / A D girar · Ambas: frenar · R reintentar';refreshCareer();setState('hub');lastFrame=performance.now();requestAnimationFrame(frame);
  }catch(error){console.error(error);$('fatal-error').classList.remove('hidden');$('error-message').textContent=`No se ha podido preparar la carrera. ${error.message}`;}
}
init();
