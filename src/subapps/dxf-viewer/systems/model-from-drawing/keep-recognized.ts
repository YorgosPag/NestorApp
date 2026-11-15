/**
 * ADR-929 §6.20 · Δ22 — **«Κράτησε τα αναγνωρισμένα»**: οι διαστάσεις και οι γραμμές που διάβασε η αναγνώριση της
 * εικόνας γίνονται κανονικές οντότητες σχεδίου, **ανεξάρτητα από τους τοίχους** (Δ20: κάθε στρώση γράφεται μόνη της).
 *
 * Πρότυπο των μεγάλων (έρευνα §6.20): η 2Δ γραμμική πληροφορία γίνεται οντότητες **ανά κατηγορία layer**, με **χωριστή**
 * πράξη από τη μοντελοποίηση (AutoCAD `PDFIMPORT` «Create object layers» · Raster Design VTools · ArchiCAD «Explode into
 * Current View»), και μόνο αφού έχει οριστεί κλίμακα (Plans2BIM).
 *
 *   · διαστάσεις → το layer του στυλ (`DIMLAYER`) — ο ΙΔΙΟΣ γραφέας με την έγκριση τοίχων (`writeDimensionProjection`)·
 *   · γραμμές    → `RECOGNIZED_Geometry` (`services/import-layer-names.ts`).
 *
 * Μία προβολή (`projectKeepRecognized`), δύο αναγνώστες: η προεπισκόπηση του πάνελ (μηδέν εγγραφές) και η εγγραφή.
 * Η εγγραφή είναι **ΕΝΑ** βήμα αναίρεσης (layers + διαστάσεις + γραμμές, ADR-729). Τίποτα νέο ⇒ κανένα layer.
 *
 * Zero React. Καμία γεωμετρία εδώ (βλ. `recognized-lines.ts`, `model-from-drawing-dimensions.ts`).
 */

import type { WallSceneAccessor } from '../../bim/walls/add-wall-to-scene';
import { appendEntitiesToScene } from '../../bim/scene/append-entity-to-scene';
import {
  RASTER_LINE_TOLERANCE_PX,
  rasterLineTolerance,
} from '../../bim/plan-recognition/segments/raster-segments-to-scene';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { IMPORT_LAYER_NAMES } from '../../services/import-layer-names';
import {
  ensureNamedLayer,
  planDimensionLayer,
  planNamedLayer,
  type NamedLayerTarget,
} from '../../services/named-layer';
import type { PlanConfidenceTier } from '../plan-recognition/plan-confidence';
import { readLiveScene } from './model-from-drawing-live';
import {
  projectRecognizedDimensions,
  writeDimensionProjection,
  type DimensionAbsorption,
  type DimensionWriteOutcome,
  type RecognizedDimensionProjection,
} from './model-from-drawing-dimensions';
import { currentRasterPlacement, type ProposalLineSource } from './proposal-line-source';
import { partitionNewLines, planRecognizedLines, type RecognizedLinesPartition } from './recognized-lines';

/** Η ετικέτα παραγωγού στην εκπομπή `drawing:entity-created`. */
export const PLAN_RECOGNITION_LINES_TOOL = 'plan-recognition-lines';

const LINES_LAYER = { name: IMPORT_LAYER_NAMES.recognizedGeometry } as const;

/** Η προεπισκόπηση της στρώσης «Γραμμές» (ΧΑΜΗΛΟΣΥΧΝΗ, ζει στο store της συνεδρίας). */
export interface RecognizedLinesSummary {
  readonly fresh: number;
  readonly existing: number;
  readonly layer: NamedLayerTarget;
}

/** Τι έγινε σε κάθε στρώση — ΠΑΝΤΑ με όνομα· `null` ⇔ η στρώση δεν υπήρχε. */
export interface KeepRecognizedOutcome {
  readonly dimensions: DimensionWriteOutcome | null;
  readonly lines: DimensionWriteOutcome | null;
}

interface KeepProjection {
  readonly dimensions: RecognizedDimensionProjection | null;
  readonly lines: RecognizedLinesPartition | null;
}

/**
 * Οι νέες διαστάσεις απορροφούν τις γραμμές τους μόνο αν **θα** γραφτούν: layer διαστάσεων που αρνείται ⇒ οι γραμμές
 * τους μένουν γραμμές (ποτέ χαμένες, ADR-941 Δ19). Οι υπάρχουσες απορροφούν πάντα.
 */
