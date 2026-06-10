/**
 * ADR-436 Slice 2 (Phase 2b) — «Πεδιλοδοκός από τοίχο» / Revit "Wall Foundation".
 *
 * Γέφυρα ανάμεσα στο hit-test ενός υπάρχοντος WallEntity και στους ΥΠΑΡΧΟΝΤΕΣ
 * foundation builders. ΚΑΜΙΑ αναπαραγωγή geometry/builder math:
 *   - hit-test στον άξονα του τοίχου μέσω του ΚΟΙΝΟΥ `pickWallEntityAt`
 *     (re-export από `beam-from-wall.ts` — ένα SSoT, N.0.2).
 *   - entity build via `completeFoundationFromTwoClicks` (foundation-completion.ts).
 *
 * Σημασιολογία (mirror «Δοκάρι από τοίχο»):
 *   - 1 κλικ πάνω σε τοίχο → ΜΙΑ πεδιλοδοκός (`strip`) στον άξονά του (start → end).
 *   - Πλάτος strip = πάχος τοίχου (εκτός αν δοθεί ribbon override).
 *   - Στάθμη/βάθος: foundation defaults (κάτω από στάθμη, ADR-369) ή ribbon overrides.
 *   - Ο τοίχος ΑΥΤΟΜΑΤΑ μπορεί να attach-αριστεί στη βάση (ADR-401 D) μέσω του
 *     `drawing:entity-created` (tool 'foundation') — δεν χρειάζεται ρητή ενέργεια εδώ.
 *
 * @see hooks/drawing/foundation-completion.ts — foundation builder SSoT
 * @see bim/beams/beam-from-wall.ts — πρότυπο + κοινό `pickWallEntityAt`
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §3.5
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../types/wall-types';
import {
  completeFoundationFromTwoClicks,
  type FoundationParamOverrides,
  type BuildFoundationEntityResult,
  type SceneUnits,
} from '../../hooks/drawing/foundation-completion';

// Κοινό hit-test SSoT — re-export ώστε οι callers να εισάγουν από ένα σημείο.
export { pickWallEntityAt } from '../beams/beam-from-wall';

/**
 * Χτίσε ΜΙΑ πεδιλοδοκό (`strip`) στον άξονα του τοίχου. Πλάτος = πάχος τοίχου
 * (εκτός αν δοθεί override). Τα υπόλοιπα (βάθος/στάθμη) ακολουθούν τα foundation
 * defaults ή τα ribbon overrides. Επιστρέφει το build result (hardErrors → δεν χτίζεται).
 */
export function buildStripFromWall(
  wall: WallEntity,
  overrides: FoundationParamOverrides,
  levelId: string,
  sceneUnits: SceneUnits,
): BuildFoundationEntityResult {
  const start: Point2D = { x: wall.params.start.x, y: wall.params.start.y };
  const end: Point2D = { x: wall.params.end.x, y: wall.params.end.y };
  // Πλάτος strip = πάχος τοίχου, αλλά τα ribbon overrides υπερισχύουν.
  const merged: FoundationParamOverrides = { width: wall.params.thickness, ...overrides };
  return completeFoundationFromTwoClicks(start, end, levelId, 'strip', merged, sceneUnits);
}
