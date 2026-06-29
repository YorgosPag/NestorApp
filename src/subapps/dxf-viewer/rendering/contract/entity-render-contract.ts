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
 * Ghost: ΔΕΝ μοντελοποιείται ακόμη εδώ — δεν υπάρχει introspectable live dispatcher
 * (2D per-family ghost renderers, 3D ενιαίο `placement-ghost-overlay`)· ένα μη-
 * ελεγχόμενο πεδίο θα σάπιζε. Μελλοντικό Φ όταν προκύψει bindable seam.
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
}

/** Συντομογραφίες κατασκευής (κρατούν το Record ευανάγνωστο + invariant-safe). */
const dxf = (type: RenderableEntityType): EntityRenderContract =>
  ({ type, d2: true, d3: false, d3Builder: 'none' });
const only2D = (type: RenderableEntityType): EntityRenderContract =>
  ({ type, d2: true, d3: false, d3Builder: 'none' });
const point = (type: RenderableEntityType): EntityRenderContract =>
  ({ type, d2: true, d3: true, d3Builder: 'point' });
const bespoke = (type: RenderableEntityType): EntityRenderContract =>
  ({ type, d2: true, d3: true, d3Builder: 'bespoke' });

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

  // ── BIM — bespoke 3D (cross-entity host context) ──
  wall: bespoke('wall'),
  opening: bespoke('opening'), // cutout/reveal μέσα στο wall group (syncWalls)
  slab: bespoke('slab'),
  'slab-opening': bespoke('slab-opening'), // pick-mesh στο κενό (syncSlabs, ADR-535 Φ3b)
  column: bespoke('column'),
  beam: bespoke('beam'),
  stair: bespoke('stair'),
  'mep-fixture': bespoke('mep-fixture'), // dual mesh-path + resolveFixtureBimCategory
  'mep-segment': bespoke('mep-segment'),
  'mep-fitting': bespoke('mep-fitting'),

  // ── BIM — point 3D (ομοιόμορφο, auto-wired) ──
  foundation: point('foundation'),
  railing: point('railing'),
  roof: point('roof'),
  'floor-finish': point('floor-finish'),
  furniture: point('furniture'),
  'electrical-panel': point('electrical-panel'),
  'mep-manifold': point('mep-manifold'),
  'mep-radiator': point('mep-radiator'),
  'mep-boiler': point('mep-boiler'),
  'mep-water-heater': point('mep-water-heater'),
  'mep-underfloor': point('mep-underfloor'),

  // ── BIM — σκόπιμα 2D-only ──
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

/** Render surfaces {d2,d3} ενός type (SSoT για το derived `ENTITY_RENDER_SURFACES`). */
export function surfacesOf(type: RenderableEntityType): { d2: boolean; d3: boolean } {
  const c = ENTITY_RENDER_CONTRACTS[type];
  return { d2: c.d2, d3: c.d3 };
}
