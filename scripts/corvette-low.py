"""Generate designed Corvette LOD surfaces by resampling the authored patches.
No global decimation. Detail destined for selected-to-active baking is omitted.
Usage Blender -b -P scripts/corvette-low.py -- garage|race|far
"""
import os,sys,re
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
profile=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'race'
assert profile in ['garage','race','far']
configs={
 'garage':dict(surface=.64,body=82,round=4,tube=8,cylinder=48,lathe=56,mirrorlong=8,mirrorseg=16,radial=4,edgesub=2),
 'race':dict(surface=.40,body=52,round=3,tube=6,cylinder=24,lathe=28,mirrorlong=5,mirrorseg=12,radial=2,edgesub=1),
 'far':dict(surface=.20,body=26,round=2,tube=4,cylinder=12,lathe=12,mirrorlong=3,mirrorseg=8,radial=1,edgesub=1),
}
cfg=configs[profile]
s=open(os.path.join(ROOT,'scripts/corvette-build.py')).read()
s=s.replace('guide.fit_guide(allmesh,ROOT)', '# Guide fit deliberately disabled for independent clean wheel LOD generation')
def replace(a,b):
 global s
 assert a in s,('Builder contract changed',a[:90]);s=s.replace(a,b)
# Output contains individually editable designed low parts, prior to atlas/merge/bake.
replace("OUT=os.path.join(ROOT,'art/corvette-c7'); GLB=os.path.join(ROOT,'public/models/corvette-c7/corvette-c7.glb')",f"OUT=os.path.join(ROOT,'art/corvette-c7/low/{profile}');os.makedirs(OUT,exist_ok=True); GLB=os.path.join(OUT,'draft.glb')\nLOD_PROFILE={profile!r};LOD_CFG={cfg!r}")
replace("def bevel(o,w=.008,segments=3):\n m=", "def bevel(o,w=.008,segments=3):\n return o\n m=")
replace("def grid_surface(name,fn,nu,nv,material,thickness=.006):\n vs=", "def grid_surface(name,fn,nu,nv,material,thickness=.006):\n nu=max(3,round(nu*LOD_CFG['surface']));nv=max(3,round(nv*LOD_CFG['surface']))\n vs=")
replace("def rounded_loop(points,steps=6,factor=.18):\n out=", "def rounded_loop(points,steps=6,factor=.18):\n steps=min(steps,LOD_CFG['round'])\n out=")
replace("def cylinder(name,pos,r,depth,material,parent=body,axis='x',segments=64):\n vs=", "def cylinder(name,pos,r,depth,material,parent=body,axis='x',segments=64):\n segments=min(segments,LOD_CFG['cylinder'])\n if name.startswith(('Hub_','RotorHat_')):segments=min(segments,12)\n vs=")
replace("def lathe(name,profile,material,parent=body,segments=96,axis='x'):\n vs=", "def lathe(name,profile,material,parent=body,segments=96,axis='x'):\n segments=min(segments,LOD_CFG['lathe'])\n if name.startswith('Tire_') and LOD_PROFILE!='garage':profile=[profile[i] for i in [0,2,4,5,7,9]]\n if name.startswith('RimBarrel_'):profile=[profile[i] for i in [0,1,3,4]]\n vs=")
replace("def tube(name,points,r,material,parent=body,sides=8,closed=False):\n vs=", "def tube(name,points,r,material,parent=body,sides=8,closed=False):\n sides=min(sides,LOD_CFG['tube'])\n step=max(1,round(1/LOD_CFG['surface']))\n if len(points)>8:\n  end=points[-1];points=points[::step]\n  if not closed and tuple(points[-1])!=tuple(end):points.append(end)\n vs=")
replace("[-2.245+i*4.49/180 for i in range(181)]", "[-2.245+i*4.49/LOD_CFG['body'] for i in range(LOD_CFG['body']+1)]")
xs={'garage':[-1,-.98,-.93,-.86,-.77,-.64,-.46,-.24,0,.24,.46,.64,.77,.86,.93,.98,1], 'race':[-1,-.96,-.86,-.72,-.53,-.28,0,.28,.53,.72,.86,.96,1], 'far':[-1,-.9,-.72,-.38,0,.38,.72,.9,1]}[profile]
s=re.sub(r'^xs=\[.*?\]$',f'xs={xs!r}',s,flags=re.M)
replace("for q in [0,.08,.25,.48,.72,.9,1]:",f"for q in {([0,.12,.35,.62,.84,1] if profile=='garage' else [0,.30,.72,1] if profile=='race' else [0,.55,1])!r}:")
# Mirror geometry keeps its silhouette; segments rather than a decimator define LOD.
a=s.index(" mvs=[];mfs=[]");b=s.index(" # Side indicators",a);block=s[a:b]
block=block.replace('range(13)',"range(LOD_CFG['mirrorlong']+1)").replace('j*.18/12',"j*.18/LOD_CFG['mirrorlong']").replace('pi*.5*j/12',"pi*.5*j/LOD_CFG['mirrorlong']").replace('range(24)',"range(LOD_CFG['mirrorseg'])").replace('2*pi*k/24',"2*pi*k/LOD_CFG['mirrorseg']").replace('range(12)',"range(LOD_CFG['mirrorlong'])").replace('j*24',"j*LOD_CFG['mirrorseg']").replace('(j+1)*24',"(j+1)*LOD_CFG['mirrorseg']").replace('(k+1)%24',"(k+1)%LOD_CFG['mirrorseg']").replace('range(23,-1,-1)',"range(LOD_CFG['mirrorseg']-1,-1,-1)").replace('288+k',"LOD_CFG['mirrorlong']*LOD_CFG['mirrorseg']+k")
s=s[:a]+block+s[b:]
# Optical surface patches retain full outline with fewer interior rings.
a=s.index('def topcontour(');b=s.index('# C7 fascia',a);block=s[a:b]
block=block.replace('range(6)',"range(LOD_CFG['edgesub'])").replace('*j/6',"*j/LOD_CFG['edgesub']").replace('range(1,7)',"range(1,LOD_CFG['radial']+1)").replace('t=r/6',"t=r/LOD_CFG['radial']").replace('range(5)',"range(LOD_CFG['radial']-1)")
s=s[:a]+block+s[b:]
# Only large silhouette and material-separating surfaces survive in the low meshes.
needle='# Finalize bevels only for export evaluation. Source remains fully editable.'
filtercode='''
# Detail is retained in the high source and transferred by real texture baking.
BAKED_PREFIXES=('TreadSipe_','TireGroove_','SidewallRidge_','Lug_','Valve_','RotorDrill_',
 'Projector','HeadlightDRL_','HeadlightBowl_','HeadlightHousing_','HoodPanelGap_',
 'DoorGap_','FuelDoor_','WindowLowerTrim_','RoofSideSeal_','HatchSeal_','Wiper_',
 'HoodVentBlade_','GrilleHex_','RearVentSlat_','ExtractorLouver_','ExtractorBlade_',
 'RimLip_','CenterCap_','DoorRelease_','FrontFlag_','RearFlag_',
 'DoorGlass_','QuarterGlass_','Cockpit','Seat','Headrest','SteeringWheel','SteeringColumn',
 'Taillight','RearLampBlackPanel_','RearReflector','RearReverseLamp','FrontSideMarker_',
 'RearSideMarker_','FenderLip_')
for ob in list(allmesh):
 omit=ob.name.startswith(BAKED_PREFIXES)
 if LOD_PROFILE=='far' and ob.name.startswith(('BrakeCaliper_','BrakeRotor_','RotorHat_','DiffuserFin_')):omit=True
 if omit:allmesh.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
'''
replace(needle,filtercode+'\n'+needle)
# Stop before export: the bake pipeline installs compact material atlases and UVs.
needle='# The authoring .blend above retains each detail; GLB merges per rigid parent/material.'
replace(needle,"print('LOW_PARTS_READY',LOD_PROFILE,len(allmesh),sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in allmesh));sys.exit(0)\n"+needle)
# __file__ must resolve against repository scripts, not this generated runtime source.
namespace={'__name__':'__main__','__file__':os.path.join(ROOT,'scripts/corvette-build.py')}
exec(compile(s,namespace['__file__'],'exec'),namespace)
