/**
 * Layer-command shared helpers (ADR-358 §5.6.bis — Phase 10).
 *
 * Centralises the snapshot-capture and snapshot-restore logic shared across
 * the 9 layer commands. Commands stay thin — orchestrate via these utilities
 * + IsolateEffectsStore + LayerStore mutations.
 *
 * Pre-commit ratchet `layer-isolate-system` allowlists `core/commands/layer/**`
 * for direct `unisolateSnapshot` reads/writes — all other call sites are
 * forbidden.
 */

import {
  getAllLayers,
  getLayer,
  setUnisolateSnapshot,
  clearUnisolateSnapshot,
  getUnisolateSnapshot
} from '../../../stores/LayerStore';
// ADR-719 §7 — μόνιμες αλλαγές flag = μία πόρτα (έγγραφο + runtime προβολή).
import { setLayerFlags, setLayerFlagsBatch } from '../../../services/layer-flags-writer';
import type {
  UnisolateSnapshot,
  UnisolateSnapshotEntry
} from '../../../stores/LayerStore';

export type { UnisolateSnapshot, UnisolateSnapshotEntry };

let layerCommandCounter = 0;
const COMMAND_TIME_BASE = Date.now();

/** Stable key for CommandHistory — `lyr-cmd-<n>` (in-memory only, not a Firestore ID). */
export function makeLayerCommandKey(prefix: string): string {
  layerCommandCounter += 1;
  return `${prefix}-${COMMAND_TIME_BASE}-${layerCommandCounter}`;
}

/** Snapshot ALL current layers into the unisolate-restore shape. */
export function captureAllLayersSnapshot(): ReadonlyArray<UnisolateSnapshotEntry> {
  return getAllLayers().map((layer) => ({
    layerId: layer.id ?? layer.name,
    visible: layer.visible,
    frozen: layer.frozen ?? false,
    locked: layer.locked,
    transparency: layer.transparency ?? 0
  }));
}

/** Snapshot a single layer (Off/Freeze/Lock pre-state). Returns null if missing. */
export function captureLayerSnapshot(layerId: string): UnisolateSnapshotEntry | null {
  const layer = getLayer(layerId);
  if (!layer) return null;
  return {
    layerId: layer.id ?? layer.name,
    visible: layer.visible,
    frozen: layer.frozen ?? false,
    locked: layer.locked,
    transparency: layer.transparency ?? 0
  };
}

/**
 * Restore a single layer to its snapshot state. No-op if layer no longer exists.
 *
 * ADR-719 §7 — γράφει στο **έγγραφο** (μαζί με τη runtime προβολή). Το undo ΠΡΕΠΕΙ να
 * φτάνει όσο μακριά έφτασε το execute: αν η εντολή περσιστάρει και το undo όχι, το
 * «ακύρωση» θα φαινόταν στην οθόνη αλλά το αρχείο θα κρατούσε την αλλαγή — σιωπηλή
 * απόκλιση χειρότερη από το αρχικό bug.
 */
export function restoreLayerEntry(entry: UnisolateSnapshotEntry): void {
  setLayerFlags(entry.layerId, {
    visible: entry.visible,
    frozen: entry.frozen,
    locked: entry.locked,
    transparency: entry.transparency,
  });
}

/**
 * Restore every entry of a snapshot. Safe on partial deletion.
 *
 * Μία εγγραφή εγγράφου για ΟΛΟ το snapshot (`setLayerFlagsBatch` ανά ομάδα ίδιων τιμών δεν
 * εφαρμόζεται εδώ — κάθε entry έχει δικές του τιμές), οπότε ο βρόχος είναι αναπόφευκτος.
 * Δεν είναι hot path: τρέχει μόνο σε undo/unisolate.
 */
export function restoreLayersSnapshot(snapshot: ReadonlyArray<UnisolateSnapshotEntry>): void {
  for (const entry of snapshot) {
    restoreLayerEntry(entry);
  }
}

/** Save an isolate snapshot to LayerStore (single-level, overwrites previous). */
export function persistUnisolateSnapshot(snapshot: ReadonlyArray<UnisolateSnapshotEntry>): void {
  setUnisolateSnapshot(snapshot);
}

/** Current isolate snapshot. Null when no isolate session is active. */
export function readUnisolateSnapshot(): UnisolateSnapshot {
  return getUnisolateSnapshot();
}

/** Drop the in-store isolate snapshot. */
export function dropUnisolateSnapshot(): void {
  clearUnisolateSnapshot();
}

// ADR-719 §8 — Η `freezeNonIsolatedLayers` ΑΦΑΙΡΕΘΗΚΕ.
//
// Έγραφε `frozen: true` σε κάθε μη-απομονωμένο layer «για να ενεργοποιήσει το AutoCAD render
// skip-path» — δηλαδή έβαζε **κατάσταση συνεδρίας** σε **μόνιμο πεδίο του εγγράφου**. Το
// layer-scope της απομόνωσης ελέγχεται πλέον απευθείας στον renderer
// (`dxf-entity-layer-skip.ts`, από το `IsolateEffectsStore`), όπως ήδη γινόταν για τα
// entity-scope και category-scope. Η απομόνωση δεν αφήνει πια αποτύπωμα στο αρχείο.
//
// ΜΗΝ την επαναφέρεις για «να φαίνεται πιο γρήγορα»: ο έλεγχος στον renderer είναι ένα
// `Set.has` ανά οντότητα, ίδιας τάξης με τους δύο διπλανούς του.

/**
 * Mutate one flag on every layer that doesn't already match. Used by ThawAll / OnAll.
 *
 * ADR-719 §7 — μία **ατομική** εγγραφή εγγράφου για όλα τα layers (`setLayerFlagsBatch`):
 * το «άναψε όλα τα επίπεδα» είναι μία ενέργεια χρήστη, άρα ένα βήμα undo και ένα auto-save,
 * όχι 58. Το snapshot επιστρέφεται όπως πριν, ώστε το undo να ξέρει τι να επαναφέρει.
 *
 * Ο `?? false` στο `frozen` κρατά τη σημασιολογία του §1 (undefined ⇒ μη παγωμένο)· το
 * `visible` περνά ωμό γιατί το snapshot καταγράφει την **ακριβή** προηγούμενη τιμή, ώστε
 * ένα undo να μη «γεννήσει» explicit `true` εκεί που υπήρχε `undefined`.
 */
export function mutateAllLayersFlag(
  flag: 'frozen' | 'visible',
  targetValue: boolean
): ReadonlyArray<UnisolateSnapshotEntry> {
  const captured: UnisolateSnapshotEntry[] = [];
  const toChange: string[] = [];

  for (const layer of getAllLayers()) {
    const current = flag === 'frozen' ? (layer.frozen ?? false) : layer.visible;
    if (current === targetValue) continue;
    const layerId = layer.id ?? layer.name;
    captured.push({
      layerId,
      visible: layer.visible,
      frozen: layer.frozen ?? false,
      locked: layer.locked,
      transparency: layer.transparency ?? 0
    });
    toChange.push(layerId);
  }

  if (toChange.length > 0) setLayerFlagsBatch(toChange, { [flag]: targetValue });
  return captured;
}
