// IA du banc de campagne (brief v2 §17.3) : deux profils, « prudente » et « gourmande »,
// qui jouent la quête principale « Le Guide », pillent les lieux et commercent dans les hubs.
// Sans hasard : à état égal, même choix.
//
// API : candidates(campaign, mind) -> [action]
//         actions par ordre de préférence ; le banc (bench/campaign.js) joue la première que
//         le moteur ne refuse pas à cet état.
//       PROFILES : { prudente, gourmande }
//       createMind(profile) -> mémoire de l'IA, tenue par le banc : profil, lieux et hubs déjà
//         faits ce jour
//       MAIN_QUEST
//
// RÈGLES, par écran :
//   mort       respawn (mode normal, rules/death.js) : réveil au dernier hub.
//   nuit       wake.
//   combat v2  (rencontre de nuit) soin si les blessures atteignent le seuil ; parlemente
//              (humains, péage) toujours pour la prudente, si la riposte peut tuer pour la
//              gourmande ; puis fuite (1 blessure la nuit, LBL-56) selon profile.nightEscape,
//              jamais si cette blessure tue ; sinon tir ; replis : fuite, couverture.
//   combat v1  (mode 'rapide', tuile ou lieu) se bat si la chance de gagner atteint
//              profile.fightOdds ou si la fuite est impossible ; sinon fuit. Fuit toujours
//              si une défaite la tuerait.
//   dialogue   chemin le plus court (choix disponibles) vers ce que vise la quête principale :
//              le nœud de l'objectif 'parler', ou un choix qui démarre ou avance « Le Guide » ;
//              à défaut, un choix qui ferme le dialogue.
//   hub        vend artefacts, trophées et surplus, équipe ce qui est meilleur, achète
//              (objets qu'un dialogue réclame, arme d'épaule, munitions, soins, nourriture,
//              boulons, veste), parle au PNJ de la quête, prend un contrat (livraison ou
//              cartographie), dort le soir, puis sort.
//   lieu       explore tant que le lieu est la cible de la quête, ou pour le butin tant que
//              les PA et les blessures le permettent ; sinon sort.
//   tuile      se soigne ; à l'Émission, file vers un abri ; le soir, va dormir (lit d'un hub
//              de la tuile, sinon abri pour la prudente ; sur place pour la gourmande, dans un
//              abri le jour annoncé de l'Émission) ; sinon, dans l'ordre : hub si le sac est
//              plein, courses (nourriture, objet réclamé, arme d'épaule), artefact révélé,
//              contrat, quête principale, lieu à piller, jeton suspect (gourmande).
//              Hors de la tuile cible : liaison du plus court chemin entre tuiles. Lance un
//              boulon avant d'entrer sur un jeton suspect, sauf sur l'hexagone d'un lieu.
//
// LIMITES CONNUES : pas de quêtes secondaires ni de contrats de récupération, d'élimination
// ou d'escorte ; pas de savoir-faire ; combat en mode 'rapide' seulement.

import content from '../src/content/index.js';
import { dayState } from '../src/engine/campaign.js';
import { neighbors, HEXES } from '../src/engine/hex.js';
import { entryCost } from '../src/engine/actions/move.js';
import { weaponBonus, COVER } from '../src/engine/rules/encounters.js';
import { encounterCard } from '../src/engine/rules/tile.js';
import { countCharges } from '../src/engine/rules/sheet.js';
import { statBonus, activeWeapon, usedSlots, inventorySlots } from '../src/engine/rules/equipment.js';
import { questLog } from '../src/engine/rules/quests.js';
import { evaluate } from '../src/engine/rules/dialogue.js';
import { statPointsLeft } from '../src/engine/rules/progression.js';
import { buyPrice, sellPrice, stockOf, traderOf } from '../src/engine/rules/traders.js';
import { placeAccess } from '../src/engine/rules/factions.js';
import { hubAt } from '../src/engine/rules/hubs.js';
import { BED_PRICE } from '../src/engine/rules/time.js';

export const MAIN_QUEST = 'le-guide';

const DEATH_AT = 6;
const FLEE_COST = 2;
const SELL_CATEGORIES = ['artefact', 'trophee'];
const SHOULDER_WEAPON = 'fusil-pompe';
const FOODS = ['ration', 'conserve', 'saucisson'];
// Détour (en PA fictifs) pour contourner une rencontre déjà révélée.
const ENCOUNTER_DETOUR = 4;

