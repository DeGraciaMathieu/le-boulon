// Sauvegardes côté navigateur (brief v2 §15). Seul fichier qui touche localStorage
// (hors réglage des animations, animations.js) ; chaque
// accès est sous try/catch (navigation privée, quota, stockage bloqué) et aucune exception ne
// sort : les fonctions rendent { ok, error? } ou { campaign?, error? }.
//
// API : createSaveStore({ storage, now, document, URL }) -> store ; tout est injectable pour
// les tests, par défaut les objets du navigateur. saves = createSaveStore() pour l'interface.
//   store.autosave(campaign, places?)   emplacement 'auto' ; à appeler au réveil (cartes 7, 29)
//   store.saveSlot(n, campaign, places?)  emplacement manuel n de MANUAL_SLOTS, dans un hub
//                                   seulement (canManualSave, src/engine/rules/save.js)
//   store.load(slot) -> { campaign, places }   slot : 'auto' | 1 | 2 | 3
//   store.list()                    [{ slot, day, savedAt, mode, seed }] des emplacements
//                                   occupés, 'auto' en tête ; { slot, error } si illisible
//   store.eraseCampaign(campaign)   hardcore : efface l'autosave et les emplacements de cette
//                                   campagne (à appeler à la mort, carte 29)
//   store.exportFile(campaign)      téléchargement le-boulon-jour-<day>.json
//   store.importFile(file) -> Promise<{ campaign?, error? }>   file : File ou Blob
//
// FORMAT : chaque clé garde { savedAt, day, mode, seed, save, places? } où save est le texte de
// serialize() et places les résultats des cartes de lieu (placeOutcomes de place-view.js, que le
// moteur ne garde pas) ; le fichier exporté est le texte de serialize() seul.

import { serialize, deserialize, canManualSave } from '../engine/rules/save.js';

export const MANUAL_SLOTS = Object.freeze([1, 2, 3]);
const SLOTS = Object.freeze(['auto', ...MANUAL_SLOTS]);
const KEY_PREFIX = 'le-boulon.save.';

export function createSaveStore({
  storage,
  now = () => new Date(),
  document = globalThis.document,
  URL = globalThis.URL,
} = {}) {
  // Lu à chaque accès : sur un navigateur qui bloque le stockage, le simple accès à
  // globalThis.localStorage lève une exception.
  const backend = () => storage ?? globalThis.localStorage;

  function write(slot, campaign, places) {
    try {
      const entry = { savedAt: now().toISOString(), day: campaign.day, mode: campaign.mode, seed: campaign.seed };
      backend().setItem(KEY_PREFIX + slot, JSON.stringify({ ...entry, save: serialize(campaign), places }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: `sauvegarde impossible : ${error.message}` };
    }
  }

  function readEntry(slot) {
    const raw = backend().getItem(KEY_PREFIX + slot);
    return raw === null ? null : JSON.parse(raw);
  }

  function autosave(campaign, places) {
    return write('auto', campaign, places);
  }

  function saveSlot(slot, campaign, places) {
    if (!MANUAL_SLOTS.includes(slot)) return { ok: false, error: `emplacement inconnu : ${slot}` };
    if (!canManualSave(campaign)) return { ok: false, error: 'sauvegarde manuelle dans un hub seulement' };
    return write(slot, campaign, places);
  }

  function load(slot) {
    try {
      const entry = readEntry(slot);
      if (!entry) return { error: `emplacement ${slot} vide` };
      return { campaign: deserialize(entry.save), places: entry.places ?? null };
    } catch (error) {
      return { error: error.message };
    }
  }

  function list() {
    const entries = [];
    for (const slot of SLOTS) {
      try {
        const entry = readEntry(slot);
        if (entry) entries.push({ slot, day: entry.day, savedAt: entry.savedAt, mode: entry.mode, seed: entry.seed });
      } catch (error) {
        if (error instanceof SyntaxError) entries.push({ slot, error: 'sauvegarde illisible' });
      }
    }
    return entries;
  }

  // Hypothèse v2 : la campagne n'a pas d'identifiant, sa graine en tient lieu.
  function eraseCampaign(campaign) {
    try {
      for (const slot of SLOTS) {
        let entry = null;
        try {
          entry = readEntry(slot);
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
        }
        if (entry && entry.seed === campaign.seed) backend().removeItem(KEY_PREFIX + slot);
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: `effacement impossible : ${error.message}` };
    }
  }

  function exportFile(campaign) {
    try {
      const blob = new Blob([serialize(campaign)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `le-boulon-jour-${campaign.day}.json`;
      link.click();
      URL.revokeObjectURL(url);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: `export impossible : ${error.message}` };
    }
  }

  async function importFile(file) {
    try {
      return { campaign: deserialize(await file.text()) };
    } catch (error) {
      return { error: error.message };
    }
  }

  return { autosave, saveSlot, load, list, eraseCampaign, exportFile, importFile };
}

export const saves = createSaveStore();
