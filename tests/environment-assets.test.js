import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { instanceEnvironmentModel, disposeAssetGroup, groundPbrId, roadPbrId } from '../src/environment-assets.js';

const root=new URL('../public/',import.meta.url);
const readJson=async path=>JSON.parse(await readFile(new URL(path.replace(/^\//,''),root),'utf8'));

test('environment library ships every selected CC0 asset with matching local file hashes',async()=>{
  const selection=JSON.parse(await readFile(new URL('../art/environment-selection.json',import.meta.url),'utf8'));
  const manifest=await readJson('/assets/environment/manifest.json');
  assert.equal(manifest.assets.length,selection.models.length+selection.materials.length);
  for(const asset of manifest.assets){
    assert.equal(asset.license,'CC0-1.0');assert.equal(asset.source,`https://polyhaven.com/a/${asset.id}`);
    assert.ok(asset.files.length>=3,asset.id);let bytes=0;
    for(const file of asset.files){
      assert.ok(file.url.startsWith('/assets/environment/')&&!file.url.includes('..'));
      const content=await readFile(new URL(file.url.slice(1),root));bytes+=content.length;
      assert.equal(content.length,file.bytes,file.url);
      assert.equal(createHash('sha256').update(content).digest('hex'),file.sha256,file.url);
    }
    assert.equal(bytes,asset.bytes);
  }
});

test('both model LODs have complete local buffers, finite geometry, and exported triangle counts',async()=>{
  const manifest=await readJson('/assets/environment/manifest.json');
  for(const asset of manifest.assets.filter(a=>a.kind==='model')){
    assert.equal(asset.lods.length,2);assert.equal(asset.blockingFindings,0,asset.id);
    assert.ok(asset.lods[1].triangles<=asset.lods[0].triangles,asset.id);
    for(const lod of asset.lods){
      const url=new URL(lod.url.slice(1),root),gltf=JSON.parse(await readFile(url,'utf8'));
      const buffers=await Promise.all(gltf.buffers.map(b=>readFile(new URL(b.uri,url))));
      let triangles=0;
      for(const mesh of gltf.meshes)for(const part of mesh.primitives){
        assert.equal(part.mode??4,4);const accessor=gltf.accessors[part.indices];triangles+=accessor.count/3;
        for(const key of ['POSITION','NORMAL','TEXCOORD_0']){
          assert.ok(part.attributes[key]!==undefined,`${asset.id}: ${key}`);
          const a=gltf.accessors[part.attributes[key]],view=gltf.bufferViews[a.bufferView],buffer=buffers[view.buffer];
          assert.equal(a.componentType,5126);const width={VEC2:2,VEC3:3,VEC4:4}[a.type],stride=view.byteStride??width*4;
          const start=(view.byteOffset??0)+(a.byteOffset??0);
          assert.ok(start+(a.count-1)*stride+width*4<=buffer.length);
          for(let i=0;i<a.count;i++)for(let j=0;j<width;j++)assert.ok(Number.isFinite(buffer.readFloatLE(start+i*stride+j*4)),`${asset.id}: finite ${key}`);
        }
      }
      assert.equal(triangles,lod.triangles,`${asset.id} LOD ${lod.level}`);
      for(const image of gltf.images){assert.ok(!image.uri.includes('://'));assert.ok((await stat(new URL(image.uri,url))).size>0);}
      assert.ok(gltf.extensionsRequired.includes('EXT_texture_webp'));
      for(const material of gltf.materials)if(/leaves|twig/.test(material.name))assert.equal(material.alphaMode,'MASK');
    }
  }
});

test('instanced assets preserve source transforms and own disposable geometry and materials',()=>{
  const source=new Group(),geometry=new BoxGeometry(2,4,2),material=new MeshStandardMaterial(),part=new Mesh(geometry,material);
  part.position.set(0,2,0);source.add(part);source.updateMatrixWorld(true);
  const instances=instanceEnvironmentModel(source,[{x:10,y:0,z:-4},{x:-10,y:0,z:4,scale:2}],{height:8});
  const batch=instances.children[0];assert.equal(batch.count,2);assert.notEqual(batch.geometry,geometry);assert.notEqual(batch.material,material);
  const bounds=new Box3().setFromObject(instances),size=bounds.getSize(new Vector3());assert.equal(bounds.min.y,0);assert.equal(size.y,16);
  let sourceDisposed=false;geometry.addEventListener('dispose',()=>{sourceDisposed=true;});disposeAssetGroup(instances);assert.equal(sourceDisposed,false);
  geometry.dispose();material.dispose();
});

test('every automatic terrain and road PBR binding resolves to a downloaded material',async()=>{
  const manifest=await readJson('/assets/environment/manifest.json'),ids=new Set(manifest.assets.filter(a=>a.kind==='material').map(a=>a.id));
  for(const biome of ['meadow','forest','coast','desert','alpine','autumn','jungle','city'])assert.ok(ids.has(groundPbrId({biome,theme:'grandprix'})),biome);
  assert.ok(ids.has(groundPbrId({theme:'norway'})));
  for(const surface of ['asphalt','dirt','gravel','mud'])assert.ok(ids.has(roadPbrId(surface)),surface);
  assert.equal(roadPbrId('ice'),undefined);
});
