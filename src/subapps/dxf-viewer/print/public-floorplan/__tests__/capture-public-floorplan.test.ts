/**
 * ADR-909 Β2.3 — ΑΓΚΥΡΕΣ της **λήψης** της δημόσιας κάτοψης.
 *
 *   Δ1  διαστάσεις: μακριά πλευρά σταθερή, κοντή από τον λόγο πλευρών, ΑΚΕΡΑΙΕΣ
 *   Δ2  όρθια κάτοψη ⇒ όρθια εικόνα · στενόμακρη ⇒ όχι λωρίδα λίγων pixels
 *   Δ3  χωρίς όρια / εκφυλισμένα όρια ⇒ καμία εικόνα
 *   Κ1  το κάδρο είναι ό,τι ΔΕΙΧΝΟΥΝ τα pixels: οι γωνίες του γυρίζουν στις γωνίες της εικόνας
 *   Λ1  στον αποδότη φτάνει ΜΟΝΟ ό,τι επιτρέπει το προφίλ — και η συνταγή λέει πώς βγήκε
 *   Λ2  🏆 η απόδοση τρέχει ΜΕΣΑ στην όψη της δημόσιας κάτοψης (απομόνωση συνεδρίας αόρατη)
 *   Λ3  τίποτα να φανεί ⇒ `no-geometry`, χωρίς απόδοση
 *   Λ4  εικόνα πάνω από το ταβάνι ⇒ `too-large` · αποτυχία κωδικοποίησης ⇒ `encode-failed`
 *   Λ5  τα bytes που επιστρέφονται είναι ΑΥΤΑ που έβγαλε ο καμβάς (το ίδιο αντικείμενο)
 */

import { PUBLIC_FLOORPLAN_PROFILE, readFloorplanRenderRecipe } from '@/lib/listings/floorplan-render-recipe';
import { FLOORPLAN_MAX_BYTES } from '@/lib/listings/floorplan-publication-contract';

import type { DxfEntityUnion, DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import type { SceneModel } from '../../../types/entities';
import {
  __resetIsolateEffectsForTesting,
  getIsolateEffectsSnapshot,
  setIsolateEffects,
} from '../../../systems/isolate/IsolateEffectsStore';
import { convertSceneForCapture, renderDxfSceneOffscreen } from '../../capture/capture-2d';
import {
  capturePublicFloorplan,
  publicFloorplanFrameOf,
  publicFloorplanRasterOf,
} from '../capture-public-floorplan';

jest.mock('../../capture/capture-2d', () => ({
  convertSceneForCapture: jest.fn(),
  renderDxfSceneOffscreen: jest.fn(),
}));

const convert = convertSceneForCapture as jest.Mock;
const render = renderDxfSceneOffscreen as jest.Mock;

const line = (id: string, x1: number, y1: number, x2: number, y2: number, type = 'line'): DxfEntityUnion =>
  ({ id, type, layerId: 'lyr_1', visible: true, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }) as unknown as DxfEntityUnion;

const sceneOf = (entities: DxfEntityUnion[]): DxfScene =>
  ({ entities, layers: [], bounds: null }) as unknown as DxfScene;

const SOURCE = { entities: [] } as unknown as SceneModel;
const TRANSFORM = { scale: 2, offsetX: 10, offsetY: 20 };

/** Πλαστός καμβάς: θυμάται τι του ζητήθηκε και δίνει πίσω το `blob` που του ορίστηκε. */
function fakeCanvas(blob: Blob | null): HTMLCanvasElement {
  const ctx = { save: jest.fn(), restore: jest.fn(), fillRect: jest.fn(), fillStyle: '', globalCompositeOperation: '' };
  return {
    width: 4096,
    height: 2048,
    getContext: () => ctx,
    toBlob: (done: (result: Blob | null) => void) => done(blob),
  } as unknown as HTMLCanvasElement;
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetIsolateEffectsForTesting();
});

describe('Δ — πόσα pixels', () => {
  const box = (w: number, h: number) => ({ min: { x: 0, y: 0 }, max: { x: w, y: h } });

  it('Δ1 μακριά πλευρά σταθερή, κοντή από τον λόγο πλευρών, ακέραιες', () => {
    const raster = publicFloorplanRasterOf(box(15000, 9333));
    expect(raster).toMatchObject({ widthPx: 4096, heightPx: 2549 });
    expect(Number.isInteger(raster?.heightPx)).toBe(true);
  });

  it('Δ2 όρθια ⇒ όρθια εικόνα · στενόμακρη ⇒ όχι λωρίδα', () => {
    expect(publicFloorplanRasterOf(box(5000, 10000))).toMatchObject({ widthPx: 2048, heightPx: 4096 });
    expect(publicFloorplanRasterOf(box(100000, 10))).toMatchObject({ widthPx: 4096, heightPx: 512 });
  });

  it('Δ3 χωρίς όρια / εκφυλισμένα ⇒ καμία εικόνα', () => {
    expect(publicFloorplanRasterOf(null)).toBeNull();
    expect(publicFloorplanRasterOf(box(0, 0))).toBeNull();
    expect(publicFloorplanRasterOf(box(Number.NaN, 10))).toBeNull();
  });
});

