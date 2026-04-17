/**
 * =============================================================================
 * BACKUP SCHEDULER SERVICE — ADR-313 Phase 2
 * =============================================================================
 *
 * Orchestrates scheduled backups: config check, execution, retention cleanup.
 *
 * Google-level patterns:
 * - Config-driven: reads BackupConfig from Firestore system/backup_config
 * - Retention policy: keeps N most recent backups, deletes oldest
 * - Idempotent: safe to call multiple times (checks lastBackupAt)
 * - Separation of concerns: scheduler orchestrates, BackupService exports,
 *   BackupGcsService persists, this service manages lifecycle
 *
 * SSoT:
 * - BackupConfig type from backup-manifest.types.ts
 * - getAdminFirestore() from firebaseAdmin
 * - BackupService / BackupGcsService for actual work
 *
 * @module services/backup/backup-scheduler.service
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 2
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { BackupService } from './backup.service';
import { BackupGcsService } from './backup-gcs.service';
import { IncrementalBackupService } from './incremental-backup.service';

import type { Firestore } from 'firebase-admin/firestore';
import type { BackupConfig, StatusCallback } from './backup-manifest.types';

const logger = createModuleLogger('BackupScheduler');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Firestore path for backup config */
const BACKUP_CONFIG_PATH = 'system/backup_config';

/** Firestore path for backup status */
const BACKUP_STATUS_PATH = 'system/backup_status';

/** Minimum hours between scheduled backups (prevent double-trigger) */
const MIN_BACKUP_INTERVAL_HOURS = 20;

/** Default retention count if not configured */
const DEFAULT_RETENTION_COUNT = 7;

/** Default days between full backups (incremental on other days) */
const DEFAULT_FULL_BACKUP_INTERVAL_DAYS = 7;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduledBackupResult {
  executed: boolean;
  reason: string;
  backupId?: string;
  totalDocuments?: number;
  totalStorageFiles?: number;
  durationMs?: number;
  retentionDeleted?: number;
}

// ---------------------------------------------------------------------------
// BackupSchedulerService
// ---------------------------------------------------------------------------

export class BackupSchedulerService {
  private db: Firestore;

  constructor() {
    this.db = getAdminFirestore();
  }

  /**
   * Read backup config from Firestore. Returns defaults if not configured.
   */
  async getConfig(): Promise<BackupConfig> {
    const doc = await this.db.doc(BACKUP_CONFIG_PATH).get();

    if (!doc.exists) {
      logger.info('No backup config found — using defaults');
      return {
        scheduleEnabled: false,
        scheduleCron: '0 1 * * *',
        retentionCount: DEFAULT_RETENTION_COUNT,
        bucketName: `${process.env.FIREBASE_PROJECT_ID ?? 'pagonis-87766'}-backups`,
      };
    }

    return doc.data() as BackupConfig;
  }

  /**
   * Check if enough time has passed since last backup.
   * Prevents double-trigger if cron fires twice.
   */
  private isBackupDue(config: BackupConfig): boolean {
    if (!config.lastBackupAt) return true;

    const lastBackup = new Date(config.lastBackupAt).getTime();
    const hoursSince = (Date.now() - lastBackup) / (1000 * 60 * 60);

    if (hoursSince < MIN_BACKUP_INTERVAL_HOURS) {
      logger.info(`Last backup ${hoursSince.toFixed(1)}h ago — too recent, skipping`);
      return false;
    }

    return true;
  }

  /**
   * Delete old backups exceeding retention count.
   * Keeps the N most recent backups (sorted by backup ID which is chronological).
   */
  async enforceRetention(
    gcsService: BackupGcsService,
    retentionCount: number,
  ): Promise<number> {
    const backupIds = await gcsService.listBackups();

    if (backupIds.length <= retentionCount) {
      logger.info(`${backupIds.length} backups exist, retention=${retentionCount} — no cleanup needed`);
      return 0;
    }

    // backupIds are sorted newest-first by listBackups()
    const toDelete = backupIds.slice(retentionCount);
    let deleted = 0;

    for (const backupId of toDelete) {
      try {
        await gcsService.deleteBackup(backupId);
        deleted++;
        logger.info(`Retention: deleted backup ${backupId}`);
      } catch (error) {
        logger.error(`Retention: failed to delete ${backupId}: ${getErrorMessage(error)}`);
      }
    }

    logger.info(`Retention cleanup: deleted ${deleted}/${toDelete.length} old backups`);
    return deleted;
  }

