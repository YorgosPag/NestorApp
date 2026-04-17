/**
 * =============================================================================
 * BACKUP PAGE CONTENT — ADR-313 Admin UI
 * =============================================================================
 *
 * Main orchestrator for the Backup & Restore admin page.
 * Renders 4 tabs: Backups, Restore, Status, Config.
 * Each tab delegates to a sub-component with dedicated state hook.
 *
 * @module components/admin/pages/BackupPageContent
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

import { useBackupState } from '@/components/admin/backup/useBackupState';
import { useRestoreState } from '@/components/admin/backup/useRestoreState';
import { useBackupConfigState } from '@/components/admin/backup/useBackupConfigState';

import { BackupActionsCard } from '@/components/admin/backup/BackupActionsCard';
import { BackupListSection } from '@/components/admin/backup/BackupListSection';
import { BackupStatusCard } from '@/components/admin/backup/BackupStatusCard';
import { RestoreSection } from '@/components/admin/backup/RestoreSection';
import { BackupConfigSection } from '@/components/admin/backup/BackupConfigSection';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BackupPageContent() {
  const { t } = useTranslation(['admin', 'common']);
  const colors = useSemanticColors();

  const backup = useBackupState();
  const restore = useRestoreState();
  const config = useBackupConfigState();

  const handleSelectForRestore = (backupId: string) => {
    restore.setSelectedBackupId(backupId);
  };

  return (
    <main className="space-y-6 p-6">
      {/* Page header */}
      <header>
        <h1 className="text-2xl font-bold">{t('backup.title')}</h1>
        <p className={cn('mt-1', colors.text.muted)}>{t('backup.description')}</p>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="backups">
        <TabsList>
          <TabsTrigger value="backups">{t('backup.tabs.backups')}</TabsTrigger>
          <TabsTrigger value="restore">{t('backup.tabs.restore')}</TabsTrigger>
          <TabsTrigger value="status">{t('backup.tabs.status')}</TabsTrigger>
          <TabsTrigger value="config">{t('backup.tabs.config')}</TabsTrigger>
        </TabsList>

        {/* Backups tab */}
        <TabsContent value="backups" className="space-y-4">
          <BackupActionsCard
            backups={backup.backups}
            isBackingUp={backup.isBackingUp}
            error={backup.error}
            lastResult={backup.lastResult}
            onTriggerFull={backup.triggerFullBackup}
            onTriggerIncremental={backup.triggerIncrementalBackup}
          />
          <BackupListSection
            backups={backup.backups}
            isLoading={backup.isLoadingList}
            onSelectForRestore={handleSelectForRestore}
            onRefresh={backup.fetchBackups}
          />
        </TabsContent>

        {/* Restore tab */}
        <TabsContent value="restore">
          <RestoreSection
            backups={backup.backups}
            selectedBackupId={restore.selectedBackupId}
            onSelectBackup={id => restore.setSelectedBackupId(id)}
            preview={restore.preview}
            restoreOptions={restore.restoreOptions}
            onOptionsChange={restore.setRestoreOptions}
            isPreviewLoading={restore.isPreviewLoading}
            isRestoring={restore.isRestoring}
            error={restore.error}
            lastResult={restore.lastResult}
            onPreview={restore.fetchPreview}
            onExecute={restore.executeRestore}
          />
        </TabsContent>

        {/* Status tab */}
        <TabsContent value="status">
          <BackupStatusCard
            backupStatus={backup.backupStatus}
            restoreStatus={restore.restoreStatus}
            isBackingUp={backup.isBackingUp}
            isRestoring={restore.isRestoring}
          />
        </TabsContent>

        {/* Config tab */}
        <TabsContent value="config">
          <BackupConfigSection
            config={config.config}
            isLoading={config.isLoading}
            isSaving={config.isSaving}
            saved={config.saved}
            error={config.error}
            onSave={config.saveConfig}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}
