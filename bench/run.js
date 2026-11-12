// Banc headless : fait jouer N parties à l'IA naïve (bench/ai.js) et mesure l'économie de PA.
//
// USAGE : node bench/run.js [--games 1000] [--seed 1] [--json] [--emission-pos 1-10]
//   --games         nombre de parties (graine de la partie i : seed * 1000003 + i)
//   --seed          graine du banc : même graine, même rapport
//   --json          rapport en JSON au lieu du texte
//   --emission-pos  place l'Émission à cette position du paquet Zone (1 = première carte
//                   piochée) juste après createGame, pour essayer une autre position que le
//                   dernier tiers. DRAW_EVERY (pioche tous les 3 PA) ne se surcharge pas
//                   d'ici : c'est une constante du module zone.js que step lit directement.
//
// API : playGame(seed, { emissionPos }) -> { outcome, apLeft, actions, emission }
//       runBench({ games, seed, emissionPos }) -> rapport
//       formatReport(rapport) -> texte
//
// Le banc n'utilise que createGame et step. Une partie s'arrête quand outcome est posé ;
// sinon, plafond de MAX_ACTIONS actions (refus compris) ou plus aucune action acceptée :
// cause 'stuck'.

import { createGame, step } from '../src/engine/game.js';
import agroprom from '../src/engine/data/agroprom.js';
import { nextAction } from './ai.js';

export const MAX_ACTIONS = 200;
const SEED_STRIDE = 1000003;

export function playGame(seed, { emissionPos = null } = {}) {
  let state = createGame({ seed, tile: agroprom });
  if (emissionPos != null) state = placeEmission(state, emissionPos);
  let draws = 0;
  let emission = null;
  let refused = [];
  let actions = 0;

  while (!state.outcome && actions < MAX_ACTIONS) {
    const action = nextAction(state, refused);
    if (!action) break;
    actions += 1;
    const result = step(state, action);
    if (result.events[0]?.type === 'refused') {
      refused.push(action);
      continue;
    }
    refused = [];
    state = result.state;
    for (const event of result.events) {
      if (event.type !== 'zone-card') continue;
      draws += 1;
      if (event.card === 'emission') emission = { draw: draws, apSpent: state.ap.spent };
    }
  }

  const outcome = state.outcome ?? { result: 'loss', cause: 'stuck', score: 0 };
  return { outcome, apLeft: state.ap.left, actions, emission };
}

function placeEmission(state, position) {
  const deck = state.zone.deck.filter((card) => card !== 'emission');
  deck.splice(position - 1, 0, 'emission');
  return { ...state, zone: { ...state.zone, deck } };
}

export function runBench({ games = 1000, seed = 1, emissionPos = null } = {}) {
  const records = [];
  for (let i = 0; i < games; i++) records.push(playGame((seed * SEED_STRIDE + i) >>> 0, { emissionPos }));

  const causes = {};
  for (const { outcome } of records) causes[outcome.cause] = (causes[outcome.cause] ?? 0) + 1;
  const emissions = records.filter((r) => r.emission).map((r) => r.emission);

  return {
    games,
    seed,
    emissionPos,
    winRate: share(records.filter((r) => r.outcome.result === 'win').length, games),
    apLeftMean: mean(records.map((r) => r.apLeft)),
    causes,
    emission: {
      rate: share(emissions.length, games),
      drawMean: emissions.length ? mean(emissions.map((e) => e.draw)) : null,
      apSpentMean: emissions.length ? mean(emissions.map((e) => e.apSpent)) : null,
    },
    scoreMean: mean(records.map((r) => r.outcome.score)),
    actionsMax: Math.max(...records.map((r) => r.actions)),
  };
}

const mean = (values) => round(values.reduce((a, b) => a + b, 0) / values.length);
const share = (count, total) => round(count / total);
const round = (x) => Math.round(x * 1000) / 1000;
const percent = (x) => `${(x * 100).toFixed(1)} %`;

export function formatReport(report) {
  const { games, seed, emissionPos, emission } = report;
  const lines = [
    `Banc Le Boulon : ${games} parties, graine ${seed}${emissionPos ? `, Émission en position ${emissionPos}` : ''}`,
    `Victoires             ${percent(report.winRate)}`,
    `PA restants (fin)     ${report.apLeftMean}`,
    `Score moyen           ${report.scoreMean} roubles`,
    'Causes de fin :',
    ...Object.entries(report.causes)
      .sort((a, b) => b[1] - a[1])
      .map(([cause, count]) => `  ${cause.padEnd(18)}  ${String(count).padStart(5)}  ${percent(count / games)}`),
    `Émission sortie       ${percent(emission.rate)}`,
  ];
  if (emission.drawMean != null) {
    lines.push(`  pioche n° moyenne   ${emission.drawMean}`, `  PA dépensés moyens  ${emission.apSpentMean}`);
  }
  lines.push(`Actions max / partie  ${report.actionsMax} (plafond ${MAX_ACTIONS})`);
  return lines.join('\n');
}

function parseArgs(argv) {
  const options = { games: 1000, seed: 1, json: false, emissionPos: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--games') options.games = Number(argv[++i]);
    else if (arg === '--seed') options.seed = Number(argv[++i]);
    else if (arg === '--emission-pos') options.emissionPos = Number(argv[++i]);
    else throw new Error(`option inconnue : ${arg}`);
  }
  return options;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { json, ...options } = parseArgs(process.argv.slice(2));
  const report = runBench(options);
  console.log(json ? JSON.stringify(report, null, 2) : formatReport(report));
}
