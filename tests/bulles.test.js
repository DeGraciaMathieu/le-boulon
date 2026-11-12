import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, dayState } from '../src/engine/campaign.js';
import { distance } from '../src/engine/hex.js';
import { HELP_SECTIONS } from '../src/ui/aide.js';
import { TRIGGERS, nextBubble, readSeen, saveSeen, BUBBLES_KEY } from '../src/ui/bulles.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const fresh = () => jsonCopy(createCampaign({ seed: 1 }));
const tileOf = (campaign) => campaign.world.tiles[campaign.world.currentTile];
const ctxOf = (campaign, events = []) => ({ campaign, day: dayState(campaign), events });
const help = (term) => HELP_SECTIONS.flatMap((section) => section.entries).find((entry) => entry.term === term).text;
const ids = (seen) => new Set(seen);

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
}

test('bulles : chaque déclencheur a un id unique', () => {
  const all = TRIGGERS.map((trigger) => trigger.id);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual([...all].sort(), ['carte-zone', 'combat', 'emission', 'pa-bas', 'rencontre', 'suspect', 'test']);
});

test('bulles : le « ! » proche passe avant le « ? », puis le « ? » le plus proche', () => {
  const campaign = fresh();
  const day = dayState(campaign);
  const first = nextBubble(TRIGGERS, ctxOf(campaign), ids());
  assert.equal(first.id, 'rencontre');
  assert.equal(first.text, help('!'));
  const hex = Number(first.target.match(/data-hex="(\d+)"/)[1]);
  assert.ok(distance(day.player.hex, hex) <= 2);

  const second = nextBubble(TRIGGERS, ctxOf(campaign), ids(['rencontre']));
  assert.equal(second.id, 'suspect');
  assert.equal(second.text, help('?'));
  const token = Number(second.target.match(/data-hex="(\d+)"/)[1]);
  const closest = Math.min(...day.tokens.filter((t) => !t.revealed).map((t) => distance(day.player.hex, t.hex)));
  assert.equal(distance(day.player.hex, token), closest);
  assert.match(second.target, /\.jeton\.suspect\.cache/);
});

test('bulles : une bulle vue ne revient pas ; rien de dû, rien à montrer', () => {
  const campaign = fresh();
  tileOf(campaign).encounters = [];
  tileOf(campaign).tokens = tileOf(campaign).tokens.map((token) => ({ ...token, revealed: true }));
  assert.equal(nextBubble(TRIGGERS, ctxOf(campaign), ids()), null);
  assert.equal(nextBubble(TRIGGERS, ctxOf(fresh()), ids(TRIGGERS.map((t) => t.id))), null);
});

test('bulles : premier test et première carte Zone, lus dans les événements du step', () => {
  const campaign = fresh();
  const seen = ids(['rencontre', 'suspect']);
  const check = nextBubble(TRIGGERS, ctxOf(campaign, [{ type: 'check', stat: 'discretion', roll: 3, bonus: 0, target: 5, success: false }]), seen);
  assert.equal(check.id, 'test');
  assert.equal(check.target, 'section.bac');
  assert.match(check.text, /1d6 \+ compétence ≥ 5/);
  const card = nextBubble(TRIGGERS, ctxOf(campaign, [{ type: 'zone-card', card: 'calme' }]), seen);
  assert.equal(card.id, 'carte-zone');
  assert.equal(card.text, help('Carte Zone'));
});

test('bulles : Émission annoncée et combat pointent le bandeau et la fenêtre', () => {
  const campaign = fresh();
  campaign.world.emission = { ...campaign.world.emission, today: true };
  const emission = nextBubble(TRIGGERS, ctxOf(campaign), ids());
  assert.equal(emission.id, 'emission');
  assert.equal(emission.text, help('Émission'));
  campaign.combat = { enemies: [] };
  const combat = nextBubble(TRIGGERS, ctxOf(campaign), ids());
  assert.equal(combat.id, 'combat');
  assert.match(combat.text, /^Tirer : 1d6 \+ Tir/);
  assert.match(combat.text, /Fuir : 2 PA\.$/);
});

test('bulles : PA ≤ 3 loin du hub, le rappel de retour et la règle du bivouac forcé', () => {
  const campaign = fresh();
  const seen = ids(['rencontre', 'suspect']);
  assert.equal(nextBubble(TRIGGERS, ctxOf(campaign), seen), null);
  // Hexagone 19 de la tuile de départ : le hub est à 3 PA, plus que les 2 PA restants.
  tileOf(campaign).ap = { ...tileOf(campaign).ap, left: 2 };
  tileOf(campaign).player = { ...tileOf(campaign).player, hex: 19 };
  campaign.world.hex = 19;
  const low = nextBubble(TRIGGERS, ctxOf(campaign), seen);
  assert.equal(low?.id, 'pa-bas');
  assert.equal(low.target, '#commandes .rappel-hub');
  assert.match(low.text, /^Le hub est à \d+ PA .* À 0 PA, bivouac forcé là où l'on est\.$/);
});

test('bulles : rien sur le plateau hors de la tuile', () => {
  const campaign = fresh();
  campaign.screen = 'hub';
  assert.equal(nextBubble(TRIGGERS, ctxOf(campaign), ids()), null);
});

test('bulles : mémoire en localStorage, effaçable, muette si le stockage est bloqué', () => {
  const storage = memoryStorage();
  assert.equal(readSeen(storage).size, 0);
  assert.equal(saveSeen(storage, ids(['suspect', 'test'])), true);
  assert.deepEqual([...readSeen(storage)], ['suspect', 'test']);
  assert.equal(storage.getItem(BUBBLES_KEY), '["suspect","test"]');
  saveSeen(storage, ids());
  assert.equal(readSeen(storage).size, 0);
  const blocked = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); } };
  assert.equal(readSeen(blocked).size, 0);
  assert.equal(saveSeen(blocked, ids(['test'])), false);
  storage.setItem(BUBBLES_KEY, '{pas du json');
  assert.equal(readSeen(storage).size, 0);
});
