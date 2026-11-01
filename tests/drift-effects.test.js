import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Texture} from 'three';
import {DriftEffects} from '../src/drift-effects.js';

test('a grounded drift emits pooled smoke and persistent ground marks, then clears on reset',()=>{
 const effect=new DriftEffects(new Scene(),new Texture()),drive={x:0,y:0,z:0,groundY:0,heading:0,steer:1,speed:15,slip:.5,impact:0,vx:1,vz:14,grounded:true};
 const positions=effect.positions,marks=effect.trailPositions;
 for(let i=0;i<60;i++){drive.z+=.12;effect.update(1/120,drive,true,'asphalt');}
 assert.ok(effect.activeCount>0);assert.equal(effect.smoke.visible,true);assert.ok(effect.trailGeometry.drawRange.count>0);assert.equal(effect.positions,positions);assert.equal(effect.trailPositions,marks);
 const count=effect.trailGeometry.drawRange.count;
 for(let i=0;i<180;i++)effect.update(1/120,{...drive,slip:0},true,'asphalt');
 assert.equal(effect.smoke.visible,false);assert.equal(effect.trailGeometry.drawRange.count,count,'marks should remain after the smoke disperses');
 effect.reset();assert.equal(effect.trailGeometry.drawRange.count,0);assert.equal(effect.smoke.visible,false);assert.equal(effect.activeCount,0);
});
