'use client';

/**
 * ADR-344 Phase 11 — React hook layer for `ViewportStore`.
 *
 * Provides `useSyncExternalStore`-based hooks for leaf components that need
 * reactive viewport scale state. Orchestrator components MUST NOT use these
 * hooks (ADR-040 cardinal rule #1) — read via `getActiveScaleName()` at event
 * time instead.
 *
 * Despite the historical name "ViewportContext", there is NO React Context
 * here — the underlying store is a global singleton. The name is preserved
 * from ADR-344 §Q11 for documentation continuity.
 */

import { useEffect, useSyncExternalStore } from 'react';
import type { AnnotationScale } from '../../text-engine/types';
import {
  getActiveScaleName,
  getScaleList,
  subscribeActiveScale,
  subscribeScaleList,
} from './ViewportStore';

/** Leaf subscriber: re-renders only when active scale NAME changes. */
export function useActiveScale(): string {
  return useSyncExternalStore(subscribeActiveScale, getActiveScaleName, getActiveScaleName);
}

/** Leaf subscriber: re-renders only when the scale LIST changes. */
export function useScaleList(): readonly AnnotationScale[] {
  return useSyncExternalStore(subscribeScaleList, getScaleList, getScaleList);
}

/**
 * Derive the active scale factor (modelHeight / paperHeight). Falls back to
 * `1.0` if the active name is not in the current list. Always re-evaluates
 * on either active-name change or list change.
 */
export function useActiveScaleFactor(): number {
  const name = useActiveScale();
  const list = useScaleList();
  const entry = list.find((s) => s.name === name);
  if (!entry || entry.paperHeight === 0) return 1;
  return entry.modelHeight / entry.paperHeight;
}

/**
 * Side-effect hook: subscribes to `subscribeActiveScale` and invokes the
 * provided callback on every change. Used by canvas redraw subscribers to
 * trigger a render request without participating in React render output.
 *
 * Per ADR-040, the *subscriber* lives at leaf level (e.g. a dedicated
 * `<ViewportRedrawSubscriber>` mounted by CanvasLayerStack) — never at
 * orchestrator level.
 */
export function useViewportSceneRedraw(onChange: () => void): void {
  useEffect(() => {
    const unsubscribe = subscribeActiveScale(onChange);
    return () => { unsubscribe(); };
  }, [onChange]);
}
