// Test de cohérence du contenu (brief v2 §17.2) : fonctions pures qui rendent la liste des
// erreurs, vide si tout va bien. Chaque erreur commence par le chemin de la donnée fautive
// (« quests.courrier.steps.atp.next[0] : étape inconnue « x » »).
//
// API :
//   validateContent(content) -> string[]   toutes les règles ci-dessous, dans l'ordre
//   checkFrozen      tout le contenu est gelé en profondeur (src/content/freeze.js)
//   checkIds         le champ id d'une entrée, s'il existe, vaut sa clé ; pas d'id en double
//                    dans un tableau (cartes d'un paquet…)
//   checkReferences  chaque référence existe (champs de REF_FIELDS, voir plus bas)
//   checkTiles       19 hexagones par tuile, terrains connus
//   checkLinks       liaisons entre hexagones de bord de tuiles existantes, symétriques
//   checkPlaces      chaque lieu sur un hexagone 1-19 de sa tuile, un lieu par hexagone
//   checkQuests      étapes connues, sans orpheline, et chacune mène à une fin
//   checkDialogues   liens vers des nœuds connus, aucun nœud orphelin
//   checkDecks       genres et types de cartes connus, 4 à 10 cartes par paquet d'exploration,
//                    paquet d'un lieu = paquet d'exploration de ce lieu, occupants tirés du
//                    paquet de rencontres de la tuile, tables de butin au niveau de la tuile
//   checkTraders     marchand au comptoir de son hub, stock, rangs et répliques connus ; un
//                    marchand par hub qui offre le service 'marchand'
//   checkContracts   type connu, délai [min, max], hubs à contrats, objet de livraison et de
//                    récupération
// Une collection absente ou vide est valide : chaque règle s'active quand sa carte arrive.
//
// FORMAT DU CONTENU (src/content/index.js) : un objet gelé, une clé par collection. Les
// collections sont des dictionnaires { [id]: entrée } : la clé EST l'id (un champ id dans
// l'entrée est facultatif et doit valoir la clé). Les clés suivent les noms de l'état de
// campagne (src/engine/campaign.js) ; entre parenthèses, le fichier du brief §17.2.
//
//   tiles (tuiles/<id>.js)   { [tileId]: { name, label?, image?, calage?, entry, level?,
//                              encounters?, hexes } }
//       Format v1 de src/engine/data/agroprom.js. hexes : { 1..19 : { terrain, lieu?, abri?,
//       radiation?, repaire?, faction?, pnj? } }, les 19 numéros de hex.js. terrain : TERRAINS
//       (coûts dans src/engine/actions/move.js). lieu : étiquette ukrainienne du lieu de
//       places posé sur l'hexagone. repaire, faction, pnj : symboles de la légende (§3.3).
//       entry : hexagone de départ v1 (l'arrivée d'un voyage est la liaison empruntée :
//       src/engine/rules/world.js). level : 1-4 (§5.3). calage : { cx, cy, taille } de
//       l'image. encounters : id du paquet de rencontres (decks, kind 'rencontres'), lu par
//       encounterCards de src/engine/rules/tile.js.
//   links (§3.2)             { [tileId]: { [hex]: { tile, hex } } }
//       Les sorties de chaque tuile : sortir par l'hexagone de bord `hex` de `tileId` mène à
//       l'hexagone de bord `hex` de `tile`. Chaque liaison est écrite des deux côtés et le
//       retour doit ramener à l'hexagone de départ (lecture directe pour le moteur).
//   places (lieux.js, §3.4)  { [placeId]: { name, label, tile, hex, tags, deck, loot?,
//                              faction?, services? } }
//       label : étiquette ukrainienne de l'image. tags : 'hub' | 'abri' | 'irradie' |
//       'repaire'… deck : paquet d'exploration (decks). faction : occupant (§5.4).
//       services (hub, §6.1) : ['marchand', 'barman', 'medecin', 'technicien', 'lit',
//       'coffre', 'contrats'].
//   items (objets.js, §12)   { [itemId]: { name, category, price, size, ammo?, ... } }
//       category : 'arme-poing' | 'arme-epaule' | 'munitions' | 'armure' | 'detecteur' |
//       'sac' | 'soin' | 'antirad' | 'nourriture' | 'divers' | 'artefact' | 'trophee' (§13) |
//       'quete'. price : prix de base, null pour un objet de quête.
//       size : cases de la grille. ammo : munitions de l'arme (items). Champs en plus
//       (slot, charges, consumable, use, weapon, armor, detector, backpack, grenade, belt) :
//       en-tête de src/content/objets.js.
//   loot (butin.js, §5.3)    { [tableId]: { level, entries: [{ item, weight, qty? }] } }
//       level : 1-4, celui de la tuile des lieux qui la portent. weight : entier positif.
//   npcs (pnj.js, §7)        { [npcId]: { name, faction, place, dialogue, role?, tile?,
//                              places? } }
//       place : lieu fixe, ou null pour un PNJ itinérant (il porte alors tile, et places :
//       les lieux de cette tuile où il se tient, il part de places[0]). role : 'marchand' |
//       'barman' | 'medecin' | 'technicien' (§6.1) | 'stalker' (src/engine/rules/npcs.js).
//   dialogues (dialogues/<pnj>.js, §7)
//       { [dialogueId]: { id?, start, nodes: { [nodeId]: { text, effects?, choices: [
//         { text, next?, conditions?, effects? } ] } } } }
//       next : nodeId, ou null (ou absent) pour finir le dialogue. Un nœud sans choix finit
//       aussi. conditions : toutes requises. effects d'un nœud : appliqués à l'arrivée.
//       Condition / effet : { type, ...références } ; champs en anglais (item, quest, step,
//       place, faction, amount). Types (src/engine/rules/dialogue.js) :
//         conditions 'reputation' { faction, min?, max? }, 'objet' { item }, 'rang', 'quete'
//         { quest, step?, status? } (status : QUEST_STATUSES ; une quête finie ou ratée garde
//         sa dernière étape, une réplique d'étape porte donc status 'active'), 'stat', 'roubles', 'tous' | 'un' { conditions }, 'non' { condition } ;
//         effets 'donner' | 'prendre' { item }, 'roubles' { amount }, 'reputation'
//         { faction, amount }, 'rejoindre-faction' { faction }, 'quete' { quest }, 'avancer'
//         { quest, step }, 'reveler' { place } | { stash: true } (planque connue, tuile
//         courante ou voisine, src/engine/rules/stashes.js).
//       Ajoutés par src/engine/rules/npcs.js : condition 'premiere-visite' ; effet 'aider' { npc }.
//   quests (quetes/<id>.js, §8.2)
//       { [questId]: { name, giver?, start, deadline?, rewards?, steps: { [stepId]: {
//         objective: { type, ...références }, next: [stepId…] } } } }
//       type : OBJECTIVES. next vide = fin de la quête ; deux suites ou plus = embranchement.
//       rewards : { roubles, xp, reputation: { [factionId]: n }, items: [itemId] }.
//       Objectif 'explorer' : { place, card } (carte fixée du paquet du lieu) ; 'parler' :
//       { npc, node }.
//   contracts (contrats.js, §8.4)
//       { [templateId]: { type, faction, places, reward, deadline: [min, max], item? } }
//       type : CONTRACT_TYPES. places : hubs qui l'affichent (service 'contrats'). faction :
//       celle du hub. reward : base en roubles. item : colis (livraison) ou objet à rapporter
//       (récupération), requis pour ces deux types (src/engine/rules/contracts.js).
//   factions (factions.js, §9) { [factionId]: { name, places, joinable, start, default?, act?,
//                                rival? } }
//       places : bases. joinable : on peut en être membre. start : réputation de départ,
//       -3..3. default : faction du joueur au départ. act : acte de l'adhésion. rival :
//       faction passée à -2 quand on rejoint celle-ci (src/engine/rules/factions.js).
//   decks (paquets/, §5.2, §17.2)
//       { [deckId]: { kind, tile?, place?, cards: [{ id, type, count?, ...références }] } }
//       kind : 'zone' | 'nuit' | 'meteo' | 'rencontres' | 'exploration'. Carte d'exploration,
//       type : 'butin' | 'cache' | 'anomalie' | 'occupant' | 'pnj' | 'indice' | 'passage' |
//       'rien'. Les ids de cartes sont uniques dans un paquet. Champs de chaque type (loot,
//       stat, trap, anomaly, encounter, npc, effects, deck du passage, text) : en-tête de
//       src/engine/rules/places.js. Paquet d'un lieu ou paquet intérieur (passage) : kind
//       'exploration', 4 à 10 cartes en comptant les exemplaires (§5.1). Carte 'occupant' :
//       encounter = id d'une carte du paquet de rencontres de la tuile du lieu.
//       Paquet de rencontres (paquets/rencontres-<tuile>.js) : kind 'rencontres', tile, cartes
//       { id, name, threat, wounds, hp?, damage?, type?, faction?, trophy?, count? } (en-tête
//       de src/content/paquets/rencontres-agroprom.js).
//   perks (savoir-faire.js, §11.2) { [perkId]: { name, effect } }
//   traders (marchands.js, §6.2) { [traderId]: { npc, place, coefficient, sell?, stock: [{ item,
//                                quantity, rank? }], lines } }
//       npc : PNJ de role 'marchand' posé dans place, hub au service 'marchand'. coefficient
//       et sell ({ [catégorie]: n }) : nombres > 0. quantity : entier > 0. rank : id de RANKS
//       (src/engine/rules/progression.js). item : objet à prix. lines : une réplique par clé
//       de TRADER_LINES (src/engine/rules/traders.js les choisit).
//   patrols (patrouilles.js, §10.2) { [patrolId]: { tile, name, threat, wounds, hp?, damage?,
//                                type?, faction?, count? } }
//       tile : tuile de départ. Le reste est une carte de rencontre (format des paquets de
//       rencontres) ; tile et faction sont vérifiés par RÉFÉRENCES.
//
// RÉFÉRENCES : partout dans une entrée (sauf tiles et links, vérifiés à part), un champ de
// REF_FIELDS désigne un id de la collection dite ; son pluriel (places, items…) désigne un
// tableau d'ids. null = pas de référence. Une référence vers une collection absente du
// contenu n'est pas vérifiée : elle le sera quand la carte de cette collection arrivera
// (une collection présente mais vide, elle, n'a aucun id). Champs liés à un contexte :
//   node   nœud du dialogue `dialogue`, ou de celui du PNJ `npc`, dans le même objet ;
//   step   étape de la quête `quest` du même objet ;
//   card   carte du paquet `deck`, ou de celui du lieu `place`, du même objet ;
//   reputation, quand c'est un objet : ses clés sont des factions.

