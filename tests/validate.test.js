import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateContent,
  checkFrozen,
  checkIds,
  checkReferences,
  checkTiles,
  checkLinks,
  checkPlaces,
  checkQuests,
  checkDialogues,
} from '../src/content/validate.js';
import { deepFreeze } from '../src/content/freeze.js';

const hexes = () =>
  Object.fromEntries(Array.from({ length: 19 }, (_, i) => [i + 1, { terrain: 'herbe' }]));

// Contenu factice minimal mais complet : une collection de chaque, toutes reliées.
function fixture() {
  return {
    tiles: {
      cordon: { name: 'Cordon', entry: 14, level: 1, hexes: hexes() },
      decharge: { name: 'Décharge', entry: 13, level: 2, hexes: hexes() },
    },
    links: {
      cordon: { 19: { tile: 'decharge', hex: 13 } },
      decharge: { 13: { tile: 'cordon', hex: 19 } },
    },
    places: {
      camp: {
        name: 'Camp des novices', label: 'Табір новачків', tile: 'cordon', hex: 1,
        tags: ['hub'], faction: 'solitaires', deck: 'camp', loot: 'n1',
      },
      atp: { name: 'ATP', label: 'АТП', tile: 'cordon', hex: 8, tags: ['abri'], deck: 'atp', loot: 'n1' },
    },
    items: {
      pistolet: { name: 'Pistolet', category: 'arme-poing', price: 300, size: 1, ammo: 'munitions-9' },
      'munitions-9': { name: '9 mm', category: 'munitions', price: 50, size: 1 },
      pda: { name: 'PDA du courrier', category: 'quete', price: null, size: 1 },
    },
    loot: {
      n1: { level: 1, entries: [{ item: 'munitions-9', weight: 3 }, { item: 'pistolet', weight: 1 }] },
    },
    npcs: {
      marchand: { name: 'Le Marchand', faction: 'solitaires', place: 'camp', dialogue: 'marchand' },
    },
    dialogues: {
      marchand: {
        start: 'accueil',
        nodes: {
          accueil: {
            text: 'Approche.',
            choices: [
              { text: 'Du travail ?', next: 'courrier', effects: [{ type: 'quete', quest: 'courrier' }] },
              { text: 'Au revoir.', next: null },
            ],
          },
          courrier: {
            text: 'Va voir à l’ATP.',
            choices: [
              { text: 'Voilà le PDA.', next: 'merci', conditions: [{ type: 'objet', item: 'pda' }] },
              { text: 'J’y vais.', next: null },
            ],
          },
          merci: {
            text: 'Bien.',
            choices: [],
            effects: [
              { type: 'prendre', item: 'pda' },
              { type: 'avancer', quest: 'courrier', step: 'rapport' },
            ],
          },
        },
      },
    },
    quests: {
      courrier: {
        name: 'Le courrier', giver: 'marchand', start: 'atp',
        rewards: { roubles: 300, xp: 50, reputation: { solitaires: 1 }, items: ['pistolet'] },
        steps: {
          atp: { objective: { type: 'explorer', place: 'atp', card: 'pda-courrier' }, next: ['rapport'] },
          rapport: { objective: { type: 'parler', npc: 'marchand', node: 'merci' }, next: [] },
        },
      },
    },
    contracts: {
      livraison: { type: 'livraison', faction: 'solitaires', places: ['camp'], reward: 100, deadline: [2, 5] },
    },
    factions: {
      solitaires: { name: 'Solitaires', places: ['camp'], joinable: true, start: 2 },
    },
    decks: {
      camp: { kind: 'exploration', place: 'camp', cards: [{ id: 'rien', type: 'rien' }] },
      atp: {
        kind: 'exploration', place: 'atp',
        cards: [
          { id: 'butin', type: 'butin', loot: 'n1' },
          { id: 'pda-courrier', type: 'indice', item: 'pda', quest: 'courrier' },
        ],
      },
    },
    perks: {
      'pied-leger': { name: 'Pied léger', effect: 'La forêt coûte 1 PA' },
    },
  };
}

// Applique une casse au contenu factice, puis le gèle comme du vrai contenu.
function broken(mutate) {
  const content = fixture();
  mutate(content);
  return deepFreeze(content);
}

