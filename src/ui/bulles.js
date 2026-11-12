// Bulles contextuelles (direction plateau, lot L7 ; proposition §5 outil 3) : à la première
// rencontre d'une règle, une bulle pointe l'objet concerné et dit la règle en une phrase, une
// seule fois. Pures : pas de DOM (testées par tests/bulles.test.js). Vue : bulles-view.js.
//
//   TRIGGERS  registre des déclencheurs, dans l'ordre de priorité :
//     { id, find(ctx) -> null | { target, text } }
//     ctx : { campaign, day, events }  la campagne, dayState(campaign), les événements du dernier step
//     target : sélecteur CSS de l'objet pointé ; text : la règle, tirée d'aide.js et du moteur
//   nextBubble(triggers, ctx, seen) -> null | { id, target, text }   première bulle due et pas vue
//   readSeen(storage) / saveSeen(storage, ids)   ids des bulles déjà montrées, en localStorage sous
//     try/catch (BUBBLES_KEY), globalement : une règle apprise l'est pour toutes les campagnes.
//     L'onglet Aide du PDA les efface (« Revoir les bulles »).
//
// Le tutoriel joué (L8) ajoute ses propres déclencheurs au registre (bulles-view.js : register) ou
// appelle showBubble directement.

import { distance } from '../engine/hex.js';
import { HELP_SECTIONS, CHECK_TARGET } from './aide.js';
import { returnReminder } from './cycle.js';

export const BUBBLES_KEY = 'le-boulon.bulles';

const help = (term) => HELP_SECTIONS.flatMap((section) => section.entries).find((entry) => entry.term === term).text;

// Les déclencheurs du plateau ne jouent que sur la tuile, journée en cours, hors combat et dialogue.
const onBoard = ({ campaign, day }) => campaign.screen === 'tile' && day.status === 'playing' && !campaign.combat && !campaign.dialogue && !day.combat;

const nearest = (list, from) => [...list].sort((a, b) => distance(from, a.hex) - distance(from, b.hex))[0];

// Pas assez pour qu'un « ! » voisin ait déjà joué son test : on prévient un pas avant.
const ENCOUNTER_RANGE = 2;

export const TRIGGERS = Object.freeze([
  {
    id: 'combat',
    find: ({ campaign }) => campaign.combat && {
      target: '.fenetre-combat .combat-etat',
      text: `Tirer : ${help('Tirer')} Combattre : ${help('Combattre')}.`,
    },
  },
  {
    id: 'emission',
    find: ({ campaign }) => campaign.world.emission?.today && {
      target: '#bandeau .bandeau-emission',
      text: help('Émission'),
    },
  },
  {
    id: 'test',
    find: ({ events }) => events.some((event) => event.type === 'check') && {
      target: 'section.bac',
      text: `Test : 1d6 + compétence ≥ ${CHECK_TARGET}. Le dé roule ici ; survolez la phrase du jet pour son détail.`,
    },
  },
  {
    id: 'carte-zone',
    find: ({ events }) => events.some((event) => event.type === 'zone-card') && {
      target: '#bandeau .piste-pa .depenses',
      text: help('Carte Zone'),
    },
  },
  {
    id: 'rencontre',
    find: (ctx) => {
      if (!onBoard(ctx)) return null;
      const { day } = ctx;
      const close = (day.encounters ?? []).filter((e) => e.card === null && distance(day.player.hex, e.hex) <= ENCOUNTER_RANGE);
      const encounter = nearest(close, day.player.hex);
      return encounter && { target: `#plateau polygon[data-hex="${encounter.hex}"]`, text: help('!') };
    },
  },
  {
    id: 'suspect',
    find: (ctx) => {
      if (!onBoard(ctx)) return null;
      const { day } = ctx;
      const token = nearest((day.tokens ?? []).filter((t) => !t.revealed), day.player.hex);
      return token && { target: `#plateau .jeton.suspect.cache[data-hex="${token.hex}"]`, text: help('?') };
    },
  },
  {
    id: 'pa-bas',
    find: (ctx) => {
      const reminder = onBoard(ctx) && returnReminder(ctx.campaign);
      return reminder && { target: '#commandes .rappel-hub', text: `${reminder.text} ${help('Journée').split('. ').pop()}` };
    },
  },
]);

export function nextBubble(triggers, ctx, seen) {
  for (const trigger of triggers) {
    if (seen.has(trigger.id)) continue;
    const found = trigger.find(ctx);
    if (found) return { id: trigger.id, ...found };
  }
  return null;
}

export function readSeen(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(BUBBLES_KEY) ?? '[]');
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

export function saveSeen(storage, ids) {
  try {
    (storage ?? globalThis.localStorage).setItem(BUBBLES_KEY, JSON.stringify([...ids]));
    return true;
  } catch {
    return false;
  }
}
