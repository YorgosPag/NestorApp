/**
 * Footing → στηρίζουσα κολώνα — pure SSoT (N.0.2).
 *
 * ΕΝΑ σημείο που αντιστοιχεί ένα πέδιλο στην κολώνα που το φορτίζει, μέσω του explicit
 * organism FK `ColumnParams.footingId` (explicit-FK-wins). Πρώην copy-pasted ως inline
 * `entities.find(e => isColumnEntity(e) && e.params.footingId === id)` σε 3 σημεία
 * (footing design dims, footing takedown, FEM axial bridge ADR-497) → ενοποιήθηκε εδώ.
 *
 * Διακριτό από το graph-based `footingColumnId` (load-path-walk): εκείνο διασχίζει τον
 * `StructuralGraph` (footing-bearing edge)· αυτό δουλεύει απευθείας στα entities (FK),
 * για consumers που δεν κρατούν graph (design input / active resolvers).
 *
 * Pure — zero React/DOM/Firestore.
 *
 * @see ../loads/load-path-walk.ts — footingColumnId (graph-based δίδυμος)
 */

import type { Entity } from '../../../types/entities';
import { isColumnEntity } from '../../../types/entities';
import type { ColumnEntity } from '../../types/column-types';

/**
 * Η στηρίζουσα κολώνα ενός πεδίλου (πρώτη με `footingId === footingId`), ή `null` όταν
 * δεν υπάρχει attached κολώνα. SSoT για το entity-FK footing→column mapping.
 */
export function resolveSupportingColumn(
  footingId: string,
  entities: readonly Entity[],
): ColumnEntity | null {
  for (const e of entities) {
    if (isColumnEntity(e) && e.params.footingId === footingId) return e;
  }
  return null;
}
