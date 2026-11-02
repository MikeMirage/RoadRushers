"""Assemble production rig and external-atlas GLB, then render the actual baked low.
GLB embeds geometry only; external PNG URIs are shared with the runtime texture cache.
"""
import bpy,bmesh,os,sys,json,math,struct
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));level=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'race';OUT=os.path.join(ROOT,'art/corvette-c7/production',level);os.makedirs(OUT,exist_ok=True)
PUBLIC=os.path.join(ROOT,'public/models/optimized/corvette-c7');os.makedirs(PUBLIC,exist_ok=True)
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
def load(path,name):
 with bpy.data.libraries.load(path,link=False) as (a,b):b.objects=[name]
 ob=b.objects[0];bpy.context.scene.collection.objects.link(ob);return ob
bodyMesh=load(os.path.join(ROOT,'art/corvette-c7/bakes',level,'body/body-baked.blend'),'BodyAtlasLow')
wheelAtlas=load(os.path.join(ROOT,'art/corvette-c7/bakes',level,'wheel/wheel-baked.blend'),'WheelAtlasLow')
C=lambda p:Vector((p[0],-p[2],p[1]))
def empty(name,parent=None,pos=(0,0,0)):
 o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);o.parent=parent;o.location=C(pos);return o
root=empty('CorvetteC7');root['vehicleId']='corvette-c7';root['units']='meters';root['wheelbase']=2.71;root['axes']='+Y up,+Z forward in glTF'
body=empty('BodySuspension',root);bodyMesh.parent=body;bodyMesh.name='CorvetteBody';bodyMesh['vehicleRole']='body'
controller=empty('CTRL_Corvette',root)
for key in ['steering','wheel_spin','ride_height','suspension']:controller[key]=0.0
controller['rigHelp']='steering and wheel_spin in radians; ride_height and suspension in metres'
def drive(o,path,index,expression,props):
 d=o.driver_add(path,index).driver;d.type='SCRIPTED';d.expression=expression
 for key in props:
  v=d.variables.new();v.name=key;v.type='SINGLE_PROP';v.targets[0].id=controller;v.targets[0].data_path='["'+key+'"]'
drive(body,'location',2,'ride_height+suspension',['ride_height','suspension'])
# UV-preserving split from the exploded canonical wheel bake.
role=wheelAtlas.data.attributes.get('part_role');assert role

def wheel_part(label,which,side,rear,parent):
 me=wheelAtlas.data;polys=[p for p in me.polygons if role.data[p.index].value==which];mapping={};verts=[];faces=[];uvs=[]
 for p in polys:
  ids=[];puv=[]
  for li in p.loop_indices:
   old=me.loops[li].vertex_index
   if old not in mapping:
    co=me.vertices[old].co.copy()
    if which:co.x-=2
    if rear:
     co.x*=.285/.245
     r=math.hypot(co.y,co.z);ratio=(.345/.337 if r>.255 else .254/.2413);co.y*=ratio;co.z*=ratio
    if side>0:co.x=-co.x
    mapping[old]=len(verts);verts.append(tuple(co))
   ids.append(mapping[old]);puv.append(tuple(me.uv_layers.active.data[li].uv))
  if side>0:ids.reverse();puv.reverse()
  faces.append(ids);uvs.append(puv)
 mesh=bpy.data.meshes.new(('Caliper_' if which else 'WheelMesh_')+label);mesh.from_pydata(verts,[],faces);mesh.update();uv=mesh.uv_layers.new(name='UVMap')
 for p,source,oldpoly in zip(mesh.polygons,uvs,polys):
  p.use_smooth=oldpoly.use_smooth
  for li,pair in zip(p.loop_indices,source):uv.data[li].uv=pair
 ob=bpy.data.objects.new(mesh.name,mesh);bpy.context.scene.collection.objects.link(ob);ob.parent=parent;ob['vehicleRole']='wheel';return ob
wheelmeshes=[]
for label,side,front in [('FL',-1,True),('FR',1,True),('RL',-1,False),('RR',1,False)]:
 r=.337 if front else .345;wx=.791 if front else .784;z=1.31 if front else -1.4
 sus=empty('Suspension_'+label,root,(side*wx,r,z));sus['travelMin']=-.035;sus['travelMax']=.05
 steer=empty('Steering_'+label,sus);spin=empty('Wheel_'+label,steer);spin['radius']=r;spin['width']=.245 if front else .285;spin['side']=side
 if front:drive(steer,'rotation_euler',2,'steering',['steering'])
 drive(spin,'rotation_euler',0,'wheel_spin',['wheel_spin'])
 wheelmeshes.append(wheel_part(label,0,side,not front,spin))
 if level!='far':wheelmeshes.append(wheel_part(label,1,side,not front,steer))
