export const MAX_MANUAL_PROPS=256;
export const PROP_CATALOG=[
  {id:'pine',name:'Pino',family:'Naturaleza',color:'#49755b',radius:1.7,height:7},
  {id:'broadleaf',name:'Árbol frondoso',family:'Naturaleza',color:'#6e9658',radius:2.4,height:7},
  {id:'palm',name:'Palmera',family:'Naturaleza',color:'#648449',radius:2.6,height:8},
  {id:'rock',name:'Roca',family:'Naturaleza',color:'#92978b',radius:1.5,height:2},
  {id:'boulder',name:'Roca grande',family:'Naturaleza',color:'#8d938d',radius:3,height:4},
  {id:'shrub',name:'Arbusto',family:'Naturaleza',color:'#74904b',radius:1.3,height:1.4},
  {id:'flowers',name:'Flores',family:'Naturaleza',color:'#dab361',radius:1,height:.6},
  {id:'cone',name:'Cono',family:'Competición',color:'#db7849',radius:.35,height:1},
  {id:'barrier',name:'Barrera',family:'Competición',color:'#bbc3b7',radius:2,height:1.1},
  {id:'tires',name:'Neumáticos',family:'Competición',color:'#36433e',radius:1.2,height:1.2},
  {id:'arrow',name:'Señal de curva',family:'Competición',color:'#d9dfb1',radius:.9,height:2.5},
  {id:'lamp',name:'Farola',family:'Competición',color:'#a3b4ad',radius:.4,height:8},
  {id:'grandstand',name:'Tribuna',family:'Competición',color:'#94aaa0',radius:6.2,height:5},
  {id:'chalet',name:'Cabaña',family:'Edificios',color:'#9b6650',radius:4.3,height:5.4},
  {id:'med-house',name:'Casa mediterránea',family:'Edificios',color:'#d4b59a',radius:4.2,height:7},
  {id:'tower',name:'Edificio urbano',family:'Edificios',color:'#657d88',radius:4.8,height:22},
  {id:'kiosk',name:'Caseta de pista',family:'Edificios',color:'#b8c8b6',radius:3,height:3.5},
];
export const PROP_FAMILIES=['Naturaleza','Competición','Edificios'];
const finite=(value,fallback,min,max)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
export function normalizeProp(input){
  const definition=PROP_CATALOG.find(p=>p.id===input?.type);if(!definition)throw new Error('Tipo de prop desconocido.');
  if(typeof input.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(input.id))throw new Error('Identificador de prop no válido.');
  const position=Array.isArray(input.position)?input.position:[];
  if(position.length!==3||!position.every(v=>typeof v==='number'&&Number.isFinite(v)))throw new Error('La posición del prop debe tener tres medidas finitas.');
  return {id:input.id,type:definition.id,position:position.map((n,i)=>finite(n,0,i===1?-30:-10000,i===1?2000:10000)),rotation:((finite(input.rotation,0,-360000,360000)%360)+360)%360,scale:finite(input.scale,1,.2,5),grounded:input.grounded!==false,color:typeof input.color==='string'&&/^#[0-9a-f]{6}$/i.test(input.color)?input.color:definition.color};
}
export function normalizeProps(input=[]){
  if(!Array.isArray(input)||input.length>MAX_MANUAL_PROPS)throw new Error(`El límite es de ${MAX_MANUAL_PROPS} props manuales.`);
  const props=input.map(normalizeProp),ids=new Set(props.map(p=>p.id));if(ids.size!==props.length)throw new Error('Hay identificadores de props repetidos.');return props;
}
export function propRoadWarnings(props,circuit){
  if(!circuit)return [];
  return props.filter(p=>{const d=PROP_CATALOG.find(d=>d.id===p.type),road=circuit.nearest(p.position[0],p.position[2],{y:p.position[1]});return Math.abs(p.position[1]-road.y)<d.height*p.scale&&road.distance<circuit.widthAt(road.progress)/2+d.radius*p.scale;}).map(p=>p.id);
}
