/**
 * ADR-929 Δ20 Σ1.3 — ο **γραφέας διαστάσεων** της έγκρισης «Μοντέλο από το σχέδιο»: οι διαστάσεις που διάβασε η
 * αναγνώριση κάτοψης γίνονται `LinearDimensionEntity` στη σκηνή, στο layer του στυλ (`DIMLAYER`).
 *
 * Καλείται **μέσα** στην ατομική ομάδα της έγκρισης (`runAsSingleUndo`, ADR-729), **μετά** τους τοίχους: ένα Ctrl+Z
 * αναιρεί τοίχους + νέο layer + διαστάσεις μαζί, και αν οι τοίχοι αρνηθούν δεν φτάνουμε ποτέ εδώ.
 *
 * Σειρά (κάθε βήμα μόνο αν το προηγούμενο έδωσε κάτι):
 *   1. προβολή `planDimensionEntities` με την τοποθέτηση **της στιγμής** (όπως οι τοίχοι, §6.12)·
 *   2. **ιδεμποτία** — όσες υπάρχουν ήδη στη σκηνή φεύγουν (`partitionNewLinearDimensions`)· τίποτα νέο ⇒ ούτε layer·
 *   3. layer του στυλ (`ensureDimensionLayer`, βρες ή φτιάξε — fail-closed: χωρίς layer ⇒ καμία διάσταση)·
 *   4. εγγραφή (`addDimensionsToScene`).
 *
 * Zero React. Καμία γεωμετρία εδώ.
 *
 * @see ../../bim/plan-recognition/fusion/dimension-entities.ts — η προβολή
 * @see ../dimensions/linear-dimension-identity.ts — η ταυτότητα (ιδεμποτία)
 * @see ../../services/named-layer.ts — η πόρτα του layer
 */

import { planDimensionEntities } from '../../bim/plan-recognition/fusion/dimension-entities';
import { addDimensionsToScene } from '../../bim/scene/add-dimensions-to-scene';
import type { WallSceneAccessor } from '../../bim/walls/add-wall-to-scene';
import { MODEL_FROM_DRAWING_LIMITS } from '../../config/tolerance-config';
import { ensureDimensionLayer } from '../../services/named-layer';
import { mmToSceneUnits } from '../../utils/scene-units';
import { getDimStyleRegistry } from '../dimensions/dim-style-registry';
import { partitionNewLinearDimensions } from '../dimensions/linear-dimension-identity';
import { readLiveScene } from './model-from-drawing-live';
import { currentRasterPlacement, type ProposalLineSource } from './proposal-line-source';

/** Η ετικέτα παραγωγού στην εκπομπή `drawing:entity-created`. */
export const PLAN_RECOGNITION_DIMENSION_TOOL = 'dim-plan-recognition';

/** Το layer ορίζεται ΜΕΤΑ την ιδεμποτία (βήμα 3): δεν φτιάχνουμε layer για μηδέν νέες διαστάσεις. */
const LAYER_RESOLVED_AFTER_DEDUPE = '';

/**
 * Γράφει τις **νέες** διαστάσεις της πηγής στην ενεργή σκηνή. Επιστρέφει πόσες γράφτηκαν (0 για πηγή-σκηνή, πηγή
 * χωρίς διαστάσεις, χαμένο υπόβαθρο, μηδέν νέες ή χωρίς layer).
 */
export function writeRecognizedDimensions(
  source: ProposalLineSource,
  accessor: WallSceneAccessor,
  undoName: string,
): number {
  if (source.kind !== 'raster' || !source.dimensions) return 0;
  const placement = currentRasterPlacement(source);
  const live = readLiveScene(accessor);
  if (!placement || !live) return 0;

  const style = getDimStyleRegistry().getActiveStyle();
  const proposed = planDimensionEntities(
    { ...source.dimensions, placement },
    { styleId: style.id, layerId: LAYER_RESOLVED_AFTER_DEDUPE },
  ).map((p) => p.entity);
  const tolerance = MODEL_FROM_DRAWING_LIMITS.NODE_MERGE_TOLERANCE_MM * mmToSceneUnits(live.sceneUnits);
  const { fresh } = partitionNewLinearDimensions(proposed, live.entities, tolerance);
  if (fresh.length === 0) return 0;

  const layer = ensureDimensionLayer(accessor, style);
  if (!layer.ok) return 0;
  addDimensionsToScene(
    fresh.map((d) => ({ ...d, layerId: layer.layerId })),
    accessor,
    { tool: PLAN_RECOGNITION_DIMENSION_TOOL, undoName },
  );
  return fresh.length;
}
