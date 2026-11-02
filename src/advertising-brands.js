/** Fictional in-universe sponsors. This is the editable source for the public asset library. */
export const BRAND_CATEGORIES={drinks:'Refrescos',music:'Apps de música',games:'Videojuegos',parts:'Piezas de vehículos'};
const records=[
 ['drinks','ZUMVIA','CHISPA EN CADA VUELTA','#f4c642','#202d27','burst','dots'],
 ['drinks','FROZIK','SODA / EXTRA FRESH','#7de1dc','#153d4a','ice','stripes'],
 ['drinks','BERRIVA','BERRY BOOST','#a72f58','#fff0d4','berry','plain'],
 ['drinks','CITRUNE','LIMÓN A FONDO','#b9dc55','#243c30','slice','stripes'],
 ['drinks','ORBLOOM','SPARKLING ENERGY','#ec7849','#39283e','orbit','dots'],
 ['drinks','NUBORA','SODA LIGERA','#ded8ef','#4c3c72','cloud','plain'],
 ['music','PULSORA','DALE PLAY A TU RITMO','#593ba8','#f0e9d9','wave','plain'],
 ['music','LOOPZI','TU MÚSICA / SIN PAUSA','#a7ef93','#163d3c','loop','stripes'],
 ['music','SONVIO','EL SONIDO TE MUEVE','#162e45','#80d9e3','play','dots'],
 ['music','TEMBLA','SUBE EL VOLUMEN','#eb6685','#342640','bars','plain'],
 ['music','RITMEO','CADA VUELTA / UN TEMAZO','#f0bd5b','#3b344a','disc','stripes'],
 ['music','AUDRIFT','STREAM YOUR DRIVE','#eae9df','#225e61','wave','dots'],
 ['games','PIXOVRA','PLAY BEYOND','#203b52','#f2cc58','pixel','plain'],
 ['games','NEXLOFT','NEW WORLDS / NEW RULES','#61b7cc','#132e42','portal','stripes'],
 ['games','QUADRIFT','BUILT TO PLAY','#e4764a','#252f39','cube','plain'],
 ['games','LEVELUME','ONE MORE TRY','#efe5cd','#664080','steps','dots'],
 ['games','BOSSRAY','SMALL TEAM / BIG GAMES','#622e4d','#f3c66c','crown','stripes'],
 ['games','ARCADRA','GOOD GAMES / GREAT RUNS','#b5d66d','#273649','cross','plain'],
 ['parts','TORQIVA','PRECISION DRIVE PARTS','#b63131','#f1e7d3','gear','plain'],
 ['parts','GRIPZEN','TYRES / FIND YOUR LINE','#212e2e','#e4e9bc','tread','stripes'],
 ['parts','BRAKVOLT','BRAKES / TOTAL CONTROL','#e8d54c','#202c3a','disc','plain'],
 ['parts','APEXORA','SUSPENSION SYSTEMS','#eae7dd','#245b75','spring','stripes'],
 ['parts','PISTORA','ENGINE COMPONENTS','#316252','#f0e3bc','piston','dots'],
 ['parts','RIMNEX','WHEELS / MADE TO MOVE','#253247','#a9cbe5','wheel','plain'],
];
export const ADVERTISING_BRANDS=records.map(([category,name,tagline,background,foreground,symbol,pattern],index)=>({id:name.toLowerCase(),name,category,tagline,background,foreground,symbol,pattern,index,file:`${name.toLowerCase()}.svg`}));
export const BRAND_ATLAS={columns:4,rows:6,tileWidth:384,tileHeight:192,width:1536,height:1152,path:'assets/advertising/atlas.svg'};
/** Stable pseudo-random sponsor per banner, including track geometry and signed side. */
export function bannerBrandIndex(circuitLength,a,b,side,offset){
  const key=[circuitLength,a,b,side,offset].map(value=>Number(value).toFixed(6)).join(':');
  let hash=2166136261;
  for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
  hash=Math.imul(hash^(hash>>>16),0x7feb352d);
  hash=Math.imul(hash^(hash>>>15),0x846ca68b);
  return ((hash^(hash>>>16))>>>0)%ADVERTISING_BRANDS.length;
}
export function brandAtlasRect(index){
  const col=index%BRAND_ATLAS.columns,row=Math.floor(index/BRAND_ATLAS.columns),pad=2;
  return {left:(col*BRAND_ATLAS.tileWidth+pad)/BRAND_ATLAS.width,right:((col+1)*BRAND_ATLAS.tileWidth-pad)/BRAND_ATLAS.width,bottom:1-((row+1)*BRAND_ATLAS.tileHeight-pad)/BRAND_ATLAS.height,top:1-(row*BRAND_ATLAS.tileHeight+pad)/BRAND_ATLAS.height};
}
