// Quêtes écrites (brief v2 §8.1, §8.2 ; carte 15) : { [questId]: quête }, format en tête de
// src/content/validate.js, règles dans src/engine/rules/quests.js. Une quête par fichier,
// sous son id ; son donneur la démarre par l'effet { type: 'quete', quest } de son dialogue.

import { deepFreeze } from '../freeze.js';
import detteBohdan from './dette-bohdan.js';
import chiensCordon from './chiens-cordon.js';
import releveSaveli from './releve-saveli.js';
import leGuide from './le-guide.js';
import souvenirDuGuide from './souvenir-du-guide.js';

export default deepFreeze({
  'dette-bohdan': detteBohdan,
  'chiens-cordon': chiensCordon,
  'releve-saveli': releveSaveli,
  'le-guide': leGuide,
  'souvenir-du-guide': souvenirDuGuide,
});
