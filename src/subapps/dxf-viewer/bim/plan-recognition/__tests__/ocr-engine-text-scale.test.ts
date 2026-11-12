/**
 * ADR-929 §6.16 βήμα 3 — η **ενορχήστρωση** του κινητήρα όταν ο συντελεστής βγαίνει από το ύψος γραμμάτων:
 * - απόφαση ίση με τον αδρό ⇒ **μία** ανίχνευση (οι ανιχνεύσεις του αδρού ξαναχρησιμοποιούνται)·
 * - απόφαση λεπτότερη ⇒ δεύτερη ανίχνευση στον νέο συντελεστή, και τα κουτιά βγαίνουν από **αυτήν**·
 * - η πρόοδος `detect` μόνο ανεβαίνει, και το σύνολο μεγαλώνει μία φορά·
 * - ρητός συντελεστής ⇒ κανένα αδρό πέρασμα.
 * Η πολιτική (αδρός · απόφαση) αντικαθίσταται εδώ, για να τρέξουν και οι δύο κλάδοι σε μικρή εικόνα.
 */

import { blankPlanRaster, type PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { recognizePlanText, type OcrModels, type OcrProgress } from '../ocr/ocr-engine';
import type { RecognizerOutput } from '../ocr/ocr-rec-decode';
import type { OcrTensor } from '../ocr/ocr-tensors';

const policy = { probe: 2, decided: 2 };

jest.mock('../ocr/ocr-scale', () => {
  const actual = jest.requireActual<typeof import('../ocr/ocr-scale')>('../ocr/ocr-scale');
  return {
    ...actual,
    probeDownscaleFor: () => policy.probe,
    downscaleForTextHeight: () => policy.decided,
  };
});

/** Λευκή εικόνα με μαύρη «λέξη» `[x0, x1) × [y0, y1)`. */
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

/** Οι διαστάσεις (όψη) κάθε πλακιδίου που είδε ο ανιχνευτής. */
const seen: { width: number; height: number }[] = [];

const models: OcrModels = {
  detect: async (input: OcrTensor) => {
    const [, , h, w] = input.dims;
    seen.push({ width: w, height: h });
    const data = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) data[i] = input.data[i] < 1.5 ? 1 : 0;
    return { data, width: w, height: h, stride: w };
  },
  db: { thresh: 0.3, boxThresh: 0.6, unclipRatio: 1.5 },
  primary: {
    height: 48,
    classes: ['', 'T'],
    run: async (): Promise<RecognizerOutput> => ({ data: Float32Array.from([0, 1]), steps: 1, classes: 2 }),
  },
};

const source = rasterWithWord(400, 200, 100, 80, 220, 100);

async function recognize(downscale?: number) {
  const progress: OcrProgress[] = [];
  const result = await recognizePlanText(source, models, { downscale, onProgress: (p) => progress.push(p) });
  return { result, detect: progress.filter((p) => p.stage === 'detect') };
}

beforeEach(() => { seen.length = 0; });

describe('recognizePlanText χωρίς συντελεστή — αδρό πέρασμα, μετά απόφαση από το ύψος γραμμάτων', () => {
  it('απόφαση = αδρός ⇒ ΜΙΑ ανίχνευση (2 περάσματα στη μισή), ο συντελεστής στην έξοδο', async () => {
    policy.probe = 2; policy.decided = 2;
    const { result, detect } = await recognize();
    expect(seen).toHaveLength(2);
    expect(result.downscale).toBe(2);
    expect(result.texts.map((t) => t.text)).toEqual(['T']);
    expect(detect.at(-1)).toEqual({ stage: 'detect', done: 2, total: 2 });
  });

  it('απόφαση λεπτότερη ⇒ δεύτερη ανίχνευση στην αρχική, τα κουτιά από ΑΥΤΗΝ', async () => {
    policy.probe = 2; policy.decided = 1;
    const { result, detect } = await recognize();
    expect(seen).toHaveLength(4);
    expect(result.downscale).toBe(1);
    expect(result.texts).toHaveLength(1);
    const xs = result.texts[0].polygon.map((p) => p.x);
    expect(Math.min(...xs)).toBeLessThanOrEqual(100);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(220);
    const done = detect.map((p) => p.done);
    expect(done).toEqual([...done].sort((a, b) => a - b));
    expect(new Set(detect.map((p) => p.total))).toEqual(new Set([2, 4]));
    expect(detect.at(-1)).toEqual({ stage: 'detect', done: 4, total: 4 });
  });
});

describe('recognizePlanText με ρητό συντελεστή — κανένα αδρό πέρασμα', () => {
  it('downscale 1 ⇒ μόνο τα 2 περάσματα στην αρχική, ό,τι κι αν λέει η πολιτική', async () => {
    policy.probe = 3; policy.decided = 3;
    const { result } = await recognize(1);
    expect(seen).toHaveLength(2);
    expect(result.downscale).toBe(1);
  });
});
