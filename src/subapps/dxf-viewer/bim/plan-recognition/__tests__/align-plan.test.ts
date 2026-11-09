/**
 * ADR-929 Φ1 — η ευθυγράμμιση πάνω σε **συνθετικά** δείγματα με ακριβή αλήθεια (Δ13.1).
 *
 * 🔑 Η κλίση δεν ελέγχεται απέναντι σε δικό της αριθμό: η αλυσίδα `ευθυγραμμισμένη → αρχική (Φ1) → σκηνή (SSoT της Φ0)`
 *   πρέπει να στέλνει τον άξονα x της ευθυγραμμισμένης εικόνας **πάνω σε τοίχο της κάτοψης** (γωνία 0 mod 90°). Λάθος
 *   πρόσημο, λάθος κέντρο ή λάθος σύνθεση σπάνε αυτή την ισότητα, όποια κι αν είναι η σύμβαση της κλίσης.
 */

import { describe, expect, it } from '@jest/globals';

import { applyAffine } from '@/lib/geometry/affine-2x3';
import { applyHomography, invertHomography, quadToQuad, rectQuad, type Homography, type Quad } from '@/lib/geometry/homography';
import { blankPlanRaster, type PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { straighteningRotation, warpHomography } from '@/lib/geometry/raster/raster-warp';
import { rasterToSceneAffine } from '../../../floorplan-background/geometry/raster-scene-mapping';
import { alignPlan, workingScaleFor } from '../alignment/align-plan';
import { createPlanAligner } from '../alignment/plan-align-client';
import { handlePlanAlign, planAlignReplyTransfer } from '../alignment/plan-align-host';
import { DEFAULT_PLAN_SEGMENTS, extractPlanSegments, minFillPxFor } from '../segments/plan-segments';
import { MODEL_FROM_DRAWING_LIMITS } from '../../../config/tolerance-config';
import { colourfulFraction, planInkMask, resolveBinarization } from '../alignment/plan-ink';
import { SAMPLE_HOUSE_WALLS, renderSyntheticPlan, type SyntheticPlanSpec } from '../testing/synthetic-plan-raster';
import type { SyntheticDimension } from '../testing/synthetic-dimensions';

const BASE: SyntheticPlanSpec = {
  walls: SAMPLE_HOUSE_WALLS,
  pxPerMm: 0.05,
  marginMm: 500,
  wallStyle: 'filled',
  strokePx: 2,
  rotationDeg: 0,
  degradation: null,
};

const OLD_SCAN = { seed: 42, noiseAmplitude: 25, yellowing: 0.8 } as const;

/** Περιγραμμένοι τοίχοι στην κλίμακα των τεστ αναγνώρισης (τα δωμάτια γίνονται ορθογώνια κελιά). */
const OUTLINED: SyntheticPlanSpec = { ...BASE, pxPerMm: 0.06, marginMm: 600, wallStyle: 'outlined' };
/** Εξωτερική παρειά των τοίχων 25 cm του δείγματος (άξονας ± 125 mm). */
const OUT = 125;
const SOUTH_EAST_DIMENSIONS: readonly SyntheticDimension[] = [
  { from: { x: -OUT, y: -OUT }, to: { x: 6000 + OUT, y: -OUT }, offsetMm: -875, terminator: 'tick', label: '6.25', text: 'above' },
  { from: { x: 6000 + OUT, y: -OUT }, to: { x: 6000 + OUT, y: 4000 + OUT }, offsetMm: -875, terminator: 'tick', label: '4.25', text: 'above' },
];

/** Η γωνία (mod 90°, στο [−45, 45)) με την οποία ο άξονας x της ευθυγραμμισμένης εικόνας πέφτει στη σκηνή. */
function residualSceneAngleDeg(alignedToOriginal: Homography, toScene: ReturnType<typeof rasterToSceneAffine>, at: { x: number; y: number }): number {
  const a = applyAffine(toScene, applyHomography(alignedToOriginal, at.x, at.y));
  const b = applyAffine(toScene, applyHomography(alignedToOriginal, at.x + 200, at.y));
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return ((((deg + 45) % 90) + 90) % 90) - 45;
}

function iou(a: Uint8Array, b: Uint8Array): number {
  let inter = 0, union = 0;
  for (let i = 0; i < a.length; i++) { inter += a[i] & b[i]; union += a[i] | b[i]; }
  return union === 0 ? 1 : inter / union;
}

describe('alignPlan — ίσιωμα σάρωσης (Δ14 β)', () => {
  it.each([0.8, -1.7, 3.4, -6.2])('στραβή σάρωση %p°: ο άξονας x πέφτει πάνω στους τοίχους με σφάλμα < 0,1°', (rotationDeg) => {
    const plan = renderSyntheticPlan({ ...BASE, rotationDeg, degradation: OLD_SCAN });
    const result = alignPlan(plan.image);
    expect(result.skew.applied).toBe(true);
    expect(Math.abs(Math.abs(result.skew.angleDeg) - Math.abs(rotationDeg))).toBeLessThan(0.1);
    const centre = { x: result.image.width / 2, y: result.image.height / 2 };
    expect(Math.abs(residualSceneAngleDeg(result.alignedToOriginal, rasterToSceneAffine(plan.placement), centre))).toBeLessThan(0.1);
  });

  it('ίσια σάρωση: καμία περιστροφή (δεν θολώνει χωρίς λόγο), ομογραφία = ταυτότητα', () => {
    const plan = renderSyntheticPlan({ ...BASE, degradation: OLD_SCAN });
    const result = alignPlan(plan.image);
    expect(result.skew.applied).toBe(false);
    const p = applyHomography(result.alignedToOriginal, 123.5, 77.25);
    expect(p.x).toBeCloseTo(123.5, 9);
    expect(p.y).toBeCloseTo(77.25, 9);
  });

  it('οι δύο ομογραφίες είναι αντίστροφες', () => {
    const result = alignPlan(renderSyntheticPlan({ ...BASE, rotationDeg: 2.5 }).image);
    for (const [x, y] of [[0, 0], [100, 40], [result.image.width, result.image.height]]) {
      const there = applyHomography(result.alignedToOriginal, x, y);
      const back = applyHomography(result.originalToAligned, there.x, there.y);
      expect(back.x).toBeCloseTo(x, 6);
      expect(back.y).toBeCloseTo(y, 6);
    }
  });

  it('ο καμβάς της περιστροφής χωρά ολόκληρο το φύλλο (καμία γωνία δεν κόβεται)', () => {
    const { outputToInput, width, height } = straighteningRotation(400, 300, 7);
    const inputToOutput = invertHomography(outputToInput) as Homography;
    for (const p of rectQuad(400, 300)) {
      const q = applyHomography(inputToOutput, p.x, p.y);
      expect(q.x).toBeGreaterThanOrEqual(-1e-6);
      expect(q.y).toBeGreaterThanOrEqual(-1e-6);
      expect(q.x).toBeLessThanOrEqual(width + 1e-6);
      expect(q.y).toBeLessThanOrEqual(height + 1e-6);
    }
  });
});

describe('alignPlan — καθαρισμός κιτρινίσματος και θορύβου', () => {
  it('κιτρινισμένο χαρτί ⇒ ουδέτερο λευκό, και το μελάνι ταιριάζει με το καθαρό πρωτότυπο (IoU > 0,9)', () => {
    const clean = renderSyntheticPlan(BASE);
    const old = renderSyntheticPlan({ ...BASE, degradation: OLD_SCAN });
    const result = alignPlan(old.image);
    expect(result.binarization).toBe('scan');
    // Μέσος όρος περιοχής 12 × 12 χαρτιού (ο θόρυβος ±25 ανά pixel μένει: δεν είναι δουλειά του flat-field).
    const mean = [0, 0, 0];
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) for (let c = 0; c < 3; c++) mean[c] += result.image.rgba[(y * result.image.width + x) * 4 + c] / 144;
    expect(Math.min(...mean)).toBeGreaterThan(240);
    expect(Math.max(...mean) - Math.min(...mean)).toBeLessThan(6);
    const truth = planInkMask(clean.image, 'scan');
    expect(iou(result.ink, truth)).toBeGreaterThan(0.9);
  });

  it('γεμάτος τοίχος poché ΔΕΝ αδειάζει στο κέντρο του (ολικό ή τοπικό κατώφλι)', () => {
    const plan = renderSyntheticPlan({ ...BASE, pxPerMm: 0.2, degradation: OLD_SCAN }); // τοίχος 25 cm = 50 px > παράθυρο
    const result = alignPlan(plan.image, { deskew: false });
    const toScene = rasterToSceneAffine(plan.placement);
    // Η στήλη στο 40% του πλάτους διασχίζει τον εξωτερικό τοίχο y = 0 (σκηνή, mm): ο άξονάς του, ±10 mm, πρέπει να είναι μελάνι.
    const x = Math.round(result.image.width * 0.4);
    const centreRows: number[] = [];
    for (let y = 0; y < result.image.height; y++) {
      if (Math.abs(applyAffine(toScene, { x: x + 0.5, y: y + 0.5 }).y) < 10) centreRows.push(y);
    }
    expect(centreRows.length).toBeGreaterThan(0);
    for (const y of centreRows) expect(result.ink[y * result.image.width + x]).toBe(1);
  });
});

