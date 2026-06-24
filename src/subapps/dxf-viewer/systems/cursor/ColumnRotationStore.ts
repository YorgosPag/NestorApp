/**
 * COLUMN ROTATION STORE — backward-compat aliases (ADR-508 §column place+rotate → ADR-514 Φ6d).
 *
 * Το lock γενικεύτηκε σε κοινό `PlacementRotationStore` (κολώνα ΚΑΙ πέδιλο μοιράζονται το ΙΔΙΟ 2-click
 * place→rotate flow). Αυτό το module κρατά **byte-for-byte aliases** ώστε οι column consumers
 * (`useColumnTool`, `column-preview-helpers`, `drawing-hover-handler`) να μην αλλάξουν — γράφουν/διαβάζουν
 * το ΙΔΙΟ lock με το πέδιλο. Μηδέν παράλληλο store.
 *
 * @see ./PlacementRotationStore.ts — το γενικευμένο SSoT (πηγή του lock)
 */

export {
  setPlacementRotationLock as setColumnRotationLock,
  getPlacementRotationLock as getColumnRotationLock,
  clearPlacementRotationLock as clearColumnRotationLock,
} from './PlacementRotationStore';
export type { PlacementRotationLock as ColumnRotationLock } from './PlacementRotationStore';
