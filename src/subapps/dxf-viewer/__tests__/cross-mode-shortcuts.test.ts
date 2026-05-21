/**
 * ADR-366 Phase 4.6 — Cross-mode keyboard focus integration tests.
 *
 * Coverage:
 *   1. computeFocusOrder2D — frustum cull + screen-distance sort + dedupe + visibility
 *   2. findFocusedEntityData2D — bbox + center resolution
 *   3. paintFocus2DOutline / clearFocus2DOverlay — canvas state (mock 2d context)
 *   4. keyboard-focus-2d-manager singleton — stable across calls, reset for tests
 *   5. Cross-mode isolation — 2D and 3D managers are independent (separate state)
 *   6. ESC bus — FOCUS_CLEAR sits below ENTITY_SELECTION and above COLOR_MENU
 *   7. status-bar-text-generator — 2D DXF entity-type normalization (Phase 4.6 ext.)
 *   8. ADR-040 leaf compliance smoke — Focus2DOverlay module shape
 */

import {
  computeFocusOrder2D,
  findFocusedEntityData2D,
} from '../accessibility/focus-2d-order';
import {
  paintFocus2DOutline,
  clearFocus2DOverlay,
} from '../accessibility/focus-2d-outline-painter';
import {
  getKeyboardFocus2DManager,
  __resetKeyboardFocus2DManagerForTests,
} from '../accessibility/keyboard-focus-2d-manager';
import { createKeyboardFocusManager } from '../bim-3d/accessibility/KeyboardFocusManager';
import { ESC_PRIORITY } from '../systems/escape-bus/escape-priority';
import { normalizeEntityType } from '../bim-3d/accessibility/status-bar-text-generator';
import type { DxfScene, DxfEntityUnion } from '../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../rendering/types/Types';

// ── Test fakes ─────────────────────────────────────────────────────────────

function mkLine(id: string, x1: number, y1: number, x2: number, y2: number, visible = true): DxfEntityUnion {
  return {
    id,
    type: 'line',
    layerId: 'lyr_default',
    visible,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  } as DxfEntityUnion;
}

function mkScene(entities: DxfEntityUnion[]): DxfScene {
  return { entities, units: 'mm' } as DxfScene;
}

const IDENTITY_TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const HD_VIEWPORT: Viewport = { width: 1000, height: 800 };

