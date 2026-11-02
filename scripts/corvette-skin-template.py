"""Draw exact exported paint UV wireframe. Run after corvette-build.py."""
import json,os
from PIL import Image,ImageDraw,ImageFont
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
polys=json.load(open(os.path.join(ROOT,'art/corvette-c7/paint-uv.json')))
im=Image.new('RGB',(1536,1024),'#f7f7f7');d=ImageDraw.Draw(im)
for pts in polys:
 pp=[(u*1536,(1-v)*1024) for u,v in pts];d.line(pp+[pp[0]],fill='#b0bac1',width=1)
try:font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',19)
except OSError:font=ImageFont.load_default()
for col in range(3):d.line([(col*512,0),(col*512,1024)],fill='#2c3540',width=2)
d.line([(0,512),(1536,512)],fill='#2c3540',width=2)
for col,row,label in [(0,0,'RIGHT SIDE / LADO DERECHO'),(0,1,'LEFT SIDE / LADO IZQUIERDO'),(1,0,'TOP / CAPO + TECHO'),(1,1,'UNDERBODY / BAJOS'),(2,0,'FRONT / FRENTE'),(2,1,'REAR / TRASERA')]:
 x=col*512+18;y=row*512+12;d.rectangle((x-4,y-2,x+430,y+30),fill='white');d.text((x,y),label,fill='#15253a',font=font)
im.save(os.path.join(ROOT,'public/models/corvette-c7/skin-template.png'))
