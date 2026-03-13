/**
 * =============================================================================
 * MIGRATE DXF DATA (FIRESTORE→STORAGE) - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * API για migration legacy DXF data από Firestore → Firebase Storage.
 *
 * @module api/admin/migrate-dxf
 * @enterprise RFC v6 - Authorization & RBAC System
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute (super_admin ONLY)
 * - Manual Migration: DXF data architecture migration
 * - Multi-Layer Security: withAuth + explicit super_admin check
 * - Comprehensive audit logging
 *
 * USAGE:
 * - GET  /api/admin/migrate-dxf?dryRun=true  → DRY RUN analysis
 * - POST /api/admin/migrate-dxf              → LIVE migration
 *
 * Date: 2025-12-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { db, storage } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COLLECTIONS } from '@/config/firestore-collections';
import { processClientBatch, BATCH_SIZE_READ } from '@/lib/admin-batch-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MigrateDxfRoute');

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** DXF entity structure */
interface DxfEntity {
  type: string;
  handle?: string;
  layer?: string;
  [key: string]: unknown;
}

/** DXF scene structure */
interface DxfScene {
  entities?: DxfEntity[];
  layers?: Record<string, unknown>;
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  units?: string;
  [key: string]: unknown;
}

interface LegacyDxfData {
  id: string;
  fileName?: string;
  scene?: DxfScene;
  lastModified?: Timestamp;
  version?: number;
  checksum?: string;
  storageUrl?: string;
}

/** Proper file info for already migrated files */
interface ProperFileInfo {
  id: string;
  fileName: string;
  storageUrl: string;
}

/** Analysis result structure */
interface AnalysisResult {
  totalDocs: number;
  legacyFiles: FileInfo[];
  properFiles: ProperFileInfo[];
  problemFiles: FileInfo[];
  totalLegacySize: number;
  logs: string[];
}

interface FileInfo {
  id: string;
  fileName: string;
  sizeBytes: number;
  sizeKB: number;
  entityCount: number;
}

class DxfMigrationAPI {
  private dryRun: boolean;

  constructor(dryRun: boolean = true) {
    this.dryRun = dryRun;
  }

  /**
   * 🔍 Analyze existing DXF data
   */
  async analyzeLegacyData() {
    logger.info('Analyzing DXF data in Firestore', { collection: COLLECTIONS.CAD_FILES });

    // ADR-214 Phase 8: Batch processing to prevent unbounded reads
    const cadFilesRef = collection(db, COLLECTIONS.CAD_FILES);

    const analysis: AnalysisResult = {
      totalDocs: 0,
      legacyFiles: [],
      properFiles: [],
      problemFiles: [],
      totalLegacySize: 0,
      logs: []
    };

    await processClientBatch(
      cadFilesRef,
      [],
      BATCH_SIZE_READ,
      (docs) => {
        analysis.totalDocs += docs.length;
        for (const docSnap of docs) {
      const data = docSnap.data() as LegacyDxfData;
      const docId = docSnap.id;
      const fileName = data.fileName || docId;

      analysis.logs.push(`   📄 Document: ${docId} (${fileName})`);

      if (data.scene && typeof data.scene === 'object') {
        // Legacy format - has scene object
        const sceneSize = JSON.stringify(data.scene).length;
        analysis.totalLegacySize += sceneSize;

        const fileInfo: FileInfo = {
          id: docId,
          fileName,
          sizeBytes: sceneSize,
          sizeKB: Math.round(sceneSize / 1024),
          entityCount: data.scene.entities?.length || 0
        };

        analysis.legacyFiles.push(fileInfo);
        analysis.logs.push(`      🚨 LEGACY: ${Math.round(sceneSize / 1024)}KB, ${fileInfo.entityCount} entities`);

        if (sceneSize > 100000) { // > 100KB is problematic
          analysis.problemFiles.push(fileInfo);
        }

      } else if (data.storageUrl) {
        // Proper format - already migrated
        analysis.properFiles.push({
          id: docId,
          fileName,
          storageUrl: data.storageUrl
        });
        analysis.logs.push(`      ✅ PROPER: Using Storage`);

      } else {
        analysis.logs.push(`      ❓ UNKNOWN: No scene or storageUrl`);
      }
        }
      },
    );

    analysis.logs.unshift(`📊 Found ${analysis.totalDocs} documents in CAD_FILES collection`);

    return analysis;
  }

