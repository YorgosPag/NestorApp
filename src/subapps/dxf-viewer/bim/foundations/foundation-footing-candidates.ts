/**
 * foundation-footing-candidates — pure resolver των foundation-floor πεδίλων που
 * τροφοδοτούν τον auto-design reconciler (ADR-459 Phase 7 v8.1).
 *
 * **Πρωταρχική** πηγή = το model SSoT (`foundation-level-store.entities`, model-backed
 * από το `floorplan_foundations` + optimistic upserts του cross-level writer).
 * **Συμπληρωματική** = η live foundation scene (αν ο όροφος Θεμελίωσης είναι φορτωμένος
 * in-memory), ενωμένη deduped-by-id (store wins).
 *
 * ΓΙΑΤΙ (regression fix): τα auto πέδιλα ΔΕΝ μπαίνουν ποτέ σε scene snapshot (ζουν
 * μόνο στο `floorplan_foundations`). Αν ο reconciler διάβαζε ΜΟΝΟ τη (πιθανώς stale)
 * live foundation scene, ένα υπάρχον auto πέδιλο θα έλειπε από το diff → σε
 * rotation/move της κολώνας δημιουργείτο νέο πέδιλο αλλά το παλιό **δεν διαγραφόταν**.
 *
 * Pure module — zero React/DOM/Firestore deps.
 *
 * @see ./auto-foundation-reconcile.ts — ο reconciler που καταναλώνει το αποτέλεσμα
 * @see ../../state/foundation-level-store.ts — το model SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 7
 */

import { isFootingElement } from './footing-element-summary';
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';

/**
 * Τα foundation-floor πέδιλα (model SSoT ∪ live scene, dedup-by-id, store wins).
 *
 * @param storeEntities   `foundation-level-store.entities` (model-backed + optimistic).
 * @param foundationScene live in-memory σκηνή του ορόφου Θεμελίωσης, ή `null` αν δεν
 *                        έχει φορτωθεί (τότε αρκεί το store).
 */
export function collectFoundationFootings(
  storeEntities: readonly Entity[],
  foundationScene: SceneModel | null,
): readonly Entity[] {
  const storeFootings = storeEntities.filter(isFootingElement);
  if (!foundationScene) return storeFootings;
  const ids = new Set(storeFootings.map((e) => e.id));
  const sceneOnly = (foundationScene.entities as unknown as readonly Entity[]).filter(
    (e) => isFootingElement(e) && !ids.has(e.id),
  );
  return sceneOnly.length ? [...storeFootings, ...sceneOnly] : storeFootings;
}
