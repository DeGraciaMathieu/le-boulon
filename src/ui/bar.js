// Bandeau en pistes (direction plateau, lot L2 ; proposition §2 et §4, A1 A2 A9). Pures : elles
// lisent la campagne et les événements d'un step, sans DOM (tests/bar.test.js). bar-view.js les
// dessine et les anime.
//
//   apTrack(campaign) -> { left, max, spent, lost, slots: [{ n, kind, cause?, tag?, title? }] }
//     piste de PA : une alvéole par PA du budget plein (BASE_AP + Endurance + ceinture, plus la
//     boisson du jour) ; kind 'cube' (PA restant), 'vide' (cube parti vers « dépensés ») ou
//     'retenu' (cube barré par une pénalité, cause et étiquette au survol). spent : PA dépensés ;
//     lost : PA perdus sans être dépensés (fin de journée, Émission).
//   notchTracks(campaign) -> { blessures, radiations, faim } chacune { value, size, notches }
//     notches : [{ n, lit, mark?: { tag, title } }] ; mark = seuil marqué d'avance.
//   coinStack(roubles) -> nombre de pièces de la pile (COIN_MAX au plus)
//   barSnapshot(campaign) -> { day, spent, wounds, radiation, hunger }  avant/après un step
//   barBeats(events, before, after) -> événements du step avec les pas du bandeau insérés :
//     { type: BEATS.spend, count }                     A1 : count cubes glissent vers « dépensés »
//     { type: BEATS.penalty, cause }                   A1 : un cube est retenu en cours de journée
//     { type: BEATS.wake }                             A2 : les cubes reviennent au réveil
//     { type: BEATS.notch, track, from, to, crossed }  A9 : crans allumés, seuils franchis
//
// PÉNALITÉS DU BUDGET (startBudget de rules/time.js) : la campagne ne garde pas leur détail ; on
// le retrouve de l'état : faim (hunger ≥ 1), 4 blessures (woundPenalty) et le reste du manque, la
// nuit à découvert. Une pénalité de blessures posée en cours de journée (wound de sheet.js) retire
// un PA restant sans le dépenser : c'est l'écart entre le budget et restants + dépensés.

import { dayState } from '../engine/campaign.js';
import { BASE_AP } from '../engine/game.js';
import { apBonus } from '../engine/rules/equipment.js';
import { hasPerk } from '../engine/rules/progression.js';
import { ITEMS, TRACK_MAX, TOUGH_TRACK_MAX, WOUND_PENALTY_AT, RADIATION_RESET } from '../engine/rules/sheet.js';
import { HUNGER_MALUS, OPEN_AIR_MALUS, WOUND_AP_MALUS } from '../engine/rules/time.js';
import { STARVING_DAYS } from './aide.js';

export const COIN_VALUE = 100;
export const COIN_MAX = 8;

export const BEATS = Object.freeze({
  spend: 'bandeau-pa',
  penalty: 'bandeau-penalite',
  wake: 'bandeau-reveil',
  notch: 'bandeau-cran',
});

// Étiquette courte sous le cube retenu, phrase complète au survol.
export const HELD = Object.freeze({
  faim: { tag: 'faim', title: '−1 PA : faim, rien mangé au réveil' },
  blessures: { tag: `${WOUND_PENALTY_AT} bl.`, title: `−1 PA : ${WOUND_PENALTY_AT} blessures ou plus` },
  decouvert: { tag: 'nuit', title: `−1 PA : nuit à découvert (−${OPEN_AIR_MALUS} PA)` },
});

// PA que rend la boisson énergétique, une fois par jour (ap.boosted).
const BOOST_AP = Object.values(ITEMS).find((item) => item.use?.oncePerDay)?.use.ap ?? 0;

const deathAt = (campaign) => (hasPerk(campaign, 'coriace') ? TOUGH_TRACK_MAX : TRACK_MAX);

export function apTrack(campaign) {
  const { ap, status, player: { woundPenalty } } = dayState(campaign);
  const { player } = campaign;
  const full = BASE_AP + player.stats.endurance + apBonus(campaign.equipment);
  const boost = ap.boosted ? BOOST_AP : 0;
  const gap = Math.max(0, ap.max + boost - ap.left - ap.spent);
  const woundToday = Boolean(woundPenalty) && status === 'playing' && gap > 0;
  const held = [...budgetHeld(full - ap.max, player.hunger, woundPenalty && !woundToday)];
  if (woundToday) held.push(...Array(Math.min(gap, WOUND_AP_MALUS)).fill('blessures'));
  const lost = gap - (woundToday ? Math.min(gap, WOUND_AP_MALUS) : 0);

  const total = Math.max(full, ap.max) + boost;
  const firstHeld = total - held.length;
  const slots = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    if (i >= firstHeld) {
      const cause = held[i - firstHeld];
      return { n, kind: 'retenu', cause, ...HELD[cause] };
    }
    return { n, kind: i < ap.left ? 'cube' : 'vide' };
  });
  return { left: ap.left, max: ap.max, spent: ap.spent, lost, slots };
}

