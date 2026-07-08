/**
 * useSaveHandlerRef — register a tab's save handler with a parent-owned ref
 *
 * SSoT for the "inline-editing tab exposes its save() to the header button via
 * an onSaveRef" pattern used by the entity general tabs (Parking, Storage,
 * Building). Keeps the ref pointed at the latest handler and clears it on
 * unmount.
 *
 * @module hooks/useSaveHandlerRef
 */

'use client';

import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

/** Save handler shape: resolves `true` on success, `false` on failure. */
export type SaveHandler = () => Promise<boolean>;

/**
 * Point `onSaveRef` at `handleSave` while mounted; clear it on unmount.
 * No-op when `onSaveRef` is undefined (create/standalone contexts).
 */
export function useSaveHandlerRef(
  onSaveRef: MutableRefObject<SaveHandler | null> | undefined,
  handleSave: SaveHandler,
): void {
  useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = handleSave;
    }
    return () => {
      if (onSaveRef) {
        onSaveRef.current = null;
      }
    };
  }, [handleSave, onSaveRef]);
}
