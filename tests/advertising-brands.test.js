import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {ADVERTISING_BRANDS,BRAND_CATEGORIES,BRAND_ATLAS,brandAtlasRect,bannerBrandIndex} from '../src/advertising-brands.js';
const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
test('random banner sponsors cover the library and remain stable when reloading',()=>{
  const picks=Array.from({length:500},(_,i)=>bannerBrandIndex(1200,i/500,(i+2.5)/500,i%2?1:-1,7));
  assert.equal(new Set(picks).size,ADVERTISING_BRANDS.length);
  assert.deepEqual(picks,Array.from({length:500},(_,i)=>bannerBrandIndex(1200,i/500,(i+2.5)/500,i%2?1:-1,7)));
  assert.ok(picks.every(i=>Number.isInteger(i)&&i>=0&&i<ADVERTISING_BRANDS.length));
  assert.notDeepEqual(Array.from({length:20},(_,i)=>bannerBrandIndex(1200,i/20,(i+.1)/20,1,7)),Array.from({length:20},(_,i)=>bannerBrandIndex(1200,i/20,(i+.1)/20,-1,7)));
});
test('fictional sponsor library has complete downloadable assets, categories and readable palettes',async()=>{
  assert.equal(ADVERTISING_BRANDS.length,24);assert.equal(new Set(ADVERTISING_BRANDS.map(b=>b.id)).size,24);
  for(const key of Object.keys(BRAND_CATEGORIES))assert.equal(ADVERTISING_BRANDS.filter(b=>b.category===key).length,6);
  for(const brand of ADVERTISING_BRANDS){
    const svg=await readFile(new URL(`../public/assets/advertising/${brand.file}`,import.meta.url),'utf8');assert.ok(svg.includes(`<title>${brand.name}</title>`));assert.ok(!svg.includes('href="http'));
    const a=luminance(brand.background),b=luminance(brand.foreground);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,brand.name);
  }
  const manifest=JSON.parse(await readFile(new URL('../public/assets/advertising/manifest.json',import.meta.url),'utf8'));assert.deepEqual(manifest.brands,ADVERTISING_BRANDS);assert.deepEqual(manifest.atlas,BRAND_ATLAS);
});
test('every sponsor atlas rectangle remains inset inside its own cell',()=>{
  const centers=new Set();for(let i=0;i<24;i++){
    const r=brandAtlasRect(i);assert.ok(r.left>=0&&r.right<=1&&r.bottom>=0&&r.top<=1);assert.ok(r.left<r.right&&r.bottom<r.top);
    assert.ok(r.right-r.left<1/BRAND_ATLAS.columns);assert.ok(r.top-r.bottom<1/BRAND_ATLAS.rows);centers.add(`${r.left},${r.bottom}`);
  }assert.equal(centers.size,24);
});
