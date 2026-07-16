/**
 * @module hooks/state/useGuideState
 * @description React hook bridging GuideStore to the component tree.
 *
 * Uses `useSyncExternalStore` for tear-free subscription to the GuideStore
 * singleton. Mutations are wrapped in Commands (undo/redo) and fire EventBus
 * events so the rest of the system stays in sync.
 *
 * ADR-040 (2026-07-16): mutation callbacks are shared with `useGuideActions.ts`
 * via `useGuideMutations()` — this file owns ONLY the reactive `useSyncExternalStore`
 * subscriptions below. See useGuideMutations.ts for the shared command dispatchers.
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-02-19
 */

import { useSyncExternalStore } from 'react';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { useGuideMutations, type UseGuideMutationsReturn } from './useGuideMutations';
import type { Guide } from '../../systems/guides/guide-types';

// ============================================================================
// HOOK
// ============================================================================

export interface UseGuideStateReturn extends UseGuideMutationsReturn {
  /** All current guides (readonly snapshot) */
  guides: readonly Guide[];
  /** Whether guides are globally visible */
  guidesVisible: boolean;
  /** Whether snap-to-guide is enabled */
  snapEnabled: boolean;
  /** Total guide count */
  guideCount: number;
}

/**
 * React hook for the Construction Guide system.
 *
 * B20: All mutations route through `getGlobalCommandHistory()` so every guide
 * operation automatically enters the undo/redo stack. Ctrl+Z / Ctrl+Y is
 * handled by `useCommandHistoryKeyboard()` in CanvasSection.
 *
 * Usage:
 * ```tsx
 * const { guides, addGuide, removeGuide } = useGuideState();
 *
 * // Add a vertical guide at X=100 (automatically undoable via Ctrl+Z)
 * addGuide('X', 100);
 * ```
 */
export function useGuideState(): UseGuideStateReturn {
  const store = getGlobalGuideStore();
  const history = getGlobalCommandHistory();

  // Subscribe to store changes via useSyncExternalStore
  const guides = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.getGuides(),
    () => store.getGuides(), // server snapshot
  );

  const guidesVisible = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.isVisible(),
    () => store.isVisible(),
  );

  const snapEnabled = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.isSnapEnabled(),
    () => store.isSnapEnabled(),
  );

  const guideCount = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.count,
    () => store.count,
  );

  const mutations = useGuideMutations(store, history);

  return {
    guides,
    guidesVisible,
    snapEnabled,
    guideCount,
    ...mutations,
  };
}

// useGuideActions() lives in useGuideActions.ts (mutations-only, no subscriptions).
// Import directly from that file for orchestrators that must not re-render on guide drag.
