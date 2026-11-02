const base=import.meta.env?.BASE_URL??'/';
/** One loading illustration. Artwork is not a gameplay setting. */
export function mountBrandUI(){
  let ready=false;
  const splash=document.createElement('section');
  splash.id='prl-splash';splash.className='prl-splash';
  splash.setAttribute('role','dialog');splash.setAttribute('aria-modal','true');splash.setAttribute('aria-labelledby','prl-splash-title');
  splash.innerHTML=`<div class="prl-splash-poster"><img src="${base}assets/prl/garage.webp" alt="El paddock de Pocket Racing League" width="1140" height="2016" fetchpriority="high"></div><div class="prl-splash-content"><span class="prl-logo" aria-label="Pocket Racing League"><b aria-hidden="true">P<span>R</span>L</b><small aria-hidden="true">POCKET RACING<br>LEAGUE</small></span><span class="eyebrow">POCKET RACING LEAGUE</span><h1 id="prl-splash-title">Tu próxima<br><em>mejor vuelta.</em></h1><p>Una curva más.<br>Un segundo menos.</p><button type="button" id="prl-enter" class="primary-button" disabled>Preparando pista… <span aria-hidden="true">→</span></button><span id="prl-splash-status" role="status">Cargando tu coche y el circuito</span><small class="game-start-hint">Enter / botón de confirmar para empezar</small></div>`;
  document.body.append(splash);
  const enter=splash.querySelector('#prl-enter'),status=splash.querySelector('#prl-splash-status');
  const backgrounds=()=>document.querySelectorAll('.topbar,main');
  function dismiss(){
    splash.hidden=true;delete document.body.dataset.coverOpen;
    for(const node of backgrounds())node.inert=false;
    document.querySelector('#playground-form .primary-button')?.focus({preventScroll:true});
  }
  document.body.dataset.coverOpen='true';for(const node of backgrounds())node.inert=true;
  enter.addEventListener('click',()=>{if(ready)dismiss();});
  splash.addEventListener('keydown',event=>{
    event.stopPropagation();
    if(ready&&['Enter','Escape',' '].includes(event.key)){event.preventDefault();dismiss();}
    if(event.key==='Tab'){event.preventDefault();if(ready)enter.focus();}
  });
  return {setReady(){ready=true;enter.disabled=false;enter.innerHTML='Empezar <span aria-hidden="true">→</span>';status.textContent='Tu coche y el circuito están listos';enter.focus({preventScroll:true});},dismiss};
}
