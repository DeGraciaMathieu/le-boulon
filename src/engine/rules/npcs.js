// PNJ (brief v2 §7, §6.1, §10.1 ; carte 19). Contenu : src/content/pnj.js et
// src/content/dialogues/<pnj>.js.
//
// CONTENU (collection npcs de src/content/validate.js) :
//   { [npcId]: { name, faction, place, dialogue, role?, tile?, places? } }
//   place   lieu fixe ; null pour un itinérant, qui porte alors tile et places (lieux de sa
//           tuile entre lesquels il se déplace, il part de places[0]).
//   role    'marchand' | 'barman' | 'medecin' | 'technicien' (services du §6.1) | 'stalker'.
//   Un PNJ hors d'un lieu tagué 'hub' est un isolé (losange du §3.3) : il peut mourir.
//
// ÉTAT : campaign.npcs[id] = { alive, tile, place, met, helped }, posé par startingNpcs()
// (createCampaign). place : lieu où il se tient ; met : déjà rencontré ; helped : aidé
// (effet 'aider'), un isolé aidé ne meurt plus.
//
// ACTION DE CAMPAGNE : { type: 'talk', npc } -> talkTo, qui enveloppe talk de rules/dialogue.js.
//   Pour un PNJ de content.npcs : refus 'npc-dead' | 'npc-not-here' (le joueur n'est pas sur
//   l'hexagone du lieu du PNJ), puis talk. Première rencontre : met = true, événement
//   npc-met, et campaign.dialogue.firstVisit = true le temps de ce dialogue.
//   Un PNJ hors contenu (DIALOGUES des tests) passe directement à talk.
//
// DIALOGUES : condition { type: 'premiere-visite' } (vraie pendant le dialogue d'une première
// rencontre) ; effet { type: 'aider', npc } (helped = true -> npc-helped).
//
// HOOKS (sur un brouillon, comme un handler) :
//   moveNpcs(draft, ctx)                        carte 7, au changement de jour
//     Chaque itinérant vivant change de lieu avec la chance MOVE_CHANCE -> npc-moved.
//   endangerNpcs(draft, ctx, { cause, tile? })  carte 8 (cause 'emission'), rencontres
//     ('rencontre', tile : la tuile de la rencontre). Chaque isolé vivant non aidé et non
//     protégé (de la tuile si elle est donnée) meurt avec la chance DEATH_CHANCE[cause]
//     -> npc-died.
//
// PNJ PROTÉGÉS (LBL-52, décision de Mathieu) : un PNJ nécessaire à une étape encore à venir de
//   la quête principale ne meurt pas. Étapes à venir : l'étape courante et celles qu'on atteint
//   par next ; toutes, plus le donneur, tant que la quête n'est pas prise ; aucune une fois
//   finie ou ratée. PNJ d'une étape : celui de son objectif, et ceux dont un choix de dialogue
//   porte la condition quete de cette étape (Vovk, a3-usine).
//
// LECTURE (pure) : npcsAt(campaign, place) -> ids des PNJ vivants du lieu ;
//   isIsolated(npcId) -> bool ; protectedNpcs(campaign) -> Set des PNJ protégés.
//
// ÉVÉNEMENTS : { type: 'npc-met', npc }  { type: 'npc-helped', npc }
//   { type: 'npc-moved', npc, from, to }  { type: 'npc-died', npc, cause }

import content from '../../content/index.js';
import { talk, CONDITIONS, EFFECTS } from './dialogue.js';

// Hypothèse v2 : le brief dit « parfois » sans chiffre.
export const MOVE_CHANCE = 1 / 3;
// Hypothèse v2 : le brief dit « peuvent mourir » sans chiffre.
export const DEATH_CHANCE = Object.freeze({ emission: 1 / 4, rencontre: 1 / 6 });

const MAIN_QUEST = 'le-guide';

const npcsOf = () => content.npcs ?? {};

export function startingNpcs(npcs = npcsOf()) {
  return Object.fromEntries(Object.entries(npcs).map(([id, npc]) => {
    const place = npc.place ?? npc.places?.[0] ?? null;
    const tile = place ? content.places[place].tile : npc.tile;
    return [id, { alive: true, tile, place, met: false, helped: false }];
  }));
}

