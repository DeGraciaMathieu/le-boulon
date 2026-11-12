// Tutoriel joué du jour 1, vue (direction plateau, lot L8) : chaque étape se dit dans une bulle de
// bulles-view.js (L7), qui pointe l'objet à utiliser, avec « 2 / 6 » et « Passer le tutoriel ».
// Une bulle fermée ne revient que si l'étape ou l'objet pointé change. Étapes et progression :
// tutoriel.js (purs), progression gardée en localStorage par campagne (sa graine).
//
//   const tutorial = mountTutorial(bubbles, storage?)
//   tutorial.attach(campaign)      nouvelle campagne chargée : tutoriel éteint (sauvegarde, ?seed=)
//   tutorial.begin(campaign)       nouvelle partie de l'écran titre, case « Tutoriel » cochée
//   tutorial.replay(campaign)      onglet Aide du PDA : reprend les étapes non faites
//   tutorial.feed(events, campaign)   après chaque step : valide les étapes
//   tutorial.show(ctx) -> [id]     montre la bulle de l'étape en cours si due ; rend les ids des
//                                  bulles L7 à taire pendant cette étape

import { startTutorial, advance, skipTutorial, currentStep, readProgress, saveProgress } from './tutoriel.js';

const bubbleId = (step) => `tutoriel-${step.id}`;

function visible(selector) {
  const element = document.querySelector(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 ? element : null;
}

export function mountTutorial(bubbles, storage) {
  let seed = null;
  let progress = null;
  // Dernière bulle montrée (étape et sélecteur) : une bulle fermée ne revient pas telle quelle.
  let shown = null;

  function save() {
    if (seed !== null && progress) saveProgress(storage, seed, progress);
  }

  function skip() {
    progress = skipTutorial(progress);
    save();
  }

  // Une bulle du tutoriel ouverte pour une étape déjà faite se ferme d'elle-même.
  function closeStale(current) {
    const open = bubbles.open;
    if (open?.startsWith('tutoriel-') && open !== (current && bubbleId(current.step))) bubbles.close();
  }

  return {
    attach(campaign) {
      seed = campaign.seed;
      progress = null;
      shown = null;
    },
    begin(campaign) {
      seed = campaign.seed;
      progress = startTutorial(undefined, campaign);
      shown = null;
      save();
    },
    replay(campaign) {
      seed = campaign.seed;
      progress = startTutorial(readProgress(storage, seed) ?? undefined, campaign);
      shown = null;
      save();
    },
    feed(events, campaign) {
      if (!progress?.active) return;
      progress = advance(progress, events, campaign);
      save();
      closeStale(currentStep(progress));
    },
    show(ctx) {
      const current = currentStep(progress);
      closeStale(current);
      if (!current) return [];
      const { step, number, total } = current;
      const selector = step.target(ctx).find(visible);
      const key = `${step.id} ${selector}`;
      if (selector && key !== shown && bubbles.showBubble({
        id: bubbleId(step),
        target: selector,
        text: step.text,
        step: `${number} / ${total}`,
        onSkip: skip,
      })) shown = key;
      return step.mutes;
    },
  };
}
