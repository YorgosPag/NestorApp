/**
 * ADR-362 Phase D1 — dimensionCreateReducer + state-machine unit tests.
 *
 * Coverage targets:
 *   - initialState shape + immutability
 *   - start() sets mode/styleId/manualOverride + currentType for manual mode
 *   - cursorMove updates cursor + drives detector (smart mode)
 *   - click appends record + transitions to commit-ready at requiredClickCount
 *   - Linear 3-click happy path
 *   - Angular3P 4-click happy path
 *   - Smart mode line→line ⇒ angular2L upgrade after click 2
 *   - manualOverride pin: hover changes do not switch type
 *   - Tab/Space increment counters + re-detect (smart mode only)
 *   - Tab/Space ignored in manual mode (override wins)
 *   - cancel resets to initial state
 *   - requiredClickCount lookup per type
 */

import type {
  ArcEntity,
  CircleEntity,
  LineEntity,
} from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import {
  dimensionCreateReducer,
  initialDimensionCreateState,
  requiredClickCount,
  type DimensionCreateAction,
  type DimensionCreateState,
} from '../dimension-create-state';

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const STYLE_ID = 'dimstyle_iso';

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

function dispatchMany(
  start: DimensionCreateState,
  actions: readonly DimensionCreateAction[],
): DimensionCreateState {
  return actions.reduce(dimensionCreateReducer, start);
}

// ──────────────────────────────────────────────────────────────────────────────
// initialState
// ──────────────────────────────────────────────────────────────────────────────

