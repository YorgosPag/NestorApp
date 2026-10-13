/**
 * toDxf capability coverage (ADR-587 Φ5 — TIER-2 introspectable seam).
 *
 * Δένει το ζωντανό `TO_DXF_HANDLERS` seam (`dxf-scene-entity-handlers.ts`) με το descriptor
 * domain (`RENDERABLE_ENTITY_TYPES`), ώστε να μην μπορεί να αποκλίνει σιωπηλά (mirror του
 * `rotate-entity-coverage.test.ts`):
 *  1. Golden — ποιοι renderable types ΕΧΟΥΝ ρητό SceneModel→DxfEntityUnion handler.
 *  2. No-case set — ποιοι renderable types πέφτουν στο `warn+null` default (per-site,
 *     ADR-587 §4.6). ΔΥΟ διακριτοί λόγοι, καρφωμένοι ρητά:
 *       • 🔴 ADR-909 Γ2.9: τα `ellipse`/`spline`/`point`/`rect` ήταν καρφωμένα εδώ ως «νόμιμη απουσία
 *         (raw-DXF path)». Ο δρόμος αυτός **δεν υπάρχει** προς τον κύριο καμβά — ήταν αόρατα παντού.
 *         Έχουν πλέον handler (golden #1).
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
import {
  PRIMITIVE_RENDER_FIELDS,
  PRIMITIVE_REQUIRED_FIELDS,
  type PrimitiveRenderType,
} from '../../../bim/primitives/primitive-render-fields';

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
        // ADR-909 Γ2.9 — τα τέσσερα που δεν έφταναν ποτέ στον καμβά: `rect` = ίδια συνάρτηση με το
        // `rectangle`· ellipse / spline / point → δικό τους σχήμα (`DxfEllipse` / `DxfSpline` / `DxfPoint`).
        'rect', 'ellipse', 'spline', 'point',
        // ADR-739 Φ.Γ — γενικός πίνακας: ρητός handler (αλλιώς `default` → null → αόρατος).
        'table',
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
        // ADR-684 Φ2 — παραμετρικό στερεό: handler → DxfGenericSolid (footprint outline στο
        // 2Δ render pipeline, όπως imported-mesh/furniture).
        'generic-solid',
      ]),
    );
  });

  it('renderable types χωρίς handler = no-case set (DxfEntityUnion-native + wall-covering asymmetry)', () => {
    const noToDxf = RENDERABLE_ENTITY_TYPES.filter((t) => !supportedSet.has(t));
    expect(asSorted(noToDxf)).toEqual(
      asSorted([
        // 🔴 ADR-909 Γ2.9 — εδώ ήταν καρφωμένα και τα `ellipse` / `spline` / `point` / `rect` ως «νόμιμη
        // απουσία, raw-DXF render path». Τέτοιος δρόμος προς τον κύριο καμβά ΔΕΝ υπάρχει: και οι τέσσερις
        // ήταν αόρατοι παντού (πύλη pixels 3.101, `K0`). Πλέον έχουν handler — βλ. το golden παραπάνω.
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
    // Ως το ADR-909 Γ2.9 το δείγμα εδώ ήταν `point` — που τότε δεν είχε handler. Το `wall-covering` είναι ο
    // μόνος renderable τύπος που μένει χωρίς (καρφωμένη ασυμμετρία, παραπάνω).
    const orphan = { type: 'wall-covering', id: 'wc1' } as unknown as SceneEntity;
    expect(convertEntity(orphan, NO_LAYERS)).toBeNull();
  });

  describe('ADR-909 Γ2.9 — τα τέσσερα που δεν έφταναν στον καμβά', () => {
    const SCENE: Readonly<Record<string, Record<string, unknown>>> = {
      ellipse: { center: { x: 5, y: 6 }, majorAxis: 14, minorAxis: 8, rotation: 30, startParam: 0.5, endParam: 2 },
      spline: {
        controlPoints: [{ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 0 }],
        degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], weights: [1, 2, 2, 1], closed: true, rational: true,
      },
      point: { position: { x: 7, y: 9 }, size: 4, style: 'cross', pdMode: 34, pdSize: -2 },
    };
    const convert = (type: string, fields: Record<string, unknown>) =>
      convertEntity({ type, id: `${type}-1`, ...fields } as unknown as SceneEntity, NO_LAYERS) as
        | (Record<string, unknown> & { type: string })
        | null;

    it.each(Object.keys(SCENE))('"%s" → δικό του σχήμα, με ΚΑΘΕ πεδίο όψης αυτούσιο', (type) => {
      const result = convert(type, SCENE[type]);
      expect(result).not.toBeNull();
      expect(result?.type).toBe(type);
      expect(result).toMatchObject(SCENE[type]);
    });

    it.each(Object.keys(SCENE))('"%s" → απόν optional ΔΕΝ γίνεται κλειδί με undefined', (type) => {
      const required = PRIMITIVE_REQUIRED_FIELDS[type as PrimitiveRenderType] as readonly string[];
      const onlyRequired = Object.fromEntries(required.map((field) => [field, SCENE[type][field]]));
      const result = convert(type, onlyRequired);
      const optional = (PRIMITIVE_RENDER_FIELDS[type as PrimitiveRenderType] as readonly string[])
        .filter((field) => !required.includes(field));
      expect(optional.length).toBeGreaterThan(0);
      for (const field of optional) expect(result).not.toHaveProperty(field);
    });

    // Γραμμένα ΜΕ ΤΟ ΧΕΡΙ, όχι από το `PRIMITIVE_REQUIRED_FIELDS`: test που παράγει τις περιπτώσεις του από τη
    // λίστα που κρίνει, μένει πράσινο όταν η λίστα χάσει ένα πεδίο.
    it.each([
      ['ellipse', 'center'], ['ellipse', 'majorAxis'], ['ellipse', 'minorAxis'],
      ['spline', 'controlPoints'],
      ['point', 'position'],
    ])('"%s" χωρίς `%s` → null: ποτέ μισό σχήμα στον ζωγράφο', (type, field) => {
      const { [field]: _dropped, ...rest } = SCENE[type];
      expect(convert(type, rest)).toBeNull();
    });

    it('🔴 `rect` → ΤΟ ΙΔΙΟ κλειστό polyline με το `rectangle` (ψευδώνυμο, όχι δεύτερος δρόμος)', () => {
      const box = { x: 10, y: 20, width: 30, height: 40, rotation: 15 };
      const rect = convert('rect', box);
      const rectangle = convert('rectangle', box);
      expect(rect).not.toBeNull();
      expect(rect?.type).toBe('polyline');
      expect(rect?.closed).toBe(true);
      expect((rect?.vertices as Point2D[]).length).toBe(4);
      expect(rect?.vertices).toEqual(rectangle?.vertices);
    });

    it('`rect` χωρίς γεωμετρία → null (ίδιο συμβόλαιο με το `rectangle`)', () => {
      expect(convert('rect', {})).toBeNull();
      expect(convert('rectangle', {})).toBeNull();
    });
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
