/** Fictional game tuning, not real-world specifications or horsepower.
 * Each row: top-speed multiplier, grip, acceleration, steering authority,
 * steering response, yaw response, breakaway, loose-surface traction.
 * Deliberate trade-offs remain within collections; no random per-car bonuses. */
const rows={
  bambino: [.88,1.10,1.18,1.25,1.30,1.19,.42,1.22],
  borough: [.98,1.18,1.16,1.16,1.23,1.13,.45,1.18],
  kafer: [.94,.98,.97,1,.96,.94,.69,1.18],
  parisienne: [.87,1.02,.91,1.07,.94,.87,.58,1.32],
  bubble: [.81,1.02,1.04,1.34,1.34,1.24,.44,1.02],
  montane: [1.07,1.14,1.18,1.10,1.16,1.10,.60,1.28],
  sovereign: [1.12,1,1.05,.91,.92,.88,.73,1.02],
  gullwing: [1.09,1.09,1.11,.96,1,.96,.65,.98],
  speedwell: [.99,1.04,1.06,1.08,1.08,1.05,.70,1.08],
  deesse: [1.02,1.13,.95,.90,.90,.88,.46,1.22],
  deuce: [1.05,.91,1.16,1.08,1.02,1.02,.82,1.02],
  belvedere: [1.04,.97,1.02,.91,.88,.86,.68,1.02],
  stingray: [1.16,1.04,1.14,1.02,1.06,1.02,.71,.97],
  mustang: [1.13,.99,1.16,1.01,1.03,1.01,.76,1.04],
  camaro: [1.14,1.02,1.20,.98,1,.97,.73,1],
  charger: [1.18,.91,1.15,.88,.84,.83,.85,.95],
  challenger: [1.16,.94,1.19,.92,.90,.88,.81,.98],
  firebird: [1.15,1.01,1.08,.96,.97,.92,.72,1],
  gto: [1.12,.96,1.13,.94,.93,.90,.79,1.03],
  viper: [1.24,1.04,1.22,1.02,1.08,1.02,.88,.92],
  hakone: [1.15,1.16,1.19,1,1.12,1.08,.53,1.25],
  aichi: [1.20,1.04,1.23,.97,1.02,.98,.78,1.08],
  rotor: [1.16,1.08,1.18,1.12,1.20,1.13,.77,1.08],
  midori: [1.18,1.20,1.17,1.09,1.13,1.10,.59,1.01],
  hachiro: [1.03,.96,1.12,1.14,1.18,1.12,.87,1.18],
  fairwind: [1.06,1,1.08,1.02,1.05,1.01,.78,1.15],
  boxer: [1.12,1.18,1.21,1.04,1.14,1.09,.48,1.62],
  delta: [1.07,1.17,1.20,1.12,1.16,1.12,.52,1.68],
  stratos: [1.12,1.06,1.22,1.18,1.22,1.17,.82,1.56],
  turbine: [1.10,1.13,1.26,1.13,1.19,1.13,.68,1.70],
  neun: [1.16,1.06,1.18,1.04,1.06,1.04,.81,1.02],
  rosso: [1.25,1.15,1.21,1.06,1.10,1.06,.74,.90],
  cuneo: [1.23,.99,1.17,.91,.92,.90,.86,.90],
  miura: [1.17,1.04,1.13,1.05,1.08,1.02,.83,.96],
  testa: [1.22,1.08,1.14,.92,.94,.91,.71,.94],
  woking: [1.27,1.18,1.24,1.10,1.16,1.12,.64,.92],
  molsheim: [1.30,1.16,1.29,.88,.93,.89,.46,.94],
  modena: [1.26,1.22,1.22,1.14,1.19,1.14,.68,.92],
  enduro: [1.21,1.12,1.19,1.07,1.10,1.05,.72,.95],
  volt: [1.29,1.24,1.32,.99,1.07,1.01,.40,.94],
  willy: [.89,1.08,1.05,1.14,1.05,1.02,.40,1.82],
  moorland: [.94,1.12,1.02,.96,.94,.90,.46,1.92],
  trailmaster: [.96,1.10,1.08,1.01,.99,.94,.54,1.88],
  bronco: [1.02,1.03,1.13,1.03,1.02,.98,.66,1.70],
  gelande: [1.04,1.18,1.09,.88,.88,.86,.38,1.86],
  raptor: [1.11,1.09,1.21,.90,.92,.88,.59,1.72],
  kombu: [.84,1.06,.88,.94,.89,.84,.51,1.26],
  dune: [1.17,1.21,1.23,1.05,1.12,1.07,.52,1.90],
  superbird: [1.20,1,1.12,.84,.87,.82,.76,1.01],
  seven: [1.08,1.14,1.23,1.23,1.26,1.19,.72,1.10],
};
const keys=['speed','grip','acceleration','turn','response','yawResponse','drift','looseGrip'];
const entry=new Set(['coda','apex','velo','bambino','borough','kafer','parisienne','bubble','kombu','willy']);
const club=new Set(['speedwell','deesse','deuce','belvedere','gto','hachiro','fairwind','moorland','trailmaster','bronco','seven']);
const elite=new Set(['viper','rosso','cuneo','testa','woking','molsheim','modena','enduro','volt','dune']);
export const factoryTier=id=>entry.has(id)?'entry':club.has(id)?'club':elite.has(id)?'elite':'sport';
export const FACTORY_RANGES={entry:[3,5],club:[3.6,5.6],sport:[4.2,6.4],elite:[5.4,7.6]};
export const COLLECTION_PERFORMANCE=Object.fromEntries(Object.entries(rows).map(([id,values])=>[id,{...Object.fromEntries(keys.map((key,i)=>[key,values[i]])),factoryTier:factoryTier(id)}]));
const normalized=(value,low,high)=>Math.max(0,Math.min(1,(value-low)/(high-low)));

/** Factory progression indices on a ten-point scale, with upgrade headroom.
 * Control combines traction and steering; drift means ease of sliding,
 * not a second measure of grip. Factory tier supplies a game progression
 * budget; these are readable game indices, not laboratory measurements. */
export function vehicleStats(v){
  const h=v.handling;
  const grip=h?v.grip*(h.frontGrip*.4+h.rearGrip*.6):v.grip;
  const response=h?h.steeringRate/12:v.response,yaw=h?h.yawRate/5.8:v.yawResponse;
  const slide=h?h.rearSlip:v.drift;
  const control=grip*.5+v.turn*.25+response*.15+yaw*.1-slide*.14;
  const [low,high]=FACTORY_RANGES[v.factoryTier??factoryTier(v.id)];
  return [normalized(v.speed,.80,1.30),normalized(control,.75,1.15),normalized(slide/grip,.32,.90)].map(value=>Math.round((low+value*(high-low))*10)/10);
}
