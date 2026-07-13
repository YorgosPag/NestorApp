/**
 * Move capability coverage (ADR-587 Φ5 — TIER-2 seam, Μηχανισμός 2: runtime-fixture coverage).
 *
 * Το ζωντανό move dispatch (`calculateMovedGeometry`) είναι **guard-based if-chain** (CAD μισό)
 * που delegate-άρει σε `calculateBimMovedGeometry` **switch** (BIM μισό, `default: return null` →
 * δέχεται ΟΛΟ το Entity union, άρα ΔΕΝ μπορεί να πάρει `never` exhaustiveness). Καμία από τις δύο
 * πλευρές δεν είναι introspectable (καμία `Object.keys`) → μετατροπή σε Record = επικίνδυνη μηχανική
 * + όχι big-player-faithful (handoff/§5.3, ίδιος συλλογισμός με το `toEntityModel` seam). Άρα δένουμε
 * το ζωντανό dispatch στο descriptor domain (`RENDERABLE_ENTITY_TYPES`) μέσω **runtime-fixture
 * coverage** — μηδέν source mutation — mirror του `rotate-entity-coverage`:
 *  1. Exhaustive/disjoint golden partition: κάθε renderable τύπος → MOVES ή NO-OP (ρητός λόγος).
 *     Το `union === RENDERABLE_ENTITY_TYPES` = ο completeness anchor (νέος τύπος → σπάει).
 *  2. Live no-op pins: ΟΛΟ το NO-OP set εκτελείται μέσω `calculateMovedGeometry` → `{}`. Ασφαλές
 *     γιατί κανένας no-op τύπος δεν φτάνει σε `compute<Kind>Geometry` (BIM switch default null →
 *     CAD if-chain χωρίς guard → per-site default `{}`). Πιάνει σιωπηλό regression προς no-op.
 *  3. Live move pins: ένας CAD (line) + ένας BIM (wall, valid fixture) → μη-κενό patch.
 *  4. Editor-only movers (group/block/polygon) = non-renderable handlers (mirror rotate's `group`):
 *     κινούνται ΑΛΛΑ εκτός `RENDERABLE_ENTITY_TYPES` (asymmetry καρφωμένη ρητά).
 *
 * Καρφωμένες ασυμμετρίες (ΜΗΝ τις «διορθώσεις» σιωπηλά — fix = χωριστό verified βήμα):
 *  - CAD off-path no-op: `spline`/`dimension`/`xline`/`ray` = renderable αλλά ΚΑΝΕΝΑ move guard
 *    (`isSplineEntity` υπάρχει αλλά ΔΕΝ χρησιμοποιείται εδώ) → `{}`.
 *  - BIM fall-through no-op: `railing`/`wall-covering`/`thermal-space`/`mep-fitting` = renderable αλλά
 *    ΚΑΝΕΝΑ `case` στο BIM switch → null → CAD if-chain → `{}` (γνήσιο gap, όχι hosted-derived).
 *  - `opening` = ΡΗΤΟ hosted-derived no-op (`case 'opening': return {}`) — follow-the-host cascade.
 *
 * Per-type move MATH (κάθε BIM τύπος όντως μετακινεί params+geometry) ζει ΗΔΗ στο sibling
 * `bim/utils/__tests__/bim-move-geometry.test.ts` + CAD hatch/lwpolyline suites — εδώ ΔΕΝ διπλασιάζεται.
 */

// Firebase auth mock — τα type barrels αγγίζουν auth στο import path (handoff trap).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { calculateMovedGeometry } from '../move-entity-geometry';
import {
  RENDERABLE_ENTITY_TYPES,
} from '../../../../rendering/contract/renderable-entity-type';
import type { SceneEntity } from '../../interfaces';
import type { Point2D } from '../../../../rendering/types/Types';
import type { Point3D } from '../../../../bim/types/bim-base';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();
const DELTA: Point3D = { x: 1000, y: 500 };
const renderableSet = new Set<string>(RENDERABLE_ENTITY_TYPES);

/** Renderable types που παράγουν μη-κενό move patch (CAD guard match ή BIM switch case). */
const MOVE_GOLDEN = [
  // CAD movers (16)
  'line', 'polyline', 'lwpolyline', 'circle', 'arc', 'ellipse', 'text', 'mtext',
  'rectangle', 'rect', 'point', 'angle-measurement', 'hatch', 'annotation-symbol', 'scale-bar',
  'opening-info-tag', 'image',
  // BIM movers — έχουν `case` στο `calculateBimMovedGeometry` switch (19)
  'wall', 'slab', 'slab-opening', 'column', 'beam', 'foundation', 'stair', 'roof',
  'floor-finish', 'space-separator', 'furniture', 'mep-fixture', 'electrical-panel',
  'mep-manifold', 'mep-radiator', 'mep-boiler', 'mep-water-heater', 'mep-segment',
  'mep-underfloor',
] as const;

