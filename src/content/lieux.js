// Lieux des 7 tuiles (brief v2 §3.4) : { [placeId]: { name, label, tile, hex, tags,
// faction?, services? } }, format en tête de src/content/validate.js.
//
// label : étiquette ukrainienne de l'image, égale au champ lieu de l'hexagone de la tuile.
// tags : 'hub', 'abri' (hexagone abri), 'irradie' (hexagone irradié), 'repaire' (hexagone
// repaire), 'pnj' (PNJ présent, §3.3). faction : occupant (§5.4) ; ids de faction de §9
// (solitaires, devoir, liberte, ciel-pur, bandits, militaires).
// services : ceux du §6.1, pour les 4 hubs.
//
// Champs omis jusqu'à leurs cartes : deck (paquet d'exploration, cartes 10-11) et loot
// (table de butin, carte 11).

import { deepFreeze } from './freeze.js';

const place = (name, label, tile, hex, tags, more = {}) => ({ name, label, tile, hex, tags, ...more });

export default deepFreeze({
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
});
