// Catalogue des objets (brief v2 §12), clé = id de l'objet (le `kind` d'un objet d'inventaire).
//
// FORMAT D'UN OBJET : celui de la collection items de src/content/validate.js (LBL-18),
// { name, category, price, size, ammo?, ... }, précisé ici pour les champs de la carte 9 :
//   {
//     name,            nom affiché
//     category,        'arme-poing' | 'arme-epaule' | 'munitions' | 'armure' | 'detecteur'
//                      | 'sac' | 'soin' | 'antirad' | 'nourriture' | 'divers' | 'artefact' | 'quete'
//                      ('trophee' du §13 : carte 18 ; 'sac' ajouté par la carte 9)
//     price,           prix indicatif en roubles (prix de revente pour un artefact) ;
//                      null : ne se vend pas (objets de quête)
//     size,            cases occupées dans la grille d'inventaire
//     slot?,           emplacement d'équipement : 'primary' | 'sidearm' | 'armor' | 'detector'
//                      | 'belt' | 'backpack' (src/engine/rules/equipment.js)
//     charges?,        munitions ou boulons par boîte
//     consumable?,     true : détruit par l'anomalie brûleuse, utilisable par l'action use
//     use?,            effet de l'action use : { wounds?, radiation?, meal?, ap?, oncePerDay?,
//                      cost? } (cost en PA, 1 par défaut)
//     ammo?,           id des munitions dédiées de l'arme
//     weapon?,         { bonus, damage }   bonus au combat, dégâts (combat v2)
//     armor?,          { absorb, radiation, anomaly, beltSlots }   blessures absorbées par
//                      combat, protection par gain de radiation, protection contre les
//                      anomalies, emplacements de ceinture
//     detector?,       { range, anomalyType }   portée en hexagones ; anomalyType : révèle
//                      aussi les anomalies et leur type
//     backpack?,       { slots }   cases d'inventaire en plus
//     grenade?,        { damage }  touche tous les ennemis du groupe (combat v2)
//     belt?,           artefact porté en ceinture : { stats?, absorb?, ap?, radiation?,
//                      cost } ; stats { tir?, survie?, discretion? } en bonus aux tests,
//                      absorb s'ajoute à l'armure, ap aux PA du jour, radiation protège comme
//                      l'armure ; cost = radiations reçues par jour porté
//   }
//
// Les ids v1 (pistolet, munitions, boulons, bandage, vodka, ration, artefact) sont gardés :
// `munitions` est la boîte de 9 mm et `artefact` l'artefact sans nom ramassé par la v1.
// Tout chiffre absent du §12 est marqué « hypothèse v2 ».

import { deepFreeze } from './freeze.js';