/** Renderable types που πέφτουν στο per-site default `{}` (ρητός λόγος ανά υποσύνολο). */
const NOOP_GOLDEN = [
  // CAD off-path — renderable αλλά κανένα move guard (raw-DXF, δεν μετακινούνται από αυτό το SSoT)
  'spline', 'dimension', 'xline', 'ray',
  // BIM fall-through — renderable αλλά κανένα switch case → null → CAD if-chain → `{}` (γνήσιο gap)
  'railing', 'wall-covering', 'thermal-space', 'mep-fitting',
  // ΡΗΤΟ hosted-derived no-op (`case 'opening': return {}`) — ακολουθεί τον host τοίχο
  'opening',
] as const;

/** Valid wall fixture (shape του `bim-move-geometry.test.ts` makeWall) — επιζεί του `computeWallGeometry`. */
function makeWall(): SceneEntity {
  return {
    id: 'wall_cov', name: 'W', type: 'wall', kind: 'straight', layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 },
      height: 3000, thickness: 250, flip: false,
    },
    geometry: { bbox: { min: { x: 0, y: -125 }, max: { x: 5000, y: 125 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as SceneEntity;
}

const asEntity = (type: string, extra: Record<string, unknown> = {}): SceneEntity =>
  ({ id: `${type}_x`, layerId: 'L', type, ...extra }) as unknown as SceneEntity;

describe('Move capability coverage — ζωντανό seam ↔ descriptor domain (ADR-587 Φ5)', () => {
  it('MOVES ∪ NO-OP = RENDERABLE_ENTITY_TYPES (exhaustive + disjoint completeness anchor)', () => {
    const partition = [...MOVE_GOLDEN, ...NOOP_GOLDEN];
    // Disjoint — κανένας τύπος και στα δύο.
    expect(new Set(partition).size).toBe(partition.length);
    // Exhaustive — καλύπτει ακριβώς το domain (νέος renderable τύπος → σπάει).
    expect(asSorted(partition)).toEqual(asSorted([...RENDERABLE_ENTITY_TYPES]));
  });

  it.each(NOOP_GOLDEN)('no-op πιν: "%s" → calculateMovedGeometry επιστρέφει {} (live per-site default)', (type) => {
    expect(calculateMovedGeometry(asEntity(type), DELTA)).toEqual({});
  });

  it('CAD move πιν: line → μετατοπίζει start+end (μη-κενό patch)', () => {
    const line = asEntity('line', { start: { x: 1, y: 0 }, end: { x: 2, y: 0 } });
    const patch = calculateMovedGeometry(line, DELTA) as { start: Point2D; end: Point2D };
    expect(patch.start).toEqual({ x: 1001, y: 500 });
    expect(patch.end).toEqual({ x: 1002, y: 500 });
  });

  it('BIM move πιν: wall → μη-κενό {params, geometry} patch (start/end μετατοπισμένα)', () => {
    const patch = calculateMovedGeometry(makeWall(), DELTA) as {
      params?: { start: Point3D; end: Point3D };
      geometry?: unknown;
    };
    expect(patch).not.toEqual({});
    expect(patch.params?.start).toEqual({ x: 1000, y: 500, z: 0 });
    expect(patch.params?.end).toEqual({ x: 6000, y: 500, z: 0 });
    expect(patch.geometry).toBeDefined();
  });

  it('editor-only movers (group/block/polygon) = non-renderable handlers: κινούνται ΑΛΛΑ εκτός domain', () => {
    const group = asEntity('group', {
      members: [{ type: 'line', id: 'm', layerId: 'L', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
    });
    const block = asEntity('block', { position: { x: 3, y: 4 } });
    const polygon = asEntity('polygon', { vertices: [{ x: 5, y: 6 }] });

    for (const [type, e] of [['group', group], ['block', block], ['polygon', polygon]] as const) {
      expect(renderableSet.has(type)).toBe(false); // editor-only, όχι στο descriptor domain
      expect(calculateMovedGeometry(e, DELTA)).not.toEqual({}); // ΑΛΛΑ όντως μετακινείται
    }
  });
});
