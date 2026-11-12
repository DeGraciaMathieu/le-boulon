// Banc de campagne (brief v2 §17.3) : fait jouer N campagnes de 30 jours à chaque IA de
// bench/campaign-ai.js (prudente, gourmande) et mesure ce que vise le §17.3.
//
// USAGE : npm run bench:campagne -- [options]   (ou node bench/campaign.js [options])
//         node bench/campaign.js [--campaigns 50] [--days 30] [--seed 1] [--profile prudente]
//                                [--json]
//   --campaigns  campagnes par IA (graine de la campagne i : seed * 1000003 + i, la même pour
//                les deux IA)
//   --days       jours joués par campagne
//   --seed       graine du banc : même graine, même rapport
//   --profile    une seule IA (prudente | gourmande) ; les deux par défaut
//   --json       rapport en JSON au lieu du texte
//
// API : playCampaign(seed, profile, { days }) -> relevé d'une campagne (voir record ci-dessous)
//       runCampaignBench({ campaigns, days, seed, profiles }) -> rapport
//       formatCampaignReport(rapport) -> texte
//
// Le banc n'utilise que createCampaign et step, en combat 'rapide' (résolution v1). Une
// campagne s'arrête au matin du jour days + 1, à la mort (le moteur n'a pas encore la
// réapparition du §15 : la mort finit la campagne), ou bloquée (aucune action acceptée).
// Garde-fou : au-delà de MAX_ACTIONS_PER_DAY actions dans la journée, le banc force la fin de
// journée (sortie du lieu ou du hub, bivouac) et le compte dans forcedNights.

import { createCampaign, step, dayState } from '../src/engine/campaign.js';
import content from '../src/content/index.js';
import { usedSlots, inventorySlots } from '../src/engine/rules/equipment.js';
import { candidates, createMind, PROFILES, MAIN_QUEST } from './campaign-ai.js';

export const DAYS = 30;
export const MAX_ACTIONS_PER_DAY = 300;
const SEED_STRIDE = 1000003;
const ACTS = 5;
const FORCE_NIGHT = [{ type: 'leave-place' }, { type: 'leave-hub' }, { type: 'flee' }, { type: 'escape' }, { type: 'camp' }, { type: 'wake' }];

// Cibles de départ du §17.3.
export const TARGETS = Object.freeze({
  act1Days: [4, 7],
  deathsPer10DaysPrudente: 1,
  shoulderWeaponDay: [8, 12],
});

export function playCampaign(seed, profileId, { days = DAYS } = {}) {
  const profile = PROFILES[profileId];
  const mind = createMind(profile);
  let campaign = createCampaign({ seed, combatMode: 'rapide' });
  const record = {
    seed,
    profile: profileId,
    end: 'days',
    deathDay: null,
    deathCause: null,
    roubles: [campaign.player.roubles],
    acts: {},
    shoulderWeaponDay: null,
    hubFill: [],
    placesEmptied: 0,
    emissions: 0,
    emissionsCaught: 0,
    questsDone: 0,
    questsFailed: 0,
    fights: 0,
    actions: 0,
    forcedNights: 0,
  };
  let refused = [];
  let actionsToday = 0;

  while (campaign.day <= days) {
    const forced = actionsToday >= MAX_ACTIONS_PER_DAY;
    const list = forced ? FORCE_NIGHT : candidates(campaign, mind);
    const action = list.find((a) => !refused.some((r) => same(r, a)));
    if (!action) {
      record.end = 'stuck';
      break;
    }
    record.actions += 1;
    actionsToday += 1;
    const result = step(campaign, action);
    if (result.events[0]?.type === 'refused') {
      refused.push(action);
      continue;
    }
    if (forced) {
      record.forcedNights += 1;
      actionsToday = 0;
    }
    refused = [];
    const before = campaign.day;
    campaign = result.state;
    note(record, campaign, result.events);
    if (campaign.day !== before) {
      actionsToday = 0;
      if (campaign.day <= days) record.roubles.push(campaign.player.roubles);
    }
    if (dayState(campaign).status === 'dead') {
      record.end = 'dead';
      record.deathDay = campaign.day;
      break;
    }
  }

  record.days = Math.min(campaign.day, days);
  record.finalRoubles = campaign.player.roubles;
  record.rank = campaign.player.rank;
  record.xp = campaign.player.xp;
  record.questStep = campaign.quests[MAIN_QUEST]?.step ?? null;
  return record;
}

