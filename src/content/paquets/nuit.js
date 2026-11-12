// Paquets Nuit, un par tuile (brief v2 §4.3, carte 7) : la carte piochée au bivouac, dans un
// abri comme à découvert. Format decks de src/content/validate.js, kind 'nuit'.
// Types de carte (effets dans src/engine/rules/time.js) :
//   'calme'      rien
//   'radiations' amount radiations (cause 'nuit')
//   'blessure'   amount blessures (cause 'nuit')
//   'rencontre'  rencontre de nuit, sans test de Discrétion
// Compositions et montants : hypothèse v2 (le brief ne détaille pas les cartes Nuit) ; les
// tuiles profondes sont plus dangereuses.

import { deepFreeze } from '../freeze.js';

const nuit = (tile, cards) => ({ kind: 'nuit', tile, cards });
const calme = (count) => ({ id: 'nuit-calme', type: 'calme', count });
const vent = (count, amount = 1) => ({ id: 'vent-radioactif', type: 'radiations', count, amount });
const froid = (count) => ({ id: 'froid', type: 'blessure', count, amount: 1 });
const rodeurs = (count) => ({ id: 'rodeurs', type: 'rencontre', count });

export default deepFreeze({
  'nuit-cordon': nuit('cordon', [calme(6), vent(1), rodeurs(1)]),
  'nuit-marais': nuit('marais', [calme(5), froid(1), vent(1), rodeurs(1)]),
  'nuit-decharge': nuit('decharge', [calme(5), vent(2), rodeurs(1)]),
  'nuit-agroprom': nuit('agroprom', [calme(5), vent(1), froid(1), rodeurs(1)]),
  'nuit-vallee-sombre': nuit('vallee-sombre', [calme(4), vent(1), froid(1), rodeurs(2)]),
  'nuit-rostok': nuit('rostok', [calme(5), vent(1), rodeurs(2)]),
  'nuit-entrepots': nuit('entrepots', [calme(4), vent(2, 2), froid(1), rodeurs(2)]),
});
