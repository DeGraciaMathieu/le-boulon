# Brief v2 — « Le Boulon », la Zone entière

## En une phrase

La v1 faisait tenir une journée sur une tuile. La v2 est une **campagne de plusieurs semaines de jeu** :

- **7 tuiles** reliées en carte du monde ;
- **une cinquantaine de lieux** à fouiller ;
- **4 hubs**, avec marchands, barman, médecin et technicien ;
- **une quête principale en 5 actes**, des quêtes secondaires écrites à la main et des contrats générés ;
- **des factions**, une fiche qui progresse et un monde qui bouge entre deux journées.

Le cœur reste le même : **10 PA par jour**, des boulons, des jetons cachés et une Émission qui oblige à se mettre à l'abri.

Document de game design : https://claude.ai/artifact/HscHoZiXXEGV1rNLCXSQyN
Brief v1 : `docs/brief.md` (il reste valable pour tout ce que ce brief ne modifie pas).

---

## 1. Piliers

1. **L'exploration rapporte.** Chaque lieu fouillé peut donner du butin, un indice, un PNJ ou une quête. Il n'y a pas de case vide sans raison.
2. **Partir, c'est risquer.** Tout se joue entre deux hubs : PA, poids porté, munitions, radiations, Émission. Le jeu doit faire hésiter entre rentrer maintenant et pousser un lieu plus loin.
3. **La Zone vit sans le joueur.** Entre deux passages sur une tuile, les anomalies se déplacent, les patrouilles circulent, les marchands renouvellent leur stock et les rumeurs vieillissent.
4. **Lisible comme un jeu de plateau.** Tout est jeton, carte, piste ou dé. Rien n'est caché dans une formule opaque, et chaque jet apparaît dans le journal.
5. **Un moteur pur, du contenu en données.** Les règles sont du code testé. Les lieux, objets, PNJ, quêtes et dialogues sont des données validées par des tests de cohérence.

## 2. Ce qu'on garde de la v1

Tout le moteur v1 est conservé et étendu, sans être réécrit :

- `step(state, action)` pur, RNG à graine, état sérialisable ;
- grille de 19 hexagones et coûts de terrain ;
- jetons suspects, boulon et détecteur ;
- rencontres et test de Discrétion ;
- fiche, blessures et radiations ;
- paquet Zone ;
- banc headless.

Mesures du banc v1 (1000 parties, graine 1) :

| Mesure | Valeur |
| --- | --- |
| Victoires | 56,8 % |
| Défaites par nuit tombée | 15,6 % |
| Missions ratées | 15,1 % |
| Morts | 11,5 % |
| Pris par l'Émission | 1 % |
| PA restants en fin de partie (moyenne) | 2,9 |

**Constat :** l'économie de 10 PA fonctionne sur une tuile. En revanche, l'Émission quotidienne ne tue presque personne et elle n'est pas lisible comme événement. En v2, elle devient un **événement global, plus rare et annoncé** (section 10).

## 3. Le monde

### 3.1 Les 7 tuiles

Les images sont dans `assets/tuiles/`. Les versions de travail sont rangées dans `assets/tuiles/brouillons/` et ne servent pas au jeu. `assets/tuile-agroprom.png` reste en place pour la v1. `assets/tuile-vallee-sombre.png` est l'ancienne version de la Vallée Sombre : la v2 utilise `assets/tuiles/vallee-sombre.png`.

| id | Nom | Image | Rôle |
| --- | --- | --- | --- |
| `cordon` | Cordon (Кордон) | `cordon.png` | Départ, hub des novices, militaires au sud |
| `marais` | Marais (Болото) | `marais.png` | Hub de Ciel Pur, terrain lent, arc secondaire |
| `decharge` | Décharge (Звалище) | `decharge.png` | Carrefour central, bandits, radiations |
| `agroprom` | Agroprom (Агропром) | `agroprom.png` | Institut, souterrains, militaires |
| `vallee-sombre` | Vallée Sombre (Темна долина) | `vallee-sombre.png` | Base des bandits, accès au laboratoire |
| `rostok` | Rostok (Росток) | `rostok.png` | Bar « 100 Rads », hub du Devoir |
| `entrepots` | Entrepôts militaires (Армійські склади) | `entrepots-militaires.png` | Base de Liberté, route du Nord, fin de la v2 |

**Calage :** les images ne font pas toutes exactement la même taille (735 à 736 px de large, 678 à 688 px de haut). Chaque tuile a donc son propre `calage` `{ cx, cy, taille }`, comme Agroprom en v1. Toutes les tuiles ont des hexagones à sommet pointu, en rangées 3-4-5-4-3, et la numérotation 1–19 de `hex.js` ne change pas.

### 3.2 Carte du monde

Les tuiles forment un graphe. Une **liaison** relie un hexagone de bord d'une tuile à un hexagone de bord de la tuile voisine. Sortir par un hexagone de liaison coûte **1 PA**, et le joueur arrive sur l'hexagone de liaison correspondant de l'autre tuile.

```
            entrepots
                |
              rostok
                |
agroprom ---- decharge ---- vallee-sombre
   |            |
 marais ----- cordon
```

