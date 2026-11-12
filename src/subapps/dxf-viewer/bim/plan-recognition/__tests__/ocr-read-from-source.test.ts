/**
 * ADR-929 §6.16 βήμα 2 — **ανίχνευση στη μειωμένη εικόνα, ανάγνωση από την ΑΡΧΙΚΗ**.
 *
 * Η άγκυρα ρωτά ευθέως: **από ποια εικόνα κόβει ο αναγνώστης;** Με συντελεστή 2 η παλιά ροή έκοβε από τη μειωμένη
 * (200 × 100)· η σωστή κόβει από την αρχική (400 × 200), με τετράπλευρο σε δείκτες pixel της αρχικής.
 * (Ένα μοτίβο ραβδώσεων 1 px που θα «έβλεπε» ο αναγνώστης δεν είναι αξιόπιστη άγκυρα: η αναδειγμάτιση σε ύψος 48 το
 * αλλοιώνει και στην αρχική — μετρημένο.)
 */

import { blankPlanRaster, type PlanRaster } from '@/lib/geometry/raster/plan-raster';
import type { Quad } from '@/lib/geometry/homography';
import { recognizePlanText, type OcrModels } from '../ocr/ocr-engine';
import type { DetectedBox } from '../ocr/ocr-det-postprocess';
import type { RecognizerOutput } from '../ocr/ocr-rec-decode';
import type { OcrTensor } from '../ocr/ocr-tensors';
import { toCandidate } from '../ocr/ocr-tiles';

const mockCrops: { image: PlanRaster; quad: Quad }[] = [];

jest.mock('../ocr/ocr-tensors', () => {
  const actual = jest.requireActual<typeof import('../ocr/ocr-tensors')>('../ocr/ocr-tensors');
  return {
    ...actual,
    cropReadingQuad: (image: PlanRaster, quad: Quad) => {
      mockCrops.push({ image, quad });
      return actual.cropReadingQuad(image, quad);
    },
  };
});

/** Λευκή εικόνα με μαύρο ορθογώνιο `[x0, x1) × [y0, y1)` — μια «λέξη». */
function rasterWithWord(width: number, height: number, x0: number, y0: number, x1: number, y1: number): PlanRaster {
  const r = blankPlanRaster(width, height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * width + x) * 4;
      r.rgba[o] = 0; r.rgba[o + 1] = 0; r.rgba[o + 2] = 0;
    }
  }
  return r;
}

/** Ψεύτικος ανιχνευτής: πιθανότητα 1 σε κάθε pixel που δεν είναι λευκό (λευκό κανονικοποιημένο ≈ 2,25 στο κανάλι 0). */
async function detectNonWhite(input: OcrTensor): Promise<{ data: Float32Array; width: number; height: number; stride: number }> {
  const [, , h, w] = input.dims;
  const data = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = input.data[i] < 1.5 ? 1 : 0;
  return { data, width: w, height: h, stride: w };
}

const models: OcrModels = {
  detect: detectNonWhite,
  db: { thresh: 0.3, boxThresh: 0.6, unclipRatio: 1.5 },
  primary: {
    classes: ['', 'T'],
    run: async (): Promise<RecognizerOutput> => ({ data: Float32Array.from([0, 1]), steps: 1, classes: 2 }),
  },
};

describe('recognizePlanText — ο αναγνώστης κόβει από την ΑΡΧΙΚΗ εικόνα', () => {
  const source = rasterWithWord(400, 200, 100, 80, 220, 100);

  beforeEach(() => { mockCrops.length = 0; });

  it.each([1, 2])('συντελεστής %i: κόψιμο από την αρχική, σε δείκτες της αρχικής', async (downscale) => {
    const { texts } = await recognizePlanText(source, models, { downscale });
    expect(texts.map((t) => t.text)).toEqual(['T']);
    expect(mockCrops.length).toBeGreaterThan(0);
    for (const c of mockCrops) expect(c.image).toBe(source);
    const xs = mockCrops[0].quad.map((p) => p.x);
    const ys = mockCrops[0].quad.map((p) => p.y);
    expect(Math.min(...xs)).toBeLessThanOrEqual(100);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(219);
    expect(Math.min(...ys)).toBeLessThanOrEqual(80);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(99);
    expect(Math.max(...xs)).toBeLessThan(400);
  });
});

describe('toCandidate — το cropQuad είναι σε δείκτες pixel της ΑΡΧΙΚΗΣ', () => {
  const box: DetectedBox = { rect: { cx: 10, cy: 5, width: 8, height: 4, angle: 0 }, score: 0.9 };
  const tile = { x: 3, y: 2, width: 64, height: 64 };

  it('συντελεστής 1: cropQuad = polygon − ½', () => {
    const c = toCandidate(box, tile, 0, 100, 1);
    c.cropQuad.forEach((p, i) => expect(p).toEqual({ x: c.polygon[i].x - 0.5, y: c.polygon[i].y - 0.5 }));
  });

  it.each([0, 1] as const)('πέρασμα %i, συντελεστής 2: cropQuad = (δείκτης ανίχνευσης + ½)·2 − ½', (pass) => {
    const one = toCandidate(box, tile, pass, 100, 1);
    const two = toCandidate(box, tile, pass, 100, 2);
    two.cropQuad.forEach((p, i) => {
      expect(p.x).toBeCloseTo((one.cropQuad[i].x + 0.5) * 2 - 0.5, 9);
      expect(p.y).toBeCloseTo((one.cropQuad[i].y + 0.5) * 2 - 0.5, 9);
    });
    two.polygon.forEach((p, i) => expect(two.cropQuad[i]).toEqual({ x: p.x - 0.5, y: p.y - 0.5 }));
  });
});
