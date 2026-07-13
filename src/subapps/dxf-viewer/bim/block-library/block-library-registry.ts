/**
 * Block Library — in-session registry (Milestone 1).
 *
 * SSoT store για τους {@link InSessionBlockDef} που «κρατάμε» από το τρέχον DXF import,
 * ώστε ο χρήστης να τους ΞΑΝΑΤΟΠΟΘΕΤΕΙ (palette «Τα Blocks μου» + placement tool).
 * Καθαρά 2D/React-free — μοτίβο ίδιο με `user-material-image-store` (map + `createExternalStore`
 * version signal). Το Milestone 2 θα προσθέσει cloud persistence· εδώ ΜΟΝΟ in-memory.
 *
 * Κλειδί = block name (μοναδικό ανά DXF). Δεύτερο import με ίδιο όνομα → override (τελευταίο κερδίζει).
 *
 * @see ./capture-blocks-from-scene.ts — τροφοδότης (import scene → defs)
 * @see ../../rendering/entities/shared/user-material-image-store.ts — ίδιο store pattern
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { InSessionBlockDef } from './block-library-types';

/** blockName → ορισμός. Ο map είναι ο mutation accelerator· το signal είναι το version. */
const defs = new Map<string, InSessionBlockDef>();
const versionSignal = createExternalStore<number>(0);

function emit(): void {
  versionSignal.set(versionSignal.get() + 1);
}

/** Αντικαθιστά ΟΛΟ το registry από ένα snapshot (π.χ. μετά από import). */
export function setSessionBlockDefs(list: readonly InSessionBlockDef[]): void {
  defs.clear();
  for (const def of list) defs.set(def.name, def);
  emit();
}

/** Προσθέτει/ενημερώνει έναν ορισμό (τελευταίο κερδίζει). */
export function upsertSessionBlockDef(def: InSessionBlockDef): void {
  defs.set(def.name, def);
  emit();
}

/** Ορισμός με το δοσμένο όνομα, ή `null` αν άγνωστο. */
export function getSessionBlockDef(name: string): InSessionBlockDef | null {
  return defs.get(name) ?? null;
}

/** Όλοι οι ορισμοί (σταθερή σειρά εισαγωγής). */
export function listSessionBlockDefs(): readonly InSessionBlockDef[] {
  return [...defs.values()];
}

/** Μονότονο version — bump σε κάθε αλλαγή (subscribe gate). */
export function getSessionBlockDefsVersion(): number {
  return versionSignal.get();
}

/** Subscribe σε αλλαγές· επιστρέφει unsubscribe. */
export function subscribeSessionBlockDefs(listener: () => void): () => void {
  return versionSignal.subscribe(listener);
}

/** Καθαρίζει το registry (π.χ. νέο/άδειο σχέδιο). */
export function clearSessionBlockDefs(): void {
  if (defs.size === 0) return;
  defs.clear();
  emit();
}

/** Test-only reset. */
export function __resetSessionBlockLibraryForTests(): void {
  defs.clear();
  versionSignal.reset(0);
}
