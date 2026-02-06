/**
 * 🏢 ENTERPRISE RELATIONSHIP API - CREATE ENDPOINT
 *
 * Production-grade API για relationship creation
 * με validation, error handling, και audit logging
 *
 * @enterprise AutoCAD/SolidWorks-class API design
 * @author Enterprise Development Team
 * @date 2025-12-15
 * @rateLimit STANDARD (60 req/min) - Relationship creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EnterpriseRelationshipEngine } from '@/services/relationships/enterprise-relationship-engine';
import type {
  EntityType,
  CreateRelationshipOptions,
  RelationshipOperationResult
} from '@/services/relationships/enterprise-relationship-engine.contracts';

// ============================================================================
// CREATE RELATIONSHIP ENDPOINT
// ============================================================================

/**
 * POST /api/relationships/create
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: projects:projects:update
 * - Only authenticated users can create relationships
 */
const postHandler = async (request: NextRequest) => {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<RelationshipOperationResult>> => {
      return handleCreateRelationship(req, ctx);
    },
    { permissions: 'projects:projects:update' }
  );

  return handler(request);
};

export const POST = withStandardRateLimit(postHandler);

async function handleCreateRelationship(request: NextRequest, ctx: AuthContext): Promise<NextResponse<RelationshipOperationResult>> {
  console.log(`🔗 API: Create relationship request from user ${ctx.email} (company: ${ctx.companyId})`);

  try {
    // 1️⃣ PARSE & VALIDATE REQUEST
    const body = await request.json();
    const { parentType, parentId, childType, childId, options } = body;

    // Enterprise validation
    if (!parentType || !parentId || !childType || !childId) {
      return NextResponse.json({
        success: false,
        entityId: parentId || 'unknown',
        affectedRelationships: [],
        metadata: {
          operationType: 'CREATE',
          timestamp: new Date(),
          performedBy: 'api-user',
          cascadeCount: 0
        },
        errors: [{
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: parentType, parentId, childType, childId',
          entityType: parentType || 'unknown',
          entityId: parentId || 'unknown',
          field: 'request_body'
        }]
      } as RelationshipOperationResult, { status: 400 });
    }

    // Type validation
    if (!isValidEntityType(parentType) || !isValidEntityType(childType)) {
      return NextResponse.json({
        success: false,
        entityId: parentId,
        affectedRelationships: [],
        metadata: {
          operationType: 'CREATE',
          timestamp: new Date(),
          performedBy: 'api-user',
          cascadeCount: 0
        },
        errors: [{
          code: 'INVALID_ENTITY_TYPE',
          message: `Invalid entity types: ${parentType}, ${childType}`,
          entityType: parentType,
          entityId: parentId,
          field: 'entityType'
        }]
      } as RelationshipOperationResult, { status: 400 });
    }

    // 2️⃣ TENANT ISOLATION - Validate both parent and child entity ownership
    const parentAccess = await validateEntityOwnership(
      parentType as EntityType,
      parentId,
      ctx.companyId
    );

    if (!parentAccess) {
      console.warn(`🚫 TENANT ISOLATION: User ${ctx.uid} attempted to access unauthorized parent ${parentType} ${parentId}`);
      return NextResponse.json({
        success: false,
        entityId: parentId,
        affectedRelationships: [],
        metadata: {
          operationType: 'CREATE',
          timestamp: new Date(),
          performedBy: ctx.email,
          cascadeCount: 0
        },
        errors: [{
          code: 'FORBIDDEN',
          message: 'Parent entity not found or access denied',
          entityType: parentType,
          entityId: parentId
        }]
      } as RelationshipOperationResult, { status: 403 });
    }

    const childAccess = await validateEntityOwnership(
      childType as EntityType,
      childId,
      ctx.companyId
    );

    if (!childAccess) {
      console.warn(`🚫 TENANT ISOLATION: User ${ctx.uid} attempted to access unauthorized child ${childType} ${childId}`);
      return NextResponse.json({
        success: false,
        entityId: childId,
        affectedRelationships: [],
        metadata: {
          operationType: 'CREATE',
          timestamp: new Date(),
          performedBy: ctx.email,
          cascadeCount: 0
        },
        errors: [{
          code: 'FORBIDDEN',
          message: 'Child entity not found or access denied',
          entityType: childType,
          entityId: childId
        }]
      } as RelationshipOperationResult, { status: 403 });
    }

    // 3️⃣ ENTERPRISE RELATIONSHIP CREATION
    const relationshipEngine = new EnterpriseRelationshipEngine();

    const result = await relationshipEngine.createRelationship(
      parentType as EntityType,
      parentId,
      childType as EntityType,
      childId,
      options as CreateRelationshipOptions || {}
    );

    // 4️⃣ RETURN RESULT
    const statusCode = result.success ? 200 : 400;
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    // 🚨 ENTERPRISE ERROR HANDLING
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    const errorResult: RelationshipOperationResult = {
      success: false,
      entityId: 'unknown',
      affectedRelationships: [],
      metadata: {
        operationType: 'CREATE',
        timestamp: new Date(),
        performedBy: 'api-user',
        cascadeCount: 0
      },
      errors: [{
        code: 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
        entityType: 'company' as const, // 🏢 ENTERPRISE: Default fallback entity type
        entityId: 'error'
      }]
    };

    console.error('🚨 Enterprise Relationship API Error:', error);
    return NextResponse.json(errorResult, { status: 500 });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * 🔒 TENANT ISOLATION: Validate entity ownership
 *
 * Validates that the specified entity belongs to the user's company.
 * Currently implements validation for project and company entities.
 *
 * TODO: Add comprehensive validation for all entity types:
 * - building → project → companyId
 * - floor → building → project → companyId
 * - unit → floor → building → project → companyId
 * - contact → companyId (direct)
 */
async function validateEntityOwnership(
  entityType: EntityType,
  entityId: string,
  companyId: string
): Promise<boolean> {
  try {
    switch (entityType) {
      case 'company':
        // Direct ownership: entity must be the user's company
        return entityId === companyId;

      case 'project':
        // Validate project belongs to user's company
        const projectDoc = await getAdminFirestore()
          .collection(COLLECTIONS.PROJECTS)
          .doc(entityId)
          .get();

        if (!projectDoc.exists) {
          return false;
        }

        const projectData = projectDoc.data();
        return projectData?.companyId === companyId;

      case 'building':
      case 'floor':
      case 'unit':
      case 'contact':
        // TODO: Implement multi-level validation for these entity types
        console.warn(`⚠️ PARTIAL VALIDATION: ${entityType} ownership validation not yet implemented`);
        // For now, allow these (relationships engine will handle basic validation)
        // This should be hardened before production use
        return true;

      default:
        console.error(`❌ UNKNOWN ENTITY TYPE: ${entityType}`);
        return false;
    }
  } catch (error) {
    console.error(`❌ Error validating entity ownership for ${entityType} ${entityId}:`, error);
    return false;
  }
}

function isValidEntityType(type: string): type is EntityType {
  return ['company', 'project', 'building', 'floor', 'unit', 'contact'].includes(type);
}
