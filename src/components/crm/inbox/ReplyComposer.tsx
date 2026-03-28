'use client';
/* eslint-disable design-system/enforce-semantic-colors */

/**
 * =============================================================================
 * REPLY COMPOSER - EPIC Δ (ADR-055 Enhanced)
 * =============================================================================
 *
 * Message composition and sending component with attachment support.
 * Enterprise-grade with optimistic UX, error handling, and file uploads.
 *
 * @module components/crm/inbox/ReplyComposer
 * @enterprise ADR-030 - Zero Hardcoded Values
 * @enterprise ADR-055 - Enterprise Attachment System Consolidation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import {
  Send,
  AlertCircle,
  X,
  Reply,
  Forward,
  Pencil,
  Check,
  Paperclip,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { MessageAttachment } from '@/types/conversations';
import { ATTACHMENT_UPLOAD_STATUS } from '@/types/conversations';
import '@/lib/design-system';

import type { ReplyComposerProps } from './reply-composer-types';
import { ACCEPTED_FILE_TYPES, MAX_ATTACHMENTS, TEXTAREA_SIZE } from './reply-composer-types';
import { useReplyComposerAttachments } from './useReplyComposerAttachments';
import { ReplyComposerAttachmentBar } from './ReplyComposerAttachmentBar';

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
  onUploadAttachment,
}: ReplyComposerProps) {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEditMode = !!editingMessage;
  const [text, setText] = useState('');

  const {
    attachments,
    setAttachments,
    isUploadingAttachment,
    fileInputRef,
    handleFileSelect,
    handleRemoveAttachment,
    handleClearAttachments,
    handleAttachmentClick,
  } = useReplyComposerAttachments({ onUploadAttachment });

  // Focus textarea when not disabled
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  // Sync text with editingMessage when entering edit mode
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.currentText);
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }
  }, [editingMessage?.id, setAttachments]);

  // Clear error when user starts typing
  useEffect(() => {
    if (text && error) {
      onClearError();
    }
  }, [text, error, onClearError]);

  // =========================================================================
  // SEND HANDLERS
  // =========================================================================

  const handleSend = useCallback(async () => {
    const trimmedText = text.trim();
    const hasContent = trimmedText.length > 0 || attachments.length > 0;
    if (!hasContent || sending || disabled || isSavingEdit || isUploadingAttachment) return;

    const hasUploadingAttachments = attachments.some((a) => a.status === 'uploading');
    if (hasUploadingAttachments) return;

    // Edit mode - save edit (no attachments in edit mode)
    if (isEditMode && onSaveEdit) {
      const result = await onSaveEdit(trimmedText);
      if (result.success) {
        setText('');
        textareaRef.current?.focus();
      }
      return;
    }

    // Build attachments array for send (ADR-055)
    const completedAttachments: MessageAttachment[] = attachments
      .filter((a) => a.status === 'completed' && a.uploadedUrl)
      .map((a) => ({
        type: a.type,
        url: a.uploadedUrl!,
        filename: a.file.name,
        mimeType: a.file.type,
        size: a.file.size,
        uploadStatus: ATTACHMENT_UPLOAD_STATUS.COMPLETED,
      }));

    const success = await onSend(
      trimmedText,
      completedAttachments.length > 0 ? completedAttachments : undefined
    );

    if (success) {
      setText('');
      handleClearAttachments();
      textareaRef.current?.focus();
    }
  }, [
    text, attachments, sending, disabled, isSavingEdit,
    isUploadingAttachment, isEditMode, onSaveEdit, onSend,
    handleClearAttachments,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);

      if (isEditMode && onUpdateEditText) {
        onUpdateEditText(newText);
      }

      // Auto-resize
      const textarea = e.target;
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, TEXTAREA_SIZE.maxHeight);
      textarea.style.height = `${newHeight}px`;
    },
    [isEditMode, onUpdateEditText]
  );

  // =========================================================================
  // COMPUTED STATE
  // =========================================================================

  const isDisabled = disabled || sending || isSavingEdit;
  const hasContent = text.trim().length > 0 || attachments.length > 0;
  const hasUploadingAttachments = attachments.some((a) => a.status === 'uploading');
  const canSend = hasContent && !isDisabled && !hasUploadingAttachments;
  const showAttachmentButton = !isEditMode && !!onUploadAttachment;

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <footer
      className={`border-t p-4 ${colors.bg.primary}`}
      role="form"
      aria-label="Reply composer"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={isDisabled}
      />

      {/* Edit mode banner */}
      {isEditMode && editingMessage && (
        <div className="flex items-start gap-2 mb-3 p-3 rounded-lg border-l-4 border-l-amber-500 bg-amber-500/5">
          <div className="flex-shrink-0 mt-0.5">
            <Pencil className={`${iconSizes.sm} text-amber-500`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-medium ${colors.text.muted} mb-1`}>
              {t('inbox.composer.editing')}
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
              aria-label={t('inbox.composer.cancelEdit')}
            >
              <X className={iconSizes.sm} />
            </button>
          )}
        </div>
      )}

      {/* Quoted message display for Reply/Forward */}
      {!isEditMode && quotedMessage && replyMode !== 'none' && (
        <div
          className={`flex items-start gap-2 mb-3 p-3 rounded-lg border-l-4 ${
            replyMode === 'reply'
              ? 'border-l-primary bg-primary/5'
              : 'border-l-blue-500 bg-blue-500/5'
          }`}
        >
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
                ? t('inbox.composer.replyingTo')
                : t('inbox.composer.forwarding')}{' '}
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
              aria-label={t('inbox.composer.cancelReply')}
            >
              <X className={iconSizes.sm} />
            </button>
          )}
        </div>
      )}

      {/* Attachment Preview Bar (ADR-055) */}
      <ReplyComposerAttachmentBar
        attachments={attachments}
        onRemoveAttachment={handleRemoveAttachment}
        onClearAll={handleClearAttachments}
      />

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
        {/* Attachment Button (ADR-055) */}
        {showAttachmentButton && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAttachmentClick}
            disabled={isDisabled || attachments.length >= MAX_ATTACHMENTS}
            className="flex-shrink-0"
            aria-label={t('inbox.attachments.add')}
          >
            <Paperclip className={iconSizes.sm} />
          </Button>
        )}

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            size="sm"
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? t('inbox.thread.selectConversation')
                : t('inbox.composer.placeholder')
            }
            disabled={isDisabled}
            rows={1}
            className={cn(
              'resize-none rounded-lg min-h-[44px] max-h-[150px]',
              TRANSITION_PRESETS.STANDARD_ALL,
              isDisabled && 'opacity-50'
            )}
            aria-label={t('inbox.composer.placeholder')}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={!canSend}
          className={`flex-shrink-0 ${isEditMode ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
          aria-label={
            isEditMode
              ? isSavingEdit
                ? t('inbox.composer.saving')
                : t('inbox.composer.save')
              : sending
              ? t('inbox.composer.sending')
              : t('inbox.composer.send')
          }
        >
          {sending || isSavingEdit ? (
            <Spinner size="small" />
          ) : isEditMode ? (
            <Check className={iconSizes.sm} />
          ) : (
            <Send className={iconSizes.sm} />
          )}
          <span className="ml-2 hidden sm:inline">
            {isEditMode
              ? isSavingEdit
                ? t('inbox.composer.saving')
                : t('inbox.composer.save')
              : sending
              ? t('inbox.composer.sending')
              : t('inbox.composer.send')}
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
