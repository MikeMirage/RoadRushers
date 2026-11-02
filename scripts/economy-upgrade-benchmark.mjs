import {writeFileSync,mkdirSync} from 'node:fs';
import {VEHICLES,TRACKS} from '../src/config.js';
import {upgradedVehicle} from '../src/economy-config.js';
import {measureLap} from './starter-vehicle-benchmark.mjs';
const rows=[];
for(const id of ['coda','borough','boxer','willy','rosso'])for(const track of [TRACKS[0],TRACKS[2]])for(const surface of ['asphalt','gravel','ice']){
 const v=VEHICLES.find(v=>v.id===id),base=measureLap(upgradedVehicle(v,1),track,surface),max=measureLap(upgradedVehicle(v,5),track,surface);
 rows.push({id,track:track.id,surface,n1:base.seconds,n5:max.seconds,improvement:base.seconds&&max.seconds?+(100*(base.seconds-max.seconds)/base.seconds).toFixed(2):null});
}
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/economy-upgrade-benchmark.json',JSON.stringify({conditions:'120Hz, same expert controller, five vehicle families, two tracks, three surfaces, N1 versus N5',rows},null,2));
console.table(rows);
if(rows.some(r=>r.improvement===null||r.improvement>5))process.exitCode=1;
