/**
 * toEntityModel capability coverage (ADR-587 Φ5 — TIER-2 introspectable seam, Μηχανισμός 2).
 *
 * Ο `buildEntityModelFromDxf` switch έχει ΗΔΗ compile-time `never` exhaustiveness → **δεν** τον
 * μετατρέψαμε σε Record (θα ΕΧΑΝΕ το `never`, καθαρή απώλεια ασφάλειας — handoff/§5.3). Αντ' αυτού
 * δένουμε το ζωντανό `DxfEntityUnion` variant set (`TO_ENTITY_MODEL_SUPPORTED_TYPES`, runtime mirror
 * του union με αμφίδρομο compile-time bridge) στο descriptor domain (`RENDERABLE_ENTITY_TYPES`),
 * mirror του `rotate-entity-coverage`/`dxf-scene-entity-toDxf-coverage`:
 *  1. Golden — renderable types που ΕΧΟΥΝ `DxfEntityUnion` variant → modelable από DXF.
 *  2. No-variant set — renderable types χωρίς variant, ΔΥΟ διακριτοί λόγοι (καρφωμένοι):
 *       • 🔴 ADR-909 Γ2.9: τα `ellipse`/`spline`/`point` ήταν εδώ ως «raw-DXF render path» — δρόμος που
 *         δεν υπάρχει. Έχουν πλέον variant (golden #1).
 *       • `lwpolyline`/`rectangle`/`rect`/`mtext` = **normalized upstream** (`convertEntity`: lwpolyline→
 *         polyline, rectangle/rect→polyline, mtext→text) → δεν φτάνουν ΠΟΤΕ ως DxfEntityUnion αυτού του
 *         ονόματος. Νόμιμη απουσία, ΟΧΙ gap.
 *  3. Editor-only extra — ο ΜΟΝΟΣ non-renderable variant είναι το `floorplan-symbol` (entity-model
 *     render path· surfaced asymmetry ADR-583/Φ2b, ίδιο με το toDxf seam).
 *  4. Behavioral pin — ένας variant (line) → EntityModel με σωστό type + geometry.
 *
 * Νέος renderable τύπος → προσγειώνεται σε #1 ή #2 → σπάει το test → επιβάλλει συνειδητή απόφαση
 * (variant+case, ή επιβεβαίωσε normalized/off-path), αντί για σιωπηλό «δεν μοντελοποιείται από DXF».
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
  buildEntityModelFromDxf,
  TO_ENTITY_MODEL_SUPPORTED_TYPES,
} from '../dxf-renderer-entity-model';
import type { DxfEntityUnion } from '../dxf-types';
import { RENDERABLE_ENTITY_TYPES } from '../../../rendering/contract/renderable-entity-type';
import { convertEntity, type SceneEntity } from '../../../hooks/canvas/dxf-scene-entity-converter';
import { PRIMITIVE_RENDER_FIELDS, type PrimitiveRenderType } from '../../../bim/primitives/primitive-render-fields';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();

const renderableSet = new Set<string>(RENDERABLE_ENTITY_TYPES);
const variantSet = new Set<string>(TO_ENTITY_MODEL_SUPPORTED_TYPES);
const RESOLVED = { colorHex: '#fff', lineWidthPx: 1, alpha: 1 };

describe('toEntityModel capability coverage — ζωντανό seam ↔ descriptor domain (ADR-587 Φ5)', () => {
  it('renderable types με DxfEntityUnion variant = καρφωμένο golden set (modelable από DXF)', () => {
    const modelable = RENDERABLE_ENTITY_TYPES.filter((t) => variantSet.has(t));
    expect(asSorted(modelable)).toEqual(
      asSorted([
        // DXF primitives με variant (16)
        'line', 'polyline', 'circle', 'arc', 'text', 'dimension', 'angle-measurement',
        'hatch', 'xline', 'ray', 'annotation-symbol', 'scale-bar', 'opening-info-tag', 'image',
        // ADR-909 Γ2.9 — `DxfEllipse` / `DxfSpline` / `DxfPoint`: ως τότε χωρίς variant ⇒ αόρατα παντού.
        'ellipse', 'spline', 'point',
        // ADR-739 Φ.Γ — γενικός πίνακας: έχει δικό του `DxfTable` variant + case.
        'table',
        // ADR-635 Φ B — leader: `DxfLeader` variant (annotation path + tip arrowhead).
        'leader',
        // ADR-662 Φ2β — topo-surface: `DxfTopoSurface` variant (footprint outline της TIN· το
        // 3D mesh το κρατά ο imperative TerrainSceneLayer, εκτός αυτού του seam).
        'topo-surface',
        // BIM (26 — όλα· το floorplan-symbol μπήκε στο RENDERABLE_ENTITY_TYPES, ADR-415/635)
        'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'foundation', 'stair',
        'railing', 'roof', 'floor-finish', 'wall-covering', 'thermal-space', 'space-separator',
        'furniture', 'mep-fixture', 'electrical-panel', 'mep-manifold', 'mep-radiator',
        'mep-boiler', 'mep-water-heater', 'mep-segment', 'mep-fitting', 'mep-underfloor',
        'floorplan-symbol',
        // ADR-683 Φ3 — εισαγόμενο πλέγμα: `DxfImportedMesh` variant.
        'imported-mesh',
        // ADR-684 Φ2 — παραμετρικό στερεό: `DxfGenericSolid` variant.
        'generic-solid',
      ]),
    );
  });

  it('renderable types χωρίς variant = no-variant set (off-path + normalized-upstream)', () => {
    const noVariant = RENDERABLE_ENTITY_TYPES.filter((t) => !variantSet.has(t));
    expect(asSorted(noVariant)).toEqual(
      asSorted([
        // 🔴 ADR-909 Γ2.9 — τα `ellipse` / `spline` / `point` ήταν εδώ ως «raw-DXF render path»· τέτοιος
        // δρόμος δεν υπάρχει. Έχουν πλέον δικό τους variant (golden παραπάνω).
        // normalized upstream στο convertEntity → δεν φτάνουν ως variant αυτού του ονόματος
        // (`rect` = ψευδώνυμο του `rectangle` → polyline, ADR-909 Γ2.9)
        'lwpolyline', 'rectangle', 'rect', 'mtext',
      ]),
    );
  });

  it('κάθε entity-model variant είναι renderable (η ADR-583/Φ2b ασυμμετρία έκλεισε)', () => {
    const nonRenderable = TO_ENTITY_MODEL_SUPPORTED_TYPES.filter((t) => !renderableSet.has(t));
    expect(nonRenderable).toEqual([]);
  });

  it('line variant → EntityModel με σωστό type + geometry (start/end προωθούνται)', () => {
    const line = {
      id: 'l1', type: 'line', visible: true,
      start: { x: 0, y: 0 }, end: { x: 10, y: 5 },
    } as unknown as DxfEntityUnion;
    const model = buildEntityModelFromDxf(line, false, RESOLVED) as {
      type: string; start: { x: number; y: number }; end: { x: number; y: number };
    };
    expect(model.type).toBe('line');
    expect(model.start).toEqual({ x: 0, y: 0 });
    expect(model.end).toEqual({ x: 10, y: 5 });
  });

  // 🔴 ADR-909 Γ2.9 — ΟΛΗ η αλυσίδα, όχι ένα πέρασμα: στοιχείο σκηνής → `convertEntity` → `buildEntityModelFromDxf`.
  // Ό,τι φτάνει στον ζωγράφο πρέπει να είναι ΚΑΘΕ πεδίο της λίστας, αυτούσιο. Πέρασμα που κρατά δική του
  // λίστα και ξεχνά ένα πεδίο κοκκινίζει εδώ (η κλάση των hatch / text / image / table-render-fields).
  describe('ADR-909 Γ2.9 — ellipse / spline / point: από τη σκηνή ως τον ζωγράφο, χωρίς απώλεια πεδίου', () => {
    const SCENE: Readonly<Record<PrimitiveRenderType, Record<string, unknown>>> = {
      ellipse: { center: { x: 5, y: 6 }, majorAxis: 14, minorAxis: 8, rotation: 30, startParam: 0.5, endParam: 2 },
      spline: {
        controlPoints: [{ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 0 }],
        degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], weights: [1, 2, 2, 1], closed: true, rational: true,
      },
      point: { position: { x: 7, y: 9 }, size: 4, style: 'cross', pdMode: 34, pdSize: -2 },
    };
    const types = Object.keys(SCENE) as PrimitiveRenderType[];

    it.each(types)('το δείγμα του "%s" γεμίζει ΚΑΘΕ πεδίο της λίστας (αλλιώς το test δεν θα έβλεπε απώλεια)', (type) => {
      expect(Object.keys(SCENE[type]).sort()).toEqual([...PRIMITIVE_RENDER_FIELDS[type]].sort());
    });

    it.each(types)('"%s" → μοντέλο ζωγράφου με τον τύπο του και κάθε πεδίο αυτούσιο', (type) => {
      const dxf = convertEntity({ type, id: `${type}-1`, visible: true, ...SCENE[type] } as unknown as SceneEntity, {});
      expect(dxf).not.toBeNull();
      const model = buildEntityModelFromDxf(dxf as DxfEntityUnion, false, RESOLVED) as unknown as Record<string, unknown>;
      expect(model.type).toBe(type);
      expect(model.id).toBe(`${type}-1`);
      expect(model.color).toBe(RESOLVED.colorHex);
      expect(model).toMatchObject(SCENE[type]);
    });
  });

  // ─── Fall-through consolidation pins (TIER-C dup audit, ADR-587 Φ5 seam) ───
  // Group A (quartet) — the 17-case fall-through must carry `validation` through.
  it('BIM Group A (wall) → quartet {kind,params,geometry,validation} προωθείται όλο', () => {
    const wall = {
      id: 'w1', type: 'wall', visible: true,
      kind: 'straight', params: { thickness: 200 }, geometry: { path: [] }, validation: { ok: true },
    } as unknown as DxfEntityUnion;
    const model = buildEntityModelFromDxf(wall, false, RESOLVED) as Record<string, unknown>;
    expect(model.type).toBe('wall');
    expect(model.kind).toBe('straight');
    expect(model.params).toEqual({ thickness: 200 });
    expect(model.geometry).toEqual({ path: [] });
    expect(model.validation).toEqual({ ok: true });
  });

  // Group B (finishes/spaces) — the No-God-shell guarantee: `validation` is NEVER
  // carried even when present on the source (force-merge with Group A would leak it).
  it('BIM Group B (floor-finish) → {kind,params,geometry} ΧΩΡΙΣ validation (No-God-shell)', () => {
    const floorFinish = {
      id: 'ff1', type: 'floor-finish', visible: true,
      kind: 'tile', params: { materialId: 'm1' }, geometry: { bbox: {} }, validation: { leaked: true },
    } as unknown as DxfEntityUnion;
    const model = buildEntityModelFromDxf(floorFinish, false, RESOLVED) as Record<string, unknown>;
    expect(model.type).toBe('floor-finish');
    expect(model.kind).toBe('tile');
    expect(model.geometry).toEqual({ bbox: {} });
    expect('validation' in model).toBe(false);
  });
});
