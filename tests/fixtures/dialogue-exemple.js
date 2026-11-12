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
  debut: 'accueil',
  noeuds: [
    {
      id: 'accueil',
      texte: 'Approche, stalker. Tu as quelque chose pour moi ?',
      choix: [
        { texte: 'Je cherche du travail.', vers: 'travail' },
        {
          texte: 'Voici un artefact.',
          vers: 'merci',
          condition: { type: 'objet', objet: 'artefact' },
          effets: [
            { type: 'prendre-objet', objet: 'artefact' },
            { type: 'roubles', montant: 500 },
            { type: 'reputation', faction: 'solitaires', montant: 1 },
          ],
        },
        {
          texte: 'Parlons entre amis.',
          vers: 'confidence',
          condition: {
            type: 'tous',
            conditions: [
              { type: 'reputation', faction: 'solitaires', min: 2 },
              { type: 'rang', min: 'experimente' },
            ],
          },
        },
        { texte: 'Au revoir.' },
      ],
    },
    {
      id: 'travail',
      texte: 'Prends ce bandage et file vers l\'ATP.',
      choix: [
        {
          texte: 'Merci.',
          effets: [{ type: 'donner-objet', objet: 'bandage' }],
        },
        {
          texte: 'Payer 100 roubles pour un tuyau.',
          vers: 'accueil',
          condition: { type: 'roubles', min: 100 },
          effets: [{ type: 'roubles', montant: -100 }],
        },
      ],
    },
    {
      id: 'merci',
      texte: 'Bon travail. Reviens quand tu veux.',
      choix: [{ texte: 'Au revoir.' }],
    },
    {
      id: 'confidence',
      texte: 'On raconte qu\'un Guide connaît le chemin du centre.',
      choix: [
        {
          texte: 'Où le trouver ?',
          effets: [{ type: 'demarrer-quete', quete: 'le-guide' }],
        },
      ],
    },
  ],
});
