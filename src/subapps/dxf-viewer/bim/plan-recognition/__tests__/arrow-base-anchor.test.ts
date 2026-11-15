/**
 * ⚓ ADR-929 §6.21.2 — μονάδα: **το σώμα του βέλους** (`detectTerminator` → `arrowBody`) και **η βάση δεν είναι άγκυρα**
 * (`extensionMatches`), σε μάσκα μελανιού ζωγραφισμένη με το χέρι, στη γεωμετρία του ΤΕΣΤ2 (βέλος 14 px · μισό πλάτος 3 px).
 *
 * Το τεστ από άκρη σε άκρη (`dimension-arrow-base.test.ts`) δείχνει ότι η βάση **δεν** γίνεται άγκυρα. Εδώ ελέγχονται και οι
 * **φύλακες** απέναντι στο αντίθετο λάθος — μια πραγματική επέκταση που απορρίπτεται επειδή περνά κοντά σε βέλος:
 * πέρα από το μήκος του βέλους, ή μέσα στο σώμα αλλά **όχι** πάνω στους βραχίονες, η επέκταση μένει επέκταση.
 */

import { describe, expect, it } from '@jest/globals';
import type { InkMask } from '@/lib/geometry/raster/ink-probe';
import type { PlanePoint } from '@/lib/geometry/homography';
import { detectTerminator, type ArrowBody } from '../classify/dimension-terminators';
import { extensionMatches } from '../classify/extension-lines';
import type { FramedSegment } from '../classify/segment-frame';

const COLS = 140;
const ROWS = 100;
const Y = 50;
const APEX_X = 20;
const ARROW: ArrowBody = { lengthPx: 14, halfWidthPx: 3, apexOffsetPx: 0 };
const SCALE = { strokePx: 1, textPx: 10 };

function framed(id: string, a: PlanePoint, b: PlanePoint): FramedSegment {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  return { id, a, b, u, n: { x: -u.y, y: u.x }, length, width: 1, style: 'stroke' };
}

function maskOf(lines: readonly (readonly [PlanePoint, PlanePoint])[]): InkMask {
  const mask = new Uint8Array(COLS * ROWS);
  for (const [a, b] of lines) {
    const steps = Math.ceil(4 * Math.hypot(b.x - a.x, b.y - a.y));
    for (let i = 0; i <= steps; i++) {
      const x = Math.floor(a.x + ((b.x - a.x) * i) / steps);
      const y = Math.floor(a.y + ((b.y - a.y) * i) / steps);
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS) mask[y * COLS + x] = 1;
    }
  }
  return { mask, cols: COLS, rows: ROWS };
}

/** Κάθετη πινελιά που τέμνει τη γραμμή διάστασης `s` px μέσα από την κορυφή, από `−half` ως `+half`. */
const across = (id: string, s: number, half: number): FramedSegment =>
  framed(id, { x: APEX_X + s + 0.5, y: Y + 0.5 - half }, { x: APEX_X + s + 0.5, y: Y + 0.5 + half });

const DIM = framed('dim', { x: APEX_X + 0.5, y: Y + 0.5 }, { x: APEX_X + 100.5, y: Y + 0.5 });

function anchorIds(strokes: readonly FramedSegment[], withArrow: boolean): string[] {
  const ink = maskOf([DIM, ...strokes].map((s) => [s.a, s.b] as const));
  const arrowAt = (id: string, which: 'start' | 'end') => (withArrow && id === DIM.id && which === 'start' ? ARROW : null);
  return (extensionMatches(ink, [DIM], [DIM, ...strokes], SCALE, arrowAt).get(DIM.id)?.anchors ?? []).map((a) => a.extensionId);
}

describe('ADR-929 §6.21.2 — το σώμα του βέλους', () => {
  it('μετράται στο μελάνι: κλειστό άγεμιστο βέλος 14 × ±3 px', () => {
    const tip = { x: APEX_X + 0.5, y: Y + 0.5 };
    const left = { x: tip.x + 14, y: tip.y - 3 };
    const right = { x: tip.x + 14, y: tip.y + 3 };
    const ink = maskOf([[tip, { x: tip.x + 100, y: tip.y }], [tip, left], [tip, right], [left, right]]);
    const t = detectTerminator(ink, DIM, 'start', { strokePx: 1, reachPx: 16 });
    expect(t.kind).toBe('arrow');
    expect(t.arrowBody?.lengthPx).toBeGreaterThan(12.5);
    expect(t.arrowBody?.lengthPx).toBeLessThan(15.5);
    expect(t.arrowBody?.halfWidthPx).toBeGreaterThan(2);
    expect(t.arrowBody?.halfWidthPx).toBeLessThan(4);
  });
});

describe('ADR-929 §6.21.2 — η βάση δεν είναι άγκυρα, οι πραγματικές επεκτάσεις μένουν', () => {
  const tipExtension = across('tip', 0, 9);
  const base = across('base', ARROW.lengthPx, ARROW.halfWidthPx);

  it('ΧΩΡΙΣ το σώμα του βέλους η βάση περνά για επέκταση (αλλιώς το τεστ δεν ελέγχει τίποτα)', () => {
    expect(anchorIds([tipExtension, base], false)).toEqual(['tip', 'base']);
  });

  it('ΜΕ το σώμα: η βάση φεύγει, η βοηθητική στην κορυφή μένει', () => {
    expect(anchorIds([tipExtension, base], true)).toEqual(['tip']);
  });

  it('πέρα από το μήκος του βέλους, πάνω στην προέκταση των βραχιόνων: μένει επέκταση', () => {
    const s = 2 * ARROW.lengthPx;
    expect(anchorIds([across('beyond', s, (s * ARROW.halfWidthPx) / ARROW.lengthPx)], true)).toEqual(['beyond']);
  });

  it('μέσα στο σώμα αλλά ΟΧΙ πάνω στους βραχίονες: μένει επέκταση', () => {
    expect(anchorIds([across('long', 8, 10)], true)).toEqual(['long']);
  });
});