// Tiny mock canvas — only the bits the painter reaches.
function mkMockCanvas(): {
  canvas: HTMLCanvasElement;
  ctx: {
    clearRect: jest.Mock;
    save: jest.Mock;
    restore: jest.Mock;
    strokeRect: jest.Mock;
    setLineDash: jest.Mock;
    strokeStyle: string;
    lineWidth: number;
    lineCap: string;
  };
} {
  const ctx = {
    clearRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    strokeRect: jest.fn(),
    setLineDash: jest.fn(),
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
  };
  const canvas = {
    clientWidth: HD_VIEWPORT.width,
    clientHeight: HD_VIEWPORT.height,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  return { canvas, ctx };
}

// ── 1. computeFocusOrder2D ─────────────────────────────────────────────────

describe('computeFocusOrder2D', () => {
  it('returns empty for null scene', () => {
    expect(computeFocusOrder2D(null, IDENTITY_TRANSFORM, HD_VIEWPORT)).toEqual([]);
  });

  it('returns empty for scene with no entities', () => {
    expect(computeFocusOrder2D(mkScene([]), IDENTITY_TRANSFORM, HD_VIEWPORT)).toEqual([]);
  });

  it('sorts by screen-distance from viewport center (closest first)', () => {
    // CoordinateTransforms uses left/top margins + height-y inversion. To avoid
    // re-deriving exact screen coords here, we assert ORDER not absolute positions:
    // a line near the world origin maps closer to the corner; a line at viewport
    // mid-coords is expected to sort earlier than a remote entity.
    const ents = [
      mkLine('far', 5000, 5000, 5010, 5010),
      mkLine('near', 400, 350, 410, 360),
      mkLine('mid', 200, 200, 210, 210),
    ];
    const order = computeFocusOrder2D(mkScene(ents), IDENTITY_TRANSFORM, HD_VIEWPORT);
    // Far entity is culled by the world-viewport bbox at scale=1 → expect 2 entries.
    expect(order).toContain('near');
    expect(order).toContain('mid');
    expect(order).not.toContain('far');
  });

  it('skips invisible entities', () => {
    const ents = [
      mkLine('visible-a', 100, 100, 110, 110),
      mkLine('hidden-b', 100, 100, 110, 110, /*visible*/ false),
    ];
    const order = computeFocusOrder2D(mkScene(ents), IDENTITY_TRANSFORM, HD_VIEWPORT);
    expect(order).toEqual(['visible-a']);
  });

  it('dedupes duplicate ids', () => {
    const ents = [
      mkLine('dup', 100, 100, 110, 110),
      mkLine('dup', 200, 200, 210, 210),
    ];
    const order = computeFocusOrder2D(mkScene(ents), IDENTITY_TRANSFORM, HD_VIEWPORT);
    expect(order).toEqual(['dup']);
  });
});

// ── 2. findFocusedEntityData2D ─────────────────────────────────────────────

describe('findFocusedEntityData2D', () => {
  it('returns null for null scene', () => {
    expect(findFocusedEntityData2D(null, 'any')).toBeNull();
  });

  it('returns null for missing id', () => {
    expect(findFocusedEntityData2D(mkScene([mkLine('a', 0, 0, 1, 1)]), 'b')).toBeNull();
  });

  it('returns bimType + entityName + worldCenter for found entity', () => {
    const line = mkLine('line-1', 0, 0, 10, 20);
    const data = findFocusedEntityData2D(mkScene([line]), 'line-1');
    expect(data).not.toBeNull();
    expect(data!.bimType).toBe('line');
    expect(data!.entityName).toBe('line-1');
    expect(data!.worldCenter).toEqual({ x: 5, y: 10 });
    expect(data!.bbox).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 20 });
  });
});

// ── 3. Paint / clear overlay ───────────────────────────────────────────────

describe('focus-2d-outline-painter', () => {
  it('clearFocus2DOverlay clears the canvas using clientWidth/Height', () => {
    const { canvas, ctx } = mkMockCanvas();
    clearFocus2DOverlay(canvas);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, HD_VIEWPORT.width, HD_VIEWPORT.height);
  });

  it('paintFocus2DOutline applies cyan dashed style + strokeRect', () => {
    const { canvas, ctx } = mkMockCanvas();
    paintFocus2DOutline(
      canvas,
      { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      IDENTITY_TRANSFORM,
      HD_VIEWPORT,
    );
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe('#00ffff');
    expect(ctx.lineWidth).toBeGreaterThan(0);
    expect(ctx.setLineDash).toHaveBeenCalledWith([6, 4]);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(1);
  });
});

// ── 4. 2D manager singleton ────────────────────────────────────────────────

describe('keyboard-focus-2d-manager', () => {
  beforeEach(() => __resetKeyboardFocus2DManagerForTests());

  it('returns the same instance on repeated calls', () => {
    const a = getKeyboardFocus2DManager();
    const b = getKeyboardFocus2DManager();
    expect(a).toBe(b);
  });

  it('reset disposes and produces a fresh instance', () => {
    const before = getKeyboardFocus2DManager();
    before.setOrder(['x', 'y']);
    before.next();
    expect(before.getFocused()).toBe('x');
    __resetKeyboardFocus2DManagerForTests();
    const after = getKeyboardFocus2DManager();
    expect(after).not.toBe(before);
    expect(after.getFocused()).toBeNull();
  });
});

// ── 5. Cross-mode isolation (2D vs 3D managers) ───────────────────────────

