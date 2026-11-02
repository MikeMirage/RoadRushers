import lawson from './tracks/lawson-superstar.json' with {type:'json'};
import {kitConfig} from './track-pieces.js';
import {GP_CIRCUITS} from './gp-circuits.js';
import {normalizeEditorDocument} from './track-editor-state.js';

// Bundled circuits are available on every device, independently of editor storage.
export const COMMUNITY_TRACKS=[{
  ...kitConfig(lawson.pieces,lawson.name,'lawson-superstar-v1'),
  subtitle:'81 tramos · 4,27 km · Espirales, saltos y puentes',region:'CIRCUITOS DE LA COMUNIDAD',
  biome:lawson.environment.biome,environmentTheme:lawson.environment.theme,
  editorDocument:lawson,editorEnvironment:lawson.environment,manualProps:lawson.props,
},...GP_CIRCUITS];

export function findBundledEditorTrack(document){
  const signature=JSON.stringify(normalizeEditorDocument(document));
  return COMMUNITY_TRACKS.find(track=>track.editorDocument&&JSON.stringify(normalizeEditorDocument(track.editorDocument))===signature);
}
