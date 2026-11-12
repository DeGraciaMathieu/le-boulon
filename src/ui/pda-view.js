// Écran PDA (brief v2 §16, §8.5 ; carte 28) : onglets Quêtes, Journal, Factions, Fiche. Lit les
// lectures de pda.js ; les seules actions envoyées sont celles de la fiche, raise-stat et
// learn-perk (rules/progression.js).

import { h, mountScreen } from './screen.js';
import { PDA_TABS, pdaQuests, pdaJournal, pdaFactions, pdaSheet } from './pda.js';
import { REPUTATION_MIN, REPUTATION_MAX } from '../engine/rules/factions.js';

const empty = (text) => h('p', { className: 'vide', textContent: text });

const TABS = {
  quetes: renderQuests,
  journal: renderJournal,
  factions: renderFactions,
  fiche: renderSheet,
};

// dispatch(action) : envoie une action à la campagne (campagne.js).
export function mountPda(root, toggle, { dispatch }) {
  const screen = mountScreen(root, toggle, 'PDA');
  const tabs = h('nav', { className: 'onglets' });
  const content = h('div', { className: 'onglet-contenu' });
  screen.body.append(tabs, content);
  let current = PDA_TABS[0].id;
  let campaign;

  function render(next = campaign) {
    campaign = next;
    tabs.replaceChildren(...PDA_TABS.map(({ id, label }) => h('button', {
      type: 'button',
      className: id === current ? 'actif' : '',
      textContent: label,
      onclick: () => { current = id; render(); },
    })));
    content.replaceChildren(...TABS[current](campaign, dispatch));
  }
  return { render };
}

function renderQuests(campaign) {
  const { active, done, failed } = pdaQuests(campaign);
  const quest = (entry) => h('li', { className: 'quete' },
    h('div', { className: 'quete-nom', textContent: entry.name }),
    h('div', { textContent: `▸ ${entry.objective}` }),
    entry.place ? h('div', { className: 'quete-lieu', textContent: `Cible : ${entry.place}` }) : null,
    entry.deadline ? h('div', { className: 'alerte', textContent: entry.deadline }) : null,
    entry.options.length ? h('div', { className: 'alerte', textContent: `Choix en attente : ${entry.options.join(' / ')}` }) : null);
  const closed = (title, entries, line) => (entries.length
    ? [h('h3', { textContent: title }), h('ul', {}, ...entries.map((entry) => h('li', { textContent: line(entry) })))]
    : []);
  return [
    h('h3', { textContent: 'Actives' }),
    active.length ? h('ul', {}, ...active.map(quest)) : empty('Aucune quête en cours.'),
    ...closed('Terminées', done, (entry) => entry.name),
    ...closed('Ratées', failed, (entry) => `${entry.name} (${entry.reason})`),
  ];
}

function renderJournal(campaign) {
  const lines = pdaJournal(campaign);
  if (lines.length === 0) return [empty('Journal vide.')];
  return [h('ol', { className: 'pda-journal' }, ...lines.map(({ day, text }) => h('li', { textContent: `J${day} · ${text}` })))];
}

function renderFactions(campaign) {
  const track = (value) => {
    const cells = [];
    for (let n = REPUTATION_MIN; n <= REPUTATION_MAX; n += 1) {
      cells.push(h('span', { className: `cran${n === value ? ' atteint' : ''}${n === 0 ? ' zero' : ''}`, textContent: n > 0 ? `+${n}` : String(n) }));
    }
    return h('div', { className: 'piste' }, ...cells);
  };
  return [h('table', { className: 'factions' },
    ...pdaFactions(campaign).map((faction) => h('tr', { className: `palier-${faction.standing.toLowerCase()}` },
      h('th', { textContent: faction.name + (faction.member ? ' ★' : '') }),
      h('td', {}, track(faction.reputation)),
      h('td', { className: 'palier', textContent: faction.standing }))))];
}

function renderSheet(campaign, dispatch) {
  const sheet = pdaSheet(campaign);
  const button = (label, action) => h('button', { type: 'button', textContent: label, onclick: () => dispatch(action) });
  const xp = sheet.nextRank ? `${sheet.xp} / ${sheet.nextRank.xp} XP (${sheet.nextRank.name})` : `${sheet.xp} XP`;
  return [
    h('div', { className: 'fiche-rang' },
      h('span', { className: 'fiche-valeur', textContent: sheet.rank }),
      h('span', { textContent: xp })),
    h('div', { textContent: `Faction : ${sheet.faction} · Blessures ${sheet.wounds} · Radiations ${sheet.radiation}` }),
    h('h3', { textContent: `Stats${sheet.statPoints > 0 ? ` · ${sheet.statPoints} point(s) à dépenser` : ''}` }),
    h('table', { className: 'stats' }, ...sheet.stats.map((stat) => h('tr', {},
      h('th', { textContent: stat.label }),
      h('td', { className: 'fiche-valeur', textContent: stat.value }),
      h('td', {}, stat.canRaise ? button('+1', { type: 'raise-stat', stat: stat.id }) : null)))),
    h('h3', { textContent: 'Savoir-faire' }),
    sheet.perks.length
      ? h('ul', {}, ...sheet.perks.map((perk) => h('li', { textContent: `${perk.name} : ${perk.effect}` })))
      : empty('Aucun savoir-faire.'),
    ...(sheet.perkPicks > 0 ? [
      h('h3', { textContent: `${sheet.perkPicks} savoir-faire à choisir` }),
      h('ul', { className: 'choix-savoir-faire' }, ...sheet.available.map((perk) => h('li', {},
        button('Apprendre', { type: 'learn-perk', perk: perk.id }),
        ` ${perk.name} : ${perk.effect}`))),
    ] : []),
  ];
}
