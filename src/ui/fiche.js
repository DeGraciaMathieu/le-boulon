// Fiche de personnage en carton (direction plateau, lot L4 ; proposition §2 et §4, A4 A11 A14).
// Pures : elles lisent la campagne et les événements d'un step, sans DOM (tests/fiche.test.js).
// fiche-view.js les dessine et les anime.
//
//   sheetCard(campaign) -> {
//     rank: { id, name, xp, next: { name, xp } | null, ratio },   jauge d'XP du rang en cours
//     skills: [{ id, label, value, bonus, total, max }],           compétences en pastilles
//     defense: { total, base, armor, armorName, detail },          détail au survol
//     gear: [{ slot, label, name, detail, empty? }],               arme, armure, détecteur, artefacts
//     care: [{ kind, name, count }],                               ceinture de soins (CARE_KINDS)
//     bolts: number }                                              réserve de boulons
//   xpRatio(xp) -> 0..1          remplissage de la jauge dans le rang atteint (1 au dernier rang)
//   ficheBeats(events) -> les événements du step avec les pas de la fiche insérés après leur
//   événement (les types moteur restent à effets-view.js et au bandeau, un seul play par type) :
//     { type: FICHE_BEATS.bolt, target }                     A4 : bolt-thrown
//     { type: FICHE_BEATS.item, kind }                       A11 : item-gained, artefact-picked
//     { type: FICHE_BEATS.coins, amount }                    A11 : roubles-changed
//     { type: FICHE_BEATS.xp, from, to, ranked }             A14 : xp-gained (ranked : rang passé)
//     { type: FICHE_BEATS.stat, stat, value }                A14 : stat-raised

import content from '../content/index.js';
import { RANKS, STATS, STAT_MAX, rankOf } from '../engine/rules/progression.js';
import { statBonus, beltSlots } from '../engine/rules/equipment.js';
import { countCharges } from '../engine/rules/sheet.js';
import { BASE_DEFENSE, ARMOR_DEFENSE } from '../engine/rules/combat.js';
import { RANK_NAMES, STAT_NAMES } from './pda.js';

// Les soins de la ceinture : ceux de la zone Soins du panneau de commandes.
export const CARE_KINDS = Object.freeze(['bandage', 'vodka', 'ration']);

export const FICHE_BEATS = Object.freeze({
  bolt: 'fiche-boulon',
  item: 'fiche-objet',
  coins: 'fiche-roubles',
  xp: 'fiche-xp',
  stat: 'fiche-stat',
});

const SKILL_ORDER = ['tir', 'discretion', 'survie', 'endurance'];
const SLOT_LABELS = { primary: 'Arme', sidearm: 'Arme de poing', armor: 'Armure', detector: 'Détecteur' };
const BELT_LABELS = { tir: 'Tir', survie: 'Survie', discretion: 'Discrétion' };

const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const itemName = (kind) => content.items[kind]?.name ?? kind;

export function xpRatio(xp) {
  const index = RANKS.findIndex(({ id }) => id === rankOf(xp));
  const next = RANKS[index + 1];
  if (!next) return 1;
  const from = RANKS[index].xp;
  return (xp - from) / (next.xp - from);
}

function rankLine({ xp, rank }) {
  const next = RANKS.find((r) => r.xp > xp);
  return {
    id: rank,
    name: RANK_NAMES[rank],
    xp,
    next: next ? { name: RANK_NAMES[next.id], xp: next.xp } : null,
    ratio: xpRatio(xp),
  };
}

function skills(campaign) {
  return SKILL_ORDER.filter((id) => STATS.includes(id)).map((id) => {
    const value = campaign.player.stats[id];
    const bonus = statBonus(campaign.equipment, id);
    return { id, label: STAT_NAMES[id], value, bonus, total: value + bonus, max: STAT_MAX };
  });
}

