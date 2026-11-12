// Gel profond du contenu (brief v2 §17.2) : chaque fichier de src/content/ exporte
// deepFreeze({ ... }) pour qu'aucune règle ne modifie les données par erreur.

export function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  // Pas d'arrêt sur un objet déjà gelé : Object.freeze est superficiel, ses enfants
  // peuvent ne pas l'être (les hexagones de src/engine/data/agroprom.js).
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
