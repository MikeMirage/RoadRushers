import { VEHICLES,SURFACES,WEATHER,PACES } from './config.js';
import { AI_LEVELS } from './race-driver.js';
import { CAMERA_VIEWS } from './camera-views.js';
import { CAR_CATEGORIES,carCategory,availableEligibleVehicles,vehicleOrigin,vehiclePowerClass,ORIGINS } from './vehicle-regulations.js';
import { circuitPreview } from './circuit-preview.js';
import { makeRaceTrack } from './race.js';
import { clubIcon,clubWordmark,countryFlag } from './club-ui.js';
import { CIRCUIT_THEMES } from './playground.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const SETUP_STEPS=['circuit','rules','car'];
export function renderEligibleCards(options){
  const vehicles=availableEligibleVehicles(VEHICLES.filter(v=>!options.ownedVehicleIds||options.ownedVehicleIds.includes(v.id)),options.carCategory);
  return vehicles.map(v=>`<button type="button" class="race-car-card" data-race-car="${v.id}" aria-pressed="${v.id===options.vehicleId}" aria-label="Elegir ${esc(v.name)}"><span class="race-card-art"><img data-race-thumbnail="${v.id}" alt="" width="384" height="220" hidden><span class="race-thumbnail-status">Preparando miniatura…</span></span><strong>${esc(v.name)}</strong><small title="${esc(ORIGINS[vehicleOrigin(v)]||'PRL')}">${countryFlag(vehicleOrigin(v))}<span>${vehiclePowerClass(v).toUpperCase()}</span></small>${v.id===options.vehicleId?`<span class="race-card-check">${clubIcon('check')}<span class="sr-only">Seleccionado</span></span>`:''}</button>`).join('');
}
export function renderRaceSetup(options,tracks,{step='circuit',ready=true}={}){
  const track=tracks.find(t=>t.id===options.trackId)||tracks[0],vehicle=VEHICLES.find(v=>v.id===options.vehicleId)||VEHICLES[0];
  const widths=['original',12,14,16].map(width=>({width,...makeRaceTrack(track,width)})),chosen=widths.find(w=>w.width===options.width)||widths[0];
  const preview=circuitPreview(chosen.config||track),category=carCategory(options.carCategory),eligible=availableEligibleVehicles(VEHICLES.filter(v=>!options.ownedVehicleIds||options.ownedVehicleIds.includes(v.id)),options.carCategory),index=SETUP_STEPS.indexOf(step);
  const forecastIcon={clear:'sun',rain:'cloud-rain',fog:'cloud-fog',snow:'cloud-snow',sunset:'cloud-sun'}[options.weather==='track'?track.weather:options.weather]||'sun';
  const fieldIcons={theme:'sun',trackId:'path',carCategory:'car-profile',mode:options.mode==='race'?'flag-checkered':'timer',laps:'arrow-clockwise',count:'users-three',difficulty:'gauge',interaction:'intersect',fieldLevels:'sliders-horizontal',surface:'road-horizon',weather:forecastIcon,width:'arrows-horizontal',pace:'gauge',camera:'camera'};
  const select=(key,label,values)=>{
    const option=([id,name,disabled])=>`<option value="${esc(id)}" ${options[key]===id?'selected':''} ${disabled?'disabled':''}>${esc(name)}</option>`;
    const gpIds=new Set(tracks.filter(t=>t.gp).map(t=>t.id));
    const choices=key==='trackId'&&gpIds.size?`<optgroup label="GP mundiales · 1–2 km">${values.filter(([id])=>gpIds.has(id)).map(option).join('')}</optgroup><optgroup label="Circuitos y creaciones">${values.filter(([id])=>!gpIds.has(id)).map(option).join('')}</optgroup>`:values.map(option).join('');
    return `<label class="setup-field setup-field-${key}"><span class="setup-field-caption" title="${label}">${clubIcon(fieldIcons[key])}<span class="sr-only">${label}</span></span><select data-playground="${key}">${choices}</select></label>`;
  };
  const recap=`${esc(track.name)} · ${options.mode==='race'?`${options.laps} ${options.laps===1?'vuelta':'vueltas'} · ${options.count} coches`:'Entrenamiento'}`;
  const error=track.editorError||chosen.error;
  const map=circuitPreview(chosen.config||track,{adaptive:true});
  const forecast=WEATHER[options.weather==='track'?track.weather:options.weather]?.name||'Despejado';
  const location=track.gp?`${track.gp.country} · ${track.gp.inspiration}`:(track.region||'PRL').split(' · ')[0];
  return `<section id="club-setup" class="club-setup hidden" role="dialog" aria-modal="true" aria-labelledby="club-setup-title">
    <div class="club-setup-card race-setup-screen">
      <header class="race-setup-header"><button type="button" data-setup-back class="icon-button" aria-label="${index?'Volver al paso anterior':'Volver al inicio'}">${clubIcon('caret-right','icon-back')}</button>${clubWordmark()}<h1 id="club-setup-title">${['Circuito','Reglas','Coche'][index]}</h1></header>
      <nav class="race-setup-progress" aria-label="Preparar salida">${SETUP_STEPS.map((id,i)=>`<button type="button" data-setup-go="${id}" aria-label="${['Circuito','Reglas','Coche'][i]}" title="${['Circuito','Reglas','Coche'][i]}" ${i>index?'disabled':''} ${id===step?'aria-current="step"':''}><span>0${i+1}</span>${clubIcon(['path','sliders-horizontal','car-profile'][i])}${i<index?clubIcon('check'):''}</button>`).join('')}</nav>
      <section class="setup-circuit setup-body ${step==='circuit'?'':'hidden'}" data-setup-step="circuit" aria-label="Elegir circuito">
        <div class="setup-circuit-selector">${select('trackId','Circuito',tracks.map(t=>[t.id,`${t.name}${t.editorError?' · Revisar en editor':''}`]))}
        <div class="setup-circuit-theme">${select('theme','Theme',Object.entries(CIRCUIT_THEMES))}<p class="setup-help">${options.theme==='grass'?'Hierba y equipamiento de circuito generado.':'Pista sobre una base sencilla.'}</p></div></div>
        <div class="setup-map-panel" role="img" aria-label="Trazado de ${esc(track.name)}"><div class="setup-map-svg">${map.svg}</div></div>
        <div class="setup-track-facts"><div class="setup-track-location" title="Ubicación">${clubIcon('map-pin')}<strong>${esc(location)}</strong></div><div title="Distancia">${clubIcon('ruler')}<strong>${preview.length} <span>km</span></strong></div><div title="${esc(forecast)}" aria-label="Previsión: ${esc(forecast)}">${clubIcon(forecastIcon)}<strong class="sr-only">${esc(forecast)}</strong></div></div>
        <span class="sr-only">${availableEligibleVehicles(VEHICLES.filter(v=>!options.ownedVehicleIds||options.ownedVehicleIds.includes(v.id))).length} coches disponibles · ${tracks.length} circuitos</span>
        <details class="setup-circuit-tools"><summary aria-label="Más opciones" title="Más opciones">${clubIcon('info')}${clubIcon('caret-down')}</summary>
          ${track.gp?`<details class="setup-guide"><summary>Guía de trazada</summary><ol>${track.gp.guide.map(g=>`<li><strong>${esc(g.name)}</strong><p>${esc(g.line)}</p></li>`).join('')}</ol></details>`:''}
          <button type="button" class="setup-editor-link" data-play-action="kit">${clubIcon('wrench')} ${track.editorDocument||track.savedEditor?'Editar este circuito':'Editor de pistas'} ${clubIcon('caret-right')}</button>
        </details>
      </section>
      <section class="setup-rules setup-body ${step==='rules'?'':'hidden'}" data-session="${options.mode}" data-setup-step="rules" aria-label="Elegir reglas">
        <p class="setup-recap">${clubIcon('path')} ${esc(track.name)} · ${preview.length} km</p>
        <div class="setup-category">${select('carCategory','Categoría de coches',CAR_CATEGORIES.map(c=>[c.id,c.name]))}<p>${esc(category.description)}${/^p[123]$/.test(category.id)?'. Clases de juego, sin equivalencia en CV.':''}</p></div>
        <div class="setup-rules-grid">${select('mode','Sesión',[['practice','Entrenamiento'],['race','Carrera IA']])}${select('laps','Vueltas',[1,3,5].map(n=>[n,String(n)]))}${select('count','Parrilla',[4,8,12].map(n=>[n,String(n)]))}${select('difficulty','Dificultad IA',Object.entries(AI_LEVELS).map(([id,l])=>[id,l.name]))}${select('interaction','Contacto',[['ghost','Ghosts · sin contacto'],['contact','Contacto físico']])}${select('fieldLevels','Niveles IA',[['mixed','Variados'],['uniform','Mismo nivel']])}</div>
        ${options.mode==='practice'?'<p class="setup-help">En entrenamiento conduces a solas. La parrilla y la IA se aplican al elegir Carrera IA.</p>':''}
        <details class="setup-advanced"><summary aria-label="Pista y conducción" title="Pista y conducción">${clubIcon('road-horizon')}${clubIcon('sliders-horizontal')}</summary><div class="setup-rules-grid">${select('surface','Superficie',[['track','Sectores del circuito'],...Object.entries(SURFACES).map(([id,s])=>[id,s.name])])}${select('weather','Previsión',[['track','Clima del circuito'],...Object.entries(WEATHER).map(([id,w])=>[id,w.name])])}${select('width','Anchura',widths.map(w=>[w.width,w.width==='original'?'Original':`${w.width} m`,Boolean(w.error)]))}${select('pace','Ritmo',Object.entries(PACES).map(([id,p])=>[id,p.name]))}${select('camera','Cámara',CAMERA_VIEWS.map(v=>[v.id,v.label]))}</div></details>
        <button type="button" class="setup-editor-link setup-preferences-link" data-play-action="preferences" aria-label="Controles y opciones" title="Controles y opciones">${clubIcon('gear-six')}</button>
      </section>
      <section class="setup-cars ${step==='car'?'':'hidden'}" data-setup-step="car" aria-label="Elegir coche">
        <p class="setup-recap setup-recap-icons"><span>${clubIcon('path')}${esc(track.name)}</span>${options.mode==='race'?`<span title="Vueltas">${clubIcon('arrow-clockwise')}${options.laps}</span><span title="Coches">${clubIcon('users-three')}${options.count}</span>`:clubIcon('timer')}</p><header class="race-cars-heading"><h2>${esc(category.name)}</h2><span title="Coches elegibles">${clubIcon('car-profile')}${eligible.length}</span></header>
        <div id="race-car-grid" class="race-car-grid" data-nav-list aria-label="Coches elegibles">${renderEligibleCards(options)}</div>
      </section>
      <footer class="race-setup-footer">${chosen.warnings.length?`<p class="setup-warning" role="status">Aviso: ${chosen.warnings.map(esc).join(' · ')}</p>`:''}${error?`<p role="alert" class="setup-error">${esc(error)}</p>`:''}${step==='car'?`<div class="race-car-summary"><div><strong id="race-car-selected-name">${esc(vehicle.name)}</strong></div><button type="button" data-race-facts aria-label="Ver ficha" title="Ver ficha">${clubIcon('info')}</button></div>`:''}<button type="button" class="primary-button" data-setup-next ${!ready||error?'disabled':''}>${step==='car'?'Salir a pista':'Continuar'} ${clubIcon(step==='car'?'flag-checkered':'caret-right')}</button></footer>
      <section id="race-car-facts" class="race-car-facts hidden" role="dialog" aria-modal="true" aria-label="Ficha del coche"></section>
    </div></section>`;
}
