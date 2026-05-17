/**
 * ADR-362 Phase C2 — dim-smart-detector unit tests.
 *
 * Coverage targets (4-tier state machine per ADR-362 D4):
 *   - Tier 1 manualOverride (highest precedence)
 *   - Tier 2 spacePressCount cycles full list mod-N
 *   - Tier 3 tabPressCount binary toggle to alternative (mod-2)
 *   - Tier 4a post-click upgrade: line→line ⇒ angular2L
 *   - Tier 4b base hover: line/circle/arc/polyline/lwpolyline
 *   - Axis-aligned line ⇒ linear; oblique line ⇒ aligned
 *   - Polyline edge nearest to cursor drives axis-aligned classification
 *   - Empty/missing hover ⇒ null
 *   - Unsupported entity type ⇒ null (compile-time exhaustive)
 *   - Same-entity hover after click does NOT upgrade to angular
 *   - Modifiers do not transform the angular upgrade
 */

import type {
  ArcEntity,
  CircleEntity,
  LineEntity,
  LWPolylineEntity,
  PolylineEntity,
} from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { detectDimensionType, type DetectionContext } from '../dim-smart-detector';

// ──────────────────────────────────────────────────────────────────────────────
// Fixture factories
// ──────────────────────────────────────────────────────────────────────────────

function line(id: string, start: Point2D, end: Point2D): LineEntity {
  return { id, type: 'line', start, end, layerId: 'L' } as LineEntity;
}

function circle(id: string, center: Point2D, radius: number): CircleEntity {
  return { id, type: 'circle', center, radius, layerId: 'L' } as CircleEntity;
}

function arc(id: string, center: Point2D, radius: number): ArcEntity {
  return {
    id, type: 'arc', center, radius, startAngle: 0, endAngle: Math.PI / 2, layerId: 'L',
  } as ArcEntity;
}

function polyline(id: string, vertices: readonly Point2D[]): PolylineEntity {
  return { id, type: 'polyline', vertices: [...vertices], layerId: 'L' } as PolylineEntity;
}

function lwpolyline(id: string, vertices: readonly Point2D[]): LWPolylineEntity {
  return { id, type: 'lwpolyline', vertices: [...vertices], layerId: 'L' } as LWPolylineEntity;
}

function ctx(overrides: Partial<DetectionContext> = {}): DetectionContext {
  return { cursorWorld: { x: 0, y: 0 }, ...overrides };
}

// ──────────────────────────────────────────────────────────────────────────────
// Tier 1 — manualOverride
// ──────────────────────────────────────────────────────────────────────────────

