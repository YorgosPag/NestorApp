/**
 * Shared `getPanelVisibility` resolver for the MEP equipment bridges whose folded
 * "network"/"circuits" panel surfaces iff the selected equipment sources ≥1 managed
 * system (`electrical-panel` / `mep-manifold` / `mep-water-heater` / `mep-underfloor`,
 * ADR-408, N.18).
 *
 * Every one of those bridges copy-pasted the identical
 * `useMepSystemStore.getState().getSystems()` → `resolveManagedSystems([entity], …)`
 * visibility check; this owns it once. Keys outside the bridge's visibility set →
 * `true` (no-op) so it composes in `useRibbonCommands` without collisions.
 */
import { useCallback } from 'react';

import type { Entity } from '../../../types/entities';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { resolveManagedSystems } from '../../../bim/mep-systems/mep-circuit-editor';

/**
 * @param resolve            resolves the primary-selected equipment entity (or null)
 * @param isVisibilityKey    guards the bridge's owned visibility keys
 * @param networkKey         the single "has managed network/circuits" visibility key
 */
export function useManagedNetworkVisibility<T extends Entity>(
  resolve: () => T | null,
  isVisibilityKey: (visibilityKey: string) => boolean,
  networkKey: string,
): (visibilityKey: string) => boolean {
  return useCallback(
    (visibilityKey: string): boolean => {
      if (!isVisibilityKey(visibilityKey)) return true;
      const entity = resolve();
      if (!entity) return false;
      if (visibilityKey === networkKey) {
        const systems = useMepSystemStore.getState().getSystems();
        return resolveManagedSystems([entity], systems).length > 0;
      }
      return false;
    },
    [resolve, isVisibilityKey, networkKey],
  );
}
