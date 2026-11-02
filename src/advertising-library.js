import {ADVERTISING_BRANDS,BRAND_CATEGORIES} from './advertising-brands.js';
const root=import.meta.env.BASE_URL;
const filters=document.querySelector('#filters'),cards=document.querySelector('#brands'),count=document.querySelector('#count');
let selected='all';
function render(){
  filters.innerHTML=[['all','Todas'],...Object.entries(BRAND_CATEGORIES)].map(([id,label])=>`<button data-category="${id}" aria-pressed="${selected===id}">${label}</button>`).join('');
  const brands=ADVERTISING_BRANDS.filter(b=>selected==='all'||b.category===selected);
  count.textContent=`${brands.length} marcas · ${selected==='all'?'Todas las categorías':BRAND_CATEGORIES[selected]}`;
  cards.innerHTML=brands.map(b=>`<article><img src="${root}assets/advertising/${b.file}" alt="${b.name} · ${b.tagline}" width="1024" height="512"><div class="caption"><div><span>${BRAND_CATEGORIES[b.category]}</span><h2>${b.name}</h2></div><a href="${root}assets/advertising/${b.file}" download aria-label="Descargar SVG de ${b.name}">SVG ↓</a></div><p>${b.tagline}</p></article>`).join('');
}
filters.addEventListener('click',e=>{const id=e.target.closest('[data-category]')?.dataset.category;if(id){selected=id;render();}});render();
