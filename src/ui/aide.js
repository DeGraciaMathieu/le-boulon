// Notice du jeu (rapport UX, piste M3) : onglet Aide du PDA et définitions du bandeau du haut.
// Les nombres viennent des constantes du moteur, pour que la notice suive les règles. Pures :
// pas de DOM (testées par tests/aide.test.js). Rendu : pda-view.js (onglet), campagne.js (bandeau).
//
//   HELP_SECTIONS  [{ title, entries: [{ term, text }] }]  onglet Aide, dans l'ordre affiché
//   BAR_HINTS      { [id]: texte }  définition courte d'un élément du bandeau, au survol
//   farewellChoice(view) -> choix | null   choix « Au revoir » disponible d'une fenêtre Dialogue
//                                           (dialogueWindow de dialogue-screen.js), pour Échap

import { BASE_AP } from '../engine/game.js';
import { entryCost } from '../engine/actions/move.js';
import { BOLT_COST, DETECTOR_RANGE } from '../engine/rules/suspects.js';
import { EXPLORE_COST, PLACE_FEE } from '../engine/rules/places.js';
import { TRAVEL_COST } from '../engine/rules/world.js';
import { DRAW_EVERY, EMISSION_COUNTDOWN, EMISSION_WOUNDS } from '../engine/rules/zone.js';
import { EMISSION_GAP } from '../engine/rules/emission.js';
import { BED_PRICE, OPEN_AIR_MALUS, HUNGER_MALUS, WOUND_AP_MALUS } from '../engine/rules/time.js';
import { TRACK_MAX, WOUND_PENALTY_AT, RADIATION_RESET } from '../engine/rules/sheet.js';

// Valeurs non exportées par le moteur (rules/encounters.js, rules/suspects.js, game.js,
// rules/time.js) ; tests/aide.test.js les vérifie contre les règles.
export const FLEE_COST = 2;
export const PICKUP_COST = 1;
export const CHECK_TARGET = 5;
export const STARVING_DAYS = 2;

const cost = (terrain) => entryCost({ terrain }, {});

