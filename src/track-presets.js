const club=['straight','chicane','straight','hairpin-right','straight','chicane','straight','hairpin-right'];
const mountain=['ramp-up-6','straight-64','curve-wide-right','curve-wide-right','ramp-down-6','straight-64','curve-wide-right','curve-wide-right'];
export const THEMED_LAYOUTS=[
  {id:'world-woodland',name:'Claros del bosque',environmentTheme:'woodland',description:'Tramos técnicos entre árboles y claros, con dos retornos.',pieces:club},
  {id:'world-grandprix',name:'Parque de competición',environmentTheme:'grandprix',description:'Cuatro sectores de competición y grandes escapatorias.',pieces:Array.from({length:4},()=>['straight-32','sweep-left','arc-40-30-right','arc-24-60-right']).flat()},
  {id:'world-sahara',name:'Vuelta al oasis',environmentTheme:'sahara',description:'Dunas y oasis alrededor de un trazado de gran radio.',pieces:['straight-80','crest-long','arc-64-90-right','arc-64-90-right','straight-80','crest-long','arc-64-90-right','arc-64-90-right']},
  {id:'world-norway',name:'Fiordo de invierno',environmentTheme:'norway',description:'Dos cotas entre coníferas nevadas y un fiordo.',pieces:mountain},
  {id:'world-amalfi',name:'Terrazas de Amalfi',environmentTheme:'amalfi',description:'Dos serpentinas y retornos junto a terrazas mediterráneas.',pieces:['offset-left','offset-right','arc-64-180-right','offset-left','offset-right','arc-64-180-right']},
  {id:'world-tokyo',name:'Tokyo Express',environmentTheme:'tokyo',description:'Un viaducto urbano de 80 m y grandes curvas de autopista.',pieces:['ramp-up-6','viaduct','curve-wide-right','curve-wide-right','ramp-down-6','straight-80','curve-wide-right','curve-wide-right']},
  {id:'world-bund',name:'Luces del Bund',environmentTheme:'bund',description:'Un circuito urbano junto al río y al skyline nocturno.',pieces:Array.from({length:8},()=>['straight-16','curve-45-right']).flat()},
  {id:'world-pyrenees',name:'Puerto de los Pirineos',environmentTheme:'pyrenees',description:'Un puerto con subida, bajada y curvas de radio amplio.',pieces:mountain},
  {id:'world-reunion',name:'Barro de Reunión',environmentTheme:'reunion',description:'Selva húmeda, barro y cambios largos de apoyo.',pieces:['sweep-left','straight-48','curve-wide-right','curve-wide-right','sweep-left','straight-48','curve-wide-right','curve-wide-right']},
  {id:'kit-spirals-v2',name:'Espirales gemelas',description:'Dos vueltas completas con subida y bajada de 8 m.',pieces:['climb-360-right-up','climb-360-left-down']},
];
