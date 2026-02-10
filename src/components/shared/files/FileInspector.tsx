/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Inspector Component
 * =============================================================================
 *
 * On-demand metadata inspector για file details (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ #2).
 * Enterprise pattern: Details on-demand, όχι inline visual noise.
 *
 * @module components/shared/files/FileInspector
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Features:
 * - Sheet-based inspector (shadcn/ui)
 * - Semantic DOM (<section>, <header>, <dl>, <dt>, <dd>)
 * - Centralized utilities (copyToClipboard, formatFileSize, formatDateTime)
 * - i18n labels (zero hardcoded strings)
 * - Enterprise styling (no inline styles)
 *
 * @example
 * ```tsx
 * <FileInspector
 *   file={fileRecord}
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   companyName="Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε."
 * />
 * ```
 */

'use client';

import React, { useCallback } from 'react';
import { Copy, File as FileIcon, Calendar, HardDrive, Tag, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FileRecord } from '@/types/file-record';
import { formatFileSize } from '@/utils/file-validation'; // 🏢 ENTERPRISE: Centralized file size formatting
import { copyToClipboard } from '@/lib/share-utils'; // 🏢 ENTERPRISE: Centralized clipboard utility
import { formatDateTime } from '@/lib/intl-utils'; // 🏢 ENTERPRISE: Centralized date/time formatting
import { useNotifications } from '@/providers/NotificationProvider'; // 🏢 ENTERPRISE: Centralized notifications
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'; // 🏢 ENTERPRISE: shadcn Sheet components
import { ScrollArea } from '@/components/ui/scroll-area'; // 🏢 ENTERPRISE: shadcn ScrollArea

// ============================================================================
// TYPES
// ============================================================================

export interface FileInspectorProps {
  /** File record to inspect */
  file: FileRecord;
  /** Sheet open state */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Optional company name for display */
  companyName?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: File Inspector (On-demand metadata display)
 *
 * Displays structured file metadata in a Sheet (side panel).
 * Follows enterprise patterns: semantic DOM, i18n, no inline styles.
 */
export function FileInspector({
  file,
  open,
  onClose,
  companyName,
}: FileInspectorProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('files');
  const { success, error } = useNotifications();

  /**
   * Handle copy storage path to clipboard
   */
  const handleCopyPath = useCallback(async () => {
    if (!file.storagePath) {
      error(t('technical.pathUnavailable'));
      return;
    }

    try {
      const copied = await copyToClipboard(file.storagePath);
      if (copied) {
        success(t('technical.pathCopied'));
      } else {
        error(t('copy.copyError', { ns: 'common', defaultValue: 'Copy failed' }));
      }
    } catch (err) {
      console.error('[FileInspector] Failed to copy path:', err);
      error(t('copy.copyError', { ns: 'common', defaultValue: 'Copy failed' }));
    }
  }, [file.storagePath, success, error, t]);

  // 🏢 ENTERPRISE: Format timestamp using centralized formatDateTime
  const formatDate = (timestamp: unknown): string => {
    if (!timestamp) return t('technical.unavailable', { defaultValue: 'N/A' });
    try {
      // Handle Firestore Timestamp
      if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
        return formatDateTime((timestamp as { toDate: () => Date }).toDate());
      }
      // Handle Date object
      if (timestamp instanceof Date) {
        return formatDateTime(timestamp);
      }
      return t('technical.unavailable', { defaultValue: 'N/A' });
    } catch {
      return t('technical.unavailable', { defaultValue: 'N/A' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {/* Header */}
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileIcon className={cn(iconSizes.md, 'text-primary')} />
            {t('inspector.title')}
          </SheetTitle>
          <SheetDescription>
            {t('inspector.description')}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
          <section className="space-y-6">
            {/* File Name */}
            <header className="pb-4 border-b">
              <h3 className="text-lg font-semibold truncate" title={file.displayName}>
                {file.displayName}
              </h3>
              <p className="text-sm text-muted-foreground truncate" title={file.originalFilename}>
                {file.originalFilename}
              </p>
            </header>

            {/* Metadata (Definition List - Semantic DOM) */}
            <dl className="space-y-4">
              {/* Storage Path */}
              <div>
                <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                  <HardDrive className={iconSizes.xs} />
                  {t('inspector.storagePath')}
                </dt>
                <dd className="flex items-start gap-2">
                  <code className="flex-1 text-xs font-mono bg-muted p-2 rounded break-all">
                    {file.storagePath || t('technical.pathUnavailable')}
                  </code>
                  {file.storagePath && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleCopyPath}
                          className={cn(
                            'flex-shrink-0 p-2 rounded transition-colors',
                            'hover:bg-muted text-muted-foreground hover:text-foreground',
                            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
                          )}
                          aria-label={t('technical.copyPath')}
                        >
                          <Copy className={iconSizes.xs} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t('technical.copyPath')}</TooltipContent>
                    </Tooltip>
                  )}
                </dd>
              </div>

              {/* File Size */}
              {file.sizeBytes && (
                <div>
                  <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                    <FileIcon className={iconSizes.xs} />
                    {t('inspector.fileSize')}
                  </dt>
                  <dd className="text-sm">
                    {formatFileSize(file.sizeBytes)} ({file.sizeBytes.toLocaleString()} bytes)
                  </dd>
                </div>
              )}

              {/* Content Type */}
              {file.contentType && (
                <div>
                  <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                    <Tag className={iconSizes.xs} />
                    {t('inspector.contentType')}
                  </dt>
                  <dd className="text-sm">
                    <code className="text-xs bg-muted px-2 py-1 rounded">{file.contentType}</code>
                  </dd>
                </div>
              )}

              {/* Created At */}
              {file.createdAt && (
                <div>
                  <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                    <Calendar className={iconSizes.xs} />
                    {t('inspector.createdAt')}
                  </dt>
                  <dd className="text-sm">{formatDate(file.createdAt)}</dd>
                </div>
              )}

              {/* Created By */}
              {file.createdBy && (
                <div>
                  <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                    <User className={iconSizes.xs} />
                    {t('inspector.createdBy')}
                  </dt>
                  <dd className="text-sm">
                    <code className="text-xs bg-muted px-2 py-1 rounded">{file.createdBy}</code>
                  </dd>
                </div>
              )}

              {/* Company (if provided) */}
              {companyName && (
                <div>
                  <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                    <FileIcon className={iconSizes.xs} />
                    {t('inspector.company')}
                  </dt>
                  <dd className="text-sm">{companyName}</dd>
                </div>
              )}

              {/* Domain */}
              {file.domain && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-1">
                    {t('inspector.domain')}
                  </dt>
                  <dd className="text-sm">
                    {t(`domains.${file.domain}`, { defaultValue: file.domain })}
                  </dd>
                </div>
              )}

              {/* Category */}
              {file.category && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-1">
                    {t('inspector.category')}
                  </dt>
                  <dd className="text-sm">
                    {t(`categories.${file.category}`, { defaultValue: file.category })}
                  </dd>
                </div>
              )}

              {/* Status */}
              {file.status && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-1">
                    {t('inspector.status')}
                  </dt>
                  <dd className="text-sm">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                        file.status === 'ready' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                        file.status === 'pending' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                        file.status === 'failed' && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      )}
                    >
                      {file.status}
                    </span>
                  </dd>
                </div>
              )}

              {/* Download URL */}
              {file.downloadUrl && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-1">
                    {t('inspector.downloadUrl')}
                  </dt>
                  <dd>
                    <a
                      href={file.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {t('inspector.viewFile')}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
