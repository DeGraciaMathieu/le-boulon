// Quêtes secondaires (brief v2 §8.1, §8.2 ; carte 21) : contenu de src/content/quetes/ et
// dialogues de leurs donneurs (src/content/dialogues/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/content/index.js';
import { createCampaign, step } from '../src/engine/campaign.js';
import { createItem } from '../src/engine/rules/sheet.js';

const SECONDARY = Object.freeze([
  'chiens-cordon', 'dette-bohdan', 'releve-saveli',
  'icone-eglise', 'pelerinage', 'suceur-pompage',
  'liste-arret', 'mesures-arkadi',
  'queues-chien', 'patrouille-perdue',
  'snork-vallee', 'ami-du-pont',
  'ordres-devoir', 'ateliers-rostok',
  'chimere-lac', 'champ-anomalies', 'caisse-matvii',
]);

const stepsOf = (id) => Object.entries(content.quests[id].steps);
const choicesOf = (npc) =>
  Object.values(content.dialogues[content.npcs[npc].dialogue].nodes).flatMap((node) => node.choices ?? []);

// Tuiles où se joue une quête : objectifs de terrain (lieu, tuile), sans les retours au donneur.
function fieldTiles(id) {
  const tiles = new Set();
  for (const [, { objective }] of stepsOf(id)) {
    if (objective.place) tiles.add(content.places[objective.place].tile);
    if (objective.tile) tiles.add(objective.tile);
  }
  return tiles;
}

test('15 à 20 quêtes secondaires, chacune écrite, avec un donneur', () => {
  assert.ok(SECONDARY.length >= 15 && SECONDARY.length <= 20, `${SECONDARY.length} quêtes`);
  for (const id of SECONDARY) {
    assert.ok(content.quests[id], `${id} absente`);
    assert.ok(content.npcs[content.quests[id].giver], `${id} : donneur inconnu`);
    assert.ok(Object.isFrozen(content.quests[id].steps), `${id} : non gelée`);
  }
});

test('réparties sur les 7 tuiles : au moins deux quêtes de terrain par tuile', () => {
  for (const tile of Object.keys(content.tiles)) {
    const count = SECONDARY.filter((id) => fieldTiles(id).has(tile)).length;
    assert.ok(count >= 2, `${tile} : ${count} quête(s)`);
  }
});

test('chaque objectif parler ou rapporter a sa réplique dans le dialogue du PNJ, à la bonne étape', () => {
  for (const id of SECONDARY) {
    for (const [stepId, { objective }] of stepsOf(id)) {
      if (objective.type !== 'parler' && objective.type !== 'rapporter') continue;
      const opens = choicesOf(objective.npc).some((choice) =>
        (objective.node === undefined || choice.next === objective.node)
        && [...(choice.conditions ?? []), ...(choice.effects ?? [])].some((c) =>
          c.quest === id && ((c.type === 'quete' && (c.step === stepId || c.step === undefined))
            || (c.type === 'avancer' && c.step === stepId))));
      assert.ok(opens, `${id}.${stepId} : pas de choix vers ${objective.node ?? 'le PNJ'} chez ${objective.npc}`);
    }
  }
});

test('chaque embranchement se choisit par des effets avancer d’un dialogue', () => {
  const advances = Object.keys(content.npcs).flatMap((npc) => choicesOf(npc))
    .flatMap((choice) => choice.effects ?? []).filter((e) => e.type === 'avancer');
  const branches = SECONDARY.flatMap((id) => stepsOf(id)
    .filter(([, s]) => s.next.length > 1).flatMap(([, s]) => s.next.map((next) => [id, next])));
  assert.ok(branches.length >= 4, 'au moins deux quêtes à embranchement en plus de la dette');
  for (const [id, next] of branches) {
    assert.ok(advances.some((e) => e.quest === id && e.step === next), `${id} : rien n’avance vers ${next}`);
  }
});

test('les huit objectifs du §8.2 servent', () => {
  const used = new Set(SECONDARY.flatMap((id) => stepsOf(id).map(([, s]) => s.objective.type)));
  assert.deepEqual([...used].sort(), [
    'cartographier', 'eliminer', 'escorter', 'explorer', 'parler', 'rapporter', 'survivre', 'visiter',
  ]);
});

