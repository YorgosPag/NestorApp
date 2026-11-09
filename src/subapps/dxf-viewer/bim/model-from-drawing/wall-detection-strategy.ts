/**
 * ADR-911 Δ5 — η ραφή του ανιχνευτή τοίχων: γραμμές ρόλου «τοίχος» → υποψήφια ορθογώνια.
 *
 * Ο βοηθός δεν ξέρει ΠΩΣ βρέθηκε ένα ορθογώνιο· ξέρει μόνο ότι παίρνει `DetectedRectangle[]`.
 * Δύο στρατηγικές:
 *   · `closedRectangleStrategy`: κλειστά ορθογώνια 4 γραμμών (εξηγεί 160/160 γραμμές του σχεδίου δοκιμής).
 *   · `createParallelPairStrategy`: δύο παράλληλες παρειές σε απόσταση πάχους, χωρίς να χρειάζεται κλείσιμο. Είναι
 *     το πρότυπο του Chief Architect «CAD to Walls» (ADR-929 Δ7). Γράφτηκε με βαθμονόμηση στα συνθετικά σχέδια της
 *     Φ2 (γνωστή αλήθεια σε mm) και ωφελεί και τα DXF με μακριές παρειές.
 * Ο υπόλοιπος αγωγός (χτίσιμο, auto-join, κάλυψη, προεπισκόπηση) δεν αλλάζει.
 *
 * @see ../walls/wall-in-region.ts (findRectanglesFromSegments — corner-graph SSoT)
 * @see ../walls/parallel-pair-walls.ts (findWallsFromParallelPairs)
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md
 */

import { MODEL_FROM_DRAWING_LIMITS } from '../../config/tolerance-config';
import { mmToSceneUnits } from '../../utils/scene-units';
import type { SceneUnits } from '../../hooks/drawing/wall-completion';
import { findWallsFromParallelPairs } from '../walls/parallel-pair-walls';
import {
  findRectanglesFromSegments,
  type DetectedRectangle,
  type RegionLineSeg,
} from '../walls/wall-in-region';

/** Τμήματα ρόλου «τοίχος» + ανοχή κόμβων (scene units) → υποψήφια ορθογώνια-τοίχοι. */
export type WallDetectionStrategy = (
  segments: readonly RegionLineSeg[],
  nodeMergeTol: number,
) => DetectedRectangle[];

/** Κάθε τοίχος είναι κλειστό ορθογώνιο 4 γραμμών (ADR-363 Φάση 1K, corner-graph). */
export const closedRectangleStrategy: WallDetectionStrategy = findRectanglesFromSegments;

export interface ParallelPairStrategyOptions {
  readonly sceneUnits: SceneUnits;
  /**
   * Επιπλέον ανοχή «ίδια ευθεία», σε μονάδες σκηνής, πάνω από την ανοχή κόμβων. Το διανυσματικό σχέδιο δεν τη
   * χρειάζεται (0). Οι γραμμές από εικόνα τη χρειάζονται: ένα pixel της σάρωσης είναι δεκάδες mm (ADR-929 Φ2).
   */
  readonly lineTolerance?: number;
  /**
   * Εμβέλεια έλξης άκρων σε παρειές, σε μονάδες σκηνής: η αβεβαιότητα θέσης ενός άκρου στην πηγή. Απούσα ⇒ 2 × η
   * ανοχή «ίδια ευθεία» (διανυσματικό σχέδιο: 10 mm). Οι γραμμές από εικόνα δίνουν τη δική τους (ADR-929 Φ2).
   */
  readonly endSnapReach?: number;
}

/**
 * Δύο παράλληλες παρειές σε απόσταση πάχους ⇒ τοίχος. Τα όρια πάχους ζουν **μόνο** στο `MODEL_FROM_DRAWING_LIMITS`
 * (σε mm) και μετατρέπονται εδώ στις μονάδες της σκηνής. Το κατώφλι «σχεδόν τετράγωνο» είναι το ΙΔΙΟ με του βοηθού
 * (`AMBIGUOUS_ASPECT_RATIO`, ADR-929 §6.14).
 */
export function createParallelPairStrategy(options: ParallelPairStrategyOptions): WallDetectionStrategy {
  const scale = mmToSceneUnits(options.sceneUnits);
  return (segments, nodeMergeTol) => {
    const offsetTol = Math.max(nodeMergeTol, options.lineTolerance ?? 0);
    return findWallsFromParallelPairs(segments, {
      minThickness: MODEL_FROM_DRAWING_LIMITS.WALL_PAIR_MIN_THICKNESS_MM * scale,
      maxThickness: MODEL_FROM_DRAWING_LIMITS.WALL_PAIR_MAX_THICKNESS_MM * scale,
      offsetTol,
      endSnapReach: options.endSnapReach ?? 2 * offsetTol,
      ambiguousAspectRatio: MODEL_FROM_DRAWING_LIMITS.AMBIGUOUS_ASPECT_RATIO,
    });
  };
}
