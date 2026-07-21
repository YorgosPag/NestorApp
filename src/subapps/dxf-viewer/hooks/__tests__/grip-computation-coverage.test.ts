/**
 * Grip-producer capability coverage (ADR-587 Φ7 — TIER-2 introspectable seam).
 *
 * Δένει το ζωντανό `GRIP_PRODUCERS` seam (`grip-computation-producers.ts`) με το
 * descriptor domain (`RENDERABLE_ENTITY_TYPES`), ώστε να μην μπορεί να αποκλίνει
 * σιωπηλά (mirror του `rotate-entity-coverage.test.ts` + `dxf-scene-entity-toDxf-
 * coverage.test.ts`):
 *  1. Golden — ποιοι renderable types ΕΧΟΥΝ ρητό grip producer.
 *  2. Off-path set — ποιοι renderable types πέφτουν στο `[]` default (silent-empty,
 *     per-site ADR-587 §4.6). ΔΥΟ ομάδες, καρφωμένες ρητά:
 *       • DXF `lwpolyline`/`ellipse`/`mtext`/`spline`/`rectangle`/`rect`/`point`
 *         = normalized/off-path (δεν έχουν per-type grip producer· mtext→text,
 *         lwpolyline→polyline στον converter).
 *       • BIM `railing`/`wall-covering`/`thermal-space`/`space-separator`/`mep-fitting`
 *         = renderable ΧΩΡΙΣ interactive grips.
 *  3. Editor-only extra — ο ΜΟΝΟΣ non-renderable producer είναι το `floorplan-symbol`
 *     (έχει grips αλλά λείπει από το `RENDERABLE_ENTITY_TYPES` — surfaced asymmetry).
 *  4/5. Behavioral pins — off-path τύπος → `[]`· supported τύπος (line/circle) όντως
 *     παράγει grips.
 *  6. Asymmetry (α) — `angle-measurement` παράγει grips ΧΩΡΙΣ `gripKind` (ο ΜΟΝΟΣ
 *     grip-producing τύπος απών από το `GRIP_KIND_ENTITIES`).
 *  7. Asymmetry (β) — `group` ΕΧΕΙ `gripKind` (μέλος του `GRIP_KIND_ENTITIES`) αλλά
 *     ΔΕΝ παράγεται εδώ (τα group grips έρχονται από το `GroupGizmoLayer`).
 *
 * Νέος renderable τύπος → προσγειώνεται σε #1 ή #2 → σπάει το test → επιβάλλει
 * συνειδητή απόφαση (πρόσθεσε producer ή επιβεβαίωσε off-path), αντί για σιωπηλό «δεν
 * παράγει grips» → μη-grippable οντότητα (ο ADR-397/436/507 πόνος).
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

import {
  GRIP_PRODUCER_SUPPORTED_TYPES,
  computeDxfEntityGrips,
} from '../grip-computation';
import { GRIP_KIND_ENTITIES } from '../grip-kinds';
import {
  RENDERABLE_ENTITY_TYPES,
  BIM_RENDERABLE_TYPES,
} from '../../rendering/contract/renderable-entity-type';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { GripInfo } from '../useGripMovement';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();

const renderableSet = new Set<string>(RENDERABLE_ENTITY_TYPES);
const supportedSet = new Set<string>(GRIP_PRODUCER_SUPPORTED_TYPES);

describe('Grip-producer capability coverage — ζωντανό seam ↔ descriptor domain (ADR-587 Φ7)', () => {
  it('renderable types με ρητό producer = καρφωμένο golden set', () => {
    const withProducer = RENDERABLE_ENTITY_TYPES.filter((t) => supportedSet.has(t));
    expect(asSorted(withProducer)).toEqual(
      asSorted([
        // DXF primitives (14)
        'line', 'polyline', 'circle', 'arc', 'text', 'dimension', 'angle-measurement',
        'hatch', 'xline', 'ray', 'annotation-symbol', 'scale-bar', 'opening-info-tag',
        // ADR-654 — raster image (entourage / furniture-plan sprite): move + rotation + 4 corners.
        'image',
        // BIM (21 — όλα εκτός railing/wall-covering/thermal-space/space-separator/mep-fitting).
        // Το `floorplan-symbol` ΔΕΝ είναι πια editor-only: μπήκε στο RENDERABLE_ENTITY_TYPES
        // (ADR-415/635 ghost preview) — code=truth, η λίστα ήταν stale.
        'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'foundation', 'stair',
        'roof', 'floor-finish', 'furniture', 'mep-fixture', 'electrical-panel', 'mep-manifold',
        'mep-radiator', 'mep-boiler', 'mep-water-heater', 'mep-segment', 'mep-underfloor',
        'floorplan-symbol',
        // ADR-683 Φ3 §10.1 — εισαγόμενο πλέγμα: ΕΧΕΙ producer, αλλά εκπέμπει ΜΟΝΟ
        // move + rotation. Καμία λαβή σχήματος (ψημένη γεωμετρία — §3).
        'imported-mesh',
        // ADR-684 Φ2/Φ3 — παραμετρικό στερεό: ΕΧΕΙ producer. move + rotation πάντα·
        // 4 corners ΜΟΝΟ για box (per-shape reshape → Φ4).
        'generic-solid',
      ]),
    );
  });

  it('renderable types χωρίς producer = off-path set (normalized DXF + grip-less BIM)', () => {
    const noProducer = RENDERABLE_ENTITY_TYPES.filter((t) => !supportedSet.has(t));
    expect(asSorted(noProducer)).toEqual(
      asSorted([
        // normalized/off-path DXF — mtext→text, lwpolyline→polyline· rect/rectangle/
        // ellipse/spline/point έχουν renderer αλλά ΟΧΙ per-type grip producer.
        // (ADR-654: το `image` ΕΦΥΓΕ από εδώ — το «τα grips ρέουν από το ImageRenderer.getGrips()»
        // ήταν ΛΑΘΟΣ· ο renderer ζωγραφίζει, το registry πιάνει — χωρίς producer η εικόνα
        // εμφάνιζε λαβές που δεν την μετακινούσαν ποτέ.)
        'lwpolyline', 'ellipse', 'mtext', 'spline', 'rectangle', 'rect', 'point',
        // ADR-635 Φ B — leader: renderable annotation ΧΩΡΙΣ per-type grip producer. ⚠️ ΓΝΗΣΙΟ GAP
        // (ίδια οικογένεια με το ADR-654 image bug): το callout ζωγραφίζεται και επιλέγεται, αλλά
        // δεν έχει λαβές ούτε move → ο χρήστης δεν μπορεί να το επεξεργαστεί. Pin εδώ = ορατό.
        'leader',
        // ADR-662 Φ2β — topo-surface: Stage A plumbing, κανένα producer. Η επιφάνεια είναι
        // derived (TIN/point-cloud) → η επεξεργασία γίνεται από το topography subsystem, ΟΧΙ με
        // λαβές πάνω στο footprint outline — σωστό no-op για το Stage A συμβόλαιο.
        'topo-surface',
        // renderable BIM ΧΩΡΙΣ interactive grips
        'railing', 'wall-covering', 'thermal-space', 'space-separator', 'mep-fitting',
      ]),
    );
  });

  it('κάθε grip producer είναι renderable (η ADR-415 ασυμμετρία έκλεισε — floorplan-symbol renderable)', () => {
    const nonRenderable = GRIP_PRODUCER_SUPPORTED_TYPES.filter((t) => !renderableSet.has(t));
    expect(nonRenderable).toEqual([]);
  });

  it('όλοι οι BIM_RENDERABLE_TYPES χωρίς producer είναι ρητά grip-less (completeness anchor)', () => {
    const bimNoProducer = BIM_RENDERABLE_TYPES.filter((t) => !supportedSet.has(t));
    expect(asSorted(bimNoProducer)).toEqual(
      asSorted(['railing', 'wall-covering', 'thermal-space', 'space-separator', 'mep-fitting']),
    );
  });

  it('off-path τύπος (rectangle) → computeDxfEntityGrips επιστρέφει [] (silent-empty default)', () => {
    const rect = { type: 'rectangle', id: 'r1' } as unknown as DxfEntityUnion;
    expect(computeDxfEntityGrips(rect)).toEqual([]);
  });

  it('line producer → παράγει grips (start/end/midpoint/rotation, μη-κενό)', () => {
    const line = {
      type: 'line', id: 'l1',
      start: { x: 0, y: 0 }, end: { x: 10, y: 0 },
    } as unknown as DxfEntityUnion;
    expect(computeDxfEntityGrips(line).length).toBeGreaterThan(0);
  });

  it('circle producer → παράγει grips (centre MOVE + quadrant handles, μη-κενό)', () => {
    const circle = {
      type: 'circle', id: 'c1',
      center: { x: 0, y: 0 }, radius: 5,
    } as unknown as DxfEntityUnion;
    expect(computeDxfEntityGrips(circle).length).toBeGreaterThan(0);
  });

  it('asymmetry (α) — angle-measurement παράγει 3 grips ΧΩΡΙΣ gripKind', () => {
    const am = {
      type: 'angle-measurement', id: 'a1',
      vertex: { x: 0, y: 0 }, point1: { x: 1, y: 0 }, point2: { x: 0, y: 1 },
    } as unknown as DxfEntityUnion;
    const grips: GripInfo[] = computeDxfEntityGrips(am);
    expect(grips).toHaveLength(3);
    expect(grips.every((g) => g.gripKind === undefined)).toBe(true);
    // ... και ρητά: το angle-measurement ΛΕΙΠΕΙ από το gripKind domain.
    expect(new Set<string>(GRIP_KIND_ENTITIES).has('angle-measurement')).toBe(false);
  });

  it('asymmetry (β) — "group" έχει gripKind αλλά ΔΕΝ παράγεται εδώ (GroupGizmoLayer owns it)', () => {
    expect(supportedSet.has('group')).toBe(false);
    expect(new Set<string>(GRIP_KIND_ENTITIES).has('group')).toBe(true);
  });
});
