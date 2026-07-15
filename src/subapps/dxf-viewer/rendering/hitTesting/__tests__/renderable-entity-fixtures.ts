/**
 * ADR-587 Φ10 — ΕΝΑ minimal fixture ανά renderable entity type (κοινό σε όλα τα coverage
 * tests της Φ10 → κανένας κλώνος, N.18).
 *
 * Δύο σχήματα, γιατί το pipeline έχει δύο στάδια:
 *   - {@link makeEntityModel} — **post-conversion** (flat) σχήμα· το domain του
 *     `BoundsCalculator` (Twin C).
 *   - {@link makeSceneEntity} — **scene** (`DxfEntityUnion`) σχήμα· ό,τι κρατά πραγματικά η
 *     σκηνή. Πέντε τύποι έρχονται ΤΥΛΙΓΜΕΝΟΙ από τον `useDxfSceneConversion`
 *     (`DxfSlab.slabEntity` κ.λπ.) — αν τα fixtures τα έγραφαν flat, τα tests θα «περνούσαν»
 *     ενώ η πραγματική σκηνή θα έσπαγε.
 *
 * Τα fixtures είναι σκόπιμα ΓΕΝΝΑΙΟΔΩΡΑ (κουβαλούν όλα τα γεωμετρικά πεδία που μπορεί να
 * ζητήσει ένας τύπος): το ζητούμενο δεν είναι να μοντελοποιήσουν πιστά κάθε οντότητα, αλλά
 * να απαντήσουν σε ΕΝΑ ερώτημα — «αυτός ο τύπος παράγει bounds, ή εξαφανίζεται σιωπηλά;».
 */

import type { EntityModel } from '../../types/Types';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

/** Ένα καθαρό, πεπερασμένο bbox — ό,τι παράγει κάθε `compute*Geometry()` για τα BIM. */
const BBOX = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 50, z: 30 } };
const GEOMETRY = { bbox: BBOX };
const SQUARE = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 },
];

/** Τα γεωμετρικά πεδία που ζητά ΚΑΘΕ τύπος από τον `BoundsCalculator`. */
const GEOMETRY_BY_TYPE: Readonly<Record<string, Record<string, unknown>>> = {
  line: { start: { x: 0, y: 0 }, end: { x: 100, y: 50 } },
  circle: { center: { x: 50, y: 25 }, radius: 25 },
  arc: { center: { x: 50, y: 25 }, radius: 25, startAngle: 0, endAngle: Math.PI },
  polyline: { vertices: SQUARE, closed: true },
  lwpolyline: { vertices: SQUARE, closed: true },
  rectangle: { vertices: SQUARE },
  rect: { vertices: SQUARE },
  ellipse: { center: { x: 50, y: 25 }, radiusX: 50, radiusY: 25 },
  spline: { controlPoints: SQUARE },
  point: { position: { x: 50, y: 25 } },
  text: { position: { x: 0, y: 0 }, text: 'ΑΒΓ', height: 2.5, rotation: 0 },
  mtext: { position: { x: 0, y: 0 }, text: 'ΑΒΓ', height: 2.5, rotation: 0 },
  dimension: {
    defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    textMidpoint: { x: 50, y: 10 },
  },
  'angle-measurement': {
    vertex: { x: 0, y: 0 }, point1: { x: 100, y: 0 }, point2: { x: 0, y: 100 }, angle: 90,
  },
  hatch: { boundaryPaths: [SQUARE] },
  xline: { basePoint: { x: 0, y: 0 }, direction: { x: 1, y: 1 } },
  ray: { basePoint: { x: 0, y: 0 }, direction: { x: 1, y: 1 } },
  // Annotation family — flat paper-space params (κανένα geometry cache).
  'annotation-symbol': { position: { x: 0, y: 0 }, kind: 'north-arrow', symbolId: 'n1', sizeMm: 12, rotation: 0 },
  'scale-bar': {
    position: { x: 0, y: 0 }, angleRad: 0, length: 10, unit: 'm', divisions: 4,
    subdivisions: 0, style: 'alternating', barHeightMm: 4, labelHeightMm: 2.5,
    labelPlacement: 'below',
  },
  'opening-info-tag': {
    position: { x: 0, y: 0 }, angleRad: 0, widthMm: 900,
    topText: '1', bottomLeftText: '90', bottomRightText: '220',
  },
  // ADR-654 — η εικόνα: flat rectangle + rotation, χωρίς geometry cache.
  image: { position: { x: 0, y: 0 }, width: 100, height: 50, url: 'blob:x', rotation: 0 },
  // ADR-662 Φάση 2β (Δρόμος Γ) — thin/derived topo surface: surfaceId + footprint rings (world-2D).
  'topo-surface': { surfaceId: 'existing', footprint: [SQUARE] },
};

/** Τα BIM entities δίνουν bounds μέσω του pre-computed `geometry.bbox` — ένα κοινό fixture. */
const BIM_FIXTURE: Record<string, unknown> = {
  kind: 'straight',
  params: { outline: { vertices: SQUARE }, footprint: { vertices: SQUARE } },
  geometry: GEOMETRY,
  validation: { ok: true },
};

/**
 * Οι τύποι που ο canvas converter ΤΥΛΙΓΕΙ πριν τους βάλει στη σκηνή. Το `convertDxfEntity
 * ToEntityModel` πρέπει να τους ΞΕΤΥΛΙΞΕΙ — αλλιώς το top level δεν έχει geometry/params
 * και ο `BoundsCalculator` γυρίζει null (ADR-363 Bug 1: το opening «χανόταν» πάντα).
 */
const WRAPPER_KEY: Readonly<Record<string, string>> = {
  opening: 'openingEntity',
  slab: 'slabEntity',
  'slab-opening': 'slabOpeningEntity',
  dimension: 'dimensionEntity',
  xline: 'xlineEntity',
  ray: 'rayEntity',
};

/** Τα κοινά πεδία κάθε entity (id / layer / ορατότητα). */
function baseFields(type: string): Record<string, unknown> {
  return { id: `${type}_fixture`, type, layerId: 'lyr_test', visible: true };
}

/**
 * Post-conversion (flat) fixture — το domain του `BoundsCalculator`. Άγνωστος τύπος →
 * μόνο τα base πεδία (ακριβώς ό,τι έβλεπε ο calculator πριν τη Φ10 όταν το seam τον ξεχνούσε).
 */
export function makeEntityModel(type: string): EntityModel {
  const geometry = GEOMETRY_BY_TYPE[type] ?? BIM_FIXTURE;
  return { ...baseFields(type), ...geometry } as unknown as EntityModel;
}

/**
 * Scene (`DxfEntityUnion`) fixture — ό,τι κρατά πραγματικά η σκηνή, ΜΕ το wrapper όπου ο
 * canvas converter τυλίγει. Τροφοδοτεί το `convertDxfEntityToEntityModel`.
 */
export function makeSceneEntity(type: string): DxfEntityUnion {
  const inner = makeEntityModel(type) as unknown as Record<string, unknown>;
  const wrapperKey = WRAPPER_KEY[type];
  if (!wrapperKey) return inner as unknown as DxfEntityUnion;
  return { ...baseFields(type), [wrapperKey]: inner } as unknown as DxfEntityUnion;
}