import { HEXES, isEdge } from '../engine/hex.js';
import { RANKS } from '../engine/rules/progression.js';

export const TERRAINS = Object.freeze(['route', 'herbe', 'foret', 'marais', 'batiment']);

export const QUEST_STATUSES = Object.freeze(['active', 'done', 'failed']);

export const DECK_KINDS = Object.freeze(['zone', 'nuit', 'meteo', 'rencontres', 'exploration']);

export const CARD_TYPES = Object.freeze([
  'butin', 'cache', 'anomalie', 'occupant', 'pnj', 'indice', 'passage', 'rien',
]);

// §5.1 : un paquet d'exploration a de 4 à 10 cartes.
const EXPLORATION_SIZE = Object.freeze([4, 10]);

export const OBJECTIVES = Object.freeze([
  'visiter', 'explorer', 'parler', 'rapporter', 'eliminer', 'escorter', 'cartographier',
  'survivre',
]);

export const TRADER_LINES = Object.freeze(['premiere', 'quete', 'hostile', 'neutre', 'amical', 'allie']);
export const CONTRACT_TYPES = Object.freeze(['livraison', 'recuperation', 'elimination', 'escorte', 'cartographie']);
const CONTRACT_ITEM_TYPES = Object.freeze(['livraison', 'recuperation']);

