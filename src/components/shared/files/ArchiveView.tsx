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

import React, { useCallback, useState } from 'react';
import { Archive } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { unarchiveFilesWithPolicy } from '@/services/filesystem/file-mutation-gateway';
import type { FileCustody } from '@/lib/files/file-custody';
import { useLifecycleFileList } from './hooks/useLifecycleFileList';
import {
  LifecycleFileRow,
  LifecycleListFrame,
  LifecycleListHeader,
  LifecycleListStats,
  formatLifecycleDate,
  useLifecycleViewKit,
} from './LifecycleListFrame';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('ARCHIVE_VIEW');

// ============================================================================
// TYPES
// ============================================================================

export interface ArchiveViewProps {
  /** **Ποιος κατέχει τα αρχεία** (ADR-866 §5.2) — απουσία ⇒ καμία ανάγνωση, ποτέ μαντεμένο διαμέρισμα. */
  custody: FileCustody | undefined;
  currentUserId: string;
  entityType?: string;
  entityId?: string;
  onUnarchive?: (fileId: string, displayName: string) => void;
}

// ============================================================================
// UTILITIES
// ============================================================================

// ============================================================================
// COMPONENT
// ============================================================================

export function ArchiveView({
  custody: custodyProp,
  entityType,
  entityId,
  onUnarchive,
}: ArchiveViewProps) {
  const { t, fileNotifications } = useLifecycleViewKit();

  const {
    files: archivedFiles,
    setFiles: setArchivedFiles,
    loading,
    error,
    refetch: fetchArchivedFiles,
  } = useLifecycleFileList({
    list: 'archived',
    custody: custodyProp,
    entityType,
    entityId,
  });

  const [unarchiveDialogOpen, setUnarchiveDialogOpen] = useState(false);
  const [fileToUnarchive, setFileToUnarchive] = useState<string | null>(null);
  const [unarchiveLoading, setUnarchiveLoading] = useState(false);

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
      fileNotifications.archived.unarchiveSuccess();
      setUnarchiveDialogOpen(false);
      setFileToUnarchive(null);

      setArchivedFiles((prev) => prev.filter((f) => f.id !== fileToUnarchive));
      onUnarchive?.(fileToUnarchive, displayName);
    } catch (err) {
      const restoreError = err instanceof Error ? err : new Error('Failed to unarchive file');
      logger.error('Failed to unarchive file', { error: restoreError.message });
      fileNotifications.archived.unarchiveError();
    } finally {
      setUnarchiveLoading(false);
    }
  }, [fileToUnarchive, fileNotifications, onUnarchive]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <LifecycleListFrame
      icon={Archive}
      title={t('archived.title')}
      emptyTitle={t('archived.noArchivedFiles')}
      emptyDescription={t('archived.noArchivedFilesDescription')}
      loading={loading}
      error={error}
      isEmpty={archivedFiles.length === 0}
      onRefresh={fetchArchivedFiles}
    >
      <section className="space-y-2">
        <LifecycleListHeader
          icon={Archive}
          title={t('archived.title')}
          description={t('archived.description')}
          onRefresh={fetchArchivedFiles}
        />

        <LifecycleListStats
          files={archivedFiles}
          countLabel={t('archived.stats.totalFiles')}
          sizeLabel={t('archived.stats.totalSize')}
        />

        <div className="space-y-2" role="list" aria-label={t('archived.title')}>
          {archivedFiles.map((file) => (
            <LifecycleFileRow
              key={file.id}
              file={file}
              icon={Archive}
              tone="warning"
              dateText={`${t('archived.archivedAt')}: ${formatLifecycleDate(file.archivedAt)}`}
              actionLabel={t('archived.unarchiveFile')}
              actionText={t('archived.unarchive')}
              onAction={() => handleUnarchiveClick(file.id)}
            />
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
    </LifecycleListFrame>
  );
}
