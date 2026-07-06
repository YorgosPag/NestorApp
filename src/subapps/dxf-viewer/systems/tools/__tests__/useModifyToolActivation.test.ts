/**
 * Tests — useModifyToolActivation (shared 2-click modify-tool FSM SSoT, ADR-577).
 *
 * Covers all four transition branches + the `onActivate` override, mirroring the
 * behaviour the Move/Copy/Rotate/Scale/Mirror tools each used to hand-roll.
 */
import { renderHook } from '@testing-library/react';
import { useModifyToolActivation, type ModifyToolActivationConfig } from '../useModifyToolActivation';

type Props = Omit<ModifyToolActivationConfig, 'setPhase' | 'onDeactivate' | 'onActivate'> & {
  setPhase: jest.Mock;
  onDeactivate: jest.Mock;
  onActivate?: jest.Mock;
};

function base(overrides: Partial<Props> = {}): Props {
  return {
    isActive: false,
    selectionCount: 0,
    phase: 'idle',
    entityPhase: 'awaiting-entity',
    basePhase: 'awaiting-base-point',
    setPhase: jest.fn(),
    onDeactivate: jest.fn(),
    ...overrides,
  };
}

describe('useModifyToolActivation', () => {
  it('ACTIVATE with a selection → base phase', () => {
    const p = base();
    const { rerender } = renderHook((props: Props) => useModifyToolActivation(props), { initialProps: p });
    rerender({ ...p, isActive: true, selectionCount: 2 });
    expect(p.setPhase).toHaveBeenLastCalledWith('awaiting-base-point');
  });

  it('ACTIVATE without a selection → entity phase (never idle/revert)', () => {
    const p = base();
    const { rerender } = renderHook((props: Props) => useModifyToolActivation(props), { initialProps: p });
    rerender({ ...p, isActive: true, selectionCount: 0 });
    expect(p.setPhase).toHaveBeenLastCalledWith('awaiting-entity');
    expect(p.onDeactivate).not.toHaveBeenCalled();
  });

  it('DEACTIVATE → onDeactivate()', () => {
    const p = base({ isActive: true, selectionCount: 1, phase: 'awaiting-base-point' });
    const { rerender } = renderHook((props: Props) => useModifyToolActivation(props), { initialProps: p });
    rerender({ ...p, isActive: false });
    expect(p.onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('selection APPEARED while awaiting-entity → advances to base phase', () => {
    const p = base({ isActive: true, selectionCount: 0, phase: 'awaiting-entity' });
    const { rerender } = renderHook((props: Props) => useModifyToolActivation(props), { initialProps: p });
    p.setPhase.mockClear();
    rerender({ ...p, isActive: true, selectionCount: 1, phase: 'awaiting-entity' });
    expect(p.setPhase).toHaveBeenCalledWith('awaiting-base-point');
  });

  it('selection LOST while active → falls back to entity phase', () => {
    const p = base({ isActive: true, selectionCount: 2, phase: 'awaiting-base-point' });
    const { rerender } = renderHook((props: Props) => useModifyToolActivation(props), { initialProps: p });
    p.setPhase.mockClear();
    rerender({ ...p, isActive: true, selectionCount: 0, phase: 'awaiting-base-point' });
    expect(p.setPhase).toHaveBeenCalledWith('awaiting-entity');
  });

  it('does NOT advance from base phase when selection stays (no spurious transition)', () => {
    const p = base({ isActive: true, selectionCount: 1, phase: 'awaiting-base-point' });
    const { rerender } = renderHook((props: Props) => useModifyToolActivation(props), { initialProps: p });
    p.setPhase.mockClear();
    rerender({ ...p, isActive: true, selectionCount: 1, phase: 'awaiting-target-point' });
    expect(p.setPhase).not.toHaveBeenCalled();
  });

  it('onActivate override handling activation skips the default phase choice', () => {
    const onActivate = jest.fn().mockReturnValue(true); // "I handled it"
    const p = base({ onActivate });
    const { rerender } = renderHook((props: Props) => useModifyToolActivation(props), { initialProps: p });
    rerender({ ...p, isActive: true, selectionCount: 2, onActivate });
    expect(onActivate).toHaveBeenCalledWith(true);
    expect(p.setPhase).not.toHaveBeenCalled(); // default suppressed
  });

  it('onActivate returning falsy falls back to the default phase choice', () => {
    const onActivate = jest.fn().mockReturnValue(false);
    const p = base({ onActivate });
    const { rerender } = renderHook((props: Props) => useModifyToolActivation(props), { initialProps: p });
    rerender({ ...p, isActive: true, selectionCount: 0, onActivate });
    expect(onActivate).toHaveBeenCalledWith(false);
    expect(p.setPhase).toHaveBeenLastCalledWith('awaiting-entity');
  });
});