/**
 * Η ίδια κάτοψη ως αγγελία: χώροι γεμάτοι με **σκούρο** ξύλο και μπλε πλακάκι, τοίχοι σκούροι.
 * 📏 Μετρημένο: με **ανοιχτά** χρώματα (μπεζ 214/182/140, γαλάζιο 120/170/225) και η δυαδοποίηση σάρωσης τα αφήνει
 *   χαρτί (IoU 1,0), γιατί το Otsu χωρίζει τον μαύρο τοίχο από όλα τα υπόλοιπα. Η διαφορά φαίνεται στα σκούρα γεμίσματα.
 */
function listingImage(): PlanRaster {
  const plan = renderSyntheticPlan(BASE);
  const rgba = Uint8ClampedArray.from(plan.image.rgba);
  const toScene = rasterToSceneAffine(plan.placement);
  for (let y = 0; y < plan.image.height; y++) {
    for (let x = 0; x < plan.image.width; x++) {
      const o = (y * plan.image.width + x) * 4;
      if (rgba[o] < 128) continue;
      const s = applyAffine(toScene, { x: x + 0.5, y: y + 0.5 });
      if (s.x <= 0 || s.x >= 6000 || s.y <= 0 || s.y >= 4000) continue;
      const fill = s.x < 3500 ? [150, 100, 55] : [50, 100, 175];
      for (let c = 0; c < 3; c++) rgba[o + c] = fill[c];
    }
  }
  return { rgba, width: plan.image.width, height: plan.image.height };
}