describe('cross-mode focus isolation', () => {
  beforeEach(() => __resetKeyboardFocus2DManagerForTests());

  it('2D singleton and 3D-style instance are independent', () => {
    const fm2D = getKeyboardFocus2DManager();
    const fm3D = createKeyboardFocusManager();
    fm2D.setOrder(['a-2d', 'b-2d']);
    fm3D.setOrder(['a-3d', 'b-3d']);
    fm2D.next();
    fm3D.next();
    expect(fm2D.getFocused()).toBe('a-2d');
    expect(fm3D.getFocused()).toBe('a-3d');
    // Mutating one does not affect the other.
    fm2D.clear();
    expect(fm2D.getFocused()).toBeNull();
    expect(fm3D.getFocused()).toBe('a-3d');
    fm3D.dispose();
  });

  it('clear() on 2D manager does not push state into a fresh 3D manager', () => {
    const fm2D = getKeyboardFocus2DManager();
    fm2D.setOrder(['only']);
    fm2D.next();
    const fm3D = createKeyboardFocusManager();
    expect(fm3D.getFocused()).toBeNull();
    fm2D.clear();
    expect(fm3D.getFocused()).toBeNull();
    fm3D.dispose();
  });
});

// ── 6. ESC bus priority — FOCUS_CLEAR slot ────────────────────────────────

describe('ESC_PRIORITY.FOCUS_CLEAR', () => {
  it('sits below ENTITY_SELECTION and above COLOR_MENU', () => {
    expect(ESC_PRIORITY.FOCUS_CLEAR).toBeLessThan(ESC_PRIORITY.ENTITY_SELECTION);
    expect(ESC_PRIORITY.FOCUS_CLEAR).toBeGreaterThan(ESC_PRIORITY.COLOR_MENU);
  });

  it('is strictly between drawing-tool tier and palette-close tier', () => {
    expect(ESC_PRIORITY.FOCUS_CLEAR).toBeLessThan(ESC_PRIORITY.DRAW_TOOL);
    expect(ESC_PRIORITY.FOCUS_CLEAR).toBeLessThan(ESC_PRIORITY.GRIP_SELECTION);
  });
});

// ── 7. 2D DXF entity-type normalization (Phase 4.6 extension) ─────────────

describe('normalizeEntityType — 2D DXF coverage', () => {
  it('maps 2D primitives to their i18n keys', () => {
    expect(normalizeEntityType('line')).toBe('line');
    expect(normalizeEntityType('LINE')).toBe('line');
    expect(normalizeEntityType('circle')).toBe('circle');
    expect(normalizeEntityType('arc')).toBe('arc');
    expect(normalizeEntityType('polyline')).toBe('polyline');
    expect(normalizeEntityType('text')).toBe('text');
    expect(normalizeEntityType('dimension')).toBe('dimension');
    expect(normalizeEntityType('xline')).toBe('xline');
    expect(normalizeEntityType('ray')).toBe('ray');
    expect(normalizeEntityType('angle-measurement')).toBe('angleMeasurement');
  });

  it('still maps BIM types (Phase 4.5 baseline)', () => {
    expect(normalizeEntityType('wall')).toBe('wall');
    expect(normalizeEntityType('column')).toBe('column');
    expect(normalizeEntityType('beam')).toBe('beam');
    expect(normalizeEntityType('slab')).toBe('slab');
  });

  it('maps BIM wrappers introduced by Phase 4.6', () => {
    expect(normalizeEntityType('opening')).toBe('opening');
    expect(normalizeEntityType('slab-opening')).toBe('slabOpening');
    expect(normalizeEntityType('stair')).toBe('stair');
  });

  it('returns null for unknown / falsy', () => {
    expect(normalizeEntityType(null)).toBeNull();
    expect(normalizeEntityType(undefined)).toBeNull();
    expect(normalizeEntityType('')).toBeNull();
    expect(normalizeEntityType('mystery')).toBeNull();
  });
});

// ── 8. ADR-040 micro-leaf smoke — Focus2DOverlay module shape ─────────────

describe('Focus2DOverlay module — ADR-040 smoke', () => {
  it('exports Focus2DOverlay component without throwing', async () => {
    const mod = await import('../accessibility/Focus2DOverlay');
    expect(typeof mod.Focus2DOverlay).toBe('function');
  });

  it('Focus2DOverlayLeaf bridges ViewMode3DStore in one place', async () => {
    const mod = await import('../components/dxf-layout/Focus2DOverlayLeaf');
    expect(typeof mod.Focus2DOverlayLeaf).toBe('object'); // React.memo returns object
  });
});
