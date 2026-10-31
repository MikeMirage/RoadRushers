/** Original RoadRushers miniatures. References describe silhouette, never badges or logos.
 * Dimensions use the existing toy scale: metres, +Y up, +Z forward.
 * Each entry has its own body stations, cabin, running gear and identifying details.
 */
export const VEHICLE_BATCHES = [
  { id: 'heritage', name: 'Clásicos europeos', subtitle: 'Pequeños iconos y gran turismo · 1938–1973' },
  { id: 'americana', name: 'Muscle & hot rods', subtitle: 'Cromados, capós largos y V8 · 1932–1992' },
  { id: 'drivers', name: 'Japón & rally', subtitle: 'Cultura de conducción · 1969–2002' },
  { id: 'exotics', name: 'Deportivos & supercoches', subtitle: 'Siluetas de circuito y carretera · 1966–2021' },
  { id: 'adventure', name: 'Aventura & especiales', subtitle: 'Del campo al paddock · 1941–2017' },
];

// Body stations: [longitudinal fraction (-1 rear, +1 nose), half-width fraction, deck height].
// Cabin: [rear sill, rear roof, front roof, front sill, roof height, roof half-width fraction].
const shapes = {
  micro: [[-1,.68,.52],[-.8,.94,.69],[-.3,1,.73],[.45,1,.69],[.83,.9,.58],[1,.65,.49]],
  box: [[-1,.86,.65],[-.85,1,.76],[-.3,1,.79],[.45,1,.77],[.9,.98,.69],[1,.83,.63]],
  round: [[-1,.6,.5],[-.85,.85,.68],[-.55,1,.78],[0,.96,.78],[.5,1,.73],[.85,.86,.61],[1,.58,.48]],
  pontoon: [[-1,.64,.47],[-.8,.94,.68],[-.52,1,.75],[-.1,.91,.7],[.4,.99,.76],[.75,.94,.65],[1,.55,.48]],
  long: [[-1,.7,.5],[-.8,.94,.7],[-.4,.98,.76],[.15,1,.77],[.65,.97,.73],[.9,.83,.6],[1,.62,.5]],
  muscle: [[-1,.87,.65],[-.85,1,.8],[-.4,1,.83],[.3,.97,.8],[.88,.98,.76],[1,.84,.66]],
  wedge: [[-1,.91,.62],[-.72,1,.74],[-.22,1,.73],[.25,.95,.69],[.72,.92,.54],[1,.76,.39]],
  exotic: [[-1,.75,.51],[-.8,1,.73],[-.45,.94,.76],[0,.93,.7],[.6,1,.65],[.88,.87,.5],[1,.66,.41]],
  utility: [[-1,.89,.8],[-.87,1,.91],[.25,1,.91],[.78,1,.84],[1,.87,.79]],
  van: [[-1,.78,.64],[-.85,1,.78],[.65,1,.78],[.92,.93,.7],[1,.7,.61]],
  seven: [[-1,.87,.58],[-.7,1,.69],[-.3,.68,.58],[.45,.57,.57],[.88,.5,.51],[1,.45,.44]],
};