| Liaison | Côté A | Côté B |
| --- | --- | --- |
| cordon ↔ decharge | bord nord du Cordon | bord sud de la Décharge |
| cordon ↔ marais | bord ouest du Cordon | bord est du Marais |
| marais ↔ agroprom | bord nord du Marais | bord sud d'Agroprom |
| agroprom ↔ decharge | bord est d'Agroprom | bord ouest de la Décharge |
| decharge ↔ vallee-sombre | bord est de la Décharge | bord ouest de la Vallée Sombre |
| decharge ↔ rostok | bord nord de la Décharge | bord sud de Rostok |
| rostok ↔ entrepots | bord nord de Rostok | bord sud des Entrepôts |

Pour chaque liaison, on choisit **un hexagone de bord** de chaque côté, de préférence sur une route visible sur l'image. Ce choix se fait en regardant l'image.

**Carte du monde à l'écran :** une vue réduite des 7 tuiles. Elle montre où est le joueur, les tuiles connues (jamais visitées = grisées) et les marqueurs de quête. Le voyage se fait toujours hexagone par hexagone : la carte du monde sert à se repérer, pas à se téléporter.

### 3.3 Légende des images

Les cartes portent des symboles. Voici l'**interprétation proposée**, à valider (voir les questions ouvertes) :

| Symbole | Interprétation pour le jeu |
| --- | --- |
| Cercle hachuré blanc | Lieu à fouiller (section 5). S'il s'agit d'un bâtiment, c'est un abri. |
| Petits pictogrammes blancs doublés sur un hexagone | Forêt dense : terrain `foret` (2 PA, +1 couverture et Discrétion) |
| Trèfle radioactif orange | Hexagone irradié : +1 radiation en y entrant |
| Tête de mort | Repaire de mutants : un jeton de rencontre fixe, plus dangereux |
| Écusson de faction | Présence d'une faction (militaires à la Застава et à l'institut d'Agroprom) |
| Losange avec silhouette | PNJ présent : donneur de quête ou stalker isolé |
| Cible rouge (Блокпост, Décharge) | Barrage des bandits : péage ou combat |

### 3.4 Les lieux

