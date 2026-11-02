const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const ramp=(value,start,end)=>{const x=clamp((value-start)/(end-start));return x*x*(3-2*x);};
export const SURFACE_AUDIO={
  asphalt:{tire:1,loose:0,road:.030,hz:420,looseHz:1500},
  gravel:{tire:0,loose:.15,road:.020,hz:700,looseHz:1500},
  dirt:{tire:0,loose:.065,road:.035,hz:260,looseHz:700},
  mud:{tire:0,loose:0,road:.045,hz:170,looseHz:400},
  ice:{tire:0,loose:0,road:.010,hz:1100,looseHz:400},
};
/** Levels before user channel controls; stationary/airborne tyres are silent. */
export function drivingMix(s={},active=true){
  const speed=Math.max(0,Number.isFinite(s.speed)?s.speed:0),v=clamp(speed/31),slip=clamp(s.slip),wet=clamp(s.wetness??(s.weather==='rain' ? .8 : 0));
  const surface=SURFACE_AUDIO[s.surface]||SURFACE_AUDIO.asphalt,ground=active&&s.grounded!==false,motion=ramp(speed,1,12),skid=ramp(slip,.18,.85);
  const throttle=s.braking?0:clamp(s.throttle??1);
  return {
    engine:active ? .13+v*.07+throttle*.055 : 0,engineRate:.76+v*.60+throttle*.04,engineHz:900+throttle*1300+v*450,
    tire:ground?motion*skid*.14*surface.tire*(1-wet*.65):0,tireRate:.88+v*.08,tireHz:1250+skid*450,
    loose:ground?motion*surface.loose*(.65+slip*.35):0,looseRate:(s.surface==='dirt' ? .65 : .85)+v*.16,looseHz:surface.looseHz,
    road:ground?motion*(surface.road+(s.surface==='asphalt'?wet*.015:0)):0,roadHz:surface.hz,
    wind:active?v*v*.035*(ground?1:1.2):0,rain:active&&s.weather==='rain' ? .025 : 0,
    kerb:ground&&s.kerb?motion*.055:0,
  };
}

/** Overlap the loop edges without changing one-shot transients. */
export function blendLoopEdges(buffer,context,seconds=.035){
  const n=buffer.length,k=Math.min(Math.round(buffer.sampleRate*seconds),Math.floor(n/4));
  if(k<2)return buffer;
  const result=context.createBuffer(buffer.numberOfChannels,n-k,buffer.sampleRate);
  for(let channel=0;channel<buffer.numberOfChannels;channel++){
    const input=buffer.getChannelData(channel),output=result.getChannelData(channel);
    output.set(input.subarray(0,n-k));
    for(let i=0;i<k;i++){const w=i/(k-1);output[i]=input[n-k+i]*(1-w)+input[i]*w;}
  }
  return result;
}