describe('δύο δυαδοποιήσεις (Δ14)', () => {
  it('η αγγελία αναγνωρίζεται αυτόματα, η κιτρινισμένη σάρωση ΟΧΙ', () => {
    expect(resolveBinarization(listingImage(), 'auto')).toBe('listing');
    expect(resolveBinarization(renderSyntheticPlan({ ...BASE, degradation: OLD_SCAN }).image, 'auto')).toBe('scan');
    expect(colourfulFraction(blankPlanRaster(10, 10))).toBe(0);
  });

  it('αγγελία: τα χρώματα των χώρων ΔΕΝ είναι μελάνι — η δυαδοποίηση σάρωσης θα τα έκανε', () => {
    const listing = listingImage();
    const truth = planInkMask(renderSyntheticPlan(BASE).image, 'scan');
    const asListing = alignPlan(listing, { deskew: false });
    expect(asListing.binarization).toBe('listing');
    expect(iou(asListing.ink, truth)).toBeGreaterThan(0.9);
    const asScan = planInkMask(listing, 'scan');
    expect(iou(asScan, truth)).toBeLessThan(iou(asListing.ink, truth) - 0.2);
  });
});

describe('προοπτική από 4 σημεία (Δ14 α)', () => {
  it('φωτογραφία με προοπτική ⇒ ορθογώνιο φύλλο· η ομογραφία στέλνει τις γωνίες του στις 4 γωνίες της φωτογραφίας', () => {
    const plan = renderSyntheticPlan(BASE);
    const w = plan.image.width, h = plan.image.height;
    const photoQuad: Quad = [{ x: 40, y: 30 }, { x: w + 20, y: 10 }, { x: w + 60, y: h + 50 }, { x: 10, y: h + 20 }];
    const sheetToPhoto = quadToQuad(rectQuad(w, h), photoQuad) as Homography;
    const photo = warpHomography(plan.image, invertHomography(sheetToPhoto) as Homography, w + 80, h + 80);
    const result = alignPlan(photo, { perspectiveQuad: photoQuad });
    expect(result.perspectiveApplied).toBe(true);
    const corners = rectQuad(result.image.width, result.image.height);
    corners.forEach((p, i) => {
      const q = applyHomography(result.alignedToOriginal, p.x, p.y);
      expect(Math.hypot(q.x - photoQuad[i].x, q.y - photoQuad[i].y)).toBeLessThan(1.5);
    });
    expect(Math.abs(result.skew.angleDeg)).toBeLessThan(0.2);
  });
});

