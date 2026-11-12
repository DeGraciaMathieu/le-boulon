// Paquets d'exploration des lieux (brief v2 §5.1, §5.2, carte 11) : { [deckId]: { kind:
// 'exploration', place, cards } }, format en tête de src/content/validate.js, champs des cartes
// en tête de src/engine/rules/places.js. L'id du paquet d'un lieu est l'id du lieu.
//
// Hypothèse v2 : les hubs n'ont pas de paquet (zones sûres de services, §6.1). Toutes les
// compositions sont des hypothèses v2 : 5 à 9 cartes, plus de Butin dans les lieux légers,
// plus d'Anomalies dans les lieux irradiés, des Occupants tirés du paquet de rencontres de
// la tuile (repaires et lieux tenus en ont deux ou trois). Une Cache tire dans la table
// `cache` du niveau ; les paquets intérieurs (Passage) aussi pour leur Butin.
//
// Cartes fixées par les quêtes (fixCard) : 'indice-acte1' de l'ATP (acte 1, 3e position).

import { deepFreeze } from '../freeze.js';

const deck = (place, cards) => ({ kind: 'exploration', place, cards });
const many = (count) => (count > 1 ? { count } : {});

const butin = (count = 1, loot) => ({ id: 'butin', type: 'butin', ...many(count), ...(loot && { loot }) });
// stat : 'survie' | 'discretion' (sans : la meilleure des deux) ; trap : 'blessure' | 'bruit'.
const cache = (level, more = {}) => ({ id: 'cache', type: 'cache', loot: `n${level}-cache`, ...more });
const anomalie = (anomaly, count = 1) => ({ id: `anomalie-${anomaly}`, type: 'anomalie', anomaly, ...many(count) });
const occupant = (encounter, count = 1) => ({ id: `occupant-${encounter}`, type: 'occupant', encounter, ...many(count) });
const pnj = (npc) => ({ id: `pnj-${npc}`, type: 'pnj', npc });
const indice = (id, text) => ({ id, type: 'indice', text });
const passage = (inner) => ({ id: 'passage', type: 'passage', deck: inner });
const rien = (id, text) => ({ id, type: 'rien', text });

