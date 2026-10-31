/** Additive expansion: original piece IDs and their geometry remain stable. */
const directions=[['left','izq.'],['right','dcha.']];
export const EXTRA_PIECES=[
  ...[4,8,16,32,48,64,80,120].map(length=>({id:`straight-${length}`,name:`Recta ${length} m`,family:'Rectas',kind:'straight',length,description:length>=64?'Recta de velocidad para parrillas largas y enlaces entre sectores.':'Conector métrico para ajustar el cierre del circuito.'})),
  ...[12,24,40,64].flatMap(radius=>[15,30,60,120].flatMap(angle=>directions.map(([direction,label])=>({id:`arc-${radius}-${angle}-${direction}`,name:`${angle}° · R${radius} ${label}`,family:'Curvas',kind:'curve',radius,angle,direction,description:`Arco de ${angle}°, radio ${radius} m. Entrada y salida horizontales.`})))),
  ...[45,90,180].flatMap(angle=>directions.map(([direction,label])=>({id:`arc-64-${angle}-${direction}`,name:`${angle}° · R64 ${label}`,family:'Curvas',kind:'curve',radius:64,angle,direction,description:'Curva de alta velocidad, con espacio para trazadas amplias.'}))),
  ...[12,24].flatMap(degrees=>directions.map(([direction,label])=>({id:`bank-${degrees}-${direction}`,name:`Peralte ${degrees}° ${label}`,family:'Peraltes',kind:'curve',radius:40,angle:90,direction,bank:(direction==='left'?1:-1)*degrees*Math.PI/180,description:'El peralte crece y desaparece progresivamente; conectores planos.'}))),
  ...directions.map(([direction,label])=>({id:`sweep-${direction}`,name:`S larga ${label}`,family:'Técnicos',kind:'chicane',length:64,amplitude:direction==='left'?6:-6,description:'Doble cambio de apoyo largo. Conserva el eje y la orientación de salida.'})),
  {id:'chicane-mirror',name:'Chicane inversa',family:'Técnicos',kind:'chicane',length:40,amplitude:-4.5,description:'La chicane original reflejada, con conectores equivalentes.'},
  ...directions.map(([direction,label])=>({id:`offset-${direction}`,name:`Desplazamiento 8 m ${label}`,family:'Técnicos',kind:'offset',length:48,amplitude:direction==='left'?8:-8,description:'Cambio de eje de 8 m, con pendiente lateral de trayectoria nula en ambos extremos.'})),
  ...[2,4,6,12].flatMap(rise=>[1,-1].map(sign=>({id:`ramp-${sign>0?'up':'down'}-${rise}`,name:`${sign>0?'Subida':'Bajada'} ${rise} m suave`,family:'Verticales',kind:'ramp',length:rise===12?72:rise===6?44:32,rise:rise*sign,description:'Transición vertical suave, con ambas conexiones horizontales.'}))),
  ...[90,180,270,360].flatMap(angle=>directions.flatMap(([direction,label])=>[1,-1].map(sign=>({id:`climb-${angle}-${direction}-${sign>0?'up':'down'}`,name:`${angle}° ${label} ${sign>0?'↑':'↓'} ${angle/45} m`,family:'Espirales',kind:'curve',radius:40,angle,direction,rise:sign*angle/45,description:'Curva con desnivel progresivo. Permite enlazar niveles y construir espirales sin cambiar de trazado.'})))),
  {id:'bridge-long',name:'Puente largo 48 m',family:'Estructuras',kind:'bridge',length:48,description:'Tablero elevado con canto y apoyos fuera de la vía inferior.'},
  {id:'viaduct',name:'Viaducto 80 m',family:'Estructuras',kind:'bridge',length:80,description:'Tablero largo para cruzar valles y sectores inferiores. Requiere cota de 6 m.'},
  ...[24,48,80].map(length=>({id:`tunnel-${length}`,name:`Túnel ${length} m`,family:'Estructuras',kind:'tunnel',length,description:'Galería con techo, laterales y portales. Gálibo libre de 4,8 m.'})),
  {id:'crest-soft',name:'Loma suave 1 m',family:'Relieve',kind:'bumps',length:40,height:1,waves:1,description:'Cambio suave de carga, sin salto forzado a baja velocidad.'},
  {id:'crest-long',name:'Cresta larga 2 m',family:'Relieve',kind:'bumps',length:48,height:2,waves:1,description:'Cresta de gran radio para circuitos de montaña.'},
  {id:'rumble',name:'Ondulaciones suaves',family:'Relieve',kind:'bumps',length:48,height:.18,waves:4,description:'Cuatro cambios suaves de carga; geometría física y visual idéntica.'},
  ...[[1.2,'12'],[1.4,'14'],[1.6,'16'],[1,'10']].map(([widthFactorTo,label])=>({id:`width-${label}`,name:`Transición a ${label} m`,family:'Anchuras',kind:'straight',length:32,widthFactorTo,description:'Apertura o cierre progresivo. La anchura se conserva en las piezas siguientes; medidas relativas a base 10 m.'})),
  ...[['asphalt','Asfalto'],['gravel','Grava'],['dirt','Tierra'],['ice','Hielo'],['mud','Barro']].flatMap(([surface,label])=>[24,48].map(length=>({id:`surface-${surface}-${length}`,name:`${label} ${length} m`,family:'Superficies',kind:'straight',length,surface,description:'Superficie propia del módulo, compartida por materiales, agarre y efectos de ruedas.'}))),
];
export const MAX_TRACK_PIECES=128;

export function mirrorPiece(piece){
  return typeof piece==='string'?{id:piece,mirrored:true}:{...piece,mirrored:!piece.mirrored};
}
