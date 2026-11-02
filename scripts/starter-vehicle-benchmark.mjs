import { mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ORIGINAL_VEHICLES,TRACKS,SURFACES } from '../src/config.js';
import { Circuit } from '../src/circuit.js';
import { DriveModel,LapTracker } from '../src/physics.js';
import { RivalDriver,RaceGuide } from '../src/race-driver.js';

// Unbounded, flat proving ground: no barriers or circuit curvature can disguise
// tire response as collision drag. The lap check uses the real game circuits.
export const provingGround={closed:false,length:100000,
  at(progress=0,offset=0){return {x:offset,y:0,z:progress*this.length,heading:0};},
  nearest(x,z){return {x:0,y:0,z,progress:z/this.length,offset:x,tx:0,tz:1,nx:1,nz:0,grade:0,bank:0,supported:true};},
  widthAt(){return 100000;},surfaceAt(progress,surface){return surface==='track'?'asphalt':surface;}};
export function runFor(car,seconds,{steer=0,surface='asphalt',weather='clear',brake=false,hz=120,throttle=1}={}){
  for(let i=0;i<Math.round(seconds*hz);i++)car.step(1/hz,steer,surface,weather,'normal',brake,throttle);
  return car;
}
const rounded=n=>+n.toFixed(3);
export function measureVehicle(vehicle){
  const straight=new DriveModel(provingGround,vehicle);let to15=null;
  for(let i=0;i<12*120;i++){straight.step(1/120,0,'asphalt','clear');if(to15==null&&straight.speed>=15)to15=(i+1)/120;}
  const brakeDistance=(surface='asphalt',weather='clear')=>{
    const car=new DriveModel(provingGround,vehicle);car.vz=car.speed=18;const z=car.z;
    for(let i=0;i<20*120&&car.speed>.01;i++)car.step(1/120,0,surface,weather,'normal',true);
    if(car.speed>.01)throw new Error(`${vehicle.id}: did not stop`);return car.z-z;
  };
  const corner=new DriveModel(provingGround,vehicle);runFor(corner,8);const entry=corner.speed;
  runFor(corner,4,{steer:.4});
  const slide=new DriveModel(provingGround,vehicle);runFor(slide,3);runFor(slide,.65,{steer:1});
  const loose=new DriveModel(provingGround,vehicle);runFor(loose,3,{surface:'gravel'});runFor(loose,.65,{steer:1,surface:'gravel'});
  const recoveryAngle=Math.abs(slide.driftAngle);let recoveryTime=0;
  while(recoveryTime<4&&Math.abs(slide.driftAngle)>.03){runFor(slide,1/120);recoveryTime+=1/120;}
  return {id:vehicle.id,name:vehicle.name,topSpeed:rounded(straight.speed),secondsTo15:rounded(to15),
    stopFrom18:rounded(brakeDistance()),wetStopFrom18:rounded(brakeDistance('asphalt','rain')),
    cornerSpeed:rounded(corner.speed),cornerRetention:rounded(corner.speed/entry),
    slideAngleDegrees:rounded(recoveryAngle*180/Math.PI),gravelSlideDegrees:rounded(Math.abs(loose.driftAngle)*180/Math.PI),
    recoverySeconds:rounded(recoveryTime),bodyRollDegrees:rounded(Math.abs(corner.bodyRoll)*180/Math.PI)};
}
export function measureLap(vehicle,track,surface='asphalt'){
  const circuit=new Circuit(track),car=new DriveModel(circuit,vehicle),lap=new LapTracker(),racer={id:'benchmark',drive:car};
  const driver=new RivalDriver(()=>.5,0,'expert',new RaceGuide(circuit));let result=null,impacts=0;
  for(let i=0;i<120*90&&!result;i++){
    const input=driver.decide(1/120,racer,[racer],circuit,'ghost',surface,'clear');
    car.step(1/120,input.steer,surface,'clear','normal',input.brake);result=lap.step(1/120,car.road.progress);
    if(car.impact>.1)impacts++;
  }
  return {track:track.id,surface,vehicle:vehicle.id,seconds:result?rounded(result):null,wallContactSeconds:rounded(impacts/120)};
}
export const FAST_TEST_TRACK={id:'proving-fast',name:'Óvalo de ensayo',points:[[0,0],[180,0],[220,-40],[220,-100],[180,-140],[0,-140],[-40,-100],[-40,-40]],width:14,cornerSmoothing:3};
export async function benchmark(){
  const vehicles=ORIGINAL_VEHICLES.map(measureVehicle),laps=[];
  for(const track of TRACKS)for(const surface of ['asphalt','gravel'])for(const v of ORIGINAL_VEHICLES)laps.push(measureLap(v,track,surface));
  for(const v of ORIGINAL_VEHICLES)laps.push(measureLap(v,FAST_TEST_TRACK));
  const report={version:1,conditions:'120 Hz; Ágil; dry; same expert controller; speeds in game m/s, distances in game metres',vehicles,laps};
  await mkdir('artifacts',{recursive:true});await writeFile('artifacts/starter-handling.json',JSON.stringify(report,null,2)+'\n');
  console.table(vehicles);console.table(laps);return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await benchmark();
