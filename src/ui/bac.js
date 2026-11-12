// Lectures du bac à dés (direction plateau, lot L3 ; proposition §4 A7, §5 outil 2). Pures : elles
// lisent un événement de jet tel que le moteur l'émet et rendent ce que le bac affiche, sans
// toucher au DOM (testées par tests/bac.test.js). Vue : src/ui/bac-view.js.
//
//   DICE_TYPES                 types d'événement qui jouent un dé dans le bac :
//     check         test de compétence (game.js skillCheck) : stat, roll, bonus, target, success
//     shot          tir du joueur (rules/combat.js) : name, roll, tir, weapon, cover, total, threat, hit
//     enemy-attack  attaque ennemie (rules/combat.js) : name, roll, threat, total, defense, hit, free
//   rollView(event) -> null | { title, roll, terms: [{ label, value }], total, target, verdict, tone }
//     tone : 'bon' ou 'mauvais', toujours du point de vue du joueur (un ennemi qui touche est 'mauvais').
//   rollParts(view) -> [{ text, part }]   la phrase du jet en morceaux, pour la colorer ;
//   rollSentence(view) -> « dé 3 + Discrétion 1 = 4, il faut 5 · RATÉ »   les morceaux bout à bout.
//   shotHint(enemy) -> « Tir sur Pillard : il faut 3 · 2+ sur le dé (83 %) »   le seuil avant un tir ;
//     enemy : un ennemi de combatWindow (combat-screen.js), avec name, threat et toHit.
//   faceTurn(roll) -> { x, y }   rotation (degrés) qui amène la face roll du dé vers l'avant.

import { shotOdds } from './combat-screen.js';
import { STAT_NAMES } from './pda.js';

export const DICE_TYPES = Object.freeze(['check', 'shot', 'enemy-attack']);

const VIEWS = {
  check: (e) => ({
    title: `Test de ${STAT_NAMES[e.stat] ?? e.stat}`,
    terms: [{ label: STAT_NAMES[e.stat] ?? e.stat, value: e.bonus }],
    total: e.roll + e.bonus,
    target: e.target,
    verdict: e.success ? 'RÉUSSI' : 'RATÉ',
    tone: e.success ? 'bon' : 'mauvais',
  }),
  shot: (e) => ({
    title: `Tir sur ${e.name}`,
    terms: [{ label: 'Tir', value: e.tir }, { label: 'arme', value: e.weapon }, { label: 'couvert', value: e.cover }]
      .filter((term, index) => index === 0 || term.value !== 0),
    total: e.total,
    target: e.threat,
    verdict: e.hit ? 'TOUCHÉ' : 'RATÉ',
    tone: e.hit ? 'bon' : 'mauvais',
  }),
  'enemy-attack': (e) => ({
    title: `${e.name} attaque${e.free ? ' (attaque gratuite)' : ''}`,
    terms: [{ label: 'Menace', value: e.threat }],
    total: e.total,
    target: e.defense,
    verdict: e.hit ? 'TOUCHÉ' : 'RATÉ',
    tone: e.hit ? 'mauvais' : 'bon',
  }),
};

export function rollView(event) {
  const view = VIEWS[event?.type]?.(event);
  return view ? { ...view, roll: event.roll } : null;
}

const term = ({ label, value }) => ` ${value < 0 ? '−' : '+'} ${label} ${Math.abs(value)}`;

export function rollParts(view) {
  return [
    { text: `dé ${view.roll}`, part: 'de' },
    ...view.terms.map((t) => ({ text: term(t), part: 'terme' })),
    { text: ` = ${view.total}`, part: 'total' },
    { text: `, il faut ${view.target}`, part: 'seuil' },
    { text: ' · ', part: 'sep' },
    { text: view.verdict, part: 'verdict' },
  ];
}

export function rollSentence(view) {
  return rollParts(view).map((piece) => piece.text).join('');
}

export function shotHint(enemy) {
  return `Tir sur ${enemy.name} : il faut ${enemy.threat} · ${shotOdds(enemy.toHit)}`;
}

// Faces du dé : 1 devant, 6 derrière, 3 à droite, 4 à gauche, 2 dessus, 5 dessous (bac-view.js).
const TURNS = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };

export function faceTurn(roll) {
  const [x, y] = TURNS[roll] ?? TURNS[1];
  return { x, y };
}
