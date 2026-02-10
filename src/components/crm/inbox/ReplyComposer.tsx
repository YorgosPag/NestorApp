'use client';

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
import { Button } from '@/components/ui/button';
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
  Image,
  FileText,
  Music,
  Video,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { QuotedMessage, ReplyMode } from '@/hooks/inbox/useMessageReply';
import type { EditingMessage } from '@/hooks/inbox/useMessageEdit';
import type {
  MessageAttachment,
  AttachmentUploadRequest,
  AttachmentType,
} from '@/types/conversations';
import {
  ATTACHMENT_TYPES,
  ATTACHMENT_UPLOAD_STATUS,
  detectAttachmentType,
} from '@/types/conversations';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum attachment size in bytes (10MB) */
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Maximum number of attachments per message */
const MAX_ATTACHMENTS = 5;

/** Accepted file types for attachments */
const ACCEPTED_FILE_TYPES = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,audio/*,video/*';

/** Composer textarea sizing — ADR-030 Zero Hardcoded Values */
const TEXTAREA_SIZE = {
  minHeight: 44,
  maxHeight: 150,
} as const;

// ============================================================================
// TYPES
// ============================================================================

/** Pending attachment in composer (not yet sent) */
interface PendingAttachment {
  /** Unique ID for React key */
  id: string;
  /** The file being uploaded */
  file: File;
  /** Detected attachment type */
  type: AttachmentType;
  /** Preview URL (for images) */
  previewUrl?: string;
  /** Upload progress (0-100) */
  progress: number;
  /** Upload status */
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Uploaded URL (when completed) */
  uploadedUrl?: string;
}

