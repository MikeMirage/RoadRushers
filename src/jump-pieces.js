export const GAP_JUMPS=[
  {id:'gap-jump-short',name:'Salto corto con hueco',family:'Saltos',kind:'gap-jump',length:36,launchLength:12,gapLength:6,landingLength:18,height:2,description:'Rampa de despegue, 6 m sin carretera y rampa de recepción. Entrada y salida horizontales.'},
  {id:'gap-jump-long',name:'Salto largo con hueco',family:'Saltos',kind:'gap-jump',length:52,launchLength:16,gapLength:12,landingLength:24,height:3,description:'Salto de velocidad con 12 m de vacío y una recepción larga. Ajusta las medidas antes de probar.'},
];

export function configureGapJump(spec){
  if([spec.launchLength,spec.gapLength,spec.landingLength,spec.height].some(v=>typeof v!=='number'||!Number.isFinite(v))||
    spec.launchLength<4||spec.launchLength>80||spec.gapLength<2||spec.gapLength>40||spec.landingLength<4||spec.landingLength>100||spec.height<.5||spec.height>8)throw new Error('Salto no válido: usa rampas de 4–80 / 4–100 m, un hueco de 2–40 m y altura de 0,5–8 m.');
  spec.length=spec.launchLength+spec.gapLength+spec.landingLength;
  return spec;
}

/** The centerline across the void only guides progress; it never supports the car. */
export function jumpProfile(spec,z){
  if(z<=spec.launchLength){const t=z/spec.launchLength;return {y:spec.height*t*t,grade:2*spec.height*t/spec.launchLength};}
  if(z<spec.launchLength+spec.gapLength)return {y:spec.height,grade:0};
  const t=Math.min(1,(z-spec.launchLength-spec.gapLength)/spec.landingLength);
  return {y:spec.height*(1-t)**2,grade:-2*spec.height*(1-t)/spec.landingLength};
}
