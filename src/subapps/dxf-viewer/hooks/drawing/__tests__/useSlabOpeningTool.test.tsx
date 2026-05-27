/**
 * ADR-363 Phase 3.7 — useSlabOpeningTool state-machine tests.
 *
 * Covers the canonical 2-state placement flow:
 *   - activate → 'awaitingHostSlab'
 *   - click on slab → 'awaitingPosition' (hostSlabId locked)
 *   - click again → commit → onSlabOpeningCreated fires + chain back to
 *     'awaitingHostSlab'
 *   - host slab lookup miss → stays in 'awaitingHostSlab' with error
 *   - setKind resets FSM but preserves kind
 *   - reset returns to 'awaitingHostSlab' (kind + overrides preserved)
 *   - deactivate returns to 'idle'
 *   - status text key changes per phase
 */

import { renderHook, act } from '@testing-library/react';
import { useSlabOpeningTool } from '../useSlabOpeningTool';
import { computeSlabGeometry } from '../../../bim/geometry/slab-geometry';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../../bim/types/slab-opening-types';

function makeSlab(id = 'slab_test', overrides?: Partial<SlabParams>): SlabEntity {
  const params: SlabParams = {
    kind: 'floor',
    outline: {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 10000, y: 0, z: 0 },
        { x: 10000, y: 10000, z: 0 },
        { x: 0, y: 10000, z: 0 },
      ],
    },
    levelElevation: 0,
    thickness: 200,
    geometryType: 'box',
    ...overrides,
  };
  return {
    id,
    type: 'slab',
    kind: 'floor',
    layerId: '0',
    params,
    geometry: computeSlabGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as SlabEntity;
}

interface Harness {
  readonly slab: SlabEntity;
  readonly onSlabOpeningCreated: jest.Mock;
}

function makeHarness(): Harness {
  return { slab: makeSlab(), onSlabOpeningCreated: jest.fn() };
}

describe('useSlabOpeningTool', () => {
  it('initial state is idle until activated', () => {
    const { slab, onSlabOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useSlabOpeningTool({
        onSlabOpeningCreated,
        getSlabById: () => slab,
        getSlabAtPoint: () => slab,
      }),
    );
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('activate transitions to awaitingHostSlab', () => {
    const { slab, onSlabOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useSlabOpeningTool({
        onSlabOpeningCreated,
        getSlabById: () => slab,
        getSlabAtPoint: () => slab,
      }),
    );
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingHostSlab');
    expect(result.current.isActive).toBe(true);
  });

  it('host-slab click moves to awaitingPosition and locks hostSlabId', () => {
    const { slab, onSlabOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useSlabOpeningTool({
        onSlabOpeningCreated,
        getSlabById: () => slab,
        getSlabAtPoint: () => slab,
      }),
    );
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 3000, y: 3000 });
    });
    expect(result.current.state.phase).toBe('awaitingPosition');
    expect(result.current.state.hostSlabId).toBe(slab.id);
  });

  it('click with no slab under cursor stays in awaitingHostSlab + sets error', () => {
    const onSlabOpeningCreated = jest.fn();
    const { result } = renderHook(() =>
      useSlabOpeningTool({
        onSlabOpeningCreated,
        getSlabById: () => null,
        getSlabAtPoint: () => null,
      }),
    );
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 9999, y: 9999 });
    });
    expect(result.current.state.phase).toBe('awaitingHostSlab');
    expect(result.current.state.error).toBeTruthy();
    expect(onSlabOpeningCreated).not.toHaveBeenCalled();
  });

  it('second click commits + chains back to awaitingHostSlab', () => {
    const { slab, onSlabOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useSlabOpeningTool({
        onSlabOpeningCreated,
        getSlabById: () => slab,
        getSlabAtPoint: () => slab,
      }),
    );
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 3000, y: 3000 });
    });
    act(() => {
      result.current.onCanvasClick({ x: 4000, y: 4000 });
    });
    expect(onSlabOpeningCreated).toHaveBeenCalledTimes(1);
    const entity = onSlabOpeningCreated.mock.calls[0][0] as unknown as SlabOpeningEntity;
    expect(entity.type).toBe('slab-opening');
    expect(entity.params.slabId).toBe(slab.id);
    expect(entity.params.kind).toBe('shaft');
    expect(result.current.state.phase).toBe('awaitingHostSlab');
    expect(result.current.state.hostSlabId).toBeNull();
  });

  it('setKind preserves kind across FSM reset', () => {
    const { slab, onSlabOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useSlabOpeningTool({
        onSlabOpeningCreated,
        getSlabById: () => slab,
        getSlabAtPoint: () => slab,
      }),
    );
    act(() => result.current.activate());
    act(() => result.current.setKind('duct'));
    expect(result.current.state.kind).toBe('duct');
    expect(result.current.state.phase).toBe('awaitingHostSlab');
  });

  it('reset preserves kind + overrides', () => {
    const { slab, onSlabOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useSlabOpeningTool({
        onSlabOpeningCreated,
        getSlabById: () => slab,
        getSlabAtPoint: () => slab,
      }),
    );
    act(() => result.current.activate());
    act(() => result.current.setKind('well'));
    act(() => {
      result.current.onCanvasClick({ x: 5000, y: 5000 });
    });
    expect(result.current.state.phase).toBe('awaitingPosition');
    act(() => result.current.reset());
    expect(result.current.state.phase).toBe('awaitingHostSlab');
    expect(result.current.state.kind).toBe('well');
    expect(result.current.state.hostSlabId).toBeNull();
  });

  it('deactivate returns to idle', () => {
    const { slab, onSlabOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useSlabOpeningTool({
        onSlabOpeningCreated,
        getSlabById: () => slab,
        getSlabAtPoint: () => slab,
      }),
    );
    act(() => result.current.activate());
    act(() => result.current.deactivate());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('status text key changes per phase', () => {
    const { slab, onSlabOpeningCreated } = makeHarness();
    const { result } = renderHook(() =>
      useSlabOpeningTool({
        onSlabOpeningCreated,
        getSlabById: () => slab,
        getSlabAtPoint: () => slab,
      }),
    );
    expect(result.current.getStatusText()).toBe('');
    act(() => result.current.activate());
    expect(result.current.getStatusText()).toBe('tools.slabOpening.statusHostSlab');
    act(() => {
      result.current.onCanvasClick({ x: 3000, y: 3000 });
    });
    expect(result.current.getStatusText()).toBe('tools.slabOpening.statusPosition');
  });
});
