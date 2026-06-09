/**
 * ADR-402 Phase C — Bim3DEditStore multi-edit.
 * Verifies activateMove stores the whole id set + derives the primary, that the
 * type is null for multi (suppresses resize handles), and that selectEditEntityKey
 * tracks the membership set (so the gizmo re-anchors when a 2nd id is added).
 */

import {
  useBim3DEditStore,
  selectEditEntityKey,
  selectEditToolActive,
} from '../Bim3DEditStore';

beforeEach(() => {
  useBim3DEditStore.getState().deactivate();
});

describe('Bim3DEditStore — multi-edit', () => {
  it('activateMove stores all ids and derives the primary', () => {
    useBim3DEditStore.getState().activateMove(['a', 'b', 'c'], null);
    const st = useBim3DEditStore.getState();
    expect(st.editEntityIds).toEqual(['a', 'b', 'c']);
    expect(st.editEntityId).toBe('a');
    expect(st.editBimType).toBeNull();
    expect(st.editToolActive).toBe(true);
  });

  it('single activateMove keeps the type (for per-type resize handles)', () => {
    useBim3DEditStore.getState().activateMove(['a'], 'wall');
    const st = useBim3DEditStore.getState();
    expect(st.editBimType).toBe('wall');
    expect(st.editEntityId).toBe('a');
  });

  it('selectEditEntityKey reflects the membership set, not just the primary', () => {
    useBim3DEditStore.getState().activateMove(['a', 'b'], null);
    expect(selectEditEntityKey(useBim3DEditStore.getState())).toBe('a|b');
    useBim3DEditStore.getState().activateMove(['a', 'b', 'c'], null);
    expect(selectEditEntityKey(useBim3DEditStore.getState())).toBe('a|b|c');
  });

  it('deactivate clears the edit set', () => {
    useBim3DEditStore.getState().activateMove(['a'], 'wall');
    useBim3DEditStore.getState().deactivate();
    const st = useBim3DEditStore.getState();
    expect(st.editEntityIds).toEqual([]);
    expect(st.editEntityId).toBeNull();
    expect(selectEditToolActive(st)).toBe(false);
  });
});

describe('Bim3DEditStore — relocatable base point (ADR-408)', () => {
  it('defaults to null (entity centroid)', () => {
    useBim3DEditStore.getState().activateMove(['a'], 'wall');
    expect(useBim3DEditStore.getState().basePointOverride).toBeNull();
  });

  it('setBasePointOverride stores + clears the world point', () => {
    useBim3DEditStore.getState().activateMove(['a'], 'wall');
    useBim3DEditStore.getState().setBasePointOverride({ x: 1, y: 2, z: 3 });
    expect(useBim3DEditStore.getState().basePointOverride).toEqual({ x: 1, y: 2, z: 3 });
    useBim3DEditStore.getState().setBasePointOverride(null);
    expect(useBim3DEditStore.getState().basePointOverride).toBeNull();
  });

  it('a new/changed selection (activateMove) resets the override', () => {
    useBim3DEditStore.getState().activateMove(['a'], 'wall');
    useBim3DEditStore.getState().setBasePointOverride({ x: 1, y: 2, z: 3 });
    useBim3DEditStore.getState().activateMove(['b'], 'wall');
    expect(useBim3DEditStore.getState().basePointOverride).toBeNull();
  });

  it('deactivate clears the override', () => {
    useBim3DEditStore.getState().activateMove(['a'], 'wall');
    useBim3DEditStore.getState().setBasePointOverride({ x: 1, y: 2, z: 3 });
    useBim3DEditStore.getState().deactivate();
    expect(useBim3DEditStore.getState().basePointOverride).toBeNull();
  });
});
