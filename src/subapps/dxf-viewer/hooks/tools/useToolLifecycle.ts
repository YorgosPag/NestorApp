import { useEffect } from 'react';

/**
 * ADR-363 — generic tool lifecycle effect. Replaces the repeated
 * `useEffect(() => isActive ? activate() : deactivate(), [...])` block
 * across `useSpecialTools` (wall/opening/slab/column/beam/stair).
 */
export function useToolLifecycle(
  isActive: boolean,
  activate: () => void,
  deactivate: () => void,
): void {
  useEffect(() => {
    if (isActive) activate();
    else deactivate();
  }, [isActive, activate, deactivate]);
}
