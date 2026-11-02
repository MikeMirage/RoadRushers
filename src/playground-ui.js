import { VEHICLES } from './config.js';
import { vehicleOrigin } from './vehicle-regulations.js';
import { makeRaceTrack } from './race.js';
import { circuitPreview } from './circuit-preview.js';
import { renderRaceSetup } from './race-setup-ui.js';
import { clubIcon,renderClubNavigation,countryFlag } from './club-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPlayground(options,tracks,ready=true,setupStep='circuit'){
  const vehicle=VEHICLES.find(v=>v.id===options.vehicleId)||VEHICLES[0],track=tracks.find(t=>t.id===options.trackId)||tracks[0];
  const widths=['original',12,14,16].map(width=>({width,...makeRaceTrack(track,width)})),chosen=widths.find(v=>v.width===options.width)||widths[0];
  if(track.editorError)chosen.error=track.editorError;
  const preview=circuitPreview(chosen.config||track);
  return `<form id="playground-form" class="club-home" aria-label="Preparar carrera">
    <section class="club-home-hero home-studio" aria-label="Tu miniatura">
      <div id="home-car-stage" class="club-car-stage" aria-label="Vista 3D de tu coche"><span class="club-car-loading" role="status">Preparando miniatura…</span></div>
      <button type="button" class="club-home-car-link" data-play-action="garage" aria-label="Ver garaje: ${esc(vehicle.name)}" title="Garaje">${countryFlag(vehicleOrigin(vehicle))}<strong>${esc(vehicle.name)}</strong>${clubIcon('garage')}</button>
    </section>
    <section class="club-home-controls" aria-label="Tu próxima salida">
      <button type="button" class="home-track-recap" data-play-action="tracks" aria-label="Elegir circuito" title="Circuitos">${clubIcon('path')}<span><strong>${esc(track.name)}</strong><small>${preview.length} km</small></span>${clubIcon('caret-right')}</button>
      ${chosen.error?`<p class="play-width-note invalid" role="alert">${esc(chosen.error)}</p>`:''}
      <button type="submit" class="primary-button club-launch" ${!ready||chosen.error?'disabled':''}>${ready?'Jugar':'Preparando pista…'} ${clubIcon('caret-right')}</button>
    </section>
  </form>
  ${renderClubNavigation('race')}
  ${renderRaceSetup(options,tracks,{step:setupStep,ready})}`;
}
