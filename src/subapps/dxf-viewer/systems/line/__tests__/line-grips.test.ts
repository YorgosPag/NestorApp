/**
 * ADR-363 Slice F — plain DXF line rotation grip tests.
 *
 * Coverage:
 *   - `lineRotationHandlePos` = the `'axis-quarter'` point (centreline, ¼ axis
 *     length toward the EAST end) — the SAME SSoT the straight wall renders, so
 *     wall ↔ line parity is asserted by construction.
 *   - `applyLineRotationDrag` rotates start/end about the midpoint (default) and a
 *     picked pivot via the shared `rotateAxisPointsAboutPivot` SSoT (mirror wall).
 *   - The rotation handle opts into the SHARED hot-grip + glyph vocabulary
 *     (`gripGlyphShape` / `hotGripOpForKind`) — identical to `wall-rotation`.
 *   - `computeDxfEntityGrips` emits the 4th grip with `lineGripKind` at that pos.
 */

import { lineRotationHandlePos, lineMoveHandlePos, applyLineRotationDrag, getLineGrips, getLineGripAlignmentAnchors, LINE_ROTATION_KIND, LINE_MOVE_KIND } from '../line-grips';
import { axisQuarterRotationHandleWorld, axisQuarterMoveHandleWorld, axisToRectFrame } from '../../../bim/grips/axis-box-grips';
import { gripGlyphShape } from '../../../bim/grips/grip-glyph-registry';
import { hotGripOpForKind } from '../../../hooks/grips/wall-hot-grip-fsm';
import { computeDxfEntityGrips } from '../../../hooks/grip-computation';
import { gripKindOf } from '../../../hooks/grip-kinds';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('lineRotationHandlePos — ¼ toward the east end (wall parity)', () => {
  it('horizontal line (0,0)→(100,0) → (75,0) = centre + ¼ length east', () => {
    const p = lineRotationHandlePos({ x: 0, y: 0 }, { x: 100, y: 0 });
    near(p.x, 75);
    near(p.y, 0);
  });

  it('reversed horizontal (100,0)→(0,0) → still (75,0): geographic east, order-agnostic', () => {
    const p = lineRotationHandlePos({ x: 100, y: 0 }, { x: 0, y: 0 });
    near(p.x, 75);
    near(p.y, 0);
  });

  it('vertical line (0,0)→(0,100) → (0,75): no east/west bias → tie-breaks NORTH', () => {
    const p = lineRotationHandlePos({ x: 0, y: 0 }, { x: 0, y: 100 });
    near(p.x, 0);
    near(p.y, 75);
  });

  it('is the EXACT same function the straight wall uses (one shared SSoT)', () => {
    const start = { x: 10, y: 20 };
    const end = { x: 110, y: 80 };
    const viaLine = lineRotationHandlePos(start, end);
    const viaWall = axisQuarterRotationHandleWorld(axisToRectFrame({ start, end, width: 0 }));
    near(viaLine.x, viaWall.x);
    near(viaLine.y, viaWall.y);
  });
});

describe('applyLineRotationDrag — rotate about pivot (mirror rotateWall)', () => {
  it('rotates the whole line 90° about its midpoint', () => {
    // anchor east of midpoint (angle 0°), cursor north (angle 90°) → sweep +90°.
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    const anchor = { x: 60, y: 0 };
    const currentPos = { x: 50, y: 10 };
    const delta = { x: currentPos.x - anchor.x, y: currentPos.y - anchor.y };
    const r = applyLineRotationDrag({ start, end, delta, currentPos });
    expect(r).not.toBeNull();
    near(r!.start.x, 50); near(r!.start.y, -50);
    near(r!.end.x, 50); near(r!.end.y, 50);
  });

  it('rotates about a PICKED pivot (line start) by 90°', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    const pivot = { x: 0, y: 0 };
    const anchor = { x: 10, y: 0 };       // angle 0° from pivot
    const currentPos = { x: 0, y: 10 };   // angle 90° from pivot
    const delta = { x: currentPos.x - anchor.x, y: currentPos.y - anchor.y };
    const r = applyLineRotationDrag({ start, end, delta, currentPos, pivot });
    expect(r).not.toBeNull();
    near(r!.start.x, 0); near(r!.start.y, 0);   // pivot is invariant
    near(r!.end.x, 0); near(r!.end.y, 100);
  });

  it('degenerate sweep (cursor on pivot) → null (caller no-ops)', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    const pivot = { x: 50, y: 0 };
    const currentPos = { x: 50, y: 0 };   // on the pivot
    const delta = { x: 1, y: 0 };
    expect(applyLineRotationDrag({ start, end, delta, currentPos, pivot })).toBeNull();
  });
});

