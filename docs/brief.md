# Brief — « Le Boulon », proto web v1

## Contexte

Jeu de plateau solo dans l'univers de STALKER, dans l'esprit du jeu web Shinobi (shinobi.fr) : un budget de points d'action par journée, des missions prises au comptoir, une carte traversée case par case, une fiche qui progresse.

Document de game design complet : https://claude.ai/artifact/HscHoZiXXEGV1rNLCXSQyN

La v1 sert à **tester l'économie de PA** : une seule journée, sur une seule tuile (Agroprom), avec une mission, les boulons, les jetons suspects, les rencontres et l'Émission. Pas encore de campagne, de Bar, de factions ni de progression.

## Stack

- Node 22, JavaScript vanilla en modules ES, sans framework.
- Rendu en SVG dans une page HTML. Pas de canvas.
- Le moteur de règles est pur et sans DOM (`src/engine/`) : état en entrée, état + événements en sortie. Le hasard passe par un RNG à graine injecté.
- Tests avec `node --test`, écrits d'abord sur les règles.
- L'interface (`src/ui/`) ne fait que lire l'état et envoyer des actions au moteur.

## Ressources

- `assets/tuile-agroprom.png` : la tuile de 19 hexagones. Elle sert de fond de plateau, avec la grille hex calée par-dessus.
- `assets/tuile-vallee-sombre.png` : pour plus tard, hors v1.

## Règles v1

Quand une règle ci-dessous n'est pas tranchée dans le document de design, elle est marquée **(hypothèse v1)** : à garder simple et facile à régler.

### Plateau

- Tuile de 19 hexagones (rayon 2) : un cœur de 7 hexagones et un anneau extérieur de 12. Hexagones numérotés de 1 à 19, coordonnées axiales en interne.
- Chaque hexagone a un terrain : `route`, `herbe`, `foret`, `marais`, `batiment`. Il peut aussi avoir un lieu nommé : Фабрика (usine), Тунель (tunnel), Агропром (complexe), Болото (marais).
- Les lieux de type bâtiment ou tunnel sont des **abris**.
- Le joueur entre par un hexagone de bord fixé (côté Cordon) et doit ressortir par un hexagone de bord pour finir la journée.

### Points d'action

- Une journée = **10 PA** + Endurance (Endurance = 0 en v1). Les PA non dépensés sont perdus.

| Action | Coût |
| --- | --- |
| Entrer sur route ou herbe | 1 PA |
| Entrer en forêt | 2 PA |
| Entrer dans un marais | 3 PA + test de Survie, sinon 1 blessure |
| Entrer dans un lieu | 1 PA |
| Fouiller un lieu | 2 PA |
| Lancer un boulon | 1 PA |
| Fuir un combat | 2 PA |
| Manger ou se bander | 1 PA |

- **Tests (hypothèse v1)** : 1d6 + stat ≥ 5. Stats de départ : Tir 1, Survie 1, Discrétion 1.

### Jetons suspects

- 5 par tuile, posés face cachée à la mise en place. Pour placer un jeton : d20, relance sur 20 ou sur un hexagone déjà occupé, jamais sur l'hexagone d'entrée.
- **Composition (hypothèse v1)** : 2 anomalies, 2 artefacts, 1 « rien ».
- Un artefact est toujours posé à côté d'une anomalie. S'il n'y a pas de place, on retire et on recommence.

| Jeton | Effet si on entre sans l'avoir révélé |
| --- | --- |
| Anomalie électro | 2 blessures, le détecteur tombe en panne |
| Anomalie gravitationnelle | 3 blessures, projeté sur un hexagone voisin au hasard |
| Anomalie brûleuse | 2 blessures, un consommable détruit |
| Artefact | À ramasser : 1 PA + test de Survie |
| Rien | Fausse alerte |

- Entrer à l'aveugle : un test de Survie réussi évite l'effet de l'anomalie. Le jeton est révélé dans tous les cas.
- Une anomalie révélée bloque l'hexagone : on ne peut plus y entrer.
- **Boulon** : 1 PA, révèle un hexagone adjacent. 10 boulons au départ.
- **Détecteur** : révèle passivement les artefacts à 2 hexagones ou moins. Il est en panne après une anomalie électro.

### Rencontres et combat

