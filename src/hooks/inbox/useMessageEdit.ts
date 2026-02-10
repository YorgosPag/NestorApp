'use client';

/**
 * =============================================================================
 * MESSAGE EDIT HOOK - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * Centralized hook for message editing functionality.
 * Designed for reuse across all communication channels.
 *
 * @module hooks/inbox/useMessageEdit
 * @enterprise Omnichannel Communications
 * @reusable Works with Telegram, Email, WhatsApp, SMS, etc.
 */

import { useState, useCallback } from 'react';
import type { MessageListItem } from './useInboxApi';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useMessageEdit');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Message being edited
 */
export interface EditingMessage {
  id: string;
  originalText: string;
  currentText: string;
}

/**
 * Hook return type
 */
export interface UseMessageEditReturn {
  /** Message currently being edited */
  editingMessage: EditingMessage | null;
  /** Whether edit mode is active */
  isEditing: boolean;
  /** Start editing a message */
  startEdit: (message: MessageListItem) => void;
  /** Update the edited text */
  updateEditText: (text: string) => void;
  /** Cancel editing */
  cancelEdit: () => void;
  /** Save edit (calls API). Optional textOverride for immediate save without state update delay. */
  saveEdit: (textOverride?: string) => Promise<{ success: boolean; error?: string }>;
  /** Loading state */
  isSaving: boolean;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized message edit hook
 *
 * Manages message editing state and API calls.
 * Works across all communication channels.
 *
 * @example
 * ```tsx
 * const {
 *   editingMessage,
 *   isEditing,
 *   startEdit,
 *   updateEditText,
 *   cancelEdit,
 *   saveEdit,
 *   isSaving,
 * } = useMessageEdit();
 *
 * // Start editing
 * startEdit(message);
 *
 * // Update text
 * updateEditText("New text");
 *
 * // Save
 * const result = await saveEdit();
 * ```
 */
export function useMessageEdit(): UseMessageEditReturn {
  const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Start editing a message
  const startEdit = useCallback((message: MessageListItem) => {
    setEditingMessage({
      id: message.id,
      originalText: message.content.text || '',
      currentText: message.content.text || '',
    });
  }, []);

  // Update the edited text
  const updateEditText = useCallback((text: string) => {
    setEditingMessage(prev => prev ? { ...prev, currentText: text } : null);
  }, []);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  // Save edit via API
  // textOverride allows immediate save without waiting for state update
  const saveEdit = useCallback(async (textOverride?: string): Promise<{ success: boolean; error?: string }> => {
    if (!editingMessage) {
      return { success: false, error: 'No message being edited' };
    }

    const textToSave = textOverride ?? editingMessage.currentText;

    // Don't save if text hasn't changed
    if (textToSave === editingMessage.originalText) {
      setEditingMessage(null);
      return { success: true };
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/messages/edit', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: editingMessage.id,
          newText: textToSave,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to edit message' };
      }

      setEditingMessage(null);
      return { success: true };
    } catch (error) {
      logger.error('Save error', { error });
      return { success: false, error: 'Network error' };
    } finally {
      setIsSaving(false);
    }
  }, [editingMessage]);

  return {
    editingMessage,
    isEditing: editingMessage !== null,
    startEdit,
    updateEditText,
    cancelEdit,
    saveEdit,
    isSaving,
  };
}

export default useMessageEdit;
