// Test de cohérence du contenu réel (brief v2 §17.2). Il grandit avec chaque carte de
// contenu : chaque règle de src/content/validate.js s'active dès que sa collection existe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/content/index.js';
import { validateContent } from '../src/content/validate.js';

test('le contenu de src/content/index.js est cohérent', () => {
  const errors = validateContent(content);
  assert.deepEqual(errors, [], `\n${errors.join('\n')}`);
});