// Les PA retenus au budget du jour, une cause par cube, dans l'ordre de startBudget.
function budgetHeld(missing, hunger, wounded) {
  let rest = Math.max(0, missing);
  const take = (amount) => {
    const taken = Math.min(rest, amount);
    rest -= taken;
    return taken;
  };
  const hungry = take(hunger >= 1 ? HUNGER_MALUS : 0);
  const hurt = take(wounded ? WOUND_AP_MALUS : 0);
  return [...Array(hungry).fill('faim'), ...Array(hurt).fill('blessures'), ...Array(rest).fill('decouvert')];
}

function notchTrack(value, size, marks) {
  const notches = Array.from({ length: size }, (_, i) => {
    const n = i + 1;
    return { n, lit: n <= value, ...(marks[n] && { mark: marks[n] }) };
  });
  return { value, size, notches };
}

function trackMarks(campaign) {
  const death = deathAt(campaign);
  return {
    blessures: {
      [WOUND_PENALTY_AT]: { tag: `−${WOUND_AP_MALUS} PA`, title: `${WOUND_PENALTY_AT} blessures : −${WOUND_AP_MALUS} PA par jour` },
      [death]: { tag: 'mort', title: `${death} blessures : mort` },
    },
    radiations: {
      [TRACK_MAX]: { tag: '+1 bl.', title: `${TRACK_MAX} radiations : 1 blessure et retour à ${RADIATION_RESET}` },
    },
    faim: {
      1: { tag: `−${HUNGER_MALUS} PA`, title: `1 jour sans manger : −${HUNGER_MALUS} PA` },
      [STARVING_DAYS]: { tag: '+1 bl.', title: `${STARVING_DAYS} jours sans manger : 1 blessure chaque matin` },
    },
  };
}

const trackSizes = (campaign, hunger) => ({
  blessures: deathAt(campaign),
  radiations: TRACK_MAX,
  faim: Math.max(STARVING_DAYS + 1, hunger),
});

export function notchTracks(campaign) {
  const { wounds, radiation, hunger } = campaign.player;
  const marks = trackMarks(campaign);
  const sizes = trackSizes(campaign, hunger);
  return {
    blessures: notchTrack(wounds, sizes.blessures, marks.blessures),
    radiations: notchTrack(radiation, sizes.radiations, marks.radiations),
    faim: notchTrack(hunger, sizes.faim, marks.faim),
  };
}

export function coinStack(roubles) {
  return Math.min(COIN_MAX, Math.ceil(Math.max(0, roubles) / COIN_VALUE));
}

export function barSnapshot(campaign) {
  const { ap } = dayState(campaign);
  const { wounds, radiation, hunger } = campaign.player;
  return { day: campaign.day, spent: ap.spent, wounds, radiation, hunger, marks: trackMarks(campaign), sizes: trackSizes(campaign, hunger) };
}

export function barBeats(events, before, after) {
  const running = { blessures: before.wounds, radiations: before.radiation };
  const notch = (track, from, to) => {
    const crossed = Object.keys(after.marks[track]).map(Number).filter((n) => from < n && n <= to);
    return { type: BEATS.notch, track, from, to, crossed };
  };
  const beats = [];
  if (after.day === before.day && after.spent > before.spent) beats.push({ type: BEATS.spend, count: after.spent - before.spent });
  for (const event of events) {
    beats.push(event);
    if (event.type === 'wounded' && event.amount > 0) {
      const from = running.blessures;
      running.blessures = Math.min(after.sizes.blessures, from + event.amount);
      beats.push(notch('blessures', from, running.blessures));
    } else if (event.type === 'irradiated' && event.amount > 0) {
      const from = running.radiations;
      const to = Math.min(TRACK_MAX, from + event.amount);
      running.radiations = to >= TRACK_MAX ? RADIATION_RESET : to;
      beats.push(notch('radiations', from, to));
    } else if (event.type === 'hunger') {
      beats.push(notch('faim', event.days - 1, event.days));
    } else if (event.type === 'used') {
      running.blessures = Math.max(0, running.blessures + (event.wounds ?? 0));
      running.radiations = Math.max(0, running.radiations + (event.radiation ?? 0));
    } else if (event.type === 'ap-penalty') {
      beats.push({ type: BEATS.penalty, cause: 'blessures' });
    } else if (event.type === 'day-started') {
      beats.push({ type: BEATS.wake });
    }
  }
  return beats;
}
