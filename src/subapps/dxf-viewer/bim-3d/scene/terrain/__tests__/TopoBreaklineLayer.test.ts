/**
 * ADR-920 Β4.8 Β2.4 — το layer των ΔΕΣΜΕΥΜΕΝΩΝ ασυνεχειών στην 3Δ.
 *
 * Τα stores είναι ψεύτικα (ελέγχονται από το test)· ο μετατροπέας, τα υλικά, το trim και το three
 * είναι τα ΠΡΑΓΜΑΤΙΚΑ. Οι ερωτήσεις: κρύβεται με το έδαφος; βγάζει τα passes με τη σωστή σειρά;
 * κόβεται στη στάθμη του `'topo'` scope; μένει έξω από το stencil parity; ξαναπροβάλλει μόνο όταν
 * πρέπει; καθαρίζει πίσω του;
 */

import * as THREE from 'three';
import type { Breakline, TopoPoint3D } from '../../../../systems/topography/topo-types';
import type { Point2D } from '../../../../rendering/types/Types';
import { bimEdgeResolutionStore } from '../../../edges/bim-edge-resolution-store';
import { SECTION_PARITY_EXCLUDE_KEY } from '../../../systems/section/section-parity-overlay';
import { TERRAIN_DISPLAY_DROP_MM } from '../../../../systems/topography/vertical-datum';
import { breaklineDashPattern } from '../../../../systems/topography/topo-breakline-style';

// ─── Ελεγχόμενα stores ────────────────────────────────────────────────────────────────────────
const mockWorld = {
  visible: true,
  /** ADR-920 Β3.4 — το «μάτι» των ασυνεχειών (ξεχωριστό από το έδαφος). */
  breaklinesShown: true,
  breaklines: [] as readonly Breakline[],
  cropRing: null as readonly Point2D[] | null,
  cutY: null as number | null,
};
const mockListeners = new Set<() => void>();
const mockUnsubscribed = { count: 0 };
/** Μετρητής, όχι το `Set`: και οι επτά συνδρομές δίνουν το ΙΔΙΟ callback (το rebuild της βάσης). */
const mockSubscribed = { count: 0 };
const mockSubscribe = (cb: () => void): (() => void) => {
  mockListeners.add(cb);
  mockSubscribed.count++;
  return () => { mockListeners.delete(cb); mockUnsubscribed.count++; };
};
/** Κάποιο store άλλαξε — όλα πυροδοτούν το ίδιο rebuild. */
const fire = (): void => { for (const cb of [...mockListeners]) cb(); };

jest.mock('../../../../systems/topography/TopoPointStore', () => ({
  subscribeTopo: (cb: () => void) => mockSubscribe(cb),
  getTopoBreaklines: () => mockWorld.breaklines,
  getActiveCropRing: () => (mockWorld.cropRing ? { vertices: mockWorld.cropRing } : null),
}));
jest.mock('../../../../systems/topography/terrain-3d-store', () => ({
  subscribeTerrain3D: (cb: () => void) => mockSubscribe(cb),
  getTerrain3DState: () => ({ visible: mockWorld.visible }),
}));
jest.mock('../../../../systems/topography/topo-breakline-display-store', () => ({
  subscribeBreaklineDisplay: (cb: () => void) => mockSubscribe(cb),
  getBreaklineDisplayState: () => ({ visible: mockWorld.breaklinesShown, focusedId: null }),
}));
jest.mock('../../../../systems/geo-referencing/geo-reference-store', () => ({
  subscribeGeoReference: (cb: () => void) => mockSubscribe(cb),
  getGeoReference: () => null,
  getActiveWorldToDisplayProjector: () => null,
}));
jest.mock('../../../../systems/topography/vertical-datum', () => ({
  ...jest.requireActual('../../../../systems/topography/vertical-datum'),
  getActiveVerticalDatumMm: () => 0,
}));
jest.mock('../terrain-clip-plane', () => ({ resolveTopoHorizontalCutWorldY: () => mockWorld.cutY }));
jest.mock('../../../../systems/levels/active-storey-store', () => ({
  useActiveStoreyStore: { subscribe: (cb: () => void) => mockSubscribe(cb) },
}));
jest.mock('../../../stores/ViewMode3DStore', () => ({
  useViewMode3DStore: { subscribe: (cb: () => void) => mockSubscribe(cb) },
}));
jest.mock('../../../../state/bim-render-settings-store', () => ({
  useBimRenderSettingsStore: { subscribe: (cb: () => void) => mockSubscribe(cb) },
}));
jest.mock('../../../converters/topo-breakline-to-three', () => {
  const actual = jest.requireActual('../../../converters/topo-breakline-to-three');
  return { topoBreaklinesToGeometries: jest.fn(actual.topoBreaklinesToGeometries) };
});

// eslint-disable-next-line import/first -- τα mocks πρέπει να προηγούνται
import { topoBreaklinesToGeometries } from '../../../converters/topo-breakline-to-three';
// eslint-disable-next-line import/first
import { TopoBreaklineLayer, TOPO_BREAKLINE_RENDER_ORDER } from '../TopoBreaklineLayer';

