// Tutoriel joué du jour 1 (direction plateau, lot L8 ; proposition §5 outil 4) : six étapes sur le
// Cordon, chacune validée par des événements du moteur. Une étape faite dans le désordre est
// validée quand même. Pures : pas de DOM (testées par tests/tutoriel.test.js). Vue : tutoriel-view.js.
//
//   STEPS  [{ id, needs, mutes, already?, target(ctx), text }]  dans l'ordre du tutoriel
//     needs   suite de filtres d'événement, à rencontrer dans l'ordre (sur un ou plusieurs steps)
//     mutes   ids des bulles « une seule fois » de L7 (bulles.js) qui doublonnent l'étape
//     already(campaign)  l'étape est déjà acquise par l'état (reprise sur une partie avancée)
//     target(ctx) -> [sélecteur CSS]  objets à pointer, le premier visible l'emporte
//     ctx : { campaign, day }  la campagne et dayState(campaign)
//   startTutorial(progress?, campaign?) -> progress   actif, étapes déjà faites gardées
//   advance(progress, events, campaign?) -> progress  avance chaque étape non faite
//   skipTutorial(progress) -> progress                « Passer le tutoriel »
//   currentStep(progress) -> null | { step, number, total }  première étape non faite, si actif
//   readProgress(storage, seed) / saveProgress(storage, seed, progress)   par campagne (graine),
//     en localStorage sous try/catch
//   readSetting(storage) / saveSetting(storage, on)   case « Tutoriel » de l'écran titre (vrai par défaut)
//
// progress : { active, steps: { [id]: nombre de filtres de needs déjà rencontrés } }

import { distance, neighbors } from '../engine/hex.js';
import { BOLT_COST } from '../engine/rules/suspects.js';
import { EXPLORE_COST } from '../engine/rules/places.js';
import content from '../content/index.js';
import { CHECK_TARGET } from './aide.js';

export const TUTORIAL_KEY = 'le-boulon.tutoriel';
export const SETTING_KEY = 'le-boulon.tutoriel.reglage';

const MAIN_QUEST = 'le-guide';
const CAMP = content.places['camp-novices'].hex;
const ATP = content.places.atp.hex;
const CARDS = 3;

const is = (type, extra = () => true) => (event) => event.type === type && extra(event);
const onTile = ({ campaign }) => campaign.screen === 'tile';
const hexOf = (n) => `#plateau polygon[data-hex="${n}"]`;

const nearest = (list, from) => [...list].sort((a, b) => distance(from, a.hex) - distance(from, b.hex))[0];

