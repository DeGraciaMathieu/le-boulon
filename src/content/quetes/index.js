// Quêtes écrites (brief v2 §8.1, §8.2 ; carte 15) : { [questId]: quête }, format en tête de
// src/content/validate.js, règles dans src/engine/rules/quests.js. Une quête par fichier,
// sous son id ; son donneur la démarre par l'effet { type: 'quete', quest } de son dialogue.
// La quête principale « Le Guide » viendra avec les cartes 20-21.

import { deepFreeze } from '../freeze.js';
import detteBohdan from './dette-bohdan.js';
import chiensCordon from './chiens-cordon.js';
import releveSaveli from './releve-saveli.js';
// Quêtes secondaires de la carte 21.
import iconeEglise from './icone-eglise.js';
import pelerinage from './pelerinage.js';
import suceurPompage from './suceur-pompage.js';
import listeArret from './liste-arret.js';
import mesuresArkadi from './mesures-arkadi.js';
import queuesChien from './queues-chien.js';
import patrouillePerdue from './patrouille-perdue.js';
import snorkVallee from './snork-vallee.js';
import amiDuPont from './ami-du-pont.js';
import ordresDevoir from './ordres-devoir.js';
import ateliersRostok from './ateliers-rostok.js';
import chimereLac from './chimere-lac.js';
import champAnomalies from './champ-anomalies.js';
import caisseMatvii from './caisse-matvii.js';

export default deepFreeze({
  'dette-bohdan': detteBohdan,
  'chiens-cordon': chiensCordon,
  'releve-saveli': releveSaveli,
  'icone-eglise': iconeEglise,
  pelerinage,
  'suceur-pompage': suceurPompage,
  'liste-arret': listeArret,
  'mesures-arkadi': mesuresArkadi,
  'queues-chien': queuesChien,
  'patrouille-perdue': patrouillePerdue,
  'snork-vallee': snorkVallee,
  'ami-du-pont': amiDuPont,
  'ordres-devoir': ordresDevoir,
  'ateliers-rostok': ateliersRostok,
  'chimere-lac': chimereLac,
  'champ-anomalies': champAnomalies,
  'caisse-matvii': caisseMatvii,
});