const rows = [
  // TANDA 01 — European heritage. Compact/rounded/streamlined silhouettes.
  ['bambino','Bambino 59','heritage','Fiat 500 (1957)','1950s','micro','#d6e5bd',.66,1.24, .24,.24,[-.69,-.44,.18,.57,1.27,.77], 'round','fabric-roof,slats,chrome-bumpers',.68,.26],
  ['borough','Borough Cooper','heritage','Mini Cooper Mk I','1960s','box','#a53635',.69,1.27, .26,.26,[-.73,-.62,.35,.62,1.22,.85], 'round','white-roof,split-grille,chrome-bumpers',.76,.27],
  ['kafer','Käfer 63','heritage','Volkswagen Beetle','1960s','round','#d5b66d',.76,1.49, .25,.26,[-.84,-.35,.08,.54,1.3,.77], 'round','beetle-fenders,split-rear,slats,chrome-bumpers',.84,.29],
  ['parisienne','Parisienne 2','heritage','Citroën 2CV','1940s','pontoon','#80abb9',.66,1.47, .33,.27,[-.81,-.57,.23,.52,1.43,.71], 'round','fabric-roof,standalone-lamps,beetle-fenders,chrome-bumpers',.86,.28],
  ['bubble','Bubble 57','heritage','BMW Isetta','1950s','micro','#ed9b6d',.65,1.04, .24,.24,[-.86,-.48,.35,.86,1.23,.81], 'round','bubble-door,two-tone,chrome-bumpers',.58,.25],
  ['montane','Montane 110','heritage','Alpine A110 berlinette','1960s','pontoon','#4f93cb',.77,1.52, .22,.25,[-.7,-.44,.04,.47,1.06,.72], 'quad-round','fog-lamps,rear-engine,chrome-bumpers',.89,.28],
  ['sovereign','Sovereign E','heritage','Jaguar E-Type coupé','1960s','long','#366657',.77,1.85, .22,.25,[-.73,-.4,-.04,.37,1.09,.68], 'covered','oval-grille,bonnet-bulge,wire-wheels,chrome-bumpers',1.03,.29],
  ['gullwing','Silber 300','heritage','Mercedes-Benz 300 SL','1950s','pontoon','#c1c9cc',.83,1.77, .25,.25,[-.63,-.37,.06,.43,1.17,.69], 'round','side-gills,vertical-grille,wire-wheels,chrome-bumpers',1.01,.3],
  ['speedwell','Speedwell 56','heritage','Porsche 356 Speedster','1950s','round','#e8dbb9',.77,1.54, .22,.25,[-.62,-.5,-.02,.26,1.02,.73], 'round','open,low-screen,wire-wheels,chrome-bumpers',.89,.28],
  ['deesse','Déesse 21','heritage','Citroën DS','1960s','long','#b8b7a4',.8,1.94, .26,.26,[-.72,-.46,.17,.58,1.23,.77], 'covered','white-roof,covered-rear,slim-chrome',1.13,.28],
  // TANDA 02 — American power; wheelbase, roofline and nose vary per model.
  ['deuce','Deuce 32','americana','Ford hot rod de 1932','1930s','seven','#81383d',.8,1.47, .32,.25,[-.74,-.7,-.19,.06,1.37,.63], 'standalone','hotrod,open-engine,vertical-grille,chrome-bumpers',.91,.34],
  ['belvedere','Belvedere 57','americana','Chevrolet Bel Air 1957','1950s','muscle','#63b4b4',.85,1.96, .28,.25,[-.69,-.45,.14,.46,1.29,.81], 'round','fins,two-tone,white-roof,chrome-bumpers',1.13,.31],
  ['stingray','Stingray 63','americana','Chevrolet Corvette C2','1960s','pontoon','#c7cbd0',.84,1.77, .23,.25,[-.75,-.37,-.03,.4,1.08,.66], 'hidden','split-rear,side-gills,bonnet-bulge,chrome-bumpers',1,.3],
  ['mustang','Stallion 67','americana','Ford Mustang fastback','1960s','muscle','#497873',.85,1.82, .25,.25,[-.79,-.31,.02,.37,1.17,.74], 'round','split-grille,side-gills,ducktail,chrome-bumpers',1.07,.3],
  ['camaro','Rocoso SS','americana','Chevrolet Camaro 1969','1960s','muscle','#e29c40',.86,1.82, .24,.25,[-.63,-.37,.02,.39,1.13,.75], 'round','hood-scoop,ducktail,chrome-bumpers',1.05,.31],
  ['charger','Outlaw 69','americana','Dodge Charger 1969','1960s','muscle','#a74334',.88,2, .25,.25,[-.77,-.4,.02,.4,1.19,.73], 'hidden','full-grille,buttress,chrome-bumpers',1.16,.32],
  ['challenger','Challenger RT','americana','Dodge Challenger 1970','1970s','muscle','#9d76b0',.89,1.95, .26,.26,[-.62,-.38,.11,.45,1.18,.77], 'quad-round','hood-scoop,full-grille,chrome-bumpers',1.13,.32],
  ['firebird','Phoenix 77','americana','Pontiac Firebird Trans Am','1970s','wedge','#30363b',.88,1.95, .24,.26,[-.76,-.36,.08,.41,1.12,.71], 'quad-square','shaker,split-grille,ducktail,t-top,gold-wheels',1.12,.31],
  ['gto','Tempest 65','americana','Pontiac GTO 1965','1960s','muscle','#6b90b1',.84,1.94, .27,.26,[-.65,-.47,.17,.48,1.3,.78], 'stacked','split-grille,hood-scoop,chrome-bumpers',1.14,.31],
  ['viper','Venom 92','americana','Dodge Viper RT/10','1990s','exotic','#c43833',.91,1.83, .22,.25,[-.68,-.48,-.03,.35,1.09,.72], 'slim','open,side-pipes,side-gills,bonnet-bulge',1.08,.32],
  // TANDA 03 — Driver icons, homologation and rally.
  ['hakone','Hakone R34','drivers','Nissan Skyline GT-R R34','1990s','box','#5796c6',.85,1.88, .24,.26,[-.68,-.38,.16,.48,1.22,.76], 'rect','wing,round-tails,split-grille,side-skirts',1.1,.3],
  ['aichi','Aichi A80','drivers','Toyota Supra A80','1990s','exotic','#e7d8b1',.87,1.83, .23,.26,[-.7,-.3,.06,.4,1.16,.73], 'covered','hoop-wing,round-tails,oval-grille',1.06,.3],
  ['rotor','Rotor FD','drivers','Mazda RX-7 FD','1990s','exotic','#d6ab3c',.85,1.73, .22,.25,[-.65,-.31,.02,.42,1.1,.71], 'hidden','wing,round-tails,side-gills',1,.3],
  ['midori','Midori NA1','drivers','Honda NSX NA1','1990s','wedge','#c64b42',.86,1.83, .22,.25,[-.65,-.26,.23,.51,1.08,.73], 'hidden','black-roof,bridge-wing,side-intakes,tail-bar',1.08,.3],
  ['hachiro','Hachiro 86','drivers','Toyota AE86 Trueno','1980s','box','#dedfd4',.77,1.69, .23,.25,[-.79,-.35,.18,.49,1.17,.76], 'hidden','panda,ducktail,slim-chrome',1,.28],
  ['fairwind','Fairwind Z','drivers','Datsun 240Z','1970s','long','#dd773f',.79,1.77, .23,.25,[-.8,-.37,-.01,.35,1.1,.68], 'round','covered-lamps,side-gills,chrome-bumpers',1.03,.29],
  ['boxer','Boxer 22','drivers','Subaru Impreza 22B','1990s','box','#3569b6',.87,1.76, .27,.26,[-.66,-.42,.14,.5,1.24,.77], 'rect','wing,hood-scoop,fog-lamps,gold-wheels,widebody',1.02,.3],
  ['delta','Valle HF','drivers','Lancia Delta Integrale','1980s','box','#c0523e',.79,1.52, .28,.27,[-.85,-.68,.22,.56,1.3,.8], 'quad-round','rally-pod,slats,widebody,ducktail',.88,.3],
  ['stratos','Orbite HF','drivers','Lancia Stratos','1970s','wedge','#71ae66',.85,1.55, .23,.26,[-.74,-.3,.05,.48,1.08,.78], 'hidden','rally-pod,wing,louvers,short-wedge',.88,.3],
  ['turbine','Turbine 205','drivers','Peugeot 205 T16','1980s','box','#dfd8c8',.8,1.48, .29,.27,[-.9,-.73,.17,.53,1.32,.81], 'rect','widebody,side-intakes,ducktail,rally-pod',.86,.31],
  // TANDA 04 — Mid-engine silhouettes, distinctive proportions and aero.
  ['neun','Neun Turbo','exotics','Porsche 911 Turbo 930','1970s','round','#8c9794',.84,1.7, .24,.25,[-.78,-.32,.08,.47,1.19,.73], 'round','whale-tail,rear-engine,widebody',1,.3],
  ['rosso','Rosso 40','exotics','Ferrari F40','1980s','wedge','#d44737',.93,1.82, .21,.25,[-.67,-.3,.17,.52,1.05,.73], 'hidden','box-wing,louvers,side-intakes,triple-exhaust',1.08,.31],
  ['cuneo','Cuneo 84','exotics','Lamborghini Countach','1980s','wedge','#e6e1c9',.96,1.75, .21,.25,[-.66,-.34,.22,.64,1.02,.76], 'hidden','delta-wing,naca,side-intakes,louvers,widebody',1.04,.31],
  ['miura','Miura S','exotics','Lamborghini Miura','1960s','exotic','#cf9b39',.87,1.75, .22,.25,[-.66,-.28,.07,.49,1.05,.72], 'covered','eyelashes,louvers,side-gills',1.02,.3],
  ['testa','Testa 84','exotics','Ferrari Testarossa','1980s','wedge','#e7e1cf',.98,1.9, .22,.25,[-.67,-.35,.16,.51,1.08,.71], 'hidden','side-strakes,full-grille,louvers',1.12,.31],
  ['woking','Woking F1','exotics','McLaren F1','1990s','exotic','#d09038',.91,1.79, .21,.25,[-.69,-.28,.14,.56,1.08,.69], 'covered','roof-scoop,center-seat,side-intakes,round-tails',1.06,.3],
  ['molsheim','Molsheim 16','exotics','Bugatti Veyron','2000s','exotic','#558da0',.98,1.81, .23,.25,[-.66,-.31,.16,.56,1.12,.75], 'slim','horseshoe,two-tone,round-tails,side-intakes',1.07,.32],
  ['modena','Modena Z','exotics','Pagani Zonda','1990s','exotic','#b2b9b6',.97,1.9, .21,.25,[-.66,-.25,.17,.58,1.1,.6], 'triple','wing,quad-exhaust,roof-scoop,side-intakes',1.12,.31],
  ['enduro','Enduro 40','exotics','Ford GT40','1960s','wedge','#69b3c4',.93,1.75, .21,.25,[-.6,-.26,.16,.59,1.01,.71], 'covered','roof-doors,side-intakes,bonnet-vents,ducktail',1.04,.3],
  ['volt','Volt N','exotics','Rimac Nevera','2020s','exotic','#486e9a',.97,1.92, .22,.25,[-.72,-.28,.16,.57,1.12,.7], 'blade','active-wing,side-intakes,tail-bar,electric',1.14,.32],
  // TANDA 05 — Tall utilities, working vehicles and specialist racers.
  ['willy','Willy 41','adventure','Willys MB','1940s','utility','#7f8865',.78,1.43, .4,.34,[-.78,-.67,.02,.18,1.43,.82], 'round','open,flat-screen,vertical-grille,spare,jerrycan',.85,.35],
  ['moorland','Moorland 90','adventure','Land Rover Defender 90','1980s','utility','#7c998c',.81,1.53, .41,.34,[-.91,-.85,.1,.27,1.7,.88], 'round','white-roof,vertical-grille,spare,roof-rack',.91,.36],
  ['trailmaster','Trailmaster 40','adventure','Toyota Land Cruiser FJ40','1960s','utility','#bfad78',.82,1.52, .41,.34,[-.9,-.76,.09,.27,1.64,.85], 'round','white-roof,oval-grille,spare,jerrycan',.9,.36],
  ['bronco','Mesa 66','adventure','Ford Bronco primera generación','1960s','utility','#cf7752',.84,1.62, .39,.33,[-.91,-.78,.14,.36,1.62,.86], 'round','white-roof,full-grille,spare,chrome-bumpers',.97,.35],
  ['gelande','Gelände G','adventure','Mercedes-Benz Clase G','1990s','utility','#656f6e',.86,1.76, .4,.34,[-.92,-.84,.2,.36,1.74,.87], 'round','vertical-grille,spare,side-pipes,roof-rack',1.05,.36],
  ['raptor','Badlands R','adventure','Ford F-150 Raptor','2010s','utility','#c08d55',.99,2.12, .39,.32,[-.25,-.21,.27,.49,1.56,.83], 'rect','pickup,full-grille,widebody,side-skirts',1.29,.38],
  ['kombu','Kombu 64','adventure','Volkswagen Type 2 T1','1960s','van','#7fb8b4',.81,1.83, .31,.29,[-.95,-.87,.7,.94,1.8,.92], 'round','split-screen,two-tone,white-roof,van-windows,chrome-bumpers',1.06,.31],
  ['dune','Dune 959','adventure','Porsche 959 Paris-Dakar','1980s','round','#e0dbc5',.89,1.79, .38,.3,[-.76,-.32,.09,.48,1.29,.73], 'covered','bridge-wing,roof-rack,rally-pod,widebody',1.05,.35],
  ['superbird','Superbird 70','adventure','Plymouth Road Runner Superbird','1970s','muscle','#c6bd51',.89,2.15, .25,.26,[-.78,-.4,-.01,.36,1.17,.73], 'hidden','nose-cone,tall-wing,hood-scoop,chrome-bumpers',1.2,.32],
  ['seven','Club Seven','adventure','Lotus Seven / Caterham','1960s','seven','#4c8068',.83,1.51, .25,.27,[-.68,-.56,-.08,.17,1.08,.65], 'standalone','open,cycle-fenders,rollbar,vertical-grille,side-pipes',.93,.3],
];

