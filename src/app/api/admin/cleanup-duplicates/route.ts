/**
 * =============================================================================
 * CLEANUP DUPLICATES - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Finds and removes duplicate units (same name)
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Data cleanup operation
 *
 * This endpoint performs duplicate unit cleanup:
 * 1. Groups units by name
 * 2. Keeps the first unit (oldest)
 * 3. Deletes all duplicates
 *
 * @method GET - Preview duplicates (dry run)
 * @method DELETE - Execute cleanup (mass deletion)
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *
 * @classification Data cleanup operation
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, deleteDoc, doc, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

interface UnitRecord {
  id: string;
  name: string;
  buildingId?: string;
  floorId?: string;
}

/**
 * GET - Preview Duplicates (withAuth protected)
 * Shows duplicate units without deleting them.
 *
 * @security withAuth + super_admin check + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const GET = withSensitiveRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleCleanupDuplicatesPreview(req, ctx);
    },
    { permissions: 'admin:data:fix' }
  )
);

/**
 * Internal handler for GET (preview duplicates).
 */
async function handleCleanupDuplicatesPreview(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [GET /api/admin/cleanup-duplicates] BLOCKED: Non-super_admin attempted duplicates preview`,
      { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole }
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  try {
    console.log('🔍 Analyzing duplicate units...');

    const unitsQuery = query(collection(db, COLLECTIONS.UNITS));
    const snapshot = await getDocs(unitsQuery);

    const units: UnitRecord[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      units.push({
        id: doc.id,
        name: data.name || 'UNNAMED',
        buildingId: data.buildingId,
        floorId: data.floorId,
      });
    });

    // Group by name
    const groupedByName = new Map<string, UnitRecord[]>();
    units.forEach((unit) => {
      const existing = groupedByName.get(unit.name) || [];
      existing.push(unit);
      groupedByName.set(unit.name, existing);
    });

    // Find duplicates (more than 1 unit with same name)
    const duplicateGroups: Array<{ name: string; keep: UnitRecord; toDelete: UnitRecord[] }> = [];
    let totalToDelete = 0;

    groupedByName.forEach((group, name) => {
      if (group.length > 1) {
        // Keep the first one, delete the rest
        const [keep, ...toDelete] = group;
        duplicateGroups.push({ name, keep, toDelete });
        totalToDelete += toDelete.length;
      }
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      mode: 'preview',
      totalUnits: units.length,
      uniqueNames: groupedByName.size,
      duplicateGroups: duplicateGroups.length,
      totalToDelete,
      afterCleanup: units.length - totalToDelete,
      details: duplicateGroups.map((g) => ({
        name: g.name,
        keepId: g.keep.id,
        deleteIds: g.toDelete.map((u) => u.id),
        deleteCount: g.toDelete.length,
      })),
      executionTimeMs: duration,
      message: `Found ${totalToDelete} duplicate units to delete. Use DELETE method to execute cleanup.`,
    });
  } catch (error: unknown) {
    console.error('❌ Error analyzing duplicates:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze duplicates',
        details: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: duration,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Execute Cleanup (withAuth protected)
 * Deletes duplicate units, keeping only the first occurrence.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const DELETE = withSensitiveRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleCleanupDuplicatesExecute(req, ctx);
    },
    { permissions: 'admin:data:fix' }
  )
);

/**
 * Internal handler for DELETE (execute cleanup).
 */
async function handleCleanupDuplicatesExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [DELETE /api/admin/cleanup-duplicates] BLOCKED: Non-super_admin attempted duplicate cleanup`,
      { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole }
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  try {
    console.log('🧹 Starting duplicate cleanup...');

    const unitsQuery = query(collection(db, COLLECTIONS.UNITS));
    const snapshot = await getDocs(unitsQuery);

    const units: UnitRecord[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      units.push({
        id: doc.id,
        name: data.name || 'UNNAMED',
        buildingId: data.buildingId,
        floorId: data.floorId,
      });
    });

    // Group by name
    const groupedByName = new Map<string, UnitRecord[]>();
    units.forEach((unit) => {
      const existing = groupedByName.get(unit.name) || [];
      existing.push(unit);
      groupedByName.set(unit.name, existing);
    });

    // Collect IDs to delete
    const idsToDelete: string[] = [];
    const deletedDetails: Array<{ name: string; deletedIds: string[] }> = [];

    groupedByName.forEach((group, name) => {
      if (group.length > 1) {
        // Keep the first one, delete the rest
        const [_keep, ...toDelete] = group;
        const deleteIds = toDelete.map((u) => u.id);
        idsToDelete.push(...deleteIds);
        deletedDetails.push({ name, deletedIds: deleteIds });
      }
    });

    if (idsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No duplicates found to delete',
        deleted: 0,
      });
    }

    // Delete duplicates
    console.log(`🗑️ Deleting ${idsToDelete.length} duplicate units...`);

    let deletedCount = 0;
    const errors: string[] = [];

    for (const id of idsToDelete) {
      try {
        await deleteDoc(doc(db, COLLECTIONS.UNITS, id));
        deletedCount++;
        console.log(`✅ Deleted: ${id}`);
      } catch (err) {
        console.error(`❌ Failed to delete ${id}:`, err);
        errors.push(id);
      }
    }

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'cleanup_duplicate_units',
      {
        operation: 'cleanup-duplicates',
        totalUnits: units.length,
        duplicatesDeleted: deletedCount,
        duplicatesFailed: errors.length,
        uniqueNamesAfter: groupedByName.size - deletedDetails.length,
        remainingUnits: units.length - deletedCount,
        deletedDetails: deletedDetails.map(d => ({
          name: d.name,
          deletedCount: d.deletedIds.length,
        })),
        executionTimeMs: duration,
        result: errors.length === 0 ? 'success' : 'partial_success',
        metadata,
      },
      `Duplicate units cleanup by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ Audit logging failed (non-blocking):', err);
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} duplicate units`,
      deleted: deletedCount,
      failed: errors.length,
      failedIds: errors.length > 0 ? errors : undefined,
      details: deletedDetails,
      remainingUnits: units.length - deletedCount,
      executionTimeMs: duration,
    });
  } catch (error: unknown) {
    console.error('❌ Error during cleanup:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cleanup duplicates',
        details: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: duration,
      },
      { status: 500 }
    );
  }
}
