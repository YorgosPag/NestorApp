/**
 * useActiveGroup — React subscriptions to {@link ActiveGroupStore} (ADR-575).
 *
 * Micro-leaf hooks: a component that reads the drill-in state re-renders ONLY when
 * it changes, never dragging the CanvasSection orchestrator with it (ADR-040).
 */

'use client';

import { useSyncExternalStore } from 'react';
import {
  subscribeActiveGroup,
  getActiveGroupId,
  getActiveGroupStack,
} from './ActiveGroupStore';

/** The currently-active (innermost) GROUP container id, or `null` at the top level. */
export function useActiveGroupId(): string | null {
  return useSyncExternalStore(subscribeActiveGroup, getActiveGroupId, getActiveGroupId);
}

/** The full drill-in stack (outermost first). Stable reference until it mutates. */
export function useActiveGroupStack(): readonly string[] {
  return useSyncExternalStore(subscribeActiveGroup, getActiveGroupStack, getActiveGroupStack);
}
