# Équilibrage (carte LBL-45)

Réglages faits pour atteindre les cibles du §17.3 de `docs/brief-v2.md`. Chaque réglage a été
mesuré seul avec le banc de campagne : `npm run bench:campagne -- --campaigns 50` (graine 1,
combat rapide, 50 campagnes de 30 jours par IA). Le banc varie d'environ ±1 jour sur la date
d'achat de l'arme et de ±0,1 mort / 10 jours d'une graine à l'autre : le dernier réglage a été
vérifié sur les graines 1, 2 et 3.

## Cibles et mesures

| Cible §17.3 | Avant (graine 1) | Après (graine 1) | Après (graines 2 et 3) |
| --- | --- | --- | --- |
| Acte 1 fini en 4 à 7 jours (prudente) | J6,2 (86 %) | J6,1 (90 %) | J5,5 · J6,7 |
| Acte 1 fini en 4 à 7 jours (gourmande) | J6,2 (88 %) | J4,3 (100 %) | J3,7 · J4,0 |
| Moins de 1 mort / 10 jours (prudente) | 0,69 | **0,53** | 0,49 · 0,45 |
| Arme d'épaule vers J8 à 12 (prudente) | **J12,7 : écart** | **J10,3** | J11,3 · J11,9 |
| Arme d'épaule vers J8 à 12 (gourmande) | J9,0 | J8,6 | J7,2 · J8,4 |
| Morts / 10 jours (gourmande, hors cible) | 3,07 | 2,52 | 2,46 · 2,79 |

## Diagnostic de départ

- **Arme d'épaule** : seul le Bar (Rostok) vendait le fusil à pompe. La prudente y arrivait
  vers J12 avec 3 757 roubles en moyenne : la date dépendait de l'accès à Rostok, pas du prix.
- **Morts au combat** : 90 % des morts au combat de la prudente et 89 % de celles de la
  gourmande arrivent en combat v2, c'est-à-dire en rencontre de nuit, à 0 PA, sans fuite
  possible. La prudente y meurt surtout dans un abri (carte Nuit « rôdeurs », qui attaque
  même à l'abri) ; la gourmande surtout à découvert (test de Discrétion de nuit raté, environ
  9 embuscades par campagne, 60 % mortelles).
