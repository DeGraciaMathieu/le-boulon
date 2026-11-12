// Dialogue de base du stalker blessé de l'Élévateur (brief v2 §3.4, §8.3 acte 1). Le soigner
// l'aide (effet 'aider', src/engine/rules/npcs.js) : il ne meurt plus. Le nœud soigne
// accueillera le mot de passe du PDA (cartes 20-21).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Un homme adossé au silo. Sa jambe saigne à travers le bandage.',
      choices: [
        {
          text: 'Donner une trousse de soins.',
          next: 'soigne',
          conditions: [{ type: 'objet', item: 'trousse-soins' }],
          effects: [{ type: 'prendre', item: 'trousse-soins' }, { type: 'aider', npc: 'blesse-elevateur' }],
        },
        {
          text: 'Donner un bandage.',
          next: 'soigne',
          conditions: [{ type: 'objet', item: 'bandage' }],
          effects: [{ type: 'prendre', item: 'bandage' }, { type: 'aider', npc: 'blesse-elevateur' }],
        },
        { text: 'Je reviens.', next: 'attente' },
      ],
    },
    soigne: {
      text: 'Ça tiendra. Merci, stalker. Je te dois quelque chose.',
      effects: [{ type: 'reputation', faction: 'solitaires', amount: 1 }],
      choices: [{ text: 'Repose-toi.', next: null }],
    },
    attente: {
      text: 'Fais vite. Les chiens sentent le sang.',
      choices: [{ text: 'Tiens bon.', next: null }],
    },
  },
});