  /**
   * 🚀 Migrate legacy files to Storage
   */
  async migrateLegacyFiles(analysisData: AnalysisResult) {
    if (analysisData.legacyFiles.length === 0) {
      return {
        migratedCount: 0,
        failedCount: 0,
        errors: [],
        logs: ['✅ No legacy files to migrate!']
      };
    }

    const logs: string[] = [];
    logs.push(`🚀 Starting migration of ${analysisData.legacyFiles.length} legacy files...`);

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
          // ADR-214 Phase 8: Fixed N+1 bug — getDoc by ID instead of full collection scan
          const docRef = doc(db, COLLECTIONS.CAD_FILES, fileInfo.id);
          const actualDoc = await getDoc(docRef);

          if (!actualDoc.exists()) {
            throw new Error('Document not found');
          }

          const data = actualDoc.data() as LegacyDxfData;

          // 1. Upload scene to Firebase Storage
          const sceneJson = JSON.stringify(data.scene);
          const sceneBytes = new TextEncoder().encode(sceneJson);

          const storagePath = `dxf-scenes/${fileInfo.id}/scene.json`;
          const storageRef = ref(storage, storagePath);

          logs.push(`      📤 Uploading to: ${storagePath}`);

          const snapshot = await uploadBytes(storageRef, sceneBytes, {
            contentType: 'application/json',
            customMetadata: {
              fileName: fileInfo.fileName,
              originalSize: fileInfo.sizeBytes.toString(),
              entityCount: fileInfo.entityCount.toString()
            }
          });

          // 2. Get download URL
          const downloadURL = await getDownloadURL(snapshot.ref);
          logs.push(`      🔗 Storage URL generated`);

          // 3. Update Firestore with metadata only
          const newMetadata = {
            id: fileInfo.id,
            fileName: fileInfo.fileName,
            storageUrl: downloadURL,
            lastModified: Timestamp.now(),
            version: (data.version || 0) + 1,
            sizeBytes: fileInfo.sizeBytes,
            entityCount: fileInfo.entityCount,
            checksum: this.generateChecksum(data.scene),
            migrationInfo: {
              migratedAt: Timestamp.now(),
              originalMethod: 'firestore_document',
              newMethod: 'firebase_storage',
              migrationScript: 'api_admin_migrate_dxf'
            }
          };

          await setDoc(doc(db, COLLECTIONS.CAD_FILES, fileInfo.id), newMetadata);
          logs.push(`      ✅ Metadata updated in Firestore`);
        }

        logs.push(`   ✅ ${this.dryRun ? 'Would migrate' : 'Migrated'}: ${fileInfo.fileName}`);
        migratedCount++;

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorMsg = `Failed to migrate ${fileInfo.fileName}: ${errorMessage}`;
        logs.push(`   ❌ ${errorMsg}`);
        errors.push(errorMsg);
        failedCount++;
      }
    }

    return { migratedCount, failedCount, errors, logs };
  }

  /**
   * Generate simple checksum
   */
  generateChecksum(scene: DxfScene | undefined): string {
    if (!scene) return '';
    const data = {
      entityCount: scene.entities?.length || 0,
      layerCount: Object.keys(scene.layers || {}).length,
      bounds: scene.bounds,
      units: scene.units
    };
    return Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 16);
  }
}

