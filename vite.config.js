import { defineConfig } from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const audioFeedback={name:'audio-feedback',configureServer(server){
  server.middlewares.use('/__audio-feedback',async(req,res)=>{
    if(req.method!=='POST'||req.headers.origin!==`http://${req.headers.host}`){res.statusCode=403;res.end();return;}
    try{
      let body='';for await(const chunk of req){body+=chunk;if(body.length>65536){res.statusCode=413;res.end();return;}}
      const input=JSON.parse(body),notes={};
      for(const id of ['menu-lounge','coastal-velocity','coastal-velocity-r2','neon-surge','v8-steady','tire-scrub','tire-scrub-r4','gravel-roll','guardrail-a','guardrail-b','ui-navigate','ui-confirm','ui-back','ui-notify','ui-confirm-r3','ui-back-r3','race-countdown-preview']){
        const note=input[id];if(!note)continue;
        notes[id]={rating:['pending','approve','adjust','reject'].includes(note.rating)?note.rating:'pending',text:String(note.text||'').slice(0,8000)};
      }
      const dir=resolve(server.config.root,'artifacts');await mkdir(dir,{recursive:true});
      await writeFile(resolve(dir,'audio-feedback-v2.json'),JSON.stringify({savedAt:new Date().toISOString(),notes},null,2));
      res.setHeader('Content-Type','application/json');res.end('{"saved":true}');
    }catch{res.statusCode=400;res.end('{"saved":false}');}
  });
}};

export default defineConfig({
  plugins:[audioFeedback],
  // The reference has its own CDN import map; it is not an application entry.
  optimizeDeps: { entries: ['index.html'] },
  build: { rollupOptions: { input: ['index.html', 'vehicle-review.html', 'asset-library.html', 'corvette-garage.html', 'audio-review.html', 'corvette-studio.html', 'advertising-library.html'] } },
  server: { host: '127.0.0.1', port: 5174, strictPort: true, watch: { ignored: ['**/artifacts/**', '**/versiones/**'] } },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
});