export const PROFILES = Object.freeze({
  prudente: Object.freeze({
    healAt: 2, // soigne dès 2 blessures
    fightOdds: 0.5, // se bat à 50 % de chances ou plus
    lootMaxWounds: 1, // pille un lieu avec au plus 1 blessure
    questMaxWounds: 2, // explore le lieu de la quête avec au plus 2 blessures
    lootMinAp: 4, // garde 3 PA pour rentrer
    lootFactionPlaces: false, // n'entre pas dans un lieu tenu par une faction pour piller
    sleepInBed: true, // finit la journée au lit d'un hub quand il est à portée
    eveningAp: 3, // marge de PA gardée pour rejoindre le lit
    approach: ['payer', 'se-faufiler', 'combattre'],
    parley: 'toujours', // parlemente avec les humains en combat v2
    nightEscape: 'toujours', // fuit un combat de nuit (1 blessure)
    stock: { bandage: 3, ration: 2, boulons: 6, ammoBoxes: 2 },
    reserve: 300, // roubles gardés après un achat d'équipement
    buyArmor: true,
    sellWhenFull: 2, // rentre vendre quand il reste 2 cases libres
    // Types de contrats acceptés, un à la fois. Pas de récupération : son objet n'est pas posé
    // dans le lieu à visiter, il faut le trouver ailleurs (écart signalé par le banc).
    contracts: ['livraison', 'cartographie'],
  }),
  gourmande: Object.freeze({
    healAt: 4,
    fightOdds: 0.34,
    lootMaxWounds: 3,
    questMaxWounds: 4,
    lootMinAp: 1,
    lootFactionPlaces: true,
    sleepInBed: false,
    eveningAp: 0,
    approach: ['combattre', 'se-faufiler', 'payer'],
    parley: 'en-danger', // seulement si la riposte peut tuer
    nightEscape: 'en-danger',
    stock: { bandage: 2, ration: 2, boulons: 4, ammoBoxes: 2 },
    reserve: 0,
    buyArmor: false,
    sellWhenFull: 1,
    contracts: ['livraison', 'cartographie'],
  }),
});

export function createMind(profile) {
  return { profile, day: 0, done: [], needs: [] };
}

export function candidates(campaign, mind) {
  const { profile } = mind;
  if (mind.day !== campaign.day) Object.assign(mind, { day: campaign.day, done: [] });
  const day = dayState(campaign);
  if (day.status === 'dead') return [{ type: 'respawn' }];
  if (campaign.combat) return roundActions(campaign, profile);
  if (campaign.screen === 'night') return [{ type: 'wake' }];
  if (day.combat) return quickCombat(campaign, day, profile);
  if (campaign.dialogue) return dialogueActions(campaign, mind);
  const list = statActions(campaign);
  if (campaign.hub) return [...list, ...hubActions(campaign, day, profile, mind)];
  if (campaign.place) return [...list, ...placeActions(campaign, day, profile, mind)];
  return [...list, ...tileActions(campaign, day, profile, mind)];
}

// --- Combat --------------------------------------------------------------------------------

function roundActions(campaign, profile) {
  const healing = campaign.player.wounds >= profile.healAt && hasCategory(campaign.inventory, 'soin');
  const { wounds } = campaign.player;
  const danger = wounds + riposte(campaign.combat) >= DEATH_AT;
  const parley = profile.parley === 'toujours' || danger;
  const night = campaign.combat.previousScreen === 'night';
  const flee = night && wounds + 1 < DEATH_AT && (profile.nightEscape === 'toujours' || danger);
  return [
    ...(healing ? [{ type: 'heal' }] : []),
    ...(parley ? [{ type: 'parley' }] : []),
    ...(flee ? [{ type: 'escape' }] : []),
    { type: 'shoot' }, { type: 'escape' }, { type: 'take-cover' },
  ];
}

// Blessures si tous les ennemis debout touchent.
function riposte(combat) {
  return combat.enemies.filter((enemy) => enemy.hp > 0).reduce((sum, enemy) => sum + enemy.damage, 0);
}

function quickCombat(campaign, day, profile) {
  const { threat, wounds } = encounterCard(day.tile, day.combat.card);
  const cover = day.combat.hex == null ? 0 : (COVER[day.tile.hexes[day.player.hex].terrain] ?? 0);
  const tir = day.player.stats.tir + statBonus(day.equipment, 'tir');
  const needed = threat - tir - weaponBonus(day.inventory, day.equipment) - cover;
  const odds = Math.min(1, Math.max(0, (7 - needed) / 6));
  const canFlee = day.ap.left >= FLEE_COST;
  const deadly = campaign.player.wounds + wounds >= DEATH_AT;
  const fight = !canFlee || (odds >= profile.fightOdds && !(deadly && odds < 1));
  return fight ? [{ type: 'fight' }, { type: 'flee' }] : [{ type: 'flee' }, { type: 'fight' }];
}

