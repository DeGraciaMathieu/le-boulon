// Couche « Pourquoi ? » (direction plateau, lot L7 ; proposition §5 outil 1) : chaque chiffre ou
// objet qui change porte sa cause en une phrase, au survol. Un dictionnaire cause -> phrase,
// nourri par les champs que les événements du moteur portent déjà. Pures : pas de DOM (testées
// par tests/pourquoi.test.js). Branchements : bar-view.js (crans), bac-view.js (verdict du jet),
// combat-window.js (Défense), campagne.js (lignes du journal).
//
//   eventWhy(event) -> phrase | null     cause d'un événement : jet, blessure, radiation,
//                                         pénalité de PA, faim, carte Zone, Émission
//   rollWhy(event) -> phrase | null      détail d'un jet (check, shot, enemy-attack) : la règle,
//                                         le dé qu'il fallait et sa chance, le dé tiré, le verdict
//   defenseWhy(odds) -> phrase           composition de la Défense (combatOdds de rules/combat.js)
//   trackCauses(previous, events, player) -> { blessures: [cause|null], radiations: [cause|null] }
//     cause de chaque cran allumé, tenue par l'interface d'un step à l'autre (la campagne ne la
//     garde pas) ; null : cran d'avant la session ou soigné hors de vue.
//   notchWhy(track, n, causes) -> phrase | null   survol du cran n d'une piste du bandeau
//   HELD (bar.js) donne déjà la phrase des cubes de PA retenus : ce module la réutilise.

import { ENCOUNTER_CARDS } from '../engine/rules/encounters.js';
import { TRACK_MAX, RADIATION_RESET } from '../engine/rules/sheet.js';
import { HUNGER_MALUS } from '../engine/rules/time.js';
import { DRAW_EVERY, EMISSION_COUNTDOWN, EMISSION_WOUNDS } from '../engine/rules/zone.js';
import { STARVING_DAYS } from './aide.js';
import { HELD } from './bar.js';
import { STAT_NAMES } from './pda.js';

// Valeurs non exportées par rules/combat.js ; tests/pourquoi.test.js les vérifie contre le moteur.
export const BASE_DEFENSE = 4;
export const TAKE_COVER_BONUS = 2;

export const WOUND_CAUSES = Object.freeze({
  marais: 'marais, test de Survie raté en y entrant',
  electro: 'anomalie électro déclenchée (détecteur en panne)',
  gravitationnelle: 'anomalie gravitationnelle déclenchée (projection)',
  bruleuse: 'anomalie brûleuse déclenchée (un consommable brûlé)',
  emission: "pris par l'Émission sans abri",
  radiation: `${TRACK_MAX} radiations atteintes, retour à ${RADIATION_RESET}`,
  faim: `${STARVING_DAYS} jours sans manger`,
  combat: 'touché en combat',
  nuit: 'carte Nuit piochée au bivouac',
  fuite: 'fuite pendant un combat de nuit',
  piege: 'piège dans un lieu',
});

export const RADIATION_CAUSES = Object.freeze({
  ceinture: 'artefacts portés à la ceinture',
  nuit: 'carte Nuit piochée au bivouac',
});

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const causeText = (table, cause) => table[cause] ?? ENCOUNTER_CARDS[cause]?.name ?? 'la Zone';

// Chance d'obtenir need ou plus sur 1d6.
function chance(need) {
  if (need <= 1) return 'tout dé suffit';
  if (need > 6) return 'aucun dé ne suffit';
  return `il faut ${need}+ sur le dé (${Math.round(((7 - need) / 6) * 100)} %)`;
}

const ROLLS = {
  check: (e) => {
    const stat = STAT_NAMES[e.stat] ?? e.stat;
    return `Test de ${stat} : 1d6 + ${stat} (${e.bonus}) ≥ ${e.target}, ${chance(e.target - e.bonus)}. Dé ${e.roll} : ${e.success ? 'réussi' : 'raté'}.`;
  },
  shot: (e) => `Tir sur ${e.name} : 1d6 + Tir, arme et couvert (${e.total - e.roll}) ≥ Menace ${e.threat}, ${chance(e.threat - (e.total - e.roll))}. Dé ${e.roll} : ${e.hit ? 'touché' : 'raté'}.`,
  'enemy-attack': (e) => `${e.name} touche si 1d6 + Menace ${e.threat} ≥ votre Défense ${e.defense}, ${chance(e.defense - e.threat)}. Dé ${e.roll} : ${e.hit ? 'touché' : 'raté'}.`,
};

