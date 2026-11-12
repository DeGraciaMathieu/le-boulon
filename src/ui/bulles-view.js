// Bulles contextuelles, vue (direction plateau, lot L7) : un papier crème scotché en surimpression,
// qui pointe un objet de l'écran et dit une règle en une phrase. Une bulle à la fois ; elle se
// ferme d'un clic (n'importe où) ou d'Échap. Aucune bulle pendant une séquence d'animation.
// Déclencheurs et mémoire : bulles.js (purs).
//
//   const bubbles = mountBubbles(sequencer)
//   bubbles.check(ctx, muted?)           montre la première bulle due et pas vue (TRIGGERS de bulles.js),
//                                        sauf les ids de muted (tutoriel : étape en cours), gardées pour plus tard
//   bubbles.showBubble({ id, target, text, step?, onSkip? })   montre une bulle (target : sélecteur ou
//                                        élément) ; false si une séquence joue, si une bulle est ouverte
//                                        ou si la cible est introuvable ou cachée. Mémorise id comme vue,
//                                        sauf une bulle du tutoriel : step (« 2 / 6 ») et onSkip
//                                        (lien « Passer le tutoriel ») la signalent.
//   bubbles.register(trigger)            ajoute un déclencheur au registre (tutoriel joué, L8)
//   bubbles.reset()                      oublie les bulles vues (onglet Aide : « Revoir les bulles »)
//   bubbles.close()                      ferme la bulle ouverte ; vrai s'il y en avait une
//   bubbles.onClose = (id) => {}         appelé à chaque fermeture (L8 : étape suivante)

import { TRIGGERS, nextBubble, readSeen, saveSeen } from './bulles.js';

const GAP = 14;
const MARGIN = 8;

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

  // Sous la cible si la place le permet, sinon au-dessus ; la flèche suit le centre de la cible.
  function place() {
    if (!open) return;
    const rect = open.target.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    const below = rect.bottom + GAP + box.height <= innerHeight - MARGIN;
    const top = below ? rect.bottom + GAP : Math.max(MARGIN, rect.top - GAP - box.height);
    const center = rect.left + rect.width / 2;
    const left = Math.min(Math.max(MARGIN, center - box.width / 2), innerWidth - box.width - MARGIN);
    node.style.top = `${top}px`;
    node.style.left = `${left}px`;
    node.style.setProperty('--fleche-x', `${Math.min(Math.max(16, center - left), box.width - 16)}px`);
    node.classList.toggle('dessus', !below);
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
      if (sequencer.busy || open) return false;
      const element = resolve(target);
      if (!element) return false;
      open = { id, target: element, onSkip };
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
      if (sequencer.busy || open) return false;
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
