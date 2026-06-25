/**
 * ADR-524 — pure batch-fill orchestrator: majority frame color, same-color
 * rectangle filtering, idempotency (filled vs unfilled), full scan.
 */

import {
  resolveRectFrameColorHex,
  findSameColorRects,
  rectAlreadyFilled,
  scanSameColorUnfilledRects,
  type EntityColorResolver,
} from '../column-batch-fill';
import { extractLineSegments, type DetectedRectangle } from '../../walls/wall-in-region';
import type { Entity } from '../../../types/entities';
import type { ColumnEntity } from '../../types/column-types';

/** LINE entity με χρώμα κωδικοποιημένο στο id-prefix (color resolver το διαβάζει). */
function line(color: string, n: number, ax: number, ay: number, bx: number, by: number): Entity {
  return { id: `${color}-${n}`, type: 'line', start: { x: ax, y: ay }, end: { x: bx, y: by } } as unknown as Entity;
}

/** 4 LINE entities πάνω στις ακμές ορθογωνίου [x,y]→[x+w,y+h], χρώμα `color`. */
function frame(color: string, base: number, x: number, y: number, w: number, h: number): Entity[] {
  return [
    line(color, base + 0, x, y, x + w, y),
    line(color, base + 1, x + w, y, x + w, y + h),
    line(color, base + 2, x + w, y + h, x, y + h),
    line(color, base + 3, x, y + h, x, y),
  ];
}

/** ColumnEntity με κέντρο στο (cx,cy) (μόνο τα πεδία που διαβάζει το idempotency φίλτρο). */
function column(id: string, cx: number, cy: number): Entity {
  return { id, type: 'column', params: { position: { x: cx, y: cy, z: 0 } } } as unknown as Entity;
}

function rect(x: number, y: number, w: number, h: number): DetectedRectangle {
  return {
    polygon: [
      { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
    ],
    longSide: Math.max(w, h),
    shortSide: Math.min(w, h),
    area: w * h,
  };
}

/** Resolver: χρώμα = ό,τι προηγείται του '-' στο entity.id (π.χ. 'brown-0' → 'brown'). */
const colorOf: EntityColorResolver = (e) => e.id.split('-')[0] ?? null;

const TOL = 1;

describe('resolveRectFrameColorHex — majority frame color', () => {
  it('4 καφέ ακμές → "brown"', () => {
    const entities = frame('brown', 0, 0, 0, 100, 200);
    const segs = extractLineSegments(entities);
    const byId = new Map(entities.map((e) => [e.id, e]));
    expect(resolveRectFrameColorHex(rect(0, 0, 100, 200), segs, TOL, byId, colorOf)).toBe('brown');
  });

  it('majority κερδίζει όταν μία ακμή είναι άλλου χρώματος', () => {
    const entities = [
      line('brown', 0, 0, 0, 100, 0),
      line('brown', 1, 100, 0, 100, 200),
      line('brown', 2, 100, 200, 0, 200),
      line('blue', 3, 0, 200, 0, 0), // 1 μπλε ακμή
    ];
    const segs = extractLineSegments(entities);
    const byId = new Map(entities.map((e) => [e.id, e]));
    expect(resolveRectFrameColorHex(rect(0, 0, 100, 200), segs, TOL, byId, colorOf)).toBe('brown');
  });
});

describe('findSameColorRects — color pre-filter', () => {
  it('επιστρέφει μόνο ορθογώνια του ζητούμενου χρώματος', () => {
    const entities = [
      ...frame('brown', 0, 0, 0, 100, 200),
      ...frame('brown', 10, 500, 0, 100, 200),
      ...frame('blue', 20, 0, 500, 100, 200),
    ];
    expect(findSameColorRects(entities, 'brown', TOL, colorOf)).toHaveLength(2);
    expect(findSameColorRects(entities, 'blue', TOL, colorOf)).toHaveLength(1);
  });
});

describe('rectAlreadyFilled — idempotency', () => {
  const r = rect(0, 0, 100, 200);
  it('κολόνα με κέντρο μέσα → filled', () => {
    expect(rectAlreadyFilled(r, [column('c1', 50, 100) as unknown as ColumnEntity])).toBe(true);
  });
  it('κολόνα έξω → not filled', () => {
    expect(rectAlreadyFilled(r, [column('c1', 999, 999) as unknown as ColumnEntity])).toBe(false);
  });
});

describe('scanSameColorUnfilledRects — full scan', () => {
  it('2 όμοια πλαίσια, το 1 ήδη γεμισμένο → προτείνει το άλλο', () => {
    const entities = [
      ...frame('brown', 0, 0, 0, 100, 200), // πλαίσιο A (μόλις γέμισε)
      ...frame('brown', 10, 500, 0, 100, 200), // πλαίσιο B (αγέμιστο)
      ...frame('blue', 20, 0, 500, 100, 200), // άλλο χρώμα — αγνοείται
      column('colA', 50, 100), // κολόνα μέσα στο A
    ];
    const segs = extractLineSegments(entities);
    const placed = rect(0, 0, 100, 200);
    const { rects, colorHex } = scanSameColorUnfilledRects(placed, segs, entities, TOL, colorOf);
    expect(colorHex).toBe('brown');
    expect(rects).toHaveLength(1); // μόνο το B
    // το προτεινόμενο είναι το πλαίσιο B (γύρω στο x≈500)
    expect(rects[0].polygon.some((p) => Math.abs(p.x - 500) < 1)).toBe(true);
  });

  it('όλα γεμισμένα → καμία πρόταση', () => {
    const entities = [
      ...frame('brown', 0, 0, 0, 100, 200),
      ...frame('brown', 10, 500, 0, 100, 200),
      column('colA', 50, 100),
      column('colB', 550, 100),
    ];
    const segs = extractLineSegments(entities);
    const { rects } = scanSameColorUnfilledRects(rect(0, 0, 100, 200), segs, entities, TOL, colorOf);
    expect(rects).toHaveLength(0);
  });
});
