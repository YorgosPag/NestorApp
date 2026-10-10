/**
 * ADR-911 Δ5 — η ραφή του ανιχνευτή τοίχων: γραμμές ρόλου «τοίχος» → υποψήφια ορθογώνια.
 *
 * Ο βοηθός δεν ξέρει ΠΩΣ βρέθηκε ένα ορθογώνιο· ξέρει μόνο ότι παίρνει `DetectedRectangle[]`.
 * Σήμερα υπάρχει ΜΙΑ στρατηγική (κλειστά ορθογώνια 4 γραμμών — εξηγεί 160/160 γραμμές του
 * σχεδίου δοκιμής). Σχέδια με μακριές παράλληλες παρειές (χωρίς κλειστά ορθογώνια) θέλουν
 * δεύτερη — ανίχνευση παράλληλων ζευγών, το πρότυπο του Chief Architect «CAD to Walls» —
 * που ΔΕΝ γράφεται χωρίς δεύτερο σχέδιο για βαθμονόμηση. Όταν γραφτεί, μπαίνει ΕΔΩ και ο
 * υπόλοιπος αγωγός (χτίσιμο, κάλυψη, προεπισκόπηση) δεν αλλάζει.
 *
 * @see ../walls/wall-in-region.ts (findRectanglesFromSegments — corner-graph SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md
 */

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
