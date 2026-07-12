/**
 * useActiveBlockEdit — React subscriptions to {@link ActiveBlockEditStore} (ADR-641).
 *
 * Micro-leaf hooks: a component that reads the Block-Editor session state re-renders ONLY when it
 * changes, never dragging the CanvasSection orchestrator with it (ADR-040). Mirror of
 * {@link useActiveGroup}.
 */

'use client';

import { useSyncExternalStore } from 'react';
import {
  subscribeBlockEdit,
  getActiveBlockEditId,
  getActiveBlockEditName,
} from './ActiveBlockEditStore';

/** The currently-entered block's container id, or `null` at the top scene level. */
export function useActiveBlockEditId(): string | null {
  return useSyncExternalStore(subscribeBlockEdit, getActiveBlockEditId, getActiveBlockEditId);
}

/** The currently-entered block's name (for the breadcrumb), or `null` at the top level. */
export function useActiveBlockEditName(): string | null {
  return useSyncExternalStore(subscribeBlockEdit, getActiveBlockEditName, getActiveBlockEditName);
}
