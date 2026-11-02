import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ADVERTISING_BRANDS,BRAND_ATLAS,BRAND_CATEGORIES} from '../src/advertising-brands.js';
const output=fileURLToPath(new URL('../public/assets/advertising/',import.meta.url));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
function symbol(type){
  const shapes={
    burst:'<path d="M0-77 20-29 66-46 43-5 78 25 27 29 17 78-13 40-57 65-40 15-79-5-31-24-37-72-6-44Z"/>',
    ice:'<path d="M0-75 65-37 65 38 0 75-65 38-65-37Z" fill="none" stroke-width="14"/><path d="M0-60V60M-52-30 52 30M-52 30 52-30" fill="none" stroke-width="9"/>',
    berry:'<circle cx="-28" cy="15" r="38"/><circle cx="32" cy="22" r="35"/><path d="M-12-15Q-35-73 27-70Q49-37-12-15Z"/>',
    slice:'<circle r="72" fill="none" stroke-width="14"/><path d="M0-55V55M-48-28 48 28M-48 28 48-28" fill="none" stroke-width="9"/>',
    orbit:'<circle r="29"/><ellipse rx="83" ry="36" transform="rotate(-35)" fill="none" stroke-width="12"/>',
    cloud:'<path d="M-61 38A35 35 0 0 1-44-27A50 50 0 0 1 47-22A32 32 0 0 1 63 38Z"/>',
    wave:'<path d="M-70 0Q-52-72-35 0T0 0T35 0T70 0" fill="none" stroke-width="15" stroke-linecap="round"/>',
    loop:'<path d="M0 0C-93-104-106 102 0 0S106-104 0 0" fill="none" stroke-width="18"/>',
    play:'<path d="M-45-68 70 0-45 68Z"/><path d="M-72-53V53" fill="none" stroke-width="10"/>',
    bars:'<path d="M-65-25V25M-32-60V60M0-78V78M32-50V50M65-20V20" fill="none" stroke-width="18"/>',
    disc:'<circle r="72" fill="none" stroke-width="16"/><circle r="18"/><path d="M-45-30A54 54 0 0 1 30-45" fill="none" stroke-width="8"/>',
    pixel:'<path d="M-65-65H-15V-15H-65ZM15-65H65V-15H15ZM-65 15H-15V65H-65ZM15 15H65V65H15Z"/>',
    portal:'<path d="M-65 65V-65H65V65H35V-35H-35V65Z"/><path d="M-12 65V-10H12V65Z"/>',
    cube:'<path d="M0-75 65-37V37L0 75-65 37V-37ZM-65-37 0 0 65-37M0 0V75" fill="none" stroke-width="12"/>',
    steps:'<path d="M-72 65V20H-25V-25H22V-70H70V65Z"/>',
    crown:'<path d="M-66-42-30-5 0-68 30-5 66-42 50 48H-50Z"/><path d="M-50 70H50" fill="none" stroke-width="12"/>',
    cross:'<path d="M-25-75H25V-25H75V25H25V75H-25V25H-75V-25H-25Z"/>',
    gear:'<path d="M-20-76H20L28-52 52-28 76-20V20L52 28 28 52 20 76H-20L-28 52-52 28-76 20V-20L-52-28-28-52Z"/><circle r="30" fill="var(--bg)" stroke="none"/>',
    tread:'<path d="M-60-70-15-35-60 0-15 35-60 70M10-70 55-35 10 0 55 35 10 70" fill="none" stroke-width="18"/>',
    spring:'<path d="M-55-65H55L-55-38 55-12-55 15 55 42-55 65H55" fill="none" stroke-width="12"/>',
    piston:'<path d="M-60-65H60V-5H-60ZM-15-5H15V48H-15Z"/><circle cy="60" r="25" fill="none" stroke-width="12"/>',
    wheel:'<circle r="74" fill="none" stroke-width="13"/><circle r="18"/><path d="M0-60V-15M57-18 15-5M35 49 9 13M-35 49-9 13M-57-18-15-5" fill="none" stroke-width="13"/>',
  };return shapes[type];
}
function artwork(b){
  const pattern=b.pattern==='dots'?Array.from({length:18},(_,i)=>`<circle cx="${720+i%6*53}" cy="${45+Math.floor(i/6)*205}" r="8"/>`).join(''):b.pattern==='stripes'?Array.from({length:10},(_,i)=>`<path d="M${680+i*48}-20l-160 552"/>`).join(''):'';
  return `<g style="--bg:${b.background}"><rect width="1024" height="512" fill="${b.background}"/><g fill="${b.foreground}" stroke="${b.foreground}" opacity=".12" stroke-width="16">${pattern}</g><path d="M32 470H992" stroke="${b.foreground}" stroke-width="8"/><g transform="translate(135 209)" fill="${b.foreground}" stroke="${b.foreground}" stroke-width="0">${symbol(b.symbol)}</g><g fill="${b.foreground}" font-family="Arial,Helvetica,sans-serif"><text x="251" y="243" font-size="${b.name.length>7?84:96}" font-weight="900" letter-spacing="-3">${b.name}</text><text x="255" y="303" font-size="23" font-weight="700" letter-spacing="2">${escape(b.tagline)}</text><text x="35" y="438" font-size="16" font-weight="700" letter-spacing="3">${escape(BRAND_CATEGORIES[b.category].toUpperCase())} / PRL UNIVERSE</text></g></g>`;
}
await mkdir(output,{recursive:true});
for(const b of ADVERTISING_BRANDS)await writeFile(`${output}${b.file}`,`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512" viewBox="0 0 1024 512" role="img" aria-label="${b.name}"><title>${b.name}</title>${artwork(b)}</svg>`);
const tiles=ADVERTISING_BRANDS.map((b,i)=>`<svg x="${i%4*384}" y="${Math.floor(i/4)*192}" width="384" height="192" viewBox="0 0 1024 512">${artwork(b)}</svg>`).join('');
await writeFile(`${output}atlas.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="${BRAND_ATLAS.width}" height="${BRAND_ATLAS.height}" viewBox="0 0 ${BRAND_ATLAS.width} ${BRAND_ATLAS.height}">${tiles}</svg>`);
await writeFile(`${output}manifest.json`,JSON.stringify({version:1,categories:BRAND_CATEGORIES,atlas:BRAND_ATLAS,brands:ADVERTISING_BRANDS},null,2)+'\n');
console.log(`Biblioteca publicitaria: ${ADVERTISING_BRANDS.length} marcas y un atlas en ${output}`);
