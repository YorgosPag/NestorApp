/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * After any architectural change → update the ADR changelog (same commit).
 *
 * @module hooks/state/useGuideActions
 * @description Mutations-only guide hook — NO useSyncExternalStore.
 *
 * Drop-in replacement for `useGuideState()` for orchestrator components
 * (e.g. CanvasSection) that must NOT re-render when guide positions change
 * at 60fps during drag. Leaf renderers (DxfCanvasSubscriber) subscribe to
 * the guide store directly instead.
 *
 * `guides` / `guidesVisible` / `snapEnabled` / `guideCount` are read
 * imperatively at render time — always current for event handlers, but
 * they do NOT trigger React re-renders on guide store notifications.
 *
 * ADR-040: micro-leaf subscriber pattern.
 * ADR-065: extracted to keep useGuideState.ts under 500-line limit.
 * ADR-040 (2026-07-16): mutation callbacks are shared with `useGuideState.ts`
 * via `useGuideMutations()` — that shared module has ZERO `useSyncExternalStore`
 * calls, so this file's "no subscriptions" invariant is preserved.
 *
 * @see useGuideState.ts — reactive version (use in leaf renderers)
 * @see useGuideMutations.ts — shared command dispatchers (no store reads)
 * @since 2026-05-10
 */

import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { useGuideMutations } from './useGuideMutations';
import type { UseGuideStateReturn } from './useGuideState';

export function useGuideActions(): UseGuideStateReturn {
  const store = getGlobalGuideStore();
  const history = getGlobalCommandHistory();

  // Imperative reads — NOT reactive. Correct for event-handler reads; leaf
  // renderers subscribe to the guide store directly for reactive rendering.
  const guides = store.getGuides();
  const guidesVisible = store.isVisible();
  const snapEnabled = store.isSnapEnabled();
  const guideCount = store.count;

  const mutations = useGuideMutations(store, history);

  return {
    guides,
    guidesVisible,
    snapEnabled,
    guideCount,
    ...mutations,
  };
}
