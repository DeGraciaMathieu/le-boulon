// Progression (brief v2 §11.1, §11.2, carte 17) : XP, rangs, points de stat, savoir-faire.
// Catalogue des savoir-faire : src/content/savoir-faire.js (collection perks).
//
// ÉTAT (campaign.player, posé par createCampaign) :
//   xp, rank      XP cumulée, id du rang atteint (RANKS)
//   stats         { tir, survie, discretion, endurance }, 1 au départ (endurance 0), max 4
//   perks         [perkId] savoir-faire appris, dans l'ordre
//   dayState prête perks à la journée v1 (player.perks) ; storeDay ne les range pas dans la
//   tuile. Une journée v1 sans perks (createGame) n'a aucun savoir-faire.
//   Hypothèse v2 : les points de stat et les choix de savoir-faire restants se déduisent du
//   rang (1 de chaque par rang passé) moins ce qui est déjà dépensé ; aucune autre règle ne
//   change les stats ni les savoir-faire, pas de champ en plus dans l'état.
//
// LECTURE (pures, utilisables par l'UI) :
//   RANKS                         [{ id, xp }] seuils du §11.1 ; mêmes ids que dialogue.js
//   STATS, START_STATS, STAT_MAX  stats de la v1, valeurs de départ, maximum 4
//   rankOf(xp) -> id              rang atteint avec cette XP
//   statPointsLeft(campaign)      points de stat à dépenser
//   perkPicksLeft(campaign)       savoir-faire à choisir
//   hasPerk(state, id) -> bool    campagne ou journée v1 (player.perks)
//   stealthBonus(state, { night, rain })  Fantôme : +1 Discrétion la nuit ou sous la pluie
//
// GAIN D'XP (quêtes, contrats, découvertes, combats) :
//   gainXp(draft, n, cause, ctx)  n entier > 0, sinon erreur (faute de contenu) ; passe autant
//                                 de rangs que l'XP le permet. cause : 'quete' | 'contrat' |
//                                 'decouverte' | 'combat'… (texte libre, repris dans l'événement)
//   Les montants viennent des cartes qui l'appellent (récompenses de quête, contrats…).
//
// ACTIONS DE CAMPAGNE (CAMPAIGN_ACTIONS de src/engine/campaign.js), 0 PA, hors combat
// (hypothèse v2) :
//   { type: 'raise-stat', stat }  +1 à la stat. Endurance : +1 PA tout de suite au budget du
//                                 jour, max et restants (hypothèse v2), puis +1 PA par jour
//                                 (BASE_AP + endurance, game.js et carte 7).
//     Refus : 'in-combat' | 'unknown-stat' | 'no-stat-point' | 'stat-max'
//   { type: 'learn-perk', perk }  apprend un savoir-faire du catalogue.
//     Refus : 'in-combat' | 'unknown-perk' | 'no-perk-pick' | 'perk-known'
//
// ÉVÉNEMENTS :
//   { type: 'xp-gained', amount, cause, xp }   { type: 'rank-up', rank }
//   { type: 'stat-raised', stat, value }       { type: 'perk-learned', perk }
//
// SAVOIR-FAIRE BRANCHÉS (hasPerk dans la règle) :
//   pied-leger    forêt à 1 PA                   entryCost, src/engine/actions/move.js
//   bouliste      le boulon révèle aussi l'hexagone suivant en ligne, s'il est sur la tuile
//                                                bolt, rules/suspects.js
//   oeil-de-lynx  portée du détecteur +1, s'il y a un détecteur qui marche
//                                                scanWithDetector, rules/suspects.js
//   coriace       mort à 7 blessures (piste 0-7)  wound, rules/sheet.js
//   peau-dure     -1 radiation par gain, après l'armure et la ceinture
//                                                irradiate, rules/sheet.js
//   tireur        +1 Tir quand l'arme active est une arme d'épaule (hypothèse v2 : tout fusil
//                 du §12 est une arme d'épaule)  fight, rules/encounters.js
//   infirmier     le bandage soigne 2 blessures (pas la trousse)
//                                                use, rules/sheet.js
//   mule          +3 cases                       inventorySlots, rules/equipment.js
//   fantome       +1 Discrétion la nuit ou sous la pluie
//                                                conditionsBonus, rules/time.js (skillCheck)
// SAVOIR-FAIRE EXPOSÉS, À BRANCHER PAR LEUR CARTE :
//   fouilleur     carte 10 (lieux) : le premier « explorer » de chaque lieu coûte 0 PA si
//                 hasPerk(campaign, 'fouilleur') ; marquer le lieu dans places[id] (l'état du
//                 lieu dit si la gratuité est prise).
//   marchandeur   carte 13 (marchands) : priceModifier lit le palier un cran plus haut,
//                 STANDINGS[min(i + 1, max)] de rules/factions.js, si hasPerk(campaign,
//                 'marchandeur').
//   instinct      carte 8 (Émission) : au matin, si hasPerk(campaign, 'instinct') et
//                 world.emission.nextDay === day, annoncer l'Émission sans carte de signes.

