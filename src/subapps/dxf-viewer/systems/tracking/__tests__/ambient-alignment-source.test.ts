/**
 * ADR-357 ambient-alignment extension — `ambient-alignment-source` tests.
 *
 * Coverage:
 *   - empty scene / no columns → []
 *   - column outside radius → excluded
 *   - maxMembers cap honored (nearest-N)
 *   - non-column structural members (walls) also participate
 *   - plain CAD geometry (lines) participate via endpoints/midpoints (2026-07-04)
 *   - a non-participating type (circle) → []
 *   - axis gating: only points sharing the cursor's row/column are emitted
 *   - every emitted anchor: sourceSnapType 'ambient-column' & acquiredAt 0
 */

import {
  collectAmbientAlignmentAnchors,
  AMBIENT_SOURCE_TYPE,
  type AmbientAlignmentConfig,
} from '../ambient-alignment-source';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { Entity } from '../../../types/entities';
import type { ColumnEntity, ColumnParams } from '../../../bim/types/column-types';
import type { WallEntity } from '../../../bim/types/wall-types';

function rectColumnAt(x: number, y: number, overrides: Partial<ColumnParams> = {}): ColumnEntity {
  const params = { ...buildDefaultColumnParams({ x, y }, 'rectangular'), ...overrides };
  return {
    id: `col_${x}_${y}`,
    type: 'column',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: undefined as never,
    validation: undefined as never,
    visible: true,
  } as unknown as ColumnEntity;
}

/** Straight wall along y=0 from (x0,0) to (x1,0). */
function wallAlongX(x0: number, x1: number): WallEntity {
  const params = buildDefaultWallParams({ x: x0, y: 0 }, { x: x1, y: 0 });
  const built = buildWallEntity(params, '0', 'straight');
  if (!built.ok) throw new Error('wall fixture failed: ' + built.hardErrors.join(','));
  return built.entity;
}

/** Plain CAD line from (x0,y0) to (x1,y1). */
function lineFrom(x0: number, y0: number, x1: number, y1: number): Entity {
  return {
    id: `line_${x0}_${y0}_${x1}_${y1}`,
    type: 'line',
    layerId: '0',
    start: { x: x0, y: y0 },
    end: { x: x1, y: y1 },
    visible: true,
  } as unknown as Entity;
}

/** Plain text / mtext with an insertion point at (x,y). */
function textAt(x: number, y: number, type: 'text' | 'mtext' = 'text'): Entity {
  return {
    id: `txt_${type}_${x}_${y}`,
    type,
    layerId: '0',
    position: { x, y },
    visible: true,
  } as unknown as Entity;
}

const CFG = (over: Partial<AmbientAlignmentConfig> = {}): AmbientAlignmentConfig => ({
  radiusWorld: 100000,
  maxMembers: 6,
  axisToleranceWorld: 1,
  ...over,
});

