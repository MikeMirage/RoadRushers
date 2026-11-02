import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Vector3} from 'three';
import {Circuit} from '../src/circuit.js';
import {KIT_PRESETS,kitConfig} from '../src/track-pieces.js';
import {generateCircuitDressing,corridorIndex} from '../src/circuit-dressing.js';
import {buildCircuitGrass,circuitGrassMaterial,CIRCUIT_GRASS_BUDGET} from '../src/circuit-grass.js';
import {disposeSceneGroup} from '../src/basic-scene.js';

test('short grass remains bounded, deterministic, culled and outside road and runoff',()=>{
  const c=new Circuit(kitConfig(KIT_PRESETS[0].pieces)),recipe=generateCircuitDressing(c),before=structuredClone(recipe),a=buildCircuitGrass(c,recipe),b=buildCircuitGrass(c,recipe),clear=corridorIndex(c);
  const matrix=new Matrix4(),position=new Vector3();let count=0;
  assert.ok(a.children.length>0&&a.children.length<=CIRCUIT_GRASS_BUDGET.cells);
  a.children.forEach((mesh,index)=>{
    count+=mesh.count;assert.ok(mesh.frustumCulled);assert.equal(mesh.material.transparent,false);assert.equal(mesh.castShadow,false);assert.ok(Number.isFinite(mesh.boundingSphere.radius));
    assert.deepEqual(mesh.instanceMatrix.array,b.children[index].instanceMatrix.array);
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);assert.ok(clear(position,.29,.35));
      const road=c.nearest(position.x,position.z,{y:0}),margin=recipe.segments.filter(s=>road.progress>=s[0]&&road.progress<=s[1]&&Math.sign(road.offset)===s[2]).reduce((w,s)=>Math.max(w,s[5]?s[3]:1.25),0);
      assert.ok(road.distance>c.widthAt(road.progress)/2+Math.max(.7,margin)+.3);
    }
  });
  assert.ok(count<=CIRCUIT_GRASS_BUDGET.tufts);assert.deepEqual(recipe,before);
  const material=circuitGrassMaterial();assert.equal(material.map,null);assert.equal(material.normalMap,null);material.dispose();disposeSceneGroup(a);disposeSceneGroup(b);
});
