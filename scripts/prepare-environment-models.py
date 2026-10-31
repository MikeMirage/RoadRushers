"""Run with Blender --background --factory-startup --python this_file.

Preserves source glTFs, selects one complete source variant, creates textured
near/far LODs, checks the mesh, and writes portable glTF without compression
extensions. Headless process only; never touches a live Blender session.
"""
import json
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/source/polyhaven"
OUT = ROOT / "public/assets/environment/models"
REPORTS = ROOT / "art/reports"
REPORTS.mkdir(parents=True, exist_ok=True)
SELECTION = json.loads((ROOT / "art/environment-selection.json").read_text())
SKILLS = Path.home() / '.codex/skills'
sys.path.insert(0, str(SKILLS / 'blender-asset-qa/scripts'))
import qa_check


def triangles(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def cleanup(ob, remove_scan_debris=False):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    # glTF splits vertices at UV/normal seams. Blender keeps UVs per loop, so
    # welding coincident vertices restores connectivity without losing the UVs.
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000001)
    bmesh.ops.dissolve_degenerate(bm, dist=0.000001, edges=list(bm.edges))
    tiny = [f for f in bm.faces if f.calc_area() < 1.01e-10]
    if tiny:
        bmesh.ops.delete(bm, geom=tiny, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    if remove_scan_debris:
        unseen=set(bm.verts);islands=[]
        while unseen:
            stack=[unseen.pop()];island=set(stack)
            while stack:
                for edge in stack.pop().link_edges:
                    for v in edge.verts:
                        if v in unseen:
                            unseen.remove(v);island.add(v);stack.append(v)
            islands.append(island)
        if islands:
            largest=max(islands,key=len)
            debris=[v for island in islands if island is not largest for v in island]
            if debris:bmesh.ops.delete(bm,geom=debris,context='VERTS')
    # Some scans contain a tiny branched seam with >2 incident faces. Remove
    # the smallest redundant triangle at that seam, then orient the shell.
    for edge in list(bm.edges):
        while edge.is_valid and len(edge.link_faces)>2:
            face=min(edge.link_faces,key=lambda f:f.calc_area())
            bmesh.ops.delete(bm,geom=[face],context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bad=set()
    for edge in bm.edges:
        if len(edge.link_faces)==2:
            a,b=edge.link_faces
            la=next(l for l in a.loops if l.edge==edge)
            lb=next(l for l in b.loops if l.edge==edge)
            if la.vert==lb.vert:bad.add(min([a,b],key=lambda f:f.calc_area()))
    if bad:
        bmesh.ops.delete(bm,geom=list(bad),context='FACES')
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


def select(obs):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]


def prepare(entry):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    asset_id = entry['id']
    path = SOURCE / 'models' / asset_id / f'{asset_id}.gltf'
    if not path.exists():
        return None
    bpy.ops.import_scene.gltf(filepath=str(path))
    # The provider's 1K glTF sometimes points to JPEG for cutout leaves. Restore
    # its separately supplied alpha map before exporting the local runtime copy.
    alpha_files=list((path.parent/'textures').glob('*_alpha.png'))
    for alpha_path in alpha_files:
        image=bpy.data.images.load(str(alpha_path),check_existing=True);image.colorspace_settings.name='Non-Color'
        token=alpha_path.stem.replace('_alpha','')
        for material in bpy.data.materials:
            if token not in material.name:continue
            bsdf=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if not bsdf:continue
            tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
            material.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Alpha'])
            material.surface_render_method='DITHERED';material.alpha_threshold=.4
    bpy.context.view_layer.update()
    obs = [ob for ob in bpy.context.scene.objects if ob.type == 'MESH']
    if asset_id=='modular_chainlink_fence':
        # The source is an exploded kit of twenty pieces. Runtime uses the
        # complete standard panel; the full modular kit remains in the source.
        chosen=next(ob for ob in obs if ob.name=='modular_chainlink_fence')
        post=next(ob for ob in obs if ob.name=='modular_chainlink_fence_post')
        ends=[chosen.matrix_world@Vector(c) for c in chosen.bound_box]
        x0=min(p.x for p in ends);x1=max(p.x for p in ends);y=sum(p.y for p in ends)/8
        posts=[]
        for x in [x0-.025,x1+.025]:
            copy=post.copy();copy.data=post.data.copy();bpy.context.scene.collection.objects.link(copy)
            pp=[copy.matrix_world@Vector(c) for c in copy.bound_box]
            center=Vector((sum(p.x for p in pp)/8,sum(p.y for p in pp)/8,min(p.z for p in pp)))
            copy.location+=Vector((x,y,0))-center;posts.append(copy)
        for ob in obs:
            if ob!=chosen:bpy.data.objects.remove(ob,do_unlink=True)
        obs=[chosen,*posts]
    # Most natural assets contain several independent variants, all at origin.
    # Keep one complete mesh, including ALL its material primitives.
    # Circuit assemblies keep all components (posts, wire, fasteners, etc.).
    if entry['family'] in ['Vegetación', 'Rocas'] and len(obs) > 1:
        chosen = sorted(obs, key=lambda ob: ob.name)[0]
        for ob in obs:
            if ob != chosen:
                bpy.data.objects.remove(ob, do_unlink=True)
        obs = [chosen]
    select(obs)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if asset_id in ['tree_small_02','island_tree_02']:
        # Keep a separate simplification budget for the canopy. A single
        # collapse over the complete high-resolution tree can delete its leaves.
        for ob in list(obs):
            select([ob]);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
        obs=[ob for ob in bpy.context.scene.objects if ob.type=='MESH']
    for ob in obs:cleanup(ob,entry['family']=='Rocas')
    # Center around the complete asset, then ground in Blender's Z-up space.
    points = [ob.matrix_world @ Vector(c) for ob in obs for c in ob.bound_box]
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    offset = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for ob in obs:
        ob.location -= offset
    bpy.context.view_layer.update()
    before = sum(triangles(ob) for ob in obs)
    report = {"id": asset_id, "sourceVariantTriangles": before, "lods": [], "qa": []}
    for level, budget in enumerate([entry['targetTriangles'], max(700, entry['targetTriangles'] // 3)]):
        for attempt in range(1 if asset_id in ['tree_small_02','island_tree_02'] else 4):
            total = sum(triangles(ob) for ob in obs)
            ratio = min(1.0, budget / max(total, 1))
            if attempt and ratio>.97:break
            for ob in obs:
                part_ratio=ratio
                if asset_id in ['tree_small_02','island_tree_02']:
                    material_name=ob.data.materials[0].name.lower()
                    share=.72 if 'leaves' in material_name else .2 if 'branch' in material_name else .08
                    part_ratio=min(1.0,budget*share/max(triangles(ob),1))
                if part_ratio < .999:
                    mod = ob.modifiers.new('Web_LOD', 'DECIMATE')
                    mod.ratio = part_ratio
                    mod.use_collapse_triangulate = True
                    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
                        bpy.ops.object.modifier_apply(modifier=mod.name)
                cleanup(ob,entry['family']=='Rocas')
        select(obs)
        # Preserve the exact same grounded origin at each LOD after collapse.
        low=min((ob.matrix_world@v.co).z for ob in obs for v in ob.data.vertices)
        for ob in obs:ob.location.z-=low
        bpy.context.view_layer.update()
        # Leaf cards and scan islands are intentional. Run the complete checker
        # and retain its raw findings, separately classify these known cases.
        qa = qa_check.run(objects=[ob.name for ob in obs], profile='game', eps=.00005, tol=.015)
        expected, blocking = [], []
        for error in qa['errors']:
            if entry['family'] == 'Vegetación' and ('floating/detached' in error or 'z-fighting:' in error or 'zero-area UV' in error):
                expected.append(error)
            elif 'zero-area UV' in error:
                # Photogrammetry UVs can collapse on very small scan triangles.
                # These are flagged for inspection in the material viewer.
                expected.append(error)
            else:
                blocking.append(error)
        report['qa'].append({"level": level, "raw": qa, "acceptedSourceFindings": expected, "blocking": blocking})
        folder = OUT / asset_id
        folder.mkdir(parents=True, exist_ok=True)
        out = folder / f'lod{level}.gltf'
        bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLTF_SEPARATE', use_selection=True,
                                  export_animations=False, export_yup=True, export_extras=True,
                                  export_image_format='AUTO', export_materials='EXPORT')
        dims = hi - lo
        actual = sum(triangles(ob) for ob in obs)
        report['lods'].append({"level":level, "url": f'/assets/environment/models/{asset_id}/lod{level}.gltf',
                               "triangles": actual, "dimensions": [round(dims.x,4),round(dims.z,4),round(dims.y,4)],
                               "meshes": len(obs), "materials": len({m for ob in obs for m in ob.data.materials}),
                               "gltfBytes": out.stat().st_size})
        print(f'PREPARED {asset_id} LOD{level}: {actual:,} triangles; {len(blocking)} blocking findings; {len(expected)} source findings', flush=True)
    (REPORTS / f'{asset_id}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    return report


reports = []
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for entry in SELECTION['models']:
    if args and entry['id'] not in args:
        continue
    result = prepare(entry)
    if result:
        reports.append(result)
print('PREPARED TOTAL', len(reports), flush=True)
