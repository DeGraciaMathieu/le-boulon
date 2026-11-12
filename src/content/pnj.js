// PNJ nommés (brief v2 §7, §6.1) : { [npcId]: { name, faction, place, dialogue, role?,
// tile?, places? } }, format en tête de src/content/validate.js, règles dans
// src/engine/rules/npcs.js.
//
// 4 à 6 PNJ par hub, dont les services du §6.1 (role), puis les isolés : un par hexagone
// marqué pnj hors hub (Élévateur, Arrêt de bus, Institut Agroprom) et deux itinérants.
// Le dialogue de chaque PNJ porte son id (src/content/dialogues/<id>.js).
//
// Hypothèse v2 : les noms, les PNJ sans service et les itinérants (Pèlerin au Marais,
// Chasseur à la Vallée Sombre) ne sont pas dans le brief. Le PNJ de l'Arrêt de bus est un
// itinérant de la Décharge qui part de l'Arrêt de bus.

import { deepFreeze } from './freeze.js';

const npc = (name, faction, place, role) => ({ name, faction, place, role });
const roaming = (name, faction, tile, places) => ({ name, faction, place: null, role: 'stalker', tile, places });

const withDialogues = (npcs) =>
  Object.fromEntries(Object.entries(npcs).map(([id, entry]) => [id, { ...entry, dialogue: id }]));

export default deepFreeze(withDialogues({
  // Camp des novices (Solitaires)
  'marchand-bunker': npc('Le Marchand du bunker', 'solitaires', 'camp-novices', 'marchand'),
  tolik: npc('Tolik le Bleu', 'solitaires', 'camp-novices', 'stalker'),
  saveli: npc('Saveli', 'solitaires', 'camp-novices', 'stalker'),
  bohdan: npc('Bohdan', 'solitaires', 'camp-novices', 'stalker'),

  // Base de Ciel Pur
  'lev-marchand': npc('Lev', 'ciel-pur', 'base-ciel-pur', 'marchand'),
  arkadi: npc('Arkadi', 'ciel-pur', 'base-ciel-pur', 'technicien'),
  'docteur-melnyk': npc('Docteure Melnyk', 'ciel-pur', 'base-ciel-pur', 'medecin'),
  yarema: npc('Commandant Yarema', 'ciel-pur', 'base-ciel-pur', 'stalker'),
  pavlo: npc('Pavlo l’éclaireur', 'ciel-pur', 'base-ciel-pur', 'stalker'),

  // Bar « 100 Rads » (Devoir)
  fedir: npc('Fedir', 'devoir', 'bar', 'barman'),
  stas: npc('Stas l’armurier', 'devoir', 'bar', 'marchand'),
  'docteur-zina': npc('Docteure Zina', 'devoir', 'bar', 'medecin'),
  hordiy: npc('Capitaine Hordiy', 'devoir', 'bar', 'stalker'),
  vassyl: npc('Vassyl le conteur', 'solitaires', 'bar', 'stalker'),
  ostap: npc('Sergent Ostap', 'devoir', 'bar', 'stalker'),

  // Base de Liberté
  matvii: npc('Matviï', 'liberte', 'base-liberte', 'marchand'),
  lesko: npc('Lesko', 'liberte', 'base-liberte', 'barman'),
  dzyga: npc('Dzyga', 'liberte', 'base-liberte', 'technicien'),
  yasko: npc('Yasko', 'liberte', 'base-liberte', 'stalker'),
  rouslan: npc('Rouslan', 'liberte', 'base-liberte', 'stalker'),

  // Isolés
  'blesse-elevateur': npc('Le stalker blessé', 'solitaires', 'elevateur', 'stalker'),
  'voyageur-arret': roaming('Le voyageur', 'solitaires', 'decharge', ['arret-bus', 'depot', 'tunnel-decharge']),
  kravets: npc('Lieutenant Kravets', 'militaires', 'institut-agroprom', 'stalker'),
  pelerin: roaming('Le Pèlerin', 'solitaires', 'marais', ['eglise', 'ruines-village', 'hameau']),
  chasseur: roaming('Le Chasseur', 'solitaires', 'vallee-sombre', ['ferme-vallee', 'station-service', 'pont']),
}));
