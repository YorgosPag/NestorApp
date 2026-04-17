/**
 * =============================================================================
 * BACKUP CONFIG SECTION — ADR-313 Admin UI
 * =============================================================================
 *
 * Form for scheduler configuration: enable/disable, cron, retention, incremental.
 *
 * @module components/admin/backup/BackupConfigSection
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

import type { BackupConfig } from '@/services/backup/backup-manifest.types';
import type { EditableBackupConfig } from './useBackupConfigState';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BackupConfigSectionProps {
  config: BackupConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  saved: boolean;
  error: string | null;
  onSave: (updates: Partial<EditableBackupConfig>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BackupConfigSection({
  config,
  isLoading,
  isSaving,
  saved,
  error,
  onSave,
}: BackupConfigSectionProps) {
  const { t } = useTranslation(['admin', 'common']);
  const colors = useSemanticColors();

  // Local form state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleCron, setScheduleCron] = useState('0 1 * * *');
  const [retentionCount, setRetentionCount] = useState(7);
  const [incrementalEnabled, setIncrementalEnabled] = useState(false);
  const [fullBackupIntervalDays, setFullBackupIntervalDays] = useState(7);

  // Sync from server config
  useEffect(() => {
    if (config) {
      setScheduleEnabled(config.scheduleEnabled);
      setScheduleCron(config.scheduleCron);
      setRetentionCount(config.retentionCount);
      setIncrementalEnabled(config.incrementalEnabled ?? false);
      setFullBackupIntervalDays(config.fullBackupIntervalDays ?? 7);
    }
  }, [config]);

  const handleSave = () => {
    onSave({
      scheduleEnabled,
      scheduleCron,
      retentionCount,
      incrementalEnabled,
      fullBackupIntervalDays,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className={cn('animate-pulse text-center', colors.text.muted)}>
            {t('common.loading', { defaultValue: '' })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('backup.config.title')}</CardTitle>
        <CardDescription>{t('backup.config.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Error / Success */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {saved && (
          <Alert>
            <AlertDescription>{t('backup.config.saved')}</AlertDescription>
          </Alert>
        )}

        {/* Schedule enabled */}
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t('backup.config.scheduleEnabled')}</p>
            <p className={cn('text-xs', colors.text.muted)}>
              {t('backup.config.scheduleEnabledDesc')}
            </p>
          </div>
          <Switch
            checked={scheduleEnabled}
            onCheckedChange={setScheduleEnabled}
          />
        </label>

        {/* Cron schedule */}
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t('backup.config.scheduleCron')}</span>
          <input
            type="text"
            className="w-full rounded-md border px-3 py-2 font-mono text-sm"
            value={scheduleCron}
            onChange={e => setScheduleCron(e.target.value)}
            placeholder="0 1 * * *"
          />
        </label>

        {/* Retention count */}
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t('backup.config.retentionCount')}</span>
          <p className={cn('text-xs', colors.text.muted)}>
            {t('backup.config.retentionCountDesc')}
          </p>
          <input
            type="number"
            className="w-32 rounded-md border px-3 py-2 text-sm"
            value={retentionCount}
            onChange={e => setRetentionCount(parseInt(e.target.value, 10) || 1)}
            min={1}
            max={100}
          />
        </label>

        {/* Incremental enabled */}
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t('backup.config.incrementalEnabled')}</p>
            <p className={cn('text-xs', colors.text.muted)}>
              {t('backup.config.incrementalEnabledDesc')}
            </p>
          </div>
          <Switch
            checked={incrementalEnabled}
            onCheckedChange={setIncrementalEnabled}
          />
        </label>

        {/* Full backup interval */}
        {incrementalEnabled && (
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t('backup.config.fullBackupIntervalDays')}</span>
            <p className={cn('text-xs', colors.text.muted)}>
              {t('backup.config.fullBackupIntervalDaysDesc')}
            </p>
            <input
              type="number"
              className="w-32 rounded-md border px-3 py-2 text-sm"
              value={fullBackupIntervalDays}
              onChange={e => setFullBackupIntervalDays(parseInt(e.target.value, 10) || 1)}
              min={1}
              max={90}
            />
          </label>
        )}

        {/* Last backup info */}
        {config?.lastBackupId && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className={cn(colors.text.muted)}>{t('backup.config.lastBackupId')}</dt>
            <dd className="font-mono text-xs">{config.lastBackupId}</dd>
            <dt className={cn(colors.text.muted)}>{t('backup.config.lastBackupAt')}</dt>
            <dd>{config.lastBackupAt ? new Date(config.lastBackupAt).toLocaleString() : t('backup.config.never')}</dd>
          </dl>
        )}

        {/* Save button */}
        <footer>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving
              ? t('common.saving', { defaultValue: '' })
              : t('backup.config.save')
            }
          </Button>
        </footer>
      </CardContent>
    </Card>
  );
}
