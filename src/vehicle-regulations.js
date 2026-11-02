/** Gameplay homologation, independent of the collection a car belongs to.
 * P1–P3 are curated game classes, not estimated horsepower or real-world CV. */
import { vehicleAvailable } from './vehicles.js';
const origins={
  JP:['apex','hakone','aichi','rotor','midori','hachiro','fairwind','boxer','trailmaster'],
  US:['coda','velo','c7-sport','deuce','belvedere','stingray','mustang','camaro','charger','challenger','firebird','gto','viper','enduro','willy','bronco','raptor','superbird'],
  GB:['borough','sovereign','woking','moorland','seven'],
  DE:['kafer','bubble','gullwing','speedwell','neun','gelande','kombu','dune'],
  FR:['parisienne','montane','deesse','turbine','molsheim'],
  IT:['stelvio-suv','bambino','delta','stratos','rosso','cuneo','miura','testa','modena'],
  HR:['volt'],
};
const light=new Set(['coda','bambino','borough','kafer','parisienne','bubble','speedwell','deesse','deuce','hachiro','fairwind','willy','moorland','trailmaster','bronco','kombu','seven']);
const high=new Set(['c7-sport','viper','rosso','cuneo','testa','woking','molsheim','modena','enduro','volt']);
export const ORIGINS={JP:'Japón',US:'Estados Unidos',GB:'Reino Unido',DE:'Alemania',FR:'Francia',IT:'Italia',HR:'Croacia'};
export const CAR_CATEGORIES=[
  {id:'any',name:'Sin restricción',description:'Toda la colección'},
  {id:'japanese',name:'Japoneses',description:'Coches de origen japonés'},
  {id:'european',name:'Europeos',description:'Coches de origen europeo'},
  {id:'american',name:'Americanos',description:'Coches de Estados Unidos'},
  {id:'same-model',name:'Mismo modelo',description:'Todos corren con el coche que elijas'},
  {id:'p1',name:'P1 · Ligera',description:'Clase de juego · compactos y clásicos'},
  {id:'p2',name:'P2 · Sport',description:'Clase de juego · deportivos y rally'},
  {id:'p3',name:'P3 · Alta',description:'Clase de juego · gran rendimiento'},
];
export const vehicleOrigin=vehicle=>Object.entries(origins).find(([,ids])=>ids.includes(vehicle.id))?.[0]??null;
export const vehiclePowerClass=vehicle=>light.has(vehicle.id)?'p1':high.has(vehicle.id)?'p3':'p2';
export const carCategory=id=>CAR_CATEGORIES.find(c=>c.id===id)??CAR_CATEGORIES[0];
export function eligibleVehicles(vehicles,category='any'){
  return vehicles.filter(v=>category==='japanese'?vehicleOrigin(v)==='JP':category==='american'?vehicleOrigin(v)==='US':category==='european'?['GB','DE','FR','IT','HR'].includes(vehicleOrigin(v)):['p1','p2','p3'].includes(category)?vehiclePowerClass(v)===category:true);
}
export function opponentVehicles(vehicles,category,selected){
  return category==='same-model'?[selected]:eligibleVehicles(vehicles,category).filter(vehicleAvailable);
}
export const availableEligibleVehicles=(vehicles,category='any')=>eligibleVehicles(vehicles,category).filter(vehicleAvailable);