bpy.data.objects.remove(wheelAtlas,do_unlink=True)
# Standard glTF PBR graph; masks are external and interpreted by RoadRushers.
def pbr(role):
 m=bpy.data.materials.new('VehicleBody' if role=='body' else 'VehicleWheel');m.use_nodes=True;m['vehicleRole']=role;nt=m.node_tree;bs=nt.nodes.get('Principled BSDF')
 nodes={}
 for slot in ['baseColor','normal','orm','mask']:
  path=os.path.join(PUBLIC,'textures',level,role+'-'+slot+'.png');im=bpy.data.images.load(path,check_existing=False);im.name=role+'-'+slot;im.colorspace_settings.name='sRGB' if slot=='baseColor' else 'Non-Color';n=nt.nodes.new('ShaderNodeTexImage');n.image=im;nodes[slot]=n
 nt.links.new(nodes['baseColor'].outputs['Color'],bs.inputs['Base Color']);split=nt.nodes.new('ShaderNodeSeparateColor');split.mode='RGB';nt.links.new(nodes['orm'].outputs['Color'],split.inputs[0]);nt.links.new(split.outputs['Green'],bs.inputs['Roughness']);nt.links.new(split.outputs['Blue'],bs.inputs['Metallic'])
 normal=nt.nodes.new('ShaderNodeNormalMap');normal.space='TANGENT';nt.links.new(nodes['normal'].outputs['Color'],normal.inputs['Color']);nt.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 ng=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree');ng.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat');group=nt.nodes.new('ShaderNodeGroup');group.node_tree=ng;nt.links.new(split.outputs['Red'],group.inputs['Occlusion'])
 return m,nodes
bodymat,bodynodes=pbr('body');wheelmat,wheelnodes=pbr('wheel')
bodyMesh.data.materials.clear();bodyMesh.data.materials.append(bodymat)
for p in bodyMesh.data.polygons:p.material_index=0
for o in wheelmeshes:o.data.materials.append(wheelmat)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1;bpy.context.view_layer.update()
renderables=[bodyMesh]+wheelmeshes
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in renderables)
# Export neutrally colored source. Runtime tinting is mask based, never global body tint.
bpy.ops.object.select_all(action='DESELECT')
for o in [root,body,controller]+list(root.children_recursive):o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'corvette-'+level+'.blend'),compress=True)
gltfpath=os.path.join(PUBLIC,level+'.gltf')
bpy.ops.export_scene.gltf(filepath=gltfpath,export_format='GLTF_SEPARATE',export_texture_dir='textures/'+level,use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_tangents=True,export_materials='EXPORT',export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
data=json.load(open(gltfpath));binpath=os.path.join(PUBLIC,data['buffers'][0].pop('uri'));binary=open(binpath,'rb').read();j=json.dumps(data,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\0'*((-len(binary))%4)
with open(os.path.join(PUBLIC,level+'.glb'),'wb') as f:f.write(struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary)));f.write(struct.pack('<II',len(j),0x4e4f534a));f.write(j);f.write(struct.pack('<II',len(binary),0x004e4942));f.write(binary)
prims=sum(len(m['primitives']) for m in data['meshes']);report={'level':level,'triangles':triangles,'primitives':prims,'meshes':len(data['meshes']),'materials':len(data.get('materials',[])),'externalImages':[i.get('uri') for i in data.get('images',[])],'glbBytes':os.path.getsize(os.path.join(PUBLIC,level+'.glb'))}
open(os.path.join(OUT,'export-metrics.json'),'w').write(json.dumps(report,indent=2));print('PRODUCTION_EXPORT',json.dumps(report),flush=True)
# Review rendering uses the same atlases with their customization masks.
for mat,nodes,color in [(bodymat,bodynodes,(.0012,.109,.283,1)),(wheelmat,wheelnodes,(.03,.04,.05,1))]:
 nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF');split=nt.nodes.new('ShaderNodeSeparateColor');split.mode='RGB';nt.links.new(nodes['mask'].outputs[0],split.inputs[0]);mix=nt.nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[2].default_value=color;nt.links.new(split.outputs['Red'],mix.inputs[0]);nt.links.new(nodes['baseColor'].outputs[0],mix.inputs[1]);nt.links.new(mix.outputs[0],bs.inputs['Base Color'])
def material(name,color,rough=.5):
 m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;return m
scene.view_layers[0].material_override=None;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
ns={'bpy':bpy,'Vector':Vector,'os':os,'OUT':OUT,'meta':report,'scene':scene,'C':C,'material':material,'json':json}
renders=open(os.path.join(ROOT,'scripts/corvette-extract.py')).read().split('def area(',1)[1];exec('def area('+renders,ns)