function note(record, campaign, events) {
  for (const event of events) {
    if (event.type === 'died') record.deathCause ??= event.cause;
    else if (event.type === 'quest-step' && event.quest === MAIN_QUEST) {
      const act = Number(event.step.match(/^a(\d)-/)?.[1]);
      for (let a = 1; a < act; a++) record.acts[a] ??= campaign.day;
    } else if (event.type === 'quest-completed' && event.quest === MAIN_QUEST) {
      for (let a = 1; a <= ACTS; a++) record.acts[a] ??= campaign.day;
    } else if (event.type === 'quest-failed') record.questsFailed += 1;
    else if (event.type === 'item-bought' && content.items[event.item].category === 'arme-epaule') {
      record.shoulderWeaponDay ??= campaign.day;
    } else if (event.type === 'hub-entered') {
      record.hubFill.push(usedSlots(campaign.inventory) / inventorySlots(campaign));
    } else if (event.type === 'place-emptied') record.placesEmptied += 1;
    else if (event.type === 'emission-aftermath') record.emissions += 1;
    else if (event.type === 'emission-caught') record.emissionsCaught += 1;
    else if (event.type === 'emission-night' && !event.sheltered) record.emissionsCaught += 1;
    else if (event.type === 'fight' || event.type === 'combat-started') record.fights += 1;
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function runCampaignBench({ campaigns = 50, days = DAYS, seed = 1, profiles = Object.keys(PROFILES) } = {}) {
  const report = { campaigns, days, seed, targets: TARGETS, profiles: {} };
  for (const profile of profiles) {
    const records = [];
    for (let i = 0; i < campaigns; i++) records.push(playCampaign((seed * SEED_STRIDE + i) >>> 0, profile, { days }));
    report.profiles[profile] = summarize(records, days);
  }
  return report;
}

function summarize(records, days) {
  const n = records.length;
  const dead = records.filter((r) => r.end === 'dead');
  const daysPlayed = records.reduce((total, r) => total + r.days, 0);
  const weeks = Math.ceil(days / 7);
  const deathsByWeek = Array.from({ length: weeks }, (_, w) => {
    const alive = records.filter((r) => r.end !== 'dead' || r.deathDay > w * 7).length;
    const died = dead.filter((r) => Math.ceil(r.deathDay / 7) === w + 1).length;
    return { week: w + 1, alive, died, rate: alive ? round(died / alive) : null };
  });
  const acts = {};
  for (let a = 1; a <= ACTS; a++) {
    const doneDays = records.map((r) => r.acts[a]).filter((d) => d != null);
    acts[a] = { rate: round(doneDays.length / n), dayMean: meanOrNull(doneDays), dayMin: min(doneDays), dayMax: max(doneDays) };
  }
  const roublesCurve = {};
  for (let d = 1; d <= days; d++) {
    const values = records.map((r) => r.roubles[d - 1]).filter((v) => v != null);
    if (values.length) roublesCurve[d] = meanOrNull(values);
  }
  const shoulder = records.map((r) => r.shoulderWeaponDay).filter((d) => d != null);
  return {
    campaigns: n,
    survival: round((n - dead.length) / n),
    deathsPer10Days: round((dead.length / daysPlayed) * 10),
    deathsByWeek,
    deathCauses: countBy(dead, (r) => r.deathCause ?? 'inconnue'),
    stuck: records.filter((r) => r.end === 'stuck').length,
    roublesCurve,
    finalRoubles: meanOrNull(records.map((r) => r.finalRoubles)),
    ranks: countBy(records, (r) => r.rank),
    acts,
    questSteps: countBy(records, (r) => r.questStep ?? 'non commencée'),
    shoulderWeapon: { rate: round(shoulder.length / n), dayMean: meanOrNull(shoulder), dayMin: min(shoulder), dayMax: max(shoulder) },
    hubFill: meanOrNull(records.flatMap((r) => r.hubFill)),
    placesEmptied: meanOrNull(records.map((r) => r.placesEmptied)),
    emissions: meanOrNull(records.map((r) => r.emissions)),
    emissionsCaught: meanOrNull(records.map((r) => r.emissionsCaught)),
    questsDone: meanOrNull(records.map((r) => r.questsDone)),
    questsFailed: meanOrNull(records.map((r) => r.questsFailed)),
    fights: meanOrNull(records.map((r) => r.fights)),
    forcedNights: records.reduce((total, r) => total + r.forcedNights, 0),
    actionsMean: meanOrNull(records.map((r) => r.actions)),
  };
}

function countBy(records, key) {
  const counts = {};
  for (const r of records) counts[key(r)] = (counts[key(r)] ?? 0) + 1;
  return counts;
}

const round = (x) => Math.round(x * 1000) / 1000;
const meanOrNull = (values) => (values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null);
const min = (values) => (values.length ? Math.min(...values) : null);
const max = (values) => (values.length ? Math.max(...values) : null);
const percent = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)} %`);
const range = ({ dayMean, dayMin, dayMax }) => (dayMean == null ? '—' : `jour ${dayMean} (${dayMin} à ${dayMax})`);
const inRange = (value, [lo, hi]) => value != null && value >= lo && value <= hi;
const verdict = (ok) => (ok ? 'OK' : 'ÉCART');

export function formatCampaignReport(report) {
  const lines = [`Banc de campagne Le Boulon : ${report.campaigns} campagnes de ${report.days} jours par IA, graine ${report.seed}, combat rapide`];
  for (const [id, p] of Object.entries(report.profiles)) {
    lines.push(
      '',
      `== IA ${id}`,
      `Survie à ${report.days} jours    ${percent(p.survival)}   morts / 10 jours ${p.deathsPer10Days}`,
      `Morts par semaine       ${p.deathsByWeek.map((w) => `S${w.week} ${percent(w.rate)}`).join('  ')}`,
      `Causes de mort          ${entries(p.deathCauses)}`,
      `Roubles (moyenne)       ${Object.entries(p.roublesCurve).filter(([d]) => d === '1' || d % 5 === 0).map(([d, v]) => `J${d} ${v}`).join('  ')}   fin ${p.finalRoubles}`,
      `Rangs en fin            ${entries(p.ranks)}`,
      'Quête principale :',
      ...Object.entries(p.acts).map(([a, act]) => `  acte ${a} fini         ${percent(act.rate).padStart(7)}   ${range(act)}`),
      `  étape en fin          ${entries(p.questSteps)}`,
      `Arme d'épaule achetée   ${percent(p.shoulderWeapon.rate)}   ${range(p.shoulderWeapon)}`,
      `Inventaire au retour    ${percent(p.hubFill)} de la grille`,
      `Lieux vidés             ${p.placesEmptied} par campagne`,
      `Émissions subies        ${p.emissions} par campagne, dont ${p.emissionsCaught} sans abri`,
      `Quêtes et contrats      ${p.questsDone} réussis, ${p.questsFailed} ratés par campagne`,
      `Combats                 ${p.fights} par campagne`,
      `Garde-fous              ${p.stuck} bloquées, ${p.forcedNights} nuits forcées, ${p.actionsMean} actions / campagne`,
    );
  }
  lines.push('', 'Cibles du §17.3 :');
  const { targets } = report;
  for (const [id, p] of Object.entries(report.profiles)) {
    lines.push(`  ${id.padEnd(10)} acte 1 en ${targets.act1Days.join(' à ')} jours : ${verdict(inRange(p.acts[1].dayMean, targets.act1Days))} (${range(p.acts[1])}, ${percent(p.acts[1].rate)} des campagnes)`);
    lines.push(`  ${''.padEnd(10)} arme d'épaule vers le jour ${targets.shoulderWeaponDay.join(' à ')} : ${verdict(inRange(p.shoulderWeapon.dayMean, targets.shoulderWeaponDay))} (${range(p.shoulderWeapon)}, ${percent(p.shoulderWeapon.rate)})`);
  }
  const prudente = report.profiles.prudente;
  if (prudente) {
    lines.push(`  prudente   moins de ${targets.deathsPer10DaysPrudente} mort / 10 jours : ${verdict(prudente.deathsPer10Days < targets.deathsPer10DaysPrudente)} (${prudente.deathsPer10Days})`);
  }
  return lines.join('\n');
}

function entries(counts) {
  const list = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return list.length ? list.map(([k, v]) => `${k} ${v}`).join(', ') : '—';
}

function parseArgs(argv) {
  const options = { campaigns: 50, days: DAYS, seed: 1, json: false, profiles: Object.keys(PROFILES) };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--campaigns') options.campaigns = Number(argv[++i]);
    else if (arg === '--days') options.days = Number(argv[++i]);
    else if (arg === '--seed') options.seed = Number(argv[++i]);
    else if (arg === '--profile') options.profiles = [argv[++i]];
    else throw new Error(`option inconnue : ${arg}`);
  }
  for (const profile of options.profiles) if (!PROFILES[profile]) throw new Error(`IA inconnue : ${profile}`);
  return options;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { json, ...options } = parseArgs(process.argv.slice(2));
  const report = runCampaignBench(options);
  console.log(json ? JSON.stringify(report, null, 2) : formatCampaignReport(report));
}