describe('collectAmbientAlignmentAnchors (ADR-357 ambient)', () => {
  it('returns [] for an empty scene', () => {
    expect(collectAmbientAlignmentAnchors({ x: 0, y: 0 }, [], CFG())).toEqual([]);
  });

  it('returns [] for a non-participating type (circle)', () => {
    const nonParticipating = [{ id: 'x', type: 'circle' } as unknown as Entity];
    expect(collectAmbientAlignmentAnchors({ x: 0, y: 0 }, nonParticipating, CFG())).toEqual([]);
  });

  it('emits anchors for a plain line endpoint aligned with the cursor column', () => {
    // Vertical line at x=300; cursor at (300,-100) shares x=300 → vertical alignment.
    const anchors = collectAmbientAlignmentAnchors({ x: 300, y: -100 }, [lineFrom(300, 0, 300, 500)], CFG());
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) {
      expect(a.sourceSnapType).toBe(AMBIENT_SOURCE_TYPE);
      expect(a.acquiredAt).toBe(0);
      expect(Math.abs(a.x - 300)).toBeLessThan(1); // every emitted point sits on x=300
    }
  });

  it('drops a plain line whose points are off both cursor axes', () => {
    // Diagonal line far from x=0 and y=0; cursor at origin → no axis-aligned point.
    const anchors = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, [lineFrom(500, 500, 600, 600)], CFG());
    expect(anchors).toEqual([]);
  });

  it('also emits anchors for non-column structural members (walls)', () => {
    // Wall centerline along y=0; cursor shares that row → its char points emit.
    const anchors = collectAmbientAlignmentAnchors({ x: -200, y: 0 }, [wallAlongX(0, 1000)], CFG());
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) expect(a.sourceSnapType).toBe(AMBIENT_SOURCE_TYPE);
  });

  it('excludes a column outside the proximity radius', () => {
    const far = [rectColumnAt(10000, 10000)];
    const anchors = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, far, CFG({ radiusWorld: 10 }));
    expect(anchors).toEqual([]);
  });

  it('emits anchors for a column aligned with the cursor row', () => {
    // Column centered at (300,0); cursor at (0,0) shares y=0 → horizontal alignment.
    const anchors = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, [rectColumnAt(300, 0)], CFG());
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) {
      expect(a.sourceSnapType).toBe(AMBIENT_SOURCE_TYPE);
      expect(a.acquiredAt).toBe(0);
    }
  });

  it('drops every point of a column that is off both cursor axes', () => {
    // Column at (500,500); cursor at (0,0). No char point is near x=0 or y=0.
    const anchors = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, [rectColumnAt(500, 500)], CFG());
    expect(anchors).toEqual([]);
  });

  // ADR-557 — a nearby TEXT / MTEXT insertion point participates as an alignment
  // source (parity with a line endpoint), so moving/rotating any entity near a label
  // lights the same cyan H/V traces (Giorgio 2026-07-07: «κυανές ενδείξεις κειμένων»).
  it('emits an anchor for a text insertion point aligned with the cursor column', () => {
    // Text at (300,0); cursor at (300,-100) shares x=300 → vertical alignment.
    const anchors = collectAmbientAlignmentAnchors({ x: 300, y: -100 }, [textAt(300, 0)], CFG());
    expect(anchors.length).toBe(1);
    expect(anchors[0].sourceSnapType).toBe(AMBIENT_SOURCE_TYPE);
    expect(anchors[0].acquiredAt).toBe(0);
    expect(anchors[0].x).toBeCloseTo(300, 6);
    expect(anchors[0].y).toBeCloseTo(0, 6);
  });

  it('emits an anchor for an mtext insertion point aligned with the cursor row', () => {
    const anchors = collectAmbientAlignmentAnchors({ x: -50, y: 200 }, [textAt(400, 200, 'mtext')], CFG());
    expect(anchors.length).toBe(1);
    expect(anchors[0].y).toBeCloseTo(200, 6);
  });

  it('drops a text whose insertion point is off both cursor axes', () => {
    const anchors = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, [textAt(500, 500)], CFG());
    expect(anchors).toEqual([]);
  });

  // ADR-654 — a raster image / entourage sprite emits alignment anchors from its rotated corners, so
  // dragging any entity near it lights the SAME H/V traces (Giorgio 2026-07-14).
  it('emits anchors for a raster image corner aligned with the cursor column', () => {
    // 100×50 image at (300,0) → a corner sits on x=300; cursor at (300,-100) shares that column.
    const image = { id: 'img_1', type: 'image', position: { x: 300, y: 0 }, width: 100, height: 50, rotation: 0, url: 'x' } as unknown as Entity;
    const anchors = collectAmbientAlignmentAnchors({ x: 300, y: -100 }, [image], CFG());
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) {
      expect(a.sourceSnapType).toBe(AMBIENT_SOURCE_TYPE);
      expect(Math.abs(a.x - 300)).toBeLessThan(1);
    }
  });

  it('returns [] for an image missing width/height (no vertices)', () => {
    const bad = { id: 'img_2', type: 'image', position: { x: 0, y: 0 } } as unknown as Entity;
    expect(collectAmbientAlignmentAnchors({ x: 0, y: 0 }, [bad], CFG())).toEqual([]);
  });

  it('honors the maxMembers cap (nearest-N)', () => {
    // 10 columns along y=0 at x=100..1000 — all share the cursor row.
    const cols: Entity[] = [];
    for (let i = 1; i <= 10; i++) cols.push(rectColumnAt(i * 100, 0));
    const capped = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, cols, CFG({ maxMembers: 6 }));
    const uncapped = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, cols, CFG({ maxMembers: 10 }));
    expect(capped.length).toBeGreaterThan(0);
    // Fewer columns considered → strictly fewer anchors.
    expect(capped.length).toBeLessThan(uncapped.length);
  });
});