export const STEPS = Object.freeze([
  {
    id: 'marchand',
    needs: [is('quest-started', (e) => e.quest === MAIN_QUEST)],
    mutes: [],
    already: (campaign) => Boolean(campaign?.quests?.[MAIN_QUEST]),
    target: ({ campaign }) => (campaign.dialogue
      ? ['.fenetre-dialogue .cadre-fenetre', '.fenetre-dialogue']
      : ['#commandes .donneur', hexOf(CAMP), '#objectif']),
    text: 'Le Marchand du bunker a du travail. Parlez-lui et demandez « Tu as du travail ? » : il vous confie Le Guide, la quête qui mène au fond de la Zone.',
  },
  {
    id: 'boulon',
    needs: [is('bolt-thrown'), is('token-revealed', (e) => e.by === 'bolt')],
    mutes: ['suspect'],
    target: ({ campaign, day }) => {
      if (!onTile({ campaign })) return [];
      const close = (day.tokens ?? []).filter((t) => !t.revealed && neighbors(day.player.hex).includes(t.hex));
      const token = nearest(close, day.player.hex) ?? nearest((day.tokens ?? []).filter((t) => !t.revealed), day.player.hex);
      return [token && hexOf(token.hex), '#commandes .boulon'].filter(Boolean);
    },
    text: `Un « ? » cache une anomalie, un artefact ou rien. Lancez un boulon dessus (${BOLT_COST} PA, clic droit sur la case voisine) : il le révèle sans risque.`,
  },
  {
    id: 'discretion',
    needs: [is('moved'), is('check')],
    mutes: ['test', 'rencontre'],
    target: ({ campaign, day }) => {
      if (!onTile({ campaign })) return ['section.bac'];
      const encounter = nearest((day.encounters ?? []).filter((e) => e.card === null), day.player.hex);
      return [encounter && hexOf(encounter.hex), '#plateau .pion', 'section.bac'].filter(Boolean);
    },
    text: `Avancez d'une case vers un « ! ». À côté d'une rencontre, la Zone teste votre Discrétion : 1d6 + Discrétion ≥ ${CHECK_TARGET}. Le dé roule dans le bac, sous la carte du monde.`,
  },
  {
    id: 'atp',
    needs: Array.from({ length: CARDS }, () => is('place-card')),
    mutes: [],
    target: ({ campaign }) => (campaign.screen === 'place'
      ? ['#lieu .lieu-boutons button:first-child', '#lieu .lieu-paquet .dos', '#lieu']
      : [hexOf(ATP), '#commandes .suivie']),
    text: `L'ATP, le dépôt militaire, est un repaire. Entrez-y (clic sur le pion posé dessus), puis explorez : chaque exploration (${EXPLORE_COST} PA) tire une carte du paquet. Tirez-en ${CARDS}.`,
  },
  {
    id: 'bandage',
    needs: [is('used', (e) => e.item === 'bandage')],
    mutes: [],
    target: () => ['#fiche .soin[data-kind="bandage"]', '#commandes .soins'],
    text: 'Chaque blessure pèse sur vos PA. Un bandage en soigne une pour 1 PA : cliquez-le sur la ceinture de votre fiche.',
  },
  {
    id: 'dormir',
    needs: [is('day-ended', (e) => e.reason === 'sleep')],
    mutes: ['pa-bas'],
    target: ({ campaign }) => (campaign.screen === 'hub'
      ? ['#hub .hub-onglets', '#hub']
      : [hexOf(CAMP), '#commandes .suivie', '#commandes']),
    text: 'Rentrez au Camp des novices avant la nuit. Dans le hub, l’onglet Dormir finit la journée : −1 blessure, pas de carte Nuit, réveil à l’abri.',
  },
]);

const blank = () => ({ active: false, steps: Object.fromEntries(STEPS.map(({ id }) => [id, 0])) });

const isDone = (progress, step) => (progress.steps[step.id] ?? 0) >= step.needs.length;

export function startTutorial(progress = blank(), campaign = null) {
  const steps = { ...blank().steps, ...progress.steps };
  for (const step of STEPS) if (step.already?.(campaign)) steps[step.id] = step.needs.length;
  return { active: true, steps };
}

export function advance(progress, events, campaign = null) {
  if (!progress.active) return progress;
  const steps = { ...progress.steps };
  for (const step of STEPS) {
    let count = steps[step.id] ?? 0;
    for (const event of events) {
      if (count < step.needs.length && step.needs[count](event)) count += 1;
    }
    if (step.already?.(campaign)) count = step.needs.length;
    steps[step.id] = count;
  }
  const active = STEPS.some((step) => steps[step.id] < step.needs.length);
  return { active, steps };
}

export function skipTutorial(progress) {
  return { ...progress, active: false };
}

export function currentStep(progress) {
  if (!progress?.active) return null;
  const index = STEPS.findIndex((step) => !isDone(progress, step));
  return index === -1 ? null : { step: STEPS[index], number: index + 1, total: STEPS.length };
}

const keyOf = (seed) => `${TUTORIAL_KEY}.${seed}`;

export function readProgress(storage, seed) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(keyOf(seed)) ?? 'null');
    return saved && typeof saved.steps === 'object' ? { active: Boolean(saved.active), steps: { ...blank().steps, ...saved.steps } } : null;
  } catch {
    return null;
  }
}

export function saveProgress(storage, seed, progress) {
  try {
    (storage ?? globalThis.localStorage).setItem(keyOf(seed), JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function readSetting(storage) {
  try {
    return (storage ?? globalThis.localStorage).getItem(SETTING_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveSetting(storage, on) {
  try {
    (storage ?? globalThis.localStorage).setItem(SETTING_KEY, on ? 'on' : 'off');
    return true;
  } catch {
    return false;
  }
}
