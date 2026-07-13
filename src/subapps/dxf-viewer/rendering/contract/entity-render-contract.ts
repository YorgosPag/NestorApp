/**
 * Entity Render Contract Registry — ΕΝΑ canonical registration object ανά
 * renderable entity type (ADR-550 Φ2). Single source of truth για το «πώς
 * αποδίδεται η οντότητα» σε όλα τα backends:
 *   - `d2` : έχει 2D renderer στο `EntityRendererComposite`.
 *   - `d3` : παράγει 3D geometry μέσω `BimSceneLayer`.
 *   - `d3Builder` : ΠΩΣ χτίζεται το 3D —
 *       'point'   → ομοιόμορφο point-entity (auto-wired μέσω `POINT_ENTITY_CONTRACTS`
 *                    στο `bim-3d/scene/bim-scene-point-contracts.ts`).
 *       'bespoke' → χειροκίνητο sync με cross-entity host context (walls/columns/
 *                    beams/slabs/stairs/openings/mep-segments/fittings/fixtures).
 *       'none'    → κανένα standalone 3D solid (DXF primitives + ρητά 2D-only BIM).
 *
 * Γιατί ΟΧΙ ενιαία εκτελέσιμη `build3D(entity)`: η 3D πλευρά είναι ετερογενής
 * (host-join resolution σε batch) — όπως στο Revit το regen ΔΕΝ εκτίθεται
 * per-element, και στο AutoCAD το `worldDraw` είναι per-element αλλά δεν ενοποιεί
 * backends. Άρα contract = ΕΝΑ data model + ΕΝΑ geometry + δηλωτικό μητρώο που
 * δείχνει ΠΟΙΟΣ dispatcher κατέχει κάθε surface — ΟΧΙ wrapper που ξαναγράφει το
 * dispatch (adapter, όχι rewrite).
 *
 * Το `Record<RenderableEntityType, …>` εγγυάται completeness σε compile-time: νέος
 * renderable type χωρίς εγγραφή εδώ → σπάει το tsc. Το coverage test
 * (`__tests__/entity-render-coverage.test.ts`) δένει το μητρώο με τα ΖΩΝΤΑΝΑ
 * dispatchers + το executable point registry, ώστε να μην μπορεί να αποκλίνει.
 *
 * Ghost (Φ-Ghost): το `placementGhost3D` δηλώνει αν ο type έχει 3D φάντασμα
 * τοποθέτησης. Δένεται με το ΖΩΝΤΑΝΟ type-keyed registry
 * `PLACEMENT_GHOST_3D_FACTORIES` (`bim-3d/placement/placement-ghost-3d-contracts.ts`,
 * 11 per-family ghost classes) μέσω του coverage test — όπως το `d3Builder` με το
 * point registry. Το **2D ghost** δεν μοντελοποιείται: το 2D preview dispatch είναι
 * triply-scattered (generator if-chain + wysiwyg-BIM + bespoke Canvas2D renderers)
 * χωρίς introspectable seam· ένα 2D πεδίο θα «σάπιζε».
 *
 * @see ADR-549 (census) · ADR-550 (Unified Entity Render Contract)
 * @see entity-render-surfaces.ts — derived {d2,d3} view (back-compat)
 */

import {
  RENDERABLE_ENTITY_TYPES,
  type RenderableEntityType,
} from './renderable-entity-type';

/** Πώς χτίζεται το 3D solid μιας οντότητας. */
export type D3BuilderKind = 'point' | 'bespoke' | 'none';

export interface EntityRenderContract {
  readonly type: RenderableEntityType;
  /** Αποδίδεται στον 2D καμβά μέσω `EntityRendererComposite`. */
  readonly d2: boolean;
  /** Παράγει 3D mesh/object μέσω `BimSceneLayer`. */
  readonly d3: boolean;
  /** Ο μηχανισμός 3D build. Invariant: `d3Builder !== 'none'` ⟺ `d3 === true`. */
  readonly d3Builder: D3BuilderKind;
  /**
   * Έχει 3D φάντασμα τοποθέτησης (per-family `*PlacementGhost`, δεμένο στο ζωντανό
   * `PLACEMENT_GHOST_3D_FACTORIES`). Invariant: `placementGhost3D` ⟹ `d3`.
   */
  readonly placementGhost3D: boolean;
}

/** Συντομογραφίες κατασκευής (κρατούν το Record ευανάγνωστο + invariant-safe). */
const dxf = (type: RenderableEntityType): EntityRenderContract =>
  ({ type, d2: true, d3: false, d3Builder: 'none', placementGhost3D: false });
const only2D = (type: RenderableEntityType): EntityRenderContract =>
  ({ type, d2: true, d3: false, d3Builder: 'none', placementGhost3D: false });
const point = (type: RenderableEntityType, ghost3D = false): EntityRenderContract =>
  ({ type, d2: true, d3: true, d3Builder: 'point', placementGhost3D: ghost3D });
const bespoke = (type: RenderableEntityType, ghost3D = false): EntityRenderContract =>
  ({ type, d2: true, d3: true, d3Builder: 'bespoke', placementGhost3D: ghost3D });

/**
 * Το μητρώο. DXF primitives = 2D-only. BIM = 2D + 3D εκτός των ρητά 2D-only.
 * Το 3D κάθε BIM type είναι είτε `point` (ομοιόμορφο) είτε `bespoke` (host context).
 */
