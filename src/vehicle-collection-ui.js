import { VEHICLES } from './config.js';
import { VEHICLE_BATCHES, collectionPage, vehiclesOnPage } from './vehicle-catalog.js';
import { loadCustomization } from './vehicle-customization.js';
import { clubIcon,clubWordmark,renderClubNavigation } from './club-ui.js';
import { PRODUCTION_VEHICLES } from './vehicle-assets.js';
import { vehicleAvailable } from './vehicles.js';

export function renderGarageRoster(career,selectedId,page=collectionPage(selectedId),testing=false){
  return vehiclesOnPage(VEHICLES,page).map(v=>`<button class="collection-car ${v.id===selectedId?'selected':''}" data-inspect="${v.id}" aria-pressed="${v.id===selectedId}" style="--car-color:${v.color}"><img class="club-car-thumb" data-car-thumbnail="${v.id}" alt="" hidden width="120" height="72"><span class="collection-number">${String(v.number??VEHICLES.indexOf(v)+1).padStart(2,'0')}<i></i></span><strong>${v.name}</strong><small>${testing?'DISPONIBLE PARA PRUEBAS':v.prototype?`${v.era} · TALLER`:career.unlocked.includes(v.id)?'EN TU COLECCIÓN':'POR DESBLOQUEAR ◇'}</small></button>`).join('');
}

export function renderGarage(career,selectedId,{testing=false,ownedVehicleIds=null}={}){
  const page=ownedVehicleIds?'owned':collectionPage(selectedId),tabs=ownedVehicleIds?[{id:'owned',name:'Tu colección'}]:[{id:'originals',name:'Serie original'},...VEHICLE_BATCHES];
  return `<header class="club-garage-topbar">${clubWordmark()}<button type="button" class="icon-button" data-action="close-garage" aria-label="Cerrar garaje">${clubIcon('x')}</button></header>
  <section class="studio-category"><h1>Garaje</h1><div class="studio-category-field"><label><span class="sr-only">Categoría de coches</span><select data-collection-category ${ownedVehicleIds?'disabled':''}>${tabs.map(b=>`<option value="${b.id}" ${b.id===page?'selected':''}>${b.name}</option>`).join('')}</select></label><span id="studio-category-count">${vehiclesOnPage(VEHICLES,page).filter(vehicleAvailable).length} disponibles</span>${clubIcon('caret-down')}</div></section>
  <div class="studio-body"><section class="studio-showroom" aria-label="Coches de esta categoría"><div id="garage-stage" class="garage-stage"></div>
    <button type="button" class="studio-arrow studio-previous" data-studio-direction="-1" aria-label="Coche anterior">${clubIcon('caret-right')}</button><button type="button" class="studio-arrow studio-next" data-studio-direction="1" aria-label="Coche siguiente">${clubIcon('caret-right')}</button>
    <div class="studio-position"><span id="studio-position-count"></span>${clubIcon('arrows-horizontal')}<small id="studio-gesture-hint" class="sr-only">Desliza para cambiar</small></div>
    <span id="studio-loading" class="studio-loading hidden" role="status">Preparando miniatura…</span>
  </section>
  <aside id="garage-detail" class="studio-detail" aria-live="polite">${renderStudioDetail(selectedId)}</aside></div>
  <footer class="studio-actions"><button type="button" class="primary-button" data-studio-panel="customize">${clubIcon('wrench')}<span>Personalizar</span>${clubIcon('caret-right')}</button><button type="button" class="studio-facts" data-studio-panel="facts" aria-label="Ver ficha" title="Ver ficha">${clubIcon('info')}</button></footer>
  ${renderClubNavigation('garage')}<section id="garage-panel" class="studio-panel hidden" role="dialog" aria-modal="true" aria-label="Detalle del coche"></section>`;
}

export function renderStudioDetail(selectedId){
  const v=VEHICLES.find(v=>v.id===selectedId)||VEHICLES[0];
  return `<h2>${v.name}</h2><p class="studio-car-era">${v.era?`${v.era.replace('s','')}`:v.category}</p><div class="studio-stats">${['Velocidad','Control','Derrape'].map((label,i)=>`<div title="${label} · De serie"><span>${clubIcon(['gauge','steering-wheel','tire'][i])}<span class="sr-only">${label}</span></span><meter min="0" max="10" value="${v.stats[i]}" aria-label="${label}: ${v.stats[i]} de 10">${v.stats[i]} / 10</meter><output class="studio-stat-value" aria-hidden="true">${v.stats[i].toFixed(1)}<small>/10</small></output></div>`).join('')}</div>`;
}

