/**
 * move-base-point-marker — the red ＋ crosshair marking the MOVE base point (ADR-049/363/640).
 *
 * Shared SSoT painter drawn by BOTH the ribbon Move tool (`useMovePreview`) and the grip MOVE
 * hot-grip (`useGripGhostPreview`). Pins: red colour, plain crosshair (2 arms, NO ring), fixed
 * on-screen px size (zoom-stable), centred on the real `worldToScreen` projection of the base point.
 */

import { drawMoveBasePointMarker, MOVE_BASE_POINT_MARKER_SIZE_PX } from '../move-base-point-marker';
import { drawMoveRubberBand } from '../../../hooks/tools/grip-ghost-preview-draw-helpers';
import { CoordinateTransforms } from '../../core/CoordinateTransforms';
import type { ViewTransform, Viewport } from '../../types/Types';

interface Op { readonly op: string; readonly args: readonly unknown[] }

function makeCtx(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = [];
  let strokeStyle = '';
  let lineWidth = 0;
  const rec = (op: string, ...args: unknown[]): void => { ops.push({ op, args }); };
  const ctx = {
    get strokeStyle() { return strokeStyle; },
    set strokeStyle(v: string) { strokeStyle = v; rec('strokeStyle', v); },
    get lineWidth() { return lineWidth; },
    set lineWidth(v: number) { lineWidth = v; rec('lineWidth', v); },
    setLineDash: (d: number[]) => rec('setLineDash', [...d]),
    save: () => rec('save'),
    restore: () => rec('restore'),
    beginPath: () => rec('beginPath'),
    moveTo: (x: number, y: number) => rec('moveTo', x, y),
    lineTo: (x: number, y: number) => rec('lineTo', x, y),
    stroke: () => rec('stroke'),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

const VIEWPORT: Viewport = { width: 800, height: 600 };

function centerFor(world: { x: number; y: number }, t: ViewTransform): { x: number; y: number } {
  return CoordinateTransforms.worldToScreen(world, t, VIEWPORT);
}

describe('drawMoveBasePointMarker — red ＋ crosshair (SSoT)', () => {
  const world = { x: 12, y: 34 };
  const t: ViewTransform = { scale: 2, offsetX: 0, offsetY: 0 };

  it('strokes a red crosshair, width 2, centred on the real worldToScreen projection', () => {
    const { ctx, ops } = makeCtx();
    drawMoveBasePointMarker(ctx, world, t, VIEWPORT);

    expect(ops.some((o) => o.op === 'strokeStyle' && o.args[0] === '#FF4444')).toBe(true);
    expect(ops.some((o) => o.op === 'lineWidth' && o.args[0] === 2)).toBe(true);
    expect(ops.filter((o) => o.op === 'stroke')).toHaveLength(1);

    const c = centerFor(world, t);
    const s = MOVE_BASE_POINT_MARKER_SIZE_PX;
    const moves = ops.filter((o) => o.op === 'moveTo');
    const lines = ops.filter((o) => o.op === 'lineTo');
    // Two arms → 2 moveTo + 2 lineTo forming a ＋ centred at c.
    expect(moves).toHaveLength(2);
    expect(lines).toHaveLength(2);
    // Horizontal arm
    expect(moves[0].args).toEqual([c.x - s, c.y]);
    expect(lines[0].args).toEqual([c.x + s, c.y]);
    // Vertical arm
    expect(moves[1].args).toEqual([c.x, c.y - s]);
    expect(lines[1].args).toEqual([c.x, c.y + s]);
  });

  it('is a plain crosshair — NO ring (never calls arc), distinct from the rotation-pivot ⊙', () => {
    const { ctx, ops } = makeCtx();
    drawMoveBasePointMarker(ctx, world, t, VIEWPORT);
    expect(ops.some((o) => o.op === 'arc')).toBe(false);
  });

  it('is zoom-stable — arm half-length stays a fixed px size at any scale', () => {
    const armAt = (scale: number): number => {
      const { ctx, ops } = makeCtx();
      const tt: ViewTransform = { scale, offsetX: 0, offsetY: 0 };
      drawMoveBasePointMarker(ctx, world, tt, VIEWPORT);
      const c = centerFor(world, tt);
      const firstMove = ops.find((o) => o.op === 'moveTo')!;
      return Math.abs((firstMove.args[0] as number) - c.x);
    };
    expect(armAt(1)).toBe(MOVE_BASE_POINT_MARKER_SIZE_PX);
    expect(armAt(8)).toBe(MOVE_BASE_POINT_MARKER_SIZE_PX);
  });

  it('balances save/restore (leaves ctx state clean)', () => {
    const { ctx, ops } = makeCtx();
    drawMoveBasePointMarker(ctx, world, t, VIEWPORT);
    expect(ops.filter((o) => o.op === 'save')).toHaveLength(1);
    expect(ops.filter((o) => o.op === 'restore')).toHaveLength(1);
  });
});

describe('drawMoveRubberBand — gold dashed leader (world wrapper over the SSoT)', () => {
  const t: ViewTransform = { scale: 2, offsetX: 0, offsetY: 0 };
  const fromW = { x: 0, y: 0 };
  const toW = { x: 10, y: 5 };

  it('draws a GOLD dashed line between the projected base and cursor', () => {
    const { ctx, ops } = makeCtx();
    drawMoveRubberBand(ctx, fromW, toW, t, VIEWPORT);

    expect(ops.some((o) => o.op === 'strokeStyle' && o.args[0] === '#FFD700')).toBe(true);
    expect(ops.some((o) => o.op === 'setLineDash' && Array.isArray(o.args[0]) && (o.args[0] as number[]).length === 2)).toBe(true);

    const a = centerFor(fromW, t);
    const b = centerFor(toW, t);
    const move = ops.find((o) => o.op === 'moveTo')!;
    const line = ops.find((o) => o.op === 'lineTo')!;
    expect(move.args).toEqual([a.x, a.y]);
    expect(line.args).toEqual([b.x, b.y]);
  });
});
