"""Real selected-to-active wheel bakes from authored high to resampled low.
Caliper is exploded during baking, with a face role attribute for restoration.
"""
import bpy,bmesh,os,sys,json,shutil,math
from mathutils import Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
level=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'race'
OUT=os.path.join(ROOT,'art/corvette-c7/bakes',level,'wheel');os.makedirs(OUT,exist_ok=True)
res={'garage':1024,'race':512,'far':256}[level]
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art/corvette-c7/low',level,'corvette-c7.blend'))
lowparts=[o for o in bpy.data.objects if o.type=='MESH' and o.parent and o.parent.name in ('Wheel_FL','Steering_FL')]
for o in list(bpy.data.objects):
 if o not in lowparts:bpy.data.objects.remove(o,do_unlink=True)
for o in lowparts:
 o.parent=None;o.matrix_world=Matrix.Identity(4)
 role=o.data.attributes.new('part_role','INT','FACE')
 if o.name.startswith('BrakeCaliper'):
  for q in role.data:q.value=1
  for v in o.data.vertices:v.co.x+=2
 o.name='LOW_'+o.name
# Library dependencies include parent pivots; link the requested hierarchy first,
# then discard it after copying source meshes into the common wheel-local frame.
with bpy.data.libraries.load(os.path.join(ROOT,'art/corvette-c7/baseline-v1/corvette-c7.blend'),link=False) as (a,b):
 b.objects=[n for n in a.objects if n in ('CorvetteC7','BodySuspension','CTRL_Corvette','Suspension_FL','Steering_FL','Wheel_FL') or '_FL' in n]
for o in b.objects:
 if o:bpy.context.scene.collection.objects.link(o)
bpy.context.view_layer.update()
highparts=[o for o in b.objects if o and o.type=='MESH']
for o in highparts:
 o.parent=None;o.matrix_world=Matrix.Identity(4);o.name='HIGH_'+o.name
 if 'BrakeCaliper' in o.name:
  for v in o.data.vertices:v.co.x+=2
 for m in o.data.materials:
  if m and m.name.startswith(('M_Rim','M_Chrome')):
   m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(1,1,1,1)
# Join retains physical part islands and face role, reducing bake setup complexity.
def join(obs,name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();ob=bpy.context.object;ob.name=name;return ob
lo=join(lowparts,'WheelAtlasLow');hi=join(highparts,'WheelAtlasHigh')
bpy.ops.object.select_all(action='DESELECT');lo.select_set(True);bpy.context.view_layer.objects.active=lo
# Explicit triangulation is kept in the exported mesh, matching bake interpolation.
mo=lo.modifiers.new('Final triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mo.name)
while lo.data.uv_layers:lo.data.uv_layers.remove(lo.data.uv_layers[0])
lo.data.uv_layers.new(name='UVMap')
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.02,area_weight=0,correct_aspect=True,scale_to_bounds=False);bpy.ops.uv.average_islands_scale();bpy.ops.uv.pack_islands(rotate=True,margin=.016);bpy.ops.object.mode_set(mode='OBJECT')
mat=bpy.data.materials.new('VehicleWheel');mat.use_nodes=True;lo.data.materials.clear();lo.data.materials.append(mat)
for p in lo.data.polygons:p.material_index=0
# Verify topology and UV area before any bake; hard-face projection seams are retained.
zero_uv=0
for p in lo.data.polygons:
 uv=[lo.data.uv_layers.active.data[i].uv for i in p.loop_indices]
 if abs(sum(a.x*b.y-b.x*a.y for a,b in zip(uv,uv[1:]+uv[:1])))<1e-10:zero_uv+=1
assert not zero_uv,('Degenerate wheel UVs',zero_uv)
sys.path.insert(0,'/Users/miquelgelabert/.codex/skills/blender-texture-baking/scripts')
import bake_maps
result=bake_maps.run(low=lo.name,high=[hi.name],maps=['normal','ao','roughness','metallic','basecolor'],res=res,samples=32,margin_px=8,extrusion=.024,out=OUT,name='Wheel',pack_orm=True,device='CPU')
# Semantic mask is another selected-to-active material-ID bake, not a guessed image.
for m in hi.data.materials:
 bs=m.node_tree.nodes.get('Principled BSDF') if m and m.use_nodes else None
 if not bs:continue
 color=(1,0,0,1) if m.name.startswith(('M_Rim','M_Chrome')) else (0,1,0,1) if m.name.startswith('M_Rubber') else (0,0,0,1)
 bs.inputs['Base Color'].default_value=color
mask=bake_maps.run(low=lo.name,high=[hi.name],maps=['basecolor'],res=res,samples=16,margin_px=8,extrusion=.024,out=OUT,name='WheelMask',device='CPU')
public=os.path.join(ROOT,'public/models/optimized/corvette-c7/textures',level);os.makedirs(public,exist_ok=True)
for source,target in [('T_Wheel_BC.png','wheel-baseColor.png'),('T_Wheel_N.png','wheel-normal.png'),('T_Wheel_ORM.png','wheel-orm.png'),('T_WheelMask_BC.png','wheel-mask.png')]:shutil.copy2(os.path.join(OUT,source),os.path.join(public,target))
hi.hide_render=True;hi.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'wheel-baked.blend'),compress=True)
report={'level':level,'resolution':res,'lowTriangles':len(lo.data.polygons),'highTriangles':sum(len(p.vertices)-2 for p in hi.data.polygons),'normalConvention':'OpenGL tangent','method':'Cycles selected-to-active; caliper exploded +2m X; role attribute retained','zeroAreaUV':zero_uv,'bake':result,'maskBake':mask}
open(os.path.join(OUT,'bake-report.json'),'w').write(json.dumps(report,indent=2));print('WHEEL_BAKE',json.dumps(report),flush=True)
