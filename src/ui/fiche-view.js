// Fiche de personnage en carton kraft, colonne de gauche (direction plateau, lot L4). Les données
// viennent de fiche.js (pures) ; le style de fiche.css. Lecture seule : ne touche jamais la
// campagne ; les clics passent par les rappels de campagne.js.
//
//   en-tête       rang, XP et jauge d'XP jusqu'au rang suivant
//   compétences   une pastille par point (STAT_MAX), pastilles de ceinture en ocre, total à droite
//   Défense       total ; base et armure au survol
//   équipement    armes, armure, détecteur, emplacements d'artefacts
//   ceinture      bandage, vodka, ration : un clic = { type: 'use', item } (onUse)
//   boulons       la réserve ; un clic = mode visée du bouton Boulon (onBolt)
//
// SÉQUENCEUR : les pas de la fiche (FICHE_BEATS, insérés par ficheBeats) s'enregistrent ici.
//   A4  bolt   un boulon part de la réserve et vole en arc jusqu'à l'hexagone visé (500 ms)
//   A11 item   l'objet gagné vole vers son logement : ceinture, réserve de boulons ou sac (500 ms)
//   A11 coins  une pièce vole vers la pile du bandeau, ou en part pour une dépense (500 ms)
//   A14 xp     la jauge d'XP se remplit ; au passage de rang elle se vide et repart (600 ms)
//   A14 stat   la compétence montée s'allume, sa nouvelle pastille avec (600 ms)
// Mode réduit : fondu du logement. Accélérer : les animations vont à leur fin, les objets
// volants disparaissent.

import { sheetCard, FICHE_BEATS } from './fiche.js';
import { fade } from './sequencer.js';

const MS = { bolt: 500, item: 500, coins: 500, xp: 600, stat: 600 };
const BOLTS_SHOWN = 12;

function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

// Relance une animation CSS déjà jouée sur le même élément.
function replay(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  void node.getBoundingClientRect();
  node.classList.add(cls);
}

