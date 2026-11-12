/**
 * ADR-929 §6.16 βήμα 3 — **συντελεστής μείωσης από το μετρημένο ύψος γραμμάτων**.
 *
 * Οι περιπτώσεις «Παλαιολόγου» και «Μαιάνδρου» είναι οι μετρήσεις της παραγωγής (§6.16 #5): το ύψος p10 που μέτρησε το
 * αδρό πέρασμα (ds 3) σε px της εγγενούς εικόνας, και ο συντελεστής που έδωσε την καλύτερη ποιότητα στον μικρότερο χρόνο.
 */

import type { Quad } from '@/lib/geometry/homography';
import {
  downscaleForTextHeight, OCR_SCALE, probeDownscaleFor, smallTextHeightPx, textHeightOf,
} from '../ocr/ocr-scale';
import type { OcrCandidate } from '../ocr/ocr-tiles';

const rect = (x: number, y: number, w: number, h: number): Quad =>
  [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

const candidate = (height: number, fits = true): OcrCandidate => {
  const polygon = rect(0, 0, 4 * height, height);
  return { pass: 0, detScore: 0.9, cropQuad: polygon, polygon, bbox: { x0: 0, y0: 0, x1: 4 * height, y1: height }, fits };
};

describe('probeDownscaleFor — το αδρό πέρασμα χωρά στον προϋπολογισμό του', () => {
  it('οι εικόνες αναφοράς: Παλαιολόγου 7696×7200 ⇒ 3 · Μαιάνδρου 8719×7339 ⇒ 3 · 4000×3367 ⇒ 2 · 2000×2000 ⇒ 1', () => {
    expect(probeDownscaleFor({ width: 7696, height: 7200 })).toBe(3);
    expect(probeDownscaleFor({ width: 8719, height: 7339 })).toBe(3);
    expect(probeDownscaleFor({ width: 4000, height: 3367 })).toBe(2);
    expect(probeDownscaleFor({ width: 2000, height: 2000 })).toBe(1);
  });

  it('ο μικρότερος ακέραιος που χωρά', () => {
    const side = Math.floor(Math.sqrt(OCR_SCALE.probeMaxPixels));
    expect(probeDownscaleFor({ width: side, height: side })).toBe(1);
    expect(probeDownscaleFor({ width: side + 1, height: side + 1 })).toBe(2);
  });
});

describe('textHeightOf — η μικρή πλευρά του περιστρεμμένου ορθογωνίου', () => {
  it('όρθιο και κατακόρυφο κουτί δίνουν το ίδιο ύψος γραμμάτων', () => {
    expect(textHeightOf(rect(10, 10, 120, 30))).toBeCloseTo(30);
    expect(textHeightOf(rect(10, 10, 30, 120))).toBeCloseTo(30);
  });

  it('κουτί στραμμένο 30°: η πλευρά, όχι το αξονικό πλαίσιο', () => {
    const c = Math.cos(Math.PI / 6);
    const s = Math.sin(Math.PI / 6);
    const at = (u: number, v: number) => ({ x: u * c - v * s, y: u * s + v * c });
    expect(textHeightOf([at(0, 0), at(100, 0), at(100, 20), at(0, 20)])).toBeCloseTo(20);
  });
});

describe('smallTextHeightPx — το p10 των κουτιών που ταιριάζουν', () => {
  it('λιγότερα από minSamples ⇒ null (καμία μαντεψιά)', () => {
    const few = Array.from({ length: OCR_SCALE.minSamples - 1 }, () => candidate(30));
    expect(smallTextHeightPx(few)).toBeNull();
  });

  it('τα κουτιά που ΔΕΝ ταιριάζουν (σπασμένα γλυφά) δεν μετρούν', () => {
    const fit = Array.from({ length: OCR_SCALE.minSamples }, () => candidate(30));
    const unfit = Array.from({ length: 100 }, () => candidate(5, false));
    expect(smallTextHeightPx([...fit, ...unfit])).toBeCloseTo(30);
  });

  it('nearest-rank: 1…100 ⇒ 10', () => {
    const heights = Array.from({ length: 100 }, (_, i) => candidate(100 - i));
    expect(smallTextHeightPx(heights)).toBeCloseTo(10);
  });
});

describe('downscaleForTextHeight — ο μεγαλύτερος ds που κρατά τα μικρά γράμματα ορατά, όχι πάνω από τον αδρό', () => {
  it('Παλαιολόγου (p10 24,6 px, αδρός 3) ⇒ 1 — 19/32 έναντι 15/32 με ds 2', () => {
    expect(downscaleForTextHeight(24.6, 3)).toBe(1);
  });

  it('Μαιάνδρου (p10 47,3 px, αδρός 3) ⇒ 3 — οι ανιχνεύσεις του αδρού ξαναχρησιμοποιούνται', () => {
    expect(downscaleForTextHeight(47.3, 3)).toBe(3);
  });

  it('το κατώφλι είναι ανάμεσα στα μετρημένα όρια (12,4 px χάνει · 15,8 px όχι)', () => {
    expect(OCR_SCALE.minTextHeightPx).toBeGreaterThan(12.4);
    expect(OCR_SCALE.minTextHeightPx).toBeLessThanOrEqual(15.8);
  });

  it('χωρίς μέτρηση ⇒ 1 · πολύ μικρά γράμματα ⇒ 1 · πολύ μεγάλα ⇒ ο αδρός, ποτέ πάνω', () => {
    expect(downscaleForTextHeight(null, 3)).toBe(1);
    expect(downscaleForTextHeight(5, 3)).toBe(1);
    expect(downscaleForTextHeight(500, 3)).toBe(3);
    expect(downscaleForTextHeight(500, 1)).toBe(1);
  });
});