export default deepFreeze({
  // Armes de poing : +1 / +2 au combat, 300 / 800.
  pistolet: {
    name: 'Pistolet',
    category: 'arme-poing',
    price: 300,
    size: 2,
    slot: 'sidearm',
    ammo: 'munitions',
    weapon: { bonus: 1, damage: 1 }, // dégâts 1 : hypothèse v2
  },
  'pistolet-lourd': {
    name: 'Pistolet lourd',
    category: 'arme-poing',
    price: 800,
    size: 2, // hypothèse v2
    slot: 'sidearm',
    ammo: 'munitions',
    weapon: { bonus: 2, damage: 1 }, // dégâts 1, 9 mm : hypothèse v2
  },

  // Armes d'épaule : +2 à +4, dégâts 2, munitions dédiées, 1200 à 5000.
  'fusil-pompe': {
    name: 'Fusil à pompe',
    category: 'arme-epaule',
    price: 1200,
    size: 3, // hypothèse v2
    slot: 'primary',
    ammo: 'cartouches-12',
    weapon: { bonus: 2, damage: 2 },
  },
  'fusil-assaut': {
    name: "Fusil d'assaut",
    category: 'arme-epaule',
    price: 3000, // hypothèse v2 (entre 1200 et 5000)
    size: 3, // hypothèse v2
    slot: 'primary',
    ammo: 'munitions-545',
    weapon: { bonus: 3, damage: 2 },
  },
  'fusil-precision': {
    name: 'Fusil de précision',
    category: 'arme-epaule',
    price: 5000,
    size: 3, // hypothèse v2
    slot: 'primary',
    ammo: 'munitions-545',
    weapon: { bonus: 4, damage: 2 }, // 5,45 : hypothèse v2
  },

  // Munitions : une boîte = 6 tirs, 50 à 150.
  munitions: { name: 'Munitions 9 mm', category: 'munitions', price: 50, size: 1, charges: 6 },
  'cartouches-12': { name: 'Cartouches calibre 12', category: 'munitions', price: 100, size: 1, charges: 6 },
  'munitions-545': { name: 'Munitions 5,45', category: 'munitions', price: 150, size: 1, charges: 6 },

  // Armures : absorbent 1 à 3 blessures par combat, 500 à 15000. Ceinture : 1 à 3 emplacements.
  // Protections radiation et anomalie, tailles, prix intermédiaires : hypothèse v2.
  'veste-cuir': {
    name: 'Veste de cuir',
    category: 'armure',
    price: 500,
    size: 2,
    slot: 'armor',
    armor: { absorb: 1, radiation: 0, anomaly: 0, beltSlots: 1 },
  },
  'combinaison-stalker': {
    name: 'Combinaison de stalker',
    category: 'armure',
    price: 2500,
    size: 3,
    slot: 'armor',
    armor: { absorb: 1, radiation: 1, anomaly: 1, beltSlots: 2 },
  },
  'combinaison-devoir': {
    name: 'Combinaison du Devoir',
    category: 'armure',
    price: 6000,
    size: 3,
    slot: 'armor',
    armor: { absorb: 2, radiation: 1, anomaly: 1, beltSlots: 2 },
  },
  'combinaison-liberte': {
    name: 'Combinaison de Liberté',
    category: 'armure',
    price: 5000,
    size: 3,
    slot: 'armor',
    armor: { absorb: 2, radiation: 1, anomaly: 1, beltSlots: 3 },
  },
  exosquelette: {
    name: 'Exosquelette',
    category: 'armure',
    price: 15000,
    size: 4,
    slot: 'armor',
    armor: { absorb: 3, radiation: 2, anomaly: 2, beltSlots: 3 },
  },

  // Détecteurs : portée 1 / 2 / 3, le Vélès révèle aussi le type d'anomalie.
  echo: {
    name: 'Écho',
    category: 'detecteur',
    price: 300,
    size: 1, // hypothèse v2
    slot: 'detector',
    detector: { range: 1, anomalyType: false },
  },
  ours: {
    name: 'Ours',
    category: 'detecteur',
    price: 1500,
    size: 1, // hypothèse v2
    slot: 'detector',
    detector: { range: 2, anomalyType: false },
  },
  veles: {
    name: 'Vélès',
    category: 'detecteur',
    price: 5000,
    size: 1, // hypothèse v2
    slot: 'detector',
    detector: { range: 3, anomalyType: true },
  },

  // Sac : 15 cases au lieu de 12 (§11.3). Prix et taille : hypothèse v2.
  sac: { name: 'Sac à dos', category: 'sac', price: 400, size: 2, slot: 'backpack', backpack: { slots: 3 } },

  // Soins : -1 / -2 / -3 blessures, 50 / 200 / 600.
  bandage: { name: 'Bandage', category: 'soin', price: 50, size: 1, consumable: true, use: { wounds: -1 } },
  'trousse-soins': {
    name: 'Trousse de soins',
    category: 'soin',
    price: 200,
    size: 1,
    consumable: true,
    use: { wounds: -2 },
  },
  'trousse-militaire': {
    name: 'Trousse militaire',
    category: 'soin',
    price: 600,
    size: 1,
    consumable: true,
    use: { wounds: -3 },
  },

  // Antiradiations : -2 / -4 radiations, 60 / 250.
  vodka: { name: 'Vodka', category: 'antirad', price: 60, size: 1, consumable: true, use: { radiation: -2 } },
  antirad: { name: 'Antirad', category: 'antirad', price: 250, size: 1, consumable: true, use: { radiation: -4 } },

  // Nourriture : repas du jour, 30 à 80.
  ration: { name: 'Ration', category: 'nourriture', price: 30, size: 1, consumable: true, use: { meal: true } },
  conserve: { name: 'Conserve', category: 'nourriture', price: 50, size: 1, consumable: true, use: { meal: true } },
  saucisson: { name: 'Saucisson', category: 'nourriture', price: 80, size: 1, consumable: true, use: { meal: true } },

  // Divers : boulons (10) 10, grenade 200, boisson énergétique 150.
  boulons: { name: 'Boulons', category: 'divers', price: 10, size: 1, charges: 10 },
  grenade: { name: 'Grenade', category: 'divers', price: 200, size: 1, consumable: true, grenade: { damage: 1 } },
  'boisson-energetique': {
    name: 'Boisson énergétique',
    category: 'divers',
    price: 150,
    size: 1,
    consumable: true,
    use: { ap: 2, oncePerDay: true, cost: 0 }, // se boire sans PA : hypothèse v2
  },

  // Artefacts : bonus en ceinture contre un coût en radiation, 400 à 6000 à la revente.
  // Valeurs de chaque artefact : hypothèse v2. L'artefact v1 sans nom ne se porte pas.
  artefact: { name: 'Artefact', category: 'artefact', price: 1000, size: 1 },
  meduse: { name: 'Méduse', category: 'artefact', price: 400, size: 1, slot: 'belt', belt: { radiation: 1, cost: 0 } },
  gouttelette: {
    name: 'Gouttelette',
    category: 'artefact',
    price: 800,
    size: 1,
    slot: 'belt',
    belt: { absorb: 1, cost: 1 },
  },
  'oeil-de-chat': {
    name: 'Œil de chat',
    category: 'artefact',
    price: 1500,
    size: 1,
    slot: 'belt',
    belt: { stats: { discretion: 1 }, cost: 1 },
  },
  bouillie: { name: 'Bouillie', category: 'artefact', price: 1200, size: 1, slot: 'belt', belt: { radiation: 2, cost: 0 } },
  epine: { name: 'Épine', category: 'artefact', price: 600, size: 1, slot: 'belt', belt: { stats: { tir: 1 }, cost: 1 } },
  flamme: { name: 'Flamme', category: 'artefact', price: 2500, size: 1, slot: 'belt', belt: { ap: 1, cost: 1 } },
  cristal: { name: 'Cristal', category: 'artefact', price: 2000, size: 1, slot: 'belt', belt: { absorb: 1, cost: 1 } },
  'pierre-de-lune': {
    name: 'Pierre de lune',
    category: 'artefact',
    price: 3000,
    size: 1,
    slot: 'belt',
    belt: { stats: { survie: 1 }, cost: 1 },
  },
  coquille: {
    name: 'Coquille',
    category: 'artefact',
    price: 1800,
    size: 1,
    slot: 'belt',
    belt: { absorb: 1, radiation: 1, cost: 1 },
  },
  batterie: { name: 'Batterie', category: 'artefact', price: 3500, size: 1, slot: 'belt', belt: { ap: 1, cost: 2 } },
  ressort: { name: 'Ressort', category: 'artefact', price: 1000, size: 1, slot: 'belt', belt: { stats: { tir: 1 }, cost: 2 } },
  croute: {
    name: 'Croûte',
    category: 'artefact',
    price: 4000,
    size: 1,
    slot: 'belt',
    belt: { absorb: 2, cost: 2 },
  },
  bulle: { name: 'Bulle', category: 'artefact', price: 4500, size: 1, slot: 'belt', belt: { radiation: 3, cost: 0 } },
  ame: {
    name: 'Âme',
    category: 'artefact',
    price: 5000,
    size: 1,
    slot: 'belt',
    belt: { stats: { survie: 1, discretion: 1 }, cost: 2 },
  },
  compas: {
    name: 'Compas',
    category: 'artefact',
    price: 6000,
    size: 1,
    slot: 'belt',
    belt: { stats: { tir: 1, survie: 1 }, ap: 1, cost: 3 },
  },

  // Objets de quête : pas de vente. Taille : hypothèse v2.
  pda: { name: 'PDA', category: 'quete', price: null, size: 1 },
  documents: { name: 'Documents', category: 'quete', price: null, size: 1 },
  cle: { name: 'Clé', category: 'quete', price: null, size: 1 },
});
