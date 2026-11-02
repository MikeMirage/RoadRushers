import {mkdir,writeFile} from 'node:fs/promises';
import {GP_CIRCUITS} from '../src/gp-circuits.js';
import {VEHICLES} from '../src/config.js';
import {Circuit} from '../src/circuit.js';
import {DriveModel,LapTracker} from '../src/physics.js';
import {RaceGuide,RivalDriver} from '../src/race-driver.js';

const vehicles=[VEHICLES[0],VEHICLES[1],VEHICLES.find(vehicle=>vehicle.id==='seven')];
const results=[];
for(const track of GP_CIRCUITS){
  const circuit=new Circuit(track),guide=new RaceGuide(circuit);
  for(const vehicle of vehicles){
    const drive=new DriveModel(circuit,vehicle),controller=new RivalDriver(()=>.5,0,'club',guide);
    const racer={id:'qa',drive},laps=new LapTracker(drive.road.progress);
    let lap=null,maxProgressJump=0,maxOffset=0,previous=drive.road.progress;
    for(let frame=0;frame<120*240;frame++){
      const input=controller.decide(1/120,racer,[racer],circuit,'ghost','track','clear','normal');
      drive.step(1/120,input.steer,'track','clear','normal',input.brake,input.throttle??1);
      const progress=drive.road.progress,difference=Math.abs(progress-previous);
      maxProgressJump=Math.max(maxProgressJump,Math.min(difference,1-difference));previous=progress;
      maxOffset=Math.max(maxOffset,Math.abs(drive.road.offset));
      if(![drive.x,drive.y,drive.z,drive.speed].every(Number.isFinite))throw new Error(`Invalid driving state: ${track.id}/${vehicle.id}`);
      lap=laps.step(1/120,progress);if(lap)break;
    }
    const result={track:track.id,name:track.name,vehicle:vehicle.id,completed:Boolean(lap),lapSeconds:lap,maxProgressJump,maxOffset};
    results.push(result);console.log(JSON.stringify(result));
  }
}
await mkdir('artifacts/gp-world-tour',{recursive:true});
await writeFile('artifacts/gp-world-tour/driving-checks.json',JSON.stringify(results,null,2)+'\n');
if(results.some(result=>!result.completed||result.maxProgressJump>.02))process.exitCode=1;
