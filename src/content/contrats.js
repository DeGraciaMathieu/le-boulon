// Modèles de contrats générés (brief v2 §8.4 ; carte 22). Règles : src/engine/rules/contracts.js.
//
// FORMAT : celui de la collection contracts de src/content/validate.js,
//   { [templateId]: { type, faction, places, reward, deadline: [min, max], item? } }
//     type      'livraison' | 'recuperation' | 'elimination' | 'escorte' | 'cartographie' (v1)
//     faction   faction du hub qui affiche le modèle : elle perd de la réputation si le
//               contrat est raté (§8.4)
//     places    hubs qui l'affichent (service 'contrats', §6.1)
//     reward    base en roubles : récompense = base × distance en tuiles × niveau de la tuile
//     deadline  délai tiré entre min et max jours (§8.4 : 2 à 5)
//     item      livraison : colis remis à l'acceptation ; récupération : objet à rapporter
//
// Hypothèse v2 : un modèle par type et par hub ; bases, délais par type et objets à récupérer
// ne sont pas dans le brief. Les bases visent le repère du §6.3 (300 à 600 roubles pour une
// journée de contrat simple en début de partie, tuile de niveau 1).

import { deepFreeze } from './freeze.js';

const HUBS = {
  'camp-novices': { faction: 'solitaires', artefact: 'meduse' },
  'base-ciel-pur': { faction: 'ciel-pur', artefact: 'epine' },
  bar: { faction: 'devoir', artefact: 'flamme' },
  'base-liberte': { faction: 'liberte', artefact: 'cristal' },
};

const TYPES = {
  livraison: { reward: 300, deadline: [3, 5], item: () => 'colis' },
  recuperation: { reward: 400, deadline: [3, 5], item: (hub) => hub.artefact },
  elimination: { reward: 500, deadline: [2, 4] },
  escorte: { reward: 450, deadline: [2, 4] },
  cartographie: { reward: 350, deadline: [3, 5] },
};

const templates = {};
for (const [hubId, hub] of Object.entries(HUBS)) {
  for (const [type, { reward, deadline, item }] of Object.entries(TYPES)) {
    templates[`${type}-${hubId}`] = {
      type, faction: hub.faction, places: [hubId], reward, deadline,
      ...(item && { item: item(hub) }),
    };
  }
}

export default deepFreeze(templates);