// --- Parties jouées par step ------------------------------------------------------------------

function campaignAt(place, change = () => {}) {
  const campaign = createCampaign({ seed: 5 });
  const { tile, hex } = content.places[place];
  for (const state of Object.values(campaign.world.tiles)) state.zone.deck = [];
  campaign.world.currentTile = tile;
  campaign.world.hex = hex;
  change(campaign);
  return campaign;
}

function play(campaign, actions) {
  for (const action of actions) {
    const result = step(campaign, action);
    assert.notEqual(result.events[0]?.type, 'refused', JSON.stringify(result.events[0]));
    campaign = result.state;
  }
  return campaign;
}

// Index du choix du nœud courant qui mène à next, ou qui porte un effet sur la quête.
function pick(campaign, match) {
  const { npc, node } = campaign.dialogue;
  const choices = content.dialogues[content.npcs[npc].dialogue].nodes[node].choices;
  const index = choices.findIndex(match);
  assert.ok(index >= 0, `${npc}.${node} : choix introuvable`);
  return { type: 'choose', index };
}
const starting = (quest) => (c) => (c.effects ?? []).some((e) => e.type === 'quete' && e.quest === quest);
const advancing = (quest, to) => (c) => (c.effects ?? []).some((e) => e.type === 'avancer' && e.quest === quest && e.step === to);
const toward = (node) => (c) => c.next === node;

test('la liste de l’Arrêt : la carte de l’abri est fixée, puis choisir d’oublier la liste', () => {
  let campaign = campaignAt('arret-bus');
  campaign = play(campaign, [{ type: 'talk', npc: 'voyageur-arret' }]);
  campaign = play(campaign, [pick(campaign, starting('liste-arret'))]);
  assert.deepEqual(Object.values(campaign.places['arret-bus'].fixed), ['horaires']);
  campaign = play(campaign, [pick(campaign, (c) => !c.next)]);
  // Fouille de l'Arrêt jouée à part (la journée v1 ne tient que la tuile de départ).
  campaign.quests['liste-arret'].step = 'retour';
  campaign = play(campaign, [{ type: 'talk', npc: 'voyageur-arret' }]);
  campaign = play(campaign, [pick(campaign, toward('liste'))]);
  assert.equal(campaign.quests['liste-arret'].waiting, true);
  campaign = play(campaign, [pick(campaign, advancing('liste-arret', 'oubli'))]);
  assert.equal(campaign.quests['liste-arret'].status, 'done');
});

test('des queues de chien : l’objet rapporté à Zina est remis et la quête finie', () => {
  let campaign = campaignAt('bar');
  campaign = play(campaign, [{ type: 'talk', npc: 'docteur-zina' }]);
  campaign = play(campaign, [pick(campaign, starting('queues-chien'))]);
  campaign.quests['queues-chien'].step = 'remise';
  campaign.inventory.push(createItem('queue-chien'));
  campaign = play(campaign, [pick(campaign, (c) => !c.next), { type: 'talk', npc: 'docteur-zina' }]);
  assert.equal(campaign.quests['queues-chien'].status, 'done');
  assert.ok(!campaign.inventory.some((item) => item.kind === 'queue-chien'));
});

test('la caisse de Matviï : la vendre au Devoir passe par Ostap', () => {
  let campaign = campaignAt('base-liberte');
  campaign = play(campaign, [{ type: 'talk', npc: 'matvii' }]);
  campaign = play(campaign, [pick(campaign, starting('caisse-matvii'))]);
  assert.equal(campaign.quests['caisse-matvii'].waiting, true);
  campaign = play(campaign, [pick(campaign, advancing('caisse-matvii', 'devoir'))]);
  const devoir = campaign.reputation.devoir;
  Object.assign(campaign.world, { currentTile: 'rostok', hex: content.places.bar.hex });
  campaign = play(campaign, [{ type: 'talk', npc: 'ostap' }]);
  campaign = play(campaign, [pick(campaign, toward('caisse'))]);
  assert.equal(campaign.quests['caisse-matvii'].status, 'done');
  assert.ok(campaign.reputation.devoir > devoir);
});
