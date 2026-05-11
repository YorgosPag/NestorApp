/**
 * ADR-344 Phase 3 — attachment-point unit tests.
 *
 * Exhaustively tests all 9 TextJustification values for both
 * resolveAttachmentPoint and offsetForJustification.
 */

import { resolveAttachmentPoint, offsetForJustification } from '../attachment-point';
import type { Rect } from '../attachment-point';
import type { TextJustification } from '../../types/text-ast.types';

const BOUNDS: Rect = { x: 10, y: 20, width: 100, height: 50 };

// ── resolveAttachmentPoint ────────────────────────────────────────────────────

describe('resolveAttachmentPoint', () => {
  it.each<[TextJustification, number, number]>([
    ['TL', 10,  20 ],
    ['TC', 60,  20 ],
    ['TR', 110, 20 ],
    ['ML', 10,  45 ],
    ['MC', 60,  45 ],
    ['MR', 110, 45 ],
    ['BL', 10,  70 ],
    ['BC', 60,  70 ],
    ['BR', 110, 70 ],
  ])('%s → (%f, %f)', (j, ex, ey) => {
    const pt = resolveAttachmentPoint(j, BOUNDS);
    expect(pt.x).toBeCloseTo(ex);
    expect(pt.y).toBeCloseTo(ey);
  });
});

// ── offsetForJustification ────────────────────────────────────────────────────

const W = 100;
const H = 50;
const UNIT_BOUNDS: Rect = { x: 0, y: 0, width: W, height: H };

describe('offsetForJustification', () => {
  it.each<[TextJustification, number, number]>([
    ['TL',    0,     0   ],
    ['TC',   -W / 2, 0   ],
    ['TR',   -W,     0   ],
    ['ML',    0,    -H / 2],
    ['MC',   -W / 2,-H / 2],
    ['MR',   -W,    -H / 2],
    ['BL',    0,    -H   ],
    ['BC',   -W / 2,-H   ],
    ['BR',   -W,    -H   ],
  ])('%s → dx=%f dy=%f', (j, edx, edy) => {
    const off = offsetForJustification(j, UNIT_BOUNDS);
    expect(off.dx).toBeCloseTo(edx);
    expect(off.dy).toBeCloseTo(edy);
  });
});

// ── roundtrip: insertion point + offset + attachment ─────────────────────────

describe('attachment roundtrip', () => {
  it.each<TextJustification>(['TL', 'TC', 'TR', 'ML', 'MC', 'MR', 'BL', 'BC', 'BR'])(
    '%s: attachment point of offset rect = insertion point',
    (j) => {
      const insertion = { x: 50, y: 80 };
      const dims = { width: 120, height: 60 };
      const tempBounds: Rect = { x: 0, y: 0, ...dims };
      const offset = offsetForJustification(j, tempBounds);

      // bounding box top-left in world space
      const bbox: Rect = {
        x: insertion.x + offset.dx,
        y: insertion.y + offset.dy,
        ...dims,
      };

      const anchor = resolveAttachmentPoint(j, bbox);

      // anchor must land back on the insertion point
      expect(anchor.x).toBeCloseTo(insertion.x);
      expect(anchor.y).toBeCloseTo(insertion.y);
    },
  );
});
