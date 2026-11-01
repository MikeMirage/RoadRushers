import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = import.meta.env?.BASE_URL || '/';
export const assetUrl = path => `${root}${path.replace(/^\//, '')}`;
let catalogPromise;
export function environmentAssetCatalog() {
  return catalogPromise ||= fetch(assetUrl('/assets/environment/manifest.json')).then(response => {
    if (!response.ok) throw new Error(`Asset catalog: ${response.status}`);
    return response.json();
  }).catch(error => { catalogPromise = null; throw error; });
}

const textureCache = new Map();
function texture(path, color, repeat) {
  const key = `${path}:${repeat.join(',')}`;
  if (!textureCache.has(key)) {
    const map = new THREE.TextureLoader().load(assetUrl(path));
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.fromArray(repeat);
    map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.anisotropy = 4;
    textureCache.set(key, map);
  }
  return textureCache.get(key);
}

/** A local 1K PBR set. ARM packs AO/Roughness/Metallic in glTF channel order. */
export function applyEnvironmentPbr(material, id, { repeat = [1, 1], normalStrength = .7, worldMeters = 0 } = {}) {
  if (typeof document === 'undefined') return material;
  const path = `/assets/environment/materials/${id}`;
  material.map = texture(`${path}/color.webp`, true, repeat);
  material.normalMap = texture(`${path}/normal.webp`, false, repeat);
  material.roughnessMap = material.aoMap = material.metalnessMap = texture(`${path}/arm.webp`, false, repeat);
  material.metalness=1;
  material.normalScale.setScalar(normalStrength);
  material.aoMapIntensity = .65;
  material.color.set('#ffffff');
  material.userData.pbrAsset = id;
  if (worldMeters) {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = shader => {
      previous.call(material, shader);
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        vec2 rrSurfaceUv=(modelMatrix*vec4(position,1.0)).xz/${worldMeters.toFixed(4)};
        #ifdef USE_MAP
          vMapUv=rrSurfaceUv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv=rrSurfaceUv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv=rrSurfaceUv;
        #endif
        #ifdef USE_AOMAP
          vAoMapUv=rrSurfaceUv;
        #endif
        #ifdef USE_METALNESSMAP
          vMetalnessMapUv=rrSurfaceUv;
        #endif`);
    };
    const previousKey = material.customProgramCacheKey.bind(material);
    // Capture the old key before replacing onBeforeCompile (Three's default
    // key reads that function dynamically).
    const key = previousKey();
    material.customProgramCacheKey = () => `${key}:pbr-world-${worldMeters}`;
  }
  material.needsUpdate = true;
  return material;
}

export function groundPbrId(state) {
  if (state.theme === 'norway') return 'snow_02';
  return { meadow:'grass_ground', forest:'forrest_ground_01', coast:'grass_ground', desert:'sand_02',
    alpine:'rock_face_03', autumn:'forest_leaves_03', jungle:'mud_forest', city:'concrete_panels' }[state.biome];
}
export function roadPbrId(surface) {
  return {asphalt:'asphalt_track', dirt:'brown_mud_03', gravel:'gravel_road', mud:'mud_forest'}[surface];
}

const loader = new GLTFLoader(), models = new Map();
export function loadEnvironmentModel(id, level = 0) {
  const key = `${id}:${level}`;
  if (!models.has(key)) models.set(key, loader.loadAsync(assetUrl(`/assets/environment/models/${id}/lod${level}.gltf`))
    .then(gltf => {
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(o=>{if(o.userData.roadrushersImpostor)Object.assign(gltf.scene.userData,o.userData);});
      return gltf.scene;
    }).catch(error => { models.delete(key); throw error; }));
  return models.get(key);
}

/** Own geometry/material clones so rebuilding a world cannot dispose the cache. */
export function instanceEnvironmentModel(template, placements, { height = 1, name = 'scanned-props' } = {}) {
  const group = new THREE.Group(); group.name = name;
  const bounds = new THREE.Box3().setFromObject(template), size = bounds.getSize(new THREE.Vector3());
  const unit = height / Math.max(template.userData.assetHeight??size.y, .01), transform = new THREE.Object3D(), matrix = new THREE.Matrix4();
  template.traverse(part => {
    if (!part.isMesh) return;
    const cloneMaterial=m=>{
      if(!template.userData.roadrushersImpostor)return m.clone();
      const material=new THREE.MeshBasicMaterial({map:m.map,color:m.color,alphaTest:.4,side:THREE.DoubleSide,fog:true});
      material.userData.treeImpostor=true;return material;
    };
    const materials = Array.isArray(part.material) ? part.material.map(cloneMaterial) : cloneMaterial(part.material);
    const batch = new THREE.InstancedMesh(part.geometry.clone(), materials, placements.length);
    batch.name = `${name}-${part.name}`;
    batch.castShadow = !template.userData.roadrushersImpostor;batch.receiveShadow = true;
    placements.forEach((p, index) => {
      const scale = (p.scale ?? 1) * unit;
      transform.position.set(p.x, p.y ?? -.045, p.z);
      transform.rotation.set(0, p.angle ?? 0, 0);
      transform.scale.setScalar(scale); transform.updateMatrix();
      matrix.multiplyMatrices(transform.matrix, part.matrixWorld);
      batch.setMatrixAt(index, matrix);
    });
    batch.computeBoundingSphere();
    group.add(batch);
  });
  return group;
}

export function disposeAssetGroup(group) {
  group.traverse(part => {
    part.geometry?.dispose();
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    for (const material of materials) material?.dispose();
    if (part.isInstancedMesh) part.dispose();
  });
  group.removeFromParent();
}
