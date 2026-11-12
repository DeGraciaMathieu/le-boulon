// Quête principale « Le Guide » (brief v2 §8.1, §8.3), donnée par le Marchand du bunker.
// Cinq actes, étapes préfixées a1- à a5-. Les cartes des objectifs 'explorer' sont réservées
// à la quête (champ quest, src/content/paquets/exploration.js) : elles ne sortent que fixées.
//   Acte 1 (Cordon)         PDA du courrier à l'ATP (3e carte, §5.1), mot de passe du blessé
//                           de l'Élévateur, retour au Marchand qui ouvre le PDA.
//   Acte 2 (Décharge, Agroprom)  barrage des bandits (payer, combattre ou se faufiler :
//                           l'approche du lieu), passage des Souterrains, documents au retour
//                           du paquet intérieur. Arc facultatif au Marais : souvenir-du-guide.js.
//   Acte 3 (Vallée Sombre)  la clé : à l'Usine par la force ou la ruse (approche du lieu), ou
//                           par l'accord avec Vovk (son dialogue avance la quête à a3-labo).
//                           Laboratoire : passage du Complexe, données contre la clé.
//   Acte 4 (Rostok)         Fedir prend données et documents ; embranchement Devoir ou Liberté,
//                           une preuve, puis le serment (rejoindre-faction).
//   Acte 5 (Entrepôts)      Devoir : attaquer la patrouille de Liberté au Village abandonné ;
//                           Liberté : repousser le commando du Devoir. Puis la trace du Guide
//                           au Champ d'anomalies, au bord de la route du Nord.
// Hypothèses v2 : positions des cartes fixées autres que celle de l'ATP, récompenses, pas de
// délai. goal : ce que cherche une étape « explorer », en clair (objectiveText du PDA).
// epilogue : texte de la scène de clôture (§8.3), pour l'écran de fin.
import { deepFreeze } from '../freeze.js';

const explorer = (place, card, position, goal) => ({ type: 'explorer', place, card, ...(position && { position }), ...(goal && { goal }) });
const parler = (npc, node) => ({ type: 'parler', npc, node });
const eliminer = (encounter, tile) => ({ type: 'eliminer', encounter, tile });

export default deepFreeze({
  name: 'Le Guide',
  giver: 'marchand-bunker',
  start: 'a1-atp',
  rewards: { roubles: 2000, xp: 500 },
  steps: {
    // Acte 1 — Le courrier
    'a1-atp': { objective: explorer('atp', 'indice-acte1', 3, 'retrouver le PDA du courrier'), next: ['a1-elevateur'] },
    'a1-elevateur': { objective: parler('blesse-elevateur', 'mot-de-passe'), next: ['a1-retour'] },
    'a1-retour': { objective: parler('marchand-bunker', 'pda-ouvert'), next: ['a2-barrage'] },

    // Acte 2 — Les documents
    'a2-barrage': { objective: { type: 'visiter', place: 'barrage' }, next: ['a2-descente'] },
    'a2-descente': { objective: explorer('souterrains', 'passage', 3, 'trouver le passage vers les profondeurs'), next: ['a2-documents'] },
    'a2-documents': { objective: explorer('souterrains', 'documents-agroprom', undefined, 'récupérer les documents'), next: ['a3-usine'] },

    // Acte 3 — La clé
    'a3-usine': { objective: explorer('usine-vallee', 'cle-labo', 3, 'prendre la clé du laboratoire'), next: ['a3-labo'] },
    'a3-labo': { objective: explorer('complexe', 'passage', 2, 'trouver l’entrée du laboratoire'), next: ['a3-donnees'] },
    'a3-donnees': { objective: explorer('complexe', 'donnees-labo', undefined, 'copier les données du laboratoire'), next: ['a4-bar'] },

    // Acte 4 — Le Bar
    'a4-bar': { objective: parler('fedir', 'donnees'), next: ['a4-devoir', 'a4-liberte'] },
    'a4-devoir': { objective: parler('hordiy', 'guide'), next: ['a4-devoir-traque'] },
    'a4-devoir-traque': { objective: explorer('usine-rostok', 'occupant-controleur', undefined, 'débusquer le contrôleur'), next: ['a4-devoir-preuve'] },
    'a4-devoir-preuve': { objective: eliminer('controleur', 'rostok'), next: ['a4-devoir-serment'] },
    'a4-devoir-serment': { objective: parler('hordiy', 'serment'), next: ['a5-attaque'] },
    'a4-liberte': { objective: parler('yasko', 'guide'), next: ['a4-liberte-preuve'] },
    'a4-liberte-preuve': { objective: explorer('barriere-devoir', 'ordres', undefined, 'voler les ordres du Devoir'), next: ['a4-liberte-serment'] },
    'a4-liberte-serment': { objective: parler('yasko', 'serment'), next: ['a5-defense'] },

    // Acte 5 — La route du Nord
    'a5-attaque': { objective: explorer('village-abandonne', 'occupant-patrouille-liberte', undefined, 'surprendre la patrouille de Liberté'), next: ['a5-attaque-victoire'] },
    'a5-attaque-victoire': { objective: eliminer('patrouille-liberte', 'entrepots'), next: ['a5-trace'] },
    'a5-defense': { objective: explorer('village-abandonne', 'occupant-commando-devoir', undefined, 'repérer le commando du Devoir'), next: ['a5-defense-victoire'] },
    'a5-defense-victoire': { objective: eliminer('commando-devoir', 'entrepots'), next: ['a5-trace'] },
    'a5-trace': { objective: explorer('champ-anomalies', 'trace-guide', 2, 'trouver la trace du Guide'), next: [] },
  },
  epilogue: [
    'Le panneau rouillé indique le nord. Derrière, la route s’enfonce dans la forêt.',
    'Le Guide est passé par ici. Il n’est pas revenu.',
    'Yantar. La Forêt Rouge. Pripyat. La Zone ne fait que commencer.',
  ],
});
