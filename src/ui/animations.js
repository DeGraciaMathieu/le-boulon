// Réglage « Animations : normales / réduites » (direction 1, lot L0). Mémorisé en localStorage,
// chaque accès sous try/catch comme storage.js ; la préférence système prefers-reduced-motion
// l'emporte toujours. Les animations réduites posent la classe animations-reduites sur <html> :
// la feuille de thème coupe alors toutes les animations, et le séquenceur peut la lire.

export const MOTION_KEY = 'le-boulon.animations';
export const MOTION_MODES = Object.freeze(['normales', 'reduites']);
export const REDUCED_CLASS = 'animations-reduites';

// Mode mémorisé ; 'normales' si rien n'est mémorisé, si la valeur est inconnue ou si le
// stockage est bloqué. storage : localStorage par défaut, lu sous try/catch (le simple accès
// lève une exception sur un navigateur qui bloque le stockage).
export function readMotion(storage) {
  try {
    const saved = (storage ?? globalThis.localStorage).getItem(MOTION_KEY);
    return MOTION_MODES.includes(saved) ? saved : 'normales';
  } catch {
    return 'normales';
  }
}

export function saveMotion(storage, mode) {
  if (!MOTION_MODES.includes(mode)) return false;
  try {
    (storage ?? globalThis.localStorage).setItem(MOTION_KEY, mode);
    return true;
  } catch {
    return false;
  }
}

export function motionReduced(mode, systemPrefersReduced) {
  return systemPrefersReduced || mode === 'reduites';
}

// Pose ou retire la classe sur <html> d'après le mode mémorisé et la préférence système.
export function applyMotion(root = globalThis.document.documentElement, storage) {
  const system = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  root.classList.toggle(REDUCED_CLASS, motionReduced(readMotion(storage), system));
}