- 3 jetons de rencontre par tuile, posés comme les jetons suspects.
- Entrer sur l'hexagone d'une rencontre ou à côté déclenche un test de Discrétion **avant** de révéler la carte. S'il réussit, on contourne et le jeton reste en place. +1 si le joueur est en forêt.
- Sinon, on révèle la carte (paquet Agroprom : militaires, chiens aveugles, pillard…) et on choisit :
  - **Combattre** : 1d6 + Tir + bonus d'arme contre la Menace de la carte. Couverture : +1 en forêt, +2 dans un bâtiment. Une victoire retire la rencontre. Une défaite coûte des blessures (indiquées sur la carte) et 1 munition, et on peut relancer le combat.
  - **Fuir** : 2 PA et on recule sur l'hexagone d'où l'on vient.
- **Paquet Agroprom (hypothèse v1)**, 6 cartes : Menace de 3 à 7, blessures en cas de défaite de 1 à 3.
- Arme de départ : pistolet, bonus +1, 6 munitions. Sans munitions, le bonus d'arme tombe à −1.

### Blessures, radiations, inventaire

- Piste de blessures de 0 à 6. À 4 ou plus : −1 PA sur les actions de la journée **(hypothèse v1 : on retire immédiatement 1 PA du budget restant au moment où l'on atteint 4)**. À 6 : mort, la partie est perdue.
- Piste de radiations de 0 à 6 **(hypothèse v1)** : +1 sur certains hexagones et certains artefacts. À 6 : 1 blessure, puis la piste retombe à 3. La vodka retire 2 radiations.
- Inventaire en grille de 12 cases. Départ : pistolet (2), munitions (1), boulons (1), 2 bandages (1 chacun), 1 vodka (1), 1 ration (1). Un artefact occupe 1 case.
- Bandage : 1 PA, −1 blessure.

### Paquet Zone et Émission

- **Adaptation v1** : comme il n'y a qu'une tuile, on pioche une carte Zone chaque fois que le total de PA dépensés franchit un multiple de 3.
- **Paquet (hypothèse v1)**, 10 cartes : patrouille (déplace un jeton de rencontre d'un hexagone), chiens attirés (nouveau jeton de rencontre à 2 hexagones), brouillard (boulons inutilisables jusqu'à la prochaine pioche), cachette (un consommable gratuit), radio (rien en v1, plus tard une mission express), calme ×3, et l'**Émission**.
- L'Émission est mélangée dans le dernier tiers du paquet.
- Quand elle sort, le joueur a 3 PA pour atteindre un abri. S'il n'y arrive pas : 5 blessures et la journée s'arrête là (fin de partie en v1).
- Après l'Émission, on retire tous les jetons suspects non ramassés, puis on en repose 5 neufs.

### Mission et fin de journée

- **Une mission tirée au hasard parmi deux** :
  - Récupération : ramasser 1 artefact et ressortir.
  - Cartographie : révéler les 5 jetons suspects d'origine et ressortir.
- **Victoire** : mission remplie et sortie par un hexagone de bord avant d'être à 0 PA.
- **Défaite** : mort, ou PA épuisés sans être sorti (la nuit tombe dans la Zone), ou Émission prise sans abri.
- **Score de fin de journée** : roubles (valeur des artefacts ramassés + prime de mission), à afficher pour comparer les parties.

## Interface

- Le plateau prend la place principale : la tuile en fond, la grille hex calée dessus, les jetons face cachée bien visibles.
- Survol d'un hexagone : son coût en PA et un aperçu de la case une fois atteinte. Clic sur un hexagone adjacent : déplacement. Bouton ou clic droit : boulon.
- Panneau latéral : PA restants (élément le plus visible), blessures, radiations, inventaire, mission.
- Journal en bas, sobre comme un PDA : chaque événement en une ligne.
- Retours visuels marqués sur les moments clés : boulon qui révèle, anomalie déclenchée, carte Zone piochée et surtout l'annonce de l'Émission (écran qui vire, compte à rebours de 3 PA).
- Ambiance : vert délavé et rouille, typographie de terminal pour le PDA.

## Hors périmètre v1

Campagne et fiche persistante, Bar et marchand, factions et réputation, autres tuiles, détecteurs améliorés, dormir dehors, carte Nuit.

## Critères d'acceptation

- `node --test` passe, et chaque règle ci-dessus a au moins un test.
- Une partie se joue de bout en bout dans le navigateur, avec victoire, défaite et score.
- Une même graine donne la même partie.
- Un banc headless joue N parties avec une IA naïve et sort : taux de victoire, PA restants en moyenne, cause des défaites, tour moyen de l'Émission.
