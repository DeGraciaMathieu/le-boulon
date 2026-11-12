// Fenêtre Combat v2 (brief v2 §13, §16 ; carte 27) : ennemis avec PV et Menace, actions du
// round, jets affichés. Lit combatWindow et combatLine (combat-screen.js) et envoie les
// actions de rules/combat.js par onAction. Après la fin du combat, la fenêtre garde le
// dernier round et son issue jusqu'au clic sur Continuer, qui appelle onClose.
// Bac à dés (tray, bac-view.js) : ouverte, la fenêtre l'accueille sous les actions du round et y
// inscrit le seuil du prochain tir (premier ennemi debout, ou celui dont on survole Tirer) ;
// fermée, elle le rend au panneau.
//
//   mountCombat({ onAction, onClose, tray }) -> { render(campaign, events) }   events : ceux du dernier step

import { el } from './board.js';
import { combatLine, combatWindow, shotOdds } from './combat-screen.js';
import { shotHint } from './bac.js';

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

function enemyCard(enemy, onAction, aim) {
  return h('li', { className: `ennemi${enemy.down ? ' abattu' : ''}` },
    h('div', { className: 'ennemi-nom', textContent: enemy.name }),
    h('div', { className: 'ennemi-pv' }, hpTrack(enemy), ` ${enemy.hp}/${enemy.maxHp} PV`),
    h('div', { className: 'ennemi-stats', textContent: `Menace ${enemy.threat} · dégâts ${enemy.damage} · ${enemy.type}` }),
    enemy.down
      ? h('div', { className: 'ennemi-etat', textContent: 'Abattu' })
      : h('button', {
        type: 'button', textContent: `Tirer · ${shotOdds(enemy.toHit)}`,
        onclick: () => onAction({ type: 'shoot', target: enemy.index }),
        onmouseenter: () => aim(enemy), onfocus: () => aim(enemy),
      }));
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

const heading = (campaign) => (campaign.night ? 'Combat de nuit' : 'Combat');

export function mountCombat({ onAction, onClose = () => {}, tray = null }) {
  const root = h('div', { className: 'fenetre fenetre-combat', hidden: true });
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  document.body.append(root);
  let rolls = [];
  let title = '';

  const rollList = () => h('ol', { className: 'jets', 'aria-live': 'polite' }, ...rolls.map(rollItem));
  const aim = (enemy) => tray?.prepare(shotHint(enemy));
  const traySlot = () => {
    const slot = h('div', { className: 'bac-place' });
    tray?.dock(slot);
    return slot;
  };
  const hide = () => {
    root.hidden = true;
    tray?.dock();
    tray?.prepare(null);
  };

  return {
    render(campaign, events = []) {
      const view = combatWindow(campaign);
      const fought = events.filter((event) => combatLine(event));
      if (fought.length) rolls = fought;
      if (view) {
        title = view.title;
        root.hidden = false;
        root.replaceChildren(h('div', { className: 'cadre-fenetre' },
          h('h2', { textContent: `${heading(campaign)} : ${view.title}` }),
          h('div', { className: 'combat-etat', textContent: statusLine(view) }),
          h('ol', { className: 'ennemis' }, ...view.enemies.map((enemy) => enemyCard(enemy, onAction, aim))),
          h('div', { className: 'actions-round' }, ...view.actions.map((action) => h('button', {
            type: 'button', textContent: action.label, disabled: !action.available, title: action.reason ?? '',
            onclick: () => onAction(action.action),
          }))),
          traySlot(),
          h('h3', { textContent: 'Jets' }),
          rollList()));
        const standing = view.enemies.find((enemy) => !enemy.down);
        tray?.prepare(standing ? shotHint(standing) : null);
        return;
      }
      const ended = events.find((event) => event.type === 'combat-ended');
      if (!ended) {
        if (events.length) hide();
        return;
      }
      root.replaceChildren(h('div', { className: 'cadre-fenetre' },
        h('h2', { textContent: `${heading(campaign)} : ${title}` }),
        h('div', { className: 'combat-issue', textContent: combatLine(ended) }),
        traySlot(),
        rollList(),
        h('button', { type: 'button', textContent: 'Continuer', onclick: () => { hide(); onClose(); } })));
      tray?.prepare(null);
      root.hidden = false;
    },
  };
}
