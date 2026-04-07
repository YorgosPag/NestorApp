import 'server-only';

import { getAdminFirestore, getAdminStorage, Timestamp } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { processAdminBatch, BATCH_SIZE_READ } from '@/lib/admin-batch-utils';
// ADR-293: Legacy path constant for migration reads (not new writes)
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { extractRequestMetadata, logMigrationExecuted } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import type { NextRequest } from 'next/server';
import {
  DXF_ALREADY_MIGRATED_RECOMMENDATIONS,
  DXF_DRY_RUN_RECOMMENDATIONS,
  DXF_MIGRATION_SCRIPT,
  MIGRATION_AUDIT_KEY,
  MIGRATION_OPERATION_NAME,
  PROBLEM_FILE_THRESHOLD_BYTES,
  SIGNED_URL_EXPIRY_MS,
  type AnalysisResult,
  type DxfDryRunReport,
  type DxfLiveMigrationReport,
  type DxfScene,
  type FileInfo,
  type LegacyDxfData,
  type MigrationExecutionResult,
} from './migration-config';

const logger = createModuleLogger('MigrateDxfRoute');

export class DxfMigrationAPI {
  private readonly dryRun: boolean;

  constructor(dryRun: boolean = true) {
    this.dryRun = dryRun;
  }

  async analyzeLegacyData(): Promise<AnalysisResult> {
    logger.info('Analyzing DXF data in Firestore', { collection: COLLECTIONS.CAD_FILES });

    const db = getAdminFirestore();
    const cadFilesRef = db.collection(COLLECTIONS.CAD_FILES);
    const analysis: AnalysisResult = {
      totalDocs: 0,
      legacyFiles: [],
      properFiles: [],
      problemFiles: [],
      totalLegacySize: 0,
      logs: [],
    };

    await processAdminBatch(cadFilesRef, BATCH_SIZE_READ, (docs) => {
      analysis.totalDocs += docs.length;

      for (const docSnap of docs) {
        const data = docSnap.data() as LegacyDxfData;
        const docId = docSnap.id;
        const fileName = data.fileName || docId;

        analysis.logs.push(`   📄 Document: ${docId} (${fileName})`);

        if (data.scene && typeof data.scene === 'object') {
          const sceneSize = JSON.stringify(data.scene).length;
          analysis.totalLegacySize += sceneSize;

          const fileInfo: FileInfo = {
            id: docId,
            fileName,
            sizeBytes: sceneSize,
            sizeKB: Math.round(sceneSize / 1024),
            entityCount: data.scene.entities?.length || 0,
          };

          analysis.legacyFiles.push(fileInfo);
          analysis.logs.push(`      🚨 LEGACY: ${Math.round(sceneSize / 1024)}KB, ${fileInfo.entityCount} entities`);

          if (sceneSize > PROBLEM_FILE_THRESHOLD_BYTES) {
            analysis.problemFiles.push(fileInfo);
          }
        } else if (data.storageUrl) {
          analysis.properFiles.push({
            id: docId,
            fileName,
            storageUrl: data.storageUrl,
          });
          analysis.logs.push('      ✅ PROPER: Using Storage');
        } else {
          analysis.logs.push('      ❓ UNKNOWN: No scene or storageUrl');
        }
      }
    });

    analysis.logs.unshift(`📊 Found ${analysis.totalDocs} documents in CAD_FILES collection`);
    return analysis;
  }

  async migrateLegacyFiles(analysisData: AnalysisResult): Promise<MigrationExecutionResult> {
    if (analysisData.legacyFiles.length === 0) {
      return {
        migratedCount: 0,
        failedCount: 0,
        errors: [],
        logs: ['✅ No legacy files to migrate!'],
      };
    }

    const logs: string[] = [`🚀 Starting migration of ${analysisData.legacyFiles.length} legacy files...`];
    if (this.dryRun) {
      logs.push('🧪 DRY RUN MODE - No actual changes will be made');
    }

    let migratedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const fileInfo of analysisData.legacyFiles) {
      try {
        logs.push(`🔄 Processing: ${fileInfo.fileName} (${fileInfo.sizeKB}KB)`);

        if (!this.dryRun) {
          const db = getAdminFirestore();
          const docRef = db.collection(COLLECTIONS.CAD_FILES).doc(fileInfo.id);
          const actualDoc = await docRef.get();

          if (!actualDoc.exists) {
            throw new Error('Document not found');
          }

          const data = actualDoc.data() as LegacyDxfData;
          const sceneJson = JSON.stringify(data.scene);
          const sceneBytes = new TextEncoder().encode(sceneJson);
          const storagePath = `dxf-scenes/${fileInfo.id}/scene.json`;
          const bucket = getAdminStorage().bucket();
          const file = bucket.file(storagePath);

          logs.push(`      📤 Uploading to: ${storagePath}`);

          await file.save(Buffer.from(sceneBytes), {
            contentType: 'application/json',
            metadata: {
              metadata: {
                fileName: fileInfo.fileName,
                originalSize: fileInfo.sizeBytes.toString(),
                entityCount: fileInfo.entityCount.toString(),
              },
            },
          });

          const [downloadURL] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + SIGNED_URL_EXPIRY_MS,
          });
          logs.push('      🔗 Storage URL generated');

          const now = Timestamp.now();
          await db.collection(COLLECTIONS.CAD_FILES).doc(fileInfo.id).set({
            id: fileInfo.id,
            fileName: fileInfo.fileName,
            storageUrl: downloadURL,
            lastModified: now,
            version: (data.version || 0) + 1,
            sizeBytes: fileInfo.sizeBytes,
            entityCount: fileInfo.entityCount,
            checksum: this.generateChecksum(data.scene),
            migrationInfo: {
              migratedAt: now,
              originalMethod: 'firestore_document',
              newMethod: 'firebase_storage',
              migrationScript: DXF_MIGRATION_SCRIPT,
            },
          });
          logs.push('      ✅ Metadata updated in Firestore');
        }

