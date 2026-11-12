// Grille hexagonale de la tuile : 19 hexagones, rayon 2.
//
// ORIENTATION : hexagones à sommet plat (« flat-top »), rangés en colonnes
// verticales de 3-4-5-4-3, comme sur assets/tuile-agroprom.png.
//
// COORDONNÉES AXIALES { q, r } :
//   q = colonne, de -2 (gauche) à +2 (droite) ;
//   r croît vers le bas dans une colonne ; le centre est { q: 0, r: 0 }.
//   Troisième coordonnée implicite s = -q - r. Un hexagone est sur la tuile
//   si max(|q|, |r|, |s|) <= 2.
//   Pixel (pour l'UI) : x = 1.5 * taille * q, y = √3 * taille * (r + q / 2).
//
// DIRECTIONS (DIRECTIONS.<nom>) :
//   N { 0,-1 }  NE { 1,-1 }  SE { 1,0 }  S { 0,1 }  SO { -1,1 }  NO { -1,0 }
//
// NUMÉROTATION 1-19 (stable, ne pas changer : les règles et les données s'y réfèrent) :
//   1        : le centre.
//   2 à 7    : le cœur, en partant du nord puis dans le sens horaire (N, NE, SE, S, SO, NO).
//   8 à 19   : l'anneau extérieur, en partant du nord { 0,-2 } puis dans le sens horaire.
//
//             8
//        19       9
//   18        2       10
//        7        3
//   17        1       11
//        6        4
//   16        5       12
//        15       13
//            14
//
// API :
//   RADIUS                 rayon de la tuile (2).
//   DIRECTIONS             les 6 vecteurs de déplacement, nommés.
//   HEXES                  [{ n, q, r }] trié par numéro.
//   toAxial(n)             numéro -> { q, r }, ou null hors 1-19.
//   toNumber({ q, r })     axial -> numéro, ou null hors tuile.
//   isOnBoard({ q, r })    vrai si l'hexagone appartient à la tuile.
//   neighbors(n)           numéros des voisins sur la tuile (2 à 6), ordre N, NE, SE, S, SO, NO.
//   distance(a, b)         nombre de pas entre deux numéros.
//   isEdge(n)              vrai si l'hexagone est sur l'anneau extérieur.
//   edgeHexes()            numéros des 12 hexagones de bord, triés.

export const RADIUS = 2;

export const DIRECTIONS = Object.freeze({
  N: { q: 0, r: -1 },
  NE: { q: 1, r: -1 },
  SE: { q: 1, r: 0 },
  S: { q: 0, r: 1 },
  SO: { q: -1, r: 1 },
  NO: { q: -1, r: 0 },
});

// Ordre de marche autour d'un anneau, depuis le nord, pour tourner dans le sens horaire.
const RING_WALK = ['SE', 'S', 'SO', 'NO', 'N', 'NE'];

const add = (a, b) => ({ q: a.q + b.q, r: a.r + b.r });
const key = ({ q, r }) => `${q},${r}`;
const ringOf = ({ q, r }) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));

function ring(radius) {
  if (radius === 0) return [{ q: 0, r: 0 }];
  const cells = [];
  let cell = { q: 0, r: -radius };
  for (const name of RING_WALK) {
    for (let step = 0; step < radius; step++) {
      cells.push(cell);
      cell = add(cell, DIRECTIONS[name]);
    }
  }
  return cells;
}

export const HEXES = Object.freeze(
  [0, 1, 2]
    .flatMap(ring)
    .map(({ q, r }, i) => Object.freeze({ n: i + 1, q, r })),
);

const byKey = new Map(HEXES.map((hex) => [key(hex), hex.n]));

export function toAxial(n) {
  const hex = HEXES[n - 1];
  return hex ? { q: hex.q, r: hex.r } : null;
}

export function toNumber(axial) {
  return byKey.get(key(axial)) ?? null;
}

export function isOnBoard(axial) {
  return ringOf(axial) <= RADIUS;
}

export function neighbors(n) {
  const origin = toAxial(n);
  return Object.values(DIRECTIONS)
    .map((dir) => toNumber(add(origin, dir)))
    .filter((m) => m !== null);
}

export function distance(a, b) {
  const from = toAxial(a);
  const to = toAxial(b);
  return ringOf({ q: to.q - from.q, r: to.r - from.r });
}

export function isEdge(n) {
  return ringOf(toAxial(n)) === RADIUS;
}

export function edgeHexes() {
  return HEXES.filter(({ n }) => isEdge(n)).map(({ n }) => n);
}
