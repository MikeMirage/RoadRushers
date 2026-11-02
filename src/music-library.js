const selections=[
  ['precision-objects','Precision Objects','lounge',['a']],
  ['coastal-velocity','Coastal Velocity','coast',['a','b']],
  ['afterlight-express','Afterlight Express','night',['a','b']],
  ['timberline-run','Timberline Run','forest',['a','b']],
  ['golden-apex','Golden Apex','sunset',['a']],
  ['one-more-lap','One More Lap','practice',['a']],
];
export const MUSIC_TRACKS=Object.fromEntries(selections.flatMap(([slug,title,group,variants])=>variants.map(variant=>{
  const id=`suno-${slug}-${variant}`;return [id,{id,title,variant:variant.toUpperCase(),group,file:`./audio/suno/ready/${id}.mp3`}];
})));
const ids=group=>Object.values(MUSIC_TRACKS).filter(x=>x.group===group).map(x=>x.id);
export function musicPlan(scene){
  if(!scene||scene.screen==='loading')return null;
  if(scene.screen==='results')return {key:'results',tracks:ids('sunset')};
  if(scene.screen!=='race')return {key:'lounge',tracks:ids('lounge')};
  const weather=scene.weather||'clear';
  const group=['rain','night'].includes(weather)?'night':scene.trackId==='faro'||weather==='sunset'?'sunset':scene.biome==='forest'||scene.trackId==='aserradero'?'forest':'coast';
  const tracks=scene.mode==='time-trial'?ids('practice'):group==='sunset'?ids('coast'):ids(group);
  if(scene.mode==='practice')tracks.push(...ids('practice'));
  return {key:`race:${scene.trackId||scene.biome||'default'}:${group}:${scene.mode||'race'}`,tracks};
}
/** Alternate A/B on re-entry, and advance through all selected versions at song end. */
export class MusicDirector{
  constructor(){this.plan=null;this.index=0;this.nextStarts=new Map();}
  select(scene){
    this.scene=scene;const plan=musicPlan(scene);
    if(!plan){this.plan=null;return null;}
    if(plan.key!==this.plan?.key){this.plan=plan;this.index=(this.nextStarts.get(plan.key)||0)%plan.tracks.length;this.nextStarts.set(plan.key,(this.index+1)%plan.tracks.length);}
    return this.plan.tracks[this.index];
  }
  get current(){return MUSIC_TRACKS[this.plan?.tracks[this.index]]||null;}
  setScope({all=false}={}){
    if(!this.plan)return null;
    const current=this.current?.id;
    const tracks=all?Object.keys(MUSIC_TRACKS):this.plan.key.startsWith('race:')?Object.values(MUSIC_TRACKS).filter(track=>!['lounge','sunset'].includes(track.group)).map(track=>track.id):musicPlan(this.scene).tracks;
    this.plan={...this.plan,tracks,manual:true};this.index=Math.max(0,tracks.indexOf(current));
    return this.current;
  }
  skip(options={}){
    const previous=this.current?.id;if(!this.setScope(options))return null;
    this.index=(this.plan.tracks.indexOf(previous)+1)%this.plan.tracks.length;return this.current;
  }
  advance(){if(!this.plan)return null;this.index=(this.index+1)%this.plan.tracks.length;if(!this.plan.manual)this.nextStarts.set(this.plan.key,(this.index+1)%this.plan.tracks.length);return this.plan.tracks[this.index];}
}

/** Front-end songs need more presence; driving leaves room for car and tyres. */
export function musicPresence(scene){return !scene||scene.screen==='loading'?0:scene.screen==='race' ? .38 : scene.screen==='results' ? .70 : .85;}
export function gameAudioScene({state,garageOpen=false,editorOpen=false,track={},weather,mode}={}){
 const screen=garageOpen||editorOpen?'garage':state==='finished'?'results':['hub','loading'].includes(state)?(state==='loading'?'loading':'menu'):state==='ready'?'briefing':['countdown','running','paused'].includes(state)?'race':'menu';
 return {screen,trackId:track.id,biome:track.biome,weather,mode};
}
