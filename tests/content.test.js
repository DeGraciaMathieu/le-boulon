// Test de cohérence du contenu réel (brief v2 §17.2). Il grandit avec chaque carte de
// contenu : chaque règle de src/content/validate.js s'active dès que sa collection existe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/content/index.js';
import { validateContent } from '../src/content/validate.js';
import dialogueExemple from './fixtures/dialogue-exemple.js';

// Champs de format en français qui ont un nom anglais dans validate.js (LBL-47). Les tuiles
// gardent le format v1 documenté (hexes : terrain, lieu?, abri?), elles ne sont pas listées.
const FRENCH_FIELDS = Object.freeze({
  dialogues: ['debut', 'noeuds', 'texte', 'choix', 'vers', 'condition', 'effets', 'objet',
    'montant', 'quete', 'etape', 'lieu', 'planque'],
  factions: ['nom', 'base', 'tuiles', 'rejoignable', 'attitude', 'acte', 'lieux'],
  items: ['nom', 'categorie', 'prix', 'taille', 'munitions'],
});

// Chemins des champs interdits trouvés sous value.
function frenchFields(value, path, forbidden) {
  if (value === null || typeof value !== 'object') return [];
  const found = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
    // condition est le champ anglais de la condition { type: 'non', condition } (dialogue.js).
    const negation = key === 'condition' && value.type === 'non';
    if (!Array.isArray(value) && forbidden.includes(key) && !negation) found.push(childPath);
    found.push(...frenchFields(child, childPath, forbidden));
  }
  return found;
}

const frenchFieldsOf = (collections) =>
  Object.entries(FRENCH_FIELDS).flatMap(([collection, forbidden]) =>
    Object.entries(collections[collection] ?? {}).flatMap(([id, entry]) =>
      frenchFields(entry, `${collection}.${id}`, forbidden)));

test('le contenu de src/content/index.js est cohérent', () => {
  const errors = validateContent(content);
  assert.deepEqual(errors, [], `\n${errors.join('\n')}`);
});

test('aucun champ de format en français là où validate.js attend l\'anglais', () => {
  const found = frenchFieldsOf(content);
  assert.deepEqual(found, [], `\n${found.join('\n')}`);
});

test('le test des champs français attrape un ancien format', () => {
  const old = {
    dialogues: { d: { debut: 'a', noeuds: [{ texte: '…', choix: [{ texte: 'ok', vers: 'b' }] }] } },
    factions: { f: { nom: 'F', tuiles: ['cordon'], rejoignable: false, attitude: 'neutre' } },
  };
  assert.deepEqual(frenchFieldsOf(old), [
    'dialogues.d.debut', 'dialogues.d.noeuds', 'dialogues.d.noeuds[0].texte',
    'dialogues.d.noeuds[0].choix', 'dialogues.d.noeuds[0].choix[0].texte',
    'dialogues.d.noeuds[0].choix[0].vers',
    'factions.f.nom', 'factions.f.tuiles', 'factions.f.rejoignable', 'factions.f.attitude',
  ]);
});

// En attendant les dialogues de la carte 19, le dialogue d'exemple des tests du moteur tient
// lieu de contenu : il doit suivre le même format.
test('le dialogue d\'exemple suit le format des dialogues de validate.js', () => {
  const asContent = Object.freeze({ dialogues: Object.freeze({ [dialogueExemple.id]: dialogueExemple }) });
  const errors = validateContent(asContent);
  assert.deepEqual(errors, [], `\n${errors.join('\n')}`);
  assert.deepEqual(frenchFieldsOf(asContent), []);
});
