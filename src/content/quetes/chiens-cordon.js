// Quête secondaire « Les chiens du Cordon » (brief v2 §8.1, §8.2), donnée par Tolik le Bleu.
// Rencontre nommée : la carte chiens du paquet de rencontres du Cordon. Délai et récompenses :
// hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Les chiens du Cordon',
  giver: 'tolik',
  start: 'traque',
  deadline: 2,
  rewards: { roubles: 100, xp: 30, items: ['bandage'] },
  steps: {
    traque: { objective: { type: 'eliminer', encounter: 'chiens', tile: 'cordon' }, next: ['rapport'] },
    rapport: { objective: { type: 'parler', npc: 'tolik', node: 'chiens-morts' }, next: [] },
  },
});
