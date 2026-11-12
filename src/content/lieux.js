// Lieux des 7 tuiles (brief v2 §3.4) : { [placeId]: { name, label, tile, hex, tags, deck?,
// loot?, faction?, services? } }, format en tête de src/content/validate.js.
//
// label : étiquette ukrainienne de l'image, égale au champ lieu de l'hexagone de la tuile.
// tags : 'hub', 'abri' (hexagone abri), 'irradie' (hexagone irradié), 'repaire' (hexagone
// repaire), 'pnj' (PNJ présent, §3.3). faction : occupant (§5.4) ; ids de faction de §9
// (solitaires, devoir, liberte, ciel-pur, bandits, militaires).
// services : ceux du §6.1, pour les 4 hubs.
//
// deck : paquet d'exploration (src/content/paquets/exploration.js), même id que le lieu.
// loot : table de butin (src/content/butin.js) au niveau de la tuile (§5.3), thème choisi par
// les tags et l'occupant (hypothèse v2). Les hubs n'ont ni l'un ni l'autre (zones sûres,
// hypothèse v2).

import { deepFreeze } from './freeze.js';

const place = (name, label, tile, hex, tags, more = {}) => ({ name, label, tile, hex, tags, ...more });

// Table de butin de chaque lieu hors hub.
const LOOT = {
  'ferme-cordon': 'n1-commun', elevateur: 'n1-commun', atp: 'n1-militaire', 'fosse-dechets': 'n1-irradie',
  'avant-poste': 'n1-militaire',

  'ruines-village': 'n2-irradie', 'cour-mecanisee-marais': 'n2-commun', 'station-pompage': 'n2-commun',
  'ferme-incendiee': 'n2-irradie', 'hameau-pecheurs': 'n2-commun', eglise: 'n2-irradie', hameau: 'n2-commun',
  fortin: 'n2-militaire',

  barrage: 'n2-militaire', 'ruines-decharge': 'n2-irradie', 'tunnel-decharge': 'n2-commun', depot: 'n2-commun',
  'arret-bus': 'n2-commun', 'cimetiere-vehicules': 'n2-irradie', kpp: 'n2-militaire',

  'institut-agroprom': 'n3-militaire', 'usine-agroprom': 'n3-commun', souterrains: 'n3-commun',
  'marais-agroprom': 'n3-irradie',

  'usine-vallee': 'n3-militaire', complexe: 'n3-commun', gorge: 'n3-irradie', 'poste-detruit': 'n3-militaire',
  'station-service': 'n3-commun', pont: 'n3-commun', 'ferme-vallee': 'n3-commun',

  'cour-mecanisee-rostok': 'n4-commun', 'usine-rostok': 'n4-commun', 'barriere-devoir': 'n4-militaire',
  dortoirs: 'n4-commun',

  'village-abandonne': 'n4-commun', 'champ-anomalies': 'n4-irradie', lac: 'n4-irradie',
  'cabane-forestier': 'n4-commun',
};

const withExploration = (places) =>
  Object.fromEntries(Object.entries(places).map(([id, entry]) =>
    [id, LOOT[id] ? { ...entry, deck: id, loot: LOOT[id] } : entry]));