describe('line-rotation shares the wall hot-grip + glyph vocabulary', () => {
  it("renders the curved ROTATION glyph (same as wall-rotation)", () => {
    expect(gripGlyphShape(LINE_ROTATION_KIND)).toBe('rotation');
    expect(gripGlyphShape(LINE_ROTATION_KIND)).toBe(gripGlyphShape('wall-rotation'));
  });

  it("opts into the shared 'rotate' hot-grip flow (same as wall-rotation)", () => {
    expect(hotGripOpForKind(LINE_ROTATION_KIND)).toBe('rotate');
    expect(hotGripOpForKind(LINE_ROTATION_KIND)).toBe(hotGripOpForKind('wall-rotation'));
  });
});

// ADR-363 Slice G.5 — the ¼-west MOVE cross.
describe('lineMoveHandlePos — ¼ toward the west end (mirror of rotation)', () => {
  it('horizontal line (0,0)→(100,0) → (25,0) = centre − ¼ length west', () => {
    const p = lineMoveHandlePos({ x: 0, y: 0 }, { x: 100, y: 0 });
    near(p.x, 25);
    near(p.y, 0);
  });

  it('reversed horizontal (100,0)→(0,0) → still (25,0): geographic west, order-agnostic', () => {
    const p = lineMoveHandlePos({ x: 100, y: 0 }, { x: 0, y: 0 });
    near(p.x, 25);
    near(p.y, 0);
  });

  it('vertical line (0,0)→(0,100) → (0,25): no east/west bias → tie-breaks SOUTH', () => {
    const p = lineMoveHandlePos({ x: 0, y: 0 }, { x: 0, y: 100 });
    near(p.x, 0);
    near(p.y, 25);
  });

  it('is the EXACT mirror of the rotation handle about the centre (¼-west ↔ ¼-east)', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    const mid = { x: 50, y: 0 };
    const move = lineMoveHandlePos(start, end);
    const rot = lineRotationHandlePos(start, end);
    // symmetric about the midpoint: move + rot = 2·mid on each axis.
    near(move.x + rot.x, 2 * mid.x);
    near(move.y + rot.y, 2 * mid.y);
  });

  it('is the EXACT same ¼-west function the shared axis-box SSoT exposes', () => {
    const start = { x: 10, y: 20 };
    const end = { x: 110, y: 80 };
    const viaLine = lineMoveHandlePos(start, end);
    const viaSsot = axisQuarterMoveHandleWorld(axisToRectFrame({ start, end, width: 0 }));
    near(viaLine.x, viaSsot.x);
    near(viaLine.y, viaSsot.y);
  });
});

describe('line-move shares the wall hot-grip + glyph vocabulary (wall-midpoint parity)', () => {
  it('renders the 4-arrow MOVE glyph (same as wall-midpoint)', () => {
    expect(gripGlyphShape(LINE_MOVE_KIND)).toBe('move');
    expect(gripGlyphShape(LINE_MOVE_KIND)).toBe(gripGlyphShape('wall-midpoint'));
  });

  it("opts into the shared 'move' hot-grip flow (same as wall-midpoint)", () => {
    expect(hotGripOpForKind(LINE_MOVE_KIND)).toBe('move');
    expect(hotGripOpForKind(LINE_MOVE_KIND)).toBe(hotGripOpForKind('wall-midpoint'));
  });
});

