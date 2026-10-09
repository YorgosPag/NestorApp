/**
 * ADR-909 Β2.7 / ADR-370 — η **read-only κάτοψη** σέβεται τα στρώματα **του εγγράφου** που φόρτωσε.
 *
 * Μετρημένο ζωντανά 2026-10-09 στη σελίδα ακινήτου («95 τ.μ.»): στρώμα 632 στοιχείων κρυφό **και** παγωμένο
 * ⇒ 336.978 px μελανιού πριν, 336.978 μετά — ζωγραφιζόταν ολόκληρο. Η προβολή δεν γεμίζει το `LayerStore`
 * του επεξεργαστή (και δεν πρέπει), άρα ο έλεγχος «κρυφό στρώμα;» δεν είχε από πού να ρωτήσει.
 *
 *   Ρ0  μάρτυρας: όλα ορατά ⇒ χαράζονται ΚΑΙ οι δύο γραμμές
 *   Ρ1  κρυφό στρώμα του εγγράφου ⇒ η γραμμή του ΔΕΝ χαράζεται
 *   Ρ2  παγωμένο στρώμα ⇒ το ίδιο
 *   Ρ3  🔑 το `LayerStore` του επεξεργαστή λέει «ορατό» για το ίδιο id ⇒ ΔΕΝ το ρωτάμε· ισχύει το έγγραφο
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import type { DxfSceneData } from '@/types/file-record';
import { createPaintLog, createRecordingCanvas, type PaintLog } from '@/subapps/dxf-viewer/testing/paint-recorder';
import { __resetLayerStoreForTesting, setLayers } from '@/subapps/dxf-viewer/stores/LayerStore';
import { createSceneLayer } from '@/subapps/dxf-viewer/types/scene-types';
import type { SceneLayer } from '@/subapps/dxf-viewer/types/entities';

import { renderFloorplanScene } from '@/components/shared/files/media/floorplan-scene-render';

const BOUNDS = { min: { x: 0, y: 0 }, max: { x: 1000, y: 600 } };

function layer(id: string, flags: { visible?: boolean; frozen?: boolean } = {}): SceneLayer {
  return { ...createSceneLayer({ id, name: id, visible: flags.visible ?? true }), frozen: flags.frozen ?? false };
}

/** Νέο αντικείμενο κάθε φορά: η μετατροπή της σκηνής κρατιέται σε WeakMap ανά ταυτότητα. */
function sceneData(layers: SceneLayer[]): DxfSceneData {
  return {
    entities: [
      { id: 'ent_a', type: 'line', layerId: 'lyr_a', visible: true, start: { x: 100, y: 200 }, end: { x: 400, y: 200 } },
      { id: 'ent_b', type: 'line', layerId: 'lyr_b', visible: true, start: { x: 100, y: 400 }, end: { x: 600, y: 400 } },
    ],
    layersById: Object.fromEntries(layers.map((l) => [l.id, l])),
    bounds: BOUNDS,
    units: 'mm',
  } as unknown as DxfSceneData;
}

/** Πόσα ευθύγραμμα τμήματα χαράχτηκαν, ως μήκη σε px (ταξινομημένα). */
function strokedLengths(log: PaintLog): number[] {
  const out: number[] = [];
  for (const s of log.strokes) {
    for (let i = 0; i + 1 < s.points.length; i += 2) {
      out.push(Math.round(Math.hypot(s.points[i + 1].x - s.points[i].x, s.points[i + 1].y - s.points[i].y)));
    }
  }
  return out.sort((a, b) => a - b);
}

function paint(layers: SceneLayer[]): number[] {
  const log = createPaintLog();
  renderFloorplanScene(createRecordingCanvas(log), sceneData(layers), BOUNDS, 1, { x: 0, y: 0 }, 'light');
  return strokedLengths(log);
}

beforeEach(__resetLayerStoreForTesting);

describe('read-only κάτοψη — στρώματα του εγγράφου', () => {
  it('Ρ0 μάρτυρας: όλα ορατά ⇒ δύο γραμμές, η Β μακρύτερη από την Α', () => {
    const all = paint([layer('lyr_a'), layer('lyr_b')]);
    expect(all).toHaveLength(2);
    expect(all[1]).toBeGreaterThan(all[0]);
  });

  it('Ρ1 κρυφό στρώμα ⇒ η γραμμή του δεν χαράζεται', () => {
    const [shortA, longB] = paint([layer('lyr_a'), layer('lyr_b')]);
    expect(paint([layer('lyr_a', { visible: false }), layer('lyr_b')])).toEqual([longB]);
    expect(paint([layer('lyr_a'), layer('lyr_b', { visible: false })])).toEqual([shortA]);
  });

  it('Ρ2 παγωμένο στρώμα ⇒ η γραμμή του δεν χαράζεται', () => {
    const [shortA] = paint([layer('lyr_a'), layer('lyr_b')]);
    expect(paint([layer('lyr_a'), layer('lyr_b', { frozen: true })])).toEqual([shortA]);
  });

  it('Ρ3 το LayerStore του επεξεργαστή δεν ερωτάται — ισχύει το έγγραφο, και προς τις δύο κατευθύνσεις', () => {
    const [shortA, longB] = paint([layer('lyr_a'), layer('lyr_b')]);

    setLayers([layer('lyr_a'), layer('lyr_b')]);
    expect(paint([layer('lyr_a', { visible: false }), layer('lyr_b')])).toEqual([longB]);

    setLayers([layer('lyr_a', { visible: false }), layer('lyr_b', { frozen: true })]);
    expect(paint([layer('lyr_a'), layer('lyr_b')])).toEqual([shortA, longB]);
  });
});