Chaque lieu a un `id`, un nom en français et l'étiquette ukrainienne d'origine (affichée en sous-titre, pour l'ambiance), un hexagone, des tags et un paquet d'exploration (section 5).

**Cordon**
- Camp des novices (Табір новачків) — **HUB** des Solitaires. On y trouve le Marchand (bunker), un lit, un coffre et le tableau des contrats.
- Ferme (Ферма) — abri, butin léger.
- Élévateur (Елеватор) — abri, PNJ blessé (quête).
- ATP (АТП), dépôt de véhicules — repaire voisin (tête de mort), début de l'acte 1.
- Fosse aux déchets (Могильник відходів) — irradiée, artefacts.
- Avant-poste (Застава) — militaires hostiles. Abri impossible tant qu'ils sont là.

**Marais**
- Base de Ciel Pur (База « Чистого неба ») — **HUB** de Ciel Pur, avec un technicien.
- Ruines du village (Руїни села), Cour mécanisée (Механізований двір), Station de pompage (Насосна станція), Ferme incendiée (Спалений хутір), Hameau des pêcheurs (Рибальський хутір), Église (Церква), Hameau (Хутір), Fortin (Форпост).
- Particularité : la majorité des hexagones sont en `marais` (3 PA). C'est la tuile lente et dangereuse, mais la plus riche en artefacts.

**Décharge**
- Barrage (Блокпост) — péage des bandits.
- Ruines (Руїни) — irradiées.
- Tunnel (Тунель).
- Dépôt (Депо) — irradié, grand abri.
- Arrêt de bus (Автобусна зупинка) — PNJ.
- Cimetière de véhicules (Стоянка покинутої техніки) — très irradié, artefacts.
- Poste de contrôle (КПП) — liaison vers le Cordon.

**Agroprom**
- Institut Agroprom (Агропром) — militaires.
- Usine (Фабрика) — repaire.
- Souterrains (Тунель) — lieu long de la quête principale.
- Marais (Болото).

**Vallée Sombre**
- Usine (Фабрика) — base des bandits, repaire.
- Complexe (Завод) — accès au laboratoire, acte 3.
- Gorge (Ущелина), Poste détruit (Розбите КПП), Station-service (Заправка), Pont (Міст), Ferme (Ферма).

**Rostok**
- Bar « 100 Rads » (Бар 100 рентген) — **HUB** du Devoir, avec le barman, le marchand, le médecin et l'arène.
- Cour mécanisée (Механізований двір).
- Les autres bâtiments ne sont pas nommés sur l'image : 2 ou 3 lieux sont à nommer en regardant les bâtiments, par exemple l'Usine Rostok au nord et la Barrière du Devoir au sud.

**Entrepôts militaires**
- Base de Liberté — **HUB** de Liberté. C'est le grand cercle de l'image. Attention : l'étiquette « Бар 100 рентген » y apparaît aussi, ce qui est probablement une erreur de la carte d'origine (voir les questions ouvertes).
- Village abandonné (maisons à l'ouest), Champ d'anomalies (rochers au nord-est), Lac (est).
- La route du Nord est la fin de la v2.

Chaque tuile a aussi des hexagones sans lieu. Ils portent les jetons suspects et les rencontres, comme en v1.

## 4. Le temps

### 4.1 La journée

- **10 PA par jour** + Endurance. Les PA non dépensés sont perdus.
- La journée se termine de trois façons : en dormant dans un hub (action `sleep`), en bivouaquant dehors (action `camp`) ou quand les PA tombent à 0 (bivouac forcé là où l'on est).
- Il n'y a plus de défaite par la nuit : la nuit devient une **carte Nuit** à piocher (section 4.3).

### 4.2 Le calendrier

- Le compteur de jours commence au jour 1. La campagne n'a pas de limite de jours. Certaines quêtes ont un délai, d'autres événements sont datés (par exemple, la guerre Devoir/Liberté éclate au jour 25 si rien ne l'a déclenchée avant).
- Chaque matin, on pioche une **carte Météo de la Zone** : calme, brouillard, pluie (Discrétion +1, détecteur −1), signes d'Émission (section 10).

### 4.3 Dormir

| Où | Effet |
| --- | --- |
| Lit d'un hub (gratuit dans le hub de sa faction, sinon 50 roubles) | −1 blessure, la journée suivante commence à 10 PA, le stock du marchand avance d'un jour |
| Bivouac dans un abri | Carte Nuit (paquet de la tuile), pas de soin |
| Bivouac à découvert | Carte Nuit avec un test de Discrétion : en cas d'échec, rencontre de nuit. Le lendemain commence avec −2 PA. |

### 4.4 Faim

Il faut manger une ration (ou un aliment) par jour au réveil. Une journée sans manger : −2 PA. Deux jours de suite : en plus, 1 blessure.

## 5. Les lieux et l'exploration

C'est le principal ajout. Un lieu n'est plus seulement une case à fouiller pour 2 PA : c'est une **petite exploration à cartes**.

### 5.1 Règle

- Entrer dans un lieu coûte 1 PA, comme en v1. L'écran bascule alors sur la vue du lieu.
- Chaque lieu a un **paquet d'exploration** de 4 à 10 cartes. On les révèle une par une : **Explorer** coûte 1 PA et révèle la carte suivante.
- Certaines cartes sont **fixées** à une position du paquet par la quête en cours, par exemple l'indice de l'acte 1 toujours en 3e position à l'ATP. Les autres sont tirées du paquet du lieu.
- On peut quitter le lieu à tout moment. Sa progression est gardée : on reprend là où on s'était arrêté.
- Un lieu dont le paquet est fini est **vidé**. Il se remplit en partie (moitié des cartes de butin) après chaque Émission.

### 5.2 Types de cartes d'exploration

| Type | Effet |
| --- | --- |
| Butin | Objets tirés de la table de butin du lieu (5.3) |
| Cache | Butin plus riche, mais un test de Survie ou de Discrétion pour l'ouvrir. Un échec déclenche un piège (blessure ou bruit) |
| Anomalie intérieure | Comme un jeton suspect à l'aveugle. Un boulon peut la révéler avant (1 PA) |
| Occupant | Rencontre (humains ou mutants) avec combat ou négociation |
| PNJ | Dialogue (section 7), parfois une quête |
| Indice | Note, enregistrement PDA ou cadavre : avance une quête, révèle une planque ou donne une rumeur |
| Passage | Ouvre une zone intérieure (souterrains, sous-sol) : un paquet de plus, plus dangereux |
| Rien | Pièce vide, avec une phrase d'ambiance |

### 5.3 Tables de butin

Chaque lieu a une table de butin pondérée, avec un **niveau** (1 à 4) qui suit la profondeur dans la Zone :

| Niveau | Tuiles |
| --- | --- |
| 1 | Cordon |
| 2 | Marais, Décharge |
| 3 | Agroprom, Vallée Sombre |
| 4 | Rostok (hors hub), Entrepôts |

### 5.4 Lieux occupés

Un lieu peut être tenu par une faction : militaires, bandits, Devoir… On ne l'explore librement que si on est en bons termes avec cette faction. Sinon, il faut d'abord combattre, se faufiler (Discrétion à chaque carte) ou payer.

## 6. Les hubs, les marchands et l'économie

### 6.1 Services des hubs

| Service | Camp des novices | Base de Ciel Pur | Bar « 100 Rads » | Base de Liberté |
| --- | --- | --- | --- | --- |
| Marchand | ✓ le Marchand du bunker | ✓ | ✓ | ✓ |
| Barman (rumeurs, quêtes) | — | — | ✓ | ✓ |
| Médecin (soins, antirad) | — | ✓ | ✓ | — |
| Technicien (réparer, améliorer) | — | ✓ | — | ✓ |
| Lit | ✓ | ✓ | ✓ | ✓ |
| Coffre (planque) | ✓ | — | ✓ | — |
| Tableau des contrats | ✓ | ✓ | ✓ | ✓ |

Dans un hub, **aucune action ne coûte de PA**, sauf dormir, qui finit la journée. Les hubs sont des zones sûres : pas de jetons, pas d'Émission.

### 6.2 Les marchands

- Chaque marchand a un **stock** (objets et quantités) qui se renouvelle tous les 3 jours, avec une spécialité : le Marchand du bunker achète bien les artefacts, Ciel Pur vend des détecteurs, le Bar vend des armes, Liberté vend des armures légères et des consommables.
- **Prix :** prix de base × coefficient du marchand × modificateur de réputation.

| Réputation auprès de la faction | Achat | Revente |
| --- | --- | --- |
| Hostile | refus | refus |
| Neutre | ×1,0 | ×0,5 |
| Amical | ×0,9 | ×0,6 |
| Allié | ×0,8 | ×0,7 |

- Certains objets ne se débloquent qu'à partir d'un **rang** : un marchand ne vend pas un fusil d'assaut à un Bleu.
- Chaque marchand a quelques **répliques** selon le contexte : première visite, quête en cours, réputation.

### 6.3 Argent

Les roubles servent à tout : achats, lits, péages, rumeurs, soins, réparations. **Repère de rythme :** une journée de contrat simple rapporte 300 à 600 roubles en début de partie.

## 7. PNJ et dialogues

- Un PNJ a un `id`, un nom, une faction, un lieu (fixe ou itinérant) et un arbre de dialogue.
- **Dialogue :** des nœuds avec un texte, des choix et des effets. Les choix peuvent être conditionnés (réputation, objet, rang, étape de quête, stat). Les effets possibles : donner ou prendre un objet, des roubles ou de la réputation, démarrer ou avancer une quête, révéler un lieu ou une planque.
- Il faut environ **25 PNJ nommés** pour la v2 : 4 à 6 par hub, plus des isolés sur les tuiles.
- Les PNJ isolés (losange sur la carte) **se déplacent** parfois d'un jour à l'autre et peuvent mourir pendant une Émission ou une rencontre si on ne les a pas aidés.

## 8. Les quêtes

### 8.1 Trois familles

| Famille | Source | Nombre en v2 |
| --- | --- | --- |
| Quête principale « Le Guide » | Écrite, 5 actes | 1, environ 20 étapes |
| Quêtes secondaires | Écrites, données par des PNJ | 15 à 20 |
| Contrats | Générés à partir de modèles, tableau des hubs | Illimité, 3 visibles par hub |

### 8.2 Format d'une quête (données)

Une quête est une suite d'**étapes**. Chaque étape a un objectif vérifiable par le moteur :

| Objectif | Exemple |
| --- | --- |
| `visiter` | entrer dans le lieu X |
| `explorer` | révéler la carte fixée Y dans le lieu X |
| `parler` | dialogue avec le PNJ Z jusqu'au nœud N |
| `rapporter` | avoir l'objet I dans l'inventaire et parler à Z |
| `eliminer` | vaincre la rencontre nommée R |
| `escorter` | arriver au lieu X avec le PNJ Z vivant |
| `cartographier` | révéler tous les jetons suspects d'une tuile |
| `survivre` | être vivant au jour J ou après l'Émission |

Une quête porte aussi : un délai facultatif (en jours), des récompenses (roubles, XP, réputation, objets) et des **embranchements** (une étape peut mener à deux suites selon un choix de dialogue).

### 8.3 La quête principale « Le Guide » (canevas)

Le texte est à écrire. Ton : sobre, phrases courtes, comme des notes de PDA.

1. **Acte 1 — Le courrier (Cordon).** Le Marchand du bunker envoie le joueur chercher le PDA d'un courrier mort près de l'ATP. Le PDA mentionne « le Guide », un stalker qui connaîtrait un chemin vers le centre. Ensuite, il faut sauver le stalker blessé de l'Élévateur pour obtenir le mot de passe du PDA.
2. **Acte 2 — Les documents (Décharge, Agroprom).** Le PDA renvoie aux souterrains d'Agroprom. Il faut franchir le barrage des bandits de la Décharge (payer, combattre ou contourner), puis descendre dans les souterrains (lieu long avec une zone intérieure) et en remonter les documents. *Arc secondaire facultatif au Marais : Ciel Pur a connu le Guide.*
3. **Acte 3 — La clé (Vallée Sombre).** Les documents parlent d'un laboratoire sous le Complexe (Завод). La clé est à l'Usine (Фабрика), aux mains des bandits. On peut l'obtenir par la force, par la ruse (Discrétion) ou par un accord avec leur chef. Ensuite, le laboratoire : la seule séquence de jeu sans Émission possible, mais très dangereuse.
4. **Acte 4 — Le Bar (Rostok).** Le barman fait déchiffrer les données du laboratoire. Pour obtenir l'information, il faut choisir entre le Devoir et Liberté (quête de faction). Le choix décide de l'allégeance du joueur.
5. **Acte 5 — La route du Nord (Entrepôts militaires).** Selon le camp choisi : défendre ou attaquer la base de Liberté, puis trouver la trace du Guide au bord de la route du Nord. **Fin de la v2 :** une scène de clôture, un bilan de la campagne (jours, roubles, morts évitées, choix faits) et une ouverture vers une v3 (Yantar, Forêt Rouge, Pripyat).

### 8.4 Contrats générés

Ils reprennent les 5 types de la v1 (livraison, récupération, élimination, escorte, cartographie) :

- sur toute la carte du monde, avec une tuile cible tirée selon le rang ;
- récompense = base × distance en tuiles × niveau de la tuile ;
- délai de 2 à 5 jours ;
- un contrat raté fait perdre de la réputation auprès de la faction du hub.

### 8.5 Journal de quêtes

Il se trouve dans le PDA : quêtes actives, étape en cours, lieu cible marqué sur la carte du monde et sur la tuile, quêtes terminées et ratées.

## 9. Factions et réputation

| Faction | Base | Joueur peut rejoindre | Attitude de départ |
| --- | --- | --- | --- |
| Solitaires | Camp des novices | oui (par défaut) | amical |
| Devoir | Bar « 100 Rads » | oui (acte 4) | neutre |
| Liberté | Base des Entrepôts | oui (acte 4) | neutre |
| Ciel Pur | Base du Marais | non | neutre |
| Bandits | Usine de la Vallée Sombre, barrage de la Décharge | non | hostile |
| Militaires | Avant-poste du Cordon, institut d'Agroprom | non | hostile |

- **Réputation de −3 à +3 par faction** : −3 et −2 = hostile, de −1 à +1 = neutre, +2 = amical, +3 = allié.
- Les actions la font bouger : quêtes, contrats, combats contre des membres, dialogues.
- **Rejoindre le Devoir ou Liberté** fait passer l'autre faction à −2 et donne : lit gratuit, prix d'allié et contrats de faction.
- Les rencontres humaines piochées dépendent de la réputation. Une patrouille amicale propose un échange au lieu d'un combat.

## 10. Le monde vivant

### 10.1 L'Émission devient un événement global

- Il y a une Émission **tous les 3 à 5 jours**, avec une part de hasard.
- Elle s'annonce : la carte Météo du matin « signes d'Émission » prévient qu'elle aura lieu ce jour-là, sans dire quand. Le paquet Zone de la journée contient alors la carte Émission dans son dernier tiers (règle v1).
- Quand elle sort : 3 PA pour gagner un abri (règle v1). Sans abri : 5 blessures et le joueur s'évanouit jusqu'au lendemain (bivouac à découvert forcé).
- **Après l'Émission, sur toutes les tuiles :**
  - jetons suspects retirés et reposés ;
  - lieux de nouveau en partie remplis ;
  - un nouvel artefact rare sur une tuile au hasard (rumeur au Bar) ;
  - certains PNJ isolés ont pu mourir.

### 10.2 État des tuiles

- Chaque tuile garde son état : jetons, rencontres, lieux, planques.
- Quand on entre sur une tuile quittée depuis au moins 1 jour, ses jetons de rencontre sont retirés et reposés.
- **Patrouilles :** un jeton de rencontre peut passer d'une tuile voisine à l'autre (carte Zone « patrouille » étendue au monde).

### 10.3 Planques et rumeurs

- Un humain vaincu laisse parfois un **PDA** qui révèle une planque : un jeton posé sur un hexagone d'une tuile, avec un butin de niveau +1.
- Le barman vend des **rumeurs** (100 à 300 roubles). Une rumeur révèle une planque, la position d'un artefact rare, un raccourci sans anomalie ou l'emplacement d'une patrouille.
- Les rumeurs **vieillissent** : elles sont fausses après la prochaine Émission.

## 11. Le personnage

### 11.1 Stats et rangs

- Les stats sont celles de la v1 : Tir, Survie, Discrétion, Endurance (Endurance donne +1 PA par point). Elles valent 1 au départ (Endurance 0), avec un maximum de 4.
- L'**XP** vient des quêtes, des contrats, des découvertes (premier passage dans un lieu) et des combats.

| Rang | XP |
| --- | --- |
| Bleu | 0 |
| Expérimenté | 150 |
| Vétéran | 400 |
| Expert | 800 |
| Maître | 1400 |

- À chaque rang : **+1 point de stat** et **1 savoir-faire** au choix.

### 11.2 Savoir-faire (une douzaine)

| Savoir-faire | Effet |
| --- | --- |
| Pied léger | La forêt coûte 1 PA |
| Bouliste | Un boulon révèle 2 hexagones en ligne |
| Œil de lynx | Détecteur +1 de portée |
| Coriace | Seuil de mort à 7 blessures |
| Peau dure | −1 radiation à chaque gain |
| Fouilleur | Explorer une carte de lieu coûte 0 PA une fois par lieu |
| Marchandeur | Un cran de réputation de plus pour les prix |
| Tireur | +1 Tir au fusil |
| Fantôme | +1 Discrétion la nuit et sous la pluie |
| Infirmier | Les bandages soignent 2 blessures |
| Mule | +3 cases d'inventaire |
| Instinct | Annonce l'Émission dès le matin même sans carte de signes |

### 11.3 Équipement

- **Emplacements :** arme principale, arme de poing, armure, détecteur, ceinture d'artefacts (1 à 3 emplacements selon l'armure), sac.
- **Inventaire :** grille de 12 cases, ou 15 avec Mule ou un sac.
- **Poids :** au-delà de la grille, on ne peut plus porter. Pas de surcharge.

## 12. Les objets

À détailler dans `src/content/objets.js`. Ordres de grandeur :

| Catégorie | Exemples | Effet principal | Prix indicatif |
| --- | --- | --- | --- |
| Arme de poing | Pistolet, pistolet lourd | +1 / +2 au combat | 300 / 800 |
| Arme d'épaule | Fusil à pompe, fusil d'assaut, fusil de précision | +2 à +4, dégâts 2, munitions dédiées | 1200 à 5000 |
| Munitions | 9 mm, calibre 12, 5,45 | Une boîte = 6 tirs | 50 à 150 |
| Armure | Veste de cuir, combinaison de stalker, combinaison du Devoir ou de Liberté, exosquelette (rare) | Absorbe 1 à 3 blessures par combat, protection contre les anomalies et les radiations | 500 à 15000 |
| Détecteur | Écho, Ours, Vélès | Portée 1 / 2 / 3, le dernier révèle aussi le type d'anomalie | 300 / 1500 / 5000 |
| Soin | Bandage, trousse de soins, trousse militaire | −1 / −2 / −3 blessures | 50 / 200 / 600 |
| Antiradiations | Vodka, antirad | −2 / −4 radiations | 60 / 250 |
| Nourriture | Ration, conserve, saucisson | Repas du jour | 30 à 80 |
| Divers | Boulons (10), grenade, boisson énergétique (+2 PA, 1 fois par jour) | — | 10 / 200 / 150 |
| Artefacts | Méduse, Gouttelette, Œil de chat, Bouillie… une quinzaine | Bonus en ceinture (stat, absorption, PA) contre un coût en radiation | 400 à 6000 à la revente |
| Objets de quête | PDA, documents, clé | Pas de vente | — |

## 13. Le combat v2

Le combat reste abstrait (pas de grille), mais il se joue **en rounds**.

- Un ennemi a une **Menace** (difficulté à le toucher), des **PV** (1 à 4) et des **dégâts** (blessures par attaque réussie). Une rencontre peut grouper plusieurs ennemis.
- **À chaque round, le joueur choisit :**

| Action | Effet |
| --- | --- |
| Tirer | 1d6 + Tir + arme + couverture ≥ Menace : l'ennemi perd les dégâts de l'arme en PV. Consomme 1 munition |
| Se mettre à couvert | +2 à sa défense ce round et le suivant, pas de tir |
| Grenade | Touche tous les ennemis du groupe (1 PV), se consomme |
| Soigner | Utiliser un consommable de soin |
| Fuir | 2 PA et un test de Discrétion. En cas d'échec, l'ennemi a une attaque gratuite |
| Parlementer | Humains seulement, selon la réputation : péage, échange ou fin du combat |

- **Ensuite, chaque ennemi attaque :** 1d6 + Menace contre la défense du joueur (4 + couverture + bonus d'armure). S'il touche, il inflige ses dégâts, moins l'absorption de l'armure.
- Un combat ne coûte pas de PA, sauf pour fuir. **Les mutants ne parlementent pas et ne laissent pas de butin**, mais certains donnent des trophées revendables (queue de chien aveugle, sabot…).
- La v1 reste disponible comme **mode de résolution rapide** pour le banc.

## 14. Survie (récapitulatif)

| Piste | Échelle | Seuils |
| --- | --- | --- |
| Blessures | 0 à 6 (7 avec Coriace) | À 4 : −1 PA par jour (v1). Au maximum : mort |
| Radiations | 0 à 6 | À 4 : −1 à tous les tests. À 6 : 1 blessure et retour à 3 (v1) |
| Faim | Repas manqués consécutifs | 1 : −2 PA. 2 : 1 blessure en plus |

## 15. Mort et sauvegarde

- **Mort (mode normal) :** le joueur se réveille au dernier hub où il a dormi. Il perd tout l'inventaire porté, sauf les objets de quête (ils sont rendus par un PNJ). Les roubles et le coffre sont conservés, ainsi que 10 % de l'XP du rang en cours.
- **Mode Hardcore** (option au lancement) : la mort efface la sauvegarde.
- **Sauvegarde :**
  - automatique à chaque réveil, dans le `localStorage` ;
  - 3 emplacements manuels, dans un hub seulement ;
  - export et import en fichier JSON.
- L'état porte un **numéro de version**, et un module de migration permet de recharger une sauvegarde après une mise à jour.

## 16. L'interface

| Écran | Contenu |
| --- | --- |
| Titre | Nouvelle partie (normal ou hardcore, graine), Continuer, Charger, Importer |
| Tuile | La vue v1, étendue : liaisons marquées, lieux cliquables, marqueurs de quête, planques connues |
| Lieu | Illustration (la portion de l'image de la tuile autour du lieu, agrandie), paquet d'exploration, cartes révélées en pile, bouton Explorer (1 PA), Quitter |
| Hub | Onglets Marchand / Barman / Médecin / Technicien / Coffre / Contrats / Dormir |
| Marchand | Deux grilles côte à côte (inventaire / stock), prix affichés, glisser pour vendre ou acheter |
| Dialogue | Portrait (pictogramme de faction), texte, choix numérotés, choix grisés avec leur condition |
| Combat | Fenêtre : ennemis avec PV et Menace, actions du round, jets affichés |
| PDA | Onglets Quêtes / Carte du monde / Journal / Rumeurs / Factions / Fiche (stats, rang, savoir-faire) |
| Inventaire | Grille, emplacements d'équipement, ceinture d'artefacts |
| Réveil et nuit | Carte Nuit, carte Météo, repas, résumé de la veille |
| Fin de campagne | Bilan et ouverture |

- Le **bandeau du haut** est toujours visible : jour, PA restants (le plus gros élément), blessures, radiations, faim, roubles, signe d'Émission si annoncée.
- Le **journal PDA** reste en bas, comme en v1.
- **Ambiance** : la palette et la typographie de terminal de la v1. Les illustrations sont les images de tuiles elles-mêmes, recadrées.

## 17. Architecture

### 17.1 Moteur

- L'état actuel d'une partie v1 devient **l'état d'une journée sur une tuile**. Il s'insère dans un état de **campagne** :

```
campaign = {
  version, seed, rng, day, mode,
  player: { stats, rank, xp, perks, wounds, radiation, hunger, roubles, faction },
  inventory, equipment,
  world: { tiles: { [id]: tileState }, currentTile, hex, weather, emission: { nextDay, today } },
  places: { [id]: placeState },
  npcs: { [id]: npcState },
  quests: { [id]: questState }, contracts: { [hubId]: [...] },
  traders: { [id]: { stock, restockDay } },
  reputation: { [factionId]: -3..3 },
  rumors, stashes, journal,
  screen // l'écran courant côté moteur : 'tile' | 'place' | 'hub' | 'dialogue' | 'combat' | 'night'
}
```

- `step(campaign, action)` reste pur et garde le même contrat. Les actions v1 continuent de fonctionner sur la tuile courante.
- Les règles v1 (`suspects`, `encounters`, `zone`, `sheet`) sont **paramétrées par la tuile** au lieu d'être écrites pour Agroprom.
- Nouveaux modules dans `src/engine/rules/` : `world`, `time`, `places`, `hubs`, `trade`, `quests`, `dialogue`, `factions`, `progression`, `combat`, `emission`, `stashes`, `save`.

### 17.2 Contenu en données

- `src/content/` contient : `tuiles/<id>.js`, `lieux.js`, `objets.js`, `butin.js`, `pnj.js`, `dialogues/<pnj>.js`, `quetes/<id>.js`, `contrats.js`, `factions.js`, `paquets/` (Zone, Nuit, Météo, rencontres par tuile, exploration par lieu), `savoir-faire.js`.
- Le contenu est écrit en JavaScript (objets gelés), pas en JSON : on garde les commentaires et l'import direct.
- Un **test de cohérence du contenu** vérifie :
  - que chaque référence existe (lieu, objet, PNJ, quête, nœud de dialogue, faction) ;
  - que chaque quête est terminable (son graphe d'étapes atteint une fin) ;
  - que chaque dialogue n'a pas de nœud orphelin ;
  - que chaque lieu est sur un hexagone de sa tuile ;
  - que chaque liaison relie deux hexagones de bord.

### 17.3 Tests et banc

- Les règles sont toujours écrites test d'abord, comme en v1.
- Le **banc de campagne** fait jouer une IA scriptée (« prudente » et « gourmande ») sur 30 jours. Il mesure :
  - jours pour finir chaque acte et taux de mort par semaine ;
  - courbe des roubles ;
  - remplissage moyen de l'inventaire au retour ;
  - nombre de lieux vidés, Émissions subies, quêtes ratées.
- **Cibles d'équilibrage de départ :**
  - acte 1 fini en 4 à 7 jours ;
  - moins de 1 mort tous les 10 jours pour l'IA prudente ;
  - premier achat d'arme d'épaule vers le jour 8 à 12.

## 18. Hors périmètre v2

Yantar, Forêt Rouge, Pripyat et le centre. Compagnons. Multijoueur. Son (sauf si une carte « ambiance sonore » est ajoutée plus tard). Version mobile dédiée (l'interface doit rester utilisable à 1280 px de large au minimum).

## 19. Questions ouvertes pour Mathieu

1. **Légende des images :** l'interprétation de la section 3.3 est-elle bonne, en particulier les petits pictogrammes doublés (forêt ?) et le losange avec silhouette ?
2. **Entrepôts militaires :** l'étiquette « Бар 100 рентген » est-elle une erreur ? Le brief place le Bar à Rostok et la base de Liberté aux Entrepôts.
3. **Liaisons :** le graphe de la section 3.2 suit la géographie du jeu vidéo, avec en plus le Marais relié à Agroprom. À garder ?
4. **Mort :** le mode normal fait-il réapparaître au hub, comme proposé, ou la mort doit-elle toujours être définitive ?

---

## Cartes pour l'orchestrateur

Les dépendances sont entre crochets. Chaque carte qui touche une règle commence par ses tests. Les cartes de contenu passent le test de cohérence.

### Phase A — Socle de campagne

1. **Campagne** — Introduire l'état de campagne (17.1) autour de l'état v1 : jour, tuile courante, version. Garder tous les tests v1 verts. [—]
2. **Règles par tuile** — Sortir le code propre à Agroprom des règles `suspects`, `encounters` et `zone` : elles prennent la tuile courante en paramètre. [1]
3. **Sauvegarde** — Sérialisation, version, migrations, `localStorage` (autosave et 3 emplacements), export et import JSON. [1]
4. **Test de cohérence du contenu** — Le test 17.2, sur un contenu vide d'abord. Il grandit avec chaque carte de contenu. [1]

### Phase B — Le monde

5. **Données des tuiles** — Les 7 tuiles dans `src/content/tuiles/` : calage, terrain des 19 hexagones, lieux, symboles de la légende, liaisons. Lire chaque image pour caler le terrain. [2, 4]
6. **Voyage entre tuiles** — Action de sortie par une liaison (1 PA), arrivée sur la tuile voisine, état de tuile conservé, rencontres reposées après 1 jour d'absence. [2, 5]
7. **Temps** — Fin de journée (lit, bivouac, 0 PA), cartes Nuit, carte Météo du matin, faim, compteur de jours. Remplace la défaite par la nuit de la v1. [1, 6]
8. **Émission globale** — Calendrier tous les 3 à 5 jours, carte « signes », Émission dans le paquet du jour, effets sur toutes les tuiles. [7]

### Phase C — Lieux et économie

9. **Objets** — Catalogue complet (section 12), emplacements d'équipement, ceinture d'artefacts, grille extensible, effets d'équipement sur les règles. [1]
10. **Lieux et exploration** — Vue Lieu côté moteur, paquets d'exploration, cartes fixées, progression gardée, lieux vidés et remplis, lieux occupés. [5, 9]
11. **Tables de butin et paquets d'exploration** — Contenu des ~50 lieux, par niveau. [10]
12. **Hubs** — Écran Hub côté moteur, services, actions sans PA, lit, coffre. [7, 9]
13. **Marchands** — Stocks, renouvellement, prix et réputation, rangs requis, répliques. [12, 16]

### Phase D — Personnages et histoire

14. **Dialogues** — Moteur de nœuds, conditions et effets. [1]
15. **Quêtes** — Format 8.2, objectifs vérifiés par le moteur, délais, embranchements, journal. [10, 14]
16. **Factions** — Pistes de réputation, seuils, effets sur les rencontres, les lieux occupés et les prix, adhésion. [14]
17. **Progression** — XP, rangs, points de stat, savoir-faire (11.2) branchés dans les règles. [9]
18. **Combat v2** — Rounds, PV, armures, actions de la section 13, parlementer, trophées. Résolution v1 gardée pour le banc. [9, 16]
19. **PNJ** — Les ~25 PNJ, leurs lieux, leurs dialogues de base, les PNJ itinérants. [14, 5]
20. **Quête principale** — Les 5 actes : étapes, cartes fixées, dialogues, textes. [15, 19, 11]
21. **Quêtes secondaires** — 15 à 20 quêtes écrites, réparties sur les 7 tuiles. [15, 19, 11]
22. **Contrats générés** — Modèles, calcul des récompenses, délais, tableau des hubs. [15, 12]
23. **Planques et rumeurs** — PDA sur les humains vaincus, jetons de planque, rumeurs du barman qui vieillissent. [8, 12, 18]

### Phase E — Interface

24. **Carte du monde et tuile v2** — Vue réduite des 7 tuiles, liaisons, marqueurs de quête, bandeau du haut. [6, 7]
25. **Écran Lieu** — Illustration recadrée, pile de cartes révélées, Explorer et Quitter. [10, 24]
26. **Écran Hub et Marchand** — Onglets, grilles côte à côte, achat et vente. [13, 24]
27. **Dialogue et Combat** — Fenêtre de dialogue, fenêtre de combat en rounds avec jets affichés. [14, 18, 24]
28. **PDA et Inventaire** — Onglets du PDA, inventaire avec équipement et ceinture. [15, 16, 17, 24]
29. **Titre, Réveil, Mort, Fin** — Écrans de la section 16, sauvegardes, mode hardcore. [3, 7, 20, 24]

### Phase F — Équilibrage et finition

30. **Banc de campagne** — IA prudente et gourmande, 30 jours, rapport 17.3. [20, 22, 18, 8]
31. **Équilibrage** — Ajuster prix, butin, Menaces et rythme de l'Émission jusqu'aux cibles 17.3. Consigner chaque réglage et son effet dans `docs/equilibrage.md`. [30]
32. **Retours visuels et ambiance** — Transitions entre tuiles, révélation des cartes de lieu, réveil, annonce globale de l'Émission, montée de rang. [25, 26, 27, 28, 29]
