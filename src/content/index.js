// Point d'entrée du contenu v2 (brief v2 §17.2) : objets JavaScript gelés, jamais de JSON.
//
// Chaque carte de contenu ajoute ses fichiers sous src/content/ (tuiles/<id>.js, lieux.js,
// objets.js, pnj.js, quetes/<id>.js, factions.js, paquets/…) et les range ici, sous une clé
// à elle. Le moteur lit le contenu par cet index ; l'état de campagne ne garde que des ids.
//
//   tiles    { [id]: tuile au format de src/engine/data/agroprom.js }   carte 5 (Données des tuiles)
//   factions { [id]: faction } (src/content/factions.js)                carte 16 (Factions)
//   items    { [id]: objet } (src/content/objets.js)                    carte 9 (Objets)
//   perks    { [id]: savoir-faire } (src/content/savoir-faire.js)       carte 17 (Progression)
//   links    liaisons entre tuiles (§3.2)                                carte 5
//   places   lieux des tuiles (§3.4)                                     carte 5
//   npcs     { [id]: PNJ } (src/content/pnj.js)                         carte 19 (PNJ)
//   dialogues { [id]: dialogue } (src/content/dialogues/)               carte 19
//   decks    { [id]: paquet } (src/content/paquets/) : Nuit, Météo       carte 7 (Temps)
//   quests   { [id]: quête } (src/content/quetes/)                      carte 15 (Quêtes)
//   traders  { [id]: marchand } (src/content/marchands.js)              carte 13 (Marchands)
//
// src/engine/data/agroprom.js reste l'Agroprom v1 de l'interface et du banc ; la v2 est
// src/content/tuiles/agroprom.js.

// Format de chaque collection et test de cohérence : src/content/validate.js.

import cordon from './tuiles/cordon.js';
import marais from './tuiles/marais.js';
import decharge from './tuiles/decharge.js';
import agroprom from './tuiles/agroprom.js';
import valleeSombre from './tuiles/vallee-sombre.js';
import rostok from './tuiles/rostok.js';
import entrepots from './tuiles/entrepots.js';
import links from './liaisons.js';
import places from './lieux.js';
import factions from './factions.js';
import items from './objets.js';
import perks from './savoir-faire.js';
import npcs from './pnj.js';
import dialogues from './dialogues/index.js';
import nuit from './paquets/nuit.js';
import meteo from './paquets/meteo.js';
import quests from './quetes/index.js';
import traders from './marchands.js';
import { deepFreeze } from './freeze.js';

export default deepFreeze({
  tiles: { cordon, marais, decharge, agroprom, 'vallee-sombre': valleeSombre, rostok, entrepots },
  links,
  places,
  factions,
  items,
  perks,
  npcs,
  dialogues,
  decks: { ...nuit, ...meteo },
  quests,
  traders,
});
