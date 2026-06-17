/**
 * building-foundation-level — SSoT resolver του ορόφου «Θεμελίωση» ενός κτιρίου
 * (ADR-459 Phase 0 — cross-level structural organism).
 *
 * Ο στατικός οργανισμός είναι ιστορικά single-level (διαβάζει μόνο τη σκηνή του
 * ενεργού ορόφου). Επειδή τα πέδιλα ζουν στον ειδικό όροφο Θεμελίωσης (Revit-
 * canonical), η σύνδεση κολόνα↔πέδιλο είναι cross-level. Αυτό το pure module
 * βρίσκει — για το κτίριο του ενεργού ορόφου — τον όροφο Θεμελίωσης + το datum-
 * relative απόλυτο υψόμετρό του (FFL mm), ώστε ο reconciler
 * (`cross-level-organism-scene.ts`) να ευθυγραμμίσει τα Z των δύο σκηνών.
 *
 * REUSE (N.0.2 — μηδέν duplicate elevation math): `buildActiveStoreyContext`
 * (το ίδιο SSoT που τροφοδοτεί τον single-floor render datum + τον 3D multi-floor
 * stacker).
 *
 * Pure module — zero React/DOM/Firestore deps.
 *
 * @see active-storey-context.ts — buildActiveStoreyContext (elevation SSoT)
 * @see ../../bim/structural/organism/cross-level-organism-scene.ts — ο reconciler
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 0
 */

import { buildActiveStoreyContext, type StoreyFloorRef } from './active-storey-context';

/** Ελάχιστο σχήμα ενός Level που χρειάζεται ο resolver (το Level το ικανοποιεί). */
export interface FoundationLevelRef {
  readonly id: string;
  readonly floorId?: string;
  readonly buildingId?: string;
  readonly sceneFileId?: string;
  /** ADR-459 Φ7 — project scope για το cross-level `floorplan_foundations` subscription. */
  readonly projectId?: string;
}

/** Στόχος εγγραφής/ανάγνωσης του ορόφου Θεμελίωσης (cross-level write/read). */
export interface FoundationLevelTarget {
  /** DXF Level id του ορόφου Θεμελίωσης. */
  readonly levelId: string;
  /** Building floor id (Firestore `FLOORS` doc) — scope κλειδί persistence. */
  readonly floorId: string;
  /** cadFiles/files doc id (scene snapshot) — null αν δεν έχει συνδεθεί DXF. */
  readonly sceneFileId: string | null;
  /** Datum-relative απόλυτο FFL του ορόφου Θεμελίωσης (mm). */
  readonly floorElevationMm: number;
}

/** Το buildingId του ενεργού level, ή `null` αν δεν είναι συνδεδεμένο σε κτίριο. */
export function resolveBuildingIdForLevel(
  levels: readonly FoundationLevelRef[],
  currentLevelId: string | null,
): string | null {
  if (!currentLevelId) return null;
  return levels.find((l) => l.id === currentLevelId)?.buildingId ?? null;
}

/**
 * Datum-relative απόλυτο FFL (mm) ενός floor μέσα στο building floor list.
 * Reuse του `buildActiveStoreyContext` SSoT· `0` fallback (degenerate → single-level).
 */
export function resolveFloorElevationMm(
  floors: readonly StoreyFloorRef[],
  floorId: string | null,
): number {
  if (!floorId) return 0;
  return buildActiveStoreyContext(floors, floorId)?.floorElevationMm ?? 0;
}

/**
 * Βρες — για το κτίριο του ενεργού level — τον όροφο Θεμελίωσης (`Floor.kind ===
 * 'foundation'`) + το DXF Level που τον φιλοξενεί + το απόλυτο FFL του.
 *
 * Επιστρέφει `null` όταν: δεν υπάρχει buildingId, δεν υπάρχει foundation floor,
 * ή ο foundation floor δεν έχει συνδεδεμένο DXF Level (degenerate → ο καλών μένει
 * single-level, μηδέν regression).
 */
export function resolveBuildingFoundationLevel(
  levels: readonly FoundationLevelRef[],
  currentLevelId: string | null,
  floors: readonly StoreyFloorRef[],
): FoundationLevelTarget | null {
  const buildingId = resolveBuildingIdForLevel(levels, currentLevelId);
  if (!buildingId) return null;
  const foundationFloor = floors.find((f) => f.kind === 'foundation');
  if (!foundationFloor) return null;
  const level = levels.find(
    (l) => l.buildingId === buildingId && l.floorId === foundationFloor.id,
  );
  if (!level) return null;
  return {
    levelId: level.id,
    floorId: foundationFloor.id,
    sceneFileId: level.sceneFileId ?? null,
    floorElevationMm: resolveFloorElevationMm(floors, foundationFloor.id),
  };
}
