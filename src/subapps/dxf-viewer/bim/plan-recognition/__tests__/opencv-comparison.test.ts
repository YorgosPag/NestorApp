/**
 * @jest-environment node
 */
/**
 * ADR-929 §9.3 — **η μέτρηση** «opencv.js ή δικός μας κώδικας», για όσα έλειπαν: κλίση, προσαρμοστική δυαδοποίηση,
 * παραμόρφωση με ομογραφία. Ίδιες συνθετικές εικόνες, ίδια αλήθεια, ίδιο ρολόι.
 *
 * 🔑 **Τρέχει μόνο όταν δοθεί** `OPENCV_JS_PATH` (απόλυτη διαδρομή σε `opencv.js`, **εκτός** repo — το πακέτο ΔΕΝ
 *   εγκαθίσταται). Χωρίς αυτό: ρητό `SKIPPED`, ποτέ σιωπηλό πράσινο (ίδιος κανόνας με το χρυσό σύνολο, Δ13.1).
 *   `OPENCV_JS_PATH=…/opencv.js npx jest opencv-comparison`
 * 📏 Τα αποτελέσματα γράφονται στο ADR-929 §6.2· το test τα τυπώνει, δεν τα κρίνει.
 * ⚠️ **Οι ΧΡΟΝΟΙ εδώ δεν αντιπροσωπεύουν τον browser — μόνο οι ΑΚΡΙΒΕΙΕΣ.** Μετρημένο 2026-11-04: μέσα στο jest οι θερμοί
 *   βρόχοι JS (και του δικού μας κώδικα **και** του JS μέρους της συνταγής OpenCV) τρέχουν ~25–40× πιο αργά από σκέτο
 *   Node (`warpHomography` 2000×1500: 12,8 s στο jest, 0,47–0,55 s στο Node), ενώ ο κώδικας WASM του OpenCV όχι. Η
 *   αλλαγή του `jsc.target` του SWC σε es2022 **δεν** το άλλαξε. Οι χρόνοι του ADR μετρήθηκαν σε Node με τον ΙΔΙΟ κώδικα
 *   μεταγλωττισμένο από SWC (§6.2).
 */

import { describe, expect, it } from '@jest/globals';

import { applyHomography, quadToQuad, rectQuad, type Homography, type Quad } from '@/lib/geometry/homography';
import { warpHomography } from '@/lib/geometry/raster/raster-warp';
import { estimateSkew } from '@/lib/geometry/raster/skew-estimate';
import { cleanPlanImage, planInkMask } from '../alignment/plan-ink';
import { SAMPLE_HOUSE_WALLS, renderSyntheticPlan, type SyntheticPlanSpec } from '../testing/synthetic-plan-raster';

const OPENCV_PATH = process.env.OPENCV_JS_PATH;

const BASE: SyntheticPlanSpec = {
  walls: SAMPLE_HOUSE_WALLS, pxPerMm: 0.2, marginMm: 500, wallStyle: 'outlined', strokePx: 3,
  rotationDeg: 0, degradation: { seed: 42, noiseAmplitude: 25, yellowing: 0.8 },
};

/** Ελάχιστη επιφάνεια του opencv.js που χρησιμοποιεί η μέτρηση (χωρίς `any`: μόνο ό,τι καλούμε). */
interface CvMat { readonly rows: number; readonly cols: number; readonly data: Uint8Array; readonly data32S: Int32Array; delete(): void }
interface Cv {
  readonly Mat: new () => CvMat;
  readonly matFromImageData: (img: { data: Uint8ClampedArray; width: number; height: number }) => CvMat;
  readonly matFromArray: (rows: number, cols: number, type: number, data: readonly number[]) => CvMat;
  readonly Size: new (w: number, h: number) => unknown;
  readonly Scalar: new (...v: number[]) => unknown;
  readonly cvtColor: (src: CvMat, dst: CvMat, code: number) => void;
  readonly threshold: (src: CvMat, dst: CvMat, t: number, max: number, type: number) => number;
  readonly adaptiveThreshold: (src: CvMat, dst: CvMat, max: number, method: number, type: number, block: number, c: number) => void;
  readonly HoughLinesP: (src: CvMat, lines: CvMat, rho: number, theta: number, threshold: number, minLen: number, maxGap: number) => void;
  readonly warpPerspective: (src: CvMat, dst: CvMat, m: CvMat, size: unknown, flags: number, border: number, value: unknown) => void;
  readonly COLOR_RGBA2GRAY: number; readonly THRESH_BINARY_INV: number; readonly THRESH_OTSU: number;
  readonly ADAPTIVE_THRESH_GAUSSIAN_C: number; readonly CV_64F: number; readonly INTER_LINEAR: number; readonly BORDER_CONSTANT: number;
}