describe('εικόνα εργασίας', () => {
  it('ο συντελεστής φέρνει την εικόνα κάτω από το όριο, και η ομογραφία τον περιέχει', () => {
    expect(workingScaleFor(8000, 6000, 12_000_000)).toBe(2);
    expect(workingScaleFor(100, 100, 12_000_000)).toBe(1);
    const plan = renderSyntheticPlan(BASE);
    const result = alignPlan(plan.image, { maxWorkingPixels: Math.floor((plan.image.width * plan.image.height) / 3.5), deskew: false });
    expect(result.workingScale).toBe(2);
    const p = applyHomography(result.alignedToOriginal, 10, 20);
    expect([p.x, p.y]).toEqual([20, 40]);
  });
});

/** Φύλλο με (ή χωρίς) πλαίσιο, πινακίδα κάτω-δεξιά (πίνακας 3 × 2 με «κείμενο») και την κάτοψη στη μέση. */
function sheetImage(framed = true): { raster: PlanRaster; title: { minX: number; minY: number; maxX: number; maxY: number } } {
  const W = 1200, H = 850;
  const r = blankPlanRaster(W, H);
  const ink = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < W && y < H) for (let c = 0; c < 3; c++) r.rgba[(y * W + x) * 4 + c] = 20; };
  const rect = (x0: number, y0: number, x1: number, y1: number, t: number) => {
    for (let x = x0; x <= x1; x++) for (let k = 0; k < t; k++) { ink(x, y0 + k); ink(x, y1 - k); }
    for (let y = y0; y <= y1; y++) for (let k = 0; k < t; k++) { ink(x0 + k, y); ink(x1 - k, y); }
  };
  if (framed) rect(20, 20, W - 21, H - 21, 4);
  const title = { minX: 780, minY: 620, maxX: W - 24, maxY: H - 24 };
  rect(title.minX, title.minY, title.maxX + 3, title.maxY + 3, 3);
  for (const y of [690, 760]) for (let x = title.minX; x <= title.maxX; x++) { ink(x, y); ink(x, y + 1); }
  for (let y = title.minY; y <= title.maxY; y++) { ink(990, y); ink(991, y); }
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let k = 0; k < 120; k++) {
    const x0 = Math.floor(title.minX + 15 + rnd() * 360), y0 = Math.floor(title.minY + 12 + rnd() * 180);
    if ([690, 760].some((y) => Math.abs(y0 - y) < 12) || Math.abs(x0 - 990) < 12) continue;
    for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 4; x++) ink(x, y);
  }
  rect(250, 180, 650, 520, 10); // το σπίτι, με περιθώριο από το πλαίσιο
  for (let y = 180; y <= 520; y++) for (let k = 0; k < 6; k++) ink(450 + k, y);
  return { raster: r, title };
}

describe('διάταξη φύλλου — πλαίσιο και πινακίδα (Δ15 #4)', () => {
  it('βρίσκει το πλαίσιο, και την πινακίδα κάτω-δεξιά — όχι τα δωμάτια του σπιτιού', () => {
    const { raster, title } = sheetImage();
    const result = alignPlan(raster, { deskew: false });
    const sheet = result.sheet;
    expect(sheet?.frame).not.toBeNull();
    expect(sheet?.frame?.aligned).toEqual({ minX: 24, minY: 24, maxX: 1176, maxY: 826 });
    const best = sheet?.annotations[0];
    expect(best).toBeDefined();
    if (best === undefined) return;
    expect(best.anchoredTo).toEqual(expect.arrayContaining(['right', 'bottom']));
    expect(best.cellCount).toBeGreaterThanOrEqual(3);
    const b = best.region.originalBounds;
    expect(Math.abs(b.minX - title.minX)).toBeLessThan(8);
    expect(Math.abs(b.minY - title.minY)).toBeLessThan(8);
    for (const block of sheet?.annotations ?? []) expect(block.region.aligned.maxX <= 250 || block.region.aligned.minX >= 650 || block.region.aligned.minY >= 520).toBe(true);
  });

  it('χωρίς πλαίσιο: περιοχή σχεδίου = ολόκληρη η εικόνα, καμία ψευδής πινακίδα από τα δωμάτια', () => {
    const result = alignPlan(renderSyntheticPlan(BASE).image, { deskew: false });
    expect(result.sheet?.frame).toBeNull();
    expect(result.sheet?.drawing.aligned).toEqual({ minX: 0, minY: 0, maxX: result.image.width, maxY: result.image.height });
    expect(result.sheet?.annotations).toEqual([]);
  });

  /**
   * ADR-929 §6.10 #2 — χωρίς πλαίσιο, πινακίδα είναι μόνο **πλήρης πίνακας** (πεδία + κείμενο + γωνία). Τα δωμάτια ενός
   * περιγραμμένου σπιτιού είναι ορθογώνια κελιά χωρίς τίποτα πέρα από αυτά στο λευκό περιθώριο: πριν τον κανόνα γίνονταν
   * «πινακίδες» (μετρημένο: 9 συνθετικά, οι τοίχοι τους χάνονταν).
   */
  it.each<[string, SyntheticPlanSpec]>([
    ['περίγραμμα, −11°, παλιά σάρωση (2 δωμάτια, 4 ακραίες πλευρές)', { ...OUTLINED, rotationDeg: -11, degradation: OLD_SCAN }],
    ['περίγραμμα, διαστάσεις νότια + ανατολικά (1 κελί, 1–2 ακραίες)', { ...OUTLINED, marginMm: 400, dimensions: SOUTH_EAST_DIMENSIONS }],
    ['περίγραμμα, περιθώριο 1200, 1,3°, παλιά σάρωση (3 ακραίες)', { ...OUTLINED, marginMm: 1200, rotationDeg: 1.3, degradation: OLD_SCAN }],
  ])('χωρίς πλαίσιο, %s: τα δωμάτια ΔΕΝ είναι πινακίδα', (_name, spec) => {
    const sheet = alignPlan(renderSyntheticPlan(spec).image).sheet;
    expect(sheet?.frame).toBeNull();
    expect(sheet?.annotations).toEqual([]);
  });

  it('χωρίς πλαίσιο, πλήρης πίνακας στη γωνία: προτείνεται (πεδία + κείμενο + γωνία) — όχι τα δωμάτια', () => {
    const { raster, title } = sheetImage(false);
    const sheet = alignPlan(raster, { deskew: false }).sheet;
    expect(sheet?.frame).toBeNull();
    expect(sheet?.annotations).toHaveLength(1);
    const block = sheet?.annotations[0];
    if (block === undefined) return;
    expect(block.anchoredTo).toEqual(expect.arrayContaining(['right', 'bottom']));
    expect(block.cellCount).toBeGreaterThanOrEqual(3);
    expect(block.confidence).toBe(1);
    expect(Math.abs(block.region.originalBounds.minX - title.minX)).toBeLessThan(8);
    expect(Math.abs(block.region.originalBounds.minY - title.minY)).toBeLessThan(8);
  });
});

