/**
 * =============================================================================
 * 🏢 ENTERPRISE: FilesList Component
 * =============================================================================
 *
 * Enterprise-grade file list display component.
 * Displays FileRecords με professional UI patterns (Salesforce/Microsoft style).
 *
 * @module components/shared/files/FilesList
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useCallback } from 'react';
import { FileText, Download, Eye, Trash2, Calendar, HardDrive } from 'lucide-react';
import type { FileRecord } from '@/types/file-record';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, FORM_BUTTON_EFFECTS } from '@/components/ui/effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

export interface FilesListProps {
  /** Array of FileRecords to display */
  files: FileRecord[];
  /** Loading state */
  loading?: boolean;
  /** Delete handler */
  onDelete?: (fileId: string) => Promise<void>;
  /** View/Preview handler */
  onView?: (file: FileRecord) => void;
  /** Download handler */
  onDownload?: (file: FileRecord) => void;
  /** Rename handler */
  onRename?: (fileId: string, newDisplayName: string) => void;
  /** Current user ID (για delete authorization) */
  currentUserId?: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format file size για human-readable display
 */
function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format date για display
 */
function formatDate(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return 'N/A';
  }
}

/**
 * Get file icon based on extension
 */
function getFileIcon(ext: string): typeof FileText {
  // For now, return FileText for all
  // TODO: Επέκταση με περισσότερα icons (Image, Video, PDF, etc.)
  return FileText;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Files List Component
 *
 * Professional file list display με:
 * - Semantic HTML (article elements)
 * - Centralized design tokens
 * - i18n support
 * - Accessibility (ARIA labels)
 * - Zero inline styles
 */
export function FilesList({
  files,
  loading = false,
  onDelete,
  onView,
  onDownload,
  currentUserId,
}: FilesListProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('files');

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleDelete = useCallback(async (fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!onDelete || !currentUserId) return;

    // Confirm delete
    const confirmed = window.confirm(t('deleteConfirm'));
    if (!confirmed) return;

    try {
      await onDelete(fileId);
    } catch (error) {
      // TODO: Show toast notification
    }
  }, [onDelete, currentUserId, t]);

  const handleView = useCallback((file: FileRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onView) {
      onView(file);
    }
  }, [onView]);

  const handleDownload = useCallback((file: FileRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onDownload) {
      onDownload(file);
    } else if (file.downloadUrl) {
      // Fallback: direct download with OWASP security
      // 🔒 OWASP: Use noopener,noreferrer to prevent reverse tabnabbing
      const newWindow = window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
      if (newWindow) newWindow.opener = null; // Extra security for older browsers
    }
  }, [onDownload]);

  // =========================================================================
  // RENDER
  // =========================================================================

  // Loading state
  if (loading) {
    return (
      <section className="space-y-3" role="status" aria-label={t('loadingFiles')}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`p-4 bg-card ${quick.card} border animate-pulse`}
            aria-hidden="true"
          >
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 bg-muted ${quick.card}`} />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </section>
    );
  }

  // Empty state
  if (files.length === 0) {
    return (
      <section
        className={`p-8 text-center ${colors.bg.muted} ${quick.card}`}
        role="status"
        aria-label={t('noFiles')}
      >
        <FileText className={`${iconSizes.xl} mx-auto mb-2 ${colors.text.muted}`} />
        <p className="text-sm text-muted-foreground">{t('noFilesDescription')}</p>
      </section>
    );
  }

  // Files list
  return (
    <section className="space-y-3" role="region" aria-labelledby="files-list-heading">
      <h3 id="files-list-heading" className="sr-only">
        {t('filesList')}
      </h3>

      {files.map((file) => {
        const IconComponent = getFileIcon(file.ext);

        return (
          <article
            key={file.id}
            className={`flex items-center justify-between p-3 bg-card ${quick.card} border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
            aria-label={`${t('file')}: ${file.displayName}`}
          >
            {/* File info */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* Icon */}
              <div
                className={`flex-shrink-0 w-10 h-10 ${colors.bg.primarySubtle} ${quick.card} flex items-center justify-center`}
                aria-hidden="true"
              >
                <IconComponent className={`${iconSizes.md} text-primary`} />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                {/* Display name */}
                <p className="text-sm font-medium text-foreground truncate">
                  {file.displayName}
                </p>

                {/* Metadata */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  {/* File size */}
                  <span className="flex items-center gap-1">
                    <HardDrive className={iconSizes.xs} aria-hidden="true" />
                    {formatFileSize(file.sizeBytes)}
                  </span>

                  {/* Upload date */}
                  <span className="flex items-center gap-1">
                    <Calendar className={iconSizes.xs} aria-hidden="true" />
                    {formatDate(file.createdAt)}
                  </span>

                  {/* Extension */}
                  <span className="uppercase">.{file.ext}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <nav className="flex items-center space-x-1" role="toolbar" aria-label={t('fileActions')}>
              {/* View */}
              {onView && file.downloadUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleView(file, e)}
                  aria-label={t('viewFile')}
                  title={t('viewFile')}
                >
                  <Eye className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
                  {t('view')}
                </Button>
              )}

              {/* Download */}
              {file.downloadUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleDownload(file, e)}
                  aria-label={t('downloadFile')}
                  title={t('downloadFile')}
                >
                  <Download className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
                  {t('download')}
                </Button>
              )}

              {/* Delete */}
              {onDelete && currentUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDelete(file.id, e)}
                  className={`text-red-500 ${FORM_BUTTON_EFFECTS.DESTRUCTIVE}`}
                  aria-label={t('deleteFile')}
                  title={t('deleteFile')}
                >
                  <Trash2 className={iconSizes.sm} aria-hidden="true" />
                </Button>
              )}
            </nav>
          </article>
        );
      })}
    </section>
  );
}