export const HELP_SECTIONS = Object.freeze([
  {
    title: 'Symboles de la tuile',
    entries: [
      { term: '?', text: 'Jeton suspect caché : anomalie, artefact ou rien. Y entrer le révèle ; sur une anomalie, un test de Survie réussi évite son effet.' },
      { term: '!', text: 'Rencontre cachée. Entrer sur sa case ou à côté lance un test de Discrétion (+1 en forêt) : réussi, on la contourne ; raté, la carte est révélée.' },
      { term: 'ART', text: `Artefact révélé. Le ramasser coûte ${PICKUP_COST} PA et un test de Survie.` },
      { term: 'ÉLEC · GRAV · BRÛL', text: 'Anomalies révélées, la case est bloquée. Électro : 2 blessures et détecteur en panne. Gravitationnelle : 3 blessures et projection. Brûleuse : 2 blessures et un consommable brûlé.' },
      { term: '☢', text: "Trèfle radioactif dessiné sur l'image : hexagone irradié." },
      { term: 'Crâne', text: "Tête de mort dessinée sur l'image : repaire, un lieu dangereux." },
      { term: 'Losange', text: "Sur l'image : un PNJ. Sur le plateau et la carte du monde : une cible de quête." },
      { term: '→ Liaison', text: `Hexagone de bord qui mène à la tuile voisine. Passer coûte ${TRAVEL_COST} PA ; on arrive sur la liaison correspondante.` },
      { term: 'n PA', text: "Pastille d'un hexagone atteignable : ce que coûte le pas." },
    ],
  },
  {
    title: 'Coûts en PA',
    entries: [
      { term: 'Journée', text: `${BASE_AP} PA + Endurance. Les PA non dépensés sont perdus. À 0 PA, bivouac forcé là où l'on est.` },
      { term: 'Route, herbe', text: `${cost('route')} PA` },
      { term: 'Forêt', text: `${cost('foret')} PA (+1 couverture en combat et +1 en Discrétion)` },
      { term: 'Marais', text: `${cost('marais')} PA et un test de Survie, sinon 1 blessure` },
      { term: 'Lieu', text: `${entryCost({ lieu: true }, {})} PA pour y entrer, puis Explorer : ${EXPLORE_COST} PA par carte` },
      { term: 'Boulon', text: `${BOLT_COST} PA` },
      { term: 'Ramasser un artefact', text: `${PICKUP_COST} PA` },
      { term: 'Utiliser un objet', text: '1 PA en général (bandage, vodka…)' },
      { term: 'Passer une liaison', text: `${TRAVEL_COST} PA` },
      { term: 'Combattre', text: `0 PA. Fuir : ${FLEE_COST} PA` },
      { term: 'Hub', text: 'Aucune action ne coûte de PA, sauf dormir, qui finit la journée.' },
    ],
  },
  {
    title: 'Tests',
    entries: [
      { term: 'Test', text: `1d6 + compétence ≥ ${CHECK_TARGET} : réussi. Le journal l'écrit « dé + bonus = total / ${CHECK_TARGET} ».` },
      { term: 'Compétences', text: 'Tir, Survie, Discrétion, Endurance. Elles montent avec les rangs (onglet Fiche). Endurance donne +1 PA par point.' },
      { term: 'Tirer', text: "1d6 + Tir + arme + couverture ≥ Menace de l'ennemi." },
    ],
  },
  {
    title: 'La Zone',
    entries: [
      { term: 'Boulon', text: `${BOLT_COST} PA : lancé sur un hexagone voisin, il révèle le jeton caché sans y entrer. Inutile dans le brouillard.` },
      { term: 'Détecteur', text: `Révèle seul les artefacts à ${DETECTOR_RANGE} hexagones ou moins. Une anomalie électro le met en panne ; la pluie le gêne.` },
      { term: 'Carte Zone', text: `Piochée chaque fois que les PA dépensés passent un multiple de ${DRAW_EVERY} : patrouille, chiens, brouillard, cachette, radio, calme… ou l'Émission.` },
      { term: 'Émission', text: `Revient tous les ${EMISSION_GAP.min} à ${EMISSION_GAP.max} jours, annoncée le matin (« ÉMISSION AUJOURD'HUI »). Quand sa carte Zone sort, il reste ${EMISSION_COUNTDOWN} PA pour gagner un abri. Sinon : ${EMISSION_WOUNDS} blessures et évanouissement jusqu'au lendemain.` },
      { term: 'Abri', text: "Hexagone d'un bâtiment ou d'un tunnel. Il protège de l'Émission (surligné pendant celle-ci) et la nuit." },
      { term: 'Lieu occupé', text: `On y entre en combattant, en se faufilant (Discrétion à chaque carte) ou en payant ${PLACE_FEE} roubles.` },
    ],
  },
  {
    title: 'La nuit',
    entries: [
      { term: 'Lit', text: `Dans un hub : ${BED_PRICE} roubles (gratuit dans le hub de sa faction), 1 blessure soignée, pas de carte Nuit.` },
      { term: 'Bivouac', text: `Dans un abri : une carte Nuit. À découvert : une carte Nuit et un test de Discrétion (raté : rencontre de nuit), et −${OPEN_AIR_MALUS} PA le lendemain.` },
      { term: 'Carte Nuit', text: 'Piochée dans le paquet de la tuile en bivouac : nuit calme, blessure, radiations ou rencontre.' },
    ],
  },
  {
    title: 'Clavier',
    entries: [
      { term: 'Échap', text: 'Annule le boulon, ferme le PDA et l’Inventaire, quitte un dialogue par « Au revoir ».' },
      { term: '1 à 9', text: 'Choix de dialogue.' },
    ],
  },
]);

export const BAR_HINTS = Object.freeze({
  jour: "Jour de la campagne. Chaque nuit en fait commencer un nouveau.",
  tuile: 'Tuile où vous êtes.',
  pa: `Points d'action restants aujourd'hui sur le maximum. Tout coûte des PA ; à 0, la journée finit.`,
  blessures: `0 à ${TRACK_MAX}. À ${WOUND_PENALTY_AT} : −${WOUND_AP_MALUS} PA par jour. À ${TRACK_MAX} : mort. Bandage et lit soignent.`,
  radiations: `0 à ${TRACK_MAX}. À ${TRACK_MAX} : 1 blessure et retour à ${RADIATION_RESET}. Les artefacts portés en irradient ; l'armure protège.`,
  faim: `Jours sans manger : une ration se mange au réveil. 1 jour : −${HUNGER_MALUS} PA. ${STARVING_DAYS} jours : 1 blessure en plus.`,
  roubles: 'Argent : marchands, lit, rumeurs, péages.',
});

const FAREWELL = /^au revoir\b/i;

export function farewellChoice(view) {
  return view?.choices.find((choice) => choice.available && FAREWELL.test(choice.text.trim())) ?? null;
}