// Champ -> [collection, libellé de l'erreur].
const REF_FIELDS = Object.freeze({
  tile: ['tiles', 'tuile inconnue'],
  place: ['places', 'lieu inconnu'],
  item: ['items', 'objet inconnu'],
  ammo: ['items', 'objet inconnu'],
  npc: ['npcs', 'PNJ inconnu'],
  giver: ['npcs', 'PNJ inconnu'],
  dialogue: ['dialogues', 'dialogue inconnu'],
  quest: ['quests', 'quête inconnue'],
  faction: ['factions', 'faction inconnue'],
  loot: ['loot', 'table de butin inconnue'],
  deck: ['decks', 'paquet inconnu'],
  perk: ['perks', 'savoir-faire inconnu'],
});

const PLURAL_FIELDS = Object.freeze({
  tiles: 'tile', places: 'place', items: 'item', npcs: 'npc', quests: 'quest',
  factions: 'faction', perks: 'perk',
});

const HEX_NUMBERS = HEXES.map(({ n }) => n);

const isPositive = (n) => Number.isInteger(n) && n > 0;
const isHex = (n) => Number.isInteger(n) && HEX_NUMBERS.includes(n);
const isObject = (value) => value !== null && typeof value === 'object';
const entriesOf = (content, collection) => Object.entries(content[collection] ?? {});

