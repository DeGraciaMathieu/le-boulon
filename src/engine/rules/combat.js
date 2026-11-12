// Combat v2 en rounds (brief v2 §13, carte 18) sur l'état de campagne.
//
// RÉGLAGE : campaign.combatMode, 'rounds' (défaut) | 'rapide' (COMBAT_MODES), posé par
// createCampaign({ combatMode }). En 'rapide', une rencontre se résout comme en v1 (fight et
// flee de encounters.js, relayés à la journée) ; le banc v1 joue toujours game.js. Une
// campagne sans le champ (sauvegarde antérieure) joue en 'rounds'.
//
// ENNEMIS : une carte de rencontre (encounterCards de tile.js) au format v1 { name, threat,
// wounds } accepte en plus, tous facultatifs (ENEMY_DEFAULTS sinon) :
//   hp       PV de chaque ennemi, 1 à 4              damage   blessures par attaque réussie
//   type     'humain' | 'mutant'                     faction  id de content.factions, ou null
//   trophy   id d'un objet 'trophee' (objets.js) laissé par chaque mutant abattu
//   count    nombre d'ennemis identiques du groupe
//   enemiesOf(card) -> [{ name, threat, hp, maxHp, damage, type, faction, trophy }]
//
// ÉTAT : campaign.combat, null hors combat ; pendant un combat v2 (screen 'combat') :
//   { hex, card,            rencontre de la tuile (tileState.combat garde { hex, card })
//     round,                numéro du round, commence à 1
//     enemies,              enemiesOf(carte), hp tombe à 0 quand l'ennemi est abattu
//     cover,                rounds de couverture restants (+2 de défense)
//     absorb,               blessures que l'armure peut encore absorber dans ce combat
//     previousScreen }      écran rendu à la fin du combat
//
// DÉBUT : la réaction combatOnReveal (REACTIONS de campaign.js) ouvre le combat quand une
// rencontre est révélée (événement 'encounter-revealed' de la journée v1) en mode 'rounds'.
// startCombat(draft, { hex, card }, ctx) est exportée pour les tests et les autres cartes.
//
// ACTIONS DE CAMPAGNE (une par round, 0 PA sauf fuir ; hors combat : 'not-in-combat') :
//   { type: 'shoot', target? }      1d6 + Tir + arme + couverture ≥ Menace : la cible (index
//                                   dans enemies, le premier debout par défaut) perd les dégâts
//                                   de l'arme. 1 munition dédiée par tir, touché ou non.
//                                   Arme : activeWeapon d'equipment.js, sinon mains nues
//                                   (-1, dégâts 1). Couverture : terrain (forêt +1, bâtiment +2).
//                                   Refus 'no-target'.
//   { type: 'take-cover' }          +2 de défense ce round et le suivant, pas de tir.
//   { type: 'grenade' }             damage de la grenade (1 PV) à chaque ennemi debout, la
//                                   grenade est consommée. Refus 'no-item'.
//   { type: 'heal', item? }         consommable de catégorie 'soin' (le premier par défaut),
//                                   retire use.wounds. Refus 'no-item' | 'not-healing'.
//   { type: 'escape' }              2 PA et un test de Discrétion. Échec : attaque gratuite de
//                                   l'ennemi le plus menaçant. Puis retour sur l'hexagone
//                                   précédent, le jeton reste. Refus 'not-enough-ap'.
//   { type: 'parley' }              humains seulement, selon la faction du groupe :
//                                   membre ou allié -> 'fin' ; amical -> 'echange' (encounterStance) ;
//                                   neutre ou sans faction -> 'peage' payé en roubles ;
//                                   hostile -> refus. Le combat s'arrête, la rencontre est retirée.
//                                   Refus 'mutants' | 'hostile' | 'not-enough-roubles'.
//   Ensuite, chaque ennemi debout attaque : 1d6 + Menace ≥ défense (4 + couverture du terrain
//   + couverture prise + armure) ; touché : ses dégâts, moins ce que l'armure absorbe encore.
//   combatRefusal(campaign, action) -> 'in-combat' : pendant un combat v2, toute autre action
//   est refusée (appelée par step de campaign.js).
//
// FIN DU COMBAT : tous les ennemis abattus ('victory') ; fuite ('fled') ; parlementer
// ('peage' | 'echange' | 'fin') ; mort ('dead'). La rencontre est retirée de la tuile sauf
// après une fuite ou la mort. Victoire : un trophée par mutant abattu qui en porte un (perdu
// s'il ne tient pas dans la grille). Les mutants ne laissent pas de butin ; le butin des
// humains vaincus revient à la carte Butin (11).
//
// ÉVÉNEMENTS (chaque jet est visible, §1 pilier 4) :
//   { type: 'combat-started', hex, card, enemies: [{ name, threat, hp, damage, type }], absorb }
//   { type: 'combat-round', round }
//   { type: 'shot', target, name, roll, tir, weapon, cover, total, threat, hit, damage, hp }
//   { type: 'took-cover', bonus, rounds }        { type: 'grenade', damage, targets }
//   { type: 'used', item, wounds }               { type: 'check', ... } (test de Discrétion)
//   { type: 'enemy-attack', enemy, name, roll, threat, total, defense, hit, damage, absorbed,
//     wounds, free? }                             { type: 'enemy-down', enemy, name }
//   { type: 'parley', faction, standing, outcome, toll? }
//   { type: 'fled', from, to, cost }              { type: 'encounter-removed', hex, card }
//   { type: 'trophy-lost', item }
//   { type: 'combat-ended', outcome, hex, card, trophies }
//   et ceux de la fiche (wounded, died, item-removed : sheet.js).
//
// HYPOTHÈSES v2 (chiffres et lectures absents du §13) :
//   ENEMY_DEFAULTS ; mains nues -1 (valeur v1) et dégâts 1 ; bonus d'armure à la défense +1 ;
//   l'ennemi touche à total ≥ défense (comme le tir) ; l'absorption de l'armure est une
//   réserve par combat (§12 « absorbe 1 à 3 blessures par combat ») ; le tir reste permis au
//   round suivant la mise à couvert ; un échec de fuite donne une seule attaque, puis on fuit ;
//   péage de 50 roubles par ennemi debout ; parlementer règle la rencontre (jeton retiré) ;
//   un trophée par mutant porteur abattu ; la fuite ne pioche pas de carte Zone.