// --- Dialogue ------------------------------------------------------------------------------

function dialogueActions(campaign, mind) {
  const { npc, node } = campaign.dialogue;
  const tree = dialogueOf(npc);
  const choices = tree.nodes[node].choices.map((choice, index) => ({ ...choice, index }))
    .filter((choice) => (choice.conditions ?? []).every((c) => evaluate(c, campaign)));
  const goal = questGoal(campaign);
  const useful = choices.filter((choice) => leadsToGoal(tree, choice, goal, campaign, new Set([node])));
  // Rien d'utile ici : ce PNJ ne sera plus abordé aujourd'hui ; les objets qui ouvriraient un
  // choix utile vont sur la liste de courses.
  if (useful.length === 0) {
    mind.done.push(`npc:${npc}`);
    mind.needs = missingItems(tree, tree.nodes[node].choices, goal, campaign, node);
  }
  const ordered = [
    ...useful,
    ...choices.filter((choice) => !choice.next),
    ...choices,
  ];
  return ordered.map(({ index }) => ({ type: 'choose', index }));
}

function dialogueOf(npc) {
  const id = content.npcs[npc]?.dialogue ?? npc;
  return content.dialogues[id];
}

// Ce que vise la quête principale dans un dialogue.
function questGoal(campaign) {
  const quest = mainQuest(campaign);
  if (!quest) return { start: !campaign.quests[MAIN_QUEST] };
  const { objective } = quest;
  const node = objective.type === 'parler' && objective.npc === campaign.dialogue.npc ? objective.node : null;
  return { node, advance: true };
}

function missingItems(tree, choices, goal, campaign, node) {
  const items = choices
    .filter((choice) => !(choice.conditions ?? []).every((c) => evaluate(c, campaign)))
    .filter((choice) => leadsToGoal(tree, choice, goal, campaign, new Set([node]), true))
    .flatMap((choice) => choice.conditions.filter((c) => c.type === 'objet').map((c) => c.item));
  return [...new Set(items)];
}

// ignore : sans regarder les conditions (choix qui seraient utiles si on les remplissait).
function leadsToGoal(tree, choice, goal, campaign, seen, ignore = false) {
  const effects = choice.effects ?? [];
  if (goal.start && effects.some((e) => e.type === 'quete' && e.quest === MAIN_QUEST)) return true;
  if (goal.advance && effects.some((e) => e.type === 'avancer' && e.quest === MAIN_QUEST)) return true;
  if (!choice.next || seen.has(choice.next)) return false;
  if (goal.node && choice.next === goal.node) return true;
  const next = tree.nodes[choice.next];
  const nextSeen = new Set([...seen, choice.next]);
  return next.choices.some((c) =>
    (ignore || (c.conditions ?? []).every((cond) => evaluate(cond, campaign))) && leadsToGoal(tree, c, goal, campaign, nextSeen, ignore));
}

// --- Progression ---------------------------------------------------------------------------

function statActions(campaign) {
  if (statPointsLeft(campaign) <= 0) return [];
  const { stats } = campaign.player;
  return ['tir', 'endurance', 'survie', 'discretion']
    .filter((stat) => stats[stat] < 4)
    .map((stat) => ({ type: 'raise-stat', stat }));
}

// --- Hub -----------------------------------------------------------------------------------

function hubActions(campaign, day, profile, mind) {
  const hub = campaign.hub.id;
  const list = [];
  const trader = traderOf(hub);
  if (trader) list.push(...sellActions(campaign, trader, profile), ...buyActions(campaign, trader, profile, mind));
  list.push(...equipActions(campaign));
  const target = mainTarget(campaign);
  if (target?.npc && target.place === hub && !mind.done.includes(`npc:${target.npc}`)) list.push({ type: 'talk', npc: target.npc });
  list.push(...contractActions(campaign, hub, profile, mind));
  if (shouldSleepHere(campaign, day, profile)) list.push({ type: 'sleep' });
  mind.done.push(hub);
  list.push({ type: 'leave-hub' });
  return list;
}

// Vend artefacts et trophées, et le surplus : ce qui dépasse les réserves du profil, les
// munitions sans arme, armes et armures qui ne servent pas.
// Tableau des contrats : consulte, puis accepte la première offre d'un type du profil, sans
// autre contrat en cours.
function contractActions(campaign, hub, profile, mind) {
  if (!content.places[hub].services.includes('contrats') || activeContract(campaign)) return [];
  if (mind.done.includes(`board:${hub}`)) return [];
  const board = campaign.contracts[hub];
  if (!board) return [{ type: 'service', service: 'contrats' }];
  mind.done.push(`board:${hub}`);
  return board.filter((offer) => profile.contracts.includes(offer.type))
    .map((offer) => ({ type: 'service', service: 'contrats', contract: offer.id }));
}

