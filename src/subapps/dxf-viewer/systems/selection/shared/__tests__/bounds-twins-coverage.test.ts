/**
 * Bounds-twins capability coverage (ADR-587 Φ5 — TIER-2 seam, Μηχανισμός 2: coverage + ρητό pin).
 *
 * Οι δύο bounds calculators είναι η **ΜΟΝΗ πραγματική διπλοεγγραφή** των TIER-2 seams — ΟΧΙ ΕΝΑ
 * switch σε δύο θέσεις, αλλά **δύο ΔΙΑΦΟΡΕΤΙΚΟΙ** per-type υπολογισμοί (§5.3):
 *  - Twin A `computeBounds` (`types/entity-bounds.ts`, entries `getEntityRenderBounds`/
 *    `getEntityExtentsBounds`) → `SpatialBounds {minX,minY,maxX,maxY}`, default **`EMPTY_SPATIAL_BOUNDS`
 *    (non-null zero box)**, με `forExtents` flag (xline/ray). BIM = raw `geometry.bbox`.
 *  - Twin B `calculateEntityBounds` (`selection-duplicate-utils.ts`) → `{min,max} | **null**`, χωρίς
 *    `forExtents`. BIM = `calculateBimEntity2DBounds`. text/dimension/ellipse/point via ξεχωριστά SSoT.
 *
 * **Φ9 = σταδιακό computational convergence σε ΕΝΑ core** (`resolveEntityBounds`), ένα slice τη φορά με
 * app-verify ανάμεσα (οι μεγάλοι ΕΠΙΣΗΣ δεν κάνουν big-bang σε geometry). Το test κρατά:
 *  1. Exhaustive/disjoint partition ΑΝΑ twin: κάθε renderable → handled ή fallback (ρητός λόγος).
 *     `handled ∪ fallback === RENDERABLE_ENTITY_TYPES` = ο completeness anchor (νέος τύπος → σπάει
 *     ΚΑΙ τα δύο partitions → συνειδητή απόφαση σε ΑΜΦΟΤΕΡΑ τα twins). Μετά τις Slices 1+2 και τα δύο
 *     fallback sets είναι **κενά** — κάθε renderable type έχει bounds.
 *  2. Live gain pins: οι τύποι που απέκτησαν bounds (B: `B_FIXED_IN_SLICE1`· A: `A_FIXED_IN_SLICE2` +
 *     arc/dimension/angle-measurement) → NON-EMPTY/NON-null. Πιάνει σιωπηλό regression σε delegate.
 *  3. Cross-twin asymmetry pins που ΕΠΙΒΙΩΝΟΥΝ του convergence: shape ({minX..} vs {min,max}), default
 *     (EMPTY vs null), BIM-math shape, forExtents (xline render±NOMINAL vs extents EMPTY).
 *
 * **ADR-587 Φ9 Slice 1 (2026-07-09):** το Twin B `calculateEntityBounds` έγινε thin adapter πάνω στον
 * canonical `resolveEntityBounds` (`rendering/hitTesting/entity-bounds-ssot.ts`). Οι 6 τύποι που γύριζαν
 * `null` (`annotation-symbol`, `railing`, `thermal-space`, `space-separator`, `wall-covering`) δίνουν
 * πλέον real bounds → marquee-selectable. `B_NULL_FALLBACK` = **κενό**.
 *
 * **ADR-587 Φ9 Slice 2 (2026-07-09):** και το Twin A `computeBounds` έγινε adapter πάνω στον ίδιο
 * `resolveEntityBounds`, ΜΕ **culling-specific overrides** (text/mtext = γενναιόδωρο em box ADR-557·
 * xline/ray = ±NOMINAL render + forExtents=EMPTY· ellipse = major/minor scene shape· point = degenerate).
 * Οι 10 τύποι που έπεφταν σε A-default → EMPTY (`arc`/`dimension`/`angle-measurement` + τα 7 BIM του
 * `A_FIXED_IN_SLICE2`) απέκτησαν bounds → σωστό culling/clip/array. `A_EMPTY_FALLBACK` = **κενό**.
 * Η ellipse ΜΕΝΕΙ στο A (ο resolver δρομολογεί ellipse→BoundsCalculator που διαβάζει radiusX/radiusY,
 * πεδία που το scene `EllipseEntity` δεν έχει → NaN)· reconcile στο Slice 3 (Twin C).
 */

