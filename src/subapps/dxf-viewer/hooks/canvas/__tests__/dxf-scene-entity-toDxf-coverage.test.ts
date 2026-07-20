/**
 * toDxf capability coverage (ADR-587 Φ5 — TIER-2 introspectable seam).
 *
 * Δένει το ζωντανό `TO_DXF_HANDLERS` seam (`dxf-scene-entity-handlers.ts`) με το descriptor
 * domain (`RENDERABLE_ENTITY_TYPES`), ώστε να μην μπορεί να αποκλίνει σιωπηλά (mirror του
 * `rotate-entity-coverage.test.ts`):
 *  1. Golden — ποιοι renderable types ΕΧΟΥΝ ρητό SceneModel→DxfEntityUnion handler.
 *  2. No-case set — ποιοι renderable types πέφτουν στο `warn+null` default (per-site,
 *     ADR-587 §4.6). ΔΥΟ διακριτοί λόγοι, καρφωμένοι ρητά:
 *       • `ellipse`/`spline`/`point`/`rect` = **δεν** είναι `DxfEntityUnion` variants → δεν
 *         ρέουν από αυτό το seam (αποδίδονται από το raw-DXF `EntityRendererComposite`
 *         path). Νόμιμη απουσία — ανάλογο του rotate no-op set.
 *       • `wall-covering` = **surfaced asymmetry** — έχει `DxfWallCovering` variant + renderer
 *         + preview helper αλλά ΚΑΝΕΝΑ `convertEntity` case (mirror του `floorplan-symbol`
 *         gap του Φ2b). Pin εδώ, fix = χωριστό verified βήμα (ADR-550/470 follow-up).
 *  3. Editor-only extra — ο ΜΟΝΟΣ non-renderable handler είναι το `floorplan-symbol` (έχει
 *     renderer αλλά λείπει από το `RENDERABLE_ENTITY_TYPES` — surfaced asymmetry, ADR-583/Φ2b).
 *  4/5. Behavioral pins — no-case τύπος → `null` (warn+null default)· handled τύπος → non-null
 *     με το σωστό shape.
 *
 * Νέος renderable τύπος → προσγειώνεται σε #1 ή #2 → σπάει το test → επιβάλλει συνειδητή
 * απόφαση (πρόσθεσε handler ή επιβεβαίωσε ότι είναι DxfEntityUnion-native / off-path), αντί
 * για σιωπηλό `warn+null` drop → αόρατη οντότητα (ο ADR-406/507/583 πόνος).
 */

// Firebase auth mock — τα type/store barrels αγγίζουν auth στο import path (handoff trap).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { TO_DXF_SUPPORTED_TYPES } from '../dxf-scene-entity-handlers';
import { convertEntity, type SceneEntity, type SceneLayers } from '../dxf-scene-entity-converter';
import {
  RENDERABLE_ENTITY_TYPES,
} from '../../../rendering/contract/renderable-entity-type';
import type { Point2D } from '../../../rendering/types/Types';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();

const renderableSet = new Set<string>(RENDERABLE_ENTITY_TYPES);
const supportedSet = new Set<string>(TO_DXF_SUPPORTED_TYPES);
const NO_LAYERS: SceneLayers = {};

describe('toDxf capability coverage — ζωντανό seam ↔ descriptor domain (ADR-587 Φ5)', () => {
  it('renderable types με ρητό handler = καρφωμένο golden set', () => {
    const withToDxf = RENDERABLE_ENTITY_TYPES.filter((t) => supportedSet.has(t));
    expect(asSorted(withToDxf)).toEqual(
      asSorted([
        // DXF primitives (20)
        'line', 'polyline', 'lwpolyline', 'circle', 'arc', 'text', 'mtext', 'rectangle',
        'dimension', 'angle-measurement', 'hatch', 'xline', 'ray', 'annotation-symbol', 'scale-bar',
        'opening-info-tag', 'image', 'floorplan-symbol',
        // ADR-635 Φ B — leader: flat handler (`dxf-scene-entity-flat-handlers`) → DxfLeader.
        'leader',
        // ADR-662 Φ2β — topo-surface: flat handler → DxfTopoSurface (το footprint outline ρέει
        // στο render pipeline). Το handler ΥΠΑΡΧΕΙ· το ΕΞΑΓΩΓΙΚΟ κενό ζει στο entity-export-coverage.
        'topo-surface',
        // BIM (24 — όλα εκτός wall-covering)
        'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'foundation', 'stair',
        'railing', 'roof', 'floor-finish', 'thermal-space', 'space-separator', 'furniture',
        'mep-fixture', 'electrical-panel', 'mep-manifold', 'mep-radiator', 'mep-boiler',
        'mep-water-heater', 'mep-segment', 'mep-fitting', 'mep-underfloor',
        // ADR-683 Φ3 — εισαγόμενο πλέγμα: flat handler → DxfImportedMesh (το περίγραμμα ρέει
        // στο 2Δ render pipeline, όπως το furniture).
        'imported-mesh',
      ]),
    );
  });

  it('renderable types χωρίς handler = no-case set (DxfEntityUnion-native + wall-covering asymmetry)', () => {
    const noToDxf = RENDERABLE_ENTITY_TYPES.filter((t) => !supportedSet.has(t));
    expect(asSorted(noToDxf)).toEqual(
      asSorted([
        // δεν είναι DxfEntityUnion variants → off this seam (raw-DXF render path)
        'ellipse', 'spline', 'point', 'rect',
        // surfaced asymmetry — variant+renderer υπάρχουν, case λείπει (ADR-550/470 follow-up)
        'wall-covering',
      ]),
    );
  });

  it('ΚΑΝΕΝΑΣ non-renderable handler — η ADR-583/Φ2b asymmetry έκλεισε', () => {
    // Το `floorplan-symbol` είχε handler αλλά ΕΛΕΙΠΕ από το `RENDERABLE_ENTITY_TYPES` (editor-only
    // asymmetry). Μπήκε στο descriptor domain (commit 7940558f) → κάθε handler έχει πλέον renderer.
    // Νέος handler χωρίς descriptor entry → ξανα-σπάει εδώ = συνειδητή απόφαση, όχι σιωπηλό drift.
    const nonRenderable = TO_DXF_SUPPORTED_TYPES.filter((t) => !renderableSet.has(t));
    expect(nonRenderable).toEqual([]);
  });

  it('τύπος χωρίς handler → convertEntity επιστρέφει null (warn+null default, per-site)', () => {
    const point = { type: 'point', id: 'p1' } as unknown as SceneEntity;
    expect(convertEntity(point, NO_LAYERS)).toBeNull();
  });

  it('line handler → non-null με σωστό shape (start/end προωθούνται)', () => {
    const line = {
      type: 'line', id: 'l1',
      start: { x: 0, y: 0 }, end: { x: 10, y: 5 },
    } as unknown as SceneEntity;
    const r = convertEntity(line, NO_LAYERS) as { type: string; start: Point2D; end: Point2D } | null;
    expect(r).not.toBeNull();
    expect(r?.type).toBe('line');
    expect(r?.start).toEqual({ x: 0, y: 0 });
    expect(r?.end).toEqual({ x: 10, y: 5 });
  });
});
