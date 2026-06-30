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

import { lineRotationHandlePos, applyLineRotationDrag, getLineGrips, LINE_ROTATION_KIND } from '../line-grips';
import { axisQuarterRotationHandleWorld, axisToRectFrame } from '../../../bim/grips/axis-box-grips';
import { gripGlyphShape } from '../../../bim/grips/grip-glyph-registry';
import { hotGripOpForKind } from '../../../hooks/grips/wall-hot-grip-fsm';
import { computeDxfEntityGrips } from '../../../hooks/grip-computation';
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

describe('getLineGrips — the SSoT both grip paths consume', () => {
  it('emits 4 grips: start / end / midpoint MOVE / rotation', () => {
    const grips = getLineGrips('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(grips).toHaveLength(4);
    expect(grips[0]).toMatchObject({ gripIndex: 0, type: 'vertex', movesEntity: false });
    expect(grips[1]).toMatchObject({ gripIndex: 1, type: 'vertex', movesEntity: false });
    // midpoint MOVE — ORTHO-eligible + StretchEntityCommand parity preserved.
    expect(grips[2]).toMatchObject({ gripIndex: 2, type: 'edge', movesEntity: true, edgeVertexIndices: [0, 1] });
    near(grips[2].position.x, 50); near(grips[2].position.y, 0);
    // rotation handle — ¼ east, tagged so it opts into the shared rotate flow.
    expect(grips[3]).toMatchObject({ gripIndex: 3, type: 'vertex', movesEntity: false, lineGripKind: LINE_ROTATION_KIND });
    near(grips[3].position.x, 75); near(grips[3].position.y, 0);
  });
});

describe('computeDxfEntityGrips (case line) — emits the rotation handle', () => {
  it('adds a 4th grip tagged line-rotation at the shared ¼-east position', () => {
    const line = { id: 'L1', type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } } as unknown as DxfEntityUnion;
    const grips = computeDxfEntityGrips(line);
    expect(grips).toHaveLength(4);
    const rot = grips[3];
    expect(rot.gripIndex).toBe(3);
    expect(rot.lineGripKind).toBe(LINE_ROTATION_KIND);
    expect(rot.movesEntity).toBe(false);
    near(rot.position.x, 75);
    near(rot.position.y, 0);
  });
});
