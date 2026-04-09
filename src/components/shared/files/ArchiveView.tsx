/**
 * =============================================================================
 * 📦 ENTERPRISE: Archive View Component
 * =============================================================================
 *
 * Enterprise-grade archive view for archived files (Google Drive pattern).
 * Allows users to view and restore (unarchive) archived files.
 *
 * @module components/shared/files/ArchiveView
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Pattern: Google Drive Archive / Gmail "All Mail"
 * - 7-year retention (construction documents)
 * - Restore (unarchive) functionality
 * - Visual distinction from active files
 */

'use client';

import React, { useCallback, useState, useEffect } from 'react';
import {
  Archive,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import { formatFileSize } from '@/utils/file-validation';
import { formatDateTime } from '@/lib/intl-utils';
import { useNotifications } from '@/providers/NotificationProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FileRecordService } from '@/services/file-record.service';
import { unarchiveFilesWithPolicy } from '@/services/filesystem/file-mutation-gateway';
import type { FileRecord } from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('ARCHIVE_VIEW');

// ============================================================================
// TYPES
// ============================================================================

export interface ArchiveViewProps {
  companyId: string;
  currentUserId: string;
  entityType?: string;
  entityId?: string;
  onUnarchive?: (fileId: string, displayName: string) => void;
}

// ============================================================================
// UTILITIES
// ============================================================================

const formatArchiveDate = (dateInput: string | Date | undefined): string => {
  if (!dateInput) return 'N/A';
  const formatted = formatDateTime(dateInput);
  return formatted === '-' ? 'N/A' : formatted;
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ArchiveView({
  companyId,
  currentUserId,
  entityType,
  entityId,
  onUnarchive,
}: ArchiveViewProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('files');
  const translateDisplayName = useFileDisplayName();
  const { success, error: showError } = useNotifications();

  const [archivedFiles, setArchivedFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [unarchiveDialogOpen, setUnarchiveDialogOpen] = useState(false);
  const [fileToUnarchive, setFileToUnarchive] = useState<string | null>(null);
  const [unarchiveLoading, setUnarchiveLoading] = useState(false);

  // =========================================================================
  // FETCH ARCHIVED FILES
  // =========================================================================

  const fetchArchivedFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Fetching archived files', { companyId, entityType, entityId });

      const files = await FileRecordService.getArchivedFiles({
        companyId,
        entityType: entityType as Parameters<typeof FileRecordService.getArchivedFiles>[0]['entityType'],
        entityId,
      });

      logger.info('Archived files fetched', { count: files.length });
      setArchivedFiles(files);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch archived files');
      logger.error('Failed to fetch archived files', { error: fetchError.message });
      setError(fetchError);
    } finally {
      setLoading(false);
    }
  }, [companyId, entityType, entityId]);

  useEffect(() => {
    fetchArchivedFiles();
  }, [fetchArchivedFiles]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleUnarchiveClick = useCallback((fileId: string) => {
    setFileToUnarchive(fileId);
    setUnarchiveDialogOpen(true);
  }, []);

  const handleUnarchiveConfirm = useCallback(async () => {
    if (!fileToUnarchive) return;

    // Capture display name BEFORE removing from state
    const file = archivedFiles.find((f) => f.id === fileToUnarchive);
    const displayName = file?.displayName || file?.originalFilename || fileToUnarchive;

    setUnarchiveLoading(true);
    try {
      await unarchiveFilesWithPolicy([fileToUnarchive]);
      success(t('archived.unarchiveSuccess'));
      setUnarchiveDialogOpen(false);
      setFileToUnarchive(null);

      setArchivedFiles((prev) => prev.filter((f) => f.id !== fileToUnarchive));
      onUnarchive?.(fileToUnarchive, displayName);
    } catch (err) {
      const restoreError = err instanceof Error ? err : new Error('Failed to unarchive file');
      logger.error('Failed to unarchive file', { error: restoreError.message });
      showError(t('archived.unarchiveError'));
    } finally {
      setUnarchiveLoading(false);
    }
  }, [fileToUnarchive, t, success, showError, onUnarchive]);

  // =========================================================================
  // RENDER
  // =========================================================================

  if (loading) {
    return (
      <section className="space-y-2" role="status" aria-label={t('list.loadingFiles')}>
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className={cn(iconSizes.md, colors.text.muted)} />
            <h2 className="text-lg font-semibold">{t('archived.title')}</h2>
          </div>
        </header>
        <div className="space-y-2">
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
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={`p-2 ${colors.bg.error} ${quick.card} border border-red-200`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className={iconSizes.md} />
          <p>{error.message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchArchivedFiles} className="mt-2">
          <RefreshCw className={`${iconSizes.sm} mr-2`} />
          {t('manager.refresh')}
        </Button>
      </section>
    );
  }

  if (archivedFiles.length === 0) {
    return (
      <section className="space-y-2">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className={cn(iconSizes.md, colors.text.muted)} />
            <h2 className="text-lg font-semibold">{t('archived.title')}</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchArchivedFiles}
            aria-label={t('manager.refresh')}
          >
            <RefreshCw className={iconSizes.sm} />
          </Button>
        </header>
        <div
          className={`p-2 text-center ${colors.bg.muted} ${quick.card}`}
          role="status"
          aria-label={t('archived.noArchivedFiles')}
        >
          <Archive className={`${iconSizes.xl} mx-auto mb-2 ${colors.text.muted}`} />
          <p className="text-sm font-medium">{t('archived.noArchivedFiles')}</p>
          <p className={cn("text-xs mt-1", colors.text.muted)}>
            {t('archived.noArchivedFilesDescription')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive className={cn(iconSizes.md, colors.text.muted)} />
          <div>
            <h2 className="text-lg font-semibold">{t('archived.title')}</h2>
            <p className={cn("text-xs", colors.text.muted)}>{t('archived.description')}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchArchivedFiles}
          aria-label={t('manager.refresh')}
        >
          <RefreshCw className={iconSizes.sm} />
        </Button>
      </header>

      <div className="flex gap-2 text-sm">
        <span className={cn("flex items-center gap-1", colors.text.muted)}>
          <HardDrive className={iconSizes.xs} />
          {t('archived.stats.totalFiles')}: {archivedFiles.length}
        </span>
        <span className={cn("flex items-center gap-1", colors.text.muted)}>
          <HardDrive className={iconSizes.xs} />
          {t('archived.stats.totalSize')}: {formatFileSize(
            archivedFiles.reduce((total, f) => total + (f.sizeBytes || 0), 0)
          )}
        </span>
      </div>

      <div className="space-y-2" role="list" aria-label={t('archived.title')}>
        {archivedFiles.map((file) => (
          <article
            key={file.id}
            className={`flex items-center justify-between p-2 bg-card ${quick.card} border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
            role="listitem"
            aria-label={`${t('list.file')}: ${translateDisplayName(file)}`}
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div
                className={`flex-shrink-0 w-10 h-10 bg-orange-500/10 ${quick.card} flex items-center justify-center`}
                aria-hidden="true"
              >
                <Archive className={`${iconSizes.md} text-orange-500`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {translateDisplayName(file)}
                </p>

                <div className={cn("flex flex-wrap items-center gap-2 text-xs mt-1", colors.text.muted)}>
                  <span className="flex items-center gap-1">
                    <HardDrive className={iconSizes.xs} aria-hidden="true" />
                    {formatFileSize(file.sizeBytes ?? 0)}
                  </span>

                  <span className="flex items-center gap-1">
                    <Calendar className={iconSizes.xs} aria-hidden="true" />
                    {t('archived.archivedAt')}: {formatArchiveDate(file.archivedAt)}
                  </span>
                </div>
              </div>
            </div>

            <nav className="flex items-center space-x-1" role="toolbar" aria-label={t('list.fileActions')}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnarchiveClick(file.id)}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    aria-label={t('archived.unarchiveFile')}
                  >
                    <RotateCcw className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
                    {t('archived.unarchive')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('archived.unarchiveFile')}</TooltipContent>
              </Tooltip>
            </nav>
          </article>
        ))}
      </div>

      <ConfirmDialog
        open={unarchiveDialogOpen}
        onOpenChange={setUnarchiveDialogOpen}
        title={t('archived.unarchiveFile')}
        description={t('archived.unarchiveConfirm')}
        onConfirm={handleUnarchiveConfirm}
        confirmText={t('archived.unarchive')}
        cancelText={t('list.cancel')}
        loading={unarchiveLoading}
        variant="default"
      />
    </section>
  );
}