const hasError = (errors, pattern) =>
  assert.ok(errors.some((e) => pattern.test(e)), `attendu ${pattern}, reçu :\n${errors.join('\n')}`);

test('le contenu factice est valide', () => {
  assert.deepEqual(validateContent(deepFreeze(fixture())), []);
});

test('un contenu vide est valide : chaque règle attend sa collection', () => {
  assert.deepEqual(validateContent(deepFreeze({})), []);
});

test('contenu gelé : un objet profond non gelé est signalé', () => {
  const content = deepFreeze(fixture());
  const thawed = { ...content, items: { ...content.items, pda: { name: 'PDA' } } };
  hasError(checkFrozen(Object.freeze(thawed)), /^items : non gelé/);
  hasError(checkFrozen(Object.freeze(thawed)), /^items\.pda : non gelé/);
});

test('ids : un id qui ne correspond pas à sa clé est signalé', () => {
  const errors = checkIds(broken((c) => { c.items.pda.id = 'pda-courrier'; }));
  hasError(errors, /^items\.pda\.id : « pda-courrier » ≠ clé « pda »/);
});

test('ids : deux cartes de même id dans un paquet sont signalées', () => {
  const errors = checkIds(broken((c) => { c.decks.atp.cards[1].id = 'butin'; }));
  hasError(errors, /^decks\.atp\.cards\[1\]\.id : « butin » en double/);
});

test('références : un objet, un PNJ, une faction… inconnus sont signalés', () => {
  const errors = checkReferences(broken((c) => {
    c.loot.n1.entries[0].item = 'grenade';
    c.npcs.marchand.faction = 'monolithe';
    c.quests.courrier.rewards.reputation.devoir = 1;
    c.factions.solitaires.places.push('bar');
  }));
  hasError(errors, /^loot\.n1\.entries\[0\]\.item : objet inconnu « grenade »/);
  hasError(errors, /^npcs\.marchand\.faction : faction inconnue « monolithe »/);
  hasError(errors, /^quests\.courrier\.rewards\.reputation : faction inconnue « devoir »/);
  hasError(errors, /^factions\.solitaires\.places\[1\] : lieu inconnu « bar »/);
});

test('références : un nœud de dialogue inconnu est signalé', () => {
  const errors = checkReferences(broken((c) => {
    c.quests.courrier.steps.rapport.objective.node = 'adieu';
  }));
  hasError(errors, /^quests\.courrier\.steps\.rapport\.objective\.node : nœud inconnu « adieu » \(dialogue marchand\)/);
});

test('références : une étape de quête inconnue est signalée', () => {
  const errors = checkReferences(broken((c) => {
    c.dialogues.marchand.nodes.merci.effects[1].step = 'fin';
  }));
  hasError(errors, /^dialogues\.marchand\.nodes\.merci\.effects\[1\]\.step : étape inconnue « fin » \(quête courrier\)/);
});

test('références : une carte fixée absente du paquet du lieu est signalée', () => {
  const errors = checkReferences(broken((c) => {
    c.quests.courrier.steps.atp.objective.card = 'cadavre';
  }));
  hasError(errors, /^quests\.courrier\.steps\.atp\.objective\.card : carte inconnue « cadavre » \(paquet atp\)/);
});

test('tuiles : il faut les 19 hexagones et un terrain connu', () => {
  const errors = checkTiles(broken((c) => {
    delete c.tiles.cordon.hexes[7];
    c.tiles.cordon.hexes[20] = { terrain: 'herbe' };
    c.tiles.decharge.hexes[3].terrain = 'lave';
  }));
  hasError(errors, /^tiles\.cordon\.hexes : hexagone 7 manquant/);
  hasError(errors, /^tiles\.cordon\.hexes : hexagone 20 hors tuile/);
  hasError(errors, /^tiles\.decharge\.hexes\.3\.terrain : terrain inconnu « lave »/);
});