function activeContract(campaign) {
  return questLog(campaign).active.find((q) => q.quest !== MAIN_QUEST && campaign.quests[q.quest].quest?.contract) ?? null;
}

function sellActions(campaign, trader, profile) {
  const keep = keptStock(campaign, profile);
  const kept = {};
  const list = [];
  for (const item of campaign.inventory) {
    kept[item.kind] = (kept[item.kind] ?? 0) + 1;
    if (kept[item.kind] <= (keep[item.kind] ?? 0)) continue;
    if (sellPrice(campaign, trader, item) == null) continue;
    list.push({ type: 'service', service: 'marchand', op: 'sell', item: item.kind });
  }
  return list;
}

// Objets gardés (nombre par type) ; le reste se vend.
function keptStock(campaign, profile) {
  const weapon = weaponOf(campaign.equipment);
  const keep = {
    bandage: profile.stock.bandage, 'trousse-soins': 2, 'trousse-militaire': 2,
    ration: profile.stock.ration, conserve: 1, saucisson: 1,
    antirad: 1, vodka: 1, boulons: 2, grenade: 2, 'boisson-energetique': 1,
  };
  if (weapon?.ammo) keep[weapon.ammo] = profile.stock.ammoBoxes + 1;
  const sidearm = campaign.equipment.sidearm && content.items[campaign.equipment.sidearm.kind];
  if (sidearm?.ammo) keep[sidearm.ammo] = Math.max(keep[sidearm.ammo] ?? 0, profile.stock.ammoBoxes);
  for (const [category, slot] of Object.entries(EQUIP_SLOTS)) {
    if (!campaign.equipment[slot]) {
      const item = campaign.inventory.find((i) => content.items[i.kind].category === category);
      if (item) keep[item.kind] = 1;
    }
  }
  return keep;
}

function buyActions(campaign, trader, profile, mind) {
  const stock = stockOf(campaign, trader);
  const { roubles } = campaign.player;
  const affordable = (item, keep = 0) => stock[item] > 0 && (buyPrice(campaign, trader, item) ?? Infinity) + keep <= roubles;
  const buy = (item) => ({ type: 'service', service: 'marchand', op: 'buy', item });
  const list = mind.needs.filter((item) => !has(campaign, item) && affordable(item)).map(buy);
  const weapon = activeWeapon(campaign.equipment, campaign.inventory) ?? weaponOf(campaign.equipment);
  if (!campaign.equipment.primary && affordable(SHOULDER_WEAPON, profile.reserve)) list.push(buy(SHOULDER_WEAPON));
  if (weapon?.ammo && countItems(campaign.inventory, weapon.ammo) < profile.stock.ammoBoxes && affordable(weapon.ammo)) {
    list.push(buy(weapon.ammo));
  }
  if (countItems(campaign.inventory, 'bandage') < profile.stock.bandage && affordable('bandage')) list.push(buy('bandage'));
  const food = FOODS.find((item) => affordable(item));
  if (countCategory(campaign.inventory, 'nourriture') < profile.stock.ration && food) list.push(buy(food));
  if (countCharges(campaign.inventory, 'boulons') < profile.stock.boulons && affordable('boulons')) list.push(buy('boulons'));
  if (profile.buyArmor && !campaign.equipment.armor && affordable('veste-cuir', profile.reserve)) list.push(buy('veste-cuir'));
  return list;
}

function weaponOf(equipment) {
  const item = equipment.primary ?? equipment.sidearm;
  return item && content.items[item.kind];
}

const EQUIP_SLOTS = { 'arme-epaule': 'primary', armure: 'armor', sac: 'backpack' };

function equipActions(campaign) {
  return campaign.inventory
    .filter((item) => !campaign.equipment[EQUIP_SLOTS[content.items[item.kind].category]])
    .filter((item) => EQUIP_SLOTS[content.items[item.kind].category])
    .map((item) => ({ type: 'equip', item: item.kind }));
}

// Dort au hub le soir (peu de PA) ou pendant le compte à rebours de l'Émission.
function shouldSleepHere(campaign, day, profile) {
  if (!content.places[campaign.hub.id].services.includes('lit')) return false;
  if (campaign.player.roubles < BED_PRICE && content.places[campaign.hub.id].faction !== campaign.player.faction) return false;
  return day.ap.left <= profile.eveningAp + 1 || Boolean(day.zone.emission);
}

