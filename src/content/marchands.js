// Marchands des hubs (brief v2 §6.1, §6.2), clé = id du marchand, règles dans
// src/engine/rules/traders.js. Format : collection traders de src/content/validate.js.
//
//   {
//     npc,          PNJ marchand (pnj.js, role 'marchand') qui tient le comptoir
//     place,        hub du marchand (lieux.js, service 'marchand') ; sa faction fixe la
//                   réputation qui module les prix
//     coefficient,  coefficient du marchand sur le prix de base (achat et revente)
//     sell?,        { [catégorie d'objet]: n } coefficient de revente en plus, par catégorie
//     stock,        [{ item, quantity, rank? }] stock plein, rendu tous les 3 jours ;
//                   rank : rang du joueur requis pour l'acheter (ids de RANKS, §11.1)
//     lines,        répliques : premiere (première visite), quete (quête en cours),
//                   hostile, neutre, amical, allie (réputation, paliers du §9)
//   }
//
// Hypothèse v2 : coefficients, quantités, rangs requis et répliques ne sont pas dans le
// brief. Les spécialités sont celles du §6.2.

import { deepFreeze } from './freeze.js';

export default deepFreeze({
  // Camp des novices : stock de débutant, achète bien les artefacts (§6.2).
  'marchand-bunker': {
    npc: 'marchand-bunker',
    place: 'camp-novices',
    coefficient: 1.2,
    sell: { artefact: 1.2 },
    stock: [
      { item: 'pistolet', quantity: 1 },
      { item: 'fusil-pompe', quantity: 1, rank: 'experimente' }, // LBL-45, docs/equilibrage.md
      { item: 'munitions', quantity: 6 },
      { item: 'cartouches-12', quantity: 2 },
      { item: 'boulons', quantity: 5 },
      { item: 'veste-cuir', quantity: 1 },
      { item: 'echo', quantity: 1 },
      { item: 'bandage', quantity: 5 },
      { item: 'trousse-soins', quantity: 2 },
      { item: 'vodka', quantity: 4 },
      { item: 'antirad', quantity: 2 },
      { item: 'ration', quantity: 6 },
      { item: 'conserve', quantity: 3 },
      { item: 'grenade', quantity: 2, rank: 'experimente' },
    ],
    lines: {
      premiere: 'Un nouveau. Ici, on paie comptant et on ne pose pas de questions.',
      quete: 'Tu as encore du travail dehors. Reviens quand ce sera fait, et rapporte-moi ce que tu trouves.',
      hostile: 'Je ne vends rien aux gens comme toi. Dehors.',
      neutre: 'Tu achètes ou tu regardes ?',
      amical: 'Ah, te revoilà. J’ai mis de côté deux ou trois choses.',
      allie: 'Pour toi, je fais un prix. Ne le répète pas.',
    },
  },

  // Base de Ciel Pur : vend des détecteurs (§6.2).
  'lev-marchand': {
    npc: 'lev-marchand',
    place: 'base-ciel-pur',
    coefficient: 1,
    stock: [
      { item: 'echo', quantity: 2 },
      { item: 'ours', quantity: 2, rank: 'experimente' },
      { item: 'veles', quantity: 1, rank: 'veteran' },
      { item: 'boulons', quantity: 5 },
      { item: 'fusil-pompe', quantity: 1 }, // LBL-45, docs/equilibrage.md
      { item: 'munitions', quantity: 4 },
      { item: 'cartouches-12', quantity: 2 },
      { item: 'bandage', quantity: 4 },
      { item: 'trousse-soins', quantity: 2 },
      { item: 'antirad', quantity: 3 },
      { item: 'ration', quantity: 4 },
    ],
    lines: {
      premiere: 'Sans détecteur, le Marais te mangera. Regarde ce que j’ai.',
      quete: 'Le commandant attend des nouvelles de ta mission.',
      hostile: 'Ciel Pur ne commerce pas avec toi.',
      neutre: 'Les détecteurs sont à gauche. Le reste, à droite.',
      amical: 'Un ami du Marais. Prends ton temps.',
      allie: 'Pour un frère de Ciel Pur, le meilleur matériel.',
    },
  },

  // Bar « 100 Rads » : vend des armes (§6.2).
  stas: {
    npc: 'stas',
    place: 'bar',
    coefficient: 1,
    stock: [
      { item: 'pistolet', quantity: 2 },
      { item: 'pistolet-lourd', quantity: 1, rank: 'experimente' },
      { item: 'fusil-pompe', quantity: 2 },
      { item: 'fusil-assaut', quantity: 1, rank: 'experimente' },
      { item: 'fusil-precision', quantity: 1, rank: 'veteran' },
      { item: 'munitions', quantity: 6 },
      { item: 'cartouches-12', quantity: 4 },
      { item: 'munitions-545', quantity: 4 },
      { item: 'grenade', quantity: 3 },
      { item: 'combinaison-devoir', quantity: 1, rank: 'veteran' },
      { item: 'trousse-militaire', quantity: 1, rank: 'experimente' },
      { item: 'ration', quantity: 4 },
    ],
    lines: {
      premiere: 'L’armurerie du Devoir. On vend du solide, pas des jouets.',
      quete: 'Une mission en cours ? Prends des munitions, tu en auras besoin.',
      hostile: 'Le Devoir n’arme pas ses ennemis.',
      neutre: 'Choisis ton arme, stalker.',
      amical: 'Le Devoir se souvient de toi. Bon prix aujourd’hui.',
      allie: 'Pour un camarade, ce qu’il y a de mieux.',
    },
  },

  // Base de Liberté : armures légères et consommables (§6.2).
  matvii: {
    npc: 'matvii',
    place: 'base-liberte',
    coefficient: 1,
    stock: [
      { item: 'veste-cuir', quantity: 2 },
      { item: 'combinaison-stalker', quantity: 1, rank: 'experimente' },
      { item: 'combinaison-liberte', quantity: 1, rank: 'veteran' },
      { item: 'exosquelette', quantity: 1, rank: 'expert' },
      { item: 'munitions-545', quantity: 3 },
      { item: 'bandage', quantity: 6 },
      { item: 'trousse-soins', quantity: 3 },
      { item: 'trousse-militaire', quantity: 2, rank: 'experimente' },
      { item: 'vodka', quantity: 6 },
      { item: 'antirad', quantity: 4 },
      { item: 'boisson-energetique', quantity: 3 },
      { item: 'conserve', quantity: 4 },
      { item: 'saucisson', quantity: 4 },
    ],
    lines: {
      premiere: 'Bienvenue chez Liberté. Ici, chacun achète ce qu’il veut.',
      quete: 'Toujours sur ton affaire ? Un saucisson pour la route ?',
      hostile: 'Liberté, oui. Pour toi, non.',
      neutre: 'Jette un œil, rien ne presse.',
      amical: 'Content de te voir, l’ami. Sers-toi.',
      allie: 'Entre frères, on ne compte pas. Enfin, presque.',
    },
  },
});
