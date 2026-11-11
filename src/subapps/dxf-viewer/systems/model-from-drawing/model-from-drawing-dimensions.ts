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
 *   3. layer του στυλ (`ensureDimensionLayer`, βρες ή φτιάξε — fail-closed: χωρίς layer ⇒ καμία διάσταση, **με λόγο**)·
 *   4. εγγραφή (`addDimensionsToScene`).
 *
 * Σ1.3β — τα βήματα 1–2 είναι ΕΝΑΣ υπολογισμός (`projectRecognizedDimensions`) με δύο αναγνώστες: την προεπισκόπηση
 * του πάνελ (`summarizeRecognizedDimensions`, μηδέν εγγραφές) και την εγγραφή. Ό,τι δείχνει το πάνελ ως «Θα
 * δημιουργηθούν / Υπάρχουν ήδη / σε ποιο επίπεδο», αυτό κάνει η έγκριση — δεν υπάρχει δεύτερη λογική να διαφωνήσει.
 *
 * Zero React. Καμία γεωμετρία εδώ.
 *
 * @see ../../bim/plan-recognition/fusion/dimension-entities.ts — η προβολή
 * @see ../dimensions/linear-dimension-identity.ts — η ταυτότητα (ιδεμποτία)
 * @see ../../services/named-layer.ts — η πόρτα του layer (εγγραφή + ανάγνωση)
 */

import { planDimensionEntities } from '../../bim/plan-recognition/fusion/dimension-entities';
import { addDimensionsToScene } from '../../bim/scene/add-dimensions-to-scene';
import type { WallSceneAccessor } from '../../bim/walls/add-wall-to-scene';
import { MODEL_FROM_DRAWING_LIMITS } from '../../config/tolerance-config';
import {
  ensureDimensionLayer,
  planDimensionLayer,
  type DimensionLayerTarget,
  type NamedLayerRefusal,
} from '../../services/named-layer';
import type { DimStyle } from '../../types/dimension';
import { mmToSceneUnits } from '../../utils/scene-units';
import { getDimStyleRegistry } from '../dimensions/dim-style-registry';
import { partitionNewLinearDimensions } from '../dimensions/linear-dimension-identity';
import { readLiveScene } from './model-from-drawing-live';
import { currentRasterPlacement, type ProposalLineSource } from './proposal-line-source';

/** Η ετικέτα παραγωγού στην εκπομπή `drawing:entity-created`. */
export const PLAN_RECOGNITION_DIMENSION_TOOL = 'dim-plan-recognition';

/** Το layer ορίζεται ΜΕΤΑ την ιδεμποτία (βήμα 3): δεν φτιάχνουμε layer για μηδέν νέες διαστάσεις. */
const LAYER_RESOLVED_AFTER_DEDUPE = '';

type RecognizedDimension = ReturnType<typeof planDimensionEntities>[number]['entity'];

/** Βήματα 1–2: οι νέες διαστάσεις της πηγής απέναντι στη ζωντανή σκηνή, και το στυλ τους. */
interface RecognizedDimensionProjection {
  readonly fresh: readonly RecognizedDimension[];
  readonly existing: number;
  readonly style: DimStyle;
}

/** ADR-929 Δ20 Σ1.3β — η προεπισκόπηση της στρώσης «Διαστάσεις» (ΧΑΜΗΛΟΣΥΧΝΗ, ζει στο store της συνεδρίας). */
export interface RecognizedDimensionSummary {
  /** Θα δημιουργηθούν στην έγκριση. */
  readonly fresh: number;
  /** Υπάρχουν ήδη στη σκηνή (ή διπλότυπο μέσα στην ίδια ανάγνωση) — δεν ξαναγράφονται. */
  readonly existing: number;
  /** Σε ποιο επίπεδο, και αν θα δημιουργηθεί ή θα αρνηθεί (με λόγο). */
  readonly layer: DimensionLayerTarget;
}

/** Τι έγινε με τις διαστάσεις στην έγκριση — ΠΑΝΤΑ με όνομα, ποτέ σιωπηλό μηδέν. */
export type DimensionWriteOutcome =
  | { readonly kind: 'written'; readonly count: number }
  | { readonly kind: 'refused'; readonly reason: NamedLayerRefusal };

const NOTHING_NEW: DimensionWriteOutcome = { kind: 'written', count: 0 };

/** `null` ⇔ δεν υπάρχει στρώση διαστάσεων: πηγή-σκηνή, πηγή χωρίς διαστάσεις, χαμένο υπόβαθρο, χωρίς σκηνή. */
function projectRecognizedDimensions(
  source: ProposalLineSource,
  accessor: WallSceneAccessor,
): RecognizedDimensionProjection | null {
  if (source.kind !== 'raster' || !source.dimensions) return null;
  const placement = currentRasterPlacement(source);
  const live = readLiveScene(accessor);
  if (!placement || !live) return null;

  const style = getDimStyleRegistry().getActiveStyle();
  const proposed = planDimensionEntities(
    { ...source.dimensions, placement },
    { styleId: style.id, layerId: LAYER_RESOLVED_AFTER_DEDUPE },
  ).map((p) => p.entity);
  const tolerance = MODEL_FROM_DRAWING_LIMITS.NODE_MERGE_TOLERANCE_MM * mmToSceneUnits(live.sceneUnits);
  const { fresh, existing } = partitionNewLinearDimensions(proposed, live.entities, tolerance);
  return { fresh, existing, style };
}

/** Σ1.3β — η προεπισκόπηση: ίδιος υπολογισμός με την εγγραφή, μηδέν εγγραφές. `null` ⇔ καμία στρώση διαστάσεων. */
export function summarizeRecognizedDimensions(
  source: ProposalLineSource,
  accessor: WallSceneAccessor,
): RecognizedDimensionSummary | null {
  const projection = projectRecognizedDimensions(source, accessor);
  if (!projection) return null;
  const levelId = accessor.currentLevelId;
  const scene = levelId ? accessor.getLevelScene(levelId) : null;
  return {
    fresh: projection.fresh.length,
    existing: projection.existing,
    layer: planDimensionLayer(scene, projection.style),
  };
}

/**
 * Γράφει τις **νέες** διαστάσεις της πηγής στην ενεργή σκηνή. `null` ⇔ καμία στρώση διαστάσεων· `written` με το
 * πλήθος (0 = όλες υπήρχαν ήδη)· `refused` ⇔ δεν βρέθηκε/φτιάχτηκε layer — καμία διάσταση, με τον λόγο.
 */
export function writeRecognizedDimensions(
  source: ProposalLineSource,
  accessor: WallSceneAccessor,
  undoName: string,
): DimensionWriteOutcome | null {
  const projection = projectRecognizedDimensions(source, accessor);
  if (!projection) return null;
  if (projection.fresh.length === 0) return NOTHING_NEW;

  const layer = ensureDimensionLayer(accessor, projection.style);
  if (!layer.ok) return { kind: 'refused', reason: layer.reason };
  addDimensionsToScene(
    projection.fresh.map((d) => ({ ...d, layerId: layer.layerId })),
    accessor,
    { tool: PLAN_RECOGNITION_DIMENSION_TOOL, undoName },
  );
  return { kind: 'written', count: projection.fresh.length };
}
