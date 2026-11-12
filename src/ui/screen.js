// Fenêtre d'écran posée sur la table (PDA, Inventaire ; brief v2 §16) : un bouton l'ouvre et
// la ferme, une croix la ferme. Le contenu est rendu par l'écran à chaque render().

export function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

// root : élément vide de la page ; toggle : bouton qui ouvre et ferme. Rend { body, isOpen }.
export function mountScreen(root, toggle, title) {
  const body = h('div', { className: 'ecran-corps' });
  const close = h('button', { type: 'button', className: 'ecran-fermer', textContent: '×', title: 'Fermer' });
  root.classList.add('ecran');
  root.replaceChildren(h('header', { className: 'ecran-titre' }, h('h2', { textContent: title }), close), body);
  root.hidden = true;
  const setOpen = (open) => {
    root.hidden = !open;
    toggle.classList.toggle('actif', open);
  };
  toggle.addEventListener('click', () => setOpen(root.hidden));
  close.addEventListener('click', () => setOpen(false));
  return { body, isOpen: () => !root.hidden };
}