function absorbedSegments(absorption: DimensionAbsorption, dimensionsWillWrite: boolean): ReadonlySet<string> {
  return dimensionsWillWrite ? new Set([...absorption.existing, ...absorption.fresh]) : absorption.existing;
}

function dimensionsWillWrite(projection: RecognizedDimensionProjection, accessor: WallSceneAccessor): boolean {
  const levelId = accessor.currentLevelId;
  const scene = levelId ? accessor.getLevelScene(levelId) : null;
  return planDimensionLayer(scene, projection.style).kind !== 'refused';
}

function projectLines(
  source: ProposalLineSource,
  accessor: WallSceneAccessor,
  minTier: PlanConfidenceTier,
  dimensions: RecognizedDimensionProjection | null,
): RecognizedLinesPartition | null {
  if (source.kind !== 'raster' || !source.linework) return null;
  const placement = currentRasterPlacement(source);
  const live = readLiveScene(accessor);
  if (!placement || !live) return null;
  const absorbed = dimensions
    ? absorbedSegments(dimensions.absorption, dimensionsWillWrite(dimensions, accessor))
    : new Set<string>();
  const proposed = planRecognizedLines({
    linework: source.linework, placement, backgroundId: source.backgroundId, minTier, absorbed,
  });
  return partitionNewLines(proposed, live.entities, rasterLineTolerance(placement, RASTER_LINE_TOLERANCE_PX));
}

/** Η ΜΙΑ προβολή: ό,τι δείχνει το πάνελ, αυτό γράφει η πράξη. */
function projectKeepRecognized(
  source: ProposalLineSource,
  accessor: WallSceneAccessor,
  minTier: PlanConfidenceTier,
): KeepProjection {
  const dimensions = projectRecognizedDimensions(source, accessor);
  return { dimensions, lines: projectLines(source, accessor, minTier, dimensions) };
}

/** Η προεπισκόπηση της στρώσης «Γραμμές» (οι διαστάσεις έχουν ήδη τη δική τους, `summarizeRecognizedDimensions`). */
export function summarizeRecognizedLines(
  source: ProposalLineSource,
  accessor: WallSceneAccessor,
  minTier: PlanConfidenceTier,
): RecognizedLinesSummary | null {
  const { lines } = projectKeepRecognized(source, accessor, minTier);
  if (!lines) return null;
  const levelId = accessor.currentLevelId;
  const scene = levelId ? accessor.getLevelScene(levelId) : null;
  return { fresh: lines.fresh.length, existing: lines.existing, layer: planNamedLayer(scene, LINES_LAYER) };
}

function writeLines(lines: RecognizedLinesPartition, accessor: WallSceneAccessor, undoName: string): DimensionWriteOutcome {
  if (lines.fresh.length === 0) return { kind: 'written', count: 0 };
  const layer = ensureNamedLayer(accessor, LINES_LAYER);
  if (!layer.ok) return { kind: 'refused', reason: layer.reason };
  appendEntitiesToScene(accessor, lines.fresh.map((l) => ({ ...l, layerId: layer.layerId })), PLAN_RECOGNITION_LINES_TOOL, undoName);
  return { kind: 'written', count: lines.fresh.length };
}

/**
 * Γράφει τις **νέες** διαστάσεις και γραμμές της πηγής ως ΕΝΑ βήμα αναίρεσης. Ο καλών (ο ελεγκτής) έχει ήδη ελέγξει
 * ότι η πηγή ζει και είναι βαθμονομημένη. Δεύτερη κλήση πάνω στη σκηνή που προέκυψε ⇒ μηδέν νέες (ιδεμποτία).
 */
export function keepRecognized(
  source: ProposalLineSource,
  accessor: WallSceneAccessor,
  minTier: PlanConfidenceTier,
  undoName: string,
): KeepRecognizedOutcome {
  return getGlobalCommandHistory().runAsSingleUndo(undoName, (): KeepRecognizedOutcome => {
    const projection = projectKeepRecognized(source, accessor, minTier);
    return {
      dimensions: projection.dimensions ? writeDimensionProjection(projection.dimensions, accessor, undoName) : null,
      lines: projection.lines ? writeLines(projection.lines, accessor, undoName) : null,
    };
  });
}
