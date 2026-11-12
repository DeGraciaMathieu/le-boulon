// Paquet Météo de la Zone (brief v2 §4.2, carte 7) : une carte chaque matin. Format decks de
// src/content/validate.js, kind 'meteo'.
// Types : 'calme' | 'brouillard' | 'pluie' | 'emission'. Champs d'effet de la journée (lus par
// src/engine/rules/time.js) : stealth (bonus aux tests de Discrétion), detector (portée du
// détecteur).
// La carte 'emission' (signes d'Émission, §10) ne se pioche pas au hasard : elle sort le matin
// où le calendrier de l'Émission (world.emission.nextDay, carte 8) tombe.
// Nombre de cartes : hypothèse v2. Brouillard sans effet chiffré (le brief n'en donne pas).

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  meteo: {
    kind: 'meteo',
    cards: [
      { id: 'calme', type: 'calme', count: 3 },
      { id: 'brouillard', type: 'brouillard', count: 1 },
      { id: 'pluie', type: 'pluie', count: 2, stealth: 1, detector: -1 },
      { id: 'signes-emission', type: 'emission', count: 1 },
    ],
  },
});
