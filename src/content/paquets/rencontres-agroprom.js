// Paquet de rencontres de l'Agroprom, repris tel quel de la v1 (hypothèse v1) :
// Menace 3 à 7, blessures en cas de défaite 1 à 3.
// Format d'un paquet de rencontres de tuile : { [id]: { name, threat, wounds } }.

const card = (name, threat, wounds) => Object.freeze({ name, threat, wounds });

export default Object.freeze({
  pillard: card('Pillard', 3, 1),
  chiens: card('Chiens aveugles', 4, 1),
  bandits: card('Bandits', 5, 2),
  sanglier: card('Sanglier muté', 5, 2),
  militaires: card('Militaires', 6, 2),
  mercenaires: card('Mercenaires', 7, 3),
});
