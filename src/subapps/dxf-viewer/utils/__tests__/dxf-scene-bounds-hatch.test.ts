/**
 * ADR-635 — scene bounds MUST include HATCH geometry (regression guard).
 *
 * WHY: `DxfSceneBuilder.calculateBounds` feeds the viewport auto-fit extents. HATCH geometry
 * lives in `boundaryPaths`, not in a primitive field, so before the fix the switch skipped it.
 * A drawing whose ONLY other geometry was a sibling block then fitted to the block and left the
 * imported hatch off-screen (repro: ΓΡΑΜΜΟΣΚΙΑΣΗ_ΜΕ_ΜΠΛΟΚ — «φαίνεται μόνο το μπλοκ»).
 */
import { DxfSceneBuilder } from '../dxf-scene-builder';
import type { AnySceneEntity } from '../../types/scene';

const hatch = (paths: Array<Array<{ x: number; y: number }>>): AnySceneEntity =>
  ({ id: 'h', type: 'hatch', layerId: '0', fillType: 'solid', boundaryPaths: paths } as unknown as AnySceneEntity);

const line = (x1: number, y1: number, x2: number, y2: number): AnySceneEntity =>
  ({ id: 'l', type: 'line', layerId: '0', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as unknown as AnySceneEntity);

describe('DxfSceneBuilder.calculateBounds — HATCH inclusion (ADR-635)', () => {
  it('a lone hatch drives the bounds (was empty/infinite before the fix)', () => {
    const b = DxfSceneBuilder.calculateBounds([hatch([[{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 70 }, { x: 10, y: 70 }]])]);
    expect(b.min.x).toBeCloseTo(10, 6);
    expect(b.min.y).toBeCloseTo(20, 6);
    expect(b.max.x).toBeCloseTo(110, 6);
    expect(b.max.y).toBeCloseTo(70, 6);
  });

  it('bounds union a hatch with a distant sibling primitive (block repro)', () => {
    // Block-like primitive at (3200,1459); hatch off to the lower-right at (3207..3218, 1452..1457).
    const b = DxfSceneBuilder.calculateBounds([
      line(3200, 1459, 3203, 1460),
      hatch([[{ x: 3207, y: 1452 }, { x: 3218, y: 1452 }, { x: 3218, y: 1457 }, { x: 3207, y: 1457 }]]),
    ]);
    // The hatch must extend the extents (else it renders off-screen after auto-fit).
    expect(b.max.x).toBeCloseTo(3218, 6); // hatch right edge, not the block's 3203
    expect(b.min.y).toBeCloseTo(1452, 6); // hatch bottom, not the block's 1459
    expect(b.min.x).toBeCloseTo(3200, 6); // block left edge still counted
    expect(b.max.y).toBeCloseTo(1460, 6); // block top still counted
  });

  it('multi-ring hatch: every ring participates', () => {
    const b = DxfSceneBuilder.calculateBounds([hatch([
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      [{ x: -5, y: -5 }, { x: 20, y: 25 }],
    ])]);
    expect(b.min.x).toBeCloseTo(-5, 6);
    expect(b.min.y).toBeCloseTo(-5, 6);
    expect(b.max.x).toBeCloseTo(20, 6);
    expect(b.max.y).toBeCloseTo(25, 6);
  });
});