// Parcourt chaque objet sous value et appelle visit(objet, chemin).
function walk(value, path, visit) {
  if (!isObject(value)) return;
  visit(value, path);
  for (const [key, child] of Object.entries(value)) {
    walk(child, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, visit);
  }
}

export function validateContent(content) {
  return [
    checkFrozen,
    checkIds,
    checkReferences,
    checkTiles,
    checkLinks,
    checkPlaces,
    checkQuests,
    checkDialogues,
    checkDecks,
    checkTraders,
    checkContracts,
  ].flatMap((check) => check(content));
}

export function checkFrozen(content) {
  const errors = [];
  if (!Object.isFrozen(content)) errors.push('(racine) : non gelé');
  for (const [collection, value] of Object.entries(content)) {
    walk(value, collection, (object, path) => {
      if (!Object.isFrozen(object)) errors.push(`${path} : non gelé`);
    });
  }
  return errors;
}

export function checkIds(content) {
  const errors = [];
  for (const [collection, entries] of Object.entries(content)) {
    for (const [key, entry] of Object.entries(entries ?? {})) {
      if (isObject(entry) && 'id' in entry && entry.id !== key) {
        errors.push(`${collection}.${key}.id : « ${entry.id} » ≠ clé « ${key} »`);
      }
    }
    walk(entries, collection, (object, path) => {
      if (!Array.isArray(object)) return;
      const seen = new Set();
      object.forEach((item, i) => {
        if (!isObject(item) || !('id' in item)) return;
        if (seen.has(item.id)) errors.push(`${path}[${i}].id : « ${item.id} » en double`);
        seen.add(item.id);
      });
    });
  }
  return errors;
}

export function checkReferences(content) {
  const errors = [];
  // Collection cible absente : la référence attend sa carte (voir RÉFÉRENCES).
  const exists = (collection, id) => content[collection] === undefined || Object.hasOwn(content[collection], id);
  const checkRef = (field, id, path) => {
    if (id === null || id === undefined) return;
    const [collection, label] = REF_FIELDS[field];
    if (!exists(collection, id)) errors.push(`${path} : ${label} « ${id} »`);
  };

  const visit = (object, path) => {
    if (Array.isArray(object)) return;
    for (const [field, value] of Object.entries(object)) {
      if (REF_FIELDS[field] && !isObject(value)) checkRef(field, value, `${path}.${field}`);
      if (PLURAL_FIELDS[field] && Array.isArray(value)) {
        value.forEach((id, i) => checkRef(PLURAL_FIELDS[field], id, `${path}.${field}[${i}]`));
      }
    }
    if (isObject(object.reputation)) {
      for (const faction of Object.keys(object.reputation)) {
        if (!exists('factions', faction)) {
          errors.push(`${path}.reputation : faction inconnue « ${faction} »`);
        }
      }
    }
    checkContextRefs(content, object, path, errors);
  };

  for (const [collection, entries] of Object.entries(content)) {
    if (collection === 'tiles' || collection === 'links') continue;
    for (const [id, entry] of Object.entries(entries ?? {})) walk(entry, `${collection}.${id}`, visit);
  }
  return errors;
}

