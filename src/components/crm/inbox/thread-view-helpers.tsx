/**
 * Thread View helpers + message handler factory
 * Extracted from ThreadView for file-size compliance.
 */

import '@/lib/design-system';
import React, { useCallback } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDateTime } from '@/lib/intl-utils';
import { User, Bot, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { createModuleLogger } from '@/lib/telemetry';
import type { MessageListItem } from '@/hooks/inbox/useInboxApi';

const _logger = createModuleLogger('ThreadView');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getRelativeTime(
  timestamp: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  if (diffHours < 1) return t('inbox.time.now');
  if (diffHours < 24) return t('inbox.time.hoursAgo', { hours: Math.floor(diffHours) });
  if (diffHours < 48) return t('inbox.time.yesterday');
  return formatDateTime(date);
}

export function getSenderIcon(senderType: string, iconSizes: ReturnType<typeof useIconSizes>) {
  switch (senderType) {
    case 'bot': return <Bot className={iconSizes.sm} />;
    case 'agent':
    case 'customer':
    default: return <User className={iconSizes.sm} />;
  }
}

export function getStatusIcon(
  status: string,
  iconSizes: ReturnType<typeof useIconSizes>,
  colors: ReturnType<typeof useSemanticColors>
) {
  switch (status) {
    case 'sent':
    case 'delivered':
    case 'read':
      return <CheckCircle className={`${iconSizes.xs} ${colors.text.success}`} />;
    case 'failed':
      return <AlertCircle className={`${iconSizes.xs} ${colors.text.error}`} />;
    case 'pending':
    default:
      return <Clock className={`${iconSizes.xs} ${colors.text.muted}`} />;
  }
}

// ============================================================================
// MESSAGE HANDLER HOOKS
// ============================================================================

interface UseThreadMessageHandlersParams {
  messages: MessageListItem[];
  onReply?: (message: MessageListItem) => void;
  onForward?: (message: MessageListItem) => void;
  onEdit?: (message: MessageListItem) => void;
  onTogglePin?: (messageId: string, shouldPin: boolean) => Promise<void>;
  onToggleReaction?: (messageId: string, emoji: string) => Promise<void>;
  deleteMessages: (ids: string[]) => Promise<{ success: boolean; deleted: number }>;
  deleteSelected: () => Promise<{ success: boolean; deleted: number }>;
  selectedIds: Set<string>;
  exitSelectionMode: () => void;
  selectAll: (messages: MessageListItem[]) => void;
  onMessagesDeleted?: (deletedIds: string[]) => void;
  onRefresh: () => void;
}

export function useThreadMessageHandlers({
  messages, onReply, onForward, onEdit, onTogglePin, onToggleReaction,
  deleteMessages, deleteSelected, selectedIds, exitSelectionMode, selectAll,
  onMessagesDeleted, onRefresh,
}: UseThreadMessageHandlersParams) {

  const handleDeleteSingle = useCallback(async (messageId: string) => {
    const result = await deleteMessages([messageId]);
    if (result.success && result.deleted > 0) {
      onMessagesDeleted?.([messageId]);
      onRefresh();
    }
  }, [deleteMessages, onMessagesDeleted, onRefresh]);

  const handleDeleteSelected = useCallback(async () => {
    const deletedIds = Array.from(selectedIds);
    const result = await deleteSelected();
    if (result.success && result.deleted > 0) {
      onMessagesDeleted?.(deletedIds);
      exitSelectionMode();
      onRefresh();
    }
  }, [selectedIds, deleteSelected, onMessagesDeleted, exitSelectionMode, onRefresh]);

  const handleSelectAll = useCallback(() => { selectAll(messages); }, [selectAll, messages]);

  const handleReply = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && onReply) onReply(message);
  }, [messages, onReply]);

  const handleForward = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && onForward) onForward(message);
  }, [messages, onForward]);

  const handleEdit = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && onEdit) onEdit(message);
  }, [messages, onEdit]);

  const handleTogglePin = useCallback(async (messageId: string, shouldPin: boolean) => {
    if (onTogglePin) await onTogglePin(messageId, shouldPin);
  }, [onTogglePin]);

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (onToggleReaction) await onToggleReaction(messageId, emoji);
  }, [onToggleReaction]);

  return {
    handleDeleteSingle, handleDeleteSelected, handleSelectAll,
    handleReply, handleForward, handleEdit, handleTogglePin, handleReaction,
  };
}
