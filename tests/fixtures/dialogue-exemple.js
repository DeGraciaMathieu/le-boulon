// Dialogue d'exemple pour les tests du moteur de dialogue (carte 14). Ce n'est pas du contenu
// du jeu : les vrais dialogues arrivent avec la carte 19 (PNJ) dans src/content/dialogues/.

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export default deepFreeze({
  id: 'sidorovitch-test',
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Approche, stalker. Tu as quelque chose pour moi ?',
      choices: [
        { text: 'Je cherche du travail.', next: 'travail' },
        {
          text: 'Voici un artefact.',
          next: 'merci',
          conditions: [{ type: 'objet', item: 'artefact' }],
          effects: [
            { type: 'prendre', item: 'artefact' },
            { type: 'roubles', amount: 500 },
            { type: 'reputation', faction: 'solitaires', amount: 1 },
          ],
        },
        {
          text: 'Parlons entre amis.',
          next: 'confidence',
          conditions: [
            { type: 'reputation', faction: 'solitaires', min: 2 },
            { type: 'rang', min: 'experimente' },
          ],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    travail: {
      text: 'Prends ce bandage et file vers l\'ATP.',
      choices: [
        {
          text: 'Merci.',
          next: null,
          effects: [{ type: 'donner', item: 'bandage' }],
        },
        {
          text: 'Payer 100 roubles pour un tuyau.',
          next: 'accueil',
          conditions: [{ type: 'roubles', min: 100 }],
          effects: [{ type: 'roubles', amount: -100 }],
        },
      ],
    },
    merci: {
      text: 'Bon travail. Reviens quand tu veux.',
      choices: [{ text: 'Au revoir.', next: null }],
    },
    confidence: {
      text: 'On raconte qu\'un Guide connaît le chemin du centre.',
      choices: [
        {
          text: 'Où le trouver ?',
          next: null,
          effects: [{ type: 'quete', quest: 'le-guide' }],
        },
      ],
    },
  },
});
