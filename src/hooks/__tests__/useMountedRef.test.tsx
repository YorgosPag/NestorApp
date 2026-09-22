/**
 * @file ADR-598 «(η)» — `useMountedRef`: `true` όσο ζει το component, `false` μετά το unmount.
 */

import { renderHook } from '@testing-library/react';

import { useMountedRef } from '../useMountedRef';

describe('useMountedRef', () => {
  it('Ζ1: true όσο είναι mounted, false μετά το unmount (ίδιο ref)', () => {
    const { result, unmount } = renderHook(() => useMountedRef());
    const ref = result.current;
    expect(ref.current).toBe(true);
    unmount();
    expect(ref.current).toBe(false);
  });
});
