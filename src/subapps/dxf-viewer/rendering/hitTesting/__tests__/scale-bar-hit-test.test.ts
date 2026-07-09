/**
 * ADR-583 Φ2 — regression: the graphic scale-bar must be HOVER/CLICK hit-testable.
 *
 * The bar was window/crossing-MARQUEE selectable (Twin-B `resolveEntityBounds`) but
 * NOT hover-highlightable, because three stages of the spatial-index hit-test path
 * silently skipped the new `type:'scale-bar'`:
 *   1. `convertDxfEntityToEntityModel` — no case → stripped the flat params (position…).
 *   2. `BoundsCalculator.calculateEntityBounds` — no case → null → dropped from index.
 *   3. `performDetailedHitTest` — no case → default AABB (imprecise on a rotated bar).
 *
 * These tests pin all three so a future entity-type addition can't regress hover again.
 */

import type { DxfScaleBar } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { EntityModel, Point2D } from '../../types/Types';
import { convertDxfEntityToEntityModel } from '../../../services/hit-test-entity-model';
import { BoundsCalculator } from '../Bounds';
import { performDetailedHitTest } from '../hit-test-entity-tests';

function makeDxfScaleBar(overrides: Partial<DxfScaleBar> = {}): DxfScaleBar {
  return {
    id: 'sb_hit_test',
    type: 'scale-bar',
    layerId: 'lyr_test',
    visible: true,
    position: { x: 0, y: 0 },
    angleRad: 0,
    length: 10,
    unit: 'm',
    divisions: 4,
    subdivisions: 0,
    style: 'alternating',
    barHeightMm: 4,
    labelHeightMm: 2.5,
    labelPlacement: 'below',
    ...overrides,
  } as DxfScaleBar;
}

describe('ADR-583 Φ2 — scale-bar hover/click hit-test', () => {
  // 10 m @ canonical-mm → endPosition.x = 10000 mm along the +X axis.
  const AXIS_END_MM = 10000;

  it('Gap 1 — converter passes the flat params through (not stripped by default)', () => {
    const model = convertDxfEntityToEntityModel(makeDxfScaleBar()) as EntityModel & {
      position?: Point2D; length?: number; angleRad?: number;
    };
    expect(model.type).toBe('scale-bar');
    expect(model.position).toEqual({ x: 0, y: 0 });
    expect(model.length).toBe(10);
    expect(model.angleRad).toBe(0);
  });

  it('Gap 2 — BoundsCalculator returns a finite bbox enclosing the axis + band', () => {
    const model = convertDxfEntityToEntityModel(makeDxfScaleBar());
    const bounds = BoundsCalculator.calculateEntityBounds(model, 0);
    expect(bounds).not.toBeNull();
    // Encloses the full axis span…
    expect(bounds!.minX).toBeLessThanOrEqual(0);
    expect(bounds!.maxX).toBeGreaterThanOrEqual(AXIS_END_MM);
    // …and is padded perpendicular by the annotative half-thickness (not a zero-height line).
    expect(bounds!.maxY).toBeGreaterThan(0);
    expect(bounds!.minY).toBeLessThan(0);
  });

  it('Gap 3 — narrow phase hits ON the axis and misses far off it', () => {
    const model = convertDxfEntityToEntityModel(makeDxfScaleBar());
    const onAxis = performDetailedHitTest(model, { x: 5000, y: 0 }, 5);
    expect(onAxis).not.toBeNull();
    expect(onAxis!.hitType).toBe('entity');

    const farOff = performDetailedHitTest(model, { x: 5000, y: 500_000 }, 5);
    expect(farOff).toBeNull();
  });

  it('Gap 2 — a rotated bar still yields finite, non-degenerate bounds', () => {
    const model = convertDxfEntityToEntityModel(makeDxfScaleBar({ angleRad: Math.PI / 4 }));
    const bounds = BoundsCalculator.calculateEntityBounds(model, 0);
    expect(bounds).not.toBeNull();
    expect(Number.isFinite(bounds!.minX)).toBe(true);
    expect(Number.isFinite(bounds!.maxY)).toBe(true);
    expect(bounds!.maxX).toBeGreaterThan(bounds!.minX);
    expect(bounds!.maxY).toBeGreaterThan(bounds!.minY);
  });
});
