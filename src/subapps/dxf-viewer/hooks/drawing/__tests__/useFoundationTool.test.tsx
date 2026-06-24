/**
 * ADR-436 Slice 1 + Slice 2 — `useFoundationTool` state-machine tests.
 *
 * Coverage:
 *   - initial idle until activate
 *   - pad: single-click commit + chain back to awaitingPosition
 *   - strip/tie-beam: 2-click line commit + chain back to awaitingStart
 *   - setKind switches FSM entry phase (pad ⇄ line)
 *   - from-wall: 1-click pick commits a strip on the wall axis
 *   - status text keys per phase/mode
 */

import { renderHook, act } from '@testing-library/react';
import { useFoundationTool } from '../useFoundationTool';
import type { FoundationEntity } from '../../../bim/types/foundation-types';
import type { Entity } from '../../../types/entities';
import type { WallEntity } from '../../../bim/types/wall-types';
import { clearPlacementRotationLock } from '../../../systems/cursor/PlacementRotationStore';

afterEach(() => clearPlacementRotationLock()); // ADR-514 Φ6d — μην διαρρεύσει pad rotation lock μεταξύ tests

const wallFixture = (id: string): WallEntity =>
  ({
    id,
    type: 'wall',
    kind: 'straight',
    params: { category: 'structural', start: { x: 0, y: 0, z: 0 }, end: { x: 4000, y: 0, z: 0 }, height: 3000, thickness: 300, flip: false },
    geometry: {},
  } as unknown as WallEntity);

describe('useFoundationTool', () => {
  it('initial state is idle until activated', () => {
    const { result } = renderHook(() => useFoundationTool({ onFoundationCreated: jest.fn() }));
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  // ADR-514 Φ6d — pad place+rotate (2-click, mirror κολώνας «μέχρι και την περιστροφή»):
  // 1ο κλικ κλειδώνει θέση+λαβή (awaitingRotation, ΚΑΜΙΑ δημιουργία), 2ο κλικ ορίζει γωνία → commit + chain.
  it('pad: 2-click place+rotate — 1ο κλικ → awaitingRotation, 2ο → commit + chain', () => {
    const onFoundationCreated = jest.fn();
    const { result } = renderHook(() => useFoundationTool({ onFoundationCreated }));
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingPosition');
    // 1ο κλικ — κλειδώνει θέση, ΔΕΝ commit-άρει.
    let firstClick = true;
    act(() => { firstClick = result.current.onCanvasClick({ x: 100, y: 100 }); });
    expect(firstClick).toBe(false);
    expect(result.current.state.phase).toBe('awaitingRotation');
    expect(onFoundationCreated).not.toHaveBeenCalled();
    // 2ο κλικ — ορίζει γωνία → commit + chain πίσω σε awaitingPosition.
    let committed = false;
    act(() => { committed = result.current.onCanvasClick({ x: 600, y: 100 }); });
    expect(committed).toBe(true);
    expect(onFoundationCreated).toHaveBeenCalledTimes(1);
    const entity = onFoundationCreated.mock.calls[0][0] as FoundationEntity;
    expect(entity.kind).toBe('pad');
    expect(result.current.state.phase).toBe('awaitingPosition');
  });

  it('pad: status text → statusPosition (1ο κλικ) μετά statusRotation (awaitingRotation)', () => {
    const { result } = renderHook(() => useFoundationTool({ onFoundationCreated: jest.fn() }));
    act(() => result.current.activate());
    expect(result.current.getStatusText()).toBe('tools.foundation.statusPosition');
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.getStatusText()).toBe('tools.foundation.statusRotation');
  });

  it('pad: ESC (reset) κατά το awaitingRotation → επιστροφή σε awaitingPosition χωρίς commit', () => {
    const onFoundationCreated = jest.fn();
    const { result } = renderHook(() => useFoundationTool({ onFoundationCreated }));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 100, y: 100 }); });
    expect(result.current.state.phase).toBe('awaitingRotation');
    act(() => result.current.reset());
    expect(result.current.state.phase).toBe('awaitingPosition');
    expect(onFoundationCreated).not.toHaveBeenCalled();
  });

  it('strip: 2-click line commit + chain back to awaitingStart', () => {
    const onFoundationCreated = jest.fn();
    const { result } = renderHook(() => useFoundationTool({ onFoundationCreated }));
    act(() => result.current.setKind('strip'));
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingStart');
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.state.phase).toBe('awaitingEnd');
    let committed = false;
    act(() => { committed = result.current.onCanvasClick({ x: 3000, y: 0 }); });
    expect(committed).toBe(true);
    expect(onFoundationCreated).toHaveBeenCalledTimes(1);
    const entity = onFoundationCreated.mock.calls[0][0] as FoundationEntity;
    expect(entity.kind).toBe('strip');
    expect(result.current.state.phase).toBe('awaitingStart');
  });

  it('tie-beam: 2-click line commit produces a tie-beam entity', () => {
    const onFoundationCreated = jest.fn();
    const { result } = renderHook(() => useFoundationTool({ onFoundationCreated }));
    act(() => result.current.setKind('tie-beam'));
    act(() => result.current.activate());
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    act(() => { result.current.onCanvasClick({ x: 2000, y: 0 }); });
    expect((onFoundationCreated.mock.calls[0][0] as FoundationEntity).kind).toBe('tie-beam');
  });

  it('setKind switches FSM entry phase (pad → line)', () => {
    const { result } = renderHook(() => useFoundationTool({ onFoundationCreated: jest.fn() }));
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingPosition');
    act(() => result.current.setKind('strip'));
    expect(result.current.state.phase).toBe('awaitingStart');
    act(() => result.current.setKind('pad'));
    expect(result.current.state.phase).toBe('awaitingPosition');
  });

  it('from-wall: 1-click pick commits a strip on the wall axis (width = thickness)', () => {
    const onFoundationCreated = jest.fn();
    const wall = wallFixture('wall-1');
    const { result } = renderHook(() =>
      useFoundationTool({ onFoundationCreated, getSceneEntities: () => [wall as unknown as Entity] }),
    );
    act(() => result.current.setKind('strip'));
    act(() => result.current.setPlacementMode('from-wall'));
    act(() => result.current.activate());
    let committed = false;
    act(() => { committed = result.current.onCanvasClick({ x: 2000, y: 0 }); });
    expect(committed).toBe(true);
    const entity = onFoundationCreated.mock.calls[0][0] as FoundationEntity;
    expect(entity.kind).toBe('strip');
    expect(entity.params.width).toBe(300);
  });

  it('status text keys reflect phase + placement mode', () => {
    const { result } = renderHook(() => useFoundationTool({ onFoundationCreated: jest.fn() }));
    act(() => result.current.setKind('strip'));
    act(() => result.current.activate());
    expect(result.current.getStatusText()).toBe('tools.foundation.statusStart');
    act(() => { result.current.onCanvasClick({ x: 0, y: 0 }); });
    expect(result.current.getStatusText()).toBe('tools.foundation.statusEnd');
    act(() => { result.current.setPlacementMode('from-wall'); });
    expect(result.current.getStatusText()).toBe('tools.foundation.statusPickWall');
  });

  it('deactivate returns to idle', () => {
    const { result } = renderHook(() => useFoundationTool({ onFoundationCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.deactivate());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });
});