async function loadCv(path: string): Promise<{ readonly cv: Cv; readonly initMs: number }> {
  const t0 = performance.now();
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- μέτρηση εκτός γραφήματος εφαρμογής, διαδρομή εκτός repo
  const loaded: unknown = require(path);
  const cv = await new Promise<Cv>((resolve) => {
    const m = loaded as { then?: (f: (v: Cv) => void) => void; onRuntimeInitialized?: () => void; Mat?: unknown };
    if (typeof m.then === 'function') m.then((v) => resolve(v));
    else if (m.Mat !== undefined) resolve(m as Cv);
    else m.onRuntimeInitialized = () => resolve(m as Cv);
  });
  return { cv, initMs: performance.now() - t0 };
}

function time<T>(run: () => T): { readonly value: T; readonly ms: number } {
  run(); // ζέσταμα JIT
  const t0 = performance.now();
  const value = run();
  return { value, ms: performance.now() - t0 };
}

function iou(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let inter = 0, union = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] ? 1 : 0; const y = b[i] ? 1 : 0; inter += x & y; union += x | y; }
  return union === 0 ? 1 : inter / union;
}

/** Η «συνταγή» deskew του OpenCV: Otsu → HoughLinesP (0,05°) → διάμεσος γωνιών mod 90°. */
function opencvSkew(cv: Cv, ink: Uint8Array, cols: number, rows: number): number {
  const src = cv.matFromArray(rows, cols, 0, Array.from(ink, (v) => v * 255));
  const lines = new cv.Mat();
  cv.HoughLinesP(src, lines, 1, Math.PI / 3600, 80, Math.min(cols, rows) * 0.3, 5);
  const angles: number[] = [];
  for (let i = 0; i < lines.rows; i++) {
    const [x1, y1, x2, y2] = lines.data32S.slice(i * 4, i * 4 + 4);
    const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    angles.push(((((deg + 45) % 90) + 90) % 90) - 45);
  }
  src.delete(); lines.delete();
  angles.sort((a, b) => a - b);
  return angles.length === 0 ? Number.NaN : angles[Math.floor(angles.length / 2)];
}

function opencvAdaptive(cv: Cv, rgba: Uint8ClampedArray, width: number, height: number, c: number): Uint8Array {
  const src = cv.matFromImageData({ data: rgba, width, height });
  const gray = new cv.Mat();
  const out = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.adaptiveThreshold(gray, out, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 31, c);
  const result = Uint8Array.from(out.data, (v) => (v > 0 ? 1 : 0));
  src.delete(); gray.delete(); out.delete();
  return result;
}

function opencvWarp(cv: Cv, rgba: Uint8ClampedArray, width: number, height: number, outToSrc: Homography, outW: number, outH: number): number {
  const src = cv.matFromImageData({ data: rgba, width, height });
  const dst = new cv.Mat();
  const m = cv.matFromArray(3, 3, cv.CV_64F, [outToSrc.a, outToSrc.b, outToSrc.c, outToSrc.d, outToSrc.e, outToSrc.f, outToSrc.g, outToSrc.h, 1]);
  // WARP_INVERSE_MAP = 16: ο πίνακας είναι έξοδος → πηγή, όπως στο δικό μας warpHomography.
  cv.warpPerspective(src, dst, m, new cv.Size(outW, outH), cv.INTER_LINEAR | 16, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255));
  const first = dst.data[0];
  src.delete(); dst.delete(); m.delete();
  return first;
}

