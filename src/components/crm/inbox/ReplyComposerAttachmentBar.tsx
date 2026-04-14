'use client';

/**
 * =============================================================================
 * REPLY COMPOSER - Attachment Preview Bar
 * =============================================================================
 *
 * Renders the attachment preview bar with thumbnails, progress, and actions.
 *
 * @module components/crm/inbox/ReplyComposerAttachmentBar
 * @enterprise ADR-055 - Enterprise Attachment System Consolidation
 */

import '@/lib/design-system';
import { getStatusColor } from '@/lib/design-system';
import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { formatFileSize } from '@/utils/file-validation';
import { AlertCircle, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { PendingAttachment } from './reply-composer-types';
import { getAttachmentIcon } from './reply-composer-types';

interface ReplyComposerAttachmentBarProps {
  attachments: PendingAttachment[];
  onRemoveAttachment: (id: string) => void;
  onClearAll: () => void;
}

export function ReplyComposerAttachmentBar({
  attachments,
  onRemoveAttachment,
  onClearAll,
}: ReplyComposerAttachmentBarProps) {
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  if (attachments.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${colors.text.muted}`}>
          {t('inbox.attachments.count', { count: attachments.length })}
        </span>
        <button
          type="button"
          onClick={onClearAll}
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
              ${attachment.status === 'failed' ? `${getStatusColor('error', 'border')} bg-red-50` : 'border-border bg-muted/30'}
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
              <div className="w-10 h-10 flex items-center justify-center rounded bg-muted">
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
              onClick={() => onRemoveAttachment(attachment.id)}
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
  );
}
