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
import type { TableEntity } from '../../../types/table-entity';
// ADR-739 Φ.Γ — ο πίνακας είναι ο ΜΟΝΟΣ τύπος του οποίου η «γεωμετρία» είναι δομημένο
// μοντέλο (αραιός χάρτης κελιών), όχι επίπεδα αριθμητικά πεδία — άρα το fixture του πρέπει
// να χτιστεί με τον κανονικό κατασκευαστή, αλλιώς τα `CellKey` θα ήταν άκυρα.
import { createTableModel, toPersistedTableModel } from '../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../../bim/table/table-style-presets';
import { tableWorksheetFields } from '../../../bim/table/__tests__/make-table-entity';

/** Ένα καθαρό, πεπερασμένο bbox — ό,τι παράγει κάθε `compute*Geometry()` για τα BIM. */
const BBOX = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 50, z: 30 } };
const GEOMETRY = { bbox: BBOX };
const SQUARE = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 },
];

/**
 * ADR-739 Φ.Δ — ο πίνακας του fixture, **ελεγμένος από τον compiler**.
 *
 * Τα υπόλοιπα fixtures είναι σκόπιμα άτυπα (`Record<string, unknown>`): κουβαλούν
 * γενναιόδωρα επίπεδα πεδία και κανένας τύπος δεν τα δένει. Ο πίνακας ΔΕΝ μπορεί να ζει
 * έτσι — το `model` του είναι δομημένο, και το επίπεδο `as unknown as EntityModel` της
 * {@link makeEntityModel} έκρυψε ακριβώς αυτό: το fixture κρατούσε `TableModel` (`Map`)
 * ενώ η οντότητα είχε γίνει `PersistedTableModel`. Το `satisfies` βάζει πίσω την πίεση
 * του compiler **μόνο** εκεί που χρειάζεται, χωρίς να τυποποιεί όλο τον χάρτη.
 *
 * 🔴 Τα κελιά είναι **γεμάτα επίτηδες**. Με μηδέν κελιά ο `Map` και η ακολουθία δείχνουν
 * ίδιοι σε κάθε round-trip — δηλαδή ο έλεγχος δεν αποδεικνύει τίποτα. Με κελιά, όποιος
 * ξαναβάλει `Map` στην οντότητα κοκκινίζει τα anchors την ίδια στιγμή.
 *
 * Στήλες `fixed` και ρητά ύψη γραμμών: έτσι η διάταξη δεν καλεί τον πραγματικό μετρητή
 * κειμένου (που δίνει άλλο πλάτος με/χωρίς φορτωμένη γραμματοσειρά) και τα bounds είναι
 * συγκρίσιμα σε κάθε περιβάλλον — τα κελιά **δεν** αλλάζουν τη γεωμετρία, μόνο το
 * περιεχόμενο που πρέπει να επιβιώσει.
 */
const TABLE_FIXTURE = {
  position: { x: 0, y: 0 },
  angleRad: 0,
  styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
  // 🔴 ADR-833 Φάση 2 — **φύλλα εργασίας**, όχι σκέτο μοντέλο. Το `entity-json-roundtrip-
  // coverage.test.ts` κάνει assert πάνω σε αυτό το δείγμα, οπότε αν εδώ έμενε η παλιά μορφή, ο
  // φρουρός θα δοκίμαζε σχήμα που η παραγωγή **δεν παράγει πια** — δηλαδή θα ήταν πράσινος πάνω
  // σε λάθος ερώτηση.
  ...tableWorksheetFields(toPersistedTableModel(
    createTableModel({
      columns: [
        { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
        { id: 'c2', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'number', align: 'right' },
      ],
      rows: [
        { id: 'r1', rowClass: 'header', heightMm: 8 },
        { id: 'r2', rowClass: 'data', heightMm: 8 },
      ],
      cells: [
        ['r1', 'c1', { kind: 'text', value: 'Στοιχείο' }],
        ['r1', 'c2', { kind: 'text', value: 'Ποσότητα' }],
        ['r2', 'c1', { kind: 'text', value: 'Δοκός Δ1' }],
        ['r2', 'c2', { kind: 'text', value: 12.5 }],
      ],
    }),
  )),
} satisfies Omit<TableEntity, 'id' | 'type' | 'layerId'>;

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
  // ADR-635 Φάση B — leader callout: open path vertices (tip → text) + tip arrowhead.
  leader: { vertices: SQUARE, arrowHead: { type: 'closed', size: 2.5 } },
  // ADR-739 Φ.Δ — γενικός πίνακας 2×2 με ΓΕΜΑΤΑ κελιά· βλ. {@link TABLE_FIXTURE}.
  table: TABLE_FIXTURE,
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
 *
 * ⚠️ Το `as unknown as EntityModel` **μένει** και δεν είναι αμέλεια: το `GEOMETRY_BY_TYPE`
 * είναι σκόπιμα ένας άτυπος χάρτης (ένα κλειδί ανά τύπο, γενναιόδωρα επίπεδα πεδία), οπότε
 * εδώ ο τύπος δεν μπορεί να προκύψει από το `type` — καμία διακρίνουσα ένωση δεν στενεύει
 * ένα `Record<string, unknown>`. Το κόστος του cast είναι ότι κρύβει λάθος **σχήμα** ανά
 * τύπο· γι' αυτό ο πίνακας — ο μόνος με δομημένο μοντέλο — δηλώνεται πλέον χωριστά και
 * ελέγχεται από τον compiler ({@link TABLE_FIXTURE}).
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