// node, step et card : des ids qui n'ont de sens qu'à l'intérieur d'un autre contenu.
function checkContextRefs(content, object, path, errors) {
  if ('node' in object) {
    const dialogueId = object.dialogue ?? content.npcs?.[object.npc]?.dialogue;
    const dialogue = content.dialogues?.[dialogueId];
    if (!dialogueId) errors.push(`${path}.node : ni dialogue ni PNJ avec dialogue pour « ${object.node} »`);
    else if (dialogue && !Object.hasOwn(dialogue.nodes ?? {}, object.node)) {
      errors.push(`${path}.node : nœud inconnu « ${object.node} » (dialogue ${dialogueId})`);
    }
  }
  if ('step' in object) {
    const quest = content.quests?.[object.quest];
    if (!object.quest) errors.push(`${path}.step : pas de quête pour « ${object.step} »`);
    else if (quest && !Object.hasOwn(quest.steps ?? {}, object.step)) {
      errors.push(`${path}.step : étape inconnue « ${object.step} » (quête ${object.quest})`);
    }
  }
  if ('card' in object) {
    const deckId = object.deck ?? content.places?.[object.place]?.deck;
    const deck = content.decks?.[deckId];
    if (!deckId) errors.push(`${path}.card : ni paquet ni lieu avec paquet pour « ${object.card} »`);
    else if (deck && !(deck.cards ?? []).some((card) => card.id === object.card)) {
      errors.push(`${path}.card : carte inconnue « ${object.card} » (paquet ${deckId})`);
    }
  }
}

export function checkTiles(content) {
  const errors = [];
  for (const [id, tile] of entriesOf(content, 'tiles')) {
    const path = `tiles.${id}`;
    const hexes = tile.hexes ?? {};
    for (const n of HEX_NUMBERS) {
      if (!Object.hasOwn(hexes, n)) errors.push(`${path}.hexes : hexagone ${n} manquant`);
    }
    for (const [key, hex] of Object.entries(hexes)) {
      if (!isHex(Number(key))) errors.push(`${path}.hexes : hexagone ${key} hors tuile`);
      if (!TERRAINS.includes(hex.terrain)) {
        errors.push(`${path}.hexes.${key}.terrain : terrain inconnu « ${hex.terrain} »`);
      }
    }
    if (tile.entry !== undefined && !isHex(tile.entry)) {
      errors.push(`${path}.entry : ${tile.entry} n'est pas un hexagone 1-19`);
    }
  }
  return errors;
}

export function checkLinks(content) {
  const errors = [];
  const links = content.links ?? {};
  const tiles = content.tiles ?? {};
  const checkEnd = (tile, hex, path) => {
    if (!Object.hasOwn(tiles, tile)) {
      errors.push(`${path} : tuile inconnue « ${tile} »`);
      return false;
    }
    if (!isHex(hex) || !isEdge(hex)) {
      errors.push(`${path} : hexagone ${hex} de ${tile} n'est pas de bord`);
      return false;
    }
    return true;
  };

  for (const [tile, exits] of Object.entries(links)) {
    for (const [key, target] of Object.entries(exits)) {
      const hex = Number(key);
      const path = `links.${tile}.${key}`;
      const fromOk = checkEnd(tile, hex, path);
      const toOk = checkEnd(target.tile, target.hex, path);
      if (!fromOk || !toOk) continue;
      const back = links[target.tile]?.[target.hex];
      const there = `${target.tile}.${target.hex}`;
      if (!back) errors.push(`${path} : pas de retour depuis ${there}`);
      else if (back.tile !== tile || back.hex !== hex) {
        errors.push(`${path} : le retour depuis ${there} mène à ${back.tile}.${back.hex}`);
      }
    }
  }
  return errors;
}