export const ENTITY_RENDER_CONTRACTS: Readonly<
  Record<RenderableEntityType, EntityRenderContract>
> = {
  // ── DXF primitives (2D canvas only) ──
  line: dxf('line'),
  polyline: dxf('polyline'),
  lwpolyline: dxf('lwpolyline'),
  circle: dxf('circle'),
  arc: dxf('arc'),
  ellipse: dxf('ellipse'),
  text: dxf('text'),
  mtext: dxf('mtext'),
  spline: dxf('spline'),
  rectangle: dxf('rectangle'),
  rect: dxf('rect'),
  point: dxf('point'),
  dimension: dxf('dimension'),
  'angle-measurement': dxf('angle-measurement'),
  hatch: dxf('hatch'),
  xline: dxf('xline'),
  ray: dxf('ray'),
  // ADR-583 — annotation symbol (North arrow): lightweight non-BIM paper decoration,
  // 2D canvas only (no per-type 3D mesh).
  'annotation-symbol': dxf('annotation-symbol'),
  // ADR-583 Φ2 — graphic scale-bar: dedicated non-BIM annotation, 2D canvas only.
  'scale-bar': dxf('scale-bar'),
  // ADR-612 — opening info tag: dedicated non-BIM annotation, 2D canvas only.
  'opening-info-tag': dxf('opening-info-tag'),
  // ADR-651 Φάση Ε — standalone raster image, 2D canvas only (no per-type 3D mesh).
  image: dxf('image'),

  // ── BIM — bespoke 3D (cross-entity host context) ──
  wall: bespoke('wall', true), // 3D placement ghost: WallPlacementGhost
  opening: bespoke('opening'), // cutout/reveal μέσα στο wall group (syncWalls)
  slab: bespoke('slab'),
  'slab-opening': bespoke('slab-opening'), // pick-mesh στο κενό (syncSlabs, ADR-535 Φ3b)
  column: bespoke('column', true), // 3D placement ghost: ColumnPlacementGhost
  beam: bespoke('beam', true), // 3D placement ghost: BeamFromWallGhost
  stair: bespoke('stair'),
  'mep-fixture': bespoke('mep-fixture', true), // dual mesh-path + resolveFixtureBimCategory · ghost: MepFixturePlacementGhost
  'mep-segment': bespoke('mep-segment', true), // 3D placement ghost: MepSegmentPlacementGhost
  'mep-fitting': bespoke('mep-fitting'),

  // ── BIM — point 3D (ομοιόμορφο, auto-wired) ──
  foundation: point('foundation'),
  railing: point('railing'),
  roof: point('roof'),
  'floor-finish': point('floor-finish'),
  furniture: point('furniture', true), // 3D placement ghost: FurniturePlacementGhost
  'electrical-panel': point('electrical-panel', true), // ghost: ElectricalPanelPlacementGhost
  'mep-manifold': point('mep-manifold', true), // ghost: MepManifoldPlacementGhost
  'mep-radiator': point('mep-radiator', true), // ghost: MepRadiatorPlacementGhost
  'mep-boiler': point('mep-boiler', true), // ghost: MepBoilerPlacementGhost
  'mep-water-heater': point('mep-water-heater', true), // ghost: MepWaterHeaterPlacementGhost
  'mep-underfloor': point('mep-underfloor'),

  // ── BIM — σκόπιμα 2D-only ──
  'floorplan-symbol': only2D('floorplan-symbol'), // ADR-415 — pure-vector 2D σύμβολο κάτοψης (καμία 3D mesh)
  'wall-covering': only2D('wall-covering'), // ADR-511 — λεπτή επίστρωση παρειάς
  'thermal-space': only2D('thermal-space'), // ADR-422 — αναλυτικό IfcSpace
  'space-separator': only2D('space-separator'), // ADR-437 — IfcVirtualElement
};

/** Renderable types με `d3Builder: 'point'` (auto-wired point-entity 3D). */
export const POINT_BUILT_TYPES: readonly RenderableEntityType[] =
  RENDERABLE_ENTITY_TYPES.filter((t) => ENTITY_RENDER_CONTRACTS[t].d3Builder === 'point');

/** Renderable types με `d3Builder: 'bespoke'` (χειροκίνητο host-context sync). */
export const BESPOKE_BUILT_TYPES: readonly RenderableEntityType[] =
  RENDERABLE_ENTITY_TYPES.filter((t) => ENTITY_RENDER_CONTRACTS[t].d3Builder === 'bespoke');

/** Renderable types με 3D placement ghost (δένονται με `PLACEMENT_GHOST_3D_TYPES`). */
export const GHOST_BUILT_TYPES: readonly RenderableEntityType[] =
  RENDERABLE_ENTITY_TYPES.filter((t) => ENTITY_RENDER_CONTRACTS[t].placementGhost3D);

/** Render surfaces {d2,d3} ενός type (SSoT για το derived `ENTITY_RENDER_SURFACES`). */
export function surfacesOf(type: RenderableEntityType): { d2: boolean; d3: boolean } {
  const c = ENTITY_RENDER_CONTRACTS[type];
  return { d2: c.d2, d3: c.d3 };
}
