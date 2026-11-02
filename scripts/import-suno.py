"""Prepare user-selected Suno songs, preserving originals. Requires local ffmpeg."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess

parser=argparse.ArgumentParser()
parser.add_argument('--ffmpeg',default='ffmpeg')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]/'public/audio/suno'
ready=root/'ready'
ready.mkdir(exist_ok=True)
names={
 'Precision Objects':('precision-objects','menu','Menú y garaje'),
 'Coastal Velocity':('coastal-velocity','coast','Puerto y costa'),
 'Afterlight Express':('afterlight-express','night','Noche y lluvia'),
 'Timberline Run':('timberline-run','forest','Bosque y aserradero'),
 'Golden Apex':('golden-apex','sunset','Faro, atardecer y resultados'),
 'One More Lap':('one-more-lap','practice','Entrenamiento y contrarreloj'),
}

def run(command):
 p=subprocess.run([args.ffmpeg,'-nostdin','-hide_banner',*command],capture_output=True,text=True)
 if p.returncode: raise RuntimeError(p.stderr[-3000:])
 return p.stderr

def process(path):
 title=re.sub(r' \(1\)$','',path.stem)
 if title not in names: raise ValueError('Unmapped song: '+path.name)
 slug,group,use=names[title];variant='b' if path.stem.endswith(' (1)') else 'a';ident=f'suno-{slug}-{variant}'
 destination=ready/(ident+'.mp3')
 measurement=run(['-i',str(path),'-vn','-af','loudnorm=I=-18:TP=-2:LRA=11:print_format=json','-f','null','-'])
 stats=json.loads(measurement[measurement.rfind('{'):measurement.rfind('}')+1])
 duration=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',measurement)
 duration=sum(float(n)*factor for n,factor in zip(duration.groups(),[3600,60,1]))
 settings=f"loudnorm=I=-18:TP=-2:LRA=11:measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}:linear=true:print_format=json"
 rendered=run(['-y','-i',str(path),'-vn','-map_metadata','-1','-af',settings,'-ar','44100','-ac','2','-c:a','libmp3lame','-b:a','192k',str(destination)])
 output=json.loads(rendered[rendered.rfind('{'):rendered.rfind('}')+1])
 print(f'{title} {variant.upper()}: {duration:.2f}s, {stats["input_i"]} → {output["output_i"]} LUFS',flush=True)
 return {'id':ident,'title':title,'variant':variant.upper(),'group':group,'use':use,'file':'/audio/suno/ready/'+destination.name,'original':path.name,'duration':duration,'userSelected':True,'source':'Suno · aportado por el usuario','originalSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'normalization':{'targetLUFS':-18,'targetTruePeak':-2,'inputLUFS':float(stats['input_i']),'outputLUFS':float(output['output_i']),'outputTruePeak':float(output['output_tp'])}}

with ThreadPoolExecutor(max_workers=3) as pool:
 catalogue=list(pool.map(process,sorted(root.glob('*.m4a'))))
(root/'catalogue.json').write_text(json.dumps(catalogue,ensure_ascii=False,indent=2)+'\n')