- **Revente des artefacts** : `objets.js` donne pour un artefact son prix de revente (§12),
  mais `traders.js` le traite comme prix de base. Le Marchand du bunker (coefficient 1,2,
  revente d'artefact ×1,6, réputation neutre ×0,5) rachetait à 96 % de ce prix, contre 50 %
  ailleurs.

## Réglages retenus, dans l'ordre

Mesures en graine 1. « Avant » = mesure du réglage précédent.

1. **Fusil à pompe au Marchand du bunker, rang Expérimenté** (`src/content/marchands.js`,
   1 fusil et 2 boîtes de cartouches calibre 12). Sans rang requis, l'achat tombait à J6,4
   (prudente) et J3,8 (gourmande) : trop tôt. Avec le rang Expérimenté (§6.2 : « un marchand ne
   vend pas un fusil d'assaut à un Bleu ») : prudente J12,7 → J11,5, gourmande J9,0 → J10,6.
2. **Revente des artefacts au bunker ×1,6 → ×1,2** (`marchands.js`). Le bunker rachète à 72 % du
   prix de revente, toujours le meilleur acheteur (§6.2). Roubles de la prudente à J10 :
   2 622 → 2 294, à J30 : 4 770 → 4 033. Arme d'épaule inchangée (J11,6), morts dans le bruit
   (0,65 → 0,72).
3. **IA du banc : parlementer en combat v2** (`bench/campaign-ai.js`, correction de l'IA, pas
   d'une règle). L'IA n'utilisait jamais l'action Parlementer et se battait jusqu'à la mort à
   0 PA. La prudente parlemente toujours avec les humains, la gourmande si la riposte peut la
   tuer. Morts / 10 jours : prudente 0,72 → 0,67, gourmande 3,44 → 3,17. Effet faible : la
   plupart des tueurs de nuit sont des mutants ou des bandits hostiles.
4. **Sanglier muté : 3 → 2 PV** (paquets de rencontres du Cordon, du Marais, de la Décharge,
   d'Agroprom et de la Vallée sombre). C'était le premier tueur en combat v2 : au pistolet
   (1 dégât), il fallait 4 à 5 rounds, avec 2 blessures reçues par round. Morts au combat :
   prudente 70 → 63, gourmande 372 → 361 ; morts / 10 jours 0,67 → 0,62 et 3,17 → 3,09.
5. **Paquets Nuit : 2 cartes calmes de plus par tuile** (`src/content/paquets/nuit.js`). La
   carte « rôdeurs » passe de 1 sur 6 à 1 sur 8 au Cordon (2 sur 6 → 2 sur 8 sur les tuiles
   profondes). Morts / 10 jours : prudente 0,62 → 0,52, gourmande 3,09 → 2,69. Mais l'arme
   d'épaule de la prudente glisse à J12,5 (J13,8 et J13,3 sur les graines 2 et 3), ce qui a
   amené le réglage 6.
6. **Fusil à pompe chez Ciel Pur, sans rang** (`marchands.js`, 1 fusil et 2 boîtes de
   cartouches, coefficient 1, donc 1 200 roubles). Un second point de vente avant Rostok.
   Arme d'épaule de la prudente : J12,5 → J10,3 (graine 1), J11,3 et J11,9 (graines 2 et 3).

## Essai écarté

- **IA : racheter un pistolet quand elle n'a plus d'arme** (après une mort, l'équipement est
  perdu). Aucun effet mesurable (prudente 0,62 → 0,69, gourmande 3,09 → 3,26, dans le bruit) :
  retiré.

## Correctif : réapparition sur une tuile jamais visitée

`respawn` (`src/engine/rules/death.js`) plantait quand le hub de réapparition était sur une
tuile absente de `world.tiles` : `closeDay` lisait une tuile inexistante. La tuile est
maintenant créée à la réapparition (`newTileState` de `rules/world.js`, désormais exportée).
Test : « respawn : hub sur une tuile jamais visitée » dans `tests/death.test.js`.

## LBL-56 : fuite de nuit

Décision de Mathieu : la nuit, la fuite d'un combat est permise sans PA, contre 1 blessure
(`src/engine/rules/combat.js`) ; l'IA du banc fuit un combat de nuit toujours (prudente) ou si
la riposte peut tuer (gourmande), jamais si la blessure la tue. Banc graine 1, 50 campagnes :
morts / 10 jours prudente **0,53 → 0,37**, gourmande **2,52 → 2,10** (morts au combat 48 → 19
et 289 → 187 ; morts de faim 14 → 21 et 24 → 53).

## Ce qui reste

- **La gourmande meurt encore 2,5 fois par 10 jours**, à 89 % en combat de nuit. Ce n'est pas
  une cible du §17.3 et c'est son profil : elle dort à découvert. La cause de fond est une
  règle, pas un chiffre de contenu : en combat v2, l'ennemi touche si 1d6 + Menace ≥ 4 +
  couverture + armure, donc **toute Menace de 3 ou plus touche à chaque round** sans couverture
  ni armure ; et la fuite coûte 2 PA, impossible la nuit à 0 PA (hypothèse v2 de
  `rules/time.js`). À trancher par Mathieu si le combat de nuit doit rester aussi mortel.
- La date d'achat de l'arme d'épaule de la gourmande descend parfois sous J8 (J7,2 en
  graine 2) : elle dépense tout, sans réserve.
- L'acte 3 n'est fini que dans 10 à 16 % des campagnes en 30 jours ; le §17.3 ne fixe pas de
  cible au-delà de l'acte 1.

## LBL-52 : PNJ de la quête principale protégés

Un PNJ nécessaire à une étape encore à venir du Guide ne meurt plus (`protectedNpcs` de
`src/engine/rules/npcs.js`) ; seuls le blessé de l'Élévateur et Vovk sont isolés, donc
concernés. Le banc compte désormais la part de campagnes où le Guide est raté (ligne
« ratée », avec la cause).

| Guide raté (graine 1, 50 campagnes) | Avant | Après |
| --- | --- | --- |
| Prudente | 10 % (5 PNJ morts) | **0 %** |
| Gourmande | 0 % | 0 % |

Effet de bord : les 5 campagnes prudentes autrefois bloquées finissent l'acte 1, tard ; la
moyenne passe de J6,1 (90 %) à J7,7 (100 %), juste au-dessus de la cible de 4 à 7 jours. La
gourmande achète son arme d'épaule à J7,8 au lieu de J8,6 : le blessé vivant décale les
tirages, ce qui reste dans la variation d'une graine à l'autre notée plus haut.

## Rapport final du banc (graine 1)

```
Banc de campagne Le Boulon : 50 campagnes de 30 jours par IA, graine 1, combat rapide
== IA prudente
Sans mort en 30 jours 28.0 %   morts / 10 jours 0.527
Morts, réapparitions    1.58 et 1.58 par campagne
Morts par semaine       S1 0.1  S2 0.48  S3 0.4  S4 0.46  S5 0.14 par campagne
Causes de mort          combat 48, faim 14, emission 10, nuit 4, gravitationnelle 2, bruleuse 1
Roubles (moyenne)       J1 0  J5 812.48  J10 2071.14  J15 3211.94  J20 4112.1  J25 4402.8  J30 4297.34   fin 4262.08
Rangs en fin            experimente 34, veteran 12, bleu 4
Quête principale :
  acte 1 fini          90.0 %   jour 6.133 (2 à 18)
  acte 2 fini          64.0 %   jour 19.844 (8 à 30)
  acte 3 fini          10.0 %   jour 24.4 (20 à 29)
  acte 4 fini           4.0 %   jour 26 (24 à 28)
  acte 5 fini           0.0 %   —
  étape en fin          a3-usine 20, a2-descente 6, a2-documents 6, a1-elevateur 5, a3-donnees 4, a3-labo 3, a5-attaque 2, a4-devoir-traque 2, a4-bar 1, a2-barrage 1
Arme d'épaule achetée   86.0 %   jour 10.302 (6 à 27)
Inventaire au retour    45.5 % de la grille
Lieux vidés             0 par campagne
Émissions subies        7.02 par campagne, dont 0.34 sans abri
Quêtes et contrats      1.06 réussis, 0.42 ratés par campagne
Combats                 31.42 par campagne
Garde-fous              0 bloquées, 10 nuits forcées, 481.02 actions / campagne
== IA gourmande
Sans mort en 30 jours 0.0 %   morts / 10 jours 2.52
Morts, réapparitions    7.56 et 7.56 par campagne
Morts par semaine       S1 1.4  S2 2  S3 1.8  S4 1.86  S5 0.5 par campagne
Causes de mort          combat 289, emission 34, faim 24, gravitationnelle 18, nuit 5, electro 4, bruleuse 4
Roubles (moyenne)       J1 0  J5 1206.86  J10 1513.86  J15 1260.42  J20 1342.12  J25 1459.58  J30 1522.36   fin 1592.72
Rangs en fin            experimente 24, bleu 23, veteran 3
Quête principale :
  acte 1 fini         100.0 %   jour 4.32 (2 à 13)
  acte 2 fini          74.0 %   jour 19.676 (8 à 30)
  acte 3 fini          16.0 %   jour 26.125 (18 à 30)
  acte 4 fini           2.0 %   jour 28 (28 à 28)
  acte 5 fini           0.0 %   —
  étape en fin          a3-usine 18, a3-labo 8, a2-documents 6, a4-devoir-preuve 5, a2-descente 5, a3-donnees 3, a2-barrage 2, a4-bar 2, a5-attaque 1
Arme d'épaule achetée   82.0 %   jour 8.634 (2 à 28)
Inventaire au retour    32.2 % de la grille
Lieux vidés             1.04 par campagne
Émissions subies        6.82 par campagne, dont 1.04 sans abri
Quêtes et contrats      1.22 réussis, 0.5 ratés par campagne
Combats                 43.54 par campagne
Garde-fous              0 bloquées, 49 nuits forcées, 735.66 actions / campagne
Cibles du §17.3 :
  prudente   acte 1 en 4 à 7 jours : OK (jour 6.133 (2 à 18), 90.0 % des campagnes)
             arme d'épaule vers le jour 8 à 12 : OK (jour 10.302 (6 à 27), 86.0 %)
  gourmande  acte 1 en 4 à 7 jours : OK (jour 4.32 (2 à 13), 100.0 % des campagnes)
             arme d'épaule vers le jour 8 à 12 : OK (jour 8.634 (2 à 28), 82.0 %)
  prudente   moins de 1 mort / 10 jours : OK (0.527)
```
