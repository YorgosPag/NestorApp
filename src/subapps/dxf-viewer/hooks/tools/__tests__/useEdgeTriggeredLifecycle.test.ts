/**
 * ADR-589 — edge-triggered tool lifecycle SSoT.
 *
 * Characterization of the transition-only contract that the 13 modify-tool
 * hooks depend on: callbacks fire ONLY on the boolean edges of `isActive`,
 * never on same-value re-renders, never on mount when starting inactive.
 */
import { renderHook } from '@testing-library/react';
import { useEdgeTriggeredLifecycle } from '../useEdgeTriggeredLifecycle';

interface Props {
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}

function setup(initialActive: boolean) {
  const onActivate = jest.fn();
  const onDeactivate = jest.fn();
  const { rerender } = renderHook(
    (p: Props) => useEdgeTriggeredLifecycle(p.isActive, p.onActivate, p.onDeactivate),
    { initialProps: { isActive: initialActive, onActivate, onDeactivate } },
  );
  const set = (isActive: boolean) => rerender({ isActive, onActivate, onDeactivate });
  return { onActivate, onDeactivate, set };
}

describe('useEdgeTriggeredLifecycle', () => {
  it('does NOT fire on mount when starting inactive', () => {
    const { onActivate, onDeactivate } = setup(false);
    expect(onActivate).not.toHaveBeenCalled();
    expect(onDeactivate).not.toHaveBeenCalled();
  });

  it('fires onActivate exactly once on false → true', () => {
    const { onActivate, onDeactivate, set } = setup(false);
    set(true);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onDeactivate).not.toHaveBeenCalled();
  });

  it('fires onDeactivate exactly once on true → false', () => {
    const { onActivate, onDeactivate, set } = setup(false);
    set(true);
    set(false);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire on same-value re-render (true → true)', () => {
    const { onActivate, onDeactivate, set } = setup(false);
    set(true);
    set(true);
    set(true);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onDeactivate).not.toHaveBeenCalled();
  });

  it('does NOT fire on same-value re-render (false → false)', () => {
    const { onActivate, onDeactivate, set } = setup(false);
    set(false);
    set(false);
    expect(onActivate).not.toHaveBeenCalled();
    expect(onDeactivate).not.toHaveBeenCalled();
  });

  it('fires each edge of a full activate → deactivate → reactivate cycle', () => {
    const { onActivate, onDeactivate, set } = setup(false);
    set(true);   // activate
    set(false);  // deactivate
    set(true);   // reactivate
    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('reads the latest callback closure at the transition render', () => {
    const firstActivate = jest.fn();
    const secondActivate = jest.fn();
    const onDeactivate = jest.fn();
    const { rerender } = renderHook(
      (p: Props) => useEdgeTriggeredLifecycle(p.isActive, p.onActivate, p.onDeactivate),
      { initialProps: { isActive: false, onActivate: firstActivate, onDeactivate } },
    );
    // Swap the activate callback while still inactive (no fire), then flip active.
    rerender({ isActive: false, onActivate: secondActivate, onDeactivate });
    rerender({ isActive: true, onActivate: secondActivate, onDeactivate });
    expect(firstActivate).not.toHaveBeenCalled();
    expect(secondActivate).toHaveBeenCalledTimes(1);
  });
});
