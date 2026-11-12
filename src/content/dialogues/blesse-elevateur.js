// Dialogue de base du stalker blessé de l'Élévateur (brief v2 §3.4, §8.3 acte 1). Le soigner
// l'aide (effet 'aider', src/engine/rules/npcs.js) : il ne meurt plus. Soigné, il donne le
// mot de passe du PDA du courrier (nœud mot-de-passe, quête « Le Guide », acte 1).
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
      choices: [
        { text: 'Ce PDA, tu le connais ?', next: 'mot-de-passe', conditions: [{ type: 'quete', quest: 'le-guide', step: 'a1-elevateur', status: 'active' }] },
        { text: 'Repose-toi.', next: null },
      ],
    },
    'mot-de-passe': {
      text: 'Le PDA de Mykyta. On faisait la route ensemble. Le mot de passe, c’est « Kolos ». Il disait qu’il avait trouvé le Guide.',
      choices: [{ text: 'Merci.', next: null }],
    },
    attente: {
      text: 'Fais vite. Les chiens sentent le sang.',
      choices: [{ text: 'Tiens bon.', next: null }],
    },
  },
});