describe('initialDimensionCreateState', () => {
  it('is idle with all slots empty', () => {
    expect(initialDimensionCreateState.status).toBe('idle');
    expect(initialDimensionCreateState.mode).toBeNull();
    expect(initialDimensionCreateState.currentType).toBeNull();
    expect(initialDimensionCreateState.clicks).toEqual([]);
    expect(initialDimensionCreateState.spacePressCount).toBe(0);
    expect(initialDimensionCreateState.tabPressCount).toBe(0);
  });

  it('is frozen — direct mutation is rejected', () => {
    expect(Object.isFrozen(initialDimensionCreateState)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// requiredClickCount
// ──────────────────────────────────────────────────────────────────────────────

describe('requiredClickCount', () => {
  it('returns 3 for linear / aligned / angular2L', () => {
    expect(requiredClickCount('linear')).toBe(3);
    expect(requiredClickCount('aligned')).toBe(3);
    expect(requiredClickCount('angular2L')).toBe(3);
  });

  it('returns 4 for angular3P', () => {
    expect(requiredClickCount('angular3P')).toBe(4);
  });

  it('returns 2 for radial family + ordinate (ADR-362 Phase D2 — AutoCAD pick + text)', () => {
    expect(requiredClickCount('radius')).toBe(2);
    expect(requiredClickCount('diameter')).toBe(2);
    expect(requiredClickCount('arcLength')).toBe(2);
    expect(requiredClickCount('ordinate')).toBe(2);
  });

  it('returns 4 for joggedRadius (center pick + arcPoint + jogPoint + jogVertex)', () => {
    expect(requiredClickCount('joggedRadius')).toBe(4);
  });

  it('returns 3 for baseline / continued placeholder (Phase D3)', () => {
    expect(requiredClickCount('baseline')).toBe(3);
    expect(requiredClickCount('continued')).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// start
// ──────────────────────────────────────────────────────────────────────────────

describe('start action', () => {
  it('transitions idle → collecting in smart mode (currentType deferred)', () => {
    const next = dimensionCreateReducer(initialDimensionCreateState, {
      kind: 'start', mode: 'smart', styleId: STYLE_ID,
    });
    expect(next.status).toBe('collecting');
    expect(next.mode).toBe('smart');
    expect(next.styleId).toBe(STYLE_ID);
    expect(next.currentType).toBeNull();
  });

  it('pins currentType to manualOverride in manual mode', () => {
    const next = dimensionCreateReducer(initialDimensionCreateState, {
      kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'angular3P',
    });
    expect(next.mode).toBe('manual');
    expect(next.manualOverride).toBe('angular3P');
    expect(next.currentType).toBe('angular3P');
  });

  it('resets every transient slot when re-started mid-flow', () => {
    const stale = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'smart', styleId: STYLE_ID },
      { kind: 'cursorMove', cursorWorld: { x: 10, y: 10 } },
      { kind: 'click', world: { x: 10, y: 10 } },
      { kind: 'pressTab' },
    ]);
    const restarted = dimensionCreateReducer(stale, {
      kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'linear',
    });
    expect(restarted.clicks).toEqual([]);
    expect(restarted.tabPressCount).toBe(0);
    expect(restarted.spacePressCount).toBe(0);
    expect(restarted.currentType).toBe('linear');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// cursorMove
// ──────────────────────────────────────────────────────────────────────────────

describe('cursorMove action', () => {
  it('is ignored while idle', () => {
    const next = dimensionCreateReducer(initialDimensionCreateState, {
      kind: 'cursorMove', cursorWorld: { x: 5, y: 5 },
    });
    expect(next).toBe(initialDimensionCreateState);
  });

  it('updates cursor + drives detector in smart mode', () => {
    const started = dimensionCreateReducer(initialDimensionCreateState, {
      kind: 'start', mode: 'smart', styleId: STYLE_ID,
    });
    const next = dimensionCreateReducer(started, {
      kind: 'cursorMove', cursorWorld: { x: 1, y: 1 },
      hoveredEntity: circle('C1', { x: 0, y: 0 }, 50),
    });
    expect(next.cursorWorld).toEqual({ x: 1, y: 1 });
    expect(next.currentType).toBe('diameter');
  });

  it('does not touch currentType in manual mode (Tier 1 override pins it)', () => {
    const started = dimensionCreateReducer(initialDimensionCreateState, {
      kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'aligned',
    });
    const next = dimensionCreateReducer(started, {
      kind: 'cursorMove', cursorWorld: { x: 1, y: 1 },
      hoveredEntity: arc('A1', { x: 0, y: 0 }, 50),
    });
    expect(next.currentType).toBe('aligned');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// click
// ──────────────────────────────────────────────────────────────────────────────

describe('click action', () => {
  it('is ignored while idle', () => {
    const next = dimensionCreateReducer(initialDimensionCreateState, {
      kind: 'click', world: { x: 0, y: 0 },
    });
    expect(next).toBe(initialDimensionCreateState);
  });

  it('appends a ClickRecord with pickedEntity when hovered', () => {
    const hovered = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'smart', styleId: STYLE_ID },
      { kind: 'click', world: { x: 0, y: 0 }, hoveredEntity: hovered },
    ]);
    expect(next.clicks).toHaveLength(1);
    expect(next.clicks[0].pickedEntity?.id).toBe('L1');
    expect(next.currentType).toBe('linear');
  });

  it('falls back to "linear" in smart mode when no hover at click 1', () => {
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'smart', styleId: STYLE_ID },
      { kind: 'click', world: { x: 0, y: 0 } },
    ]);
    expect(next.currentType).toBe('linear');
    expect(next.status).toBe('collecting');
  });

  it('linear: 3 clicks transitions to commit-ready', () => {
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'linear' },
      { kind: 'click', world: { x: 0, y: 0 } },
      { kind: 'click', world: { x: 100, y: 0 } },
      { kind: 'click', world: { x: 50, y: 30 } },
    ]);
    expect(next.status).toBe('commit-ready');
    expect(next.clicks).toHaveLength(3);
  });

  it('angular3P: 4 clicks transitions to commit-ready (3 leaves it collecting)', () => {
    const after3 = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'angular3P' },
      { kind: 'click', world: { x: 0, y: 0 } },
      { kind: 'click', world: { x: 100, y: 0 } },
      { kind: 'click', world: { x: 0, y: 100 } },
    ]);
    expect(after3.status).toBe('collecting');

    const after4 = dimensionCreateReducer(after3, {
      kind: 'click', world: { x: 50, y: 50 },
    });
    expect(after4.status).toBe('commit-ready');
    expect(after4.clicks).toHaveLength(4);
  });

  it('smart mode line→line ⇒ angular2L upgrade after click 2', () => {
    const l1 = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const l2 = line('L2', { x: 0, y: 0 }, { x: 0, y: 100 });
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'smart', styleId: STYLE_ID },
      { kind: 'click', world: { x: 0, y: 0 }, hoveredEntity: l1 },
      { kind: 'cursorMove', cursorWorld: { x: 0, y: 50 }, hoveredEntity: l2 },
      { kind: 'click', world: { x: 0, y: 50 }, hoveredEntity: l2 },
    ]);
    expect(next.currentType).toBe('angular2L');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tab / Space
// ──────────────────────────────────────────────────────────────────────────────

describe('Tab / Space modifiers', () => {
  it('Tab increments counter + re-detects in smart mode (line ⇒ aligned alt)', () => {
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'smart', styleId: STYLE_ID },
      { kind: 'cursorMove', cursorWorld: { x: 1, y: 1 },
        hoveredEntity: line('L1', { x: 0, y: 0 }, { x: 100, y: 0 }) },
      { kind: 'pressTab' },
    ]);
    expect(next.tabPressCount).toBe(1);
    // Line→linear base; Tab toggles to alt 'aligned' per SPACE_CYCLE['line'][1].
    expect(next.currentType).toBe('aligned');
  });

  it('Space increments + cycles through (circle → diameter → radius)', () => {
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'smart', styleId: STYLE_ID },
      { kind: 'cursorMove', cursorWorld: { x: 0, y: 0 },
        hoveredEntity: circle('C1', { x: 0, y: 0 }, 50) },
      { kind: 'pressSpace' },
    ]);
    expect(next.spacePressCount).toBe(1);
    expect(next.currentType).toBe('radius');
  });

  it('Tab / Space are no-ops in manual mode', () => {
    const started = dimensionCreateReducer(initialDimensionCreateState, {
      kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'linear',
    });
    const afterTab = dimensionCreateReducer(started, { kind: 'pressTab' });
    expect(afterTab).toBe(started);

    const afterSpace = dimensionCreateReducer(started, { kind: 'pressSpace' });
    expect(afterSpace).toBe(started);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Phase D2 — radial entity-pick guard + 2-click / 4-click flows
// ──────────────────────────────────────────────────────────────────────────────

describe('Phase D2 — radial click guard (Q-A: AutoCAD-style entity-pick required)', () => {
  it('manual dim-radius rejects click 1 when no arc/circle is under the cursor', () => {
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'radius' },
      { kind: 'click', world: { x: 0, y: 0 } },
    ]);
    expect(next.clicks).toEqual([]);
    expect(next.status).toBe('collecting');
  });

  it('manual dim-diameter rejects click 1 over an arc (must be a circle)', () => {
    const arcHover = arc('A1', { x: 0, y: 0 }, 50);
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'diameter' },
      { kind: 'click', world: { x: 0, y: 0 }, hoveredEntity: arcHover },
    ]);
    expect(next.clicks).toEqual([]);
  });

  it('manual dim-arc-length rejects click 1 over a circle (must be an arc)', () => {
    const circleHover = circle('C1', { x: 0, y: 0 }, 50);
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'arcLength' },
      { kind: 'click', world: { x: 0, y: 0 }, hoveredEntity: circleHover },
    ]);
    expect(next.clicks).toEqual([]);
  });

  it('manual dim-radius accepts click 1 over a circle (radius also valid for circles)', () => {
    const circleHover = circle('C1', { x: 0, y: 0 }, 50);
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'radius' },
      { kind: 'click', world: { x: 30, y: 40 }, hoveredEntity: circleHover },
    ]);
    expect(next.clicks).toHaveLength(1);
    expect(next.clicks[0].pickedEntity?.id).toBe('C1');
  });

  it('manual dim-ordinate has no entity-pick requirement (free 2-click flow)', () => {
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'ordinate' },
      { kind: 'click', world: { x: 10, y: 20 } },
    ]);
    expect(next.clicks).toHaveLength(1);
  });

  it('smart mode is unaffected by the guard (fallback to linear still works)', () => {
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'smart', styleId: STYLE_ID },
      { kind: 'click', world: { x: 0, y: 0 } },
    ]);
    expect(next.clicks).toHaveLength(1);
    expect(next.currentType).toBe('linear');
  });
});

