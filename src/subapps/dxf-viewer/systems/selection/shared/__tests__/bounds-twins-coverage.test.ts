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
 * **ΔΕΝ κάνουμε computational merge** (=behavior change=regression σε culling/zoom/marquee· οι μεγάλοι
 * ΕΠΙΣΗΣ δεν κάνουν big-bang σε geometry). Η υπολογιστική σύγκλιση σε ΕΝΑ core = χωριστό **verified**
 * βήμα (app-verify). Εδώ Φ5 = **coverage binding + ρητό pin των ασυμμετριών** (shape/default/domain):
 *  1. Exhaustive/disjoint partition ΑΝΑ twin: κάθε renderable → handled ή fallback (ρητός λόγος).
 *     `handled ∪ fallback === RENDERABLE_ENTITY_TYPES` = ο completeness anchor (νέος τύπος → σπάει
 *     ΚΑΙ τα δύο partitions → συνειδητή απόφαση σε ΑΜΦΟΤΕΡΑ τα twins).
 *  2. Live fallback pins: όλο το A-EMPTY set → `EMPTY_SPATIAL_BOUNDS`, όλο το B-NULL set → `null`
 *     (ασφαλές — κανένα fallback δεν φτάνει σε text/annotation projection). Πιάνει σιωπηλό regression.
 *  3. Cross-twin asymmetry pins: shape, default, arc/annotation-symbol domain flip, BIM-math shape,
 *     forExtents (xline render±NOMINAL vs extents EMPTY).
 *
 * Καρφωμένες ασυμμετρίες (ΜΗΝ τις «διορθώσεις» σιωπηλά — convergence = χωριστό verified βήμα):
 *  - `arc`/`dimension`/`angle-measurement` = handled στο B, **EMPTY στο A** (κανένα case → default,
 *    το A-default απαιτεί top-level `vertices`).
 *  - `annotation-symbol` = handled στο A (model-size square)· **ΗΤΑΝ null στο B** — ΔΙΟΡΘΩΘΗΚΕ στη Φ9.
 *  - 7 BIM `railing`/`wall-covering`/`thermal-space`/`space-separator`/`mep-boiler`/`mep-water-heater`/
 *    `mep-underfloor` = **EMPTY στο A** (μη enumerated → default αγνοεί το `geometry.bbox`)· όλα πλέον
 *    handled στο B (Φ9 Slice 1 έκλεισε railing/thermal-space/space-separator routing + wall-covering delegate).
 *
 * **ADR-587 Φ9 Slice 1 (2026-07-09):** το Twin B `calculateEntityBounds` έγινε thin adapter πάνω στον
 * canonical `resolveEntityBounds` (`rendering/hitTesting/entity-bounds-ssot.ts`). Οι 6 τύποι που γύριζαν
 * `null` (`annotation-symbol`, `railing`, `thermal-space`, `space-separator`, `wall-covering` [+ το
 * κρυμμένο πίσω από αισιόδοξη `B_HANDLED` κατάταξη]) δίνουν πλέον real bounds → επιλέξιμοι με window/
 * crossing marquee. `B_NULL_FALLBACK` = **κενό**. NEW: non-null assertion για τους 5 fixed + provider
 * completeness (`ENTITY_BOUNDS_SUPPORTED_TYPES ⊇ RENDERABLE_ENTITY_TYPES`). Twin A παραμένει ανέγγιχτο
 * (A/C convergence = επόμενα app-verify slices).
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
/** Renderable types με ρητό non-EMPTY case στο `computeBounds`. */
const A_HANDLED = [
  // DXF (16)
  'line', 'polyline', 'lwpolyline', 'circle', 'ellipse', 'rectangle', 'rect', 'point',
  'annotation-symbol', 'scale-bar', 'text', 'mtext', 'spline', 'hatch', 'xline', 'ray',
  // BIM με enumerated `geometry.bbox` case (17)
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'foundation', 'stair', 'roof',
  'floor-finish', 'furniture', 'mep-fixture', 'electrical-panel', 'mep-manifold', 'mep-radiator',
  'mep-segment', 'mep-fitting',
] as const;
/** Renderable types που πέφτουν στο A-default → `EMPTY_SPATIAL_BOUNDS` (μη enumerated). */
const A_EMPTY_FALLBACK = [
  'arc', 'dimension', 'angle-measurement', // DXF: κανένα case, default απαιτεί top-level vertices
  'railing', 'wall-covering', 'thermal-space', 'space-separator', // BIM: μη enumerated → αγνοεί bbox
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

  it.each(A_EMPTY_FALLBACK)('Twin A fallback πιν: "%s" (ακόμη & με geometry.bbox) → EMPTY_SPATIAL_BOUNDS', (type) => {
    // Το bbox περνιέται σκόπιμα: αποδεικνύει ότι το A-default το ΑΓΝΟΕΙ (γνήσιο gap, ΟΧΙ merge).
    expect(getEntityRenderBounds(mk(type, BBOX))).toEqual(EMPTY_SPATIAL_BOUNDS);
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

  it('asymmetry — DOMAIN flip: arc → A EMPTY / B center±radius (annotation-symbol πλέον handled ΚΑΙ στα δύο)', () => {
    const arc = mk('arc', { center: { x: 100, y: 50 }, radius: 40 });
    expect(getEntityRenderBounds(arc)).toEqual(EMPTY_SPATIAL_BOUNDS); // A: κανένα case
    expect(calculateEntityBounds(arc as unknown as AnySceneEntity)) // B: explicit
      .toEqual({ min: { x: 60, y: 10 }, max: { x: 140, y: 90 } });
    // Φ9 Slice 1: annotation-symbol handled στο A (model-size square) ΚΑΙ στο B (→ C, ΗΤΑΝ null).
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
