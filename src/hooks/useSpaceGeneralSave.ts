'use client';

/**
 * useSpaceGeneralSave — the save handler of a space entity's general tab
 *
 * SSoT for the create-or-update dispatch every space general tab performs when
 * the header's save button fires: route to POST or PATCH depending on
 * `createMode`, turn a thrown error into a `false` result (the header renders
 * the failure), and register the handler on the parent-owned ref.
 *
 * The caller passes its own module logger, so the failure is reported under the
 * tab's own module name rather than this hook's.
 *
 * @module hooks/useSpaceGeneralSave
 * @see ADR-588 §General tab — space tab de-duplication (Phase 2)
 */

import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { Logger } from '@/lib/telemetry';
import { useSaveHandlerRef, type SaveHandler } from '@/hooks/useSaveHandlerRef';

// ============================================================================
// TYPES
// ============================================================================

interface UseSpaceGeneralSaveConfig {
  /** Create mode: POST a new entity instead of PATCHing the existing one. */
  createMode: boolean;
  onCreate: SaveHandler;
  onUpdate: SaveHandler;
  /** Parent-owned ref the header's save button calls through. */
  onSaveRef?: MutableRefObject<SaveHandler | null>;
  /** The owning tab's module logger. */
  logger: Logger;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSpaceGeneralSave({
  createMode,
  onCreate,
  onUpdate,
  onSaveRef,
  logger,
}: UseSpaceGeneralSaveConfig): void {
  const handleSave = useCallback<SaveHandler>(async () => {
    try {
      return createMode ? await onCreate() : await onUpdate();
    } catch (err) {
      logger.error('Failed to save', {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }, [createMode, onCreate, onUpdate, logger]);

  // Register save ref for header delegation (SSoT hook)
  useSaveHandlerRef(onSaveRef, handleSave);
}
