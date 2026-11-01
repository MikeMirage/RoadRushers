"""Headless material renders plus skill-mandated random/wire review sheets."""
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path.home()/'.codex/skills/blender-asset-qa/scripts'))
import review_shots
SELECTION=json.loads((ROOT/'art/environment-selection.json').read_text())
OUTPUT=ROOT/'public/assets/environment/previews';OUTPUT.mkdir(parents=True,exist_ok=True)
REVIEWS=ROOT/'art/reviews';REVIEWS.mkdir(parents=True,exist_ok=True)


args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for entry in SELECTION['models']:
    if args and entry['id'] not in args:continue
    asset_id=entry['id']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/f'public/assets/environment/models/{asset_id}/lod0.gltf'))
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    bpy.context.view_layer.update()
    # Required topology/contact views are intentionally separate from beauty.
    for mode in ['random','wire']:
        review_shots.run(objects=[o.name for o in obs],out=str(REVIEWS/f'{asset_id}-{mode}.png'),views=['front','three_quarter'],mode=mode,res=192)
    points=[o.matrix_world@Vector(c) for o in obs for c in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    scale=2.8/max(hi-lo)
    for ob in obs:
        ob.location*=scale;ob.scale*=scale
    bpy.context.view_layer.update()
    material=bpy.data.materials.new('Review_floor');material.diffuse_color=(.12,.17,.105,1);material.use_nodes=True
    shader=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED');shader.inputs['Base Color'].default_value=(.12,.17,.105,1);shader.inputs['Roughness'].default_value=.9
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));floor=bpy.context.object;floor.data.materials.append(material)
    world=bpy.data.worlds.new('Review_world');world.use_nodes=True
    background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');background.inputs['Color'].default_value=(.32,.43,.34,1);background.inputs['Strength'].default_value=.65
    sc=bpy.context.scene;sc.world=world
    for name,location,power,size,color in [('Key',(-3,-4,6),700,5,(1,.87,.69)),('Fill',(4,1,4),450,4,(.75,.86,1))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
        light=bpy.data.objects.new(name,data);sc.collection.objects.link(light);light.location=location;light.rotation_euler=(-light.location+Vector((0,0,1))).to_track_quat('-Z','Y').to_euler()
    center=Vector((0,0,(hi.z-lo.z)*scale*.48))
    data=bpy.data.cameras.new('Review_camera');camera=bpy.data.objects.new('Review_camera',data);sc.collection.objects.link(camera)
    camera.location=center+Vector((3.6,-5.4,2.6));camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=3.9
    sc.camera=camera;sc.render.engine='BLENDER_EEVEE_NEXT' if bpy.app.version<(5,0,0) else 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples=32;sc.render.resolution_x=512;sc.render.resolution_y=512;sc.render.resolution_percentage=100
    sc.view_settings.view_transform='AgX';sc.render.image_settings.file_format='WEBP';sc.render.image_settings.quality=92
    sc.render.filepath=str(OUTPUT/f'{asset_id}.webp');bpy.ops.render.render(write_still=True)
    print('REVIEWED',asset_id,flush=True)
print('REVIEW COMPLETE',flush=True)