const detailTweens=new WeakMap();
export function updateStudioDetail(host,selectedId,{animate=false}={}){
  const v=VEHICLES.find(v=>v.id===selectedId)||VEHICLES[0];
  cancelAnimationFrame(detailTweens.get(host));
  const meters=[...host.querySelectorAll('meter')],outputs=[...host.querySelectorAll('.studio-stat-value')],startValues=meters.map(m=>m.value);
  host.setAttribute('aria-busy',String(animate));
  host.querySelector('h2').textContent=v.name;
  host.querySelector('.studio-car-era').textContent=v.era?v.era.replace('s',''):v.category;
  meters.forEach((meter,i)=>{meter.setAttribute('aria-label',`${['Velocidad','Control','Derrape'][i]}: ${v.stats[i]} de 10`);meter.textContent=`${v.stats[i]} / 10`;});
  const paint=t=>meters.forEach((meter,i)=>{const value=startValues[i]+(v.stats[i]-startValues[i])*t;meter.value=value;outputs[i].firstChild.nodeValue=value.toFixed(1);});
  if(!animate){paint(1);return;}
  const start=performance.now();
  const frame=now=>{
    if(!host.isConnected)return;const t=Math.min(1,(now-start)/280);paint(1-(1-t)**3);
    if(t<1)detailTweens.set(host,requestAnimationFrame(frame));else{detailTweens.delete(host);host.setAttribute('aria-busy','false');}
  };
  detailTweens.set(host,requestAnimationFrame(frame));
}

export function renderStudioPanel(selectedId,mode,cfg){
  const v=VEHICLES.find(v=>v.id===selectedId)||VEHICLES[0];
  const config=cfg??loadCustomization(v);
  const nativeWorkshop=`<div class="workshop-fields"><label>Pintura<input type="color" data-custom="color" value="${config.color}"></label><label>Tinte de lunas<input type="color" data-custom="glass" value="${config.glass}"></label><label>Opacidad de lunas<input type="range" min=".2" max="1" step=".05" data-custom="glassOpacity" value="${config.glassOpacity}"></label></div><small id="workshop-status" role="status">Ajustes guardados por coche.</small>`;
  const content=mode==='customize'?(PRODUCTION_VEHICLES[v.id]?productionWorkshop(v,config):v.prototype?workshop(v,config):nativeWorkshop):`<p>${v.description}</p>${drivingCharacter(v)}<p class="studio-note">${v.category}</p>`;
  return `<header><div><small>${v.name}</small><h2>${mode==='customize'?'Personalizar':'Ficha del coche'}</h2></div><button type="button" class="icon-button" data-studio-close-panel aria-label="Cerrar ${mode==='customize'?'personalización':'ficha'}">${clubIcon('x')}</button></header><div class="studio-panel-body">${content}</div><button type="button" class="primary-button" data-studio-close-panel>Listo ${clubIcon('caret-right')}</button>`;
}

function workshop(v,cfg){
  const options=(items,value)=>items.map(([id,label])=>`<option value="${id}" ${id===value?'selected':''}>${label}</option>`).join('');
  return `<details class="vehicle-workshop"><summary>${clubIcon('wrench')}<span>Personalizar</span>${clubIcon('caret-right')}</summary><div class="workshop-fields"><label>Pintura<input type="color" data-custom="color" value="${cfg.color}"></label><label>Segundo color<input type="color" data-custom="secondary" value="${cfg.secondary}"></label><label>Wrapping<select data-custom="wrap">${options([['none','Sin vinilo'],['stripes','Doble franja'],['checkers','Cuadros'],['diagonal','Diagonal']],cfg.wrap)}</select></label><label>Llantas<select data-custom="rim">${options([['classic','Clásicas'],['sport','5 radios'],['mesh','Multirradio'],['rally','Rally'],['offroad','Todoterreno']],cfg.rim)}</select></label><label>Color de llanta<input type="color" data-custom="rimColor" value="${cfg.rimColor}"></label><label>Neumático<select data-custom="tire">${options([['road','Carretera'],['slick','Slick'],['all-terrain','Todoterreno']],cfg.tire)}</select></label><label>Tinte de lunas<input type="color" data-custom="glass" value="${cfg.glass}"></label><label>Opacidad de lunas<input type="range" min=".2" max="1" step=".05" data-custom="glassOpacity" value="${cfg.glassOpacity}"></label></div><label class="wrap-upload">Cargar textura UV <span>PNG / JPG / WEBP</span><input type="file" id="vehicle-wrap-file" accept="image/png,image/jpeg,image/webp"></label><small id="workshop-status" role="status">Ajustes guardados por coche · Textura propia durante la sesión.</small><a class="vehicle-download" href="${import.meta.env?.BASE_URL??'/'}${v.modelUrl}" download="${v.id}.glb">Descargar modelo GLB <span>↓</span></a><a class="vehicle-download" href="${import.meta.env?.BASE_URL??'/'}models/collection/wrap-template.svg" download>Plantilla de wrapping UV <span>↓</span></a><p class="trail-ready">◇ Preparado para trails · 2 anclajes traseros y 2 de escape.</p></details>`;
}

