const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
/** Count physical contact onsets; an envelope held against a wall is not a new hit. */
export class ContactAudioEvents{
 constructor(){this.lastEdge=0;this.lastImpact=0;this.lastAt=-Infinity;}
 update(s,active,time){
  const event=s.edgeHitId||0,hit=clamp(s.impact),edge=event>0&&event!==this.lastEdge;
  const strength=edge?clamp(s.edgeImpact):hit;
  const generic=!s.edgeTouching&&hit>this.lastImpact+.16;
  const play=active&&(edge||generic)&&strength>.025&&time-this.lastAt>.10;
  this.lastEdge=event;this.lastImpact=hit;
  if(play)this.lastAt=time;
  return play?{strength,pan:Math.max(-.65,Math.min(.65,s.edgePan||0))}:null;
 }
}
