import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSequencer, REDUCED_MS } from '../src/ui/sequencer.js';

const quiet = () => {};

test('séquenceur : joue les animations une à une, dans l’ordre des événements', async () => {
  const sequencer = createSequencer({ isReduced: () => false, onError: quiet });
  const log = [];
  const record = (name, ms) => async (event) => {
    log.push(`début ${name}${event.n}`);
    await new Promise((resolve) => setTimeout(resolve, ms));
    log.push(`fin ${name}${event.n}`);
  };
  sequencer.register('a', record('a', 15), { duration: 0 });
  sequencer.register('b', record('b', 1), { duration: 0 });
  const played = sequencer.play([{ type: 'a', n: 1 }, { type: 'inconnu' }, { type: 'b', n: 2 }, { type: 'a', n: 3 }]);
  assert.equal(sequencer.busy, true);
  await played;
  assert.equal(sequencer.busy, false);
  assert.deepEqual(log, ['début a1', 'fin a1', 'début b2', 'fin b2', 'début a3', 'fin a3']);
});

test('séquenceur : une animation sans attente tient sa durée dans la file', async () => {
  const sequencer = createSequencer({ isReduced: () => false });
  sequencer.register('a', () => {}, { duration: 40 });
  const begin = Date.now();
  await sequencer.play([{ type: 'a' }]);
  assert.ok(Date.now() - begin >= 35);
});

test('séquenceur : durée selon l’événement', async () => {
  const sequencer = createSequencer({ isReduced: () => false });
  const seen = [];
  sequencer.register('a', (event, ctx) => { seen.push(ctx.duration); }, { duration: (event) => event.ms });
  await sequencer.play([{ type: 'a', ms: 0 }, { type: 'a', ms: 5 }]);
  assert.deepEqual(seen, [0, 5]);
});

test('séquenceur : sans événement animé, la main revient aussitôt', async () => {
  const sequencer = createSequencer({ isReduced: () => false });
  await sequencer.play([{ type: 'rien' }]);
  assert.equal(sequencer.busy, false);
  await sequencer.play([]);
  assert.equal(sequencer.busy, false);
});

test('séquenceur : accélérer finit l’animation en cours et saute les suivantes à leur état final', async () => {
  const sequencer = createSequencer({ isReduced: () => false });
  const log = [];
  sequencer.register('long', async (event, ctx) => {
    log.push(`joue ${event.n}`);
    await ctx.wait(10_000);
    log.push(ctx.signal.aborted ? `coupée ${event.n}` : `entière ${event.n}`);
  }, { duration: 10_000, finish: (event) => log.push(`finale ${event.n}`) });
  const begin = Date.now();
  const played = sequencer.play([{ type: 'long', n: 1 }, { type: 'long', n: 2 }, { type: 'long', n: 3 }]);
  setTimeout(() => sequencer.skip(), 10);
  await played;
  assert.ok(Date.now() - begin < 1000);
  assert.deepEqual(log, ['joue 1', 'coupée 1', 'finale 1', 'finale 2', 'finale 3']);
  assert.equal(sequencer.busy, false);
});

test('séquenceur : après une accélération, la séquence suivante joue normalement', async () => {
  const sequencer = createSequencer({ isReduced: () => false });
  const log = [];
  sequencer.register('a', (event, ctx) => ctx.wait(10_000).then(() => log.push(ctx.signal.aborted ? 'coupée' : 'jouée')), { duration: 0 });
  sequencer.register('b', () => log.push('b'), { duration: 0 });
  const first = sequencer.play([{ type: 'a' }]);
  setTimeout(() => sequencer.skip(), 5);
  await first;
  await sequencer.play([{ type: 'b' }]);
  assert.deepEqual(log, ['coupée', 'b']);
});

test('séquenceur : skip sans séquence ne fait rien', async () => {
  const sequencer = createSequencer({ isReduced: () => false });
  const log = [];
  sequencer.register('a', () => log.push('a'), { duration: 0 });
  sequencer.skip();
  await sequencer.play([{ type: 'a' }]);
  assert.deepEqual(log, ['a']);
});

test('séquenceur : mode réduit, le fondu remplace l’animation, ou rien', async () => {
  const sequencer = createSequencer({ isReduced: () => true });
  const log = [];
  sequencer.register('a', () => log.push('animation a'), { duration: 5000, reduced: (event, ctx) => log.push(`fondu ${ctx.duration} ${ctx.reduced}`) });
  sequencer.register('b', () => log.push('animation b'), { duration: 5000 });
  const begin = Date.now();
  await sequencer.play([{ type: 'a' }, { type: 'b' }]);
  assert.deepEqual(log, [`fondu ${REDUCED_MS} true`]);
  assert.ok(Date.now() - begin < 1000);
});

test('séquenceur : le mode réduit se lit à chaque pas', async () => {
  let reduced = false;
  const sequencer = createSequencer({ isReduced: () => reduced });
  const log = [];
  sequencer.register('a', () => { log.push('animation'); reduced = true; }, { duration: 0, reduced: () => log.push('fondu') });
  await sequencer.play([{ type: 'a' }, { type: 'a' }]);
  assert.deepEqual(log, ['animation', 'fondu']);
});

test('séquenceur : une animation qui échoue ne bloque pas la file', async () => {
  const errors = [];
  const sequencer = createSequencer({ isReduced: () => false, onError: (error) => errors.push(error.message) });
  const log = [];
  sequencer.register('lève', () => { throw new Error('lève'); }, { duration: 0 });
  sequencer.register('rejette', async () => { throw new Error('rejette'); }, { duration: 0 });
  sequencer.register('ok', () => log.push('ok'), { duration: 0 });
  await sequencer.play([{ type: 'lève' }, { type: 'rejette' }, { type: 'ok' }]);
  assert.deepEqual(errors, ['lève', 'rejette']);
  assert.deepEqual(log, ['ok']);
  assert.equal(sequencer.busy, false);
});

test('séquenceur : un finish qui échoue n’empêche pas les suivants', async () => {
  const errors = [];
  const sequencer = createSequencer({ isReduced: () => false, onError: (error) => errors.push(error.message) });
  const log = [];
  sequencer.register('a', (event, ctx) => ctx.wait(10_000), { duration: 0, finish: () => { throw new Error('finish'); } });
  sequencer.register('b', () => log.push('joue b'), { duration: 0, finish: () => log.push('finale b') });
  const played = sequencer.play([{ type: 'a' }, { type: 'b' }]);
  setTimeout(() => sequencer.skip(), 5);
  await played;
  assert.deepEqual(errors, ['finish']);
  assert.deepEqual(log, ['finale b']);
});

test('séquenceur : des événements ajoutés pendant une séquence passent à la suite', async () => {
  const sequencer = createSequencer({ isReduced: () => false });
  const log = [];
  sequencer.register('a', (event) => log.push(event.n), { duration: 5 });
  const first = sequencer.play([{ type: 'a', n: 1 }]);
  const second = sequencer.play([{ type: 'a', n: 2 }]);
  assert.equal(first, second);
  await second;
  assert.deepEqual(log, [1, 2]);
});
