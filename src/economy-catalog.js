// Explicit acquisition sources. Vehicle physics and geometry stay in the production catalogue.
export const groups={
 club:['coda','bambino','borough','kafer','parisienne','bubble'],
 forest:['speedwell','deesse','willy','kombu','apex','seven'],
 mediterranean:['montane','sovereign','gullwing','velo','belvedere','c7-sport'],
 desert:['deuce','mustang','camaro','charger','challenger','gto'],
 winter:['hachiro','fairwind','boxer','delta','moorland','trailmaster'],
 pyrenees:['bronco','gelande','raptor','stratos','turbine','dune'],
 reunion:['stingray','firebird','superbird','neun','miura','viper'],
 tokyo:['hakone','aichi','rotor','midori','rosso','cuneo'],
 bund:['testa','woking','molsheim','modena','enduro','volt'],
};
export const icon=new Set(['velo','gullwing','dune','rosso','woking','molsheim','modena','volt']);
export const special=new Set(['apex','c7-sport','montane','sovereign','seven','boxer','delta','stratos','turbine','gelande','viper','hakone','aichi','midori','cuneo','testa','enduro']);
export const band=id=>icon.has(id)?'icon':special.has(id)?'special':'series';
