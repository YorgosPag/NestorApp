'use client';

/**
 * =============================================================================
 * MESSAGE ACTIONS HOOK - ENTERPRISE CENTRALIZED
 * =============================================================================
 *
 * Centralized hook for message selection and actions (delete, etc.).
 * Designed for reuse across all communication channels.
 *
 * @module hooks/inbox/useMessageActions
 * @enterprise Omnichannel Communications
 * @reusable Works with Telegram, Email, WhatsApp, SMS, etc.
 */

import { useState, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { MessageListItem } from './useInboxApi';

// ============================================================================
// TYPES
// ============================================================================

export interface MessageActionsState {
  /** Currently selected message IDs */
  selectedIds: Set<string>;
  /** Whether selection mode is active */
  isSelectionMode: boolean;
  /** Loading state for actions */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
}

export interface MessageActionsHandlers {
  /** Toggle selection of a single message */
  toggleSelect: (messageId: string) => void;
  /** Select all messages */
  selectAll: (messages: MessageListItem[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Enter selection mode */
  enterSelectionMode: () => void;
  /** Exit selection mode */
  exitSelectionMode: () => void;
  /** Delete selected messages */
  deleteSelected: () => Promise<DeleteResult>;
  /** Delete specific messages by ID */
  deleteMessages: (messageIds: string[]) => Promise<DeleteResult>;
  /** Check if a message is selected */
  isSelected: (messageId: string) => boolean;
}

export interface DeleteResult {
  success: boolean;
  deleted: number;
  failed: number;
  errors: Array<{ messageId: string; reason: string }>;
}

export interface UseMessageActionsResult extends MessageActionsState, MessageActionsHandlers {
  /** Number of selected messages */
  selectedCount: number;
  /** Array of selected message IDs */
  selectedArray: string[];
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized message actions hook
 *
 * Provides selection and action capabilities for messages.
 * Designed for omnichannel reuse.
 *
 * @param options - Hook configuration
 * @returns Message actions state and handlers
 *
 * @example
 * ```tsx
 * const {
 *   selectedIds,
 *   isSelectionMode,
 *   toggleSelect,
 *   deleteSelected,
 *   selectedCount,
 * } = useMessageActions();
 *
 * // On message click
 * if (isSelectionMode) {
 *   toggleSelect(message.id);
 * }
 *
 * // On delete button
 * const result = await deleteSelected();
 * if (result.success) {
 *   toast.success(`Deleted ${result.deleted} messages`);
 * }
 * ```
 */
export function useMessageActions(): UseMessageActionsResult {
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Action state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // SELECTION HANDLERS
  // ============================================================================

  const toggleSelect = useCallback((messageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((messages: MessageListItem[]) => {
    setSelectedIds(new Set(messages.map((m) => m.id)));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (messageId: string) => selectedIds.has(messageId),
    [selectedIds]
  );

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  const deleteMessages = useCallback(async (messageIds: string[]): Promise<DeleteResult> => {
    if (messageIds.length === 0) {
      return { success: true, deleted: 0, failed: 0, errors: [] };
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<{
        success: boolean;
        data: {
          deleted: number;
          failed: number;
          errors: Array<{ messageId: string; reason: string }>;
        };
      }>('/api/messages/delete', { messageIds });

      if (response.success && response.data) {
        // Remove deleted messages from selection
        setSelectedIds((prev) => {
          const next = new Set(prev);
          messageIds.forEach((id) => next.delete(id));
          return next;
        });

        return {
          success: true,
          deleted: response.data.deleted,
          failed: response.data.failed,
          errors: response.data.errors,
        };
      }

      throw new Error('Unexpected response format');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete messages';
      setError(errorMessage);
      return {
        success: false,
        deleted: 0,
        failed: messageIds.length,
        errors: [{ messageId: 'all', reason: errorMessage }],
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSelected = useCallback(async (): Promise<DeleteResult> => {
    return deleteMessages(Array.from(selectedIds));
  }, [selectedIds, deleteMessages]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const selectedCount = selectedIds.size;
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    selectedIds,
    isSelectionMode,
    isLoading,
    error,

    // Computed
    selectedCount,
    selectedArray,

    // Handlers
    toggleSelect,
    selectAll,
    clearSelection,
    enterSelectionMode,
    exitSelectionMode,
    deleteSelected,
    deleteMessages,
    isSelected,
  };
}

export default useMessageActions;
