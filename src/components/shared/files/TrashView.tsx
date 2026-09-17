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

import React, { useCallback, useState } from 'react';
import { Clock, Shield, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { restoreFileFromTrashWithPolicy } from '@/services/filesystem/file-mutation-gateway';
import { fileCustodyKindOf, type FileCustody } from '@/lib/files/file-custody';
import { useLifecycleFileList } from './hooks/useLifecycleFileList';
import {
  LifecycleFileRow,
  LifecycleListFrame,
  LifecycleListHeader,
  LifecycleListStats,
  formatLifecycleDate,
  useLifecycleViewKit,
} from './LifecycleListFrame';
import { HOLD_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('TRASH_VIEW');

// ============================================================================
// TYPES
// ============================================================================

export interface TrashViewProps {
  /**
   * **Ποιος κατέχει τα αρχεία** (ADR-866 §5.2) — διαμέρισμα **και** φίλτρο κατόχου. Απουσία ⇒
   * **καμία** ανάγνωση (ο κάτοχος δεν έχει φορτώσει ακόμη) — ποτέ ανάγνωση σε μαντεμένο διαμέρισμα.
   */
  custody: FileCustody | undefined;
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
  custody: custodyProp,
  currentUserId,
  entityType,
  entityId,
  onRestore,
}: TrashViewProps) {
  const { iconSizes, t, fileNotifications } = useLifecycleViewKit();

  // State
  const {
    files: trashedFiles,
    setFiles: setTrashedFiles,
    loading,
    error,
    refetch: fetchTrashedFiles,
  } = useLifecycleFileList({
    list: 'trashed',
    custody: custodyProp,
    entityType,
    entityId,
  });

  // Dialog state
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [fileToRestore, setFileToRestore] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

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
      // ADR-866 §2.6.8 Β4 — το διαμέρισμα το αποδεικνύει το ΙΔΙΟ το έγγραφο, ποτέ μαντεψιά.
      const record = trashedFiles.find((f) => f.id === fileToRestore);
      const recordCustody = record ? fileCustodyKindOf(record) : null;
      if (recordCustody === null) throw new Error(`FILE_CUSTODY_UNKNOWN: ${fileToRestore}`);
      await restoreFileFromTrashWithPolicy(fileToRestore, recordCustody, currentUserId);
      fileNotifications.trash.restoreSuccess();
      setRestoreDialogOpen(false);
      setFileToRestore(null);

      // Remove from local state
      setTrashedFiles((prev) => prev.filter((f) => f.id !== fileToRestore));

      // Notify parent
      onRestore?.(fileToRestore);
    } catch (err) {
      const restoreError = err instanceof Error ? err : new Error('Failed to restore file');
      logger.error('Failed to restore file', { error: restoreError.message });
      fileNotifications.trash.restoreError();
    } finally {
      setRestoreLoading(false);
    }
  }, [fileToRestore, trashedFiles, currentUserId, fileNotifications, onRestore]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <LifecycleListFrame
      icon={Trash2}
      title={t('trash.title')}
      emptyTitle={t('trash.noTrashedFiles')}
      emptyDescription={t('trash.noTrashedFilesDescription')}
      loading={loading}
      error={error}
      isEmpty={trashedFiles.length === 0}
      onRefresh={fetchTrashedFiles}
    >
      <section className="space-y-2">
        <LifecycleListHeader
          icon={Trash2}
          title={t('trash.title')}
          description={t('trash.description')}
          onRefresh={fetchTrashedFiles}
        />

        {/* Stats */}
        <LifecycleListStats
          files={trashedFiles}
          countLabel={t('trash.stats.totalFiles')}
          sizeLabel={t('trash.stats.totalSize')}
        />

        {/* Files list */}
        <div className="space-y-2" role="list" aria-label={t('trash.title')}>
          {trashedFiles.map((file) => {
            const daysUntilPurge = getDaysUntilPurge(file.purgeAt);
            const holdDisplay = getHoldTypeDisplay(file.hold, t);
            const isExpired = daysUntilPurge !== null && daysUntilPurge <= 0;

            return (
              <LifecycleFileRow
                key={file.id}
                file={file}
                icon={Trash2}
                tone="destructive"
                dateText={`${t('trash.trashedAt')}: ${formatLifecycleDate(file.trashedAt)}`}
                extraMeta={
                  <>
                    {/* Days until purge */}
                    {daysUntilPurge !== null && (
                      <span
                        className={`flex items-center gap-1 ${
                          isExpired
                            ? 'text-destructive'
                            : daysUntilPurge <= 7
                            ? 'text-[hsl(var(--text-warning))]'
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
                      <span className="flex items-center gap-1 text-[hsl(var(--text-warning))]">
                        <Shield className={iconSizes.xs} aria-hidden="true" />
                        {holdDisplay}
                      </span>
                    )}
                  </>
                }
                actionLabel={t('trash.restoreFile')}
                actionText={t('trash.restore')}
                onAction={() => handleRestoreClick(file.id)}
              />
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
    </LifecycleListFrame>
  );
}
