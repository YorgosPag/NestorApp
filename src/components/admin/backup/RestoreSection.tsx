/**
 * =============================================================================
 * RESTORE SECTION — ADR-313 Admin UI
 * =============================================================================
 *
 * Backup selector, restore options form, preview/execute triggers.
 * Uses AlertDialog for destructive restore confirmation.
 *
 * @module components/admin/backup/RestoreSection
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { RestorePreviewTable } from './RestorePreviewTable';

import type { BackupManifest, RestorePreview, RestoreOptions } from '@/services/backup/backup-manifest.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RestoreSectionProps {
  backups: BackupManifest[];
  selectedBackupId: string | null;
  onSelectBackup: (backupId: string) => void;
  preview: RestorePreview | null;
  restoreOptions: RestoreOptions;
  onOptionsChange: (options: RestoreOptions) => void;
  isPreviewLoading: boolean;
  isRestoring: boolean;
  error: string | null;
  lastResult: string | null;
  onPreview: (backupId: string) => void;
  onExecute: (backupId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RestoreSection({
  backups,
  selectedBackupId,
  onSelectBackup,
  preview,
  restoreOptions,
  onOptionsChange,
  isPreviewLoading,
  isRestoring,
  error,
  lastResult,
  onPreview,
  onExecute,
}: RestoreSectionProps) {
  const { t } = useTranslation(['admin', 'common']);
  const colors = useSemanticColors();

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('backup.restore.title')}</CardTitle>
          <CardDescription>{t('backup.restore.selectBackup')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error / Success */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {lastResult && (
            <Alert>
              <AlertDescription>{lastResult}</AlertDescription>
            </Alert>
          )}

          {/* Backup selector */}
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={selectedBackupId ?? ''}
            onChange={e => onSelectBackup(e.target.value)}
            disabled={isRestoring}
            aria-label={t('backup.restore.selectBackup')}
          >
            <option value="">{t('backup.restore.selectBackup')}</option>
            {backups.map(b => (
              <option key={b.id} value={b.id}>
                {b.id} — {b.type} — {new Date(b.createdAt).toLocaleDateString()} ({b.totalDocuments.toLocaleString()} docs)
              </option>
            ))}
          </select>

          {/* Restore options */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t('backup.restore.options.title')}</legend>

            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t('backup.restore.options.skipImmutable')}</p>
                <p className={cn('text-xs', colors.text.muted)}>
                  {t('backup.restore.options.skipImmutableDesc')}
                </p>
              </div>
              <Switch
                checked={restoreOptions.skipImmutable ?? true}
                onCheckedChange={checked =>
                  onOptionsChange({ ...restoreOptions, skipImmutable: checked })
                }
                disabled={isRestoring}
              />
            </label>

            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t('backup.restore.options.mergeMode')}</p>
                <p className={cn('text-xs', colors.text.muted)}>
                  {t('backup.restore.options.mergeModeDesc')}
                </p>
              </div>
              <Switch
                checked={restoreOptions.mergeMode ?? true}
                onCheckedChange={checked =>
                  onOptionsChange({ ...restoreOptions, mergeMode: checked })
                }
                disabled={isRestoring}
              />
            </label>
          </fieldset>

          {/* Action buttons */}
          <nav className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => selectedBackupId && onPreview(selectedBackupId)}
              disabled={!selectedBackupId || isPreviewLoading || isRestoring}
            >
              {isPreviewLoading
                ? t('common.loading', { defaultValue: '' })
                : t('backup.restore.preview')
              }
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={!selectedBackupId || !preview || isRestoring}
                >
                  {t('backup.restore.execute')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('backup.restore.confirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('backup.restore.confirmExecute')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {preview && (
                  <p className="text-sm">
                    {preview.totalDocuments.toLocaleString()} docs —{' '}
                    {preview.totalNew.toLocaleString()} new,{' '}
                    {preview.totalUpdate.toLocaleString()} update,{' '}
                    {preview.totalSkip.toLocaleString()} skip
                  </p>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel', { defaultValue: '' })}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => selectedBackupId && onExecute(selectedBackupId)}
                  >
                    {t('backup.restore.execute')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </nav>
        </CardContent>
      </Card>

      {/* Preview table */}
      {preview && <RestorePreviewTable preview={preview} />}
    </section>
  );
}
