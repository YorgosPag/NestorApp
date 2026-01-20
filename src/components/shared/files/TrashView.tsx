/**
 * =============================================================================
 * 🗑️ ENTERPRISE: Trash View Component
 * =============================================================================
 *
 * Enterprise-grade trash/recycle bin view for soft-deleted files.
 * Allows users to view, restore, or permanently delete trashed files.
 *
 * @module components/shared/files/TrashView
 * @enterprise ADR-032 - Enterprise Trash System
 *
 * Pattern: Google Drive / Salesforce / Microsoft Purview
 * - 30-day retention (configurable by category)
 * - Restore functionality
 * - Permanent delete (super_admin only)
 * - Hold status display
 */

'use client';

import React, { useCallback, useState, useEffect } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Clock,
  Shield,
  RefreshCw,
  HardDrive,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, FORM_BUTTON_EFFECTS } from '@/components/ui/effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import { formatFileSize as formatFileSizeUtil } from '@/utils/file-validation';
import { useNotifications } from '@/providers/NotificationProvider';
import { ConfirmDialog, DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FileRecordService } from '@/services/file-record.service';
import type { FileRecord } from '@/types/file-record';
import { HOLD_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('TRASH_VIEW');

// ============================================================================
// TYPES
// ============================================================================

export interface TrashViewProps {
  /** Company ID for fetching trashed files */
  companyId: string;
  /** Current user ID (for restore authorization) */
  currentUserId: string;
  /** Optional entity type filter */
  entityType?: string;
  /** Optional entity ID filter */
  entityId?: string;
  /** Callback when file is restored */
  onRestore?: (fileId: string) => void;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format file size
 */
function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return formatFileSizeUtil(0);
  return formatFileSizeUtil(bytes);
}

/**
 * Format date
 */
function formatDate(dateString: string | Date | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'N/A';
  }
}

/**
 * Calculate days until purge
 */
function getDaysUntilPurge(purgeAt: string | Date | undefined): number | null {
  if (!purgeAt) return null;
  try {
    const purgeDate = typeof purgeAt === 'string' ? new Date(purgeAt) : purgeAt;
    const now = new Date();
    const diffMs = purgeDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return null;
  }
}

/**
 * Get hold type display
 */
