/**
 * ADR-363 Phase 1B + ADR-508 — useWallTool state-machine tests.
 *
 * Covers the canonical 2-click straight placement flow (ADR-508, mirror of the
 * beam tool):
 *   - activate → 'awaitingStart'
 *   - click 1 → 'awaitingEnd' (startPoint stamped)
 *   - click 2 → commit (the drawn A→B line is the finish-face edge, +n_ccw side)
 *               → continuous chain back to 'awaitingStart'
 *   - reset clears startPoint
 *   - deactivate returns to 'idle'
 *
 * NOTE: the legacy 3-click `awaitingAlignment` side-pick is no longer reachable
 * from mouse clicks (ADR-508). The `awaitingAlignment` state + `backToAwaitingEnd`
 * back-step are retained only as a dormant precision path; the no-op guard is
 * covered below ("backToAwaitingEnd is a no-op outside awaitingAlignment").
 *
 * Validator hardErrors (e.g. zero-length wall) MUST not propagate as a commit
 * — the tool stays in `awaitingEnd` and surfaces `state.error`.
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

  it('second click commits the wall (2-click straight flow, ADR-508)', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    act(() => {
      result.current.onCanvasClick({ x: 5000, y: 0 });
    });
    // ADR-508 — the straight wall commits on the 2nd click (mirror of the beam
    // tool); there is no separate `awaitingAlignment` side-pick. The continuous
    // chain resets the in-progress geometry and returns to `awaitingStart`.
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(result.current.state.endPoint).toBeNull();
    expect(result.current.isAwaitingAlignment).toBe(false);
  });

  it('2-click straight commits with the drawn A→B line as the finish-face edge', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    // ADR-508 "Location Line = Finish Face": axis along +X (A→B horizontal). The
    // default side is +n_ccw (= +Y here), so the axis shifts +Y by halfThickness ⇒
    // the drawn A→B line sits on the wall's −n_ccw edge and the body extends +Y.
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 5000, y: 0 }); });
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

  it('continuous chain: a second wall can be drawn immediately after commit', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 5000, y: 0 }); });
    expect(onWallCreated).toHaveBeenCalledTimes(1);
    // The tool is back at awaitingStart with no leftover geometry.
    expect(result.current.state.phase).toBe('awaitingStart');
    expect(result.current.state.startPoint).toBeNull();
    // A fresh 2-click chain (parallel wall, not collinear) commits a second wall.
    act(() => { result.current.onCanvasClick({ x: 0, y: 2000 }); });
    act(() => { result.current.onCanvasClick({ x: 5000, y: 2000 }); });
    expect(onWallCreated).toHaveBeenCalledTimes(2);
  });

  it('zero-length wall fails validation — no commit, stays in awaitingEnd', () => {
    const onWallCreated = jest.fn();
    const { result } = renderHook(() => useWallTool({ onWallCreated }));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => {
      // Click 2 at the same point as click 1 → the 2-click commit runs the
      // validator → zero-length axis → hardError, no commit.
      result.current.onCanvasClick({ x: 0, y: 0 });
    });
    expect(onWallCreated).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('awaitingEnd');
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
    // ADR-508 — the 2nd click commits; the continuous chain returns to the start prompt.
    expect(result.current.getStatusText()).toBe('tools.wall.statusStart');
  });

  // ─── ADR-363 Phase 1C — curved + polyline flows ────────────────────────

  it('setKind switches active wall kind and resets the phase', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    act(() => result.current.setKind('curved'));
    expect(result.current.state.kind).toBe('curved');
    expect(result.current.state.phase).toBe('awaitingStart');
  });

  // ADR-565 — the 3rd click is now the point the circular arc passes THROUGH
  // (Tekla/AutoCAD 3-point ARC), normalized to the canonical `arc` bulge scalar.
  // The legacy Bézier `curveControl` is no longer produced for a non-collinear
  // 3rd click.
  it('curved kind: 3-click flow start → end → on-arc → commit (arc bulge)', () => {
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
    expect(entity.params.arc).toEqual(expect.any(Number));
    expect(Number.isFinite(entity.params.arc)).toBe(true);
    expect(entity.params.curveControl).toBeUndefined();
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

  // ─── ADR-363 Phase 1H / ADR-508 — ESC incremental back-step ────────────
  // The legacy 3-click `awaitingAlignment` side-pick is no longer reachable from
  // mouse clicks (ADR-508 committed the straight wall on the 2nd click), so the
  // positive `backToAwaitingEnd` transition can only be exercised via the dormant
  // precision path. The still-live guard — `backToAwaitingEnd`/ESC are inert
  // outside `awaitingAlignment` — is what the 2-click flow relies on and is
  // asserted below.

  it('backToAwaitingEnd is a no-op outside awaitingAlignment', () => {
    const { result } = renderHook(() => useWallTool());
    act(() => result.current.activate());
    expect(result.current.backToAwaitingEnd()).toBe(false);
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingEnd');
    expect(result.current.backToAwaitingEnd()).toBe(false);
    expect(result.current.state.phase).toBe('awaitingEnd');
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