const handling = {
  heritage: { speed:.95, grip:1.03, acceleration:1.03, turn:1.03, response:1.05, yawResponse:1, drift:.62, looseGrip:1.1, stats:[3,4,2] },
  americana: { speed:1.1, grip:.9, acceleration:1.13, turn:.95, response:.9, yawResponse:.86, drift:.74, looseGrip:.95, stats:[4,3,5] },
  drivers: { speed:1.06, grip:1.04, acceleration:1.12, turn:1, response:1, yawResponse:1, drift:.63, looseGrip:1.5, stats:[4,5,3] },
  exotics: { speed:1.17, grip:.98, acceleration:1.17, turn:.97, response:.96, yawResponse:.92, drift:.69, looseGrip:.92, stats:[5,4,4] },
  adventure: { speed:.98, grip:1.04, acceleration:1.02, turn:.98, response:.98, yawResponse:.95, drift:.6, looseGrip:1.6, stats:[3,4,2] },
};

export const NEW_VEHICLES = rows.map((r,index) => {
  const [id,name,batch,inspiration,era,shape,color,width,halfLength,clearance,tireWidth,cabin,lights,details,wheelbase,radius]=r;
  const features=details.split(','), batchIndex=VEHICLE_BATCHES.findIndex(b=>b.id===batch);
  return {
    id,name,batch,batchIndex,number:index+1,inspiration,era,color,prototype:true,
    category:VEHICLE_BATCHES[batchIndex].name.toUpperCase(),
    description:`${name}: inspirado en ${inspiration}. ${features.includes('open')?'Habitáculo abierto':'Carrocería propia'} y proporciones de miniatura.`,
    unlock:'Edición de taller · disponible en entrenamiento libre.',
    ...handling[batch],
    design:{ shape,width,halfLength,clearance,tireWidth,cabin,lights,features,wheelbase,radius,stations:shapes[shape].map(s=>[...s]) },
    modelUrl:`models/collection/${id}.glb`,
  };
});

export function collectionPage(id) {
  const vehicle=NEW_VEHICLES.find(v=>v.id===id);
  return vehicle?.batch ?? 'originals';
}

export function vehiclesOnPage(vehicles,page) {
  return vehicles.filter(v=>page==='originals'?!v.prototype:v.batch===page);
}
