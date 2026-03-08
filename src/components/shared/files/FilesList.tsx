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

import React, { useCallback, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { FileText, Download, Eye, Trash2, Calendar, HardDrive, Link2, Unlink } from 'lucide-react';
import type { FileRecord } from '@/types/file-record';
import type { FileRecordWithLinkStatus } from './hooks/useEntityFiles';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, FORM_BUTTON_EFFECTS } from '@/components/ui/effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFileDisplayName } from '@/hooks/useFileDisplayName'; // 🏢 ENTERPRISE: Runtime i18n translation
import { formatFileSize as formatFileSizeUtil } from '@/utils/file-validation'; // 🏢 ENTERPRISE: Centralized file size formatting
import { formatDate } from '@/lib/intl-utils'; // 🏢 ENTERPRISE: Centralized date formatting
import { useNotifications } from '@/providers/NotificationProvider'; // 🏢 ENTERPRISE: Toast notifications
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog'; // 🏢 ENTERPRISE: Centralized modal confirmation

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('FilesList');

// ============================================================================
// TYPES
// ============================================================================

export interface FilesListProps {
  /** Array of FileRecords to display (may include linked files) */
  files: FileRecordWithLinkStatus[];
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
  /** 🔗 Link to building handler (shown for project files) */
  onLink?: (file: FileRecord) => void;
  /** 🔗 Unlink handler (shown for linked files) */
  onUnlink?: (fileId: string) => Promise<void>;
  /** Show link action button */
  showLinkAction?: boolean;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * 🏢 ENTERPRISE: Format file size using centralized utility
 * Wrapper για undefined safety
 */
function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return formatFileSizeUtil(0); // Delegate to centralized utility
  return formatFileSizeUtil(bytes);
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
  onLink,
  onUnlink,
  showLinkAction = false,
}: FilesListProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('files');
  const translateDisplayName = useFileDisplayName(); // 🏢 ENTERPRISE: Runtime i18n translation
  const { success, error } = useNotifications(); // 🏢 ENTERPRISE: Toast notifications

  // =========================================================================
  // DELETE CONFIRMATION STATE - 🏢 ENTERPRISE: Modal dialog (center screen)
  // =========================================================================
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // =========================================================================
  // 🔗 UNLINK CONFIRMATION STATE
  // =========================================================================
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [fileToUnlink, setFileToUnlink] = useState<string | null>(null);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /**
   * 🏢 ENTERPRISE: Opens delete confirmation modal (center screen)
   * Replaces showConfirmDialog (toast) with proper AlertDialog modal
   */
  const handleDeleteClick = useCallback((fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onDelete || !currentUserId) return;

    setFileToDelete(fileId);
    setDeleteConfirmOpen(true);
  }, [onDelete, currentUserId]);

  /**
   * 🏢 ENTERPRISE: Executes delete after user confirms in modal
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!fileToDelete || !onDelete) return;

    setDeleteLoading(true);
    try {
      await onDelete(fileToDelete);
      success(t('list.deleteSuccess'));
      setDeleteConfirmOpen(false);
      setFileToDelete(null);
    } catch (err) {
      error(t('list.deleteError'));
      logger.error('Delete failed', { error: err });
    } finally {
      setDeleteLoading(false);
    }
  }, [fileToDelete, onDelete, t, success, error]);

  /**
   * 🔗 Opens unlink confirmation modal
   */
  const handleUnlinkClick = useCallback((fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onUnlink) return;

    setFileToUnlink(fileId);
    setUnlinkConfirmOpen(true);
  }, [onUnlink]);

  /**
   * 🔗 Executes unlink after user confirms
   */
  const handleUnlinkConfirm = useCallback(async () => {
    if (!fileToUnlink || !onUnlink) return;

    setUnlinkLoading(true);
    try {
      await onUnlink(fileToUnlink);
      success(t('list.unlinkSuccess'));
      setUnlinkConfirmOpen(false);
      setFileToUnlink(null);
    } catch (err) {
      error(t('list.unlinkError'));
      logger.error('Unlink failed', { error: err });
    } finally {
      setUnlinkLoading(false);
    }
  }, [fileToUnlink, onUnlink, t, success, error]);

  /**
   * 🔗 Link button handler
   */
  const handleLinkClick = useCallback((file: FileRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    onLink?.(file);
  }, [onLink]);

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
      <section className="space-y-2" role="status" aria-label={t('list.loadingFiles')}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`p-2 bg-card ${quick.card} border animate-pulse`}
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
        className={`p-2 text-center ${colors.bg.muted} ${quick.card}`}
        role="status"
        aria-label={t('list.noFiles')}
      >
        <FileText className={`${iconSizes.xl} mx-auto mb-2 ${colors.text.muted}`} />
        <p className="text-sm text-muted-foreground">{t('list.noFilesDescription')}</p>
      </section>
    );
  }

  // Files list
  return (
    <section className="space-y-2" role="region" aria-labelledby="files-list-heading">
      <h3 id="files-list-heading" className="sr-only">
        {t('list.filesList')}
      </h3>

      {files.map((file) => {
        const IconComponent = getFileIcon(file.ext);

        return (
          <article
            key={file.id}
            className={`flex items-center justify-between p-2 bg-card ${quick.card} border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
            aria-label={`${t('list.file')}: ${translateDisplayName(file)}`}
          >
            {/* File info */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* Thumbnail preview or fallback icon */}
              {file.thumbnailUrl ? (
                <img
                  src={file.thumbnailUrl}
                  alt={translateDisplayName(file)}
                  className={`flex-shrink-0 w-10 h-10 ${quick.card} object-cover`}
                  loading="lazy"
                />
              ) : (
                <div
                  className={`flex-shrink-0 w-10 h-10 bg-primary/10 ${quick.card} flex items-center justify-center`}
                  aria-hidden="true"
                >
                  <IconComponent className={`${iconSizes.md} text-primary`} />
                </div>
              )}

              {/* Details */}
              <div className="flex-1 min-w-0">
                {/* Display name - 🏢 ENTERPRISE: Runtime i18n translation */}
                <p className="text-sm font-medium text-foreground truncate">
                  {translateDisplayName(file)}
                </p>

                {/* Metadata */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
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

                  {/* 🔗 Linked file indicator */}
                  {file.isLinkedFile && (
                    <span className="flex items-center gap-1 text-blue-500" title={t('list.linkedFromProject')}>
                      <Link2 className={iconSizes.xs} aria-hidden="true" />
                      {t('list.linkedFromProject')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <nav className="flex items-center space-x-1" role="toolbar" aria-label={t('list.fileActions')}>
              {/* View */}
              {onView && file.downloadUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleView(file, e)}
                      aria-label={t('list.viewFile')}
                    >
                      <Eye className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
                      {t('list.view')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('list.viewFile')}</TooltipContent>
                </Tooltip>
              )}

              {/* Download */}
              {file.downloadUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDownload(file, e)}
                      aria-label={t('list.downloadFile')}
                    >
                      <Download className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
                      {t('list.download')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('list.downloadFile')}</TooltipContent>
                </Tooltip>
              )}

              {/* 🔗 Link to building (only for owned, non-linked files) */}
              {showLinkAction && onLink && !file.isLinkedFile && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleLinkClick(file, e)}
                      className="text-blue-500"
                      aria-label={t('list.linkFile')}
                    >
                      <Link2 className={iconSizes.sm} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('list.linkFile')}</TooltipContent>
                </Tooltip>
              )}

              {/* 🔗 Unlink (only for linked files) */}
              {file.isLinkedFile && onUnlink && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleUnlinkClick(file.id, e)}
                      className="text-orange-500"
                      aria-label={t('list.unlinkFile')}
                    >
                      <Unlink className={iconSizes.sm} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('list.unlinkFile')}</TooltipContent>
                </Tooltip>
              )}

              {/* Delete (only for owned files, not linked) */}
              {onDelete && currentUserId && !file.isLinkedFile && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteClick(file.id, e)}
                      className={`text-red-500 ${FORM_BUTTON_EFFECTS.DESTRUCTIVE}`}
                      aria-label={t('list.deleteFile')}
                    >
                      <Trash2 className={iconSizes.sm} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('list.deleteFile')}</TooltipContent>
                </Tooltip>
              )}
            </nav>
          </article>
        );
      })}

      {/* 🏢 ENTERPRISE: Centralized Delete Confirmation Modal (center screen) */}
      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('list.deleteFile')}
        description={t('list.deleteConfirm')}
        onConfirm={handleDeleteConfirm}
        confirmText={t('list.delete')}
        cancelText={t('list.cancel')}
        loading={deleteLoading}
      />

      {/* 🔗 Unlink Confirmation Modal */}
      <DeleteConfirmDialog
        open={unlinkConfirmOpen}
        onOpenChange={setUnlinkConfirmOpen}
        title={t('list.unlinkFile')}
        description={t('list.unlinkConfirm')}
        onConfirm={handleUnlinkConfirm}
        confirmText={t('list.unlink')}
        cancelText={t('list.cancel')}
        loading={unlinkLoading}
      />
    </section>
  );
}
