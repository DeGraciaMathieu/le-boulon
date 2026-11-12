import { test } from 'node:test';
import assert from 'node:assert/strict';
import agroprom, { calage } from '../src/engine/data/agroprom.js';
import { HEXES, isEdge } from '../src/engine/hex.js';

const TERRAINS = ['route', 'herbe', 'foret', 'marais', 'batiment'];
const LIEUX = ['Фабрика', 'Тунель', 'Агропром', 'Болото'];
const LIEUX_ABRIS = ['Фабрика', 'Тунель', 'Агропром'];

const entries = Object.entries(agroprom.hexes).map(([n, hex]) => ({ n: Number(n), ...hex }));

// Centre de l'hexagone n en pixels de l'image, d'après le calage.
function pixelOf(n) {
  const { q, r } = HEXES[n - 1];
  const x = 1.5 * calage.taille * q;
  const y = Math.sqrt(3) * calage.taille * (r + q / 2);
  const angle = (calage.rotation * Math.PI) / 180;
  return {
    x: calage.cx + x * Math.cos(angle) - y * Math.sin(angle),
    y: calage.cy + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

test('la tuile décrit les 19 hexagones, de 1 à 19', () => {
  assert.deepEqual(
    entries.map((h) => h.n).sort((a, b) => a - b),
    HEXES.map((h) => h.n),
  );
});

test('chaque hexagone a un terrain valide', () => {
  for (const hex of entries) assert.ok(TERRAINS.includes(hex.terrain), `hexagone ${hex.n}`);
});

test('chaque lieu est connu et n\'apparaît qu\'une fois', () => {
  const lieux = entries.filter((h) => h.lieu).map((h) => h.lieu);
  for (const lieu of lieux) assert.ok(LIEUX.includes(lieu), lieu);
  assert.equal(new Set(lieux).size, lieux.length);
});

test('les abris sont exactement les lieux bâtiment ou tunnel', () => {
  for (const hex of entries) {
    assert.equal(Boolean(hex.abri), LIEUX_ABRIS.includes(hex.lieu), `hexagone ${hex.n}`);
  }
});

test('l\'entrée est un hexagone de bord, sur la rangée sud de l\'image', () => {
  assert.ok(isEdge(agroprom.entry));
  const southY = Math.max(...HEXES.map((h) => pixelOf(h.n).y));
  assert.ok(Math.abs(pixelOf(agroprom.entry).y - southY) < 1);
});

test('le calage tient la grille dans l\'image (735 x 679)', () => {
  for (const { n } of HEXES) {
    const { x, y } = pixelOf(n);
    assert.ok(x - calage.taille * Math.sqrt(3) / 2 >= -1 && x + calage.taille * Math.sqrt(3) / 2 <= 736, `x ${n}`);
    assert.ok(y - calage.taille >= -1 && y + calage.taille <= 680, `y ${n}`);
  }
});

test('une ou deux cases irradiées', () => {
  const irradiees = entries.filter((h) => h.radiation).length;
  assert.ok(irradiees >= 1 && irradiees <= 2);
});
