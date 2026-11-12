// Sauvegarde de la campagne (brief v2 §15, §17.1) : texte JSON, version, migrations. Pur :
// aucun accès au navigateur ; le localStorage et les fichiers sont dans src/ui/storage.js.
//
// API :
//   serialize(campaign) -> string        valide la campagne puis la rend en JSON
//   deserialize(text)   -> campaign      lit le JSON, migre jusqu'à CAMPAIGN_VERSION, valide ;
//                                        lève une SaveError au message lisible sinon
//   migrate(data, { migrations, target }) -> data   (options pour les tests)
//   canManualSave(campaign) -> bool      emplacements manuels dans un hub seulement (§15)
//   SaveError, MIGRATIONS
//
// MIGRATIONS : tableau ordonné de fonctions (data) -> data, chacune passe de la version N à
// N + 1. Elles couvrent les MIGRATIONS.length dernières versions : la dernière mène à
// CAMPAIGN_VERSION, la première part de CAMPAIGN_VERSION - MIGRATIONS.length, plus ancienne
// version encore lisible. migrate() pose data.version après chaque fonction.
// CHANGER LA FORME DE LA CAMPAGNE : monter CAMPAIGN_VERSION (campaign.js), ajouter EN FIN de
// MIGRATIONS la fonction ancienne forme -> nouvelle, et la tester sur une sauvegarde de
// l'ancienne forme. Ne jamais retirer ni réordonner une migration.

import { CAMPAIGN_VERSION, MODES } from '../campaign.js';

export const MIGRATIONS = Object.freeze([]);

export class SaveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SaveError';
  }
}

export function serialize(campaign) {
  validate(campaign);
  return JSON.stringify(campaign);
}

export function deserialize(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SaveError('sauvegarde illisible : ce n’est pas du JSON');
  }
  if (!isObject(data)) throw new SaveError('sauvegarde illisible : un objet JSON est attendu');
  const campaign = migrate(data);
  validate(campaign);
  return campaign;
}

export function migrate(data, { migrations = MIGRATIONS, target = CAMPAIGN_VERSION } = {}) {
  const { version } = data;
  if (!Number.isInteger(version) || version < 0) {
    throw new SaveError(`sauvegarde illisible : version invalide (${JSON.stringify(version)})`);
  }
  if (version > target) {
    throw new SaveError(`sauvegarde d’une version plus récente (v${version}), ce jeu lit jusqu’à la v${target}`);
  }
  const oldest = target - migrations.length;
  if (version < oldest) {
    throw new SaveError(`sauvegarde trop ancienne (v${version}), ce jeu lit à partir de la v${oldest}`);
  }
  let migrated = data;
  for (let from = version; from < target; from++) {
    migrated = { ...migrations[from - oldest](migrated), version: from + 1 };
  }
  return migrated;
}

export function canManualSave(campaign) {
  return campaign.screen === 'hub';
}

// Contrôle de forme seulement (§17.1) : ce qu'il faut pour que step() et dayState() tournent.
// Le contenu des tuiles, PNJ, quêtes… est laissé aux cartes qui les possèdent.
function validate(campaign) {
  const fail = (field, expected) => {
    throw new SaveError(`sauvegarde invalide : ${field} doit être ${expected}`);
  };
  if (!isObject(campaign)) fail('la campagne', 'un objet');
  const { player, world } = campaign;
  if (campaign.version !== CAMPAIGN_VERSION) fail('version', `${CAMPAIGN_VERSION}`);
  if (!Number.isFinite(campaign.seed)) fail('seed', 'un nombre');
  if (!Number.isInteger(campaign.rng)) fail('rng', 'un entier');
  if (!Number.isInteger(campaign.day) || campaign.day < 1) fail('day', 'un entier ≥ 1');
  if (!MODES.includes(campaign.mode)) fail('mode', MODES.join(' ou '));
  if (!isObject(player)) fail('player', 'un objet');
  for (const key of ['wounds', 'radiation', 'hunger', 'xp', 'roubles']) {
    if (!Number.isFinite(player[key])) fail(`player.${key}`, 'un nombre');
  }
  if (!isObject(player.stats)) fail('player.stats', 'un objet');
  if (!Array.isArray(player.perks)) fail('player.perks', 'un tableau');
  if (!Array.isArray(campaign.inventory)) fail('inventory', 'un tableau');
  if (!isObject(world)) fail('world', 'un objet');
  if (!isObject(world.tiles)) fail('world.tiles', 'un objet');
  if (!isObject(world.tiles[world.currentTile])) fail('world.currentTile', 'une tuile de world.tiles');
  if (!Number.isInteger(world.hex)) fail('world.hex', 'un entier');
  for (const key of ['equipment', 'places', 'npcs', 'quests', 'contracts', 'traders', 'reputation']) {
    if (!isObject(campaign[key])) fail(key, 'un objet');
  }
  for (const key of ['rumors', 'stashes', 'journal']) {
    if (!Array.isArray(campaign[key])) fail(key, 'un tableau');
  }
  if (typeof campaign.screen !== 'string') fail('screen', 'une chaîne');
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
