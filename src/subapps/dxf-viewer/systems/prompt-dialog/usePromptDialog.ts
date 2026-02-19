/**
 * @module systems/prompt-dialog/usePromptDialog
 * @description React hook providing a `prompt()` function to show a modal input dialog.
 *
 * Returns both the prompt trigger function and the reactive snapshot
 * (for the component that actually renders the dialog overlay).
 *
 * Usage in any tool hook:
 * ```ts
 * const { prompt } = usePromptDialog();
 * const distance = await prompt({ title: '...', label: '...', inputType: 'number' });
 * ```
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-02-20
 */

'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  getPromptDialogStore,
  type PromptDialogOptions,
  type PromptDialogSnapshot,
} from './prompt-dialog-store';

// ============================================================================
// HOOK
// ============================================================================

export interface UsePromptDialogReturn {
  /** Show a prompt dialog and await the result (string or null if cancelled) */
  prompt: (options: PromptDialogOptions) => Promise<string | null>;
  /** Reactive snapshot — for the PromptDialog component only */
  snapshot: PromptDialogSnapshot;
  /** Confirm the dialog with a value */
  confirm: (value: string) => void;
  /** Cancel the dialog */
  cancel: () => void;
}

/**
 * Hook to interact with the centralized prompt dialog.
 *
 * - **Tool hooks** use only `prompt()` — fire and await.
 * - **PromptDialog component** uses `snapshot`, `confirm`, `cancel` for rendering.
 */
export function usePromptDialog(): UsePromptDialogReturn {
  const store = getPromptDialogStore();

  const snapshot = useSyncExternalStore(
    store.subscribe.bind(store),
    store.getSnapshot.bind(store),
    store.getSnapshot.bind(store), // SSR fallback
  );

  const prompt = useCallback(
    (options: PromptDialogOptions) => store.prompt(options),
    [store],
  );

  const confirm = useCallback(
    (value: string) => store.confirm(value),
    [store],
  );

  const cancel = useCallback(
    () => store.cancel(),
    [store],
  );

  return { prompt, snapshot, confirm, cancel };
}