// --- Lieu ----------------------------------------------------------------------------------

function placeActions(campaign, day, profile, mind) {
  const id = campaign.place.id;
  const target = mainTarget(campaign);
  const state = campaign.places[id];
  const questHere = target?.place === id && target.explore && campaign.player.wounds <= profile.questMaxWounds;
  const loot = !state?.emptied && campaign.player.wounds <= profile.lootMaxWounds
    && day.ap.left >= profile.lootMinAp && !full(campaign, profile);
  if (campaign.player.wounds >= profile.healAt && hasCategory(campaign.inventory, 'soin')) {
    return [healItem(campaign), { type: 'leave-place' }];
  }
  if (questHere || loot) return [{ type: 'explore' }, { type: 'leave-place' }];
  if (!mind.done.includes(id)) mind.done.push(id);
  return [{ type: 'leave-place' }];
}

// --- Tuile ---------------------------------------------------------------------------------

function tileActions(campaign, day, profile, mind) {
  if (day.status !== 'playing') return [{ type: 'camp' }];
  const list = [];
  // Le jour de l'Émission, l'abri passe avant les soins légers.
  const healAt = campaign.world.emission.today ? Math.max(profile.healAt, 4) : profile.healAt;
  if (campaign.player.wounds >= healAt && hasCategory(campaign.inventory, 'soin')) list.push(healItem(campaign));
  if (campaign.player.radiation >= 4) list.push(...['antirad', 'vodka'].filter((k) => has(campaign, k)).map((item) => ({ type: 'use', item })));
  const plan = choosePlan(campaign, day, profile, mind);
  list.push(...plan);
  return list;
}

function choosePlan(campaign, day, profile, mind) {
  const here = { tile: campaign.world.currentTile, hex: campaign.world.hex };
  const ap = day.ap.left;

  // Émission : compte à rebours lancé, vers l'abri le plus proche de la tuile.
  if (day.zone.emission) {
    const shelters = shelterHexes(day);
    if (shelters.includes(here.hex)) return [...enterHubHere(campaign, mind), { type: 'camp' }];
    return [...moveTowards(campaign, day, shelters), { type: 'camp' }];
  }

  // Le soir : la prudente rejoint le lit d'un hub de la tuile, à défaut un abri ; la
  // gourmande campe sur place à bout de PA (dans un abri si elle y est).
  const bed = nearestBed(campaign, day);
  if (profile.sleepInBed && bed?.tile === here.tile && bed.cost + profile.eveningAp >= ap && bed.cost <= ap) {
    return [...goTo(campaign, day, { tile: bed.tile, hex: bed.hex, hub: bed.place, sleep: true }, mind), { type: 'camp' }];
  }
  // Hors de portée d'un lit, la prudente finit la journée dans un abri ; la gourmande aussi
  // le jour annoncé de l'Émission (elle passe la nuit si la carte n'est pas sortie).
  const shelter = nearestShelter(day, here.hex);
  const margin = campaign.world.emission.today ? Math.max(profile.eveningAp, 2) : profile.eveningAp;
  const wantsShelter = profile.sleepInBed || campaign.world.emission.today;
  if (wantsShelter && bed?.tile !== here.tile && shelter && shelter.cost + margin >= ap) {
    return shelter.hex === here.hex ? [{ type: 'camp' }] : [...moveTowards(campaign, day, [shelter.hex]), { type: 'camp' }];
  }
  if (ap <= 1) return [...enterHubHere(campaign, mind), { type: 'camp' }];

  // Sac plein : vendre au hub marchand le plus proche.
  if (full(campaign, profile) && hasLoot(campaign)) {
    const market = nearestHub(campaign, day, (place) => place.services.includes('marchand'));
    if (market) return [...goTo(campaign, day, { tile: market.tile, hex: market.hex, hub: market.place }, mind), { type: 'camp' }];
  }

  // Courses : plus rien à manger, ou de quoi payer l'arme d'épaule.
  const errand = errandPlan(campaign, day, profile, mind);
  if (errand.length) return [...errand, { type: 'camp' }];

  // Artefact révélé sur la tuile, à portée.
  const artefact = full(campaign, profile) ? [] : tokenPlan(campaign, day, profile, (t) => t.revealed && t.kind === 'artefact');
  if (artefact.length) return [...artefact, { type: 'camp' }];

  // Contrat en cours (délai court : avant la quête principale).
  const contract = contractTarget(campaign);
  if (contract && !mind.done.includes(contract.npc ? `npc:${contract.npc}` : contract.place)) {
    const actions = contract.map && contract.tile === here.tile
      ? tokenPlan(campaign, day, profile, (t) => !t.revealed)
      : goTo(campaign, day, contract, mind);
    if (actions.length) return [...actions, { type: 'camp' }];
  }

  // Quête principale, sauf si le lieu ou le hub visé est déjà fait aujourd'hui.
  const target = mainTarget(campaign);
  const handled = target && mind.done.includes(target.npc ? `npc:${target.npc}` : target.place);
  if (target && !handled) return [...goTo(campaign, day, target, mind), ...lootPlan(campaign, day, profile, mind), { type: 'camp' }];

  // La gourmande fouille aussi les jetons suspects non révélés.
  const hidden = profile.sleepInBed ? [] : tokenPlan(campaign, day, profile, (t) => !t.revealed);
  return [...lootPlan(campaign, day, profile, mind), ...hidden, { type: 'camp' }];
}

