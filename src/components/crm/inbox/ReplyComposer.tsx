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
import { Send, AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

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
}: ReplyComposerProps) {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [text, setText] = useState('');

  // Focus textarea when not disabled
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  // Clear error when user starts typing
  useEffect(() => {
    if (text && error) {
      onClearError();
    }
  }, [text, error, onClearError]);

  // Handle send
  const handleSend = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || sending || disabled) return;

    const success = await onSend(trimmedText);
    if (success) {
      setText('');
      // Focus back to textarea after successful send
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [text, sending, disabled, onSend]);

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
    setText(e.target.value);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 150); // Max 150px
    textarea.style.height = `${newHeight}px`;
  }, []);

  const isDisabled = disabled || sending;
  const canSend = text.trim().length > 0 && !isDisabled;

  return (
    <footer className={`border-t p-4 ${colors.bg.primary}`} role="form" aria-label="Reply composer">
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
          className="flex-shrink-0"
          aria-label={sending ? t('inbox.composer.sending') : t('inbox.composer.send')}
        >
          {sending ? (
            <Spinner size="small" />
          ) : (
            <Send className={iconSizes.sm} />
          )}
          <span className="ml-2 hidden sm:inline">
            {sending ? t('inbox.composer.sending') : t('inbox.composer.send')}
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
