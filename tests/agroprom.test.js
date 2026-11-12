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
  return {
    x: calage.cx + Math.sqrt(3) * calage.taille * (q + r / 2),
    y: calage.cy + 1.5 * calage.taille * r,
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

test('disposition de l\'image : rangées 18 19 8 / 17 7 2 9 / 16 6 1 3 10 / 15 5 4 11 / 14 13 12', () => {
  const rows = [[18, 19, 8], [17, 7, 2, 9], [16, 6, 1, 3, 10], [15, 5, 4, 11], [14, 13, 12]];
  rows.forEach((row, i) => {
    const centers = row.map(pixelOf);
    for (const { y } of centers) assert.ok(Math.abs(y - (calage.cy + 1.5 * calage.taille * (i - 2))) < 0.01);
    for (let k = 1; k < centers.length; k++) assert.ok(centers[k].x > centers[k - 1].x, `rangée ${i}`);
  });
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
