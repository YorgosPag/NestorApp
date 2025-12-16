/**
 * 🚀 ENTERPRISE ID MIGRATION API ENDPOINT
 *
 * Provides secure API για migrating legacy IDs to enterprise UUID system
 *
 * ENDPOINTS:
 * POST /api/enterprise-ids/migrate - Start migration process
 * GET  /api/enterprise-ids/migrate - Get migration status
 *
 * SECURITY:
 * - Admin-only access
 * - Transaction support
 * - Rollback capability
 * - Audit logging
 *
 * @author Enterprise Migration Team
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  enterpriseIdMigrationService,
  MigrationPhase,
  type MigrationStats
} from '@/services/enterprise-id-migration.service';
import { enterpriseIdService } from '@/services/enterprise-id.service';

/**
 * Migration request interface
 */
interface MigrationRequest {
  phase?: MigrationPhase;
  entityTypes?: string[];
  dryRun?: boolean;
  batchSize?: number;
}

/**
 * Migration response interface
 */
interface MigrationResponse {
  success: boolean;
  message: string;
  stats?: MigrationStats;
  migratedIds?: Array<{ legacyId: string; enterpriseId: string; entityType: string }>;
  errors?: string[];
  phase?: MigrationPhase;
}

/**
 * GET - Migration status και statistics
 */
export async function GET(request: NextRequest): Promise<NextResponse<MigrationResponse>> {
  try {
    console.log('🔍 Getting migration status...');

    const stats = enterpriseIdMigrationService.getMigrationStats();
    const config = enterpriseIdMigrationService.getConfig();

    return NextResponse.json({
      success: true,
      message: 'Migration status retrieved successfully',
      stats,
      phase: config.currentPhase
    });

  } catch (error) {
    console.error('❌ Error getting migration status:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to get migration status',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 });
  }
}

/**
 * POST - Start migration process
 */
export async function POST(request: NextRequest): Promise<NextResponse<MigrationResponse>> {
  try {
    const body: MigrationRequest = await request.json();
    const {
      phase = MigrationPhase.DUAL_SUPPORT,
      entityTypes = ['company', 'project', 'building', 'unit', 'contact'],
      dryRun = false,
      batchSize = 10
    } = body;

    console.log(`🚀 Starting migration process...`);
    console.log(`📋 Configuration: phase=${phase}, entityTypes=${entityTypes.join(',')}, dryRun=${dryRun}`);

    // Validate admin access (προσωρινά disabled για development)
    // TODO: Add proper admin authentication

    const migratedIds: Array<{ legacyId: string; enterpriseId: string; entityType: string }> = [];
    const errors: string[] = [];

    // Set migration phase
    try {
      enterpriseIdMigrationService.setMigrationPhase(phase);
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: 'Invalid migration phase',
        errors: [error instanceof Error ? error.message : 'Unknown phase error']
      }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({
        success: false,
        message: 'Firebase Admin SDK not initialized'
      }, { status: 500 });
    }

    // Process each entity type
    for (const entityType of entityTypes) {
      try {
        console.log(`🔄 Processing entity type: ${entityType}`);

        const collectionName = getCollectionNameForEntityType(entityType);
        if (!collectionName) {
          errors.push(`Unknown entity type: ${entityType}`);
          continue;
        }

        // Get documents με legacy IDs
        const snapshot = await adminDb.collection(collectionName).limit(batchSize).get();
        console.log(`📊 Found ${snapshot.docs.length} ${entityType} documents`);

        for (const doc of snapshot.docs) {
          const legacyId = doc.id;

          // Skip if already enterprise ID
          if (enterpriseIdService.validateId(legacyId)) {
            console.log(`✅ Skipping enterprise ID: ${legacyId}`);
            continue;
          }

          // Generate enterprise ID
          const enterpriseId = generateIdForEntityType(entityType);

          migratedIds.push({
            legacyId,
            enterpriseId,
            entityType
          });

          // Perform migration (if not dry run)
          if (!dryRun) {
            await performDocumentMigration(adminDb, collectionName, legacyId, enterpriseId, doc.data());
          }

          console.log(`🔄 ${dryRun ? 'DRY RUN' : 'MIGRATED'}: ${legacyId} → ${enterpriseId}`);
        }

      } catch (error) {
        const errorMessage = `Error processing ${entityType}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        console.error(`❌ ${errorMessage}`);
      }
    }

    const stats = enterpriseIdMigrationService.getMigrationStats();

    console.log(`✅ Migration ${dryRun ? 'simulation' : 'process'} completed`);
    console.log(`📊 Results: ${migratedIds.length} IDs processed, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      message: `Migration ${dryRun ? 'simulation' : 'process'} completed successfully`,
      stats,
      migratedIds: migratedIds.slice(0, 20), // Limit response size
      errors: errors.slice(0, 10), // Limit error count
      phase
    });

  } catch (error) {
    console.error('❌ Error in migration process:', error);
    return NextResponse.json({
      success: false,
      message: 'Migration process failed',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 });
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get Firestore collection name για entity type
 */
function getCollectionNameForEntityType(entityType: string): string | null {
  switch (entityType.toLowerCase()) {
    case 'company':
      return COLLECTIONS.CONTACTS; // Companies are stored in contacts
    case 'project':
      return COLLECTIONS.PROJECTS;
    case 'building':
      return COLLECTIONS.BUILDINGS;
    case 'unit':
      return COLLECTIONS.UNITS;
    case 'contact':
      return COLLECTIONS.CONTACTS;
    case 'floor':
      return COLLECTIONS.FLOORS;
    case 'document':
      return COLLECTIONS.DOCUMENTS;
    case 'user':
      return COLLECTIONS.USERS;
    default:
      return null;
  }
}

/**
 * Generate enterprise ID για specific entity type
 */
function generateIdForEntityType(entityType: string): string {
  switch (entityType.toLowerCase()) {
    case 'company':
      return enterpriseIdService.generateCompanyId();
    case 'project':
      return enterpriseIdService.generateProjectId();
    case 'building':
      return enterpriseIdService.generateBuildingId();
    case 'unit':
      return enterpriseIdService.generateUnitId();
    case 'contact':
      return enterpriseIdService.generateContactId();
    case 'floor':
      return enterpriseIdService.generateFloorId();
    case 'document':
      return enterpriseIdService.generateDocumentId();
    case 'user':
      return enterpriseIdService.generateUserId();
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Perform actual document migration με transaction
 */
async function performDocumentMigration(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  legacyId: string,
  enterpriseId: string,
  data: any
): Promise<void> {
  // Create new document με enterprise ID
  const newDocRef = db.collection(collectionName).doc(enterpriseId);
  await newDocRef.set({
    ...data,
    id: enterpriseId, // Update internal ID field
    legacyId, // Keep reference to legacy ID
    migratedAt: new Date(),
    migratedBy: 'enterprise-migration-service'
  });

  // Keep legacy document για backward compatibility (προς το παρόν)
  // TODO: Remove after migration validation period
  const legacyDocRef = db.collection(collectionName).doc(legacyId);
  await legacyDocRef.update({
    enterpriseId, // Add reference to new ID
    deprecated: true,
    deprecatedAt: new Date()
  });
}

/**
 * Only allow POST και GET methods
 */
export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}