describe('Κ — το κάδρο', () => {
  it('Κ1 οι γωνίες του κάδρου γυρίζουν στις γωνίες της εικόνας', () => {
    const viewport = { width: 4096, height: 2048 };
    const frame = publicFloorplanFrameOf(TRANSFORM, viewport);

    expect(frame.maxX).toBeGreaterThan(frame.minX);
    expect(frame.maxY).toBeGreaterThan(frame.minY);

    const corners = [
      CoordinateTransforms.worldToScreen({ x: frame.minX, y: frame.minY }, TRANSFORM, viewport),
      CoordinateTransforms.worldToScreen({ x: frame.maxX, y: frame.maxY }, TRANSFORM, viewport),
    ];
    const xs = corners.map((p) => Math.round(p.x)).sort((a, b) => a - b);
    const ys = corners.map((p) => Math.round(p.y)).sort((a, b) => a - b);
    expect(xs).toStrictEqual([0, 4096]);
    expect(ys).toStrictEqual([0, 2048]);
  });
});

describe('Λ — η λήψη', () => {
  const PNG = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

  function arrange(entities: DxfEntityUnion[], blob: Blob | null = PNG): HTMLCanvasElement {
    const canvas = fakeCanvas(blob);
    convert.mockReturnValue(sceneOf(entities));
    render.mockReturnValue({ canvas, transform: TRANSFORM });
    return canvas;
  }

  it('Λ1 στον αποδότη φτάνει ΜΟΝΟ ό,τι επιτρέπει το προφίλ — και η συνταγή λέει πώς βγήκε', async () => {
    arrange([line('a', 0, 0, 15000, 0), line('b', 0, 0, 0, 9000), line('dim', 0, 0, 90000, 90000, 'dimension')]);

    const capture = await capturePublicFloorplan({ scene: SOURCE, furniture: true });

    const [rendered, viewport, input] = render.mock.calls[0] as [DxfScene, { width: number; height: number }, { plotStyle: string; minLineWidthPx?: number }];
    expect(rendered.entities.map((e) => e.id)).toStrictEqual(['a', 'b']);
    // 🔑 Το κάδρο δεν φούσκωσε από τη διάσταση που κόπηκε: 15000 × 9000 ⇒ 4096 × 2458.
    expect(viewport).toStrictEqual({ width: 4096, height: 2458 });
    expect(input.plotStyle).toBe('monochrome');
    // ADR-909 Β2.5 — καμία γραμμή κάτω από 1 px στο μικρότερο πλάτος ανάγνωσης (4096 / 1024).
    expect(input.minLineWidthPx).toBe(4);

    if (!capture.ok) throw new Error('expected a capture');
    expect(capture.recipe).toMatchObject({
      profileId: PUBLIC_FLOORPLAN_PROFILE.id,
      profileVersion: PUBLIC_FLOORPLAN_PROFILE.version,
      widthPx: 4096,
      heightPx: 2458,
      plotStyle: 'monochrome',
      furniture: true,
    });
    // Η ΙΔΙΑ κρίση με την πόρτα: η συνταγή που φτιάχνει ο viewer είναι αυτή που δέχεται ο διακομιστής.
    expect(readFloorplanRenderRecipe(JSON.parse(JSON.stringify(capture.recipe)))).toMatchObject({ ok: true });
  });

  it('Λ2 🏆 η απόδοση τρέχει ΜΕΣΑ στην όψη της δημόσιας κάτοψης', async () => {
    arrange([line('a', 0, 0, 100, 50)]);
    setIsolateEffects({ mode: 'freeze', isolatedLayerIds: [], isolatedEntityIds: ['other'], dimOpacityPercent: 30 });
    const seenDuringRender: boolean[] = [];
    render.mockImplementation(() => {
      seenDuringRender.push(getIsolateEffectsSnapshot().active);
      return { canvas: fakeCanvas(PNG), transform: TRANSFORM };
    });

    const capture = await capturePublicFloorplan({ scene: SOURCE, furniture: false });

    expect(capture.ok).toBe(true);
    expect(seenDuringRender).toStrictEqual([false]);
    expect(getIsolateEffectsSnapshot().active).toBe(true);
  });

  it('Λ3 τίποτα να φανεί ⇒ `no-geometry`, χωρίς απόδοση', async () => {
    arrange([line('dim', 0, 0, 100, 100, 'dimension')]);

    expect(await capturePublicFloorplan({ scene: SOURCE, furniture: false })).toStrictEqual({ ok: false, why: 'no-geometry' });
    expect(render).not.toHaveBeenCalled();
  });

  it('Λ4 πάνω από το ταβάνι ⇒ `too-large` · αποτυχία κωδικοποίησης ⇒ `encode-failed`', async () => {
    arrange([line('a', 0, 0, 100, 50)], { size: FLOORPLAN_MAX_BYTES + 1 } as Blob);
    expect(await capturePublicFloorplan({ scene: SOURCE, furniture: false })).toStrictEqual({ ok: false, why: 'too-large' });

    arrange([line('a', 0, 0, 100, 50)], null);
    expect(await capturePublicFloorplan({ scene: SOURCE, furniture: false })).toStrictEqual({ ok: false, why: 'encode-failed' });
  });

  it('Λ5 τα bytes που επιστρέφονται είναι ΑΥΤΑ που έβγαλε ο καμβάς', async () => {
    arrange([line('a', 0, 0, 100, 50)]);

    const capture = await capturePublicFloorplan({ scene: SOURCE, furniture: false });

    expect(capture.ok && capture.blob).toBe(PNG);
  });
});
