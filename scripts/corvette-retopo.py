"""Corvette topology reconstruction from the continuous user source.
This is a voxel proxy + QuadriFlow rebuild, not a decimation of the final mesh.
Millimetre working coordinates avoid Blender 4.4's fixed 1e-4 edge gate.
The high source and active public asset are never overwritten.
"""
import bpy,bmesh,math,os,sys,json,random,numpy as np
from mathutils import Matrix,Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
level=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'race'
OUT=os.path.join(ROOT,'art/corvette-c7/retopo',level);os.makedirs(OUT,exist_ok=True)
SOURCE=os.path.join(ROOT,'art/vehicle-pipeline/magnific/corvette-user-sample/source-review.blend')
bpy.ops.wm.open_mainfile(filepath=SOURCE);bpy.context.view_layer.update()
src=next(o for o in bpy.data.objects if o.type=='MESH')
game=np.array([(p.x,p.z,-p.y) for p in [src.matrix_world@v.co for v in src.data.vertices]],dtype=float)
feet=game[(game[:,1]<.045)&(np.abs(game[:,0])>.60)]
sf=float(np.median(feet[feet[:,2]>.5,2]));sr=float(np.median(feet[feet[:,2]<-.5,2]));height=float(game[:,1].max())
bodywidth=float(np.percentile(np.abs(game[(game[:,1]>.35)&(game[:,1]<.85)&(np.abs(game[:,2])<1.8),0]),99.7))
for p in game:
 p[0]*=.9385/bodywidth;p[1]*=1.2395/height;z=p[2]
 p[2]=1.31+(z-sf)*.935/(2.245-sf) if z>=sf else -1.4+(z-sr)*(-.845)/(-2.245-sr) if z<=sr else -1.4+(z-sr)*2.71/(sf-sr)
src.data.transform(src.matrix_world);src.matrix_world=Matrix.Identity(4)
for v,p in zip(src.data.vertices,game):v.co=(p[0],-p[2],p[1])
bpy.ops.object.select_all(action='DESELECT');src.select_set(True);bpy.context.view_layer.objects.active=src
bm=bmesh.new();bm.from_mesh(src.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(src.data);bm.free()
src.data.remesh_voxel_size=.014 if level=='garage' else .020;src.data.use_remesh_preserve_volume=False
bpy.ops.object.voxel_remesh()
rng=random.Random(17)
for v in src.data.vertices:
 v.co*=1000
 for i in range(3):v.co[i]+=rng.uniform(-.01,.01)
src.data.update();proxyfaces=len(src.data.polygons)
bpy.ops.object.quadriflow_remesh(mode='FACES',target_faces={'garage':8000,'race':3200,'far':1500}[level],use_mesh_symmetry=False,use_preserve_sharp=False,use_preserve_boundary=False,smooth_normals=True,seed=0)
assert len(src.data.polygons)<proxyfaces*.5,'QuadriFlow did not change the proxy topology'
for v in src.data.vertices:v.co*=.001
# Wheel openings are cut in the subsequent directed refinement while this proxy is closed.
src.name='Coachwork_Retopo_'+level
# Rig and wheels are independently authored and sampled per LOD.
wheelprefix=('Suspension_','Steering_','Wheel_','Tire_','TireGroove_','TreadSipe_','RimBarrel_','RimLip_','SplitYSpoke_','Hub_','CenterCap_','Lug_','BrakeRotor_','RotorHat_','RotorDrill_','BrakeCaliper_','SidewallRidge_','Valve_')
with bpy.data.libraries.load(os.path.join(ROOT,'art/corvette-c7/low',level,'corvette-c7.blend'),link=False) as (a,b):b.objects=[n for n in a.objects if n in ['CorvetteC7','BodySuspension','CTRL_Corvette'] or n.startswith(wheelprefix)]
for o in b.objects:
 if o:bpy.context.scene.collection.objects.link(o)
bpy.context.view_layer.update();src.parent=bpy.data.objects['BodySuspension']
# Clay material allows shape review without the original directional texture.
m=bpy.data.materials.new('RetopoReviewClay');m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.13,.16,.19,1);m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.44
src.data.materials.clear();src.data.materials.append(m)
for p in src.data.polygons:p.use_smooth=True;p.material_index=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'low-parts.blend'),compress=True)
meta={'level':level,'method':'Voxel proxy + QuadriFlow topology reconstruction + analytic arch cleanup; resampled authored wheels','proxyFaces':proxyfaces,'bodyTriangles':sum(len(p.vertices)-2 for p in src.data.polygons),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')}
open(os.path.join(OUT,'metrics.json'),'w').write(json.dumps(meta,indent=2));print('RETOPO',json.dumps(meta),flush=True)
if '--skip-renders' in sys.argv:sys.exit(0)
# Shared view setup from the extraction review, without mutating its geometry.
ns={'bpy':bpy,'Vector':Vector,'os':os,'OUT':OUT,'meta':meta,'scene':bpy.context.scene,'C':lambda p:Vector((p[0],-p[2],p[1]))}
def material(name,color,rough=.5):
 mat=bpy.data.materials.new(name);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;return mat
ns['material']=material
scene=bpy.context.scene;scene.view_layers[0].material_override=None;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
renders=open(os.path.join(ROOT,'scripts/corvette-extract.py')).read().split('def area(',1)[1]
exec('def area('+renders,ns)
