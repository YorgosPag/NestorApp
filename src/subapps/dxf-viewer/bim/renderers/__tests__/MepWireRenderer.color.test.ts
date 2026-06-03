/**
 * ADR-408 Φ7 — colour-by-system master toggle gate on the 2D wire renderer.
 *
 * Verifies `drawCircuitWires` strokes each run in its System colour when
 * `colorBySystem` is ON, and in the shared {@link DEFAULT_WIRE_COLOR} when OFF
 * (2D/3D parity with `wirePathToMesh`'s default-material fallback).
 */

import { drawCircuitWires, DEFAULT_WIRE_COLOR } from '../MepWireRenderer';
import type { CircuitWirePath } from '../../mep-systems/mep-wire-routing';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';

const TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const VIEWPORT: Viewport = { width: 800, height: 600 };

/** A minimal recording 2D context: captures every assigned `strokeStyle`. */
function recordingCtx(): { ctx: CanvasRenderingContext2D; strokes: string[] } {
  const strokes: string[] = [];
  const ctx = {
    set strokeStyle(v: string) { strokes.push(v); },
    get strokeStyle() { return strokes[strokes.length - 1] ?? ''; },
    fillStyle: '',
    lineWidth: 0,
    lineJoin: '',
    lineCap: '',
    globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}, setLineDash() {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, strokes };
}

function path(systemId: string, color: string): CircuitWirePath {
  return { systemId, colorHex: color, points: [{ x: 0, y: 0, zMm: 0 }, { x: 10, y: 0, zMm: 0 }] };
}

describe('drawCircuitWires — colorBySystem gate', () => {
  it('strokes in the System colour when colorBySystem is ON (default)', () => {
    const { ctx, strokes } = recordingCtx();
    drawCircuitWires(ctx, [path('s1', '#ff0000')], TRANSFORM, VIEWPORT, null, true);
    expect(strokes).toContain('#ff0000');
    expect(strokes).not.toContain(DEFAULT_WIRE_COLOR);
  });

  it('strokes in DEFAULT_WIRE_COLOR when colorBySystem is OFF', () => {
    const { ctx, strokes } = recordingCtx();
    drawCircuitWires(ctx, [path('s1', '#ff0000')], TRANSFORM, VIEWPORT, null, false);
    expect(strokes).toContain(DEFAULT_WIRE_COLOR);
    expect(strokes).not.toContain('#ff0000');
  });

  it('defaults colorBySystem to ON when the arg is omitted (legacy callers)', () => {
    const { ctx, strokes } = recordingCtx();
    drawCircuitWires(ctx, [path('s1', '#00ff00')], TRANSFORM, VIEWPORT);
    expect(strokes).toContain('#00ff00');
  });

  it('DEFAULT_WIRE_COLOR mirrors the 3D elem-mep-wire material (0xb45309)', () => {
    expect(DEFAULT_WIRE_COLOR).toBe('#b45309');
  });
});
