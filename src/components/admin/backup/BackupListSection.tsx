/**
 * =============================================================================
 * BACKUP LIST SECTION — ADR-313 Admin UI
 * =============================================================================
 *
 * Displays existing backups as Cards with metadata.
 * Each card shows: ID, type, timestamp, doc count, storage info, duration.
 *
 * @module components/admin/backup/BackupListSection
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

import type { BackupManifest } from '@/services/backup/backup-manifest.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BackupListSectionProps {
  backups: BackupManifest[];
  isLoading: boolean;
  onSelectForRestore: (backupId: string) => void;
  onRefresh: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BackupListSection({
  backups,
  isLoading,
  onSelectForRestore,
  onRefresh,
}: BackupListSectionProps) {
  const { t } = useTranslation(['admin', 'common']);
  const colors = useSemanticColors();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('backup.list.title')}</CardTitle>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          {t('backup.actions.refresh')}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className={cn('animate-pulse', colors.text.muted)}>
            {t('common.loading', { defaultValue: '' })}
          </p>
        )}

        {!isLoading && backups.length === 0 && (
          <p className={cn(colors.text.muted)}>{t('backup.list.empty')}</p>
        )}

        {!isLoading && backups.length > 0 && (
          <ul className="space-y-3">
            {backups.map(backup => (
              <li
                key={backup.id}
                className={cn(
                  'rounded-lg border p-4 space-y-2',
                  colors.bg.card,
                )}
              >
                {/* Header: ID + type badge */}
                <header className="flex items-center justify-between">
                  <span className="font-mono text-sm">{backup.id}</span>
                  <Badge variant={backup.type === 'full' ? 'default' : 'secondary'}>
                    {t(`backup.list.type.${backup.type}`)}
                  </Badge>
                </header>

                {/* Metadata grid */}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className={cn(colors.text.muted)}>{t('backup.list.createdAt')}</dt>
                  <dd>{formatDate(backup.createdAt)}</dd>

                  <dt className={cn(colors.text.muted)}>{t('backup.list.documents')}</dt>
                  <dd>{backup.totalDocuments.toLocaleString()}</dd>

                  <dt className={cn(colors.text.muted)}>{t('backup.list.collections')}</dt>
                  <dd>{backup.collections.length}</dd>

                  <dt className={cn(colors.text.muted)}>{t('backup.list.subcollections')}</dt>
                  <dd>{backup.subcollections.length}</dd>

                  <dt className={cn(colors.text.muted)}>{t('backup.list.storageFiles')}</dt>
                  <dd>{backup.totalStorageFiles.toLocaleString()}</dd>

                  <dt className={cn(colors.text.muted)}>{t('backup.list.storageSize')}</dt>
                  <dd>{formatBytes(backup.totalStorageBytes)}</dd>

                  <dt className={cn(colors.text.muted)}>{t('backup.list.duration')}</dt>
                  <dd>{formatDuration(backup.durationMs)}</dd>

                  {backup.parentBackupId && (
                    <>
                      <dt className={cn(colors.text.muted)}>{t('backup.list.parent')}</dt>
                      <dd className="font-mono text-xs">{backup.parentBackupId}</dd>
                    </>
                  )}
                </dl>

                {/* Warnings */}
                {backup.warnings.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-amber-600">
                      {t('backup.list.warnings')} ({backup.warnings.length})
                    </summary>
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {backup.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Actions */}
                <footer className="flex justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectForRestore(backup.id)}
                  >
                    {t('backup.list.selectForRestore')}
                  </Button>
                </footer>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
