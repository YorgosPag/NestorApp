/**
 * ADR-652 M6 — «Δημιουργία Block»: request signal (ribbon action → dialog host).
 *
 * Ο ribbon interceptor ({@link useCreateBlockRibbonAction}) ζει σε διαφορετικό subtree από τον
 * dialog host ({@link CreateBlockDialogHost} στο `DxfViewerDialogs`), οπότε το «άνοιξε τον διάλογο
 * για ΑΥΤΗ την επιλογή» περνά μέσα από ένα module-level signal — ΙΔΙΟ μοτίβο με το
 * `block-library-selection-store` (palette → tool), εδώ action → host.
 *
 * Κρατά ΜΟΝΟ τα ids της επιλογής τη στιγμή του αιτήματος (snapshot): ο host τα διαβάζει στο
 * confirm για να χτίσει τον ορισμό + (προαιρετικά) το replace command. `null` = κανένα ενεργό
 * αίτημα (ο host παραμένει unmounted — gate-at-mount).
 *
 * @see ../../ui/ribbon/hooks/useCreateBlockRibbonAction.ts — ο writer (action interceptor)
 * @see ../../ui/panels/block-library/CreateBlockDialogHost.tsx — ο reader (dialog + orchestrator)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../stores/createExternalStore';

const request = createExternalStore<readonly string[] | null>(null);

/** Ανοίγει τον διάλογο «Δημιουργία Block» για το δοσμένο snapshot επιλογής (ribbon action). */
export function requestCreateBlockFromSelection(selectionIds: readonly string[]): void {
  request.set([...selectionIds]);
}

/** Κλείνει το αίτημα (confirm/cancel → ο host unmount-άρεται). */
export function clearCreateBlockRequest(): void {
  request.set(null);
}

/** Το τρέχον snapshot επιλογής, ή `null` αν δεν υπάρχει ενεργό αίτημα. */
export function getCreateBlockRequest(): readonly string[] | null {
  return request.get();
}

/** Subscribe σε αλλαγές αιτήματος· επιστρέφει unsubscribe. */
export function subscribeCreateBlockRequest(listener: () => void): () => void {
  return request.subscribe(listener);
}

const getServerSnapshot = (): readonly string[] | null => null;

/** Reactive read — ο host mount-άρεται/κλείνει με βάση αυτό. */
export function useCreateBlockRequest(): readonly string[] | null {
  return useSyncExternalStore(request.subscribe, request.get, getServerSnapshot);
}

/** Test-only reset. */
export function __resetCreateBlockRequestForTests(): void {
  request.reset(null);
}
