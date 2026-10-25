"use client";

/**
 * ToolAvailabilityStore — ποια εργαλεία / ribbon actions ΔΕΝ μπορούν να τρέξουν τώρα, και γιατί
 * (ADR-921, ADR-444 §7.6).
 *
 * Revit/ArchiCAD «command availability»: ένα εργαλείο που δεν έχει νόημα στην τρέχουσα
 * κατάσταση δεν ξεκινά καν — δεν αφήνεται ο χρήστης να δουλέψει και να απορριφθεί στο τέλος.
 * Το ίδιο ισχύει για τις ribbon actions (Revit Finish/Cancel, Office Accept/Reject): π.χ.
 * «Αποδοχή» χωρίς πρόταση σε αναμονή είναι γκρι.
 *
 * ## Ρόλοι
 *
 *  - **Κάτοχος** (π.χ. `OverlayStoreProvider` για το `'layering'`, η πύλη προτάσεων Η/Μ για
 *    τα `*.actions.accept|reject`): δηλώνει με `setToolUnavailability(key, …)` / `null` — ο
 *    ΜΟΝΟΣ που ξέρει τους κανόνες του.
 *  - **Πύλη** (`guardToolActivation`): ρωτιέται από το `handleToolChange`, από το
 *    `toolStateStore.selectTool` (γραμμή εντολών) ΚΑΙ από το μεγάλο ribbon κουμπί για actions —
 *    κάθε διαδρομή ενεργοποίησης περνά από εδώ. Αν μπλοκάρει, εκπέμπει `tool:activation-blocked`
 *    → ΕΝΑ κεντρικό toast.
 *  - **Κουμπιά**: `useToolUnavailability(key)` — per-key συνδρομή (ADR-040 micro-leaf),
 *    re-render μόνο όταν αλλάζει η δική τους διαθεσιμότητα.
 *
 * Απουσία εγγραφής = διαθέσιμο ⇒ μηδέν αλλαγή για κάθε κλειδί που δεν έχει κάτοχο.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-921-overlay-drawing-readiness.md
 * @see docs/centralized-systems/reference/adrs/ADR-444-architecture-systems-permanent-ribbon-tabs.md §7.6
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { ToolType } from '../ui/toolbar/types';
import { createExternalStore } from './createExternalStore';
import { EventBus } from '../systems/events/EventBus';

/** Ribbon action key — σύμβαση `<namespace>.actions.<verb>` (π.χ. `waterSupply.actions.accept`). */
export type RibbonActionKey = `${string}.actions.${string}`;

/** Ό,τι μπορεί να κλειδωθεί: ένα εργαλείο σχεδίασης ή μια ribbon action. */
export type AvailabilityKey = ToolType | RibbonActionKey;

/** Type guard: το string ακολουθεί τη σύμβαση ribbon action key. */
export function isRibbonActionKey(key: string): key is RibbonActionKey {
  return /^.+\.actions\..+$/.test(key);
}

export interface ToolUnavailability {
  /** i18n κλειδί (`dxf-viewer-shell`) — tooltip του κουμπιού + κείμενο του toast. */
  readonly reasonKey: string;
  /** Προαιρετική διόρθωση: ribbon action που λύνει την αιτία (π.χ. άνοιγμα εισαγωγής). */
  readonly remedyAction?: string;
}

type AvailabilityMap = ReadonlyMap<AvailabilityKey, ToolUnavailability>;

const store = createExternalStore<AvailabilityMap>(new Map());

function sameUnavailability(a: ToolUnavailability | undefined, b: ToolUnavailability | null): boolean {
  if (!a || !b) return !a && !b;
  return a.reasonKey === b.reasonKey && a.remedyAction === b.remedyAction;
}

/** Κάτοχος: δηλώνει ότι το `key` δεν είναι διαθέσιμο (ή `null` = ξανά διαθέσιμο). Idempotent. */
export function setToolUnavailability(key: AvailabilityKey, unavailability: ToolUnavailability | null): void {
  const current = store.get();
  if (sameUnavailability(current.get(key), unavailability)) return;
  const next = new Map(current);
  if (unavailability) next.set(key, unavailability);
  else next.delete(key);
  store.set(next);
}

/** Event-time ανάγνωση (handlers, πύλες) — καμία συνδρομή. */
export function getToolUnavailability(key: AvailabilityKey): ToolUnavailability | null {
  return store.get().get(key) ?? null;
}

/**
 * Η πύλη: `true` ⇒ επιτρέπεται. Μπλοκαρισμένο ⇒ εκπέμπει `tool:activation-blocked` και `false`.
 * Η επιστροφή στο `'select'` δεν μπλοκάρεται ποτέ (δεν δηλώνεται κάτοχος γι' αυτό).
 */
export function guardToolActivation(key: AvailabilityKey): boolean {
  const unavailability = getToolUnavailability(key);
  if (!unavailability) return true;
  EventBus.emit('tool:activation-blocked', {
    tool: key,
    reasonKey: unavailability.reasonKey,
    ...(unavailability.remedyAction ? { remedyAction: unavailability.remedyAction } : {}),
  });
  return false;
}

/** Reactive ανάγνωση για ΕΝΑ κλειδί — σταθερή ταυτότητα snapshot ανά κλειδί. */
export function useToolUnavailability(key: string): ToolUnavailability | null {
  const getSnapshot = useCallback(() => store.get().get(key as AvailabilityKey) ?? null, [key]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** Μόνο για tests. */
export function resetToolAvailabilityForTests(): void {
  store.reset(new Map());
}
