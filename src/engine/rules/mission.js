// Mission du jour et fin de partie.
//
// ÉTAT :
//   state.mission = { kind, done, impossible, progress }
//     kind        'recuperation' | 'cartographie'
//     done        true une fois la mission remplie (ne retombe jamais)
//     impossible  true si la mission ne peut plus être remplie (Cartographie après l'Émission)
//     progress    recuperation : { picked, needed: 1 }     artefacts ramassés
//                 cartographie : { revealed, needed: 5 }   jetons d'origine révélés
//   state.outcome = null tant que la partie dure, puis { result: 'win' | 'loss', cause, score }
//     cause  'mission-complete' (victoire) | 'mission-failed' | 'dead' | 'night' | 'emission'
//     score  roubles : valeur des artefacts de l'inventaire + MISSION_BONUS[kind] si victoire
//
// MISE EN PLACE : setupMission(game) -> game   tire la mission au hasard (avance game.rng)
//   et pose outcome = null.
//   createMission(kind) -> mission              mission neuve d'un type donné (tests, banc)
//   missionAssigned(state) -> événement         createGame ne rend pas d'événements :
//                                               l'interface journalise celui-ci au départ.
//
// BRANCHEMENT (src/engine/game.js) : missionAfterStep(draft, events, ctx), en fin de step
//   après la tombée de la nuit.
//   1. Progression : lit les événements du step dans l'ordre.
//        'artefact-picked'                      Récupération +1
//        'token-revealed' avec original: true   Cartographie +1 (jetons reposés : rien)
//        'suspects-reset'                       Cartographie pas remplie : impossible
//   2. Fin de partie : status sorti de 'playing' et outcome encore null -> outcome posé.
//        exited : victoire si mission remplie, sinon défaite 'mission-failed'
//        night | dead | emission : défaite de même cause
//
// ÉVÉNEMENTS :
//   { type: 'mission-assigned', kind, progress }
//   { type: 'mission-progress', kind, progress, impossible? }   impossible: true si elle le devient
//   { type: 'mission-complete', kind }
//   { type: 'game-over', outcome }
//
// HYPOTHÈSES V1 :
//   - Sortir sans mission remplie est une défaite ('mission-failed'), le status reste 'exited'.
//   - Cartographie : un jeton d'origine retiré par l'Émission sans avoir été révélé ne peut
//     plus l'être, la mission devient impossible. On peut encore sortir (défaite).
//   - Le score compte aussi en cas de défaite (artefacts de l'inventaire, sans prime).
//   - La victoire « avant 0 PA » découle du moteur : à 0 PA la nuit tombe et exit est refusé.

import { createRng } from '../rng.js';

export const MISSION_KINDS = ['recuperation', 'cartographie'];
export const MISSION_BONUS = { recuperation: 1500, cartographie: 2000 };
const ARTEFACTS_NEEDED = 1;
const ORIGINAL_TOKENS = 5;

const PROGRESS = {
  recuperation: { counter: 'picked', needed: ARTEFACTS_NEEDED, counts: (e) => e.type === 'artefact-picked' },
  cartographie: {
    counter: 'revealed',
    needed: ORIGINAL_TOKENS,
    counts: (e) => e.type === 'token-revealed' && e.original,
  },
};

export function createMission(kind) {
  const { counter, needed } = PROGRESS[kind];
  return { kind, done: false, impossible: false, progress: { [counter]: 0, needed } };
}

export function setupMission(game) {
  const rng = createRng(game.rng);
  game.mission = createMission(rng.pick(MISSION_KINDS));
  game.outcome = null;
  game.rng = rng.state();
  return game;
}

export function missionAssigned(state) {
  const { kind, progress } = state.mission;
  return { type: 'mission-assigned', kind, progress };
}

export function missionAfterStep(draft, events, ctx) {
  // Copie : ctx.emit ajoute au même tableau pendant la lecture.
  for (const event of [...events]) trackProgress(draft.mission, event, ctx);
  if (draft.status !== 'playing' && !draft.outcome) endGame(draft, ctx);
}

function trackProgress(mission, event, ctx) {
  if (mission.done || mission.impossible) return;
  const { counter, needed, counts } = PROGRESS[mission.kind];
  const { kind, progress } = mission;

  if (event.type === 'suspects-reset' && mission.kind === 'cartographie') {
    mission.impossible = true;
    ctx.emit({ type: 'mission-progress', kind, progress: { ...progress }, impossible: true });
    return;
  }
  if (!counts(event)) return;
  progress[counter] += 1;
  ctx.emit({ type: 'mission-progress', kind, progress: { ...progress } });
  if (progress[counter] < needed) return;
  mission.done = true;
  ctx.emit({ type: 'mission-complete', kind });
}

function endGame(draft, ctx) {
  const won = draft.status === 'exited' && draft.mission.done;
  const cause = draft.status === 'exited' ? (won ? 'mission-complete' : 'mission-failed') : draft.status;
  const artefacts = draft.inventory.filter((item) => item.kind === 'artefact');
  const loot = artefacts.reduce((sum, item) => sum + item.value, 0);
  const score = loot + (won ? MISSION_BONUS[draft.mission.kind] : 0);
  draft.outcome = { result: won ? 'win' : 'loss', cause, score };
  ctx.emit({ type: 'game-over', outcome: draft.outcome });
}
