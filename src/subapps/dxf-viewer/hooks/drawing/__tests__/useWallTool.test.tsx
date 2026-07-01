/**
 * ADR-363 Phase 1B + 1F — useWallTool state-machine tests.
 *
 * Covers the canonical 3-click placement flow (Phase 1F):
 *   - activate → 'awaitingStart'
 *   - click 1 → 'awaitingEnd' (startPoint stamped)
 *   - click 2 → 'awaitingAlignment' (endPoint stamped)
 *   - click 3 → commit with lateral offset toward C → back to 'awaitingStart'
 *   - reset clears startPoint
 *   - deactivate returns to 'idle'
 *
 * Validator hardErrors (e.g. zero-length wall) MUST not propagate as a commit
 * — the tool stays in `awaitingAlignment` and surfaces `state.error`.
 */

import { renderHook, act } from '@testing-library/react';
import { useWallTool } from '../useWallTool';
import type { WallEntity } from '../../../bim/types/wall-types';

describe('useWallTool', () => {
  it('initial state is idle until activated', () => {
    const { result } = renderHook(() => useWallTool());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('activate transitions to awaitingStart', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(result.current.isActive).toBe(true);
  });

  it('first click moves to awaitingEnd and stamps startPoint', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 100, y: 200 });
    });
    expect(result.current.state.phase).toBe('awaitingEnd');
    expect(result.current.state.startPoint).toEqual({ x: 100, y: 200 });
  });

  it('second click stores endPoint and transitions to awaitingAlignment', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    act(() => {
      result.current.onCanvasClick({ x: 5000, y: 0 });
    });
    expect(onWallCreated).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('awaitingAlignment');
    expect(result.current.state.endPoint).toEqual({ x: 5000, y: 0 });
    expect(result.current.isAwaitingAlignment).toBe(true);
  });

  it('third click commits with lateral offset (cross > 0 → wall shifts +n_ccw)', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    // Axis along +X (A→B horizontal). With CCW perpendicular = +Y, the "left"
    // side of A→B is +Y. A C-click at +Y => cross > 0 => axis shifts +Y by
    // halfThickness => the "inner" edge (= old axis line) sits on A→B.
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 5000, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 2500, y: 1000 }); });
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    const entity = onWallCreated.mock.calls[0][0] as WallEntity;
    expect(entity.type).toBe('wall');
    expect(entity.kind).toBe('straight');
    const half = entity.params.thickness / 2;
    expect(entity.params.start.x).toBeCloseTo(0, 6);
    expect(entity.params.start.y).toBeCloseTo(half, 6);
    expect(entity.params.end.x).toBeCloseTo(5000, 6);
    expect(entity.params.end.y).toBeCloseTo(half, 6);
    // Continuous chain.
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(result.current.state.startPoint).toBeNull();
    expect(result.current.state.endPoint).toBeNull();
  });

  it('third click on the opposite side (cross < 0) shifts wall in -n_ccw direction', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 5000, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 2500, y: -1000 }); });
    const entity = onWallCreated.mock.calls[0][0] as WallEntity;
    const half = entity.params.thickness / 2;
    expect(entity.params.start.y).toBeCloseTo(-half, 6);
    expect(entity.params.end.y).toBeCloseTo(-half, 6);
  });

  it('zero-length wall fails validation — no commit, stays in awaitingAlignment', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => {
      // Click 2 at same point as click 1 → stored as endPoint, validator
      // does not run yet (commit happens on click 3).
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    expect(result.current.state.phase).toBe('awaitingAlignment');
    act(() => {
      // Click 3 → commit attempt → zero-length axis → validator hardError.
      result.current.onCanvasClick({ x: 100, y: 100 });
    });
    expect(onWallCreated).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('awaitingAlignment');
    expect(result.current.state.error).toBeTruthy();
  });

  it('reset clears startPoint and returns to awaitingStart', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 50, y: 50 });
    });
    act(() => result.current.reset());
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(result.current.state.startPoint).toBeNull();
  });

  it('deactivate returns to idle', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => result.current.deactivate());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('setParamOverrides merges into state', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => result.current.setParamOverrides({ category: 'interior', height: 2700 }));
    expect(result.current.state.overrides.category).toBe('interior');
    expect(result.current.state.overrides.height).toBe(2700);
  });

  it('overrides flow through to created entity', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => result.current.setParamOverrides({ category: 'partition' }));
    act(() => {
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    act(() => {
      result.current.onCanvasClick({ x: 3000, y: 0 });
    });
    act(() => {
      result.current.onCanvasClick({ x: 1500, y: 500 });
    });
    const entity = onWallCreated.mock.calls[0][0] as WallEntity;
    expect(entity.params.category).toBe('partition');
  });

  it('click in idle phase is a no-op (does not advance machine)', () => {
    const { result } = renderHook(() => useWallTool());
    const ok = result.current.onCanvasClick({ x: 1, y: 1 });
    expect(ok).toBe(false);
    expect(result.current.state.phase).toBe('idle');
  });

  it('getStatusText returns i18n keys per phase', () => {
    const { result } = renderHook(() => useWallTool());
    expect(result.current.getStatusText()).toBe('');
    act(() => result.current.activate());
    expect(result.current.getStatusText()).toBe('tools.wall.statusStart');
    act(() => {
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    expect(result.current.getStatusText()).toBe('tools.wall.statusEnd');
    act(() => {
      result.current.onCanvasClick({ x: 1000, y: 0 });
    });
    expect(result.current.getStatusText()).toBe('tools.wall.statusAlignment');
  });

  // ─── ADR-363 Phase 1C — curved + polyline flows ────────────────────────

  it('setKind switches active wall kind and resets the phase', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => result.current.setKind('curved'));
    expect(result.current.state.kind).toBe('curved');
    expect(result.current.state.phase).toBe('awaitingStart');
  });

  it('curved kind: 3-click flow start → end → control → commit', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => result.current.setKind('curved'));
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingEnd');
    act(() => { result.current.onCanvasClick({ x: 1000, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingCurveControl');
    act(() => { result.current.onCanvasClick({ x: 500, y: 300 }); });
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    const entity = onWallCreated.mock.calls[0][0] as WallEntity;
    expect(entity.kind).toBe('curved');
    expect(entity.params.curveControl).toMatchObject({ x: 500, y: 300 });
  });

  it('polyline kind: N-click flow + finishPolyline commits', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => result.current.setKind('polyline'));
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingNextVertex');
    act(() => { result.current.onCanvasClick({ x: 1000, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 1500, y: 500 }); });
    act(() => { result.current.onCanvasClick({ x: 2000, y: 0 }); });
    expect(result.current.state.polylineVertices).toHaveLength(4);
    act(() => { result.current.finishPolyline(); });
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    const entity = onWallCreated.mock.calls[0][0] as WallEntity;
    expect(entity.kind).toBe('polyline');
    expect(entity.params.polylineVertices).toHaveLength(4);
  });

  it('finishPolyline is a no-op for straight kind', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    const ok = result.current.finishPolyline();
    expect(ok).toBe(false);
    expect(onWallCreated).not.toHaveBeenCalled();
  });

  // ─── ADR-363 Phase 1H — ESC incremental back-step ──────────────────────

  it('backToAwaitingEnd steps awaitingAlignment → awaitingEnd, drops end, keeps start', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 5000, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingAlignment');
    let stepped = false;
    act(() => { stepped = result.current.backToAwaitingEnd(); });
    expect(stepped).toBe(true);
    expect(result.current.state.phase).toBe('awaitingEnd');
    expect(result.current.state.endPoint).toBeNull();
    expect(result.current.state.startPoint).toEqual({ x: 0, y: 0 });
  });

  it('backToAwaitingEnd lets the user re-pick the end (back to awaitingAlignment)', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 5000, y: 0 }); });
    act(() => { result.current.backToAwaitingEnd(); });
    // Re-pick a different end, then alignment, then commit.
    act(() => { result.current.onCanvasClick({ x: 3000, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingAlignment');
    expect(result.current.state.endPoint).toEqual({ x: 3000, y: 0 });
    act(() => { result.current.onCanvasClick({ x: 1500, y: 1000 }); });
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    const entity = onWallCreated.mock.calls[0][0] as WallEntity;
    expect(entity.params.end.x).toBeCloseTo(3000, 6);
  });

  it('backToAwaitingEnd is a no-op outside awaitingAlignment', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    expect(result.current.backToAwaitingEnd()).toBe(false);
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingEnd');
    expect(result.current.backToAwaitingEnd()).toBe(false);
    expect(result.current.state.phase).toBe('awaitingEnd');
  });

  it('ESC key routes through the escape bus to the back-step while awaitingAlignment', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 5000, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingAlignment');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.state.phase).toBe('awaitingEnd');
    expect(result.current.state.endPoint).toBeNull();
  });

  // ─── ADR-363 Phase 1J — on-entity placement (pick line/rectangle) ──────

  const lineEnt = {
    id: 'l1', type: 'line', layer: '0',
    start: { x: 0, y: 0 }, end: { x: 5000, y: 0 },
  } as unknown as import('../../../types/entities').Entity;

  const rectEnt = {
    id: 'r1', type: 'rectangle', layer: '0',
    x: 0, y: 0, width: 5000, height: 3000,
  } as unknown as import('../../../types/entities').Entity;

  it('on-entity: first click picks the line → awaitingSide', () => {
    const { result } = renderHook(() => useWallTool({ getSceneEntities: () => [lineEnt] }));
    act(() => result.current.setPlacementMode('on-entity'));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 2500, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingSide');
    expect(result.current.isAwaitingSide).toBe(true);
    expect(result.current.state.pickedSource?.kind).toBe('line');
  });

  it('on-entity: line 2-click flow creates exactly one wall', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() =>
      useWallTool({ onWallCreated, getSceneEntities: () => [lineEnt] }),
    );
    act(() => result.current.setPlacementMode('on-entity'));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 2500, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 2500, y: 1000 }); });
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    const entity = onWallCreated.mock.calls[0][0] as WallEntity;
    expect(entity.kind).toBe('straight');
    // Continuous: back to awaitingStart, source cleared.
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(result.current.state.pickedSource).toBeNull();
  });

  it('on-entity: rectangle 2-click flow creates four walls', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() =>
      useWallTool({ onWallCreated, getSceneEntities: () => [rectEnt] }),
    );
    act(() => result.current.setPlacementMode('on-entity'));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 2500, y: 0 }); }); // hit perimeter
    expect(result.current.state.pickedSource?.kind).toBe('closed');
    act(() => { result.current.onCanvasClick({ x: 2500, y: 1500 }); }); // inside
    expect(onWallCreated).toHaveBeenCalledTimes(4);
  });

  it('on-entity: click on empty space is a no-op (stays awaitingStart)', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() =>
      useWallTool({ onWallCreated, getSceneEntities: () => [lineEnt] }),
    );
    act(() => result.current.setPlacementMode('on-entity'));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 2500, y: 999 }); }); // far from line
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(onWallCreated).not.toHaveBeenCalled();
  });

  it('on-entity: getStatusText returns the pick/side i18n keys', () => {
    const { result } = renderHook(() => useWallTool({ getSceneEntities: () => [lineEnt] }));
    act(() => result.current.setPlacementMode('on-entity'));
    act(() => result.current.activate());
    expect(result.current.getStatusText()).toBe('tools.wall.statusPickEntity');
    act(() => { result.current.onCanvasClick({ x: 2500, y: 0 }); });
    expect(result.current.getStatusText()).toBe('tools.wall.statusPickSide');
  });

  // ─── ADR-419 — in-region «κλικ μέσα» continuous chain (regression) ──────
  // 4 LINE entities closing a thin (5000 × 250) wall-footprint rectangle: clicking
  // inside fills ONE wall. The bug: the commit reset dropped `regionMethod`, so the
  // 2nd click fell back to the 'lines' method and was ignored until a hard refresh.
  const regionRectLines = [
    { id: 'rr-b', type: 'line', layerId: '0', start: { x: 0, y: 0 }, end: { x: 5000, y: 0 } },
    { id: 'rr-r', type: 'line', layerId: '0', start: { x: 5000, y: 0 }, end: { x: 5000, y: 250 } },
    { id: 'rr-t', type: 'line', layerId: '0', start: { x: 5000, y: 250 }, end: { x: 0, y: 250 } },
    { id: 'rr-l', type: 'line', layerId: '0', start: { x: 0, y: 250 }, end: { x: 0, y: 0 } },
  ] as unknown as import('../../../types/entities').Entity[];

  it('in-region "inside": commit preserves regionMethod → every click fills a wall (ADR-419)', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() =>
      useWallTool({ onWallCreated, getSceneEntities: () => regionRectLines }),
    );
    act(() => result.current.setPlacementMode('in-region'));
    act(() => result.current.setRegionMethod('inside'));
    act(() => result.current.activate());
    // 1st click inside the rectangle → fills ONE wall.
    act(() => { result.current.onCanvasClick({ x: 2500, y: 125 }); });
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    // Continuous chain: the method MUST survive the commit (the bug reset it to 'lines').
    expect(result.current.state.regionMethod).toBe('inside');
    expect(result.current.state.placementMode).toBe('in-region');
    expect(result.current.state.phase).toBe('awaitingStart');
    // 2nd click inside the SAME region → another wall (was a silent no-op before the fix).
    act(() => { result.current.onCanvasClick({ x: 2500, y: 125 }); });
    expect(onWallCreated).toHaveBeenCalledTimes(2);
  });

  // ─── Β (Giorgio 2026-07-01) — σκέτος «Τοίχος»: click μέσα σε DXF παραλληλόγραμμο ──
  // γεμίζει τοίχο (auto), χωρίς να μπει σε in-region mode· εκτός παραλληλογράμμου →
  // κανονική ελεύθερη σχεδίαση 2 κλικ.
  it('plain wall: 1st click inside a detected DXF rectangle fills ONE wall (auto)', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() =>
      useWallTool({ onWallCreated, getSceneEntities: () => regionRectLines }),
    );
    // Default freehand + straight — καμία ρητή αλλαγή mode (αυτό είναι το ζητούμενο).
    act(() => result.current.activate());
    expect(result.current.state.placementMode).toBe('freehand');
    act(() => { result.current.onCanvasClick({ x: 2500, y: 125 }); });
    // Ο τοίχος γέμισε το ορθογώνιο — ΔΕΝ ξεκίνησε freehand (δεν κρατήθηκε start).
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(result.current.state.startPoint).toBeNull();
    expect(result.current.state.placementMode).toBe('freehand');
  });

  it('plain wall: 1st click in empty space starts normal freehand drawing (no fill)', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() =>
      useWallTool({ onWallCreated, getSceneEntities: () => regionRectLines }),
    );
    act(() => result.current.activate());
    // Μακριά από κάθε παραλληλόγραμμο → κανονική αρχή freehand (κλικ 1 = start).
    act(() => { result.current.onCanvasClick({ x: 999999, y: 999999 }); });
    expect(onWallCreated).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('awaitingEnd');
    expect(result.current.state.startPoint).not.toBeNull();
  });
});