function center(node) {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

const visible = (node) => Boolean(node?.getClientRects().length);

function header({ rank }) {
  const xp = rank.next ? `${rank.xp} / ${rank.next.xp} XP · puis ${rank.next.name}` : `${rank.xp} XP · rang maximal`;
  return h('div', { className: 'fiche-tete' },
    h('div', { className: 'fiche-portrait', textContent: 'S' }),
    h('div', { className: 'fiche-rang' },
      h('h2', { textContent: rank.name }),
      h('small', { textContent: xp }),
      h('span', { className: 'jauge-xp', title: 'XP gagnée dans ce rang' }, h('i', { style: `width: ${Math.round(rank.ratio * 100)}%` }))));
}

function skillLine(skill) {
  const dots = Array.from({ length: skill.max }, (_, i) => {
    const kind = i < skill.value ? ' on' : i < skill.total ? ' bonus' : '';
    return h('i', { className: `pt${kind}` });
  });
  const title = `${skill.label} ${skill.value}${skill.bonus ? ` + ceinture ${skill.bonus}` : ''}`;
  const line = h('li', { title }, h('span', { textContent: skill.label }), h('span', { className: 'pastilles' }, ...dots), h('em', { textContent: skill.total }));
  line.dataset.stat = skill.id;
  return line;
}

function gearLine(item) {
  const node = h('div', { className: `objet${item.empty ? ' vide' : ''}`, title: item.detail || item.label },
    h('small', { textContent: item.label }),
    h('b', { textContent: item.name }),
    item.detail ? h('span', { textContent: item.detail }) : null);
  node.dataset.slot = item.slot;
  return node;
}

// open : les gestes sont permis (pas de combat, de dialogue, de nuit…) ; bolt : le mode visée
// est possible ici ; targeting : il est en cours.
function careLine(item, { open, onUse }) {
  const node = h('button', { type: 'button', className: 'soin', title: `Utiliser ${item.name.toLowerCase()} (1 PA)`, onclick: () => onUse(item.kind) },
    h('b', { textContent: item.name }), h('em', { textContent: `×${item.count}` }));
  node.dataset.kind = item.kind;
  node.disabled = !open || item.count === 0;
  return node;
}

function boltsLine(count, { bolt, targeting, onBolt }) {
  const shown = Array.from({ length: Math.min(count, BOLTS_SHOWN) }, () => h('i'));
  const title = targeting ? 'Annuler le boulon' : 'Lancer un boulon : choisir un hexagone voisin (1 PA)';
  const node = h('button', { type: 'button', className: `reserve-boulons${targeting ? ' actif' : ''}`, title, onclick: onBolt },
    h('span', { className: 'boulons' }, ...shown), h('em', { textContent: count }));
  node.disabled = !targeting && (!bolt || count === 0);
  return node;
}

// fiche : l'élément #fiche ; sequencer : le séquenceur de campagne.js ; onUse(kind), onBolt().
export function mountFiche(fiche, sequencer, { onUse, onBolt }) {
  const find = (selector) => fiche.querySelector(selector);
  const flyers = new Set();

  function settle() {
    for (const animation of fiche.getAnimations?.({ subtree: true }) ?? []) animation.finish();
    for (const node of flyers) node.remove();
    flyers.clear();
  }

  // Un objet volant posé sur la page, de from à to (points de l'écran), en arc.
  function fly(className, from, to, ms, spin = 0) {
    const node = h('div', { className: `fiche-vol ${className}` });
    node.style.left = `${from.x}px`;
    node.style.top = `${from.y}px`;
    document.body.append(node);
    flyers.add(node);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lift = Math.min(120, 40 + Math.hypot(dx, dy) / 4);
    const animation = node.animate([
      { transform: 'translate(-50%, -50%)' },
      { transform: `translate(calc(${dx / 2}px - 50%), calc(${dy / 2 - lift}px - 50%)) rotate(${spin / 2}deg)`, offset: 0.5 },
      { transform: `translate(calc(${dx}px - 50%), calc(${dy}px - 50%)) rotate(${spin}deg)` },
    ], { duration: ms, easing: 'cubic-bezier(.4,0,.6,1)' });
    return animation.finished.catch(() => {}).then(() => {
      node.remove();
      flyers.delete(node);
    });
  }

  // D'où vient ce qu'on gagne : le pion sur la tuile, sinon l'écran du lieu ou du hub.
  function origin() {
    const source = [document.querySelector('#plateau:not([hidden]) .pion'), document.getElementById('lieu'), document.getElementById('hub')].find(visible);
    return source ? center(source) : { x: innerWidth / 2, y: innerHeight / 2 };
  }

  // Logement d'un objet : son soin de ceinture, la réserve de boulons, sinon le sac.
  function home(kind) {
    if (kind === 'boulons') return find('.reserve-boulons');
    return find(`.soin[data-kind="${kind}"]`) ?? document.getElementById('ouvrir-inventaire');
  }

  // A4 : de la réserve à l'hexagone visé.
  function bolt({ target }) {
    const hex = document.querySelector(`#plateau [data-hex="${target}"]`);
    const reserve = find('.reserve-boulons');
    if (!visible(hex) || !reserve) return null;
    replay(reserve, 'puise');
    return fly('boulon-vol', center(reserve), center(hex), MS.bolt, 540);
  }

  // A11 : l'objet vole vers son logement, qui accuse réception.
  function item({ kind }) {
    const to = home(kind);
    if (!visible(to)) return null;
    return fly('objet-vol', origin(), center(to), MS.item).then(() => replay(to, 'recu'));
  }

  // A11 : une pièce vers la pile du bandeau (gain) ou de la pile vers la table (dépense).
  function coins({ amount }) {
    const pile = document.querySelector('.piste-roubles .pile');
    if (!visible(pile)) return null;
    const [from, to] = amount > 0 ? [origin(), center(pile)] : [center(pile), origin()];
    return fly('piece-vol', from, to, MS.coins, 360);
  }

  // A14 : la jauge se remplit depuis l'ancienne valeur ; au passage de rang, elle va au bout,
  // puis repart de zéro dans le nouveau rang.
  function xp({ from, to, ranked }) {
    const bar = find('.jauge-xp i');
    if (!bar) return null;
    const pct = (ratio) => `${Math.round(ratio * 100)}%`;
    const frames = ranked
      ? [{ width: pct(from) }, { width: '100%', offset: 0.45 }, { width: '0%', offset: 0.5 }, { width: pct(to) }]
      : [{ width: pct(from) }, { width: pct(to) }];
    if (ranked) replay(find('.fiche-rang h2'), 'promu');
    replay(find('.jauge-xp'), 'gagne');
    return bar.animate(frames, { duration: MS.xp, easing: 'ease-out' }).finished.catch(() => {});
  }

  // A14 : le voyant de la compétence s'allume, la pastille gagnée avec.
  function stat({ stat: id, value }) {
    const line = find(`li[data-stat="${id}"]`);
    replay(line, 'allume');
    replay(line?.querySelectorAll('.pt')[value - 1], 'neuve');
  }

  const PLAY = {
    [FICHE_BEATS.bolt]: { play: bolt, reduced: () => fade(find('.reserve-boulons')), ms: MS.bolt },
    [FICHE_BEATS.item]: { play: item, reduced: (beat) => fade(home(beat.kind)), ms: MS.item },
    [FICHE_BEATS.coins]: { play: coins, reduced: () => fade(document.querySelector('.piste-roubles')), ms: MS.coins },
    [FICHE_BEATS.xp]: { play: xp, reduced: () => fade(find('.fiche-tete')), ms: MS.xp },
    [FICHE_BEATS.stat]: { play: stat, reduced: (beat) => fade(find(`li[data-stat="${beat.stat}"]`)), ms: MS.stat },
  };
  for (const [type, { play, reduced, ms }] of Object.entries(PLAY)) {
    sequencer.register(type, play, { duration: ms, reduced, finish: settle });
  }

  return {
    render(campaign, { open, bolt, targeting }) {
      const card = sheetCard(campaign);
      const defense = h('div', { className: 'defense', title: card.defense.detail },
        h('span', { textContent: 'Défense' }),
        h('small', { textContent: card.defense.armor ? `${card.defense.base} + armure ${card.defense.armor}` : `base ${card.defense.base}` }),
        h('b', { textContent: card.defense.total }));
      fiche.replaceChildren(
        header(card),
        h('h3', { textContent: 'Compétences' }),
        h('ul', { className: 'competences' }, ...card.skills.map(skillLine)),
        defense,
        h('h3', { textContent: 'Équipement' }),
        h('div', { className: 'equipement' }, ...card.gear.map(gearLine)),
        h('h3', { textContent: 'Ceinture · soins' }),
        h('div', { className: 'ceinture' }, ...card.care.map((item) => careLine(item, { open, onUse }))),
        h('h3', { textContent: 'Boulons' }),
        boltsLine(card.bolts, { bolt, targeting, onBolt }),
      );
    },
  };
}
