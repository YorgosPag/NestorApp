/**
 * =============================================================================
 * SEED FLOORS — HANDLERS
 * =============================================================================
 *
 * Preview / Execute / Delete handlers για manual floor seeding.
 *
 * 🏢 ENTERPRISE (ADR-286): Creation path routed through `createEntity('floor')`
 * for uniform audit, tenancy, and enterprise IDs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { createModuleLogger } from '@/lib/telemetry';
import { processAdminBatch, BATCH_SIZE_READ } from '@/lib/admin-batch-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { FLOOR_TEMPLATES, TARGET_BUILDING, TARGET_COMPANY_ID } from './seed-floors.config';

const logger = createModuleLogger('SeedFloorsHandlers');

function forbiddenResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: `Forbidden: ${message}`,
      message: 'Floors seeding is a system-level operation restricted to super_admin',
    },
    { status: 403 }
  );
}

export async function handleSeedFloorsPreview(
  _request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted seeding preview', {
      email: ctx.email,
      globalRole: ctx.globalRole,
    });
    return forbiddenResponse('Only super_admin can preview floors seeding');
  }

  logger.info('Seed floors preview request', {
    email: ctx.email,
    globalRole: ctx.globalRole,
    companyId: ctx.companyId,
  });

  try {
    const floorsRef = getAdminFirestore().collection(COLLECTIONS.FLOORS);
    const existingFloors: Array<Record<string, unknown>> = [];
    await processAdminBatch(floorsRef, BATCH_SIZE_READ, (docs) => {
      for (const docSnap of docs) {
        existingFloors.push({ id: docSnap.id, ...docSnap.data() });
      }
    });

    const previewIds = FLOOR_TEMPLATES.map((template) => ({
      number: template.number,
      name: template.name,
      previewId: 'flr_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (θα δημιουργηθεί)',
      buildingId: TARGET_BUILDING.id,
      units: template.units,
    }));

    logger.info('Preview', { existingFloors: existingFloors.length, toCreate: FLOOR_TEMPLATES.length });

    return NextResponse.json({
      success: true,
      preview: true,
      message: 'Προεπισκόπηση seeding - δεν έγιναν αλλαγές',
      existing: {
        count: existingFloors.length,
        floors: existingFloors,
        willBeDeleted: true,
      },
      toCreate: {
        count: FLOOR_TEMPLATES.length,
        targetBuilding: TARGET_BUILDING,
        companyId: TARGET_COMPANY_ID,
        floors: previewIds,
      },
      instructions: [
        'POST /api/admin/seed-floors → Για να εκτελεστεί το seeding',
        'DELETE /api/admin/seed-floors → Για να διαγραφούν όλα τα floors',
      ],
    });
  } catch (error) {
    logger.error('Error in seed-floors preview', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to preview floors',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function handleSeedFloorsExecute(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();

  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted seeding execution', {
      email: ctx.email,
      globalRole: ctx.globalRole,
    });
    return forbiddenResponse('Only super_admin can execute floors seeding');
  }

  logger.info('Seed floors execute request', {
    email: ctx.email,
    globalRole: ctx.globalRole,
    companyId: ctx.companyId,
  });

  try {
    const floorsRef = getAdminFirestore().collection(COLLECTIONS.FLOORS);

    // STEP 1: Delete existing floors (ADR-214 Phase 8: batched)
    logger.info('Deleting existing floors...');
    const deletedIds: string[] = [];
    await processAdminBatch(floorsRef, BATCH_SIZE_READ, async (docs) => {
      for (const docSnapshot of docs) {
        await getAdminFirestore().collection(COLLECTIONS.FLOORS).doc(docSnapshot.id).delete();
        deletedIds.push(docSnapshot.id);
        logger.info('Deleted floor', { id: docSnapshot.id });
      }
    });
    logger.info('Deleted floors', { count: deletedIds.length });

    // STEP 2: Create new floors via createEntity (ADR-238, ADR-286)
    logger.info('Creating new floors via centralized entity service...');
    const createdFloors: Array<{ id: string; number: number; name: string }> = [];

    for (const template of FLOOR_TEMPLATES) {
      const result = await createEntity('floor', {
        auth: ctx,
        parentId: TARGET_BUILDING.id,
        entitySpecificFields: {
          number: template.number,
          name: template.name,
          units: template.units,
          description: template.description || '',
          buildingId: TARGET_BUILDING.id,
          buildingName: TARGET_BUILDING.name,
          projectId: TARGET_BUILDING.projectId,
          projectName: TARGET_BUILDING.projectName,
        },
        apiPath: '/api/admin/seed-floors (POST)',
      });

      createdFloors.push({ id: result.id, number: template.number, name: template.name });
      logger.info('Created floor', { floorId: result.id, floorName: template.name });
    }
    logger.info('Created floors', { count: createdFloors.length });

    const duration = Date.now() - startTime;

    // Audit log (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logMigrationExecuted(
      ctx,
      'seed_floors',
      {
        operation: 'seed-floors',
        deletedCount: deletedIds.length,
        createdCount: createdFloors.length,
        targetBuilding: TARGET_BUILDING,
        companyId: ctx.companyId,
        deletedIds,
        createdFloors,
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Floors seeding by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.warn('Audit logging failed (non-blocking)', { error: err });
    });

    return NextResponse.json({
      success: true,
      message: `Seeding ολοκληρώθηκε! Διαγράφηκαν ${deletedIds.length}, δημιουργήθηκαν ${createdFloors.length} floors`,
      deleted: { count: deletedIds.length, ids: deletedIds },
      created: {
        count: createdFloors.length,
        targetBuilding: TARGET_BUILDING,
        companyId: ctx.companyId,
        floors: createdFloors,
      },
      executionTimeMs: duration,
    });
  } catch (error) {
    logger.error('Error in seed-floors execute', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to seed floors',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function handleSeedFloorsDelete(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();

  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted mass deletion', {
      email: ctx.email,
      globalRole: ctx.globalRole,
    });
    return forbiddenResponse('Only super_admin can delete all floors');
  }

  logger.info('Seed floors delete request', {
    email: ctx.email,
    globalRole: ctx.globalRole,
    companyId: ctx.companyId,
  });

  try {
    const floorsRef = getAdminFirestore().collection(COLLECTIONS.FLOORS);
    const deletedIds: string[] = [];
    await processAdminBatch(floorsRef, BATCH_SIZE_READ, async (docs) => {
      for (const docSnapshot of docs) {
        await getAdminFirestore().collection(COLLECTIONS.FLOORS).doc(docSnapshot.id).delete();
        deletedIds.push(docSnapshot.id);
      }
    });

    const duration = Date.now() - startTime;
    logger.info('Deleted all floors', { count: deletedIds.length });

    const metadata = extractRequestMetadata(request);
    await logMigrationExecuted(
      ctx,
      'delete_all_floors',
      {
        operation: 'delete-floors',
        deletedCount: deletedIds.length,
        deletedIds,
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Mass deletion of all floors by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.warn('Audit logging failed (non-blocking)', { error: err });
    });

    return NextResponse.json({
      success: true,
      message: `Διαγράφηκαν ${deletedIds.length} floors`,
      deleted: { count: deletedIds.length, ids: deletedIds },
      executionTimeMs: duration,
    });
  } catch (error) {
    logger.error('Error in seed-floors delete', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete floors',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