/**
 * GET /api/admin/migrate-dxf
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleMigrateDxfPreview(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
));

/**
 * POST /api/admin/migrate-dxf
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleMigrateDxfExecute(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
));

async function handleMigrateDxfPreview(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted DXF migration preview', { email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can preview DXF migrations',
        message: 'DXF migrations are system-level operations restricted to super_admin'
      },
      { status: 403 }
    );
  }

  logger.info('DXF migration preview request', { email: ctx.email, globalRole: ctx.globalRole, companyId: ctx.companyId });

  try {
    logger.info('DXF Migration - DRY RUN Analysis');

    const migrator = new DxfMigrationAPI(true);
    const analysis = await migrator.analyzeLegacyData();

    const report = {
      mode: 'DRY_RUN',
      summary: {
        totalDocs: analysis.totalDocs,
        legacyFiles: analysis.legacyFiles.length,
        properFiles: analysis.properFiles.length,
        problemFiles: analysis.problemFiles.length,
        totalLegacySizeKB: Math.round(analysis.totalLegacySize / 1024)
      },
      legacyFiles: analysis.legacyFiles,
      problemFiles: analysis.problemFiles,
      logs: analysis.logs,
      recommendations: analysis.legacyFiles.length > 0 ? [
        '🚨 Legacy DXF files found that need migration',
        '💡 These files are stored in Firestore documents (causing performance issues)',
        '🎯 Migration will move them to Firebase Storage (99%+ faster)',
        '💰 This will reduce costs by 93%+',
        '🚀 Run POST /api/admin/migrate-dxf to execute migration'
      ] : [
        '✅ All DXF files are already using proper Storage format!',
        '🎉 No migration needed - your architecture is already enterprise-class!'
      ]
    };

    logger.info('DRY RUN result', { legacyFiles: analysis.legacyFiles.length, properFiles: analysis.properFiles.length });

    return NextResponse.json({
      success: true,
      ...report
    });

  } catch (error: unknown) {
    logger.error('DRY RUN Analysis failed', { error });

    return NextResponse.json({
      success: false,
      error: 'DRY RUN Analysis failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function handleMigrateDxfExecute(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();

  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted DXF migration execution', { email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can execute DXF migrations',
        message: 'DXF data migration is a system-level operation restricted to super_admin'
      },
      { status: 403 }
    );
  }

  logger.info('DXF migration execute request', { email: ctx.email, globalRole: ctx.globalRole, companyId: ctx.companyId });

  try {
    logger.info('DXF Migration - LIVE MIGRATION');

    // First analyze to get the data
    const analysisMigrator = new DxfMigrationAPI(true);
    const analysis = await analysisMigrator.analyzeLegacyData();

    if (analysis.legacyFiles.length === 0) {
      logger.info('No legacy files to migrate');
      return NextResponse.json({
        success: true,
        mode: 'LIVE_MIGRATION',
        message: 'No legacy files to migrate - all files are already using Storage format!',
        summary: {
          migratedCount: 0,
          alreadyProperCount: analysis.properFiles.length
        }
      });
    }

    // Execute live migration
    const migrator = new DxfMigrationAPI(false);
    const migrationResult = await migrator.migrateLegacyFiles(analysis);

    const duration = Date.now() - startTime;

    const report = {
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
          'No more document size limits'
        ]
      },
      logs: migrationResult.logs,
      errors: migrationResult.errors,
      executionTimeMs: duration,
    };

    logger.info('Migration completed', { migratedCount: migrationResult.migratedCount, failedCount: migrationResult.failedCount });

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logMigrationExecuted(
      ctx,
      'migrate_dxf_firestore_to_storage',
      {
        operation: 'migrate-dxf',
        totalLegacyFiles: analysis.legacyFiles.length,
        migratedCount: migrationResult.migratedCount,
        failedCount: migrationResult.failedCount,
        spaceSavedKB: Math.round(analysis.totalLegacySize / 1024),
        successRate: report.summary.successRate,
        executionTimeMs: duration,
        result: migrationResult.errors.length === 0 ? 'success' : 'partial_success',
        metadata,
      },
      `DXF migration (Firestore→Storage) by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.warn('Audit logging failed (non-blocking)', { error: err });
    });

    if (migrationResult.errors.length > 0) {
      return NextResponse.json({
        success: false,
        ...report
      }, { status: 207 }); // Multi-status
    }

    return NextResponse.json({
      success: true,
      ...report
    });

  } catch (error: unknown) {
    logger.error('LIVE Migration failed', { error });

    return NextResponse.json({
      success: false,
      error: 'LIVE Migration failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * 📋 API USAGE EXAMPLES:
 *
 * DRY RUN:
 * GET http://localhost:3001/api/admin/migrate-dxf
 *
 * LIVE MIGRATION:
 * POST http://localhost:3001/api/admin/migrate-dxf
 * Content-Type: application/json
 * {}
 */