export default deepFreeze(withExploration({
  // Cordon
  'camp-novices': place('Camp des novices', 'Табір новачків', 'cordon', 5, ['hub', 'abri', 'pnj'], {
    faction: 'solitaires',
    services: ['marchand', 'lit', 'coffre', 'contrats'],
  }),
  'ferme-cordon': place('Ferme', 'Ферма', 'cordon', 18, ['abri']),
  elevateur: place('Élévateur', 'Елеватор', 'cordon', 7, ['abri', 'pnj']),
  atp: place('ATP', 'АТП', 'cordon', 2, ['abri', 'repaire']),
  'fosse-dechets': place('Fosse aux déchets', 'Могильник відходів', 'cordon', 6, ['irradie']),
  'avant-poste': place('Avant-poste', 'Застава', 'cordon', 13, [], { faction: 'militaires' }),

  // Marais
  'base-ciel-pur': place('Base de Ciel Pur', 'База «Чистого неба»', 'marais', 15, ['hub', 'abri'], {
    faction: 'ciel-pur',
    services: ['marchand', 'medecin', 'technicien', 'lit', 'contrats'],
  }),
  'ruines-village': place('Ruines du village', 'Руїни села', 'marais', 7, []),
  'cour-mecanisee-marais': place('Cour mécanisée', 'Механізований двір', 'marais', 9, ['abri']),
  'station-pompage': place('Station de pompage', 'Насосна станція', 'marais', 6, ['abri']),
  'ferme-incendiee': place('Ferme incendiée', 'Спалений хутір', 'marais', 3, []),
  'hameau-pecheurs': place('Hameau des pêcheurs', 'Рибальський хутір', 'marais', 5, ['abri']),
  eglise: place('Église', 'Церква', 'marais', 4, ['abri']),
  hameau: place('Hameau', 'Хутір', 'marais', 11, []),
  fortin: place('Fortin', 'Форпост', 'marais', 17, []),

  // Décharge
  barrage: place('Barrage', 'Блокпост', 'decharge', 19, [], { faction: 'bandits' }),
  'ruines-decharge': place('Ruines', 'Руїни', 'decharge', 2, ['abri', 'irradie']),
  'tunnel-decharge': place('Tunnel', 'Тунель', 'decharge', 16, ['abri']),
  depot: place('Dépôt', 'Депо', 'decharge', 6, ['abri', 'irradie']),
  'arret-bus': place('Arrêt de bus', 'Автобусна зупинка', 'decharge', 1, ['pnj']),
  'cimetiere-vehicules': place('Cimetière de véhicules', 'Стоянка покинутої техніки', 'decharge', 14, ['irradie']),
  kpp: place('Poste de contrôle', 'КПП', 'decharge', 13, []),

  // Agroprom
  'institut-agroprom': place('Institut Agroprom', 'Агропром', 'agroprom', 15, ['abri', 'pnj'], {
    faction: 'militaires',
  }),
  'usine-agroprom': place('Usine', 'Фабрика', 'agroprom', 7, ['abri', 'repaire']),
  souterrains: place('Souterrains', 'Тунель', 'agroprom', 6, ['abri']),
  'marais-agroprom': place('Marais', 'Болото', 'agroprom', 16, ['irradie']),

  // Vallée Sombre
  'usine-vallee': place('Usine', 'Фабрика', 'vallee-sombre', 7, ['abri', 'repaire'], { faction: 'bandits' }),
  complexe: place('Complexe', 'Завод', 'vallee-sombre', 3, ['abri']),
  gorge: place('Gorge', 'Ущелина', 'vallee-sombre', 17, []),
  'poste-detruit': place('Poste détruit', 'Розбите КПП', 'vallee-sombre', 19, []),
  'station-service': place('Station-service', 'Заправка', 'vallee-sombre', 10, []),
  pont: place('Pont', 'Міст', 'vallee-sombre', 5, []),
  'ferme-vallee': place('Ferme', 'Ферма', 'vallee-sombre', 14, ['abri']),

  // Rostok
  bar: place('Bar « 100 Rads »', 'Бар 100 рентген', 'rostok', 4, ['hub', 'abri'], {
    faction: 'devoir',
    services: ['marchand', 'barman', 'medecin', 'lit', 'coffre', 'contrats'],
  }),
  'cour-mecanisee-rostok': place('Cour mécanisée', 'Механізований двір', 'rostok', 9, ['abri']),
  // Hypothèse v2 : trois bâtiments sans étiquette, nommés en regardant l'image.
  'usine-rostok': place('Usine Rostok', 'Завод «Росток»', 'rostok', 19, ['abri']),
  'barriere-devoir': place('Barrière du Devoir', 'Блокпост «Обов\'язку»', 'rostok', 13, [], {
    faction: 'devoir',
  }),
  dortoirs: place('Dortoirs', 'Гуртожитки', 'rostok', 3, ['abri']),

  // Entrepôts militaires
  'base-liberte': place('Base de Liberté', 'База «Свободи»', 'entrepots', 4, ['hub', 'abri'], {
    faction: 'liberte',
    services: ['marchand', 'barman', 'technicien', 'lit', 'contrats'],
  }),
  'village-abandonne': place('Village abandonné', 'Покинуте село', 'entrepots', 6, ['abri']),
  'champ-anomalies': place('Champ d’anomalies', 'Аномальне поле', 'entrepots', 2, []),
  lac: place('Lac', 'Озеро', 'entrepots', 10, []),
  // Hypothèse v2 : cercle sans étiquette autour d'une cabane.
  'cabane-forestier': place('Cabane du garde forestier', 'Лісова сторожка', 'entrepots', 7, ['abri']),
}));