describe('getLineGrips — the SSoT both grip paths consume', () => {
  it('emits 5 grips: start / end / centre midpoint / rotation (¼-east) / MOVE cross (¼-west)', () => {
    const grips = getLineGrips('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(grips).toHaveLength(5);
    expect(grips[0]).toMatchObject({ gripIndex: 0, type: 'vertex', movesEntity: false });
    expect(grips[1]).toMatchObject({ gripIndex: 1, type: 'vertex', movesEntity: false });
    // centre midpoint — kept as-is (ORTHO-eligible + StretchEntityCommand parity).
    expect(grips[2]).toMatchObject({ gripIndex: 2, type: 'edge', movesEntity: true, edgeVertexIndices: [0, 1] });
    expect(gripKindOf(grips[2], 'line')).toBeUndefined();
    near(grips[2].position.x, 50); near(grips[2].position.y, 0);
    // rotation handle — ¼ east, tagged so it opts into the shared rotate flow.
    expect(grips[3]).toMatchObject({ gripIndex: 3, type: 'vertex', movesEntity: false });
    expect(gripKindOf(grips[3], 'line')).toBe(LINE_ROTATION_KIND);
    near(grips[3].position.x, 75); near(grips[3].position.y, 0);
    // MOVE cross — ¼ west, tagged so it opts into the shared move flow (glyph +
    // directional). `type: 'vertex'` so it always shows; whole-line translate parity.
    expect(grips[4]).toMatchObject({ gripIndex: 4, type: 'vertex', movesEntity: true, edgeVertexIndices: [0, 1] });
    expect(gripKindOf(grips[4], 'line')).toBe(LINE_MOVE_KIND);
    near(grips[4].position.x, 25); near(grips[4].position.y, 0);
  });
});

// ADR-357/363 — the alignment-tracking anchors per line grip (Object-Snap-Tracking parity).
describe('getLineGripAlignmentAnchors — per-grip Object-Snap-Tracking anchor SSoT', () => {
  const line = { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };

  it('dragging START (grip 0) → tracks off the FIXED end', () => {
    expect(getLineGripAlignmentAnchors(0, null, line, line.start)).toEqual([line.end]);
  });

  it('dragging END (grip 1) → tracks off the FIXED start', () => {
    expect(getLineGripAlignmentAnchors(1, null, line, line.end)).toEqual([line.start]);
  });

  it('centre midpoint MOVE (grip 2) → tracks off the move BASE point', () => {
    const base = { x: 50, y: 0 };
    expect(getLineGripAlignmentAnchors(2, null, line, base)).toEqual([base]);
  });

  it('MOVE cross (grip 4, line-move) → tracks off the move BASE point', () => {
    const base = { x: 25, y: 0 };
    expect(getLineGripAlignmentAnchors(4, LINE_MOVE_KIND, line, base)).toEqual([base]);
  });

  it('rotation handle (grip 3, line-rotation) → null (rotate flow owns its traces)', () => {
    expect(getLineGripAlignmentAnchors(3, LINE_ROTATION_KIND, line, { x: 75, y: 0 })).toBeNull();
  });

  it('a move with no base point yet → null (caller keeps the raw cursor)', () => {
    expect(getLineGripAlignmentAnchors(2, null, line, null)).toBeNull();
  });
});

describe('computeDxfEntityGrips (case line) — emits the rotation + move handles', () => {
  it('adds the rotation (¼-east) and MOVE cross (¼-west) grips, tagged', () => {
    const line = { id: 'L1', type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } } as unknown as DxfEntityUnion;
    const grips = computeDxfEntityGrips(line);
    expect(grips).toHaveLength(5);
    const rot = grips[3];
    expect(rot.gripIndex).toBe(3);
    expect(gripKindOf(rot, 'line')).toBe(LINE_ROTATION_KIND);
    expect(rot.movesEntity).toBe(false);
    near(rot.position.x, 75);
    near(rot.position.y, 0);
    const move = grips[4];
    expect(move.gripIndex).toBe(4);
    expect(gripKindOf(move, 'line')).toBe(LINE_MOVE_KIND);
    expect(move.movesEntity).toBe(true);
    near(move.position.x, 25);
    near(move.position.y, 0);
  });
});