describe('Phase D2 — commit-ready transitions', () => {
  it('radius: 2 clicks (pick arc + text position) → commit-ready', () => {
    const arcHover = arc('A1', { x: 0, y: 0 }, 50);
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'radius' },
      { kind: 'click', world: { x: 50, y: 0 }, hoveredEntity: arcHover },
      { kind: 'click', world: { x: 80, y: 30 } },
    ]);
    expect(next.status).toBe('commit-ready');
    expect(next.clicks).toHaveLength(2);
  });

  it('diameter: 2 clicks → commit-ready', () => {
    const circleHover = circle('C1', { x: 0, y: 0 }, 50);
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'diameter' },
      { kind: 'click', world: { x: 50, y: 0 }, hoveredEntity: circleHover },
      { kind: 'click', world: { x: 50, y: 40 } },
    ]);
    expect(next.status).toBe('commit-ready');
    expect(next.clicks).toHaveLength(2);
  });

  it('arcLength: 2 clicks → commit-ready', () => {
    const arcHover = arc('A1', { x: 0, y: 0 }, 50);
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'arcLength' },
      { kind: 'click', world: { x: 50, y: 0 }, hoveredEntity: arcHover },
      { kind: 'click', world: { x: 80, y: 30 } },
    ]);
    expect(next.status).toBe('commit-ready');
  });

  it('joggedRadius: 4 clicks → commit-ready (3 still collecting)', () => {
    const arcHover = arc('A1', { x: 0, y: 0 }, 50);
    const after3 = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'joggedRadius' },
      { kind: 'click', world: { x: 50, y: 0 }, hoveredEntity: arcHover },
      { kind: 'click', world: { x: 80, y: 30 } },
      { kind: 'click', world: { x: 120, y: 30 } },
    ]);
    expect(after3.status).toBe('collecting');
    const after4 = dimensionCreateReducer(after3, {
      kind: 'click', world: { x: 160, y: 30 },
    });
    expect(after4.status).toBe('commit-ready');
    expect(after4.clicks).toHaveLength(4);
  });

  it('ordinate: 2 clicks → commit-ready', () => {
    const next = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'manual', styleId: STYLE_ID, manualOverride: 'ordinate' },
      { kind: 'click', world: { x: 100, y: 50 } },
      { kind: 'click', world: { x: 150, y: 50 } },
    ]);
    expect(next.status).toBe('commit-ready');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// cancel
// ──────────────────────────────────────────────────────────────────────────────

describe('cancel action', () => {
  it('returns the initial frozen state regardless of prior state', () => {
    const populated = dispatchMany(initialDimensionCreateState, [
      { kind: 'start', mode: 'smart', styleId: STYLE_ID },
      { kind: 'click', world: { x: 1, y: 1 } },
      { kind: 'click', world: { x: 2, y: 2 } },
    ]);
    expect(populated.clicks).toHaveLength(2);
    const next = dimensionCreateReducer(populated, { kind: 'cancel' });
    expect(next).toBe(initialDimensionCreateState);
  });
});