function errandPlan(campaign, day, profile, mind) {
  if (profile.sleepInBed && campaign.world.emission.today) return [];
  const hungry = countCategory(campaign.inventory, 'nourriture') === 0 && campaign.player.roubles >= 100;
  const weapon = !campaign.equipment.primary && campaign.player.roubles >= weaponBudget(profile);
  const sells = (items) => (place, id) => items.some((item) => traderStock(id).includes(item));
  const needs = mind.needs.filter((item) => !has(campaign, item));
  const accept = needs.length && campaign.player.roubles >= 300 ? sells(needs)
    : weapon ? sells([SHOULDER_WEAPON]) : hungry ? sells(FOODS) : null;
  if (!accept) return [];
  const hub = nearestHub(campaign, day, (place, id) => place.services.includes('marchand') && !mind.done.includes(id) && accept(place, id));
  return hub ? goTo(campaign, day, { tile: hub.tile, hex: hub.hex, hub: hub.place }, mind) : [];
}

// Prix de l'arme d'épaule chez le marchand le plus cher, plus la réserve du profil.
function weaponBudget(profile) {
  const coefficient = Math.max(...Object.values(content.traders).map((t) => t.coefficient));
  return Math.round(content.items[SHOULDER_WEAPON].price * coefficient * 1.5) + profile.reserve;
}

function traderStock(hubId) {
  const trader = Object.values(content.traders).find((t) => t.place === hubId);
  return trader ? trader.stock.map((s) => s.item) : [];
}

// Jeton le plus proche parmi ceux que accept retient, si l'aller et une action (ramassage ou
// boulon) tiennent dans les PA en gardant la marge du soir.
function tokenPlan(campaign, day, profile, accept) {
  const { cost } = dijkstra(day, campaign.world.hex);
  // Un jeton non révélé se révèle au boulon depuis un voisin ; un artefact se ramasse dessus.
  const reach = (t) => (t.revealed ? cost[t.hex] : Math.min(...neighbors(t.hex).map((n) => cost[n])));
  const tokens = day.tokens
    .filter(accept)
    .filter((t) => Number.isFinite(reach(t)) && reach(t) + 1 + profile.eveningAp <= day.ap.left)
    .sort((a, b) => reach(a) - reach(b) || a.hex - b.hex);
  if (tokens.length === 0) return [];
  const token = tokens[0];
  if (token.hex === campaign.world.hex) return token.revealed ? [{ type: 'pickup' }] : [];
  return moveTowards(campaign, day, [token.hex]);
}

// Pillage : lieu non vidé le plus proche de la tuile courante.
function lootPlan(campaign, day, profile, mind) {
  if (campaign.player.wounds > profile.lootMaxWounds || day.ap.left < profile.lootMinAp || full(campaign, profile)) return [];
  const { cost } = dijkstra(day, campaign.world.hex);
  const places = Object.entries(content.places)
    .filter(([id, place]) => place.tile === campaign.world.currentTile && !place.tags.includes('hub'))
    .filter(([id, place]) => !mind.done.includes(id) && !campaign.places[id]?.emptied)
    .filter(([, place]) => profile.lootFactionPlaces || placeAccess(campaign, place.faction ?? null).free)
    .filter(([, place]) => Number.isFinite(cost[place.hex]) && cost[place.hex] + profile.lootMinAp <= day.ap.left)
    .sort(([a, pa], [b, pb]) => cost[pa.hex] - cost[pb.hex] || a.localeCompare(b));
  if (places.length === 0) return [];
  const [id, place] = places[0];
  return goTo(campaign, day, { tile: place.tile, hex: place.hex, place: id, explore: true }, mind);
}

