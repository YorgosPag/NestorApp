/**
 * ADR-363 — «Δοκάρι από τοίχο» geometry bridge (pure SSoT).
 *
 * Γέφυρα ανάμεσα στο hit-test ενός υπάρχοντος WallEntity και στους ΥΠΑΡΧΟΝΤΕΣ
 * beam builders. ΚΑΜΙΑ αναπαραγωγή geometry/builder math:
 *   - hit-test στον άξονα του τοίχου μέσω `pointToLineDistance` (ίδιο SSoT).
 *   - entity build via `completeBeamFromTwoClicks` (beam-completion.ts).
 *
 * Σημασιολογία (Giorgio 2026-06-02):
 *   - 1 κλικ πάνω σε τοίχο → ΕΝΑ δοκάρι στον άξονά του (start → end του τοίχου).
 *   - Πλάτος δοκαριού = πάχος τοίχου (ίδιο footprint).
 *   - Ύψος/θέση: beam defaults (depth 500mm, top 3000mm → bottom 2500mm), δηλαδή
 *     το δοκάρι κάθεται πάνω στην κορυφή ενός 3m τοίχου.
 *   - Ο τοίχος ΑΥΤΟΜΑΤΑ κονταίνει στα 2.5m: η δημιουργία του δοκαριού εκπέμπει
 *     `drawing:entity-created` (tool 'beam') → `useStructuralAutoAttach` (ADR-401
 *     Phase D) attach-άρει την κορυφή του τοίχου στο κάτω μέρος του δοκαριού. ΔΕΝ
 *     χρειάζεται εδώ καμία ρητή μείωση ύψους — γίνεται από το auto-attach SSoT.
 *
 * @see hooks/drawing/beam-completion.ts — beam builder SSoT
 * @see hooks/useStructuralAutoAttach.ts — wall-top auto-attach (ADR-401 D)
 * @see bim/walls/wall-from-entity.ts — mirror pattern (wall on existing entity)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import type { WallEntity } from '../types/wall-types';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import {
  completeBeamFromTwoClicks,
  type BeamParamOverrides,
  type BuildBeamEntityResult,
  type SceneUnits,
} from '../../hooks/drawing/beam-completion';

/**
 * Διάλεξε τον ΠΛΗΣΙΕΣΤΕΡΟ τοίχο κάτω από το κλικ (hit-test στον άξονα start→end),
 * εντός `tolerance` (world units). Επιστρέφει `null` αν δεν βρεθεί τοίχος.
 */
export function pickWallEntityAt(
  point: Readonly<Point2D>,
  entities: readonly Entity[],
  tolerance: number,
): WallEntity | null {
  let best: WallEntity | null = null;
  let bestDist = tolerance;
  for (const e of entities) {
    if (!isWallEntity(e)) continue;
    const w = e as WallEntity;
    const dist = pointToLineDistance(
      point,
      { x: w.params.start.x, y: w.params.start.y },
      { x: w.params.end.x, y: w.params.end.y },
    );
    if (dist <= bestDist) {
      bestDist = dist;
      best = w;
    }
  }
  return best;
}

/**
 * Χτίσε ΕΝΑ δοκάρι στον άξονα του τοίχου. Πλάτος = πάχος τοίχου (εκτός αν δοθεί
 * override). Τα υπόλοιπα (ύψος/depth/elevation/kind) ακολουθούν τα beam defaults
 * ή τα ribbon overrides. Επιστρέφει το build result (hardErrors → δεν χτίζεται).
 */
export function buildBeamFromWall(
  wall: WallEntity,
  overrides: BeamParamOverrides,
  levelId: string,
  sceneUnits: SceneUnits,
): BuildBeamEntityResult {
  const start: Point2D = { x: wall.params.start.x, y: wall.params.start.y };
  const end: Point2D = { x: wall.params.end.x, y: wall.params.end.y };
  // Πλάτος δοκαριού = πάχος τοίχου, αλλά τα ribbon overrides υπερισχύουν.
  const merged: BeamParamOverrides = { width: wall.params.thickness, ...overrides };
  return completeBeamFromTwoClicks(start, end, levelId, 'straight', merged, sceneUnits);
}
