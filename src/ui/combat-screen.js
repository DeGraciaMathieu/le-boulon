// Lectures de l'écran Combat v2 (brief v2 §13, §16 ; carte 27) : ennemis avec PV et Menace,
// actions du round, jets affichés. Pures : elles lisent la campagne, le contenu et les
// événements, sans rien modifier, et ne touchent pas au DOM (testées par
// tests/combat-screen.test.js). Fenêtre : src/ui/combat-window.js.
//
//   combatWindow(campaign) -> null | {
//     title, round, attack, defense, coverRounds, absorb,
//     weapon: { name, bonus, damage, charges },
//     enemies: [{ index, name, hp, maxHp, threat, damage, type, down, toHit }],
//     actions: [{ type, label, action, available, reason }] }
//     toHit : le dé minimal pour toucher (1 à 6, 7 : impossible) ; une action par type de
//     rules/combat.js, sauf Tirer qui se joue sur chaque ennemi debout.
//   combatLine(event) -> ligne d'un jet ou d'un événement de combat, undefined s'il n'est
//     pas de ce module ; sert à la fenêtre (jets du round) et au journal.
//   COMBAT_OUTCOMES : libellés des fins de combat.

import content from '../content/index.js';
import { dayState } from '../engine/campaign.js';
import { combatOdds, parleyTerms } from '../engine/rules/combat.js';
import { encounterCards } from '../engine/rules/tile.js';

export const COMBAT_OUTCOMES = Object.freeze({
  victory: 'Victoire', fled: 'Fuite', peage: 'Péage payé', echange: 'Échange, on vous laisse passer',
  fin: 'Entre amis, le combat cesse', dead: 'Mort au combat',
});

const REFUSALS = {
  'no-target': 'aucune cible debout',
  'not-healing': "ce n'est pas un soin",
  mutants: 'les mutants ne parlementent pas',
  hostile: 'faction hostile, pas de discussion',
  'not-enough-roubles': 'pas assez de roubles',
  'not-enough-ap': 'pas assez de PA',
  'no-item': "objet absent de l'inventaire",
};

const itemName = (id) => content.items[id]?.name ?? id;
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const isHealing = (kind) => content.items[kind]?.category === 'soin';

// Dé minimal pour que 1d6 + bonus ≥ seuil ; 7 : aucun dé ne suffit.
const needed = (threshold, bonus) => Math.min(7, Math.max(1, threshold - bonus));

export function combatWindow(campaign) {
  const odds = combatOdds(campaign);
  if (!odds) return null;
  const { combat } = campaign;
  const day = dayState(campaign);
  const card = encounterCards(day.tile)[combat.card];
  const enemies = combat.enemies.map(({ name, hp, maxHp, threat, damage, type }, index) => ({
    index, name, hp, maxHp, threat, damage, type, down: hp <= 0, toHit: needed(threat, odds.attack),
  }));
  return {
    title: card?.name ?? combat.card,
    round: combat.round,
    attack: odds.attack,
    defense: odds.defense,
    coverRounds: odds.coverRounds,
    absorb: odds.absorb,
    weapon: {
      name: odds.weapon.kind ? itemName(odds.weapon.kind) : 'Mains nues',
      bonus: odds.weapon.bonus,
      damage: odds.weapon.damage,
      charges: odds.weapon.charges,
    },
    enemies,
    actions: roundActions(campaign, day, odds),
  };
}

function roundActions(campaign, day, odds) {
  const has = (test) => campaign.inventory.some((item) => test(item.kind));
  const parley = parleyTerms(campaign);
  const option = (type, label, reason) => ({ type, label, action: { type }, available: !reason, reason: reason ?? null });
  return [
    option('take-cover', 'Se mettre à couvert'),
    option('grenade', 'Grenade', has((kind) => kind === 'grenade') ? undefined : 'aucune grenade'),
    option('heal', 'Soigner', has(isHealing) ? undefined : 'aucun soin'),
    option('escape', `Fuir (${odds.escapeCost} PA)`, day.ap.left >= odds.escapeCost ? undefined : 'pas assez de PA'),
    option('parley', parley.toll ? `Parlementer (péage ${parley.toll} ₽)` : 'Parlementer', parley.refusal && REFUSALS[parley.refusal]),
  ];
}

function shotLine(e) {
  const result = e.hit ? `touché, -${e.damage} PV${e.hp === 0 ? '' : ` (reste ${e.hp})`}` : 'raté';
  return `Tir sur ${e.name} : ${e.roll} + Tir ${e.tir} ${signed(e.weapon)} arme ${signed(e.cover)} couvert = ${e.total} / Menace ${e.threat} · ${result}`;
}

function attackLine(e) {
  const head = `${e.name} attaque${e.free ? ' (attaque gratuite)' : ''} : ${e.roll} + Menace ${e.threat} = ${e.total} / défense ${e.defense}`;
  if (!e.hit) return `${head} · raté`;
  const absorbed = e.absorbed ? `, ${e.absorbed} absorbée${e.absorbed > 1 ? 's' : ''} par l'armure` : '';
  return `${head} · touché : ${plural(e.wounds, 'blessure')}${absorbed}`;
}

function parleyLine(e) {
  if (e.outcome === 'peage') return `Parlementer : péage de ${e.toll} ₽`;
  return `Parlementer : ${COMBAT_OUTCOMES[e.outcome]}`;
}

function endLine(e) {
  const trophies = e.trophies.length ? ` · trophées : ${e.trophies.map(itemName).join(', ')}` : '';
  return `Fin du combat : ${COMBAT_OUTCOMES[e.outcome] ?? e.outcome}${trophies}`;
}

const LINES = {
  'combat-started': (e) => `Combat : ${e.enemies.map((enemy) => `${enemy.name} (Menace ${enemy.threat}, ${enemy.hp} PV)`).join(', ')}`,
  'combat-round': (e) => `Round ${e.round}`,
  shot: shotLine,
  'took-cover': (e) => `À couvert : ${signed(e.bonus)} en défense pour ${e.rounds} rounds`,
  grenade: (e) => `Grenade : -${e.damage} PV à ${plural(e.targets.length, 'ennemi')}`,
  'enemy-attack': attackLine,
  'enemy-down': (e) => `${e.name} abattu`,
  parley: parleyLine,
  'trophy-lost': (e) => `Trophée perdu (inventaire plein) : ${itemName(e.item)}`,
  'combat-ended': endLine,
  used: (e) => `${itemName(e.item)} utilisé${e.wounds ? ` · blessures ${signed(e.wounds)}` : ''}${e.radiation ? ` · radiations ${signed(e.radiation)}` : ''}`,
};

export function combatLine(event) {
  if (event.type === 'refused') return REFUSALS[event.reason] && `Refusé : ${REFUSALS[event.reason]}`;
  return LINES[event.type]?.(event);
}