export function isIsolated(npcId) {
  const npc = npcsOf()[npcId];
  return npc.place === null || !content.places[npc.place].tags.includes('hub');
}

export function npcsAt(campaign, place) {
  return Object.entries(campaign.npcs)
    .filter(([, state]) => state.alive && state.place === place)
    .map(([id]) => id);
}

export function protectedNpcs(campaign) {
  const quest = content.quests?.[MAIN_QUEST];
  const state = campaign.quests?.[MAIN_QUEST];
  if (!quest || (state && state.status !== 'active')) return new Set();
  const ids = new Set(state ? [] : [quest.giver]);
  for (const stepId of stepsAhead(quest, state?.step ?? quest.start)) {
    for (const id of stepNpcs(quest).get(stepId) ?? []) ids.add(id);
  }
  return ids;
}

export function talkTo(draft, action, ctx) {
  const npc = npcsOf()[action.npc];
  if (!npc) return talk(draft, action, ctx);

  const state = draft.npcs[action.npc];
  if (!state.alive) return 'npc-dead';
  if (!isHere(draft, state)) return 'npc-not-here';

  const refusal = talk(draft, action, ctx);
  if (refusal) return refusal;
  if (!state.met) {
    state.met = true;
    draft.dialogue.firstVisit = true;
    ctx.emit({ type: 'npc-met', npc: action.npc });
  }
}

export function moveNpcs(draft, ctx) {
  for (const [id, npc] of Object.entries(npcsOf())) {
    const state = draft.npcs[id];
    if (npc.place !== null || !state.alive) continue;
    const others = npc.places.filter((place) => place !== state.place);
    if (others.length === 0 || ctx.rng.next() >= MOVE_CHANCE) continue;
    const from = state.place;
    state.place = ctx.rng.pick(others);
    ctx.emit({ type: 'npc-moved', npc: id, from, to: state.place });
  }
}

export function endangerNpcs(draft, ctx, { cause, tile }) {
  const chance = DEATH_CHANCE[cause];
  if (chance === undefined) throw new Error(`cause inconnue : ${cause}`);
  const spared = protectedNpcs(draft);
  for (const id of Object.keys(npcsOf())) {
    const state = draft.npcs[id];
    if (!state.alive || state.helped || spared.has(id) || !isIsolated(id)) continue;
    if (tile !== undefined && state.tile !== tile) continue;
    if (ctx.rng.next() >= chance) continue;
    state.alive = false;
    ctx.emit({ type: 'npc-died', npc: id, cause });
  }
}

function stepsAhead(quest, from) {
  const ahead = new Set([from]);
  for (const stepId of ahead) for (const next of quest.steps[stepId].next ?? []) ahead.add(next);
  return ahead;
}

// step -> PNJ de l'étape, calculé une fois (le contenu est figé).
let questNpcs;
function stepNpcs(quest) {
  if (questNpcs) return questNpcs;
  questNpcs = new Map(Object.keys(quest.steps).map((stepId) => [stepId, new Set()]));
  for (const [stepId, { objective }] of Object.entries(quest.steps)) {
    if (objective.npc) questNpcs.get(stepId).add(objective.npc);
  }
  for (const [id, npc] of Object.entries(npcsOf())) {
    for (const node of Object.values(content.dialogues[npc.dialogue].nodes)) {
      for (const condition of (node.choices ?? []).flatMap((choice) => choice.conditions ?? [])) {
        if (condition.type === 'quete' && condition.quest === MAIN_QUEST && condition.step) {
          questNpcs.get(condition.step).add(id);
        }
      }
    }
  }
  return questNpcs;
}

function isHere(campaign, state) {
  const place = content.places[state.place];
  return campaign.world.currentTile === state.tile && campaign.world.hex === place.hex;
}

CONDITIONS['premiere-visite'] = (condition, campaign) => campaign.dialogue?.firstVisit === true;

EFFECTS.aider = (draft, effect, ctx) => {
  const state = draft.npcs[effect.npc];
  if (!state) return 'unknown-npc';
  state.helped = true;
  ctx.emit({ type: 'npc-helped', npc: effect.npc });
};
