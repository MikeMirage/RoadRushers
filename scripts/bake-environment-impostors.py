"""Bake complete tree canopies into two crossing, alpha-tested far LOD cards."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path.home()/'.codex/skills/blender-asset-qa/scripts'))
import qa_check
selection=json.loads((ROOT/'art/environment-selection.json').read_text())
for entry in selection['models']:
    if not entry.get('impostor'):continue
    asset_id=entry['id'];folder=ROOT/f'public/assets/environment/models/{asset_id}'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(folder/'lod0.gltf'));bpy.context.view_layer.update()
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    points=[o.matrix_world@Vector(c) for o in obs for c in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    h=hi.z-lo.z;span=max(hi-lo)*1.06;center=(lo+hi)/2
    sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE_NEXT' if bpy.app.version<(5,0,0) else 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples=48;sc.render.resolution_x=sc.render.resolution_y=768;sc.render.resolution_percentage=100
    sc.render.film_transparent=True;sc.render.image_settings.file_format='PNG';sc.render.image_settings.color_mode='RGBA';sc.view_settings.view_transform='AgX'
    world=bpy.data.worlds.new('Impostor_world');world.use_nodes=True
    bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.55,.62,.6,1);bg.inputs['Strength'].default_value=.8;sc.world=world
    light_data=bpy.data.lights.new('Impostor_sun','SUN');light_data.energy=2.2;light_data.angle=.2
    light=bpy.data.objects.new('Impostor_sun',light_data);sc.collection.objects.link(light);light.rotation_euler=(.55,-.45,-.7)
    cam_data=bpy.data.cameras.new('Impostor_camera');cam_data.type='ORTHO';cam_data.ortho_scale=span
    camera=bpy.data.objects.new('Impostor_camera',cam_data);sc.collection.objects.link(camera);sc.camera=camera
    for side,direction in [('front',Vector((0,-1,0))),('side',Vector((1,0,0)))]:
        camera.location=center+direction*max(span*3,5);camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler();cam_data.clip_end=max(span*8,50)
        sc.render.filepath=str(folder/f'impostor_{side}.png');bpy.ops.render.render(write_still=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    root=bpy.data.objects.new('tree-impostor',None);bpy.context.scene.collection.objects.link(root)
    root['roadrushersImpostor']=True;root['assetHeight']=h
    z0=center.z-span/2;z1=center.z+span/2;cards=[]
    for side,verts in [('front',[(-span/2,0,z0),(span/2,0,z0),(span/2,0,z1),(-span/2,0,z1)]),
                       ('side',[(0,-span/2,z0),(0,span/2,z0),(0,span/2,z1),(0,-span/2,z1)])]:
        mesh=bpy.data.meshes.new(f'{side}_card');mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.update();uv=mesh.uv_layers.new(name='UVMap')
        for loop,coord in zip(mesh.loops,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop.index].uv=coord
        ob=bpy.data.objects.new(f'{side}_card',mesh);bpy.context.scene.collection.objects.link(ob);ob.parent=root;cards.append(ob)
        material=bpy.data.materials.new(f'impostor_{side}');material.use_nodes=True;material.surface_render_method='DITHERED';material.use_backface_culling=False
        bsdf=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Roughness'].default_value=1
        image=bpy.data.images.load(str(folder/f'impostor_{side}.png'));tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
        material.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color']);material.node_tree.links.new(tex.outputs['Alpha'],bsdf.inputs['Alpha']);mesh.materials.append(material)
    qa=qa_check.run(objects=[ob.name for ob in cards],profile='game')
    if qa['errors']:raise RuntimeError(qa['errors'])
    bpy.ops.export_scene.gltf(filepath=str(folder/'lod1.gltf'),export_format='GLTF_SEPARATE',export_animations=False,export_yup=True,export_extras=True)
    path=ROOT/f'art/reports/{asset_id}.json';report=json.loads(path.read_text());report['qa']=[q for q in report['qa'] if q['level']==0]
    report['qa'].append({'level':1,'raw':qa,'acceptedSourceFindings':[],'blocking':[]})
    report['lods']=report['lods'][:1]+[{'level':1,'url':f'/assets/environment/models/{asset_id}/lod1.gltf','triangles':4,
        'dimensions':report['lods'][0]['dimensions'],'meshes':2,'materials':2,'impostor':True,'gltfBytes':(folder/'lod1.gltf').stat().st_size}]
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('BAKED IMPOSTOR',asset_id,flush=True)