export function rollWhy(event) {
  return ROLLS[event?.type]?.(event) ?? null;
}

const EVENTS = {
  wounded: (e) => `+${plural(e.amount, 'blessure')} : ${causeText(WOUND_CAUSES, e.cause)}.`,
  irradiated: (e) => `+${plural(e.amount, 'radiation')} : ${causeText(RADIATION_CAUSES, e.cause)}${e.blocked ? `, l'armure en arrête ${e.blocked}` : ''}.`,
  'ap-penalty': () => `${HELD.blessures.title}.`,
  hunger: (e) => `${plural(e.days, 'jour')} sans manger : −${HUNGER_MALUS} PA${e.wounds ? ' et 1 blessure' : ''}.`,
  'zone-card': () => `Une carte Zone est piochée chaque fois que les PA dépensés passent un multiple de ${DRAW_EVERY}.`,
  'emission-started': () => `${EMISSION_COUNTDOWN} PA pour gagner un abri ; sinon ${EMISSION_WOUNDS} blessures et évanouissement jusqu'au lendemain.`,
};

export function eventWhy(event) {
  return rollWhy(event) ?? EVENTS[event?.type]?.(event) ?? null;
}

// odds : combatOdds(campaign) ; l'armure est le reste une fois base et couverts comptés.
export function defenseWhy(odds) {
  const taken = odds.coverRounds > 0 ? TAKE_COVER_BONUS : 0;
  const armor = odds.defense - BASE_DEFENSE - odds.cover - taken;
  const terms = [
    [`base ${BASE_DEFENSE}`, true],
    [`terrain +${odds.cover}`, odds.cover > 0],
    [`à couvert +${taken}`, taken > 0],
    [`armure +${armor}`, armor > 0],
  ].filter(([, shown]) => shown).map(([text]) => text);
  return `Défense ${odds.defense} = ${terms.join(', ')}. Un ennemi touche si 1d6 + Menace ≥ Défense.`;
}

// Une liste de causes ramenée à la valeur de la piste : les crans soignés hors de vue partent
// de la fin, les crans inconnus (partie chargée) se placent devant.
function fit(list, value) {
  if (list.length >= value) return list.slice(0, value);
  return [...Array(value - list.length).fill(null), ...list];
}

export function trackCauses(previous, events, player) {
  const wounds = [...(previous?.blessures ?? [])];
  const radiations = [...(previous?.radiations ?? [])];
  for (const event of events) {
    if (event.type === 'wounded') wounds.push(...Array(event.amount).fill(event.cause));
    else if (event.type === 'irradiated') {
      radiations.push(...Array(event.amount).fill(event.cause));
      if (radiations.length >= TRACK_MAX) radiations.length = RADIATION_RESET;
    } else if (event.type === 'used') {
      if (event.wounds < 0) wounds.length = Math.max(0, wounds.length + event.wounds);
      if (event.radiation < 0) radiations.length = Math.max(0, radiations.length + event.radiation);
    }
  }
  return { blessures: fit(wounds, player.wounds), radiations: fit(radiations, player.radiation) };
}

const NOTCHES = {
  blessures: (n, causes) => causes?.blessures?.[n - 1] && `Blessure ${n} : ${causeText(WOUND_CAUSES, causes.blessures[n - 1])}`,
  radiations: (n, causes) => causes?.radiations?.[n - 1] && `Radiation ${n} : ${causeText(RADIATION_CAUSES, causes.radiations[n - 1])}`,
  faim: (n) => `${plural(n, 'jour')} sans manger`,
};

export function notchWhy(track, n, causes) {
  return NOTCHES[track]?.(n, causes) || null;
}
