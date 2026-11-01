import lawson from './tracks/lawson-superstar.json' with {type:'json'};
import {kitConfig} from './track-pieces.js';

// Bundled circuits are available on every device, independently of editor storage.
export const COMMUNITY_TRACKS=[{
  ...kitConfig(lawson.pieces,lawson.name,'lawson-superstar-v1'),
  subtitle:'81 tramos · 4,27 km · Espirales, saltos y puentes',region:'CIRCUITOS DE LA COMUNIDAD',
  biome:lawson.environment.biome,environmentTheme:lawson.environment.theme,
  editorDocument:lawson,editorEnvironment:lawson.environment,manualProps:lawson.props,
}];
