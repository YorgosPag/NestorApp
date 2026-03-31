/**
 * =============================================================================
 * MIGRATE PROPERTIES - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Migrates properties from legacy IDs to enterprise structure
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Data migration operation (DELETE + CREATE)
 *
 * This endpoint performs property migration:
 * 1. DELETES properties with legacy buildingIds
 * 2. CREATES new properties with Firebase auto-generated IDs
 * 3. Links them to enterprise buildings
 *
 * @method GET - Preview migration (dry run, read-only)
 * @method POST - Execute migration (DELETE + CREATE)
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *
 * @classification CRITICAL - Mass deletion + creation operation (properties)
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { processAdminBatch, BATCH_SIZE_READ, BATCH_SIZE_WRITE } from '@/lib/admin-batch-utils';
import { generatePropertyId } from '@/services/enterprise-id.service';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('MigratePropertiesRoute');

// 🏢 ENTERPRISE: Enterprise building για τα νέα properties
const TARGET_ENTERPRISE_BUILDING = {
  id: 'G8kMxQ2pVwN5jR7tE1sA',
  name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου',
  projectId: 'xL2nV4bC6mZ8kJ9hG1fQ',
};

// 🏢 ENTERPRISE: Property templates για τα νέα properties
const PROPERTY_TEMPLATES = [
  {
    name: 'Διαμέρισμα Α1',
    type: 'apartment',
    status: 'for-sale',
    floor: 1,
    floorId: 'floor_1',
    area: 85,
    price: 180000,
    description: 'Διαμέρισμα 2 υπνοδωματίων με μπαλκόνι',
  },
  {
    name: 'Διαμέρισμα Α2',
    type: 'apartment',
    status: 'for-sale',
    floor: 1,
    floorId: 'floor_1',
    area: 95,
    price: 210000,
    description: 'Διαμέρισμα 3 υπνοδωματίων γωνιακό',
  },
  {
    name: 'Διαμέρισμα Β1',
    type: 'apartment',
    status: 'available',
    floor: 2,
    floorId: 'floor_2',
    area: 75,
    price: 165000,
    description: 'Διαμέρισμα 2 υπνοδωματίων με θέα',
  },
  {
    name: 'Στούντιο Γ1',
    type: 'studio',
    status: 'for-sale',
    floor: 3,
    floorId: 'floor_3',
    area: 45,
    price: 95000,
    description: 'Στούντιο ιδανικό για φοιτητές',
  },
  {
    name: 'Κατάστημα Ισογείου',
    type: 'shop',
    status: 'for-rent',
    floor: 0,
    floorId: 'floor_0',
    area: 120,
    price: 250000,
    description: 'Κατάστημα στο ισόγειο με βιτρίνα',
  },
  {
    name: 'Αποθήκη Υπογείου Α1',
    type: 'storage',
    status: 'available',
    floor: -1,
    floorId: 'floor_-1',
    area: 15,
    price: 12000,
    description: 'Αποθήκη στο υπόγειο',
  },
  {
    name: 'Μεζονέτα Δ1',
    type: 'maisonette',
    status: 'reserved',
    floor: 3,
    floorId: 'floor_3',
    area: 140,
    price: 320000,
    description: 'Μεζονέτα 3ου-4ου ορόφου με ταράτσα',
  },
];

interface PropertyData {
  id: string;
  name: string;
  buildingId?: string;
  [key: string]: unknown;
}

/**
 * GET - Preview Migration (withAuth protected)
 * Read-only preview of properties to be migrated.
 *
 * @security withAuth + super_admin check + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleMigratePropertiesPreview(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for GET (preview migration).
 */