function getHoldTypeDisplay(hold: string | undefined, t: (key: string) => string): string | null {
  if (!hold || hold === HOLD_TYPES.NONE) return null;
  switch (hold) {
    case HOLD_TYPES.LEGAL:
      return t('trash.holdLegal');
    case HOLD_TYPES.REGULATORY:
      return t('trash.holdRegulatory');
    case HOLD_TYPES.ADMIN:
      return t('trash.holdAdmin');
    default:
      return t('trash.holdActive');
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🗑️ ENTERPRISE: Trash View Component
 *
 * Displays soft-deleted files with:
 * - Restore functionality
 * - Days until permanent deletion
 * - Hold status indicators
 * - Permanent delete (admin only)
 */
export function TrashView({
  companyId,
  currentUserId,
  entityType,
  entityId,
  onRestore,
}: TrashViewProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('files');
  const translateDisplayName = useFileDisplayName();
  const { success, error: showError } = useNotifications();

  // State
  const [trashedFiles, setTrashedFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Dialog state
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [fileToRestore, setFileToRestore] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // =========================================================================
  // FETCH TRASHED FILES
  // =========================================================================

  const fetchTrashedFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Fetching trashed files', { companyId, entityType, entityId });

      const files = await FileRecordService.getTrashedFiles({
        companyId,
        entityType: entityType as Parameters<typeof FileRecordService.getTrashedFiles>[0]['entityType'],
        entityId,
      });

      logger.info('Trashed files fetched', { count: files.length });
      setTrashedFiles(files);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch trashed files');
      logger.error('Failed to fetch trashed files', { error: fetchError.message });
      setError(fetchError);
    } finally {
      setLoading(false);
    }
  }, [companyId, entityType, entityId]);

  // Fetch on mount
  useEffect(() => {
    fetchTrashedFiles();
  }, [fetchTrashedFiles]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /**
   * Open restore confirmation dialog
   */
  const handleRestoreClick = useCallback((fileId: string) => {
    setFileToRestore(fileId);
    setRestoreDialogOpen(true);
  }, []);

  /**
   * Execute restore
   */
  const handleRestoreConfirm = useCallback(async () => {
    if (!fileToRestore) return;

    setRestoreLoading(true);
    try {
      await FileRecordService.restoreFromTrash(fileToRestore, currentUserId);
      success(t('trash.restoreSuccess'));
      setRestoreDialogOpen(false);
      setFileToRestore(null);

      // Remove from local state
      setTrashedFiles((prev) => prev.filter((f) => f.id !== fileToRestore));

      // Notify parent
      onRestore?.(fileToRestore);
    } catch (err) {
      const restoreError = err instanceof Error ? err : new Error('Failed to restore file');
      logger.error('Failed to restore file', { error: restoreError.message });
      showError(t('trash.restoreError'));
    } finally {
      setRestoreLoading(false);
    }
  }, [fileToRestore, currentUserId, t, success, showError, onRestore]);

  // =========================================================================
  // RENDER
  // =========================================================================

  // Loading state
  if (loading) {
    return (
      <section className="space-y-4" role="status" aria-label={t('list.loadingFiles')}>
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className={`${iconSizes.md} text-muted-foreground`} />
            <h2 className="text-lg font-semibold">{t('trash.title')}</h2>
          </div>
        </header>
        <div className="space-y-3">
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
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className={`p-6 ${colors.bg.error} ${quick.card} border border-red-200`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className={iconSizes.md} />
          <p>{error.message}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchTrashedFiles}
          className="mt-4"
        >
          <RefreshCw className={`${iconSizes.sm} mr-2`} />
          {t('manager.refresh')}
        </Button>
      </section>
    );
  }

  // Empty state
  if (trashedFiles.length === 0) {
    return (
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className={`${iconSizes.md} text-muted-foreground`} />
            <h2 className="text-lg font-semibold">{t('trash.title')}</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTrashedFiles}
            aria-label={t('manager.refresh')}
          >
            <RefreshCw className={iconSizes.sm} />
          </Button>
        </header>
        <div
          className={`p-8 text-center ${colors.bg.muted} ${quick.card}`}
          role="status"
          aria-label={t('trash.noTrashedFiles')}
        >
          <Trash2 className={`${iconSizes.xl} mx-auto mb-2 ${colors.text.muted}`} />
          <p className="text-sm font-medium">{t('trash.noTrashedFiles')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('trash.noTrashedFilesDescription')}
          </p>
        </div>
      </section>
    );
  }

  // Trashed files list
  return (
    <section className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trash2 className={`${iconSizes.md} text-muted-foreground`} />
          <div>
            <h2 className="text-lg font-semibold">{t('trash.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('trash.description')}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchTrashedFiles}
          aria-label={t('manager.refresh')}
        >
          <RefreshCw className={iconSizes.sm} />
        </Button>
      </header>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1 text-muted-foreground">
          <HardDrive className={iconSizes.xs} />
          {t('trash.stats.totalFiles')}: {trashedFiles.length}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <HardDrive className={iconSizes.xs} />
          {t('trash.stats.totalSize')}: {formatFileSize(
            trashedFiles.reduce((total, f) => total + (f.sizeBytes || 0), 0)
          )}
        </span>
      </div>

      {/* Files list */}
      <div className="space-y-3" role="list" aria-label={t('trash.title')}>
        {trashedFiles.map((file) => {
          const daysUntilPurge = getDaysUntilPurge(file.purgeAt);
          const holdDisplay = getHoldTypeDisplay(file.hold, t);
          const isExpired = daysUntilPurge !== null && daysUntilPurge <= 0;

          return (
            <article
              key={file.id}
              className={`flex items-center justify-between p-3 bg-card ${quick.card} border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
              role="listitem"
              aria-label={`${t('list.file')}: ${translateDisplayName(file)}`}
            >
              {/* File info */}
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-10 h-10 bg-red-500/10 ${quick.card} flex items-center justify-center`}
                  aria-hidden="true"
                >
                  <Trash2 className={`${iconSizes.md} text-red-500`} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  {/* Display name */}
                  <p className="text-sm font-medium text-foreground truncate">
                    {translateDisplayName(file)}
                  </p>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                    {/* File size */}
                    <span className="flex items-center gap-1">
                      <HardDrive className={iconSizes.xs} aria-hidden="true" />
                      {formatFileSize(file.sizeBytes)}
                    </span>

                    {/* Trashed date */}
                    <span className="flex items-center gap-1">
                      <Calendar className={iconSizes.xs} aria-hidden="true" />
                      {t('trash.trashedAt')}: {formatDate(file.trashedAt)}
                    </span>

                    {/* Days until purge */}
                    {daysUntilPurge !== null && (
                      <span
                        className={`flex items-center gap-1 ${
                          isExpired
                            ? 'text-red-500'
                            : daysUntilPurge <= 7
                            ? 'text-orange-500'
                            : ''
                        }`}
                      >
                        <Clock className={iconSizes.xs} aria-hidden="true" />
                        {isExpired
                          ? t('trash.expired')
                          : `${t('trash.expiresIn')} ${daysUntilPurge} ${t('trash.days')}`}
                      </span>
                    )}

                    {/* Hold status */}
                    {holdDisplay && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Shield className={iconSizes.xs} aria-hidden="true" />
                        {holdDisplay}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <nav className="flex items-center space-x-1" role="toolbar" aria-label={t('list.fileActions')}>
                {/* Restore */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRestoreClick(file.id)}
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  aria-label={t('trash.restoreFile')}
                  title={t('trash.restoreFile')}
                >
                  <RotateCcw className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
                  {t('trash.restore')}
                </Button>
              </nav>
            </article>
          );
        })}
      </div>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        title={t('trash.restoreFile')}
        description={t('trash.restoreConfirm')}
        onConfirm={handleRestoreConfirm}
        confirmText={t('trash.restore')}
        cancelText={t('list.cancel')}
        loading={restoreLoading}
        variant="default"
      />
    </section>
  );
}
