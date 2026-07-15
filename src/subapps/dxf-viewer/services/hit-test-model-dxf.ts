/**
 * ADR-587 Φ10 — DXF/annotation handlers του `DxfEntityUnion → EntityModel` seam.
 *
 * Όλοι οι μη-BIM τύποι είναι **flat-params**: η γεωμετρία τους ζει σε λίγα πεδία στο top
 * level (ή μέσα σε έναν wrapper). Ο μετασχηματισμός τους είναι πάντα ο ίδιος — «κράτα το
 * base model, βάλε τον τύπο, πέρνα ΑΥΤΑ τα πεδία» — οπότε ζει ΜΙΑ φορά
 * ({@link flatFields}) αντί για 14 σχεδόν-πανομοιότυπα branches (N.18).
 *
 * ΚΡΙΣΙΜΟ: κάθε πεδίο που ΔΕΝ περνά εδώ, ο `BoundsCalculator` το βλέπει `undefined` →
 * `null` bounds → το entity βγαίνει ΣΙΩΠΗΛΑ εκτός spatial index (μηδέν hover/κλικ). Αυτός
 * ήταν ο μηχανισμός του ADR-654 bug.
 *
 * @see ./hit-test-entity-model — το registry που τα δρομολογεί
 */

import type { EntityModel } from '../rendering/types/Types';
import type { DxfDimension } from '../canvas-v2/dxf-canvas/dxf-types';
import type { HitTestModelHandler } from './hit-test-model-types';

/**
 * Flat-params converter: `{ ...base, type, <fields> }`. Πεδία με τιμή `undefined`
 * παραλείπονται (ίδια σημασιολογία με το προηγούμενο conditional spread του κειμένου).
 * Με `wrapperKey`, τα πεδία διαβάζονται από το εσωτερικό entity — ο canvas converter
 * τυλίγει xline/ray (`xlineEntity` / `rayEntity`).
 */
function flatFields(
  type: string,
  fields: readonly string[],
  wrapperKey?: string,
): HitTestModelHandler {
  return (entity, base): EntityModel => {
    const raw = entity as unknown as Record<string, unknown>;
    const src = (wrapperKey ? raw[wrapperKey] : raw) as Record<string, unknown> | undefined;
    const model: Record<string, unknown> = { ...base, type };
    for (const field of fields) {
      const value = src?.[field];
      if (value !== undefined) model[field] = value;
    }
    return model as unknown as EntityModel;
  };
}

/**
 * ADR-362 Phase I3 — dimension passthrough. Ο `DxfDimension` wrapper κουβαλά ΟΛΟ το
 * discriminated-union `DimensionEntity` (με defPoints + textMidpoint), οπότε το
 * ξετυλίγουμε ΑΥΤΟΥΣΙΟ (δεν αρκεί λίστα πεδίων: οι 10 παραλλαγές έχουν διαφορετικά) και
 * ξαναβάζουμε από πάνω τα resolved base πεδία.
 */
const dimensionHandler: HitTestModelHandler = (entity, base): EntityModel => {
  const dimEntity = (entity as unknown as DxfDimension).dimensionEntity;
  return {
    ...dimEntity,
    id: base.id,
    layerId: base.layerId,
    color: base.color,
    visible: base.visible,
    selected: base.selected,
    lineType: base.lineType,
    lineweight: base.lineweight,
  } as unknown as EntityModel;
};

/** Οι DXF/annotation handlers, keyed στον τύπο τους. */
export const HIT_TEST_MODEL_DXF_HANDLERS = {
  // ── CAD primitives ──
  line: flatFields('line', ['start', 'end']),
  circle: flatFields('circle', ['center', 'radius']),
  polyline: flatFields('polyline', ['vertices', 'closed']),
  arc: flatFields('arc', ['center', 'radius', 'startAngle', 'endAngle', 'counterclockwise']),
  // ADR-557 Φ-attachment — το κείμενο κουβαλά ΤΑ ΙΔΙΑ style πεδία με το render EntityModel
  // (`textStyle` justification / `widthFactor` X-scale / `width` MTEXT frame), ώστε το
  // `resolveTextBox` του hit-test να παράγει ΤΟ ΙΔΙΟ κουτί που ζωγραφίζει το hover frame.
  // Χωρίς αυτά η ζώνη κλικ ξέφευγε από το φωτισμένο ορθογώνιο.
  text: flatFields('text', [
    'position', 'text', 'height', 'rotation', 'textStyle', 'widthFactor', 'width',
  ]),
  'angle-measurement': flatFields('angle-measurement', ['vertex', 'point1', 'point2', 'angle']),
  dimension: dimensionHandler,
  // ADR-359 Phase 11 — τα xline/ray είναι WRAPPED· χωρίς unwrap δεν φτάνουν basePoint/
  // direction στο EntityModel → ούτε bounds ούτε narrow-phase hit-test.
  xline: flatFields('xline', ['basePoint', 'direction', 'secondPoint'], 'xlineEntity'),
  ray: flatFields('ray', ['basePoint', 'direction', 'secondPoint'], 'rayEntity'),
  // ADR-507 — το hatch είναι direct entity· τα `boundaryPaths` τροφοδοτούν ΚΑΙ το AABB
  // (broad phase) ΚΑΙ το even-odd containment (narrow phase).
  hatch: flatFields('hatch', ['boundaryPaths']),

  // ── Annotation family (flat paper-space params) ──
  // ADR-583 — annotation symbol (North arrow).
  'annotation-symbol': flatFields('annotation-symbol', [
    'position', 'kind', 'symbolId', 'sizeMm', 'rotation',
  ]),
  // ADR-583 Φ2 — graphic scale-bar.
  'scale-bar': flatFields('scale-bar', [
    'position', 'angleRad', 'length', 'unit', 'divisions', 'subdivisions', 'style',
    'barHeightMm', 'labelHeightMm', 'labelPlacement',
  ]),
  // ADR-612 — opening info tag.
  'opening-info-tag': flatFields('opening-info-tag', [
    'position', 'angleRad', 'widthMm', 'topText', 'bottomLeftText', 'bottomRightText',
  ]),
  // ADR-654 — standalone raster image (entourage / furniture-plan sprite). Ο τύπος που
  // έλειπε από ΟΛΟ αυτό το seam και γέννησε τη Φ10.
  image: flatFields('image', ['position', 'width', 'height', 'url', 'rotation']),
  // ADR-662 Φάση 2β (Δρόμος Γ) — thin/derived topo surface· το `footprint` τροφοδοτεί ΚΑΙ
  // το AABB (broad phase) ΚΑΙ το point-in-polygon containment (narrow phase). Χωρίς αυτό το
  // seam η επιφάνεια βγαίνει σιωπηλά εκτός spatial index (μηδέν hover/κλικ — ο Φ10 μηχανισμός).
  'topo-surface': flatFields('topo-surface', ['surfaceId', 'footprint']),
  // ADR-635 Φάση B — leader callout· τα `vertices` τροφοδοτούν ΚΑΙ το AABB (broad phase) ΚΑΙ
  // το point-to-segment narrow test (open path, όπως το polyline). Χωρίς αυτό ο leader βγαίνει
  // σιωπηλά εκτός spatial index (μηδέν hover/κλικ) — ο ίδιος Φ10 μηχανισμός με τα υπόλοιπα.
  leader: flatFields('leader', ['vertices', 'arrowHead', 'annotationText', 'annotationPosition', 'hookLineLength', 'hasHookLine']),
} as const satisfies Record<string, HitTestModelHandler>;
