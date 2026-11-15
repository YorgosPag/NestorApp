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

import { planDimensionEntities, type PlanDimensionProposal } from '../../bim/plan-recognition/fusion/dimension-entities';
import type { DimensionSpan } from '../../bim/plan-recognition/fusion/plan-fusion-types';
import { recognizedMetadata } from './recognized-provenance';
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

type RecognizedDimension = PlanDimensionProposal['entity'];

/**
 * ADR-929 §6.20 · ADR-941 Δ19 — ποια τμήματα της εικόνας **ζωγραφίζει** ήδη μια διάσταση (η γραμμή της και οι
 * επεκτάσεις της): αυτά δεν ξαναγράφονται ως απλές γραμμές. Χωριστά οι νέες από τις υπάρχουσες, γιατί οι νέες
 * απορροφούν μόνο αν γραφτούν (layer που αρνείται ⇒ οι γραμμές τους μένουν γραμμές, ποτέ χαμένες).
 */
export interface DimensionAbsorption {
  readonly fresh: ReadonlySet<string>;
  readonly existing: ReadonlySet<string>;
}

/** Βήματα 1–2: οι νέες διαστάσεις της πηγής απέναντι στη ζωντανή σκηνή, και το στυλ τους. */
export interface RecognizedDimensionProjection {
  readonly fresh: readonly RecognizedDimension[];
  readonly existing: number;
  readonly style: DimStyle;
  readonly absorption: DimensionAbsorption;
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

/** Δ9 — κάθε διάσταση φέρει την εικόνα και το άνοιγμα από το οποίο βγήκε. */
function stamped(proposal: PlanDimensionProposal, backgroundId: string): RecognizedDimension {
  const metadata = recognizedMetadata({ backgroundId, origin: 'dimension-span', sourceId: proposal.spanId });
  return { ...proposal.entity, metadata: { ...proposal.entity.metadata, ...metadata } };
}

/** Τα τμήματα που ζωγραφίζει ένα άνοιγμα: η γραμμή διάστασης και οι δύο επεκτάσεις. */
function spanSegmentIds(span: DimensionSpan): readonly string[] {
  return [...span.segmentIds, span.ends[0].extensionId, span.ends[1].extensionId];
}

function absorptionOf(
  proposals: readonly PlanDimensionProposal[],
  freshIds: ReadonlySet<string>,
  spans: readonly DimensionSpan[],
): DimensionAbsorption {
  const spanById = new Map(spans.map((s) => [s.id, s]));
  const fresh = new Set<string>();
  const existing = new Set<string>();
  for (const { spanId, entity } of proposals) {
    const span = spanById.get(spanId);
    if (span) for (const id of spanSegmentIds(span)) (freshIds.has(entity.id) ? fresh : existing).add(id);
  }
  return { fresh, existing };
}

/**
 * `null` ⇔ δεν υπάρχει στρώση διαστάσεων: πηγή-σκηνή, πηγή χωρίς διαστάσεις, χαμένο υπόβαθρο, χωρίς σκηνή. Ο ΕΝΑΣ
 * υπολογισμός πίσω από την προεπισκόπηση, την έγκριση τοίχων και το «Κράτησε τα αναγνωρισμένα» (§6.20).
 */
export function projectRecognizedDimensions(
  source: ProposalLineSource,
  accessor: WallSceneAccessor,
): RecognizedDimensionProjection | null {
  if (source.kind !== 'raster' || !source.dimensions) return null;
  const placement = currentRasterPlacement(source);
  const live = readLiveScene(accessor);
  if (!placement || !live) return null;

  const style = getDimStyleRegistry().getActiveStyle();
  const proposals = planDimensionEntities(
    { ...source.dimensions, placement },
    { styleId: style.id, layerId: LAYER_RESOLVED_AFTER_DEDUPE },
  ).map((p) => ({ spanId: p.spanId, entity: stamped(p, source.backgroundId) }));
  const tolerance = MODEL_FROM_DRAWING_LIMITS.NODE_MERGE_TOLERANCE_MM * mmToSceneUnits(live.sceneUnits);
  const { fresh, existing } = partitionNewLinearDimensions(proposals.map((p) => p.entity), live.entities, tolerance);
  const freshIds = new Set(fresh.map((d) => d.id));
  const absorption = absorptionOf(proposals, freshIds, source.dimensions.fusion.dimensionSpans);
  return { fresh, existing, style, absorption };
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
  return projection ? writeDimensionProjection(projection, accessor, undoName) : null;
}

/**
 * ADR-929 §6.20 — γράφει μια **ήδη υπολογισμένη** προβολή: ο καλών που μέτρησε τι απορροφούν οι διαστάσεις γράφει
 * ακριβώς αυτές, όχι μια δεύτερη προβολή που θα μπορούσε να διαφωνεί.
 */
export function writeDimensionProjection(
  projection: RecognizedDimensionProjection,
  accessor: WallSceneAccessor,
  undoName: string,
): DimensionWriteOutcome {
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
