'use client';

/**
 * foundation-level-elevation — SSoT reader της στάθμης (FFL) του ορόφου Θεμελίωσης
 * του ενεργού κτιρίου (ADR-484 Slice 4).
 *
 * ΓΙΑΤΙ: τα πέδιλα πρέπει να παίρνουν το υψόμετρό τους **από τις ρυθμίσεις ορόφου**
 * (dialog «Όροφοι Κτιρίου» → «Βάθος θεμελίωσης» → ο όροφος Θεμελίωσης στο FFL), ΟΧΙ
 * από hardcoded σταθερά ή από τη βάση της κολώνας. Όλα τα creation paths (manual
 * tool, from-wall/grid, auto-design) διαβάζουν το FFL από εδώ ώστε να υπάρχει ΕΝΑ
 * σημείο αλήθειας.
 *
 * Reuse του low-freq `useFoundationLevelStore` (ADR-040 safe — γράφεται μόνο σε
 * αλλαγή ορόφου/δομική μεταβολή· μηδέν νέο Firestore subscription):
 *   · cross-level (ενεργός ≠ Θεμελίωση): `target.floorElevationMm`.
 *   · ενεργός = Θεμελίωση (`target` null): `activeFloorElevationMm` (= το ίδιο FFL).
 *
 * Non-React getter (το καλούν tools/builders εκτός render) — `getState()`.
 *
 * @see ../../state/foundation-level-store.ts
 * @see ../types/foundation-types.ts — resolveFoundationTopElevationMm
 */

import { useFoundationLevelStore } from '../../state/foundation-level-store';

/**
 * Datum-relative FFL (mm) του ορόφου Θεμελίωσης του ενεργού κτιρίου, ή `null` όταν
 * δεν μπορεί να προσδιοριστεί (degenerate → ο καλών πέφτει στα default constants).
 */
export function resolveActiveFoundationLevelElevationMm(): number | null {
  const s = useFoundationLevelStore.getState();
  return s.target ? s.target.floorElevationMm : s.activeFloorElevationMm;
}
