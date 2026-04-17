/**
 * =============================================================================
 * BACKUP ACTIONS CARD — ADR-313 Admin UI
 * =============================================================================
 *
 * Trigger full and incremental backups.
 * Buttons disabled when backup is in progress.
 *
 * @module components/admin/backup/BackupActionsCard
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { BackupManifest } from '@/services/backup/backup-manifest.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BackupActionsCardProps {
  backups: BackupManifest[];
  isBackingUp: boolean;
  error: string | null;
  lastResult: string | null;
  onTriggerFull: () => void;
  onTriggerIncremental: (parentBackupId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BackupActionsCard({
  backups,
  isBackingUp,
  error,
  lastResult,
  onTriggerFull,
  onTriggerIncremental,
}: BackupActionsCardProps) {
  const { t } = useTranslation(['admin', 'common']);
  const [selectedParentId, setSelectedParentId] = useState<string>('');

  const latestFullBackup = backups.find(b => b.type === 'full');

  const handleIncremental = () => {
    const parentId = selectedParentId || latestFullBackup?.id;
    if (parentId) {
      onTriggerIncremental(parentId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('backup.title')}</CardTitle>
        <CardDescription>{t('backup.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success */}
        {lastResult && (
          <Alert>
            <AlertDescription>{lastResult}</AlertDescription>
          </Alert>
        )}

        {/* Action buttons */}
        <nav className="flex flex-wrap gap-3">
          <Button
            onClick={onTriggerFull}
            disabled={isBackingUp}
          >
            {t('backup.actions.triggerFull')}
          </Button>

          <div className="flex items-center gap-2">
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={selectedParentId}
              onChange={e => setSelectedParentId(e.target.value)}
              disabled={isBackingUp || backups.length === 0}
              aria-label={t('backup.actions.selectParentBackup')}
            >
              <option value="">
                {latestFullBackup
                  ? `${latestFullBackup.id} (latest)`
                  : t('backup.actions.selectParentBackup')
                }
              </option>
              {backups.map(b => (
                <option key={b.id} value={b.id}>
                  {b.id} ({b.type})
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={handleIncremental}
              disabled={isBackingUp || (!selectedParentId && !latestFullBackup)}
            >
              {t('backup.actions.triggerIncremental')}
            </Button>
          </div>
        </nav>
      </CardContent>
    </Card>
  );
}
