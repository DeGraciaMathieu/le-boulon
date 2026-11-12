// Séquenceur d'événements (direction plateau, lot L1 ; proposition §4). Une file qui reçoit les
// événements d'un step et joue, l'un après l'autre, l'animation enregistrée pour chaque type
// d'événement, puis rend la main. L'état final est déjà dessiné quand la file joue : une
// animation ne fait que montrer le passage vers cet état, elle ne touche jamais la campagne.
//
//   const sequencer = createSequencer();
//   sequencer.register(type, play, { duration, reduced, finish });
//   await sequencer.play(events);     // joue la file ; se résout quand elle est vide
//   sequencer.skip();                 // accélère : finit l'animation en cours, saute les suivantes
//   sequencer.busy                    // vrai tant qu'une séquence joue
//
// ENREGISTRER UNE ANIMATION (lots futurs : L2 piste de PA, L3 dés, L5 cartes, L6 plateau) :
//
//   sequencer.register('moved', async (event, ctx) => {
//     cube.classList.add('glisse');               // A1 : un cube quitte la piste
//     await ctx.wait(ctx.duration);               // se résout tout de suite si le joueur accélère
//   }, {
//     duration: 350,                              // ms, ou (event) => ms ; DEFAULT_MS sinon
//     finish: (event) => cube.classList.remove('glisse'),  // état final si l'on accélère
//     reduced: (event, ctx) => fade(cube),        // mode réduit : fondu de REDUCED_MS ; absent = rien
//   });
//
//   play(event, ctx) reçoit l'événement du moteur tel quel et ctx :
//     ctx.duration  durée prévue (au plus REDUCED_MS en mode réduit)
//     ctx.signal    AbortSignal, déclenché quand le joueur accélère
//     ctx.wait(ms)  attente coupée par l'accélération
//     ctx.reduced   vrai en mode réduit
//   Le pas dure jusqu'à ce que la promesse de play soit tenue ET que duration soit écoulée : une
//   animation CSS posée sans attendre (classe relancée) tient donc sa place dans la file.
//   Une seule animation par type : un second register du même type remplace le premier.
//   Un type sans animation enregistrée est sauté sans attente.
//
// ACCÉLÉRER : skip() coupe l'attente en cours, appelle finish de l'événement en cours puis de
// chacun des suivants (sans les jouer), et la file se vide. campagne.js l'appelle sur tout clic
// ou toute touche pendant une séquence ; ce clic ou cette touche n'atteint pas le jeu.
//
// MODE RÉDUIT : si <html> porte la classe animations-reduites (REDUCED_CLASS, animations.js) ou si le système demande
// prefers-reduced-motion, chaque pas joue reduced (fondu de REDUCED_MS, voir fade) ou rien.
//
// ERREURS : une animation qui lève ou rejette est signalée à onError (console.error par défaut)
// et la file continue.

import { REDUCED_CLASS } from './animations.js';

export const DEFAULT_MS = 300;
export const REDUCED_MS = 120;

function systemReduced() {
  const root = globalThis.document?.documentElement;
  if (root?.classList.contains(REDUCED_CLASS)) return true;
  return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

// Attente coupée par le signal : se résout (jamais ne rejette) à la fin du délai ou à l'abandon.
function abortableWait(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted || ms <= 0) return resolve();
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
  });
}

// Fondu d'apparition du mode réduit, par l'API Web Animations ; sans elle, rien.
export function fade(node, ms = REDUCED_MS) {
  return node?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease-out' }).finished.catch(() => {});
}

export function createSequencer({ isReduced = systemReduced, onError = (error) => console.error(error) } = {}) {
  const registry = new Map();
  const queue = [];
  let running = null;
  let controller = null;
  let skipping = false;

  function guard(fn, ...args) {
    try {
      return Promise.resolve(fn?.(...args)).catch(onError);
    } catch (error) {
      onError(error);
      return Promise.resolve();
    }
  }

  async function playOne(event, entry) {
    const reduced = isReduced();
    const play = reduced ? entry.reduced : entry.play;
    if (!play) return;
    const planned = typeof entry.duration === 'function' ? entry.duration(event) : entry.duration;
    const duration = Math.min(planned ?? DEFAULT_MS, reduced ? REDUCED_MS : Infinity);
    controller = new AbortController();
    const { signal } = controller;
    const wait = (ms) => abortableWait(ms, signal);
    const ctx = { duration, signal, wait, reduced };
    const stopped = new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
    await Promise.race([Promise.all([guard(play, event, ctx), wait(duration)]), stopped]);
    if (signal.aborted) await guard(entry.finish, event);
  }

  async function run() {
    // Rend la main avant de jouer : play a mémorisé running avant que la file puisse se vider.
    await null;
    while (queue.length) {
      const event = queue.shift();
      const entry = registry.get(event.type);
      if (!entry) continue;
      if (skipping) await guard(entry.finish, event);
      else await playOne(event, entry);
    }
    controller = null;
    skipping = false;
    running = null;
  }

  return {
    register(type, play, { duration, reduced, finish } = {}) {
      registry.set(type, { play, duration, reduced, finish });
    },
    // Ajoute les événements à la file ; la promesse se tient quand la file est vide.
    play(events) {
      queue.push(...events);
      running ??= run();
      return running;
    },
    skip() {
      if (!running) return;
      skipping = true;
      controller?.abort();
    },
    get busy() {
      return running !== null;
    },
  };
}
