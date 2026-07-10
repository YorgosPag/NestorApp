/**
 * ADR-626 — `usePolygonAreaTool` shared closed-area drawing-tool SSoT tests.
 *
 * Locks the domain-wrapper contract over the canonical `usePolygonSketchChain` FSM
 * (ADR-363): overrides/error state, live-preview store writes, status keys, and the
 * build+commit closure. Uses the REAL sketch-chain (no face-snap targets → vertex
 * identity), a fake preview store, and a spy `commitEntity`. Plus a module-load
 * smoke over the 3 thin bindings (@swc/jest is transpile-only → misses broken
 * imports/exports; this catches them).
 */

import { renderHook, act } from '@testing-library/react';
import { usePolygonAreaTool, type PolygonAreaBuildResult } from '../use-polygon-area-tool';

interface Overrides { thicknessMm?: number }

function makeStore() {
  return { set: jest.fn(), reset: jest.fn() };
}

function cfg(overrides: Partial<Parameters<typeof usePolygonAreaTool<Overrides, { id: string }>>[0]> = {}) {
  return {
    previewStore: makeStore(),
    commitEntity: jest.fn(
      (): PolygonAreaBuildResult<{ id: string }> => ({ ok: true, entity: { id: 'e1' } }),
    ),
    statusKeys: { first: 'k.first', next: 'k.next' },
    ...overrides,
  };
}

const P = (x: number, y: number) => ({ x, y });

describe('usePolygonAreaTool', () => {
  it('is idle until activated (empty status)', () => {
    const { result } = renderHook(() => usePolygonAreaTool<Overrides, { id: string }>(cfg()));
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
    expect(result.current.getStatusText()).toBe('');
  });

  it('activate → awaitingFirstVertex with first-status key', () => {
    const { result } = renderHook(() => usePolygonAreaTool<Overrides, { id: string }>(cfg()));
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingFirstVertex');
    expect(result.current.getStatusText()).toBe('k.first');
  });

  it('accumulates clicked vertices + writes the live preview store', () => {
    const store = makeStore();
    const { result } = renderHook(() => usePolygonAreaTool<Overrides, { id: string }>(cfg({ previewStore: store })));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick(P(0, 0)); });
    act(() => { result.current.onCanvasClick(P(1000, 0)); });
    expect(result.current.state.vertices).toHaveLength(2);
    expect(result.current.state.phase).toBe('awaitingNextVertex');
    expect(result.current.getStatusText()).toBe('k.next');
    expect(store.set).toHaveBeenCalled();
  });

  it('finishPolygon builds via commitEntity + fires onCreated, then continuous-draws', () => {
    const commitEntity = jest.fn(
      (): PolygonAreaBuildResult<{ id: string }> => ({ ok: true, entity: { id: 'built' } }),
    );
    const onCreated = jest.fn();
    const getSceneUnits = () => 'cm' as const;
    const { result } = renderHook(() =>
      usePolygonAreaTool<Overrides, { id: string }>(cfg({ commitEntity, onCreated, getSceneUnits, currentLevelId: 'L7' })),
    );
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick(P(0, 0)); });
    act(() => { result.current.onCanvasClick(P(1000, 0)); });
    act(() => { result.current.onCanvasClick(P(1000, 1000)); });
    let committed = false;
    act(() => { committed = result.current.finishPolygon(); });
    expect(committed).toBe(true);
    expect(commitEntity).toHaveBeenCalledTimes(1);
    const [vertices, overrides, units, levelId] = commitEntity.mock.calls[0];
    expect(vertices).toHaveLength(3);
    expect(overrides).toEqual({});
    expect(units).toBe('cm');
    expect(levelId).toBe('L7');
    expect(onCreated).toHaveBeenCalledWith({ id: 'built' });
    // continuous draw — back to awaitingFirstVertex, vertices cleared
    expect(result.current.state.phase).toBe('awaitingFirstVertex');
    expect(result.current.state.vertices).toHaveLength(0);
  });

  it('surfaces the validator hardError and stays in awaitingNextVertex', () => {
    const commitEntity = jest.fn(
      (): PolygonAreaBuildResult<{ id: string }> => ({ ok: false, hardErrors: ['bad-polygon'] }),
    );
    const { result } = renderHook(() => usePolygonAreaTool<Overrides, { id: string }>(cfg({ commitEntity })));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick(P(0, 0)); });
    act(() => { result.current.onCanvasClick(P(1000, 0)); });
    act(() => { result.current.onCanvasClick(P(1000, 1000)); });
    act(() => { result.current.finishPolygon(); });
    expect(result.current.state.error).toBe('bad-polygon');
    expect(result.current.state.phase).toBe('awaitingNextVertex');
  });

  it('setParamOverrides merges and forwards overrides to commitEntity', () => {
    const commitEntity = jest.fn(
      (): PolygonAreaBuildResult<{ id: string }> => ({ ok: true, entity: { id: 'e' } }),
    );
    const { result } = renderHook(() => usePolygonAreaTool<Overrides, { id: string }>(cfg({ commitEntity })));
    act(() => result.current.activate());
    act(() => result.current.setParamOverrides({ thicknessMm: 40 }));
    expect(result.current.state.overrides).toEqual({ thicknessMm: 40 });
    act(() => { result.current.onCanvasClick(P(0, 0)); });
    act(() => { result.current.onCanvasClick(P(1000, 0)); });
    act(() => { result.current.onCanvasClick(P(1000, 1000)); });
    act(() => { result.current.finishPolygon(); });
    expect(commitEntity.mock.calls[0][1]).toEqual({ thicknessMm: 40 });
  });

  it('deactivate resets overrides + error and clears the preview store', () => {
    const store = makeStore();
    const { result } = renderHook(() => usePolygonAreaTool<Overrides, { id: string }>(cfg({ previewStore: store })));
    act(() => result.current.activate());
    act(() => result.current.setParamOverrides({ thicknessMm: 99 }));
    act(() => result.current.deactivate());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.state.overrides).toEqual({});
    expect(store.reset).toHaveBeenCalled();
  });
});

describe('module-load smoke — 3 thin bindings export a callable', () => {
  const modules: ReadonlyArray<readonly [string, string]> = [
    ['../useFloorFinishTool', 'useFloorFinishTool'],
    ['../useRoofTool', 'useRoofTool'],
    ['../useMepUnderfloorTool', 'useMepUnderfloorTool'],
  ];
  it.each(modules)('%s exports a callable %s', (path, name) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(path) as Record<string, unknown>;
    expect(typeof mod[name]).toBe('function');
  });
});