  /**
   * Determine if an incremental backup should be used instead of full.
   *
   * Strategy:
   * - If incrementalEnabled is false → full
   * - If no lastBackupId → full (first backup ever)
   * - If last full backup was > fullBackupIntervalDays ago → full
   * - Otherwise → incremental
   */
  private async shouldUseIncremental(
    config: BackupConfig,
    gcsService: BackupGcsService,
  ): Promise<boolean> {
    if (!config.incrementalEnabled) return false;
    if (!config.lastBackupId) return false;

    try {
      // Find the most recent full backup to check interval
      const backupIds = await gcsService.listBackups();
      const intervalDays = config.fullBackupIntervalDays ?? DEFAULT_FULL_BACKUP_INTERVAL_DAYS;

      for (const bid of backupIds) {
        const manifest = await gcsService.readManifest(bid);
        if (manifest.type === 'full') {
          const fullBackupAge = Date.now() - new Date(manifest.createdAt).getTime();
          const fullBackupDays = fullBackupAge / (1000 * 60 * 60 * 24);

          if (fullBackupDays >= intervalDays) {
            logger.info(
              `Last full backup ${fullBackupDays.toFixed(1)} days ago ` +
              `(interval: ${intervalDays}) — forcing full backup`,
            );
            return false;
          }

          logger.info(
            `Last full backup ${fullBackupDays.toFixed(1)} days ago ` +
            `(interval: ${intervalDays}) — using incremental`,
          );
          return true;
        }
      }

      // No full backup found — force full
      return false;
    } catch (error) {
      logger.warn(`Failed to check incremental eligibility: ${getErrorMessage(error)} — falling back to full`);
      return false;
    }
  }

  /**
   * Update backup config in Firestore after successful backup.
   */
  private async updateConfigAfterBackup(
    backupId: string,
  ): Promise<void> {
    await this.db.doc(BACKUP_CONFIG_PATH).set(
      {
        lastBackupId: backupId,
        lastBackupAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  /**
   * Execute a scheduled backup if conditions are met.
   *
   * Checks:
   * 1. scheduleEnabled === true
   * 2. Enough time since last backup (MIN_BACKUP_INTERVAL_HOURS)
   *
   * Then: full backup → write to GCS → enforce retention → update config.
   */
  async executeScheduledBackup(): Promise<ScheduledBackupResult> {
    const config = await this.getConfig();

    // Check 1: enabled
    if (!config.scheduleEnabled) {
      return { executed: false, reason: 'Scheduled backups disabled in config' };
    }

    // Check 2: not too recent
    if (!this.isBackupDue(config)) {
      return { executed: false, reason: 'Last backup too recent — skipping' };
    }

    logger.info('Scheduled backup starting...');

    const gcsService = new BackupGcsService(config.bucketName);

    // Progress callback → Firestore status
    const updateStatus: StatusCallback = async (status) => {
      try {
        await this.db.doc(BACKUP_STATUS_PATH).set(
          { ...status, updatedAt: new Date().toISOString() },
          { merge: true },
        );
      } catch (error) {
        logger.warn(`Failed to update status: ${getErrorMessage(error)}`);
      }
    };

    // Decide: full or incremental
    const useIncremental = await this.shouldUseIncremental(config, gcsService);

    let finalManifest;

    if (useIncremental && config.lastBackupId) {
      logger.info(`Running incremental backup (parent: ${config.lastBackupId})`);
      const incrementalService = new IncrementalBackupService();

      const { manifest, files } = await incrementalService.executeIncrementalBackup(
        config.lastBackupId,
        'scheduled-cron',
        gcsService,
        updateStatus,
      );

      finalManifest = await gcsService.writeFullBackup(manifest, files);
    } else {
      logger.info('Running full backup');
      const backupService = new BackupService();

      const { manifest, files } = await backupService.executeFullBackup(
        'scheduled-cron',
        updateStatus,
        gcsService,
      );

      finalManifest = await gcsService.writeFullBackup(manifest, files);
    }

    // Update config
    await this.updateConfigAfterBackup(finalManifest.id);

    // Enforce retention
    const retentionDeleted = await this.enforceRetention(
      gcsService,
      config.retentionCount || DEFAULT_RETENTION_COUNT,
    );

    logger.info(
      `Scheduled backup completed: ${finalManifest.id} (${finalManifest.type}) — ` +
      `${finalManifest.totalDocuments} docs, ${finalManifest.totalStorageFiles} files, ` +
      `${retentionDeleted} old backups deleted`,
    );

    return {
      executed: true,
      reason: `Scheduled ${finalManifest.type} backup completed successfully`,
      backupId: finalManifest.id,
      totalDocuments: finalManifest.totalDocuments,
      totalStorageFiles: finalManifest.totalStorageFiles,
      durationMs: finalManifest.durationMs,
      retentionDeleted,
    };
  }
}
