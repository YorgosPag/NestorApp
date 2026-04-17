/**
 * =============================================================================
 * BACKUP ACTIONS CARD — ADR-313 Admin UI
 * =============================================================================
 *
 * Trigger full and incremental backups.
 * Buttons disabled when backup is in progress.
 * Incremental section hidden when no backups exist.
 *
 * @module components/admin/backup/BackupActionsCard
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

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
  const colors = useSemanticColors();

  const latestFullBackup = backups.find(b => b.type === 'full');
  const defaultParentId = latestFullBackup?.id ?? backups[0]?.id ?? '';
  const [selectedParentId, setSelectedParentId] = useState<string>(defaultParentId);

  const handleIncremental = () => {
    const parentId = selectedParentId || defaultParentId;
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

        {/* Full backup */}
        <nav className="flex flex-wrap items-start gap-4">
          <Button
            onClick={onTriggerFull}
            disabled={isBackingUp}
          >
            {t('backup.actions.triggerFull')}
          </Button>

          {/* Incremental — only visible when backups exist */}
          {backups.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                value={selectedParentId || defaultParentId}
                onValueChange={setSelectedParentId}
                disabled={isBackingUp}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={t('backup.actions.selectParentBackup')} />
                </SelectTrigger>
                <SelectContent>
                  {backups.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.id} ({t(`backup.list.type.${b.type}`)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                onClick={handleIncremental}
                disabled={isBackingUp}
              >
                {t('backup.actions.triggerIncremental')}
              </Button>
            </div>
          )}
        </nav>

        {/* Hint when no backups */}
        {backups.length === 0 && (
          <p className={cn('text-sm', colors.text.muted)}>
            {t('backup.list.empty')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
