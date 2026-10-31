"""Download the explicit CC0 selection, with checksums and resumable local cache.

Run from the repository root: python3 scripts/fetch-environment-assets.py
The game never calls the live API. Powered by Poly Haven: https://polyhaven.com
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art" / "source" / "polyhaven"
RUNTIME = ROOT / "public" / "assets" / "environment"
SELECTION = json.loads((ROOT / "art/environment-selection.json").read_text())


def download(url, path, md5=None):
    if urlparse(url).scheme != "https" or urlparse(url).hostname not in {"api.polyhaven.com", "dl.polyhaven.org", "polyhaven.com"}:
        raise ValueError(f"Unexpected download host: {url}")
    if path.exists() and (not md5 or hashlib.md5(path.read_bytes()).hexdigest() == md5):
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".part")
    subprocess.run(["curl", "--fail", "--location", "--retry", "3", "--max-time", "180", "--silent", "--show-error",
                    "--user-agent", "RoadRushers-Asset-Curation/1.0", url, "--output", str(tmp)], check=True)
    if md5 and hashlib.md5(tmp.read_bytes()).hexdigest() != md5:
        tmp.unlink()
        raise ValueError(f"Checksum mismatch: {url}")
    tmp.replace(path)
    return path


def metadata(asset_id):
    path = SOURCE / "metadata" / f"{asset_id}.json"
    download(f"https://api.polyhaven.com/files/{asset_id}", path)
    return json.loads(path.read_text())


def record_file(path, info):
    return {"path": str(path.relative_to(ROOT)), "url": info["url"], "bytes": path.stat().st_size,
            "md5": info["md5"], "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def model(entry):
    asset_id = entry["id"]
    data = metadata(asset_id)
    gltf = data["gltf"]["1k"]["gltf"]
    total = gltf["size"] + sum(f["size"] for f in gltf["include"].values())
    if total > 160_000_000:
        raise ValueError(f"{asset_id}: source too large ({total / 1e6:.1f} MB)")
    folder = SOURCE / "models" / asset_id
    files = []
    main = download(gltf["url"], folder / f"{asset_id}.gltf", gltf["md5"])
    files.append(record_file(main, gltf))
    for name, info in gltf.get("include", {}).items():
        if Path(name).is_absolute() or ".." in Path(name).parts:
            raise ValueError(f"Unsafe relative path: {name}")
        files.append(record_file(download(info["url"], folder / name, info["md5"]), info))
    files.extend(model_alpha(entry, data))
    scene = json.loads(main.read_text())
    triangles = sum(sum(scene["accessors"][p["indices"]]["count"] // 3 for p in mesh["primitives"]) for mesh in scene["meshes"])
    print(f"Downloaded model {asset_id}: {triangles:,} source triangles, {total / 1e6:.1f} MB", flush=True)
    return {**entry, "kind": "model", "source": f"https://polyhaven.com/a/{asset_id}", "license": "CC0-1.0",
            "sourceTriangles": triangles, "sourceFiles": files}


def model_alpha(entry, data):
    files=[]
    for key, maps in data.items():
        if key.endswith('_alpha') and 'png' in maps.get('1k', {}):
            info=maps['1k']['png']
            path=SOURCE / 'models' / entry['id'] / 'textures' / f'{key}.png'
            files.append(record_file(download(info['url'],path,info['md5']),info))
    return files


def material(entry):
    from PIL import Image
    asset_id = entry["id"]
    data = metadata(asset_id)
    maps, files = {}, []
    # ARM: red=AO, green=roughness, blue=metallic, matching glTF/Three.js.
    for semantic, candidates in {"color": ["diff", "Diffuse"], "normal": ["nor_gl"], "arm": ["arm"]}.items():
        key = next((key for key in candidates if key in data), None)
        if not key:
            raise ValueError(f"{asset_id}: missing required map {semantic}; available: {list(data)}")
        info = data[key]["1k"]["jpg"]
        path = download(info["url"], SOURCE / "materials" / asset_id / f"{semantic}.jpg", info["md5"])
        files.append(record_file(path, info))
        dest = RUNTIME / "materials" / asset_id / f"{semantic}.webp"
        dest.parent.mkdir(parents=True, exist_ok=True)
        Image.open(path).convert("RGB").save(dest, "WEBP", quality=91 if semantic == "color" else 96, method=6)
        maps[semantic] = f"/assets/environment/materials/{asset_id}/{semantic}.webp"
    print(f"Downloaded material {asset_id}", flush=True)
    return {**entry, "kind": "material", "source": f"https://polyhaven.com/a/{asset_id}", "license": "CC0-1.0",
            "resolution": 1024, "maps": maps, "sourceFiles": files}


def main():
    if '--alpha-only' in sys.argv:
        path=SOURCE / 'provenance.json';provenance=json.loads(path.read_text())
        for entry in provenance['assets']:
            if entry['kind']!='model':continue
            extra=model_alpha(entry,metadata(entry['id']))
            existing={f['path']:f for f in entry['sourceFiles']}
            existing.update({f['path']:f for f in extra});entry['sourceFiles']=list(existing.values())
        path.write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
        return
    results, errors = [], []
    tasks = [(model, entry) for entry in SELECTION["models"]] + [(material, entry) for entry in SELECTION["materials"]]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        pending = {pool.submit(fn, entry): entry["id"] for fn, entry in tasks}
        for future in concurrent.futures.as_completed(pending):
            try:
                results.append(future.result())
            except Exception as error:
                errors.append({"id": pending[future], "error": str(error)})
                print(f"FAILED {pending[future]}: {error}", flush=True)
    results.sort(key=lambda v: v["id"])
    report = {"provider": "Poly Haven", "license": "CC0-1.0", "licenseUrl": SELECTION["licenseUrl"],
              "downloadedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "assets": results, "errors": errors}
    SOURCE.mkdir(parents=True, exist_ok=True)
    (SOURCE / "provenance.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(f"Completed: {len(results)} assets; {len(errors)} failures", flush=True)
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