// Firebase auth mock — τα type barrels (text-box/bim projections) αγγίζουν auth στο import path.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { getEntityRenderBounds, getEntityExtentsBounds } from '../../../../types/entity-bounds';
import { calculateEntityBounds } from '../selection-duplicate-utils';
import { RENDERABLE_ENTITY_TYPES } from '../../../../rendering/contract/renderable-entity-type';
import { ENTITY_BOUNDS_SUPPORTED_TYPES } from '../../../../rendering/hitTesting/entity-bounds-ssot';
import { EMPTY_SPATIAL_BOUNDS } from '../../../../config/geometry-constants';
import type { Entity } from '../../../../types/entities';
import type { AnySceneEntity } from '../../../../types/scene';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();
const mk = (type: string, extra: Record<string, unknown> = {}): Entity =>
  ({ id: `${type}_x`, layerId: 'L', type, ...extra }) as unknown as Entity;
const BBOX = { geometry: { bbox: { min: { x: 1, y: 2 }, max: { x: 3, y: 4 } } } };

// ─── Twin A `computeBounds` (getEntityRenderBounds) — SpatialBounds, EMPTY default ───
/**
 * Renderable types με bounds στο `computeBounds`. **Φ9 Slice 2:** το Twin A έγινε adapter πάνω στον
 * canonical `resolveEntityBounds` (+ culling-specific overrides text/mtext/xline/ray/ellipse/point),
 * άρα ΟΛΑ τα renderable types έχουν πλέον bounds — όπως το Twin B. Οι 10 τύποι που πριν έπεφταν στο
 * A-default → EMPTY (arc/dimension/angle-measurement + 7 BIM) απέκτησαν bounds (βλ. `A_FIXED_IN_SLICE2`).
 */
const A_HANDLED = [
  // DXF (19 — ΟΛΑ, incl. arc/dimension/angle-measurement που ήταν EMPTY πριν τη Φ9 Slice 2)
  'line', 'polyline', 'lwpolyline', 'circle', 'arc', 'ellipse', 'rectangle', 'rect', 'point',
  'annotation-symbol', 'scale-bar', 'text', 'mtext', 'spline', 'hatch', 'xline', 'ray',
  'dimension', 'angle-measurement',
  // BIM via resolver `calculateBimEntity2DBounds` (24 — incl. railing/wall-covering/thermal-space/
  // space-separator/mep-boiler/mep-water-heater/mep-underfloor, Φ9 Slice 2 GAIN)
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'foundation', 'stair', 'roof',
  'floor-finish', 'furniture', 'mep-fixture', 'electrical-panel', 'mep-manifold', 'mep-radiator',
  'mep-segment', 'mep-fitting', 'railing', 'wall-covering', 'thermal-space', 'space-separator',
  'mep-boiler', 'mep-water-heater', 'mep-underfloor',
] as const;
/**
 * Renderable types που πέφτουν στο A-default → `EMPTY_SPATIAL_BOUNDS`. **ΚΕΝΟ μετά τη Φ9 Slice 2** —
 * κάθε renderable type έχει πλέον bounds (resolver provider ή culling override), όπως το Twin B.
 */
const A_EMPTY_FALLBACK = [] as const;
/**
 * Οι 10 τύποι που η Φ9 Slice 2 γύρισε από `EMPTY` (A-default) → real bounds (convergence πάνω στον
 * resolver). arc/dimension/angle-measurement = DXF providers· τα 7 BIM = `geometry.bbox` footprint.
 */
const A_FIXED_IN_SLICE2 = [
  'railing', 'wall-covering', 'thermal-space', 'space-separator',
  'mep-boiler', 'mep-water-heater', 'mep-underfloor',
] as const;

// ─── Twin B `calculateEntityBounds` — {min,max} | null (Φ9 Slice 1: adapter πάνω στο resolveEntityBounds) ─
/** Renderable types με ρητό non-null bounds στο `calculateEntityBounds` (= ΟΛΑ μετά τη Φ9 Slice 1). */
const B_HANDLED = [
  // DXF (19 — ΟΛΑ, incl. annotation-symbol που ήταν null πριν τη Φ9 Slice 1)
  'line', 'polyline', 'lwpolyline', 'circle', 'arc', 'ellipse', 'text', 'mtext', 'spline',
  'rectangle', 'rect', 'point', 'dimension', 'angle-measurement', 'hatch', 'xline', 'ray',
  'annotation-symbol', 'scale-bar',
  // BIM via calculateBimEntity2DBounds (24 — incl. railing/thermal-space/space-separator, Φ9 routing fix)
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'foundation', 'stair', 'roof',
  'floor-finish', 'wall-covering', 'furniture', 'mep-fixture', 'electrical-panel', 'mep-manifold',
  'mep-radiator', 'mep-boiler', 'mep-water-heater', 'mep-segment', 'mep-fitting', 'mep-underfloor',
  'railing', 'thermal-space', 'space-separator',
] as const;
/**
 * Renderable types που πέφτουν στο B → `null`. **ΚΕΝΟ μετά τη Φ9 Slice 1** — κάθε renderable type έχει
 * πλέον bounds provider (`resolveEntityBounds`), άρα το window/crossing marquee πιάνει ΟΛΩΝ των ειδών.
 */
