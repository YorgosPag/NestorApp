/**
 * =============================================================================
 * BACKUP STATUS CARD — ADR-313 Admin UI
 * =============================================================================
 *
 * Live progress display for backup and restore operations.
 * Shows phase badge, progress bar, current collection, doc count.
 *
 * @module components/admin/backup/BackupStatusCard
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

import type { BackupStatus, RestoreStatus } from '@/services/backup/backup-manifest.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BackupStatusCardProps {
  backupStatus: BackupStatus | null;
  restoreStatus: RestoreStatus | null;
  isBackingUp: boolean;
  isRestoring: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PhaseKey = BackupStatus['phase'] | RestoreStatus['phase'];

function getPhaseVariant(phase: PhaseKey): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (phase === 'completed') return 'default';
  if (phase === 'failed') return 'destructive';
  return 'secondary';
}

function computeProgress(processed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((processed / total) * 100);
}

function formatDuration(startedAt: string): string {
  const elapsed = Date.now() - new Date(startedAt).getTime();
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BackupStatusCard({
  backupStatus,
  restoreStatus,
  isBackingUp,
  isRestoring,
}: BackupStatusCardProps) {
  const { t } = useTranslation(['admin', 'common']);
  const colors = useSemanticColors();

  const hasActiveOp = isBackingUp || isRestoring;
  const activeStatus = isRestoring ? restoreStatus : backupStatus;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('backup.status.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!activeStatus && !hasActiveOp && (
          <p className={cn(colors.text.muted)}>
            {t('backup.status.noActiveOperation')}
          </p>
        )}

        {activeStatus && (
          <section className="space-y-4">
            {/* Phase badge + type */}
            <header className="flex items-center gap-3">
              <Badge variant={getPhaseVariant(activeStatus.phase)}>
                {t(`backup.status.phase.${activeStatus.phase}`)}
              </Badge>
              <span className={cn('text-sm', colors.text.muted)}>
                {isRestoring
                  ? t('backup.status.restoreInProgress')
                  : t('backup.status.backupInProgress')
                }
              </span>
            </header>

            {/* Progress bar */}
            {'processedCollections' in activeStatus && activeStatus.totalCollections > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('backup.status.processedCollections')}</span>
                  <span>
                    {activeStatus.processedCollections} / {activeStatus.totalCollections}
                  </span>
                </div>
                <Progress
                  value={computeProgress(
                    activeStatus.processedCollections,
                    activeStatus.totalCollections,
                  )}
                />
              </div>
            )}

            {/* Current collection */}
            {activeStatus.currentCollection && (
              <div className="flex justify-between text-sm">
                <span className={cn(colors.text.muted)}>
                  {t('backup.status.currentCollection')}
                </span>
                <span className="font-mono">{activeStatus.currentCollection}</span>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {'documentsExported' in activeStatus && (
                <div className="flex justify-between">
                  <span className={cn(colors.text.muted)}>
                    {t('backup.status.documentsExported')}
                  </span>
                  <span className="font-mono">
                    {(activeStatus as BackupStatus).documentsExported.toLocaleString()}
                  </span>
                </div>
              )}
              {'storageFilesExported' in activeStatus && (
                <div className="flex justify-between">
                  <span className={cn(colors.text.muted)}>
                    {t('backup.status.storageFilesExported')}
                  </span>
                  <span className="font-mono">
                    {(activeStatus as BackupStatus).storageFilesExported.toLocaleString()}
                  </span>
                </div>
              )}
              {'documentsRestored' in activeStatus && (
                <>
                  <div className="flex justify-between">
                    <span className={cn(colors.text.muted)}>
                      {t('backup.status.documentsRestored')}
                    </span>
                    <span className="font-mono">
                      {(activeStatus as RestoreStatus).documentsRestored.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={cn(colors.text.muted)}>
                      {t('backup.status.documentsSkipped')}
                    </span>
                    <span className="font-mono">
                      {(activeStatus as RestoreStatus).documentsSkipped.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Elapsed time */}
            {activeStatus.startedAt && !activeStatus.completedAt && (
              <p className={cn('text-sm', colors.text.muted)}>
                {t('backup.status.startedAt')}: {formatDuration(activeStatus.startedAt)}
              </p>
            )}

            {/* Error */}
            {activeStatus.error && (
              <Alert variant="destructive">
                <AlertDescription>{activeStatus.error}</AlertDescription>
              </Alert>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