interface ReplyComposerProps {
  /** Whether a conversation is selected */
  disabled?: boolean;
  /** Sending state */
  sending: boolean;
  /** Error message */
  error: string | null;
  /** Send callback - now accepts optional attachments */
  onSend: (text: string, attachments?: MessageAttachment[]) => Promise<boolean>;
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
  /** 🏢 ENTERPRISE: Upload attachment callback (ADR-055) */
  onUploadAttachment?: (
    file: File,
    onProgress: (progress: number) => void
  ) => Promise<{ url: string; thumbnailUrl?: string } | null>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique ID for pending attachments
 */
function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get icon component for attachment type
 */
function getAttachmentIcon(
  type: AttachmentType,
  iconSizes: ReturnType<typeof useIconSizes>
): React.ReactNode {
  switch (type) {
    case ATTACHMENT_TYPES.IMAGE:
      return <Image className={iconSizes.sm} />;
    case ATTACHMENT_TYPES.AUDIO:
      return <Music className={iconSizes.sm} />;
    case ATTACHMENT_TYPES.VIDEO:
      return <Video className={iconSizes.sm} />;
    case ATTACHMENT_TYPES.DOCUMENT:
    default:
      return <FileText className={iconSizes.sm} />;
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  onUploadAttachment,
}: ReplyComposerProps) {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🏢 ENTERPRISE: Edit mode check
  const isEditMode = !!editingMessage;

  const [text, setText] = useState('');
  // 🏢 ENTERPRISE: Attachment state (ADR-055)
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

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
      // Clear attachments when entering edit mode
      setAttachments([]);
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

  // 🏢 ENTERPRISE: Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((att) => {
        if (att.previewUrl) {
          URL.revokeObjectURL(att.previewUrl);
        }
      });
    };
  }, [attachments]);

  // =========================================================================
  // ATTACHMENT HANDLERS (ADR-055)
  // =========================================================================

  /**
   * Handle file selection from input
   */
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      console.log('📎 [ReplyComposer] handleFileSelect called, files:', files?.length);

      if (!files || files.length === 0) {
        console.log('📎 [ReplyComposer] No files selected');
        return;
      }

      // 🐛 FIX: Copy files to array BEFORE resetting input (resetting clears FileList!)
      const filesArray = Array.from(files);
      console.log('📎 [ReplyComposer] Files array length:', filesArray.length);

      // Reset input to allow re-selecting same file (AFTER copying!)
      event.target.value = '';

      // Check max attachments limit
      if (attachments.length + filesArray.length > MAX_ATTACHMENTS) {
        console.warn(`📎 [ReplyComposer] Maximum ${MAX_ATTACHMENTS} attachments allowed`);
        return;
      }

      const newAttachments: PendingAttachment[] = [];

      for (const file of filesArray) {
        console.log('📎 [ReplyComposer] Processing file:', file.name, 'size:', file.size, 'type:', file.type, 'MAX:', MAX_ATTACHMENT_SIZE);

        // Validate file size
        if (file.size > MAX_ATTACHMENT_SIZE) {
          console.warn(`📎 [ReplyComposer] File ${file.name} exceeds maximum size (${file.size} > ${MAX_ATTACHMENT_SIZE})`);
          continue;
        }

        const type = detectAttachmentType(file.type);
        console.log('📎 [ReplyComposer] Detected type:', type);

        const attachment: PendingAttachment = {
          id: generateAttachmentId(),
          file,
          type,
          progress: 0,
          status: 'pending',
        };

        // Create preview URL for images
        if (type === ATTACHMENT_TYPES.IMAGE) {
          attachment.previewUrl = URL.createObjectURL(file);
        }

        newAttachments.push(attachment);
      }

      console.log('📎 [ReplyComposer] New attachments created:', newAttachments.length);

      if (newAttachments.length === 0) {
        console.log('📎 [ReplyComposer] No valid attachments, returning');
        return;
      }

      // Add to state
      console.log('📎 [ReplyComposer] Adding attachments to state');
      setAttachments((prev) => [...prev, ...newAttachments]);

      // Auto-upload if handler provided
      console.log('📎 [ReplyComposer] onUploadAttachment handler:', !!onUploadAttachment);
      if (onUploadAttachment) {
        setIsUploadingAttachment(true);
        console.log('📎 [ReplyComposer] Starting upload...');

        for (const attachment of newAttachments) {
          try {
            // Update status to uploading
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === attachment.id ? { ...a, status: 'uploading' } : a
              )
            );

            const result = await onUploadAttachment(attachment.file, (progress) => {
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === attachment.id ? { ...a, progress } : a
                )
              );
            });

            if (result) {
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === attachment.id
                    ? {
                        ...a,
                        status: 'completed',
                        progress: 100,
                        uploadedUrl: result.url,
                      }
                    : a
                )
              );
            } else {
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === attachment.id
                    ? { ...a, status: 'failed', error: t('inbox.attachments.uploadFailed') }
                    : a
                )
              );
            }
          } catch (err) {
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === attachment.id
                  ? { ...a, status: 'failed', error: t('inbox.attachments.uploadFailed') }
                  : a
              )
            );
          }
        }

        setIsUploadingAttachment(false);
      }
    },
    [attachments.length, onUploadAttachment, t]
  );

  /**
   * Remove attachment from list
   */
  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === attachmentId);
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      return prev.filter((a) => a.id !== attachmentId);
    });
  }, []);

  /**
   * Clear all attachments
   */
  const handleClearAttachments = useCallback(() => {
    attachments.forEach((att) => {
      if (att.previewUrl) {
        URL.revokeObjectURL(att.previewUrl);
      }
    });
    setAttachments([]);
  }, [attachments]);

  /**
   * Trigger file input click
   */
  const handleAttachmentClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // =========================================================================
  // SEND HANDLERS
  // =========================================================================

  // Handle send or save (depending on mode)
  const handleSend = useCallback(async () => {
    const trimmedText = text.trim();
    const hasContent = trimmedText.length > 0 || attachments.length > 0;
    if (!hasContent || sending || disabled || isSavingEdit || isUploadingAttachment) return;

    // Check if any attachments are still uploading
    const hasUploadingAttachments = attachments.some((a) => a.status === 'uploading');
    if (hasUploadingAttachments) return;

    // 🏢 ENTERPRISE: Edit mode - save edit (no attachments in edit mode)
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

    // 🏢 ENTERPRISE: Build attachments array for send (ADR-055)
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

    // Send message with attachments
    const success = await onSend(
      trimmedText,
      completedAttachments.length > 0 ? completedAttachments : undefined
    );

    if (success) {
      setText('');
      handleClearAttachments();
      // Focus back to textarea after successful send
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [
    text,
    attachments,
    sending,
    disabled,
    isSavingEdit,
    isUploadingAttachment,
    isEditMode,
    onSaveEdit,
    onSend,
    handleClearAttachments,
  ]);

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
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);

      // 🏢 ENTERPRISE: Update hook state in edit mode
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
                ? t('inbox.composer.replyingTo', 'Απάντηση σε')
                : t('inbox.composer.forwarding', 'Προώθηση')}{' '}
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

      {/* 🏢 ENTERPRISE: Attachment Preview Bar (ADR-055) */}
      {attachments.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${colors.text.muted}`}>
              {t('inbox.attachments.count', { count: attachments.length })}
            </span>
            <button
              type="button"
              onClick={handleClearAttachments}
              className={`text-xs ${colors.text.muted} hover:${colors.text.primary}`}
            >
              {t('inbox.attachments.removeAll')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className={`
                  relative flex items-center gap-2 p-2 rounded-lg border
                  ${attachment.status === 'failed' ? 'border-red-300 bg-red-50' : 'border-border bg-muted/30'}
                  ${TRANSITION_PRESETS.STANDARD_COLORS}
                `}
              >
                {/* Preview/Icon */}
                {attachment.previewUrl ? (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.file.name}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <div className={`w-10 h-10 flex items-center justify-center rounded bg-muted`}>
                    {getAttachmentIcon(attachment.type, iconSizes)}
                  </div>
                )}

                {/* File info */}
                <div className="flex-1 min-w-0 max-w-[150px]">
                  <p className={`text-xs font-medium truncate ${colors.text.primary}`}>
                    {attachment.file.name}
                  </p>
                  <p className={`text-xs ${colors.text.muted}`}>
                    {formatFileSize(attachment.file.size)}
                  </p>
                </div>

                {/* Status indicator */}
                {attachment.status === 'uploading' && (
                  <div className="flex items-center gap-1">
                    <Spinner size="small" />
                    <span className={`text-xs ${colors.text.muted}`}>
                      {attachment.progress}%
                    </span>
                  </div>
                )}

                {attachment.status === 'failed' && (
                  <AlertCircle className={`${iconSizes.sm} text-red-500`} />
                )}

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  className={`
                    p-1 rounded-full hover:bg-muted
                    ${colors.text.muted} hover:${colors.text.primary}
                  `}
                  aria-label={t('inbox.attachments.remove')}
                >
                  <X className={iconSizes.xs} />
                </button>
              </div>
            ))}
          </div>
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
        {/* 🏢 ENTERPRISE: Attachment Button (ADR-055) */}
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
          <textarea
            ref={textareaRef}
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
            className={`
              w-full resize-none rounded-lg border px-4 py-3
              ${TRANSITION_PRESETS.STANDARD_ALL}
              ${colors.bg.primary}
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
              focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
            `}
            style={{ minHeight: `${TEXTAREA_SIZE.minHeight}px`, maxHeight: `${TEXTAREA_SIZE.maxHeight}px` }}
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
                ? t('inbox.composer.saving', 'Αποθήκευση...')
                : t('inbox.composer.save', 'Αποθήκευση')
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
                ? t('inbox.composer.saving', 'Αποθήκευση...')
                : t('inbox.composer.save', 'Αποθήκευση')
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
