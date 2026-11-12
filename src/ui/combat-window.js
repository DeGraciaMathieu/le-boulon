// Fenêtre Combat v2 (brief v2 §13, §16 ; carte 27) : ennemis avec PV et Menace, actions du
// round, jets affichés. Lit combatWindow et combatLine (combat-screen.js) et envoie les
// actions de rules/combat.js par onAction. Après la fin du combat, la fenêtre garde le
// dernier round et son issue jusqu'au clic sur Continuer.
//
//   mountCombat({ onAction }) -> { render(campaign, events) }   events : ceux du dernier step

import { el } from './board.js';
import { combatLine, combatWindow } from './combat-screen.js';

const PIPS = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]],
  5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] };

function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

function die(roll) {
  const svg = el('svg', { class: 'de', viewBox: '0 0 24 24', 'aria-label': `dé : ${roll}` });
  el('rect', { x: 1, y: 1, width: 22, height: 22, rx: 4 }, svg);
  for (const [x, y] of PIPS[roll] ?? []) el('circle', { cx: x * 6, cy: y * 6, r: 2.2 }, svg);
  return svg;
}

function rollItem(event) {
  const text = combatLine(event);
  if (!text) return null;
  const kind = event.type === 'enemy-attack' ? 'ennemi' : event.type === 'combat-round' ? 'round' : 'joueur';
  const item = h('li', { className: `jet jet-${kind}${event.hit === true ? ' touche' : ''}` });
  if (event.roll) item.append(die(event.roll));
  item.append(h('span', { textContent: text }));
  return item;
}

function hpTrack(enemy) {
  const svg = el('svg', { class: 'pv', viewBox: `0 0 ${enemy.maxHp * 14} 12`, width: enemy.maxHp * 14, height: 12 });
  for (let i = 0; i < enemy.maxHp; i++) el('rect', { x: i * 14 + 1, y: 1, width: 11, height: 10, class: i < enemy.hp ? 'plein' : 'vide' }, svg);
  return svg;
}

function enemyCard(enemy, onAction) {
  const odds = enemy.toHit > 6 ? 'impossible' : `dé ≥ ${enemy.toHit}`;
  return h('li', { className: `ennemi${enemy.down ? ' abattu' : ''}` },
    h('div', { className: 'ennemi-nom', textContent: enemy.name }),
    h('div', { className: 'ennemi-pv' }, hpTrack(enemy), ` ${enemy.hp}/${enemy.maxHp} PV`),
    h('div', { className: 'ennemi-stats', textContent: `Menace ${enemy.threat} · dégâts ${enemy.damage} · ${enemy.type}` }),
    enemy.down
      ? h('div', { className: 'ennemi-etat', textContent: 'Abattu' })
      : h('button', { type: 'button', textContent: `Tirer (${odds})`, onclick: () => onAction({ type: 'shoot', target: enemy.index }) }));
}

function statusLine(view) {
  const { weapon } = view;
  const ammo = weapon.charges === null ? '' : `, ${weapon.charges} munitions`;
  const parts = [`Round ${view.round}`, `Arme : ${weapon.name} (${weapon.bonus >= 0 ? '+' : ''}${weapon.bonus}, dégâts ${weapon.damage}${ammo})`,
    `Tir : 1d6 + ${view.attack}`, `Défense ${view.defense}`];
  if (view.coverRounds > 0) parts.push(`À couvert (${view.coverRounds} round${view.coverRounds > 1 ? 's' : ''})`);
  if (view.absorb > 0) parts.push(`Armure : absorbe encore ${view.absorb}`);
  return parts.join(' · ');
}

export function mountCombat({ onAction }) {
  const root = h('div', { className: 'fenetre fenetre-combat', hidden: true });
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  document.body.append(root);
  let rolls = [];
  let title = '';

  const rollList = () => h('ol', { className: 'jets', 'aria-live': 'polite' }, ...rolls.map(rollItem));

  return {
    render(campaign, events = []) {
      const view = combatWindow(campaign);
      const fought = events.filter((event) => combatLine(event));
      if (fought.length) rolls = fought;
      if (view) {
        title = view.title;
        root.hidden = false;
        root.replaceChildren(h('div', { className: 'cadre-fenetre' },
          h('h2', { textContent: `Combat : ${view.title}` }),
          h('div', { className: 'combat-etat', textContent: statusLine(view) }),
          h('ol', { className: 'ennemis' }, ...view.enemies.map((enemy) => enemyCard(enemy, onAction))),
          h('div', { className: 'actions-round' }, ...view.actions.map((action) => h('button', {
            type: 'button', textContent: action.label, disabled: !action.available, title: action.reason ?? '',
            onclick: () => onAction(action.action),
          }))),
          h('h3', { textContent: 'Jets' }),
          rollList()));
        return;
      }
      const ended = events.find((event) => event.type === 'combat-ended');
      if (!ended) {
        if (events.length) root.hidden = true;
        return;
      }
      root.replaceChildren(h('div', { className: 'cadre-fenetre' },
        h('h2', { textContent: `Combat : ${title}` }),
        h('div', { className: 'combat-issue', textContent: combatLine(ended) }),
        rollList(),
        h('button', { type: 'button', textContent: 'Continuer', onclick: () => { root.hidden = true; } })));
      root.hidden = false;
    },
  };
}