// Actions pour aller à une cible { tile, hex?, place?, hub?, npc?, explore? } et y agir.
function goTo(campaign, day, target, mind) {
  const { currentTile, hex } = campaign.world;
  if (target.tile !== currentTile) {
    const link = nextLink(currentTile, target.tile);
    if (!link) return [];
    if (hex === link) return [{ type: 'travel' }];
    return moveTowards(campaign, day, [link]);
  }
  if (target.hex == null) return [];
  if (hex !== target.hex) return moveTowards(campaign, day, [target.hex]);
  return act(campaign, target, mind);
}

function act(campaign, target, mind) {
  const list = [];
  const hub = target.hub ?? (content.places[target.place]?.tags.includes('hub') ? target.place : null);
  const talk = target.npc && !mind.done.includes(`npc:${target.npc}`);
  if (talk && !hub) list.push({ type: 'talk', npc: target.npc });
  if (hub && (target.sleep || !mind.done.includes(hub))) list.push({ type: 'enter-hub', hub });
  else if (target.place) list.push(...enterPlace(campaign, target.place, mind.profile.approach));
  return list;
}

function enterPlace(campaign, id, approaches) {
  const place = content.places[id];
  if (placeAccess(campaign, place.faction ?? null).free || campaign.places[id]?.cleared) return [{ type: 'enter-place', place: id }];
  return [{ type: 'enter-place', place: id }, ...approaches.map((approach) => ({ type: 'enter-place', place: id, approach }))];
}

// Hub de l'hexagone, zone sûre pour l'Émission et lit pour la nuit.
function enterHubHere(campaign, mind) {
  const hub = hubAt(campaign);
  return hub && !mind.done.includes(hub) ? [{ type: 'enter-hub', hub }] : [];
}

function moveTowards(campaign, day, hexes) {
  const step = firstStep(day, campaign.world.hex, hexes);
  if (step == null) return fallbackMoves(day);
  // Pas de boulon sur un hexagone de lieu : une anomalie révélée le bloquerait jusqu'à l'Émission.
  const token = day.tokens.find((t) => t.hex === step && !t.revealed) && !day.tile.hexes[step].lieu;
  const canBolt = countCharges(day.inventory, 'boulons') > 0 && day.ap.left >= 2 && !day.zone.fog;
  const move = { type: 'move', to: step };
  return token && canBolt ? [{ type: 'bolt', target: step }, move] : [move, ...fallbackMoves(day)];
}

function fallbackMoves(day) {
  return neighbors(day.player.hex)
    .filter((n) => !blocked(day, n) && entryCost(day.tile.hexes[n], day) <= day.ap.left)
    .sort((a, b) => entryCost(day.tile.hexes[a], day) - entryCost(day.tile.hexes[b], day) || a - b)
    .map((to) => ({ type: 'move', to }));
}

// --- Cibles --------------------------------------------------------------------------------

function mainQuest(campaign) {
  return questLog(campaign).active.find((q) => q.quest === MAIN_QUEST) ?? null;
}

// Cible de la quête principale : { tile, hex, place?, npc?, explore? }, ou le donneur avant
// le départ. null une fois la quête finie.
export function mainTarget(campaign) {
  const state = campaign.quests[MAIN_QUEST];
  if (!state) {
    const giver = content.quests[MAIN_QUEST].giver;
    const place = campaign.npcs[giver].place;
    return { tile: content.places[place].tile, hex: content.places[place].hex, place, npc: giver };
  }
  const quest = mainQuest(campaign);
  if (!quest?.target) return null;
  const { objective, target } = quest;
  const npc = objective.npc ?? null;
  const explore = ['explorer', 'eliminer'].includes(objective.type);
  return { ...target, npc, explore };
}

// Lit qu'on peut payer (gratuit dans le hub de sa faction).
// Cible du contrat en cours : comme mainTarget ; map pour une cartographie (jetons de la tuile).
function contractTarget(campaign) {
  const quest = activeContract(campaign);
  if (!quest?.target) return null;
  const { objective, target } = quest;
  return { ...target, npc: objective.npc ?? null, explore: false, map: objective.type === 'cartographier' };
}

function nearestBed(campaign, day) {
  const affordable = (place) => place.faction === campaign.player.faction || campaign.player.roubles >= BED_PRICE;
  return nearestHub(campaign, day, (place) => place.services.includes('lit') && affordable(place));
}