export function checkPlaces(content) {
  const errors = [];
  const taken = new Map();
  for (const [id, place] of entriesOf(content, 'places')) {
    const tile = content.tiles?.[place.tile];
    // Tuile inconnue : déjà signalée par checkReferences.
    if (!tile) continue;
    const path = `places.${id}.hex`;
    if (!isHex(place.hex) || !Object.hasOwn(tile.hexes ?? {}, place.hex)) {
      errors.push(`${path} : ${place.hex} n'est pas un hexagone de la tuile ${place.tile}`);
      continue;
    }
    // Hypothèse v2 : un seul lieu par hexagone, comme les lieux des tuiles v1.
    const spot = `${place.tile}.${place.hex}`;
    if (taken.has(spot)) {
      errors.push(`${path} : hexagone ${place.hex} de ${place.tile} déjà pris par ${taken.get(spot)}`);
    } else taken.set(spot, id);
  }
  return errors;
}

export function checkQuests(content) {
  const errors = [];
  for (const [id, quest] of entriesOf(content, 'quests')) {
    const path = `quests.${id}`;
    const steps = quest.steps ?? {};
    const nextOf = (stepId) => (steps[stepId].next ?? []).filter((n) => Object.hasOwn(steps, n));

    for (const [stepId, step] of Object.entries(steps)) {
      (step.next ?? []).forEach((next, i) => {
        if (!Object.hasOwn(steps, next)) {
          errors.push(`${path}.steps.${stepId}.next[${i}] : étape inconnue « ${next} »`);
        }
      });
      const type = step.objective?.type;
      if (!OBJECTIVES.includes(type)) {
        errors.push(`${path}.steps.${stepId}.objective.type : objectif inconnu « ${type} »`);
      }
    }
    if (!Object.hasOwn(steps, quest.start)) {
      errors.push(`${path}.start : étape inconnue « ${quest.start} »`);
      continue;
    }

    const reachable = reach(quest.start, nextOf);
    for (const stepId of Object.keys(steps)) {
      if (!reachable.has(stepId)) errors.push(`${path}.steps.${stepId} : étape orpheline`);
    }
    // Une étape sans suite (next vide) est une fin ; on remonte depuis les fins.
    const finishing = new Set(Object.keys(steps).filter((s) => (steps[s].next ?? []).length === 0));
    let grew = true;
    while (grew) {
      grew = false;
      for (const stepId of Object.keys(steps)) {
        if (!finishing.has(stepId) && nextOf(stepId).some((n) => finishing.has(n))) {
          finishing.add(stepId);
          grew = true;
        }
      }
    }
    const stuck = Object.keys(steps).filter((s) => reachable.has(s) && !finishing.has(s));
    if (stuck.length) errors.push(`${path} : étapes sans issue vers une fin : ${stuck.join(', ')}`);
  }
  return errors;
}

export function checkDialogues(content) {
  const errors = [];
  for (const [id, dialogue] of entriesOf(content, 'dialogues')) {
    const path = `dialogues.${id}`;
    const nodes = dialogue.nodes ?? {};
    const linksOf = (nodeId) =>
      (nodes[nodeId].choices ?? []).map((c) => c.next).filter((n) => Object.hasOwn(nodes, n ?? ''));

    for (const [nodeId, node] of Object.entries(nodes)) {
      (node.choices ?? []).forEach((choice, i) => {
        if (choice.next !== null && choice.next !== undefined && !Object.hasOwn(nodes, choice.next)) {
          errors.push(`${path}.nodes.${nodeId}.choices[${i}].next : nœud inconnu « ${choice.next} »`);
        }
      });
    }
    if (!Object.hasOwn(nodes, dialogue.start)) {
      errors.push(`${path}.start : nœud inconnu « ${dialogue.start} »`);
      continue;
    }
    walk(dialogue, path, (object, at) => {
      if (object.type === 'quete' && 'status' in object && !QUEST_STATUSES.includes(object.status)) {
        errors.push(`${at}.status : statut inconnu « ${object.status} »`);
      }
    });
    const reachable = reach(dialogue.start, linksOf);
    for (const nodeId of Object.keys(nodes)) {
      if (!reachable.has(nodeId)) errors.push(`${path}.nodes.${nodeId} : nœud orphelin`);
    }
  }
  return errors;
}

