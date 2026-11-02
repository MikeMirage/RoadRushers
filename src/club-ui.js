/** Shared navigation and local Phosphor icons for PRL's Club screens. */
const base=import.meta.env?.BASE_URL??'/';
const ICONS=new Set(['flag-checkered','garage','path','user-circle','timer','caret-right','arrow-right','gear-six','wrench','x','sliders-horizontal','caret-down','car-profile','magnifying-glass','check','map-pin','ruler','sun','cloud-rain','cloud-fog','cloud-snow','cloud-sun','info','arrow-clockwise','users-three','gauge','intersect','road-horizon','arrows-horizontal','camera','steering-wheel','tire']);
export function clubIcon(name,className=''){
  if(!ICONS.has(name))throw new Error(`Unknown Club icon: ${name}`);
  return `<img class="club-icon ${className}" src="${base}assets/prl/club/icons/${name}.svg" alt="" aria-hidden="true" width="24" height="24">`;
}
export function clubWordmark(){return '<span class="club-wordmark" aria-label="Pocket Racing League"><b aria-hidden="true">PR<span>L</span></b><small aria-hidden="true">POCKET RACING LEAGUE</small></span>';}
export function renderClubNavigation(active='race'){
  const entries=[['events','Events','flag-checkered'],['profile','Career','user-circle'],['race','Drive','steering-wheel'],['garage','Cars','garage'],['rankings','Rankings','users-three']];
  return `<nav class="club-navigation" aria-label="Navegación principal">${entries.map(([id,label,icon])=>`<button type="button" data-club-nav="${id}" aria-label="${label}" title="${label}" ${id===active?'aria-current="page"':''}>${clubIcon(icon)}<span class="club-nav-label">${label}</span></button>`).join('')}</nav>`;
}
export function countryFlag(code){return code?`<img class="country-flag" src="${base}assets/prl/club/flags/${code.toLowerCase()}.svg" width="18" height="14" alt="">`:'';}
