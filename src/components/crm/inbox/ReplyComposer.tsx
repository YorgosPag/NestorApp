'use client';

/**
 * =============================================================================
 * REPLY COMPOSER - EPIC Δ
 * =============================================================================
 *
 * Message composition and sending component.
 * Enterprise-grade with optimistic UX and error handling.
 *
 * @module components/crm/inbox/ReplyComposer
 * @enterprise ADR-030 - Zero Hardcoded Values
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { Send, AlertCircle, X, Reply, Forward, Pencil, Check } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { QuotedMessage, ReplyMode } from '@/hooks/inbox/useMessageReply';
import type { EditingMessage } from '@/hooks/inbox/useMessageEdit';

// ============================================================================
// TYPES
// ============================================================================

interface ReplyComposerProps {
  /** Whether a conversation is selected */
  disabled?: boolean;
  /** Sending state */
  sending: boolean;
  /** Error message */
  error: string | null;
  /** Send callback */
  onSend: (text: string) => Promise<boolean>;
  /** Clear error callback */
  onClearError: () => void;
  /** Reply mode (none, reply, forward) */
  replyMode?: ReplyMode;
  /** Quoted message for reply/forward */
  quotedMessage?: QuotedMessage | null;
  /** Cancel reply/forward callback */
  onCancelReply?: () => void;
  /** Message being edited (for edit mode) */
  editingMessage?: EditingMessage | null;
  /** Update edit text callback */
  onUpdateEditText?: (text: string) => void;
  /** Cancel edit callback */
  onCancelEdit?: () => void;
  /** Save edit callback (accepts optional text override) */
  onSaveEdit?: (textOverride?: string) => Promise<{ success: boolean; error?: string }>;
  /** Edit saving state */
  isSavingEdit?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ReplyComposer({
  disabled = false,
  sending,
  error,
  onSend,
  onClearError,
  replyMode = 'none',
  quotedMessage,
  onCancelReply,
  editingMessage,
  onUpdateEditText,
  onCancelEdit,
  onSaveEdit,
  isSavingEdit = false,
}: ReplyComposerProps) {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 🏢 ENTERPRISE: Edit mode check
  const isEditMode = !!editingMessage;

  const [text, setText] = useState('');

  // Focus textarea when not disabled
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  // 🏢 ENTERPRISE: Sync text with editingMessage when entering edit mode
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.currentText);
      // Focus and select all text for easy editing
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }
  }, [editingMessage?.id]); // Only when starting edit (id changes)

  // Clear error when user starts typing
  useEffect(() => {
    if (text && error) {
      onClearError();
    }
  }, [text, error, onClearError]);

  // Handle send or save (depending on mode)
  const handleSend = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || sending || disabled || isSavingEdit) return;

    // 🏢 ENTERPRISE: Edit mode - save edit
    if (isEditMode && onSaveEdit) {
      // Pass text directly to avoid race condition with state update
      const result = await onSaveEdit(trimmedText);
      if (result.success) {
        setText('');
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
      return;
    }

    // Normal send mode
    const success = await onSend(trimmedText);
    if (success) {
      setText('');
      // Focus back to textarea after successful send
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [text, sending, disabled, isSavingEdit, isEditMode, onSaveEdit, onUpdateEditText, onSend]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter or Cmd+Enter to send
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    // 🏢 ENTERPRISE: Update hook state in edit mode
    if (isEditMode && onUpdateEditText) {
      onUpdateEditText(newText);
    }

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 150); // Max 150px
    textarea.style.height = `${newHeight}px`;
  }, [isEditMode, onUpdateEditText]);

  const isDisabled = disabled || sending || isSavingEdit;
  const canSend = text.trim().length > 0 && !isDisabled;

  return (
    <footer className={`border-t p-4 ${colors.bg.primary}`} role="form" aria-label="Reply composer">
      {/* 🏢 ENTERPRISE: Edit mode banner */}
      {isEditMode && editingMessage && (
        <div className="flex items-start gap-2 mb-3 p-3 rounded-lg border-l-4 border-l-amber-500 bg-amber-500/5">
          <div className="flex-shrink-0 mt-0.5">
            <Pencil className={`${iconSizes.sm} text-amber-500`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-medium ${colors.text.muted} mb-1`}>
              {t('inbox.composer.editing', 'Επεξεργασία μηνύματος')}
            </div>
            <p className={`text-sm ${colors.text.secondary} line-clamp-2`}>
              {editingMessage.originalText}
            </p>
          </div>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className={`flex-shrink-0 p-1 rounded hover:bg-muted/50 ${colors.text.muted}`}
              aria-label={t('inbox.composer.cancelEdit', 'Ακύρωση επεξεργασίας')}
            >
              <X className={iconSizes.sm} />
            </button>
          )}
        </div>
      )}

      {/* 🏢 ENTERPRISE: Quoted message display for Reply/Forward */}
      {!isEditMode && quotedMessage && replyMode !== 'none' && (
        <div className={`flex items-start gap-2 mb-3 p-3 rounded-lg border-l-4 ${
          replyMode === 'reply'
            ? 'border-l-primary bg-primary/5'
            : 'border-l-blue-500 bg-blue-500/5'
        }`}>
          <div className="flex-shrink-0 mt-0.5">
            {replyMode === 'reply' ? (
              <Reply className={`${iconSizes.sm} text-primary`} />
            ) : (
              <Forward className={`${iconSizes.sm} text-blue-500`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-medium ${colors.text.muted} mb-1`}>
              {replyMode === 'reply'
                ? t('inbox.composer.replyingTo', 'Απάντηση σε')
                : t('inbox.composer.forwarding', 'Προώθηση')}
              {' '}
              <span className={colors.text.primary}>{quotedMessage.senderName}</span>
            </div>
            <p className={`text-sm ${colors.text.secondary} line-clamp-2`}>
              {quotedMessage.text}
            </p>
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className={`flex-shrink-0 p-1 rounded hover:bg-muted/50 ${colors.text.muted}`}
              aria-label={t('inbox.composer.cancelReply', 'Ακύρωση')}
            >
              <X className={iconSizes.sm} />
            </button>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div
          className={`flex items-center gap-2 mb-3 p-2 rounded ${colors.bg.errorSubtle} ${colors.text.error}`}
          role="alert"
        >
          <AlertCircle className={iconSizes.sm} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? t('inbox.thread.selectConversation') : t('inbox.composer.placeholder')}
            disabled={isDisabled}
            rows={1}
            className={`
              w-full resize-none rounded-lg border px-4 py-3
              ${TRANSITION_PRESETS.STANDARD_ALL}
              ${colors.bg.primary}
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
              focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
            `}
            style={{ minHeight: '44px', maxHeight: '150px' }}
            aria-label={t('inbox.composer.placeholder')}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={!canSend}
          className={`flex-shrink-0 ${isEditMode ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
          aria-label={
            isEditMode
              ? (isSavingEdit ? t('inbox.composer.saving', 'Αποθήκευση...') : t('inbox.composer.save', 'Αποθήκευση'))
              : (sending ? t('inbox.composer.sending') : t('inbox.composer.send'))
          }
        >
          {(sending || isSavingEdit) ? (
            <Spinner size="small" />
          ) : isEditMode ? (
            <Check className={iconSizes.sm} />
          ) : (
            <Send className={iconSizes.sm} />
          )}
          <span className="ml-2 hidden sm:inline">
            {isEditMode
              ? (isSavingEdit ? t('inbox.composer.saving', 'Αποθήκευση...') : t('inbox.composer.save', 'Αποθήκευση'))
              : (sending ? t('inbox.composer.sending') : t('inbox.composer.send'))
            }
          </span>
        </Button>
      </div>

      {/* Keyboard shortcut hint */}
      {!disabled && (
        <p className={`text-xs ${colors.text.muted} mt-2`}>
          {t('inbox.composer.shortcutHint')}
        </p>
      )}
    </footer>
  );
}

export default ReplyComposer;
