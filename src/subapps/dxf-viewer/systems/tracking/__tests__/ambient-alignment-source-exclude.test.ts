/**
 * ADR-557 — collectAmbientAlignmentAnchors excludes the entity/-ies being MOVED (no self-OTRACK).
 *
 * A moving MULTI-LINE text used to lock its OWN insertion point (which sits far below the box-centre
 * anchor) as an alignment anchor, drowning out the real neighbour cyan traces (Giorgio browser-verify
 * 2026-07-07). A single-line text hid the bug because its origin ≈ the grabbed base point (dedup). The
 * fix mirrors the OSNAP `excludeEntityId` in `corner-projection-snap`: skip the dragged id(s) in the scan.
 */
import { collectAmbientAlignmentAnchors } from '../ambient-alignment-source';
import type { Entity } from '../../../types/entities';

const text = (id: string, x: number, y: number) =>
  ({ id, type: 'text', position: { x, y } } as unknown as Entity);

// Cursor axis-aligned with BOTH texts (same column as t1, same row as t2) within a generous gate.
const CURSOR = { x: 0, y: 2 };
const CFG = { radiusWorld: 50, maxMembers: 10, axisToleranceWorld: 3 };

describe('ADR-557 — ambient scan excludes the dragged entity', () => {
  const entities = [text('t1', 0, 0), text('t2', 10, 0)];

  it('with no exclusion both insertion points emit anchors', () => {
    const anchors = collectAmbientAlignmentAnchors(CURSOR, entities, CFG);
    const xs = anchors.map(a => a.x).sort((a, b) => a - b);
    expect(xs).toEqual([0, 10]);
  });

  it('excluding the dragged text drops ONLY its own insertion point', () => {
    const anchors = collectAmbientAlignmentAnchors(CURSOR, entities, CFG, new Set(['t1']));
    expect(anchors.map(a => a.x)).toEqual([10]);
    expect(anchors.some(a => a.x === 0 && a.y === 0)).toBe(false);
  });

  it('excluding a non-present id is a no-op (all anchors kept)', () => {
    const anchors = collectAmbientAlignmentAnchors(CURSOR, entities, CFG, new Set(['nope']));
    expect(anchors.map(a => a.x).sort((a, b) => a - b)).toEqual([0, 10]);
  });
});