test('lieux : un lieu hors des hexagones 1-19 de sa tuile est signalé', () => {
  const errors = checkPlaces(broken((c) => { c.places.atp.hex = 20; }));
  hasError(errors, /^places\.atp\.hex : 20 n'est pas un hexagone de la tuile cordon/);
});

test('lieux : deux lieux sur le même hexagone sont signalés', () => {
  const errors = checkPlaces(broken((c) => { c.places.atp.hex = 1; }));
  hasError(errors, /^places\.atp\.hex : hexagone 1 de cordon déjà pris par camp/);
});

test('liaisons : un hexagone qui n’est pas de bord est signalé, des deux côtés', () => {
  const errors = checkLinks(broken((c) => {
    c.links.cordon = { 2: { tile: 'decharge', hex: 4 } };
  }));
  hasError(errors, /^links\.cordon\.2 : hexagone 2 de cordon n'est pas de bord/);
  hasError(errors, /^links\.cordon\.2 : hexagone 4 de decharge n'est pas de bord/);
});

test('liaisons : une tuile inconnue est signalée', () => {
  const errors = checkLinks(broken((c) => { c.links.cordon[19].tile = 'yantar'; }));
  hasError(errors, /^links\.cordon\.19 : tuile inconnue « yantar »/);
});

test('liaisons : une liaison sans retour est signalée', () => {
  const errors = checkLinks(broken((c) => { c.links.decharge = {}; }));
  hasError(errors, /^links\.cordon\.19 : pas de retour depuis decharge\.13/);
});

test('liaisons : un retour vers un autre hexagone est signalé', () => {
  const errors = checkLinks(broken((c) => { c.links.decharge[13].hex = 18; }));
  hasError(errors, /^links\.cordon\.19 : le retour depuis decharge\.13 mène à cordon\.18/);
});

test('quêtes : un graphe d’étapes sans fin est signalé', () => {
  const errors = checkQuests(broken((c) => { c.quests.courrier.steps.rapport.next = ['atp']; }));
  hasError(errors, /^quests\.courrier : étapes sans issue vers une fin : atp, rapport/);
});

test('quêtes : une étape suivante inconnue, une étape de départ inconnue, une étape orpheline', () => {
  hasError(
    checkQuests(broken((c) => { c.quests.courrier.steps.atp.next = ['ailleurs']; })),
    /^quests\.courrier\.steps\.atp\.next\[0\] : étape inconnue « ailleurs »/,
  );
  hasError(
    checkQuests(broken((c) => { c.quests.courrier.start = 'debut'; })),
    /^quests\.courrier\.start : étape inconnue « debut »/,
  );
  hasError(
    checkQuests(broken((c) => { c.quests.courrier.steps.bonus = { objective: { type: 'visiter', place: 'camp' }, next: [] }; })),
    /^quests\.courrier\.steps\.bonus : étape orpheline/,
  );
});

test('quêtes : un type d’objectif inconnu est signalé', () => {
  const errors = checkQuests(broken((c) => { c.quests.courrier.steps.atp.objective.type = 'voler'; }));
  hasError(errors, /^quests\.courrier\.steps\.atp\.objective\.type : objectif inconnu « voler »/);
});

test('dialogues : un nœud orphelin est signalé', () => {
  const errors = checkDialogues(broken((c) => {
    c.dialogues.marchand.nodes.oubli = { text: '…', choices: [] };
  }));
  hasError(errors, /^dialogues\.marchand\.nodes\.oubli : nœud orphelin/);
});

test('dialogues : un lien cassé et un départ inconnu sont signalés', () => {
  hasError(
    checkDialogues(broken((c) => { c.dialogues.marchand.nodes.accueil.choices[0].next = 'boutique'; })),
    /^dialogues\.marchand\.nodes\.accueil\.choices\[0\]\.next : nœud inconnu « boutique »/,
  );
  hasError(
    checkDialogues(broken((c) => { c.dialogues.marchand.start = 'bonjour'; })),
    /^dialogues\.marchand\.start : nœud inconnu « bonjour »/,
  );
});

test('validateContent réunit les erreurs de toutes les règles', () => {
  const errors = validateContent(broken((c) => {
    c.places.atp.hex = 0;
    c.npcs.marchand.dialogue = 'barman';
  }));
  hasError(errors, /^places\.atp\.hex/);
  hasError(errors, /^npcs\.marchand\.dialogue : dialogue inconnu « barman »/);
});