const convert = topoBreaklinesToGeometries as jest.MockedFunction<typeof topoBreaklinesToGeometries>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────────────────────
const DROP_M = TERRAIN_DISPLAY_DROP_MM / 1000;
const line = (id: string, vertices: TopoPoint3D[], extra: Partial<Breakline> = {}): Breakline =>
  ({ id, vertices, closed: false, ...extra });
/** Ανεβαίνει από 1 m σε 3 m — world Y (με το drop) από 0.95 σε 2.95. */
const RISING = line('rise', [{ x: 0, y: 0, z: 1_000 }, { x: 10_000, y: 0, z: 3_000 }]);
const DOTTED = line('dot', [{ x: 0, y: 5_000, z: 1_000 }, { x: 10_000, y: 5_000, z: 1_000 }], { elevationSource: 'surface' });

let scene: THREE.Scene;
let layer: TopoBreaklineLayer | null;

function build(): TopoBreaklineLayer {
  layer = new TopoBreaklineLayer(scene, () => {});
  return layer;
}
const root = (): THREE.Object3D => scene.getObjectByName('topo-breaklines')!;
const named = (name: string): THREE.Object3D[] => root().children.filter((c) => c.name === name);
/** Οι world-Y των άκρων ενός fat pass (instanceStart/End). */
function fatWorldYs(obj: THREE.Object3D): number[] {
  const geo = (obj as THREE.Mesh).geometry;
  const start = geo.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
  const end = geo.getAttribute('instanceEnd') as THREE.InterleavedBufferAttribute;
  const ys: number[] = [];
  for (let i = 0; i < start.count; i++) ys.push(start.getY(i) - DROP_M, end.getY(i) - DROP_M);
  return ys;
}

beforeEach(() => {
  bimEdgeResolutionStore.setSize(800, 600, 1);
  Object.assign(mockWorld, { visible: true, breaklinesShown: true, breaklines: [RISING, DOTTED], cropRing: null, cutY: null });
  mockListeners.clear();
  mockUnsubscribed.count = 0;
  mockSubscribed.count = 0;
  convert.mockClear();
  scene = new THREE.Scene();
  layer = null;
});
afterEach(() => layer?.dispose());

describe('TopoBreaklineLayer — πύλη ορατότητας (Δ1)', () => {
  it('έδαφος σβηστό ⇒ άδειο root, ούτε καν προβολή', () => {
    mockWorld.visible = false;
    build();
    expect(root().children).toHaveLength(0);
    expect(convert).not.toHaveBeenCalled();
  });

  it('έδαφος αναμμένο μετά ⇒ εμφανίζονται· ξανασβηστό ⇒ φεύγουν', () => {
    mockWorld.visible = false;
    build();
    mockWorld.visible = true;
    fire();
    expect(root().children.length).toBeGreaterThan(0);
    mockWorld.visible = false;
    fire();
    expect(root().children).toHaveLength(0);
  });

  it('ADR-920 Β3.4 — «μάτι» κλειστό με έδαφος ΑΝΑΜΜΕΝΟ ⇒ άδειο root, ούτε καν προβολή', () => {
    mockWorld.breaklinesShown = false;
    build();
    expect(root().children).toHaveLength(0);
    expect(convert).not.toHaveBeenCalled();
  });

  it('ADR-920 Β3.4 — άνοιγμα του ματιού ⇒ εμφανίζονται· κλείσιμο ⇒ φεύγουν (η ΙΔΙΑ πύλη με το έδαφος)', () => {
    build();
    expect(root().children.length).toBeGreaterThan(0);
    mockWorld.breaklinesShown = false;
    fire();
    expect(root().children).toHaveLength(0);
    mockWorld.breaklinesShown = true;
    fire();
    expect(root().children.length).toBeGreaterThan(0);
  });
});

