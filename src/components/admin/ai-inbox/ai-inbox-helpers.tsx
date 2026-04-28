/**
 * =============================================================================
 * AI INBOX HELPERS — Utility functions and small components
 * =============================================================================
 *
 * Extracted from AIInboxClient.tsx for SRP compliance (ADR N.7.1).
 * Contains: badge variant resolvers, content extractors, file type detection,
 * timestamp resolver, and the AttachmentDisplay component.
 *
 * @module ai-inbox-helpers
 * @enterprise Google SRP — single responsibility per module
 * @created 2026-03-28
 */

import { Paperclip, FileText, FileImage, Download, File } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { normalizeToDate } from '@/lib/date-local';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTypography } from '@/hooks/useTypography';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { FirestoreishTimestamp } from '@/types/crm';

// SSoT re-exports — consumers can import from here or directly from shared
export { getIntentBadgeVariant, getConfidenceBadgeVariant } from '@/components/admin/shared/intent-badge-utils';
export type { IntentBadgeVariant } from '@/components/admin/shared/intent-badge-utils';

interface FileTypeInfo {
  icon: typeof File;
  type: string;
  color: string;
  bgColor: string;
}

// ============================================================================
// BADGE VARIANT RESOLVERS — SSoT: @/components/admin/shared/intent-badge-utils
// ============================================================================

// ============================================================================
// CONTENT EXTRACTION
// ============================================================================

/**
 * Safe content extractor for communication messages.
 * Handles both string content AND object content { text, attachments }
 * from different message sources (email = string, telegram = object).
 *
 * @param content - Raw content from Firestore (string | object | unknown)
 * @returns Plain text representation of the content
 */
export const getDisplayContent = (content: unknown): string => {
  // Case 1: Already a string
  if (typeof content === 'string') {
    return content;
  }

  // Case 2: Object with text property (Telegram/WhatsApp format)
  if (content && typeof content === 'object') {
    const contentObj = content as Record<string, unknown>;

    if (typeof contentObj.text === 'string') {
      return contentObj.text;
    }

    if (Array.isArray(contentObj.attachments) && contentObj.attachments.length > 0) {
      return `[${contentObj.attachments.length} attachment(s)]`;
    }
  }

  return '';
};

// ============================================================================
// TIMESTAMP RESOLUTION
// ============================================================================

/**
 * Resolves Firestore-ish timestamps to native Date objects.
 * Uses centralized normalizeToDate (ADR-208).
 */
export const resolveFirestoreTimestamp = (value?: FirestoreishTimestamp | null): Date | null =>
  normalizeToDate(value);

// ============================================================================
// FILE TYPE DETECTION
// ============================================================================

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']);
const DOC_EXTENSIONS = new Set(['doc', 'docx', 'txt', 'rtf', 'odt']);
const SPREADSHEET_EXTENSIONS = new Set(['xls', 'xlsx', 'csv', 'ods']);

/**
 * Maps file URL/extension to appropriate icon and styling.
 * Pattern: Gmail, Outlook, Salesforce attachment display.
 *
 * @param url - File URL (typically Firebase Storage)
 * @returns Icon component, type label, and color tokens
 */
export const getFileTypeInfo = (url: string): FileTypeInfo => {
  const filename = url.split('/').pop() || url;
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  if (IMAGE_EXTENSIONS.has(extension)) {
    return {
      icon: FileImage,
      type: 'image',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    };
  }

  if (extension === 'pdf') {
    return {
      icon: FileText,
      type: 'pdf',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950',
    };
  }

  if (DOC_EXTENSIONS.has(extension)) {
    return {
      icon: FileText,
      type: 'document',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    };
  }

  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return {
      icon: FileText,
      type: 'spreadsheet',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950',
    };
  }

  return {
    icon: File,
    type: 'file',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
  };
};

// ============================================================================
// ATTACHMENT DISPLAY COMPONENT
// ============================================================================

interface AttachmentDisplayProps {
  attachments: string[];
}

/**
 * Renders a grid of file attachments with type-based icons and download actions.
 *
 * Features (Gmail/Outlook/Salesforce standard):
 * - File type icons with semantic color coding
 * - Filename with intelligent truncation
 * - Download button with hover effects
 * - Responsive grid layout (1 col mobile, 2 col desktop)
 * - Accessibility (keyboard navigation, ARIA labels, focus states)
 * - Firebase Storage URL support
 *
 * @param attachments - Array of attachment URLs from Firebase Storage
 */
export const AttachmentDisplay = ({ attachments }: AttachmentDisplayProps) => {
  const layout = useLayoutClasses();
  const typography = useTypography();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  if (!attachments || attachments.length === 0) return null;

  const handleDownload = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className={`${layout.flexGap2} items-center`}>
        <Paperclip className={iconSizes.sm} />
        <span className={`${typography.label.sm} ${colors.text.muted}`}>
          {attachments.length} {attachments.length === 1 ? 'Attachment' : 'Attachments'}
        </span>
      </div>

      {/* Attachments Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {attachments.map((url, index) => {
          const filename = url.split('/').pop() || `attachment-${index + 1}`;
          const fileInfo = getFileTypeInfo(url);
          const FileIcon = fileInfo.icon;

          return (
            <div
              key={index}
              className={`${fileInfo.bgColor} rounded-lg p-3 ${layout.flexGap3} items-center group hover:shadow-sm transition-all border border-transparent hover:border-border`}
            >
              {/* File Icon */}
              <div className={`flex-shrink-0 ${fileInfo.color}`}>
                <FileIcon className={iconSizes.md} />
              </div>

              {/* Filename & Type */}
              <div className="flex-1 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className={`${typography.body.sm} truncate font-medium`}>
                      {filename}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent>{filename}</TooltipContent>
                </Tooltip>
                <p className={`${typography.label.xs} ${colors.text.muted}`}>
                  {fileInfo.type.toUpperCase()}
                </p>
              </div>

              {/* Download Button */}
              <button
                onClick={() => handleDownload(url)}
                className="flex-shrink-0 p-2 rounded-md hover:bg-background/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={`Download ${filename}`}
                type="button"
              >
                <Download
                  className={`${iconSizes.sm} ${colors.text.muted} group-hover:text-foreground transition-colors`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