function productionWorkshop(v,cfg){
  const options=(items,value)=>items.map(([id,label])=>`<option value="${id}" ${id===value?'selected':''}>${label}</option>`).join('');
  const path=`${import.meta.env?.BASE_URL??'/'}models/optimized/${PRODUCTION_VEHICLES[v.id]}/`;
  return `<details class="vehicle-workshop"><summary>${clubIcon('wrench')}<span>Personalizar</span>${clubIcon('caret-right')}</summary><div class="workshop-fields"><label>Pintura<input type="color" data-custom="color" value="${cfg.color}"></label><label>Acabado<select data-custom="finish">${options([['gloss','Brillante'],['satin','Satinado'],['matte','Mate']],cfg.finish)}</select></label><label>Vinilo<select data-custom="wrap">${options([['none','De fábrica'],['stripes','Doble franja'],['race','Competición']],cfg.wrap)}</select></label><label>Color de llanta<input type="color" data-custom="rimColor" value="${cfg.rimColor}"></label><label>Neumáticos<select data-custom="tire">${options([['street','Carretera'],['sport','Deportivos'],['slick','Slick']],cfg.tire)}</select></label><label>Altura de suspensión<input type="range" data-custom="rideHeight" min="-.045" max=".07" step=".005" value="${cfg.rideHeight}"></label></div><label class="wrap-upload">Cargar skin UV <span>PNG / JPG / WEBP</span><input type="file" id="vehicle-wrap-file" accept="image/png,image/jpeg,image/webp"></label><small id="workshop-status" role="status">Ajustes guardados por coche · Skin propia durante la sesión.</small><a class="vehicle-download" href="${path}skin-template.png" download>Plantilla de skin UV <span>↓</span></a><a class="vehicle-download" href="${path}garage-package.zip" download>Modelo GLB y texturas <span>↓</span></a></details>`;
}

export function renderGarageConfirm(career,selectedId,{testing=false}={}){
  const v=VEHICLES.find(v=>v.id===selectedId)||VEHICLES[0],available=testing||v.prototype||career.unlocked.includes(v.id);
  return `<button class="${available?'primary-button':'locked-button'}" data-pilot="${v.id}" ${available?'':'disabled'}>${testing?'Elegir coche':available?'Elegir y salir a pista':'Gana su desbloqueo'}${clubIcon('caret-right')}</button>`;
}

function drivingCharacter(v){
  if(!v.character)return '';
  const h=v.handling;
  return `<details class="driving-character"><summary>Carácter y conducción</summary><div class="driving-specs"><span>${h.drive==='AWD'?'Tracción integral':'Propulsión trasera'}</span><span>Reparto ${Math.round(h.frontWeight*100)}:${Math.round((1-h.frontWeight)*100)}</span></div><p><strong>A favor</strong> ${v.character.strength}</p><p><strong>A tener en cuenta</strong> ${v.character.compromise}</p><p class="driving-tip">${v.character.technique}</p><a href="${import.meta.env?.BASE_URL??'/'}vehicle-review.html" target="_blank" rel="noopener">Ver los tres modelos ↗</a></details>`;
}

export function renderGarageDetail(career,selectedId,mode,cfg,{testing=false,confirmInFooter=false}={}){
  const v=VEHICLES.find(v=>v.id===selectedId)||VEHICLES[0],available=testing||v.prototype||career.unlocked.includes(v.id),index=VEHICLES.indexOf(v);
  const choose=confirmInFooter?'':renderGarageConfirm(career,selectedId,{testing});
  return `<div class="detail-category" style="--car-color:${v.color}"><i></i>${v.prototype?VEHICLE_BATCHES.find(b=>b.id===v.batch)?.name||v.category:v.category}<span>${String(index+1).padStart(2,'0')} / ${String(VEHICLES.length).padStart(2,'0')}</span></div><h3>${v.name}</h3><p class="detail-description">${v.description}</p><div class="vehicle-stats" style="--car-color:${v.color}">${['Velocidad','Control','Derrape'].map((label,i)=>`<div><span>${label}</span><i><b style="width:${v.stats[i]*10}%"></b></i></div>`).join('')}</div>${drivingCharacter(v)}<div class="collection-ownership ${available?'owned':''}"><span>${testing?'✓ DISPONIBLE PARA PRUEBAS':v.prototype?'◇ EDICIÓN DE TALLER':available?'✓ EN TU COLECCIÓN':'◇ PRÓXIMO DESBLOQUEO'}</span><p>${testing?'Elige el coche y compáralo con la misma configuración.':v.unlock}</p></div>${mode==='overview'?`${testing?choose:''}<button class="${testing?'text-button':'primary-button'}" data-garage-view="detail">Ver en detalle <span>↗</span></button>`:`${choose}${PRODUCTION_VEHICLES[v.id]?productionWorkshop(v,cfg??loadCustomization(v)):v.prototype?workshop(v,cfg??loadCustomization(v)):'<span class="detail-note">Serie base revisada · Pintura de fábrica.</span>'}`}<span class="detail-note">${testing?'Selección libre · Configuración conservada':mode==='overview'?(v.prototype?'Diez siluetas, una época que descubrir.':'Los tres coches oficiales de la copa.'):available?'Entrenamiento libre · Récords por coche':'Puedes girarlo y explorarlo antes de ganarlo.'}</span>`;
}