describe('Worker: host + πελάτης', () => {
  it('ο host δίνει ό,τι και η άμεση κλήση· η απάντηση μεταφέρει εικόνα και μελάνι', () => {
    const plan = renderSyntheticPlan({ ...BASE, rotationDeg: 1.2 });
    const direct = alignPlan(plan.image);
    const viaHost = handlePlanAlign({ kind: 'align', raster: plan.image });
    expect(viaHost.alignment.skew).toEqual(direct.skew);
    expect(Array.from(viaHost.alignment.ink)).toEqual(Array.from(direct.ink));
    expect(viaHost.segments).toBeNull(); // δεν ζητήθηκαν: η προεπισκόπηση δεν τα πληρώνει
    expect(planAlignReplyTransfer(viaHost)).toHaveLength(2);
  });

  it('τμήματα στο ΙΔΙΟ ταξίδι: ό,τι και η άμεση κλήση, με όριο γεμίσματος από την κλίμακα (SSoT)', () => {
    const spec = { ...BASE, wallStyle: 'filled' as const, rotationDeg: 1.3 };
    const scale = { metresPerPixelX: 0.001 / spec.pxPerMm, metresPerPixelY: 0.001 / spec.pxPerMm, source: 'gallery-scale' as const };
    const reply = handlePlanAlign({ kind: 'align', raster: renderSyntheticPlan(spec).image, segments: { scale } });
    const minFillPx = minFillPxFor(reply.alignment, scale);
    expect(minFillPx).toBeCloseTo((MODEL_FROM_DRAWING_LIMITS.WALL_PAIR_MIN_THICKNESS_MM * spec.pxPerMm) / reply.alignment.workingScale, 9);
    const direct = extractPlanSegments(reply.alignment, { ...DEFAULT_PLAN_SEGMENTS, minFillPx });
    expect(reply.segments).toEqual(direct);
    expect(reply.segments?.segments.length).toBeGreaterThan(0);
    expect(minFillPxFor(reply.alignment, null)).toBeNull(); // άγνωστη κλίμακα: καμία υπόθεση (Δ4)
  });

  it('χωρίς Worker ⇒ δίχτυ στον κύριο νήμα με τον ίδιο κώδικα', async () => {
    const aligner = createPlanAligner({ spawn: () => null });
    const result = await aligner.align(renderSyntheticPlan(BASE).image, { options: { deskew: false } });
    expect(result.kind).toBe('ok');
    aligner.dispose();
  });
});
