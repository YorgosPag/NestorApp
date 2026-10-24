"use client";

/**
 * ToolAvailabilityStore — ποια εργαλεία ΔΕΝ μπορούν να ενεργοποιηθούν τώρα, και γιατί (ADR-921).
 *
 * Revit/ArchiCAD «command availability»: ένα εργαλείο που δεν έχει νόημα στην τρέχουσα
 * κατάσταση δεν ξεκινά καν — δεν αφήνεται ο χρήστης να δουλέψει και να απορριφθεί στο τέλος.
 *
 * ## Ρόλοι
 *
 *  - **Κάτοχος** (π.χ. `OverlayStoreProvider` για το `'layering'`): δηλώνει με
 *    `setToolUnavailability(tool, …)` / `null` — ο ΜΟΝΟΣ που ξέρει τους κανόνες του.
 *  - **Πύλη** (`guardToolActivation`): ρωτιέται από το `handleToolChange` ΚΑΙ από το
 *    `toolStateStore.selectTool` (γραμμή εντολών) — κάθε διαδρομή ενεργοποίησης περνά από εδώ.
 *    Αν μπλοκάρει, εκπέμπει `tool:activation-blocked` → ΕΝΑ κεντρικό toast.
 *  - **Κουμπιά**: `useToolUnavailability(tool)` — per-key συνδρομή (ADR-040 micro-leaf),
 *    re-render μόνο όταν αλλάζει η δική τους διαθεσιμότητα.
 *
 * Απουσία εγγραφής = διαθέσιμο ⇒ μηδέν αλλαγή για κάθε εργαλείο που δεν έχει κάτοχο.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-921-overlay-drawing-readiness.md
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { ToolType } from '../ui/toolbar/types';
import { createExternalStore } from './createExternalStore';
import { EventBus } from '../systems/events/EventBus';

export interface ToolUnavailability {
  /** i18n κλειδί (`dxf-viewer-shell`) — tooltip του κουμπιού + κείμενο του toast. */
  readonly reasonKey: string;
  /** Προαιρετική διόρθωση: ribbon action που λύνει την αιτία (π.χ. άνοιγμα εισαγωγής). */
  readonly remedyAction?: string;
}

type AvailabilityMap = ReadonlyMap<ToolType, ToolUnavailability>;

const store = createExternalStore<AvailabilityMap>(new Map());

function sameUnavailability(a: ToolUnavailability | undefined, b: ToolUnavailability | null): boolean {
  if (!a || !b) return !a && !b;
  return a.reasonKey === b.reasonKey && a.remedyAction === b.remedyAction;
}

/** Κάτοχος: δηλώνει ότι το `tool` δεν είναι διαθέσιμο (ή `null` = ξανά διαθέσιμο). Idempotent. */
export function setToolUnavailability(tool: ToolType, unavailability: ToolUnavailability | null): void {
  const current = store.get();
  if (sameUnavailability(current.get(tool), unavailability)) return;
  const next = new Map(current);
  if (unavailability) next.set(tool, unavailability);
  else next.delete(tool);
  store.set(next);
}

/** Event-time ανάγνωση (handlers, πύλες) — καμία συνδρομή. */
export function getToolUnavailability(tool: ToolType): ToolUnavailability | null {
  return store.get().get(tool) ?? null;
}

/**
 * Η πύλη: `true` ⇒ επιτρέπεται. Μπλοκαρισμένο ⇒ εκπέμπει `tool:activation-blocked` και `false`.
 * Η επιστροφή στο `'select'` δεν μπλοκάρεται ποτέ (δεν δηλώνεται κάτοχος γι' αυτό).
 */
export function guardToolActivation(tool: ToolType): boolean {
  const unavailability = getToolUnavailability(tool);
  if (!unavailability) return true;
  EventBus.emit('tool:activation-blocked', {
    tool,
    reasonKey: unavailability.reasonKey,
    ...(unavailability.remedyAction ? { remedyAction: unavailability.remedyAction } : {}),
  });
  return false;
}

/** Reactive ανάγνωση για ΕΝΑ εργαλείο — σταθερή ταυτότητα snapshot ανά κλειδί. */
export function useToolUnavailability(tool: string): ToolUnavailability | null {
  const getSnapshot = useCallback(() => store.get().get(tool as ToolType) ?? null, [tool]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** Μόνο για tests. */
export function resetToolAvailabilityForTests(): void {
  store.reset(new Map());
}
