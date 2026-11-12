// Écrans Titre, Fin de journée, Nuit, Réveil, Mort et Fin de campagne (brief v2 §15, §16 ;
// carte 29), en HTML, dans une couche posée sur la table (section #ecran de campagne.html).
// Chaque fonction redessine la section à partir d'une lecture pure (cycle.js, deathView de
// rules/death.js) et ne fait qu'appeler ses gestionnaires : rien ici ne modifie la campagne,
// ni le stockage. campagne.js choisit l'écran à montrer.
//
// API (section : l'élément #ecran ; on : gestionnaires de l'écran) :
//   renderTitle(section, { slots, error }, { start(mode, seedText), load(slot), import(file) })
//   renderCamp(section, preview, { confirm(), cancel() })
//   renderNight(section, night, summary, { wake() })
//   renderWake(section, report, { close() })
//   renderDeath(section, death, cause, { respawn(), title() })
//   renderEnding(section, ending, { close(), title() })

import content from '../content/index.js';

const itemName = (kind) => content.items[kind]?.name ?? kind;

const CAUSES = {
  combat: 'tué au combat', nuit: 'mort dans la nuit', faim: 'mort de faim', radiation: 'tué par les radiations',
  emission: 'tué par l’Émission', piege: 'tué par un piège', marais: 'englouti par le marais',
  bruleuse: 'pris par une anomalie', electro: 'pris par une anomalie', gravitationnelle: 'pris par une anomalie',
};

function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

const button = (label, onclick, attrs = {}) => h('button', { type: 'button', textContent: label, onclick, ...attrs });
const line = (label, value, cls = '') => h('div', { className: `ecran-ligne ${cls}` },
  h('span', { className: 'ecran-label', textContent: label }),
  h('span', { className: 'ecran-valeur', textContent: value }));

function card(section, kind, ...children) {
  section.dataset.ecran = kind;
  section.replaceChildren(h('div', { className: `ecran-carte ecran-${kind}` }, ...children));
}

export function renderTitle(section, { slots, error }, on) {
  const seed = h('input', { type: 'text', inputMode: 'numeric', placeholder: 'au hasard', id: 'graine', size: 12 });
  const file = h('input', { type: 'file', accept: 'application/json,.json', id: 'importer' });
  file.addEventListener('change', () => file.files[0] && on.import(file.files[0]));
  card(section, 'titre',
    h('h1', { textContent: 'LE BOULON' }),
    h('p', { className: 'ecran-sous-titre', textContent: 'Campagne dans la Zone' }),
    h('h2', { textContent: 'Nouvelle partie' }),
    h('label', { className: 'ecran-graine' }, 'Graine ', seed),
    h('div', { className: 'ecran-boutons' },
      button('Normal', () => on.start('normal', seed.value), { id: 'nouvelle-normal' }),
      button('Hardcore', () => on.start('hardcore', seed.value), { id: 'nouvelle-hardcore' })),
    h('p', { className: 'aide', textContent: 'Normal : à la mort, réveil au dernier hub visité. Hardcore : la mort efface la sauvegarde.' }),
    h('h2', { textContent: 'Charger' }),
    h('ul', { className: 'ecran-emplacements' }, ...slots.map((slot) => h('li', { className: slot.empty || slot.error ? 'vide' : '' },
      button(slot.label, () => on.load(slot.slot), { disabled: slot.empty || slot.error }),
      h('span', { className: slot.error ? 'alerte' : 'ecran-detail', textContent: slot.detail })))),
    h('h2', { textContent: 'Importer' }),
    h('label', { className: 'ecran-import' }, 'Fichier de sauvegarde (JSON) ', file),
    error && h('p', { className: 'alerte', role: 'alert', textContent: error }));
}

export function renderCamp(section, preview, on) {
  card(section, 'bivouac',
    h('h2', { textContent: 'Finir la journée' }),
    line('Bivouac', preview.label),
    line('PA perdus', preview.apLost),
    preview.malus > 0 && line('Demain', `−${preview.malus} PA (nuit à découvert, test de Discrétion)`, 'alerte'),
    h('p', { className: 'aide', textContent: 'La carte Nuit est piochée au réveil. Le lit d’un hub soigne et évite la carte Nuit.' }),
    h('div', { className: 'ecran-boutons' }, button('Bivouaquer', on.confirm, { id: 'bivouaquer' }), button('Annuler', on.cancel)));
}

