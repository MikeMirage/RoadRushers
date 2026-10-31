"""Make self-hosted WebP/glTF runtime files and a source-backed asset catalog."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'public/assets/environment'
source = json.loads((ROOT / 'art/source/polyhaven/provenance.json').read_text())
selection=json.loads((ROOT / 'art/environment-selection.json').read_text())
selected={a['id']:a for a in selection['models']+selection['materials']}
assets = []
for entry in source['assets']:
    record = {k: v for k, v in entry.items() if k != 'sourceFiles'}
    record.update(selected[entry['id']])
    if entry['kind'] == 'model':
        report = json.loads((ROOT / f'art/reports/{entry["id"]}.json').read_text())
        record['lods'] = report['lods']
        record['acceptedSourceFindings'] = sum(len(q['acceptedSourceFindings']) for q in report['qa'])
        record['blockingFindings'] = sum(len(q['blocking']) for q in report['qa'])
        folder = BASE / 'models' / entry['id']
        for path in folder.glob('*.gltf'):
            data = json.loads(path.read_text())
            for im in data.get('images', []):
                if 'uri' not in im:
                    continue
                original = folder / im['uri']
                dest = original.with_suffix('.webp')
                if not dest.exists():
                    image = Image.open(original)
                    # Alpha silhouettes remain lossless, no black-fringe matting.
                    if 'A' in image.getbands() or any(key in original.stem.lower() for key in ['nor_', 'arm_', 'rough']):
                        image.save(dest, 'WEBP', lossless=True, method=6)
                    else:
                        image.convert('RGB').save(dest, 'WEBP', quality=95, method=6)
                im['uri'] = str(dest.relative_to(folder))
                im['mimeType'] = 'image/webp'
            for tex in data.get('textures', []):
                if 'source' in tex:
                    tex.setdefault('extensions', {})['EXT_texture_webp']={'source':tex.pop('source')}
            data['extensionsUsed']=sorted(set(data.get('extensionsUsed',[]))|{'EXT_texture_webp'})
            data['extensionsRequired']=sorted(set(data.get('extensionsRequired',[]))|{'EXT_texture_webp'})
            for material in data.get('materials', []):
                if any(token in material.get('name','').lower() for token in ['leaves','twig']):
                    material['alphaMode']='MASK';material['alphaCutoff']=.4
            path.write_text(json.dumps(data, separators=(',', ':'))+'\n')
        # Only optimized images go into the web build; original JPEG/PNG files
        # remain in art/source/polyhaven.
        for path in folder.rglob('*'):
            if path.suffix.lower() in {'.jpg','.jpeg','.png'}:
                path.unlink()
    files = []
    folder = BASE / ('models' if entry['kind'] == 'model' else 'materials') / entry['id']
    for path in sorted(folder.rglob('*')):
        if path.is_file():
            files.append({'url':'/assets/environment/'+str(path.relative_to(BASE)), 'bytes':path.stat().st_size,
                          'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    record['files'] = files
    record['bytes'] = sum(f['bytes'] for f in files)
    if entry['kind']=='model':record['preview']=f'/assets/environment/previews/{entry["id"]}.webp'
    assets.append(record)
manifest = {'version':1, 'provider':'Poly Haven', 'license':'CC0-1.0', 'licenseUrl':'https://polyhaven.com/license',
            'sourceProvenance':'art/source/polyhaven/provenance.json', 'assets':assets}
(BASE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
print(f'{len(assets)} assets, {sum(a["bytes"] for a in assets)/1e6:.1f} MB runtime')
for a in assets:
    if a.get('blockingFindings'):
        print('REVIEW REQUIRED',a['id'], a['blockingFindings'])
