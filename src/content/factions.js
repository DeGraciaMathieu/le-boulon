// Factions du brief v2 §9 (carte 16). Règles : src/engine/rules/factions.js.
//
//   { id, nom, base, tuiles, rejoignable, acte?, rival?, attitude }
//     base         lieux de la faction, en texte (les ids de lieux viendront de la carte 10)
//     tuiles       ids de content.tiles (§3.1) où se trouve la base
//     rejoignable  'defaut' (Solitaires), true (acte 4), false
//     rival        faction passée à -2 quand on rejoint celle-ci (§9)
//     attitude     palier de départ : 'amical' | 'neutre' | 'hostile'

const faction = (data) => Object.freeze({ ...data, base: Object.freeze(data.base), tuiles: Object.freeze(data.tuiles) });

export default Object.freeze({
  solitaires: faction({
    id: 'solitaires', nom: 'Solitaires', base: ['Camp des novices'], tuiles: ['cordon'],
    rejoignable: 'defaut', attitude: 'amical',
  }),
  devoir: faction({
    id: 'devoir', nom: 'Devoir', base: ['Bar « 100 Rads »'], tuiles: ['rostok'],
    rejoignable: true, acte: 4, rival: 'liberte', attitude: 'neutre',
  }),
  liberte: faction({
    id: 'liberte', nom: 'Liberté', base: ['Base des Entrepôts'], tuiles: ['entrepots'],
    rejoignable: true, acte: 4, rival: 'devoir', attitude: 'neutre',
  }),
  'ciel-pur': faction({
    id: 'ciel-pur', nom: 'Ciel Pur', base: ['Base du Marais'], tuiles: ['marais'],
    rejoignable: false, attitude: 'neutre',
  }),
  bandits: faction({
    id: 'bandits', nom: 'Bandits', base: ['Usine de la Vallée Sombre', 'Barrage de la Décharge'],
    tuiles: ['vallee-sombre', 'decharge'], rejoignable: false, attitude: 'hostile',
  }),
  militaires: faction({
    id: 'militaires', nom: 'Militaires', base: ['Avant-poste du Cordon', "Institut d'Agroprom"],
    tuiles: ['cordon', 'agroprom'], rejoignable: false, attitude: 'hostile',
  }),
});