const describeIfOpencv = OPENCV_PATH ? describe : describe.skip;

describe('opencv.js — ρητή παράλειψη', () => {
  it(OPENCV_PATH ? 'OPENCV_JS_PATH δόθηκε: η μέτρηση τρέχει' : 'SKIPPED: δεν δόθηκε OPENCV_JS_PATH (η μέτρηση §9.3 δεν έτρεξε)', () => {
    expect(true).toBe(true);
  });
});

describeIfOpencv('ADR-929 §9.3 — opencv.js έναντι δικού μας κώδικα', () => {
  it('κλίση · δυαδοποίηση · παραμόρφωση', async () => {
    const { cv, initMs } = await loadCv(OPENCV_PATH as string);
    const rows: string[] = [`opencv.js init: ${initMs.toFixed(0)} ms`];
    for (const rotationDeg of [0.8, -1.7, 3.4, -6.2]) {
      const plan = renderSyntheticPlan({ ...BASE, rotationDeg });
      const clean = cleanPlanImage(plan.image, 'scan');
      const ink = planInkMask(clean, 'scan');
      const ours = time(() => estimateSkew(ink, clean.width, clean.height).angleDeg);
      const theirs = time(() => opencvSkew(cv, ink, clean.width, clean.height));
      rows.push(`skew ${rotationDeg}° (${clean.width}×${clean.height}): ours |err| ${Math.abs(Math.abs(ours.value) - Math.abs(rotationDeg)).toFixed(3)}° ${ours.ms.toFixed(0)} ms · opencv HoughLinesP |err| ${Math.abs(Math.abs(theirs.value) - Math.abs(rotationDeg)).toFixed(3)}° ${theirs.ms.toFixed(0)} ms`);
    }
    const truthPlan = renderSyntheticPlan({ ...BASE, degradation: null });
    const truth = planInkMask(truthPlan.image, 'scan');
    const degraded = renderSyntheticPlan(BASE).image;
    const oursInk = time(() => planInkMask(cleanPlanImage(degraded, 'scan'), 'scan'));
    rows.push(`binarize (${degraded.width}×${degraded.height}): ours flat-field+Otsu|Sauvola IoU ${iou(oursInk.value, truth).toFixed(3)} ${oursInk.ms.toFixed(0)} ms`);
    for (const c of [15, 40]) {
      const cvInk = time(() => opencvAdaptive(cv, Uint8ClampedArray.from(degraded.rgba), degraded.width, degraded.height, c));
      rows.push(`  opencv adaptiveThreshold(gauss,31,C=${c}) IoU ${iou(cvInk.value, truth).toFixed(3)} ${cvInk.ms.toFixed(0)} ms`);
    }
    const big = { rgba: new Uint8ClampedArray(2000 * 1500 * 4).fill(200), width: 2000, height: 1500 };
    const quad: Quad = [{ x: 40, y: 30 }, { x: 1950, y: 10 }, { x: 1990, y: 1480 }, { x: 10, y: 1460 }];
    const outToSrc = quadToQuad(rectQuad(2000, 1500), quad) as Homography;
    const oursWarp = time(() => warpHomography(big, outToSrc, 2000, 1500));
    const cvWarp = time(() => opencvWarp(cv, big.rgba, 2000, 1500, outToSrc, 2000, 1500));
    rows.push(`warp 2000×1500 perspective: ours ${oursWarp.ms.toFixed(0)} ms · opencv warpPerspective ${cvWarp.ms.toFixed(0)} ms`);
    expect(applyHomography(outToSrc, 0, 0).x).toBeCloseTo(40, 6);
    // eslint-disable-next-line no-console -- η έξοδος της μέτρησης ΕΙΝΑΙ το παραδοτέο (→ ADR-929 §6.2)
    console.log(`\n${rows.join('\n')}\n`);
  }, 600_000);
});