const B_NULL_FALLBACK = [] as const;
/** Οι 5 τύποι που η Φ9 Slice 1 γύρισε από `null` → real bounds (το wall-covering ήταν κρυμμένο B_HANDLED). */
const B_FIXED_IN_SLICE1 = [
  'annotation-symbol', 'railing', 'thermal-space', 'space-separator', 'wall-covering',
] as const;

describe('Bounds-twins coverage — δύο twins ↔ descriptor domain (ADR-587 Φ5, coverage+pin)', () => {
  it('Twin A: HANDLED ∪ EMPTY-fallback = RENDERABLE_ENTITY_TYPES (exhaustive + disjoint)', () => {
    const partition = [...A_HANDLED, ...A_EMPTY_FALLBACK];
    expect(new Set(partition).size).toBe(partition.length); // disjoint
    expect(asSorted(partition)).toEqual(asSorted([...RENDERABLE_ENTITY_TYPES])); // exhaustive
  });

  it('Twin B: HANDLED ∪ null-fallback = RENDERABLE_ENTITY_TYPES (exhaustive + disjoint)', () => {
    const partition = [...B_HANDLED, ...B_NULL_FALLBACK];
    expect(new Set(partition).size).toBe(partition.length);
    expect(asSorted(partition)).toEqual(asSorted([...RENDERABLE_ENTITY_TYPES]));
  });

  it('Twin A: A_EMPTY_FALLBACK είναι ΚΕΝΟ μετά τη Φ9 Slice 2 (κανένας renderable δεν πέφτει σε A-default)', () => {
    expect(A_EMPTY_FALLBACK).toHaveLength(0);
  });

  it.each(A_FIXED_IN_SLICE2)('Φ9 Slice 2 gain: BIM "%s" (geometry.bbox) → NON-EMPTY στο Twin A (ήταν EMPTY)', (type) => {
    // Πριν τη Slice 2 τα 7 αυτά BIM δεν ήταν enumerated → A-default αγνοούσε το bbox → EMPTY (culled).
    // Τώρα delegate στον resolver (`calculateBimEntity2DBounds`) → real footprint bounds.
    expect(getEntityRenderBounds(mk(type, BBOX))).not.toEqual(EMPTY_SPATIAL_BOUNDS);
  });

  it('Φ9 Slice 2 gain: arc converged — Twin A = resolver center±radius (ήταν EMPTY)', () => {
    const arc = mk('arc', { center: { x: 100, y: 50 }, radius: 40 });
    expect(getEntityRenderBounds(arc)).toEqual({ minX: 60, minY: 10, maxX: 140, maxY: 90 });
  });

  it('Φ9 Slice 2 gain: angle-measurement converged — Twin A = AABB(vertex,point1,point2) (ήταν EMPTY)', () => {
    const am = mk('angle-measurement', { vertex: { x: 0, y: 0 }, point1: { x: 5, y: 0 }, point2: { x: 0, y: 5 } });
    expect(getEntityRenderBounds(am)).toEqual({ minX: 0, minY: 0, maxX: 5, maxY: 5 });
  });

  it('Φ9 Slice 2 gain: dimension converged — Twin A NON-EMPTY από defPoints (ήταν EMPTY)', () => {
    const dim = mk('dimension', { defPoints: [{ x: 0, y: 0 }, { x: 10, y: 5 }] });
    expect(getEntityRenderBounds(dim)).not.toEqual(EMPTY_SPATIAL_BOUNDS);
  });

  it('Twin B: B_NULL_FALLBACK είναι ΚΕΝΟ μετά τη Φ9 Slice 1 (κανένας renderable δεν γυρίζει null)', () => {
    expect(B_NULL_FALLBACK).toHaveLength(0);
  });

  it.each(B_FIXED_IN_SLICE1)('Φ9 Slice 1 gap-fix: "%s" → NON-null (ήταν null στο Twin B, τώρα marquee-selectable)', (type) => {
    // annotation-symbol → C (BoundsCalculator, position-based)· railing/thermal-space/space-separator/
    // wall-covering → calculateBimEntity2DBounds (geometry.bbox). ΕΝΑ fixture καλύπτει και τα δύο paths.
    const bounds = calculateEntityBounds(
      mk(type, { ...BBOX, position: { x: 0, y: 0 } }) as unknown as AnySceneEntity,
    );
    expect(bounds).not.toBeNull();
  });

  it('provider completeness: ENTITY_BOUNDS_SUPPORTED_TYPES ⊇ RENDERABLE_ENTITY_TYPES', () => {
    // Κάθε renderable type ΠΡΕΠΕΙ να έχει bounds provider (αλλιώς σιωπηλά μη-marquee-selectable).
    const supported = new Set<string>(ENTITY_BOUNDS_SUPPORTED_TYPES);
    const missing = RENDERABLE_ENTITY_TYPES.filter((t) => !supported.has(t));
    expect(missing).toEqual([]);
    // Deliberate extra (ΟΧΙ σε RENDERABLE_ENTITY_TYPES): `floorplan-symbol` αποδίδεται μέσω entity-model
    // path (ADR-583/Φ2b surfaced asymmetry) αλλά το Twin B το δρομολογούσε → κρατιέται για parity.
    expect(supported.has('floorplan-symbol')).toBe(true);
  });

  it('asymmetry — SHAPE: ίδιο line, A→{minX..maxY}, B→{min,max}', () => {
    const line = { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } };
    expect(getEntityRenderBounds(mk('line', line))).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    expect(calculateEntityBounds(mk('line', line) as unknown as AnySceneEntity))
      .toEqual({ min: { x: 0, y: 0 }, max: { x: 10, y: 10 } });
  });

  it('asymmetry — DEFAULT: άγνωστος τύπος, A→EMPTY_SPATIAL_BOUNDS (non-null), B→null', () => {
    expect(getEntityRenderBounds(mk('totally-unknown'))).toEqual(EMPTY_SPATIAL_BOUNDS);
    expect(calculateEntityBounds(mk('totally-unknown') as unknown as AnySceneEntity)).toBeNull();
  });

  it('convergence — arc: Twin A & B συμφωνούν center±radius (Φ9 Slice 2 έκλεισε το domain flip· shape διαφέρει)', () => {
    const arc = mk('arc', { center: { x: 100, y: 50 }, radius: 40 });
    expect(getEntityRenderBounds(arc)).toEqual({ minX: 60, minY: 10, maxX: 140, maxY: 90 }); // A: converged (ήταν EMPTY)
    expect(calculateEntityBounds(arc as unknown as AnySceneEntity)) // B: {min,max}
      .toEqual({ min: { x: 60, y: 10 }, max: { x: 140, y: 90 } });
    // annotation-symbol handled ΚΑΙ στα δύο (Φ9 Slice 1 στο B· delegate → C στο A).
    expect(calculateEntityBounds(mk('annotation-symbol', { position: { x: 0, y: 0 } }) as unknown as AnySceneEntity))
      .not.toBeNull();
  });

  it('asymmetry — BIM math/shape: wall από ΙΔΙΟ geometry.bbox, A raw {minX..}, B {min,max}', () => {
    const wall = mk('wall', { geometry: { bbox: { min: { x: 5, y: 6 }, max: { x: 15, y: 16 } } } });
    expect(getEntityRenderBounds(wall)).toEqual({ minX: 5, minY: 6, maxX: 15, maxY: 16 });
    expect(calculateEntityBounds(wall as unknown as AnySceneEntity))
      .toEqual({ min: { x: 5, y: 6 }, max: { x: 15, y: 16 } });
  });

  it('asymmetry — forExtents (Twin A internal): xline render ±NOMINAL vs extents EMPTY', () => {
    const xline = mk('xline', { basePoint: { x: 0, y: 0 } });
    expect(getEntityRenderBounds(xline)).not.toEqual(EMPTY_SPATIAL_BOUNDS); // culling: appears across viewport
    expect(getEntityExtentsBounds(xline)).toEqual(EMPTY_SPATIAL_BOUNDS);    // zoom: infinite line must not affect
  });
});
