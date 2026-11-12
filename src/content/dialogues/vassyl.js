// Dialogue de base de Vassyl le conteur, Solitaire du Bar (brief v2 §7).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Vassyl lève son verre vers toi.',
      choices: [
        { text: 'Raconte.', next: 'histoire' },
        { text: 'Tu as entendu parler du Guide ?', next: 'guide' },
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
  },
});