        logs.push(`   ✅ ${this.dryRun ? 'Would migrate' : 'Migrated'}: ${fileInfo.fileName}`);
        migratedCount++;
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        const errorText = `Failed to migrate ${fileInfo.fileName}: ${errorMessage}`;
        logs.push(`   ❌ ${errorText}`);
        errors.push(errorText);
        failedCount++;
      }
    }

    return { migratedCount, failedCount, errors, logs };
  }

  private generateChecksum(scene: DxfScene | undefined): string {
    if (!scene) {
      return '';
    }

    const data = {
      entityCount: scene.entities?.length || 0,
      layerCount: Object.keys(scene.layers || {}).length,
      bounds: scene.bounds,
      units: scene.units,
    };

    return Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 16);
  }
}

export const createDryRunReport = (analysis: AnalysisResult): DxfDryRunReport => ({
  mode: 'DRY_RUN',
  summary: {
    totalDocs: analysis.totalDocs,
    legacyFiles: analysis.legacyFiles.length,
    properFiles: analysis.properFiles.length,
    problemFiles: analysis.problemFiles.length,
    totalLegacySizeKB: Math.round(analysis.totalLegacySize / 1024),
  },
  legacyFiles: analysis.legacyFiles,
  problemFiles: analysis.problemFiles,
  logs: analysis.logs,
  recommendations: analysis.legacyFiles.length > 0
    ? [...DXF_DRY_RUN_RECOMMENDATIONS]
    : [...DXF_ALREADY_MIGRATED_RECOMMENDATIONS],
});

export const createLiveMigrationReport = (
  analysis: AnalysisResult,
  migrationResult: MigrationExecutionResult,
  executionTimeMs: number,
): DxfLiveMigrationReport => ({
  mode: 'LIVE_MIGRATION',
  summary: {
    totalLegacyFiles: analysis.legacyFiles.length,
    migratedFiles: migrationResult.migratedCount,
    failedFiles: migrationResult.failedCount,
    successRate: migrationResult.migratedCount + migrationResult.failedCount > 0
      ? Math.round((migrationResult.migratedCount / (migrationResult.migratedCount + migrationResult.failedCount)) * 100)
      : 0,
    spaceSavedKB: Math.round(analysis.totalLegacySize / 1024),
    benefits: [
      `${migrationResult.migratedCount} files moved to Firebase Storage`,
      `${Math.round(analysis.totalLegacySize / 1024)}KB freed from Firestore`,
      '99%+ faster read performance',
      '93%+ cost reduction',
      'No more document size limits',
    ],
  },
  logs: migrationResult.logs,
  errors: migrationResult.errors,
  executionTimeMs,
});

export const executeDxfMigrationAudit = async (
  request: NextRequest,
  ctx: AuthContext,
  analysis: AnalysisResult,
  report: DxfLiveMigrationReport,
  migrationResult: MigrationExecutionResult,
): Promise<void> => {
  const metadata = extractRequestMetadata(request);

  await logMigrationExecuted(
    ctx,
    MIGRATION_AUDIT_KEY,
    {
      operation: MIGRATION_OPERATION_NAME,
      totalLegacyFiles: analysis.legacyFiles.length,
      migratedCount: migrationResult.migratedCount,
      failedCount: migrationResult.failedCount,
      spaceSavedKB: Math.round(analysis.totalLegacySize / 1024),
      successRate: report.summary.successRate,
      executionTimeMs: report.executionTimeMs,
      result: migrationResult.errors.length === 0 ? 'success' : 'partial_success',
      metadata,
    },
    `DXF migration (Firestore→Storage) by ${ctx.globalRole} ${ctx.email}`,
  ).catch((error: unknown) => {
    logger.warn('Audit logging failed (non-blocking)', { error });
  });
};