import catalog from '../../content/objets.js';
import { dayState, storeDay } from '../campaign.js';
import { skillCheck } from '../game.js';
import { COVER } from './encounters.js';
import { encounterCards } from './tile.js';
import { activeWeapon, armorAbsorb, statBonus } from './equipment.js';
import { addItem, createItem, removeItem, useCharge, wound } from './sheet.js';
import { encounterStance, isMember, standing } from './factions.js';

export const COMBAT_MODES = Object.freeze(['rounds', 'rapide']);

const ENEMY_DEFAULTS = Object.freeze({ hp: 1, damage: 1, type: 'humain', faction: null, trophy: null, count: 1 });
const UNARMED = Object.freeze({ bonus: -1, damage: 1, ammo: null });
const BASE_DEFENSE = 4;
const ARMOR_DEFENSE = 1;
const TAKE_COVER = Object.freeze({ bonus: 2, rounds: 2 });
const ESCAPE_COST = 2;
const TOLL_PER_ENEMY = 50;
const SETTLED = Object.freeze(['victory', 'peage', 'echange', 'fin']);

export const combatMode = (campaign) => campaign.combatMode ?? 'rounds';

export function enemiesOf(card) {
  const { name, threat, hp, damage, type, faction, trophy, count } = { ...ENEMY_DEFAULTS, ...card };
  return Array.from({ length: count }, () => ({ name, threat, hp, maxHp: hp, damage, type, faction, trophy }));
}

const standingEnemies = (combat) => combat.enemies.filter((enemy) => enemy.hp > 0);

export function startCombat(draft, { hex, card }, ctx) {
  const { tile } = draft.world.tiles[draft.world.currentTile];
  const enemies = enemiesOf(encounterCards(tile)[card]);
  const absorb = armorAbsorb(draft.equipment);
  draft.combat = { hex, card, round: 1, enemies, cover: 0, absorb, previousScreen: draft.screen };
  draft.screen = 'combat';
  const shown = enemies.map(({ name, threat, hp, damage, type }) => ({ name, threat, hp, damage, type }));
  ctx.emit({ type: 'combat-started', hex, card, enemies: shown, absorb });
}

export function combatOnReveal(draft, events, ctx) {
  if (combatMode(draft) !== 'rounds' || draft.combat) return;
  const revealed = events.find((event) => event.type === 'encounter-revealed');
  if (revealed) startCombat(draft, revealed, ctx);
}

