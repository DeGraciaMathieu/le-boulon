// Factions et réputation (brief v2 §9, §5.4, §6.2 ; carte 16). Contenu : src/content/factions.js.
//
// RÉPUTATION : campaign.reputation[faction] de -3 à +3, posée au départ par startingReputation()
// (createCampaign). Une faction absente de la piste vaut 0 ; une faction inconnue lève une
// erreur (faute de contenu).
//   Paliers (STANDINGS) : -3 et -2 hostile, -1 à +1 neutre, +2 amical, +3 allié.
//   Hypothèse v2 : l'attitude de départ du §9 donne la valeur hostile -2, neutre 0, amical +2.
//
// LECTURE (pure) :
//   reputationOf(campaign, faction) -> -3..3       tierOf(valeur) -> palier
//   standing(campaign, faction)     -> palier       isMember(campaign, faction) -> bool
//   memberPerks(campaign, faction)  -> { freeBed, allyPrices, factionContracts }
//     Rejoindre le Devoir ou Liberté donne les trois (§9). Hypothèse v2 : les Solitaires,
//     faction par défaut, ne donnent que le lit gratuit dans leur hub (§4.3).
//
// HOOKS POUR LES CARTES SUIVANTES (purs, la carte appelante applique) :
//   priceModifier(campaign, faction) -> { buy, sell } | null (refus)       carte 13 Marchands
//     Table du §6.2 (PRICE_MODIFIERS) par palier ; prix d'allié pour un membre (allyPrices).
//     Le savoir-faire Marchandeur (§11.2, un cran de plus) reste à la carte 13 :
//     PRICE_MODIFIERS[STANDINGS[i + 1]].
//   placeAccess(campaign, faction | null) -> { free, options }             carte 10 Lieux
//     Lieu non tenu ou en bons termes : { free: true, options: [] }. Sinon
//     options = ['combattre', 'se-faufiler', 'payer'] (§5.4).
//     Hypothèse v2 : « en bons termes » = amical, allié ou membre ; neutre ne suffit pas.
//   encounterStance(campaign, faction) -> 'echange' | 'combat'             carte 18 Rencontres
//     Patrouille amicale (amical, allié ou membre) : échange au lieu du combat (§9).
//
// ÉCRITURE (sur un brouillon, comme un handler) :
//   changeReputation(draft, faction, amount, ctx)   piste bornée -3..3 -> reputation-changed
//   joinFaction(draft, faction, ctx) -> raison | undefined
//     Rejoindre le Devoir ou Liberté : player.faction = faction, le rival passe à -2.
//     La piste de la faction rejointe ne bouge pas (le §9 n'en dit rien).
//     Refus : 'unknown-faction' | 'not-joinable' (ni Devoir ni Liberté) | 'already-member'
//             | 'already-joined' (déjà au Devoir ou à Liberté) | 'hostile'
//     Hypothèse v2 : on ne rejoint pas une faction hostile. La condition « acte 4 » est portée
//     par le dialogue ou la quête qui propose l'adhésion (carte 15), pas ici.
//
// ACTION DE CAMPAGNE (CAMPAIGN_ACTIONS de campaign.js) : { type: 'join', faction } -> joinFaction.
// EFFETS DE DIALOGUE (EFFECTS de dialogue.js) : { type: 'reputation', faction, montant }
//   -> changeReputation ; { type: 'rejoindre-faction', faction } -> joinFaction.
//
// ÉVÉNEMENTS :
//   { type: 'reputation-changed', faction, amount, reputation }   amount : montant demandé
//   { type: 'faction-joined', faction, previous }

import content from '../../content/index.js';

export const REPUTATION_MIN = -3;
export const REPUTATION_MAX = 3;

export const STANDINGS = Object.freeze(['hostile', 'neutre', 'amical', 'allie']);

// Hypothèse v2 : valeur de départ de chaque attitude du §9.
const STARTING_VALUES = Object.freeze({ hostile: -2, neutre: 0, amical: 2 });

const RIVAL_REPUTATION = -2;

export const PRICE_MODIFIERS = Object.freeze({
  hostile: null,
  neutre: Object.freeze({ buy: 1, sell: 0.5 }),
  amical: Object.freeze({ buy: 0.9, sell: 0.6 }),
  allie: Object.freeze({ buy: 0.8, sell: 0.7 }),
});

const BLOCKED_PLACE_OPTIONS = Object.freeze(['combattre', 'se-faufiler', 'payer']);

function factionData(faction) {
  const data = content.factions[faction];
  if (!data) throw new Error(`faction inconnue : ${faction}`);
  return data;
}

export function startingReputation() {
  const reputation = {};
  for (const { id, attitude } of Object.values(content.factions)) reputation[id] = STARTING_VALUES[attitude];
  return reputation;
}

export function tierOf(value) {
  if (value <= -2) return 'hostile';
  if (value <= 1) return 'neutre';
  if (value === 2) return 'amical';
  return 'allie';
}

export function reputationOf(campaign, faction) {
  factionData(faction);
  return campaign.reputation[faction] ?? 0;
}

export function standing(campaign, faction) {
  return tierOf(reputationOf(campaign, faction));
}

export function isMember(campaign, faction) {
  return campaign.player.faction === faction;
}

export function memberPerks(campaign, faction) {
  const member = isMember(campaign, faction);
  const joined = member && factionData(faction).rejoignable === true;
  return { freeBed: member, allyPrices: joined, factionContracts: joined };
}

function onGoodTerms(campaign, faction) {
  return isMember(campaign, faction) || ['amical', 'allie'].includes(standing(campaign, faction));
}

export function priceModifier(campaign, faction) {
  if (memberPerks(campaign, faction).allyPrices) return PRICE_MODIFIERS.allie;
  return PRICE_MODIFIERS[standing(campaign, faction)];
}

export function placeAccess(campaign, faction) {
  if (!faction || onGoodTerms(campaign, faction)) return { free: true, options: [] };
  return { free: false, options: [...BLOCKED_PLACE_OPTIONS] };
}

export function encounterStance(campaign, faction) {
  return onGoodTerms(campaign, faction) ? 'echange' : 'combat';
}

export function changeReputation(draft, faction, amount, ctx) {
  const before = reputationOf(draft, faction);
  setReputation(draft, faction, before + amount, amount, ctx);
}

function setReputation(draft, faction, value, amount, ctx) {
  const reputation = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, value));
  draft.reputation[faction] = reputation;
  ctx.emit({ type: 'reputation-changed', faction, amount, reputation });
}

export function joinFaction(draft, faction, ctx) {
  const data = content.factions[faction];
  if (!data) return 'unknown-faction';
  if (data.rejoignable !== true) return isMember(draft, faction) ? 'already-member' : 'not-joinable';
  if (isMember(draft, faction)) return 'already-member';
  if (factionData(draft.player.faction).rejoignable === true) return 'already-joined';
  if (standing(draft, faction) === 'hostile') return 'hostile';

  const previous = draft.player.faction;
  const rivalBefore = reputationOf(draft, data.rival);
  setReputation(draft, data.rival, RIVAL_REPUTATION, RIVAL_REPUTATION - rivalBefore, ctx);
  draft.player.faction = faction;
  ctx.emit({ type: 'faction-joined', faction, previous });
}

export function join(draft, action, ctx) {
  return joinFaction(draft, action.faction, ctx);
}