function nearestHub(campaign, day, accept) {
  const hubs = Object.entries(content.places)
    .filter(([id, place]) => place.tags.includes('hub') && accept(place, id))
    .map(([id, place]) => ({ place: id, tile: place.tile, hex: place.hex, cost: routeCost(campaign, day, place) }))
    .filter((hub) => Number.isFinite(hub.cost))
    .sort((a, b) => a.cost - b.cost || a.place.localeCompare(b.place));
  return hubs[0] ?? null;
}

// Coût estimé en PA jusqu'à une cible : exact sur la tuile courante ; au-delà, chemin jusqu'à
// la liaison + 1 PA par voyage + 3 PA par tuile traversée (estimation).
function routeCost(campaign, day, target) {
  const { currentTile, hex } = campaign.world;
  const { cost } = dijkstra(day, hex);
  if (target.tile === currentTile) return target.hex == null ? 0 : cost[target.hex];
  const path = tilePath(currentTile, target.tile);
  if (!path) return Infinity;
  const link = Number(Object.entries(content.links[currentTile]).find(([, to]) => to.tile === path[1])[0]);
  return cost[link] + 1 + (path.length - 2) * 4 + 3;
}

// Hexagone de liaison de la tuile courante vers la tuile suivante du plus court chemin.
function nextLink(from, to) {
  const path = tilePath(from, to);
  if (!path) return null;
  return Number(Object.entries(content.links[from]).find(([, link]) => link.tile === path[1])[0]);
}

function tilePath(from, to) {
  const previous = { [from]: null };
  const queue = [from];
  while (queue.length > 0) {
    const tile = queue.shift();
    if (tile === to) break;
    for (const link of Object.values(content.links[tile] ?? {})) {
      if (link.tile in previous) continue;
      previous[link.tile] = tile;
      queue.push(link.tile);
    }
  }
  if (!(to in previous)) return null;
  const path = [to];
  while (previous[path[0]] != null) path.unshift(previous[path[0]]);
  return path;
}

// --- Chemins sur la tuile ------------------------------------------------------------------

function firstStep(day, from, hexes) {
  const { cost, parent } = dijkstra(day, from);
  const reachable = hexes.filter((n) => n !== from && Number.isFinite(cost[n]));
  if (reachable.length === 0) return null;
  reachable.sort((a, b) => cost[a] - cost[b] || a - b);
  let n = reachable[0];
  while (parent[n] !== from) n = parent[n];
  return n;
}

function dijkstra(day, from) {
  const cost = {};
  const parent = {};
  for (const { n } of HEXES) cost[n] = Infinity;
  cost[from] = 0;
  const open = new Set([from]);
  while (open.size > 0) {
    const current = [...open].sort((a, b) => cost[a] - cost[b] || a - b)[0];
    open.delete(current);
    for (const n of neighbors(current)) {
      if (blocked(day, n)) continue;
      const next = cost[current] + entryCost(day.tile.hexes[n], day) + (knownEncounter(day, n) ? ENCOUNTER_DETOUR : 0);
      if (next < cost[n]) {
        cost[n] = next;
        parent[n] = current;
        open.add(n);
      }
    }
  }
  return { cost, parent };
}

function knownEncounter(day, hex) {
  return day.encounters.some((e) => e.hex === hex && e.card);
}

function blocked(day, hex) {
  return day.tokens.some((t) => t.hex === hex && t.revealed && t.kind === 'anomalie');
}

function nearestShelter(day, from) {
  const { cost } = dijkstra(day, from);
  const hexes = shelterHexes(day).filter((n) => Number.isFinite(cost[n])).sort((a, b) => cost[a] - cost[b] || a - b);
  return hexes.length ? { hex: hexes[0], cost: cost[hexes[0]] } : null;
}

function shelterHexes(day) {
  return HEXES.map(({ n }) => n).filter((n) => day.tile.hexes[n].abri);
}

// --- Inventaire ----------------------------------------------------------------------------

function full(campaign, profile) {
  const free = inventorySlots(campaign) - usedSlots(campaign.inventory);
  return free <= profile.sellWhenFull;
}

function hasLoot(campaign) {
  return campaign.inventory.some((item) => SELL_CATEGORIES.includes(content.items[item.kind].category));
}

function hasCategory(inventory, category) {
  return inventory.some((item) => content.items[item.kind].category === category);
}

function has(campaign, kind) {
  return campaign.inventory.some((item) => item.kind === kind);
}

function countCategory(inventory, category) {
  return inventory.filter((item) => content.items[item.kind].category === category).length;
}

function countItems(inventory, kind) {
  return inventory.filter((item) => item.kind === kind).length;
}

function healItem(campaign) {
  const item = campaign.inventory.find((i) => content.items[i.kind].category === 'soin');
  return { type: 'use', item: item.kind };
}
