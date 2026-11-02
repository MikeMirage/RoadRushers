import {VEHICLES} from './config.js';
import {esc} from './league-ui.js';
const name=id=>VEHICLES.find(v=>v.id===id)?.name||id;
export function celebrationContent(r){
 if(r.gift)return {title:'¡Nuevo coche!',vehicle:r.gift,body:`<h2>${esc(name(r.gift))}</h2><p>Ya está en tu garaje</p>`,action:'Ver en Cars',destination:'collection'};
 if(r.type==='vehicle_upgraded')return {title:r.level===5?'¡Nivel máximo!':'Mejora instalada',vehicle:r.vehicleId,body:`<h2>${esc(name(r.vehicleId))} · N${r.level}</h2><p>${r.credits} CR · El reglamento limita tu nivel efectivo.</p>`,action:'Continuar'};
 const title=r.license?`¡Licencia ${r.license}!`:r.leagues?.length?'¡Nueva liga!':r.rank===1&&r.finished?'¡Victoria!':r.record?'¡Nuevo récord!':r.position===1?'¡Victoria!':'Carrera completada';
 return {title,vehicle:r.record?.vehicleId,body:`<strong class="celebration-net">${(r.net??r.credits)>0?'+':''}${r.net??r.credits} CR netos</strong><p>Premio ${r.credits} CR${r.entry?` · Entrada −${r.entry} CR`:''}</p>${r.cards?.map(c=>`<p class="celebration-card-award">+${c.count} cartas · ${esc(c.id?name(c.id):'Reserva '+c.reserve)}${c.id&&r.cardBalances?`<strong class="celebration-card-count">${r.cardBalances[c.id]} cartas en colección</strong>`:''}</p>`).join('')||''}${r.mastery?`<p>+${r.mastery} dominio</p>`:''}${r.contract?`<p>${esc(name(r.contract))} listo para desbloquear en Cars</p>`:''}${r.record?`<p>Récord personal ${r.record.time.toFixed(3)} s · mejora ${(r.record.previous-r.record.time).toFixed(3)} s</p>`:''}${r.leagues?.length?'<p>Nuevas ligas disponibles en Career</p>':''}`,action:'Continuar'};
}
export class EconomyCelebration {
 constructor({thumbnail,onNavigate,sound,onStateChange}){this.onStateChange=onStateChange;this.thumbnail=thumbnail;this.onNavigate=onNavigate;this.sound=sound;this.seen=new Set();this.dialog=null;}
 get visible(){return Boolean(this.dialog?.open);}
 close(){if(this.dialog?.open)this.dialog.close();}
 async show(r,{animations=true,saved=true}={}){
  if(!r||r.qualifying||r.eligible===false||this.seen.has(r.id))return;
  this.close();this.seen.add(r.id);const c=celebrationContent(r),focus=document.activeElement,d=document.createElement('dialog');this.dialog=d;d.className='economy-celebration';d.setAttribute('aria-label',c.title);
  d.innerHTML=`<header><span>PRL · ${saved?'PREMIO GUARDADO':'SOLO ESTA SESIÓN'}</span><strong data-celebration-wallet>${r.balanceAfter??''} CR</strong><button data-close aria-label="Cerrar celebración">×</button></header><div class="celebration-body"><h1>${esc(c.title)}</h1>${c.vehicle?'<img class="celebration-car" alt="'+esc(name(c.vehicle))+'" hidden>':''}<div aria-live="polite">${c.body}</div><div class="currency-flight" aria-hidden="true"></div><div class="card-flight currency-flight" aria-hidden="true"></div></div><footer><button class="primary-button" data-continue>${c.action}</button><button data-close>Cerrar</button></footer>`;
  document.body.append(d);d.showModal();this.onStateChange?.();d.querySelector('[data-close]').focus();
  let frame=null;const wallet=d.querySelector('[data-celebration-wallet]');
  const cleanup=()=>{cancelAnimationFrame(frame);d.remove();if(this.dialog===d)this.dialog=null;this.onStateChange?.();window.removeEventListener('resize',finishEffects);document.removeEventListener('visibilitychange',finishEffects);if(focus?.isConnected)focus.focus({preventScroll:true});};
  const finishEffects=()=>{cancelAnimationFrame(frame);wallet.textContent=`${r.balanceAfter??''} CR`;d.querySelectorAll('.currency-flight').forEach(layer=>layer.replaceChildren());d.classList.remove('celebration-animate');};
  d.addEventListener('close',cleanup,{once:true});d.addEventListener('click',e=>{if(e.target.closest('[data-close]'))d.close();if(e.target.closest('[data-continue]')){d.close();if(c.destination)this.onNavigate(c.destination);}});
  window.addEventListener('resize',finishEffects);document.addEventListener('visibilitychange',finishEffects);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||!animations;
  if(!reduced&&r.credits>0&&Number.isFinite(r.balanceAfter)){const start=performance.now(),before=r.balanceAfter-r.credits;const tick=now=>{const p=Math.min(1,(now-start)/1400);wallet.textContent=`${Math.round(before+r.credits*p)} CR`;if(p<1&&d.open)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);}
  if(!reduced){
    d.classList.add('celebration-animate');
    const fly=(layer,source,target,label,count)=>{if(!source||!target)return;const box=d.getBoundingClientRect(),a=source.getBoundingClientRect(),b=target.getBoundingClientRect();for(const [key,value]of Object.entries({'--sx':a.left+a.width/2-box.left,'--sy':a.top+a.height/2-box.top,'--tx':b.left+b.width/2-box.left,'--ty':b.top+b.height/2-box.top}))layer.style.setProperty(key,value+'px');layer.innerHTML=Array.from({length:count},(_,i)=>`<span style="--i:${i}">${label}</span>`).join('');};
    if(r.credits>0)fly(d.querySelector('.currency-flight'),d.querySelector('.celebration-net'),wallet,'CR',8);
    if(r.cards?.length)fly(d.querySelector('.card-flight'),d.querySelector('.celebration-net'),d.querySelector('.celebration-card-count'),'▱',4);
  }
  if(r.gift||r.license||r.position===1||r.rank===1||r.record||r.type==='vehicle_upgraded')this.sound?.();
  if(c.vehicle){try{const url=await this.thumbnail(c.vehicle);if(d.open){const img=d.querySelector('img');img.src=url;img.hidden=false;}}catch{/* Reward and close controls remain available. */}}
 }
}
