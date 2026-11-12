// Bulles contextuelles, vue (direction plateau, lot L7) : un papier crème scotché en surimpression,
// qui pointe un objet de l'écran et dit une règle en une phrase. Une bulle à la fois ; elle se
// ferme d'un clic (n'importe où) ou d'Échap. Aucune bulle pendant une séquence d'animation ni
// tant qu'une fenêtre (combat, dialogue) est ouverte ; une bulle ne se pose jamais sur un bouton.
// Déclencheurs et mémoire : bulles.js (purs).
//
//   const bubbles = mountBubbles(sequencer)
//   bubbles.check(ctx, muted?)           montre la première bulle due et pas vue (TRIGGERS de bulles.js),
//                                        sauf les ids de muted (tutoriel : étape en cours), gardées pour plus tard
//   bubbles.showBubble({ id, target, text, step?, onSkip? })   montre une bulle (target : sélecteur ou
//                                        élément) ; false si une séquence joue, si une bulle ou une
//                                        fenêtre est ouverte, ou si la cible est introuvable ou cachée.
//                                        Mémorise id comme vue,
//                                        sauf une bulle du tutoriel : step (« 2 / 6 ») et onSkip
//                                        (lien « Passer le tutoriel ») la signalent.
//   bubbles.register(trigger)            ajoute un déclencheur au registre (tutoriel joué, L8)
//   bubbles.reset()                      oublie les bulles vues (onglet Aide : « Revoir les bulles »)
//   bubbles.close()                      ferme la bulle ouverte ; vrai s'il y en avait une
//   bubbles.onClose = (id) => {}         appelé à chaque fermeture (L8 : étape suivante)

import { TRIGGERS, nextBubble, readSeen, saveSeen } from './bulles.js';

const GAP = 14;
const MARGIN = 8;

// Fenêtres modales : combat-window.js et dialogue-window.js.
const modalOpen = () => [...document.querySelectorAll('.fenetre')].some((node) => !node.hidden);

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function mountBubbles(sequencer, storage) {
  const triggers = [...TRIGGERS];
  let seen = readSeen(storage);
  let open = null;

  const node = document.createElement('div');
  node.className = 'bulle';
  node.setAttribute('role', 'note');
  node.hidden = true;
  const text = document.createElement('p');
  const hint = document.createElement('small');
  hint.textContent = 'Clic ou Échap pour fermer';
  const tutorial = document.createElement('div');
  tutorial.className = 'bulle-tutoriel';
  const counter = document.createElement('span');
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'bulle-passer';
  skip.textContent = 'Passer le tutoriel';
  tutorial.append(counter, skip);
  node.append(text, hint, tutorial);
  document.body.append(node);

  // Boutons visibles, hors bulle et hors cible : la bulle ne doit en couvrir aucun.
  function buttonRects() {
    return [...document.querySelectorAll('button')]
      .filter((button) => !node.contains(button) && !button.contains(open.target) && !open.target.contains(button))
      .map((button) => button.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
  }

  // Sous la cible, au-dessus, à gauche puis à droite : la première place dans l'écran qui ne couvre
  // aucun bouton ; à défaut, dessous ou dessus comme avant. La flèche suit le centre de la cible.
  function spot(rect, box) {
    const clampX = (x) => Math.min(Math.max(MARGIN, x), innerWidth - box.width - MARGIN);
    const clampY = (y) => Math.min(Math.max(MARGIN, y), innerHeight - box.height - MARGIN);
    const centerX = clampX(rect.left + rect.width / 2 - box.width / 2);
    const centerY = clampY(rect.top + rect.height / 2 - box.height / 2);
    const spots = [
      { side: 'dessous', top: rect.bottom + GAP, left: centerX },
      { side: 'dessus', top: rect.top - GAP - box.height, left: centerX },
      { side: 'gauche', top: centerY, left: rect.left - GAP - box.width },
      { side: 'droite', top: centerY, left: rect.right + GAP },
    ].filter(({ top, left }) => top >= MARGIN && left >= MARGIN
      && top + box.height <= innerHeight - MARGIN && left + box.width <= innerWidth - MARGIN);
    const buttons = buttonRects();
    const free = spots.find(({ top, left }) => !buttons.some((r) => overlaps(r, { top, left, right: left + box.width, bottom: top + box.height })));
    return free ?? spots[0] ?? { side: 'dessus', top: Math.max(MARGIN, rect.top - GAP - box.height), left: centerX };
  }

  let placed = null;
  function place() {
    if (!open) return;
    const rect = open.target.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    // Les boutons ne sont relus que si la cible ou la bulle a bougé.
    const key = [rect.left, rect.top, rect.width, rect.height, box.width, box.height, innerWidth, innerHeight].join();
    if (key === placed) return;
    placed = key;
    const { side, top, left } = spot(rect, box);
    node.style.top = `${top}px`;
    node.style.left = `${left}px`;
    node.style.setProperty('--fleche-x', `${Math.min(Math.max(16, rect.left + rect.width / 2 - left), box.width - 16)}px`);
    node.style.setProperty('--fleche-y', `${Math.min(Math.max(12, rect.top + rect.height / 2 - top - node.clientTop), box.height - node.clientTop - 12)}px`);
    node.classList.remove('dessus', 'gauche', 'droite');
    if (side !== 'dessous') node.classList.add(side);
  }

  // La cible peut bouger après la pose (image chargée, écran mis en page) : la bulle la suit.
  function follow() {
    if (!open) return;
    place();
    requestAnimationFrame(follow);
  }

  function resolve(target) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 ? element : null;
  }

  const api = {
    onClose: () => {},
    showBubble({ id, target, text: rule, step = null, onSkip = null }) {
      if (sequencer.busy || open || modalOpen()) return false;
      const element = resolve(target);
      if (!element) return false;
      open = { id, target: element, onSkip };
      placed = null;
      if (!step) {
        seen.add(id);
        saveSeen(storage, seen);
      }
      text.textContent = rule;
      tutorial.hidden = !step;
      counter.textContent = step ?? '';
      node.dataset.bulle = id;
      node.hidden = false;
      follow();
      return true;
    },
    check(ctx, muted = []) {
      if (sequencer.busy || open || modalOpen()) return false;
      const due = nextBubble(triggers, ctx, new Set([...seen, ...muted]));
      return due ? api.showBubble(due) : false;
    },
    register(trigger) {
      triggers.push(trigger);
    },
    reset() {
      seen = new Set();
      saveSeen(storage, seen);
    },
    close() {
      if (!open) return false;
      const { id } = open;
      open = null;
      node.hidden = true;
      api.onClose(id);
      return true;
    },
    get open() {
      return open?.id ?? null;
    },
  };

  // Le clic qui ferme la bulle continue vers le jeu, sauf s'il tombe sur la bulle ; Échap s'arrête là.
  // « Passer le tutoriel » est lu ici : le clic n'atteint pas le lien.
  window.addEventListener('click', (event) => {
    if (!open) return;
    if (node.contains(event.target)) event.stopPropagation();
    const { onSkip } = open;
    api.close();
    if (onSkip && skip.contains(event.target)) onSkip();
  }, { capture: true });
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !api.close()) return;
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true });

  return api;
}