function defense(equipment) {
  const armorName = equipment?.armor ? itemName(equipment.armor.kind) : null;
  const armor = armorName ? ARMOR_DEFENSE : 0;
  const parts = [`base ${BASE_DEFENSE}`, armorName ? `armure ${signed(armor)} (${armorName})` : 'sans armure'];
  return { total: BASE_DEFENSE + armor, base: BASE_DEFENSE, armor, armorName, detail: `Défense ${BASE_DEFENSE + armor} = ${parts.join(' ')}` };
}

function weaponDetail(item, inventory) {
  const { weapon, ammo } = content.items[item.kind];
  return `${signed(weapon.bonus)} · dégâts ${weapon.damage} · ${countCharges(inventory, ammo)} balles`;
}

function armorDetail(item) {
  const { absorb, radiation } = content.items[item.kind].armor;
  return `absorbe ${absorb} · radiations −${radiation}`;
}

function detectorDetail(item) {
  const { range, anomalyType } = content.items[item.kind].detector;
  return `portée ${range}${anomalyType ? ' · type d’anomalie' : ''}`;
}

function beltDetail(item) {
  const { stats = {}, absorb, ap, radiation, cost } = content.items[item.kind].belt;
  const parts = Object.entries(stats).map(([stat, n]) => `${BELT_LABELS[stat] ?? stat} ${signed(n)}`);
  if (absorb) parts.push(`absorbe ${absorb}`);
  if (ap) parts.push(`${signed(ap)} PA`);
  if (radiation) parts.push(`radiations −${radiation}`);
  if (cost) parts.push(`coûte ${cost} rad./jour`);
  return parts.join(' · ');
}

function gear({ equipment, inventory }) {
  const lines = [];
  const slot = (key, detail) => {
    const item = equipment?.[key];
    lines.push(item
      ? { slot: key, label: SLOT_LABELS[key], name: itemName(item.kind), detail: detail(item) }
      : { slot: key, label: SLOT_LABELS[key], name: 'aucun', detail: '', empty: true });
  };
  for (const key of ['primary', 'sidearm']) {
    if (equipment?.[key]) slot(key, (item) => weaponDetail(item, inventory));
  }
  if (!equipment?.primary && !equipment?.sidearm) lines.push({ slot: 'sidearm', label: 'Arme', name: 'mains nues', detail: '', empty: true });
  slot('armor', armorDetail);
  slot('detector', detectorDetail);
  const belt = equipment?.belt ?? [];
  for (let i = 0; i < beltSlots(equipment); i++) {
    const item = belt[i];
    lines.push(item
      ? { slot: 'belt', label: 'Artefact', name: itemName(item.kind), detail: beltDetail(item) }
      : { slot: 'belt', label: 'Artefact', name: 'libre', detail: '', empty: true });
  }
  return lines;
}

export function sheetCard(campaign) {
  const { inventory } = campaign;
  return {
    rank: rankLine(campaign.player),
    skills: skills(campaign),
    defense: defense(campaign.equipment),
    gear: gear(campaign),
    care: CARE_KINDS.map((kind) => ({ kind, name: itemName(kind), count: inventory.filter((item) => item.kind === kind).length })),
    bolts: countCharges(inventory, 'boulons'),
  };
}

const BEAT_OF = {
  'bolt-thrown': (e) => ({ type: FICHE_BEATS.bolt, target: e.target }),
  'item-gained': (e) => ({ type: FICHE_BEATS.item, kind: e.kind }),
  'artefact-picked': (e) => ({ type: FICHE_BEATS.item, kind: e.item ?? 'artefact' }),
  'roubles-changed': (e) => (e.amount ? { type: FICHE_BEATS.coins, amount: e.amount } : null),
  'xp-gained': (e) => ({ type: FICHE_BEATS.xp, from: xpRatio(e.xp - e.amount), to: xpRatio(e.xp), ranked: rankOf(e.xp - e.amount) !== rankOf(e.xp) }),
  'stat-raised': (e) => ({ type: FICHE_BEATS.stat, stat: e.stat, value: e.value }),
};

export function ficheBeats(events) {
  return events.flatMap((event) => {
    const beat = BEAT_OF[event.type]?.(event);
    return beat ? [event, beat] : [event];
  });
}