import catalog from '../../content/savoir-faire.js';

export const RANKS = Object.freeze([
  Object.freeze({ id: 'bleu', xp: 0 }),
  Object.freeze({ id: 'experimente', xp: 150 }),
  Object.freeze({ id: 'veteran', xp: 400 }),
  Object.freeze({ id: 'expert', xp: 800 }),
  Object.freeze({ id: 'maitre', xp: 1400 }),
]);

export const STATS = Object.freeze(['tir', 'survie', 'discretion', 'endurance']);
export const START_STATS = Object.freeze({ tir: 1, survie: 1, discretion: 1, endurance: 0 });
export const STAT_MAX = 4;

const STEALTH_BONUS = 1;

const rankIndex = (rank) => RANKS.findIndex(({ id }) => id === rank);
const sum = (values) => values.reduce((total, value) => total + value, 0);

export function rankOf(xp) {
  return RANKS.filter((rank) => xp >= rank.xp).at(-1).id;
}

export function statPointsLeft(campaign) {
  const spent = sum(STATS.map((stat) => campaign.player.stats[stat] - START_STATS[stat]));
  return rankIndex(campaign.player.rank) - spent;
}

export function perkPicksLeft(campaign) {
  return rankIndex(campaign.player.rank) - campaign.player.perks.length;
}

export function hasPerk(state, id) {
  return state?.player?.perks?.includes(id) ?? false;
}

export function stealthBonus(state, { night = false, rain = false } = {}) {
  return hasPerk(state, 'fantome') && (night || rain) ? STEALTH_BONUS : 0;
}

export function gainXp(draft, n, cause, ctx) {
  if (!Number.isInteger(n) || n <= 0) throw new Error(`gain d'XP invalide : ${n}`);
  const { player } = draft;
  const before = rankIndex(player.rank);
  player.xp += n;
  ctx.emit({ type: 'xp-gained', amount: n, cause, xp: player.xp });

  const after = rankIndex(rankOf(player.xp));
  for (let i = before + 1; i <= after; i++) ctx.emit({ type: 'rank-up', rank: RANKS[i].id });
  player.rank = RANKS[after].id;
}

export function raiseStat(draft, { stat }, ctx) {
  if (inCombat(draft)) return 'in-combat';
  if (!STATS.includes(stat)) return 'unknown-stat';
  if (statPointsLeft(draft) <= 0) return 'no-stat-point';
  if (draft.player.stats[stat] >= STAT_MAX) return 'stat-max';

  draft.player.stats[stat] += 1;
  if (stat === 'endurance') {
    const { ap } = draft.world.tiles[draft.world.currentTile];
    ap.max += 1;
    ap.left += 1;
  }
  ctx.emit({ type: 'stat-raised', stat, value: draft.player.stats[stat] });
}

export function learnPerk(draft, { perk }, ctx) {
  if (inCombat(draft)) return 'in-combat';
  if (!Object.hasOwn(catalog, perk)) return 'unknown-perk';
  if (perkPicksLeft(draft) <= 0) return 'no-perk-pick';
  if (draft.player.perks.includes(perk)) return 'perk-known';

  draft.player.perks.push(perk);
  ctx.emit({ type: 'perk-learned', perk });
}

function inCombat(draft) {
  return Boolean(draft.world.tiles[draft.world.currentTile]?.combat);
}