// Handlers en déclarations de fonctions : campaign.js et ce module s'importent l'un l'autre.
export function shoot(draft, action, ctx) {
  return playRound(draft, action, ctx, resolveShot);
}

export function takeCover(draft, action, ctx) {
  return playRound(draft, action, ctx, resolveTakeCover);
}

export function grenade(draft, action, ctx) {
  return playRound(draft, action, ctx, resolveGrenade);
}

export function heal(draft, action, ctx) {
  return playRound(draft, action, ctx, resolveHeal);
}

export function escape(draft, action, ctx) {
  return playRound(draft, action, ctx, resolveEscape);
}

export function parley(draft, action, ctx) {
  return playRound(draft, action, ctx, resolveParley);
}

const COMBAT_ACTION_TYPES = Object.freeze(['shoot', 'take-cover', 'grenade', 'heal', 'escape', 'parley']);

export function combatRefusal(campaign, action) {
  if (campaign.combat && !COMBAT_ACTION_TYPES.includes(action.type)) return 'in-combat';
}

// Un round : l'action du joueur (resolve), puis la victoire ou la riposte des ennemis.
function playRound(draft, action, ctx, resolve) {
  if (!draft.combat) return 'not-in-combat';
  const day = dayState(draft);
  const roundCtx = { ...ctx, combat: draft.combat };
  ctx.emit({ type: 'combat-round', round: draft.combat.round });
  const refusal = resolve(day, action, roundCtx, draft);
  if (refusal) return refusal;

  if (draft.combat && day.status === 'playing') {
    if (standingEnemies(draft.combat).length === 0) endCombat(draft, day, 'victory', ctx);
    else enemyPhase(draft.combat, day, ctx);
  }
  if (draft.combat && day.status !== 'playing') endCombat(draft, day, 'dead', ctx);
  storeDay(draft, day);
}

function resolveShot(day, action, ctx) {
  const { combat } = ctx;
  const target = action.target ?? combat.enemies.findIndex((enemy) => enemy.hp > 0);
  const enemy = combat.enemies[target];
  if (!enemy || enemy.hp <= 0) return 'no-target';

  const weapon = activeWeapon(day.equipment, day.inventory) ?? UNARMED;
  const roll = ctx.rng.d6();
  const tir = day.player.stats.tir + statBonus(day.equipment, 'tir');
  const cover = terrainCover(day);
  const total = roll + tir + weapon.bonus + cover;
  const hit = total >= enemy.threat;
  if (weapon.ammo) useCharge(day, weapon.ammo);
  if (hit) enemy.hp = Math.max(0, enemy.hp - weapon.damage);
  const { name, threat, hp } = enemy;
  ctx.emit({ type: 'shot', target, name, roll, tir, weapon: weapon.bonus, cover, total, threat, hit, damage: weapon.damage, hp });
  if (hit && hp === 0) ctx.emit({ type: 'enemy-down', enemy: target, name });
}

function resolveTakeCover(_day, _action, ctx) {
  ctx.combat.cover = TAKE_COVER.rounds;
  ctx.emit({ type: 'took-cover', ...TAKE_COVER });
}

function resolveGrenade(day, _action, ctx) {
  if (!day.inventory.some((item) => item.kind === 'grenade')) return 'no-item';
  removeItem(day, 'grenade', 'grenade', ctx.emit);
  const { damage } = catalog.grenade.grenade;
  const targets = [];
  ctx.combat.enemies.forEach((enemy, i) => {
    if (enemy.hp <= 0) return;
    enemy.hp = Math.max(0, enemy.hp - damage);
    targets.push(i);
  });
  ctx.emit({ type: 'grenade', damage, targets });
  for (const i of targets) {
    const enemy = ctx.combat.enemies[i];
    if (enemy.hp === 0) ctx.emit({ type: 'enemy-down', enemy: i, name: enemy.name });
  }
}

const isHealing = (kind) => catalog[kind]?.category === 'soin';

function resolveHeal(day, { item }, ctx) {
  if (item && !isHealing(item)) return 'not-healing';
  const index = day.inventory.findIndex((owned) => (item ? owned.kind === item : isHealing(owned.kind)));
  if (index === -1) return 'no-item';
  const [{ kind }] = day.inventory.splice(index, 1);
  const { wounds } = catalog[kind].use;
  day.player.wounds = Math.max(0, day.player.wounds + wounds);
  ctx.emit({ type: 'used', item: kind, wounds });
}

