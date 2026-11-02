import tour from './tracks/gp-world-tour.json' with {type:'json'};
import {kitConfig} from './track-pieces.js';

/** Geographic silhouettes adapted to compact, fully editable race circuits. */
export const GP_CIRCUITS=tour.map(({document,...reference})=>({
  ...kitConfig(document.pieces,document.name,reference.id),
  startHeight:document.startHeight||0,
  subtitle:reference.description,region:`GP MUNDIAL · ${reference.country.toLocaleUpperCase('es')}`,
  difficulty:reference.slug==='monaco'?'Precisión':'Gran Premio',
  biome:document.environment.biome,environmentTheme:document.environment.theme,
  editorDocument:document,editorEnvironment:document.environment,manualProps:document.props,
  gp:reference,
}));
