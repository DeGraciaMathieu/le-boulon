// Fenêtre d'écran posée sur la table (PDA, Inventaire ; brief v2 §16) : un bouton l'ouvre et
// la ferme, une croix la ferme. Le contenu est rendu par l'écran à chaque render().

export function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

// root : élément vide de la page ; toggle : bouton qui ouvre et ferme. Rend { body, isOpen, close } ;
// close() ferme l'écran et dit s'il était ouvert (Échap, campagne.js).
export function mountScreen(root, toggle, title) {
  const body = h('div', { className: 'ecran-corps' });
  const closeButton = h('button', { type: 'button', className: 'ecran-fermer', textContent: '×', title: 'Fermer' });
  root.classList.add('ecran');
  root.replaceChildren(h('header', { className: 'ecran-titre' }, h('h2', { textContent: title }), closeButton), body);
  root.hidden = true;
  const setOpen = (open) => {
    root.hidden = !open;
    toggle.classList.toggle('actif', open);
  };
  toggle.addEventListener('click', () => setOpen(root.hidden));
  closeButton.addEventListener('click', () => setOpen(false));
  const close = () => {
    const wasOpen = !root.hidden;
    setOpen(false);
    return wasOpen;
  };
  return { body, isOpen: () => !root.hidden, close };
}
