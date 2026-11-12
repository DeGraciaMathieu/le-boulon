// Dialogues de base des PNJ (brief v2 §7, carte 19) : { [dialogueId]: dialogue }, format en
// tête de src/content/validate.js. Un dialogue par PNJ de src/content/pnj.js, sous son id.
// Ton : sobre, phrases courtes, comme des notes de PDA (§8.3). Les quêtes (cartes 20-21)
// s'accrochent aux nœuds travail, guide, soigne… sans changer leurs ids.

import { deepFreeze } from '../freeze.js';
import marchandBunker from './marchand-bunker.js';
import tolik from './tolik.js';
import saveli from './saveli.js';
import bohdan from './bohdan.js';
import levMarchand from './lev-marchand.js';
import arkadi from './arkadi.js';
import docteurMelnyk from './docteur-melnyk.js';
import yarema from './yarema.js';
import pavlo from './pavlo.js';
import fedir from './fedir.js';
import stas from './stas.js';
import docteurZina from './docteur-zina.js';
import hordiy from './hordiy.js';
import vassyl from './vassyl.js';
import ostap from './ostap.js';
import matvii from './matvii.js';
import lesko from './lesko.js';
import dzyga from './dzyga.js';
import yasko from './yasko.js';
import rouslan from './rouslan.js';
import blesseElevateur from './blesse-elevateur.js';
import voyageurArret from './voyageur-arret.js';
import kravets from './kravets.js';
import pelerin from './pelerin.js';
import chasseur from './chasseur.js';

export default deepFreeze({
  'marchand-bunker': marchandBunker,
  tolik,
  saveli,
  bohdan,
  'lev-marchand': levMarchand,
  arkadi,
  'docteur-melnyk': docteurMelnyk,
  yarema,
  pavlo,
  fedir,
  stas,
  'docteur-zina': docteurZina,
  hordiy,
  vassyl,
  ostap,
  matvii,
  lesko,
  dzyga,
  yasko,
  rouslan,
  'blesse-elevateur': blesseElevateur,
  'voyageur-arret': voyageurArret,
  kravets,
  pelerin,
  chasseur,
});