describe('detectDimensionType — Tier 1 manualOverride', () => {
  it('returns manualOverride verbatim, ignoring hover', () => {
    const result = detectDimensionType(ctx({
      manualOverride: 'ordinate',
      hoveredEntity: line('L1', { x: 0, y: 0 }, { x: 100, y: 0 }),
    }));
    expect(result).toBe('ordinate');
  });

  it('returns manualOverride even when no hover present', () => {
    const result = detectDimensionType(ctx({ manualOverride: 'baseline' }));
    expect(result).toBe('baseline');
  });

  it('manualOverride beats spacePressCount and tabPressCount', () => {
    const result = detectDimensionType(ctx({
      manualOverride: 'joggedRadius',
      hoveredEntity: circle('C1', { x: 0, y: 0 }, 50),
      spacePressCount: 5,
      tabPressCount: 3,
    }));
    expect(result).toBe('joggedRadius');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tier 4 — base hover types
// ──────────────────────────────────────────────────────────────────────────────

describe('detectDimensionType — Tier 4 base hover', () => {
  it('returns null when no hover present', () => {
    expect(detectDimensionType(ctx())).toBeNull();
  });

  it('horizontal line ⇒ linear', () => {
    const e = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(detectDimensionType(ctx({ hoveredEntity: e }))).toBe('linear');
  });

  it('vertical line ⇒ linear', () => {
    const e = line('L1', { x: 0, y: 0 }, { x: 0, y: 100 });
    expect(detectDimensionType(ctx({ hoveredEntity: e }))).toBe('linear');
  });

  it('oblique line (45°) ⇒ aligned', () => {
    const e = line('L1', { x: 0, y: 0 }, { x: 100, y: 100 });
    expect(detectDimensionType(ctx({ hoveredEntity: e }))).toBe('aligned');
  });

  it('near-horizontal line (within ±5°) ⇒ linear (axis-aligned tolerance)', () => {
    // 3° off horizontal — tan(3°) ≈ 0.052 < tan(5°) ≈ 0.087
    const e = line('L1', { x: 0, y: 0 }, { x: 100, y: 5.24 });
    expect(detectDimensionType(ctx({ hoveredEntity: e }))).toBe('linear');
  });

  it('circle ⇒ diameter', () => {
    const e = circle('C1', { x: 0, y: 0 }, 50);
    expect(detectDimensionType(ctx({ hoveredEntity: e }))).toBe('diameter');
  });

  it('arc ⇒ radius', () => {
    const e = arc('A1', { x: 0, y: 0 }, 25);
    expect(detectDimensionType(ctx({ hoveredEntity: e }))).toBe('radius');
  });

  it('polyline horizontal edge nearest to cursor ⇒ linear', () => {
    // Two-segment polyline: horizontal then oblique. Cursor near horizontal.
    const e = polyline('P1', [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 100 },
    ]);
    const result = detectDimensionType(ctx({
      cursorWorld: { x: 50, y: 2 }, // near horizontal edge
      hoveredEntity: e,
    }));
    expect(result).toBe('linear');
  });

  it('polyline oblique edge nearest to cursor ⇒ aligned', () => {
    const e = polyline('P1', [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 100 },
    ]);
    const result = detectDimensionType(ctx({
      cursorWorld: { x: 150, y: 50 }, // near oblique edge
      hoveredEntity: e,
    }));
    expect(result).toBe('aligned');
  });

  it('lwpolyline behaves the same as polyline', () => {
    const e = lwpolyline('LW1', [{ x: 0, y: 0 }, { x: 0, y: 100 }]);
    expect(detectDimensionType(ctx({
      cursorWorld: { x: 5, y: 50 },
      hoveredEntity: e,
    }))).toBe('linear');
  });

  it('polyline with <2 vertices ⇒ null', () => {
    const e = polyline('P1', [{ x: 0, y: 0 }]);
    expect(detectDimensionType(ctx({ hoveredEntity: e }))).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tier 4 — post-click angular upgrade
// ──────────────────────────────────────────────────────────────────────────────

describe('detectDimensionType — post-click angular upgrade', () => {
  it('line clicked + different line hovered ⇒ angular2L', () => {
    const first = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const second = line('L2', { x: 0, y: 0 }, { x: 0, y: 100 });
    const result = detectDimensionType(ctx({
      hoveredEntity: second,
      firstClickedEntity: first,
    }));
    expect(result).toBe('angular2L');
  });

  it('same line hovered after click ⇒ no upgrade (stays linear)', () => {
    const same = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const result = detectDimensionType(ctx({
      hoveredEntity: same,
      firstClickedEntity: same,
    }));
    expect(result).toBe('linear');
  });

  it('circle clicked + line hovered ⇒ no upgrade (clicked not a line)', () => {
    const first = circle('C1', { x: 0, y: 0 }, 50);
    const second = line('L2', { x: 0, y: 0 }, { x: 100, y: 0 });
    const result = detectDimensionType(ctx({
      hoveredEntity: second,
      firstClickedEntity: first,
    }));
    expect(result).toBe('linear');
  });

  it('modifiers do not transform the angular upgrade', () => {
    const first = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const second = line('L2', { x: 0, y: 0 }, { x: 0, y: 100 });
    const result = detectDimensionType(ctx({
      hoveredEntity: second,
      firstClickedEntity: first,
      spacePressCount: 3,
      tabPressCount: 7,
    }));
    expect(result).toBe('angular2L');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tier 3 — tabPressCount binary toggle (mod-2)
// ──────────────────────────────────────────────────────────────────────────────

describe('detectDimensionType — Tier 3 tab toggle', () => {
  it('tab odd on horizontal line: linear → aligned', () => {
    const e = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(detectDimensionType(ctx({ hoveredEntity: e, tabPressCount: 1 }))).toBe('aligned');
  });

  it('tab even on horizontal line: stays linear', () => {
    const e = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(detectDimensionType(ctx({ hoveredEntity: e, tabPressCount: 2 }))).toBe('linear');
  });

  it('tab odd on circle: diameter → radius', () => {
    const e = circle('C1', { x: 0, y: 0 }, 50);
    expect(detectDimensionType(ctx({ hoveredEntity: e, tabPressCount: 1 }))).toBe('radius');
  });

  it('tab odd on arc: radius → arcLength (binary alternative)', () => {
    const e = arc('A1', { x: 0, y: 0 }, 25);
    expect(detectDimensionType(ctx({ hoveredEntity: e, tabPressCount: 1 }))).toBe('arcLength');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tier 2 — spacePressCount full cycle (mod-N)
// ──────────────────────────────────────────────────────────────────────────────

describe('detectDimensionType — Tier 2 space cycle', () => {
  it('space cycles arc: radius → arcLength → diameter → radius', () => {
    const e = arc('A1', { x: 0, y: 0 }, 25);
    expect(detectDimensionType(ctx({ hoveredEntity: e, spacePressCount: 1 }))).toBe('arcLength');
    expect(detectDimensionType(ctx({ hoveredEntity: e, spacePressCount: 2 }))).toBe('diameter');
    expect(detectDimensionType(ctx({ hoveredEntity: e, spacePressCount: 3 }))).toBe('radius');
  });

  it('space cycles circle: diameter → radius → diameter', () => {
    const e = circle('C1', { x: 0, y: 0 }, 50);
    expect(detectDimensionType(ctx({ hoveredEntity: e, spacePressCount: 1 }))).toBe('radius');
    expect(detectDimensionType(ctx({ hoveredEntity: e, spacePressCount: 2 }))).toBe('diameter');
  });

  it('space cycles line: linear → aligned → linear', () => {
    const e = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(detectDimensionType(ctx({ hoveredEntity: e, spacePressCount: 1 }))).toBe('aligned');
    expect(detectDimensionType(ctx({ hoveredEntity: e, spacePressCount: 2 }))).toBe('linear');
  });

  it('space takes precedence over tab when both are set', () => {
    const e = arc('A1', { x: 0, y: 0 }, 25);
    // Space=2 → diameter (index 2 of [radius, arcLength, diameter]).
    // Tab would have given arcLength (mod-2 swap from radius). Space wins.
    const result = detectDimensionType(ctx({
      hoveredEntity: e,
      spacePressCount: 2,
      tabPressCount: 1,
    }));
    expect(result).toBe('diameter');
  });
});