export function renderNight(section, night, summary, on) {
  const rows = [
    summary.moves > 0 && line('Déplacements', summary.moves),
    summary.tiles.length > 0 && line('Voyages', summary.tiles.join(', ')),
    summary.victories > 0 && line('Combats gagnés', summary.victories),
    summary.roubles !== 0 && line('Roubles', signed(summary.roubles)),
    summary.xp > 0 && line('XP', `+${summary.xp}`),
    summary.wounds > 0 && line('Blessures', `+${summary.wounds}`, 'alerte'),
    summary.radiation > 0 && line('Radiations', `+${summary.radiation}`, 'alerte'),
    summary.items.length > 0 && line('Trouvé', summary.items.join(', ')),
    summary.quests.length > 0 && line('Quêtes finies', summary.quests.join(', ')),
  ].filter(Boolean);
  card(section, 'nuit',
    h('h2', { textContent: 'La nuit tombe' }),
    line('Repos', night.place ? `${night.label} : ${night.place}` : night.label),
    h('p', { className: 'aide', textContent: night.cardDrawn ? 'Pas de carte Nuit.' : 'Carte Nuit au réveil.' }),
    h('h3', { textContent: 'Résumé de la journée' }),
    rows.length ? h('div', { className: 'ecran-resume' }, ...rows) : h('p', { className: 'aide', textContent: 'Une journée sans histoire.' }),
    h('div', { className: 'ecran-boutons' }, button('Se réveiller', on.wake, { id: 'reveil' })));
}

export function renderWake(section, report, on) {
  card(section, 'reveil',
    h('h2', { textContent: `Jour ${report.day}` }),
    report.night && line('Carte Nuit', report.night),
    report.encounter && line('Nuit', 'rencontre repoussée', 'alerte'),
    line('Météo', report.weather),
    report.meal ? line('Repas', report.meal) : line('Faim', `${report.hunger} jour(s) sans manger`, 'alerte'),
    report.wounds > 0 && line('Blessures', `+${report.wounds}`, 'alerte'),
    report.radiation > 0 && line('Radiations', `+${report.radiation}`, 'alerte'),
    h('div', { className: 'ecran-pa' }, h('span', { textContent: report.ap }), ' PA aujourd’hui'),
    h('div', { className: 'ecran-boutons' }, button('Partir', on.close, { id: 'partir' })));
}

export function renderDeath(section, death, cause, on) {
  const title = h('h2', { className: 'alerte', textContent: `Mort dans la Zone${cause ? ` : ${CAUSES[cause] ?? cause}` : ''}` });
  if (death.mode === 'hardcore') {
    card(section, 'mort', title,
      h('p', { textContent: 'Mode hardcore : la sauvegarde de cette campagne est effacée.' }),
      h('div', { className: 'ecran-boutons' }, button('Retour au titre', on.title, { id: 'titre' })));
    return;
  }
  card(section, 'mort', title,
    line('Réveil', death.hubName),
    line('Perdu', death.lost.length ? death.lost.map(itemName).join(', ') : 'rien', 'alerte'),
    death.kept.length > 0 && line('Rendu par un PNJ', death.kept.map(itemName).join(', ')),
    line('Conservé', `${death.roubles} roubles, les coffres`),
    line('XP', `${death.xp.before} → ${death.xp.after}`),
    h('div', { className: 'ecran-boutons' }, button(`Se réveiller : ${death.hubName}`, on.respawn, { id: 'reapparaitre' })));
}

export function renderEnding(section, ending, on) {
  card(section, 'fin',
    h('div', { className: 'ecran-epilogue' }, ...ending.epilogue.map((text) => h('p', { textContent: text }))),
    h('h2', { textContent: 'Bilan' }),
    h('div', { className: 'ecran-resume' }, ...ending.stats.map(([label, value]) => line(label, value))),
    h('h3', { textContent: 'Choix' }),
    h('ul', { className: 'ecran-choix' }, ...ending.choices.map((text) => h('li', { textContent: text }))),
    h('div', { className: 'ecran-boutons' },
      button('Continuer dans la Zone', on.close, { id: 'continuer' }),
      button('Retour au titre', on.title)));
}

function signed(n) {
  return n > 0 ? `+${n}` : `${n}`;
}