export default deepFreeze({
  // Cordon (niveau 1)
  'ferme-cordon': deck('ferme-cordon', [
    butin(3),
    cache(1, { stat: 'survie' }),
    occupant('chiens'),
    rien('grange', 'La grange sent le foin pourri. Rien qu’un râteau rouillé.'),
    rien('cuisine', 'Une table renversée, des bocaux vides alignés sur l’étagère.'),
  ]),
  elevateur: deck('elevateur', [
    butin(2),
    pnj('blesse-elevateur'),
    anomalie('electro'),
    indice('traces-sang', 'Des traces de sang mènent à l’étage. Quelqu’un s’est traîné jusqu’ici.'),
    rien('silo', 'Le silo résonne à chaque pas. Du grain moisi jusqu’aux chevilles.'),
  ]),
  atp: deck('atp', [
    butin(2),
    occupant('pillard'),
    occupant('bandits'),
    indice('indice-acte1', 'Un PDA sous un camion éventré. Le dernier message parle d’un convoi.'),
    cache(1, { trap: 'bruit' }),
    anomalie('electro'),
    rien('garage', 'Des carcasses de camions sur cales. Les pneus ont été volés depuis longtemps.'),
  ]),
  'fosse-dechets': deck('fosse-dechets', [
    butin(3),
    anomalie('bruleuse'),
    anomalie('electro'),
    cache(1, { stat: 'survie' }),
    rien('futs', 'Des fûts éventrés suintent une boue verdâtre. Le compteur crépite.'),
  ]),
  'avant-poste': deck('avant-poste', [
    butin(2),
    occupant('militaires', 2),
    cache(1, { stat: 'discretion', trap: 'bruit' }),
    indice('registre', 'Un registre de garde : les patrouilles passent à l’aube et au crépuscule.'),
    rien('guerite', 'La guérite est vide, un thermos encore tiède sur la tablette.'),
  ]),

  // Marais (niveau 2)
  'ruines-village': deck('ruines-village', [
    butin(2),
    occupant('chair'),
    anomalie('gravitationnelle'),
    indice('carnet', 'Un carnet détrempé : « Ne pas traverser les roseaux après la pluie. »'),
    rien('puits', 'Le puits est comblé de pierres et de racines.'),
  ]),
  'cour-mecanisee-marais': deck('cour-mecanisee-marais', [
    butin(3),
    occupant('renegats'),
    cache(2),
    rien('tracteurs', 'Des tracteurs à moitié engloutis, la cabine pleine d’eau.'),
  ]),
  'station-pompage': deck('station-pompage', [
    butin(2),
    anomalie('electro'),
    cache(2, { stat: 'survie' }),
    occupant('sangsue'),
    rien('pompes', 'Les pompes se sont tues il y a vingt ans. L’eau monte toujours.'),
  ]),
  'ferme-incendiee': deck('ferme-incendiee', [
    butin(2),
    occupant('chiens'),
    anomalie('bruleuse'),
    rien('cendres', 'Des poutres noircies, des cendres froides.'),
    rien('cave', 'La cave a tenu. Elle est vide.'),
  ]),
  'hameau-pecheurs': deck('hameau-pecheurs', [
    butin(3),
    occupant('pillards'),
    cache(2, { stat: 'discretion' }),
    rien('filets', 'Des filets pourrissent sur des perches. Ça sent la vase.'),
  ]),
  eglise: deck('eglise', [
    butin(2),
    anomalie('gravitationnelle'),
    anomalie('electro'),
    indice('icone', 'Derrière l’icône, une carte du Marais annotée au crayon.'),
    rien('nef', 'Des bancs renversés. La lumière tombe du clocher crevé.'),
  ]),
  hameau: deck('hameau', [
    butin(2),
    occupant('sanglier'),
    cache(2),
    rien('isba', 'Une isba au toit effondré, un poêle encore debout.'),
  ]),
  fortin: deck('fortin', [
    butin(2),
    occupant('renegats', 2),
    cache(2, { trap: 'bruit' }),
    rien('meurtriere', 'Par la meurtrière, le Marais s’étend jusqu’à l’horizon.'),
  ]),

  // Décharge (niveau 2)
  barrage: deck('barrage', [
    butin(2),
    occupant('bandits', 2),
    occupant('racketteurs'),
    cache(2, { stat: 'discretion' }),
    rien('barricade', 'Des pneus et des tôles empilés. Un écriteau : « Péage ».'),
  ]),
  'ruines-decharge': deck('ruines-decharge', [
    butin(2),
    anomalie('bruleuse', 2),
    occupant('chiens'),
    rien('murs', 'Des murs à hauteur d’homme, plus rien au-dessus.'),
  ]),
  'tunnel-decharge': deck('tunnel-decharge', [
    butin(2),
    anomalie('electro'),
    occupant('pseudo-chien'),
    cache(2),
    rien('eau', 'De l’eau noire jusqu’aux genoux. L’écho de vos pas revient en retard.'),
    rien('graffiti', 'Un graffiti : une flèche et le mot « НІ ».'),
  ]),
  depot: deck('depot', [
    butin(3),
    anomalie('bruleuse'),
    cache(2, { stat: 'survie' }),
    occupant('pillard'),
    rien('wagons', 'Des wagons de marchandises, portes ouvertes, vides.'),
    rien('quai', 'Le quai est couvert de verre pilé.'),
  ]),
  'arret-bus': deck('arret-bus', [
    butin(2),
    occupant('pillard'),
    indice('horaires', 'Sur l’abri, quelqu’un a gratté une liste de noms et de jours.'),
    rien('banc', 'Un banc, un abri de béton, une route qui ne mène plus nulle part.'),
  ]),
  'cimetiere-vehicules': deck('cimetiere-vehicules', [
    butin(3),
    anomalie('bruleuse'),
    anomalie('electro'),
    anomalie('gravitationnelle'),
    cache(2, { stat: 'survie' }),
    rien('helicoptere', 'Un hélicoptère couché sur le flanc. Le compteur s’affole.'),
  ]),
  kpp: deck('kpp', [
    butin(2),
    occupant('racketteurs'),
    cache(2),
    rien('barriere', 'La barrière est levée. Personne ne l’a baissée depuis longtemps.'),
  ]),

  // Agroprom (niveau 3)
  'institut-agroprom': deck('institut-agroprom', [
    butin(2),
    occupant('militaires', 2),
    pnj('kravets'),
    cache(3, { stat: 'discretion', trap: 'bruit' }),
    indice('rapport', 'Un rapport d’expédition : « Accès aux souterrains par la cour sud. »'),
    rien('labo', 'Des paillasses couvertes de verre brisé et de dossiers trempés.'),
  ]),
  'usine-agroprom': deck('usine-agroprom', [
    butin(2),
    occupant('chiens'),
    occupant('bandits'),
    anomalie('electro'),
    cache(3),
    rien('hall', 'Un hall immense, des chaînes qui pendent du pont roulant.'),
  ]),
  souterrains: deck('souterrains', [
    butin(2),
    anomalie('gravitationnelle'),
    occupant('bandits'),
    passage('souterrains-profonds'),
    indice('plan', 'Un plan des galeries, une croix tracée au fond du réseau.'),
    rien('galerie', 'Une galerie de béton, des câbles arrachés au plafond.'),
  ]),
  'souterrains-profonds': deck('souterrains', [
    butin(2, 'n3-cache'),
    anomalie('electro'),
    anomalie('gravitationnelle'),
    occupant('mercenaires'),
    cache(3, { trap: 'bruit' }),
    rien('salle-machines', 'Une salle des machines. Quelque chose respire derrière les turbines.'),
  ]),
  'marais-agroprom': deck('marais-agroprom', [
    butin(2),
    anomalie('bruleuse'),
    anomalie('electro'),
    occupant('sanglier'),
    rien('roseaux', 'Les roseaux bruissent sans vent.'),
  ]),

  // Vallée Sombre (niveau 3)
  'usine-vallee': deck('usine-vallee', [
    butin(3),
    occupant('bandits', 2),
    occupant('bandits-armes'),
    cache(3, { stat: 'discretion', trap: 'bruit' }),
    indice('livre-comptes', 'Le livre de comptes du chef : qui paie, qui doit, qui a disparu.'),
    rien('dortoir', 'Des matelas à même le sol, des bouteilles vides.'),
  ]),
  complexe: deck('complexe', [
    butin(2),
    anomalie('electro'),
    occupant('snork'),
    passage('sous-sol-complexe'),
    indice('badge', 'Un badge d’accès au nom d’un laborantin. Niveau -2.'),
    rien('couloir', 'Un couloir carrelé de blanc, des portes blindées entrouvertes.'),
  ]),
  'sous-sol-complexe': deck('complexe', [
    butin(2, 'n3-cache'),
    anomalie('electro'),
    anomalie('bruleuse'),
    occupant('sangsue'),
    occupant('snork'),
    cache(3, { stat: 'survie' }),
    rien('cuves', 'Des cuves vides, étiquetées d’un code. L’air vibre.'),
  ]),
  gorge: deck('gorge', [
    butin(2),
    anomalie('gravitationnelle'),
    anomalie('bruleuse'),
    occupant('chiens'),
    rien('eboulis', 'Des éboulis et un filet d’eau au fond.'),
  ]),
  'poste-detruit': deck('poste-detruit', [
    butin(2),
    occupant('bandits-armes'),
    cache(3),
    rien('blinde', 'Un blindé éventré barre la route.'),
    rien('sacs', 'Des sacs de sable crevés, des douilles partout.'),
  ]),
  'station-service': deck('station-service', [
    butin(3),
    occupant('bandits'),
    cache(3),
    rien('pompes-essence', 'Les pompes affichent encore un prix en karbovanets.'),
  ]),
  pont: deck('pont', [
    butin(2),
    occupant('sanglier'),
    rien('tablier', 'Le tablier a cédé au milieu. On passe par la poutre.'),
    rien('riviere', 'En bas, la rivière charrie des branches.'),
  ]),
  'ferme-vallee': deck('ferme-vallee', [
    butin(3),
    occupant('chiens'),
    cache(3),
    rien('etable', 'Une étable vide. Des os blanchis dans la paille.'),
  ]),

  // Rostok (niveau 4)
  'cour-mecanisee-rostok': deck('cour-mecanisee-rostok', [
    butin(3),
    occupant('zombies'),
    anomalie('electro'),
    cache(4),
    rien('grues', 'Deux grues penchées l’une vers l’autre, comme pour se parler.'),
  ]),
  'usine-rostok': deck('usine-rostok', [
    butin(2),
    occupant('snork'),
    anomalie('gravitationnelle'),
    passage('ateliers-rostok'),
    indice('consigne', 'Une consigne de l’usine : « Ateliers fermés, ordre du Devoir. »'),
    rien('cheminee', 'La cheminée de l’usine se perd dans le brouillard.'),
  ]),
  'ateliers-rostok': deck('usine-rostok', [
    butin(2, 'n4-cache'),
    anomalie('electro', 2),
    occupant('controleur'),
    cache(4),
    rien('etabli', 'Un établi couvert d’outils, comme si l’équipe allait revenir.'),
  ]),
  'barriere-devoir': deck('barriere-devoir', [
    butin(2),
    cache(4, { stat: 'discretion', trap: 'bruit' }),
    indice('ordres', 'Des ordres du Devoir : renforcer la barrière, surveiller Liberté.'),
    rien('mirador', 'Un mirador, un projecteur éteint, un drapeau rouge et noir.'),
    rien('chicane', 'Une chicane de blocs de béton.'),
  ]),
  dortoirs: deck('dortoirs', [
    butin(3),
    occupant('zombies'),
    occupant('sangsue'),
    anomalie('bruleuse'),
    rien('chambres', 'Des chambres en enfilade, des lits de fer, des photos aux murs.'),
  ]),

  // Entrepôts militaires (niveau 4)
  'village-abandonne': deck('village-abandonne', [
    butin(3),
    occupant('zombies'),
    anomalie('gravitationnelle'),
    cache(4),
    rien('jardin', 'Un jardin retourné à la friche, une balançoire immobile.'),
  ]),
  'champ-anomalies': deck('champ-anomalies', [
    butin(2),
    anomalie('electro'),
    anomalie('gravitationnelle'),
    anomalie('bruleuse'),
    cache(4, { stat: 'survie' }),
    rien('rochers', 'Des rochers en lévitation à un mètre du sol.'),
  ]),
  lac: deck('lac', [
    butin(2),
    anomalie('electro'),
    occupant('pseudo-chien'),
    rien('rive', 'L’eau est trop calme. Aucun oiseau.'),
    rien('barque', 'Une barque retournée sur la rive, la coque percée.'),
  ]),
  'cabane-forestier': deck('cabane-forestier', [
    butin(2),
    cache(4, { stat: 'survie' }),
    occupant('chimere'),
    indice('journal-forestier', 'Le journal du forestier : « Elle chasse la nuit, au nord du lac. »'),
    rien('poele', 'Un poêle, une chaise, un fusil sans culasse accroché au mur.'),
  ]),
});