async function handleMigratePropertiesPreview(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted property migration preview', { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole });
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
    logger.info('Analyzing properties for migration...');

    // ADR-214 Phase 8: Batch processing to prevent unbounded reads
    const db = getAdminFirestore();
    const properties: PropertyData[] = [];
    await processAdminBatch(
      db.collection(COLLECTIONS.PROPERTIES),
      BATCH_SIZE_READ,
      (docs) => {
        for (const docSnap of docs) {
          const data = docSnap.data();
          properties.push({
            id: docSnap.id,
            name: (data.name as string) || 'UNNAMED',
            buildingId: data.buildingId as string | undefined,
            ...data,
          });
        }
      },
    );

    // Find legacy properties (buildingId starts with "building_")
    const legacyProperties = properties.filter((u) => {
      const bid = String(u.buildingId || '');
      return bid.startsWith('building_');
    });

    // Find enterprise properties
    const enterpriseProperties = properties.filter((u) => {
      const bid = String(u.buildingId || '');
      return !bid.startsWith('building_') && bid.length >= 20;
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      mode: 'preview',
      totalProperties: properties.length,
      legacyProperties: legacyProperties.length,
      enterpriseProperties: enterpriseProperties.length,
      legacyDetails: legacyProperties.map((u) => ({
        id: u.id,
        name: u.name,
        buildingId: u.buildingId,
      })),
      newPropertiesToCreate: PROPERTY_TEMPLATES.length,
      targetBuilding: TARGET_ENTERPRISE_BUILDING,
      message: `Found ${legacyProperties.length} legacy properties to delete. Will create ${PROPERTY_TEMPLATES.length} new enterprise properties. Use POST to execute.`,
      executionTimeMs: duration,
    });
  } catch (error: unknown) {
    logger.error('Error analyzing properties', { error });
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze properties',
        details: getErrorMessage(error),
        executionTimeMs: duration,
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Execute Migration (withAuth protected)
 * DELETES legacy properties + CREATES new enterprise properties.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleMigratePropertiesExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for POST (execute migration).
 */
async function handleMigratePropertiesExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted property migration execution', { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole });
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
    logger.info('Starting property migration...');

    // Step 1: Get all properties (ADR-214 Phase 8: batched)
    const db = getAdminFirestore();
    const properties: PropertyData[] = [];
    await processAdminBatch(
      db.collection(COLLECTIONS.PROPERTIES),
      BATCH_SIZE_WRITE,
      (docs) => {
        for (const docSnap of docs) {
          const data = docSnap.data();
          properties.push({
            id: docSnap.id,
            name: (data.name as string) || 'UNNAMED',
            buildingId: data.buildingId as string | undefined,
            ...data,
          });
        }
      },
    );

    // Step 2: Find and delete legacy properties
    const legacyProperties = properties.filter((u) => {
      const bid = String(u.buildingId || '');
      return bid.startsWith('building_');
    });

    logger.info('Deleting legacy properties', { count: legacyProperties.length });

    let deletedCount = 0;
    for (const property of legacyProperties) {
      try {
        await db.collection(COLLECTIONS.PROPERTIES).doc(property.id).delete();
        deletedCount++;
        logger.info('Deleted property', { propertyId: property.id, propertyName: property.name });
      } catch (err) {
        logger.error('Failed to delete property', { propertyId: property.id, error: err });
      }
    }

    // Step 3: Create new enterprise properties
    logger.info('Creating new enterprise properties', { count: PROPERTY_TEMPLATES.length });

    const createdProperties: Array<{ id: string; name: string }> = [];

    for (const template of PROPERTY_TEMPLATES) {
      try {
        const newProperty = {
          ...template,
          buildingId: TARGET_ENTERPRISE_BUILDING.id,
          projectId: TARGET_ENTERPRISE_BUILDING.projectId,
          building: TARGET_ENTERPRISE_BUILDING.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // 🏢 ENTERPRISE: ADR-017 compliant — enterprise-id.service generates IDs
        const propertyId = generatePropertyId();
        await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).set(newProperty);
        createdProperties.push({ id: propertyId, name: template.name });
        logger.info('Created property', { propertyId, propertyName: template.name });
      } catch (err) {
        logger.error('Failed to create property', { propertyName: template.name, error: err });
      }
    }

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'migrate_properties_legacy_to_enterprise',
      {
        operation: 'migrate-properties',
        deleted: deletedCount,
        created: createdProperties.length,
        targetBuilding: TARGET_ENTERPRISE_BUILDING,
        createdProperties: createdProperties.map(u => ({ id: u.id, name: u.name })),
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Property migration by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.warn('Audit logging failed (non-blocking)', { error: err });
    });

    return NextResponse.json({
      success: true,
      message: `Migration complete! Deleted ${deletedCount} legacy properties, created ${createdProperties.length} enterprise properties.`,
      deleted: deletedCount,
      created: createdProperties.length,
      createdProperties,
      targetBuilding: TARGET_ENTERPRISE_BUILDING,
      executionTimeMs: duration,
    });
  } catch (error: unknown) {
    logger.error('Error during migration', { error });
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to migrate properties',
        details: getErrorMessage(error),
        executionTimeMs: duration,
      },
      { status: 500 }
    );
  }
}
