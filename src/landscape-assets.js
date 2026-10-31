import { loadEnvironmentModel, instanceEnvironmentModel } from './environment-assets.js';

const budgets={mobile:{trees:42,near:0,rocks:22,ferns:26},balanced:{trees:100,near:18,rocks:38,ferns:64},high:{trees:180,near:40,rocks:64,ferns:100}};

/** Geometry for every placement is shared through GPU instancing. A stale
 * asynchronous load never attaches to a rebuilt or abandoned landscape. */
export async function enhanceLandscape(group,circuit,state,isCurrent=()=>true){
  if(state.biome==='workshop'||typeof document==='undefined')return false;
  const budget=budgets[state.quality]||budgets.balanced;
  const records=(group.userData.assetPlacements||[]).map((p,i)=>({...p,angle:i*2.399963,roadDistance:circuit.nearest(p.x,p.z).distance}))
    .sort((a,b)=>a.roadDistance-b.roadDistance).slice(0,budget.trees);
  const kinds=[...new Set(records.map(p=>p.kind))];
  let changed=false;
  const tasks=kinds.map(async kind=>{
    const id=kind==='pine'?(state.biome==='alpine'?'fir_sapling':'pine_sapling_small'):kind==='tropical'?'island_tree_02':'tree_small_02';
    const positions=records.filter(p=>p.kind===kind),nearCount=Math.floor(budget.near*positions.length/Math.max(records.length,1));
    const near=positions.slice(0,nearCount),far=positions.slice(nearCount);
    const [a,b]=await Promise.all([near.length?loadEnvironmentModel(id,0):null,far.length?loadEnvironmentModel(id,1):null]);
    if(!isCurrent())return;
    if(a)group.add(instanceEnvironmentModel(a,near,{height:7.4,name:`asset-${kind}-near`}));
    if(b)group.add(instanceEnvironmentModel(b,far,{height:7.4,name:`asset-${kind}-far`}));
    // Fallbacks remain available on failed downloads. They are hidden after a
    // successful replacement and are disposed with the rest of the landscape.
    for(const child of group.children)if(child.userData.assetFallback===kind)child.visible=false;
    changed=true;
  });
  const natural=!['city','desert'].includes(state.biome),rocks=[],ferns=[];
  const rockId=state.biome==='forest'||state.biome==='jungle'?'rock_moss_set_01':state.biome==='coast'?'coast_rocks_02':state.biome==='desert'?'namaqualand_boulder_02':'boulder_01';
  for(let i=0;i<budget.rocks*3&&rocks.length<budget.rocks;i++){
    const u=(i*.61803398875)%1,side=i%2?1:-1,p=circuit.at(u,side*(circuit.widthAt(u)/2+4+(i%7)*1.7));
    if(Math.abs(p.y)>.65||state.biome==='coast'&&p.z>70)continue;
    const nearest=circuit.nearest(p.x,p.z);if(nearest.distance<circuit.widthAt(nearest.progress)/2+3)continue;
    rocks.push({x:p.x,z:p.z,scale:.55+(i%5)*.18,angle:i*2.4});
  }
  tasks.push(loadEnvironmentModel(rockId,state.quality==='mobile'?1:0).then(template=>{
    if(!isCurrent()||!rocks.length)return;
    group.add(instanceEnvironmentModel(template,rocks,{height:1.7,name:'asset-rocks'}));changed=true;
  }));
  if(natural&&['forest','jungle','meadow'].includes(state.biome)){
    for(let i=0;i<budget.ferns*3&&ferns.length<budget.ferns;i++){
      const u=(i*.754877666)%1,p=circuit.at(u,(i%2?1:-1)*(circuit.widthAt(u)/2+2+(i%8)*.9)),nearest=circuit.nearest(p.x,p.z);
      if(Math.abs(p.y)>.65||nearest.distance<circuit.widthAt(nearest.progress)/2+1.5)continue;
      ferns.push({x:p.x,z:p.z,scale:.65+(i%4)*.16,angle:i*2.1});
    }
    tasks.push(loadEnvironmentModel('fern_02',1).then(template=>{if(!isCurrent()||!ferns.length)return;group.add(instanceEnvironmentModel(template,ferns,{height:.65,name:'asset-ferns'}));changed=true;}));
  }
  const results=await Promise.allSettled(tasks);
  for(const result of results)if(result.status==='rejected')console.warn('Environment asset unavailable; procedural fallback retained.',result.reason);
  return changed&&isCurrent();
}