function resolveEscape(day, _action, ctx, draft) {
  if (day.ap.left < ESCAPE_COST) return 'not-enough-ap';
  day.ap.left -= ESCAPE_COST;
  day.ap.spent += ESCAPE_COST;
  if (!skillCheck(day, 'discretion', 0, ctx)) {
    const strongest = standingEnemies(ctx.combat).reduce((best, enemy) => (enemy.threat > best.threat ? enemy : best));
    attack(ctx.combat, ctx.combat.enemies.indexOf(strongest), day, ctx, true);
    if (day.status !== 'playing') return;
  }
  const from = day.player.hex;
  const to = day.player.previousHex ?? from;
  day.player.hex = to;
  day.player.previousHex = from;
  ctx.emit({ type: 'fled', from, to, cost: ESCAPE_COST });
  endCombat(draft, day, 'fled', ctx);
}

function resolveParley(day, _action, ctx, draft) {
  const enemies = standingEnemies(ctx.combat);
  if (enemies.some((enemy) => enemy.type !== 'humain')) return 'mutants';
  const { faction } = enemies[0];
  const tier = faction ? standing(draft, faction) : 'neutre';
  if (tier === 'hostile') return 'hostile';

  let outcome = 'peage';
  if (faction && encounterStance(draft, faction) === 'echange') {
    outcome = isMember(draft, faction) || tier === 'allie' ? 'fin' : 'echange';
  }
  const event = { type: 'parley', faction, standing: tier, outcome };
  if (outcome === 'peage') {
    const toll = TOLL_PER_ENEMY * enemies.length;
    if (draft.player.roubles < toll) return 'not-enough-roubles';
    draft.player.roubles -= toll;
    event.toll = toll;
  }
  ctx.emit(event);
  endCombat(draft, day, outcome, ctx);
}

function terrainCover(day) {
  return COVER[day.tile.hexes[day.player.hex].terrain] ?? 0;
}

function defenseOf(combat, day) {
  const taken = combat.cover > 0 ? TAKE_COVER.bonus : 0;
  const armor = day.equipment?.armor ? ARMOR_DEFENSE : 0;
  return BASE_DEFENSE + terrainCover(day) + taken + armor;
}

function attack(combat, index, day, ctx, free = false) {
  const enemy = combat.enemies[index];
  const defense = defenseOf(combat, day);
  const roll = ctx.rng.d6();
  const total = roll + enemy.threat;
  const hit = total >= defense;
  const absorbed = hit ? Math.min(combat.absorb, enemy.damage) : 0;
  const wounds = hit ? enemy.damage - absorbed : 0;
  combat.absorb -= absorbed;
  const { name, threat, damage } = enemy;
  ctx.emit({
    type: 'enemy-attack', enemy: index, name, roll, threat, total, defense, hit, damage, absorbed, wounds,
    ...(free && { free }),
  });
  if (wounds > 0) wound(day, wounds, 'combat', ctx.emit);
}

function enemyPhase(combat, day, ctx) {
  combat.enemies.forEach((enemy, index) => {
    if (enemy.hp > 0 && day.status === 'playing') attack(combat, index, day, ctx);
  });
  combat.cover = Math.max(0, combat.cover - 1);
  combat.round += 1;
}

function endCombat(draft, day, outcome, ctx) {
  const { hex, card, enemies, previousScreen } = draft.combat;
  day.combat = null;
  if (SETTLED.includes(outcome)) {
    day.encounters = day.encounters.filter((encounter) => encounter.hex !== hex);
    ctx.emit({ type: 'encounter-removed', hex, card });
  }
  const trophies = outcome === 'victory' ? collectTrophies(enemies, day, ctx) : [];
  draft.combat = null;
  draft.screen = previousScreen;
  ctx.emit({ type: 'combat-ended', outcome, hex, card, trophies });
  // Comme en v1 (game.js), une journée sans PA s'arrête : la fuite ou une blessure peut y mener.
  if (day.status === 'playing' && day.ap.left <= 0) {
    day.status = 'night';
    ctx.emit({ type: 'day-ended', reason: 'no-ap' });
  }
}

function collectTrophies(enemies, day, ctx) {
  const kept = [];
  for (const { type, trophy } of enemies) {
    if (type !== 'mutant' || !trophy) continue;
    if (addItem(day, createItem(trophy))) kept.push(trophy);
    else ctx.emit({ type: 'trophy-lost', item: trophy });
  }
  return kept;
}