describe('TopoBreaklineLayer — passes', () => {
  it('ένα casing για όλα, ένα core ανά μοτίβο, δαχτυλίδι + γέμισμα κουκκίδας', () => {
    build();
    expect(named('topo-breaklines-casing')).toHaveLength(1);
    expect(named('topo-breaklines-core')).toHaveLength(2); // συνεχής + τελείες
    expect(named('topo-breaklines-disc-outline')).toHaveLength(1);
    expect(named('topo-breaklines-disc-fill')).toHaveLength(1);
  });

  it('σειρά ζωγραφικής: casing < core < δαχτυλίδι < γέμισμα, όλα > 0 (depthWrite:false)', () => {
    build();
    const order = (name: string): number => named(name)[0]!.renderOrder;
    expect(order('topo-breaklines-casing')).toBe(TOPO_BREAKLINE_RENDER_ORDER.casing);
    expect(order('topo-breaklines-core')).toBe(TOPO_BREAKLINE_RENDER_ORDER.core);
    expect(order('topo-breaklines-disc-outline')).toBe(TOPO_BREAKLINE_RENDER_ORDER.discOutline);
    expect(order('topo-breaklines-disc-fill')).toBe(TOPO_BREAKLINE_RENDER_ORDER.discFill);
    expect(Math.min(...Object.values(TOPO_BREAKLINE_RENDER_ORDER))).toBeGreaterThan(0);
  });

  it('το casing κουβαλά τα τμήματα ΟΛΩΝ των μοτίβων (2 τμήματα ⇒ 4 άκρα)', () => {
    build();
    expect(fatWorldYs(named('topo-breaklines-casing')[0]!)).toHaveLength(4);
  });

  it('κάθε fat pass είναι εκτός stencil parity (LineSegments2 = Mesh με depthTest)', () => {
    build();
    for (const name of ['topo-breaklines-casing', 'topo-breaklines-core']) {
      for (const obj of named(name)) expect(obj.userData[SECTION_PARITY_EXCLUDE_KEY]).toBe(true);
    }
  });

  it('κάθε pass έχει ΔΙΚΟ του geometry (κανένα διπλό dispose)', () => {
    build();
    const geometries = root().children.map((c) => (c as THREE.Mesh).geometry);
    expect(new Set(geometries).size).toBe(geometries.length);
  });

  it('κάθε μοτίβο έχει το ΔΙΚΟ του υλικό core (συνεχής ≠ τελείες ≠ casing)', () => {
    expect(breaklineDashPattern('surface')).not.toBeNull(); // η προϋπόθεση: οι τελείες ΕΧΟΥΝ μοτίβο
    build();
    const materials = [...named('topo-breaklines-core'), ...named('topo-breaklines-casing')]
      .map((m) => (m as THREE.Mesh).material);
    expect(new Set(materials).size).toBe(3);
  });

  it('καμία ασυνέχεια ⇒ άδειο root', () => {
    mockWorld.breaklines = [];
    build();
    expect(root().children).toHaveLength(0);
  });
});

describe('TopoBreaklineLayer — κοπή στη στάθμη του topo scope (CPU)', () => {
  it('χωρίς κοπή ⇒ ολόκληρη η γραμμή (0.95 → 2.95 world Y)', () => {
    mockWorld.breaklines = [RISING];
    build();
    const ys = fatWorldYs(named('topo-breaklines-core')[0]!);
    expect(Math.min(...ys)).toBeCloseTo(1 - DROP_M, 5);
    expect(Math.max(...ys)).toBeCloseTo(3 - DROP_M, 5);
  });

  it('κοπή που διασχίζει ⇒ η γραμμή σταματά ΑΚΡΙΒΩΣ στη στάθμη, η πάνω κουκκίδα φεύγει', () => {
    mockWorld.breaklines = [RISING];
    mockWorld.cutY = 2;
    build();
    const ys = fatWorldYs(named('topo-breaklines-core')[0]!);
    expect(Math.max(...ys)).toBeCloseTo(2, 5);
    const disc = named('topo-breaklines-disc-fill')[0] as THREE.Points;
    expect(disc.geometry.getAttribute('position').count).toBe(1);
  });

  it('κοπή κάτω από όλα ⇒ καμία mesh (όχι άδειο buffer)', () => {
    mockWorld.cutY = 0;
    build();
    expect(root().children).toHaveLength(0);
  });

  it('αλλαγή ΜΟΝΟ της στάθμης ⇒ ξανακόβει χωρίς να ξαναπροβάλει', () => {
    build();
    expect(convert).toHaveBeenCalledTimes(1);
    mockWorld.cutY = 2;
    fire();
    mockWorld.cutY = 1.5;
    fire();
    expect(convert).toHaveBeenCalledTimes(1);
    expect(Math.max(...fatWorldYs(named('topo-breaklines-casing')[0]!))).toBeCloseTo(1.5, 5);
  });

  it('αλλαγή ασυνεχειών ⇒ ξαναπροβάλλει', () => {
    build();
    mockWorld.breaklines = [RISING];
    fire();
    expect(convert).toHaveBeenCalledTimes(2);
  });

  it('καμία αλλαγή (π.χ. άσχετη ρύθμιση απόδοσης) ⇒ ίδια παιδιά, καμία ανακατασκευή', () => {
    build();
    const before = [...root().children];
    fire();
    expect(root().children).toEqual(before);
  });
});

describe('TopoBreaklineLayer — κύκλος ζωής', () => {
  it('dispose ⇒ όλες οι συνδρομές κλείνουν, το root φεύγει από τη σκηνή, τα geometries ελευθερώνονται', () => {
    const l = build();
    const geometries = root().children.map((c) => (c as THREE.Mesh).geometry);
    const freed = geometries.map((g) => jest.spyOn(g, 'dispose'));
    const subscriptions = mockSubscribed.count;
    l.dispose();
    layer = null;
    expect(subscriptions).toBe(7); // topo · ορατότητα · μάτι ασυνεχειών · όροφος · floor scope · ρυθμίσεις · γεωαναφορά
    expect(mockUnsubscribed.count).toBe(subscriptions);
    expect(scene.getObjectByName('topo-breaklines')).toBeUndefined();
    for (const spy of freed) expect(spy).toHaveBeenCalled();
  });
});
