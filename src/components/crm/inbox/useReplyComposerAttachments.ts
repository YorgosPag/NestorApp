/**
 * =============================================================================
 * REPLY COMPOSER - Attachment Hook
 * =============================================================================
 *
 * Custom hook for managing attachment state and upload logic.
 *
 * @module components/crm/inbox/useReplyComposerAttachments
 * @enterprise ADR-055 - Enterprise Attachment System Consolidation
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { generateAttachmentId } from '@/services/enterprise-id.service';
import { detectAttachmentType } from '@/types/conversations';
import { ATTACHMENT_TYPES } from '@/types/conversations';
import { createModuleLogger } from '@/lib/telemetry';
import type { PendingAttachment } from './reply-composer-types';
import { MAX_ATTACHMENT_SIZE, MAX_ATTACHMENTS } from './reply-composer-types';

const logger = createModuleLogger('ReplyComposerAttachments');

interface UseReplyComposerAttachmentsParams {
  onUploadAttachment?: (
    file: File,
    onProgress: (progress: number) => void
  ) => Promise<{ url: string; thumbnailUrl?: string } | null>;
}

export function useReplyComposerAttachments({
  onUploadAttachment,
}: UseReplyComposerAttachmentsParams) {
  const { t } = useTranslation('crm');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((att) => {
        if (att.previewUrl) {
          URL.revokeObjectURL(att.previewUrl);
        }
      });
    };
  }, [attachments]);

  /**
   * Handle file selection from input
   */
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      logger.info('handleFileSelect called', { filesCount: files?.length });

      if (!files || files.length === 0) {
        logger.info('No files selected');
        return;
      }

      // Copy files to array BEFORE resetting input (resetting clears FileList!)
      const filesArray = Array.from(files);
      logger.info('Files array prepared', { length: filesArray.length });

      // Reset input to allow re-selecting same file (AFTER copying!)
      event.target.value = '';

      // Check max attachments limit
      if (attachments.length + filesArray.length > MAX_ATTACHMENTS) {
        logger.warn('Maximum attachments limit reached', { maxAttachments: MAX_ATTACHMENTS });
        return;
      }

      const newAttachments: PendingAttachment[] = [];

      for (const file of filesArray) {
        logger.info('Processing file', { name: file.name, size: file.size, type: file.type });

        if (file.size > MAX_ATTACHMENT_SIZE) {
          logger.warn('File exceeds maximum size', { fileName: file.name, fileSize: file.size });
          continue;
        }

        const type = detectAttachmentType(file.type);
        const attachment: PendingAttachment = {
          id: generateAttachmentId(),
          file,
          type,
          progress: 0,
          status: 'pending',
        };

        if (type === ATTACHMENT_TYPES.IMAGE) {
          attachment.previewUrl = URL.createObjectURL(file);
        }

        newAttachments.push(attachment);
      }

      if (newAttachments.length === 0) {
        logger.info('No valid attachments, returning');
        return;
      }

      setAttachments((prev) => [...prev, ...newAttachments]);

      // Auto-upload if handler provided
      if (onUploadAttachment) {
        setIsUploadingAttachment(true);

        for (const attachment of newAttachments) {
          try {
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
                    ? { ...a, status: 'completed', progress: 100, uploadedUrl: result.url }
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
          } catch (_err) {
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

  return {
    attachments,
    setAttachments,
    isUploadingAttachment,
    fileInputRef,
    handleFileSelect,
    handleRemoveAttachment,
    handleClearAttachments,
    handleAttachmentClick,
  };
}