export function checkDecks(content) {
  const errors = [];
  const decks = content.decks ?? {};
  const positive = (value, path) => {
    if (!isPositive(value)) errors.push(`${path} : ${value} n'est pas un entier positif`);
  };

  for (const [id, deck] of Object.entries(decks)) {
    const path = `decks.${id}`;
    if (!DECK_KINDS.includes(deck.kind)) errors.push(`${path}.kind : genre inconnu « ${deck.kind} »`);
    (deck.cards ?? []).forEach((card, i) => {
      if (card.count !== undefined) positive(card.count, `${path}.cards[${i}].count`);
      if (deck.kind === 'exploration' && !CARD_TYPES.includes(card.type)) {
        errors.push(`${path}.cards[${i}].type : type de carte inconnu « ${card.type} »`);
      }
      if (deck.kind === 'rencontres') {
        if (typeof card.name !== 'string') errors.push(`${path}.cards[${i}].name : nom manquant`);
        positive(card.threat, `${path}.cards[${i}].threat`);
        positive(card.wounds, `${path}.cards[${i}].wounds`);
      }
    });
    if (deck.kind === 'exploration') {
      const size = (deck.cards ?? []).reduce((sum, card) => sum + (card.count ?? 1), 0);
      const [min, max] = EXPLORATION_SIZE;
      if (size < min || size > max) errors.push(`${path} : ${size} cartes, il en faut ${min} à ${max}`);
    }
  }

  for (const [id, tile] of entriesOf(content, 'tiles')) {
    if (tile.encounters === undefined || content.decks === undefined) continue;
    const deck = decks[tile.encounters];
    if (!deck) errors.push(`tiles.${id}.encounters : paquet inconnu « ${tile.encounters} »`);
    else if (deck.kind !== 'rencontres') {
      errors.push(`tiles.${id}.encounters : « ${tile.encounters} » n'est pas un paquet de rencontres`);
    }
  }

  for (const [id, place] of entriesOf(content, 'places')) {
    checkPlaceDeck(content, id, place, errors);
    const table = content.loot?.[place.loot];
    const level = content.tiles?.[place.tile]?.level;
    if (table && level !== undefined && table.level !== level) {
      errors.push(`places.${id}.loot : table de niveau ${table.level} sur une tuile de niveau ${level}`);
    }
  }

  for (const [id, table] of entriesOf(content, 'loot')) {
    const path = `loot.${id}`;
    if (!isPositive(table.level) || table.level > 4) errors.push(`${path}.level : ${table.level} hors 1-4`);
    if (!(table.entries ?? []).length) errors.push(`${path}.entries : table vide`);
    (table.entries ?? []).forEach((entry, i) => {
      positive(entry.weight, `${path}.entries[${i}].weight`);
      if (entry.qty !== undefined) positive(entry.qty, `${path}.entries[${i}].qty`);
    });
  }
  return errors;
}

