// Dialogue de base de Vassyl le conteur, Solitaire du Bar (brief v2 §7).
// Donne la quête « L’ami du Pont » (src/content/quetes/ami-du-pont.js) ; son embranchement
// au nœud trace.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Vassyl lève son verre vers toi.',
      choices: [
        { text: 'Raconte.', next: 'histoire' },
        { text: 'Tu as entendu parler du Guide ?', next: 'guide' },
        {
          text: 'Tu as l’air triste ce soir.',
          next: 'ami',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'ami-du-pont' } }],
          effects: [{ type: 'quete', quest: 'ami-du-pont' }],
        },
        {
          text: 'Je reviens du Pont.',
          next: 'trace',
          conditions: [{ type: 'quete', quest: 'ami-du-pont', step: 'retour' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    histoire: {
      text: 'Un stalker a trouvé un artefact qui chante. Il l’a vendu. Il chante encore, dit-on.',
      choices: [{ text: 'Belle histoire.', next: 'accueil' }],
    },
    guide: {
      text: 'Il aurait traversé la Vallée Sombre seul. Ou c’est une légende de plus.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
    ami: {
      text: 'Mon ami Ihor est parti au Pont de la Vallée il y a un mois. Pas de nouvelles. Va voir.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    trace: {
      text: 'Alors ? Tu l’as vu ?',
      choices: [
        {
          text: 'Son sac était dans la rivière.',
          next: 'verite',
          effects: [{ type: 'avancer', quest: 'ami-du-pont', step: 'verite' }],
        },
        {
          text: 'Aucune trace. Il a dû passer.',
          next: 'espoir',
          effects: [{ type: 'avancer', quest: 'ami-du-pont', step: 'espoir' }],
        },
      ],
    },
    verite: {
      text: 'La rivière. Je m’en doutais. Merci de ne pas mentir.',
      choices: [{ text: 'Désolé.', next: 'accueil' }],
    },
    espoir: {
      text: 'Il est têtu. Il reviendra. Je lui garde un verre.',
      choices: [{ text: 'Sûrement.', next: 'accueil' }],
    },
  },
});