export function checkTraders(content) {
  const errors = [];
  if (!content.traders) return errors;
  const isPositive = (n) => typeof n === 'number' && n > 0;
  const counters = new Map();
  for (const [id, trader] of entriesOf(content, 'traders')) {
    const path = `traders.${id}`;
    const place = content.places?.[trader.place];
    if (place && !place.services?.includes('marchand')) errors.push(`${path}.place : « ${trader.place} » n'offre pas le service marchand`);
    const npc = content.npcs?.[trader.npc];
    if (npc && (npc.role !== 'marchand' || npc.place !== trader.place)) {
      errors.push(`${path}.npc : « ${trader.npc} » n'est pas le marchand de ${trader.place}`);
    }
    counters.set(trader.place, (counters.get(trader.place) ?? 0) + 1);
    if (!isPositive(trader.coefficient)) errors.push(`${path}.coefficient : ${trader.coefficient} n'est pas un nombre > 0`);
    for (const [category, n] of Object.entries(trader.sell ?? {})) {
      if (!isPositive(n)) errors.push(`${path}.sell.${category} : ${n} n'est pas un nombre > 0`);
    }
    (trader.stock ?? []).forEach(({ item, quantity, rank }, i) => {
      if (!Number.isInteger(quantity) || quantity <= 0) errors.push(`${path}.stock[${i}].quantity : ${quantity} n'est pas un entier > 0`);
      if (rank !== undefined && !RANKS.some((r) => r.id === rank)) errors.push(`${path}.stock[${i}].rank : rang inconnu « ${rank} »`);
      if (content.items?.[item]?.price === null) errors.push(`${path}.stock[${i}].item : « ${item} » n'a pas de prix`);
    });
    for (const line of TRADER_LINES) {
      if (typeof trader.lines?.[line] !== 'string' || !trader.lines[line]) errors.push(`${path}.lines.${line} : réplique manquante`);
    }
  }
  for (const [id, place] of entriesOf(content, 'places')) {
    if (!place.services?.includes('marchand')) continue;
    const n = counters.get(id) ?? 0;
    if (n !== 1) errors.push(`places.${id}.services : ${n} marchand(s) au lieu d'un`);
  }
  return errors;
}

// Le paquet du lieu, et les paquets intérieurs de ses passages : occupants de la tuile.
function checkPlaceDeck(content, id, place, errors) {
  const deck = content.decks?.[place.deck];
  // Paquet absent ou inconnu : rien à lire (référence vérifiée par checkReferences).
  if (!deck) return;
  if (deck.kind !== 'exploration') {
    errors.push(`places.${id}.deck : « ${place.deck} » n'est pas un paquet d'exploration`);
    return;
  }
  if (deck.place !== undefined && deck.place !== id) {
    errors.push(`decks.${place.deck}.place : « ${deck.place} » ≠ lieu « ${id} »`);
  }
  const encountersId = content.tiles?.[place.tile]?.encounters;
  const encounters = content.decks[encountersId];
  if (!encounters) return;
  const inner = deck.cards.filter((card) => card.type === 'passage').map((card) => card.deck);
  for (const deckId of [place.deck, ...inner]) {
    (content.decks[deckId]?.cards ?? []).forEach((card, i) => {
      if (card.type !== 'occupant' || card.encounter === undefined) return;
      if (!encounters.cards.some((known) => known.id === card.encounter)) {
        errors.push(`decks.${deckId}.cards[${i}].encounter : rencontre inconnue « ${card.encounter} » (paquet ${encountersId})`);
      }
    });
  }
}

export function checkContracts(content) {
  const errors = [];
  for (const [id, template] of entriesOf(content, 'contracts')) {
    const path = `contracts.${id}`;
    if (!CONTRACT_TYPES.includes(template.type)) errors.push(`${path}.type : type inconnu « ${template.type} »`);
    const [min, max] = template.deadline ?? [];
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || min > max) {
      errors.push(`${path}.deadline : [min, max] attendu`);
    }
    (template.places ?? []).forEach((place, i) => {
      const services = content.places?.[place]?.services ?? [];
      if (!services.includes('contrats')) errors.push(`${path}.places[${i}] : « ${place} » n’affiche pas de contrats`);
    });
    if (CONTRACT_ITEM_TYPES.includes(template.type) && !template.item) {
      errors.push(`${path}.item : objet requis pour ${template.type}`);
    }
  }
  return errors;
}

// Ensemble des sommets atteints depuis start en suivant nextOf.
function reach(start, nextOf) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    for (const next of nextOf(queue.shift())) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}
