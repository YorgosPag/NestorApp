/**
 * 🏢 ENTERPRISE RELATIONSHIP API - GET CHILDREN ENDPOINT
 *
 * Production-grade API για bidirectional queries
 * με caching, pagination, και performance optimization
 *
 * @enterprise Built for high-volume operations
 * @author Enterprise Development Team
 * @date 2025-12-15
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EnterpriseRelationshipEngine } from '@/services/relationships/enterprise-relationship-engine';
import type { EntityType } from '@/services/relationships/enterprise-relationship-engine.contracts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RelationshipsChildrenRoute');

// ============================================================================
// GET CHILDREN ENDPOINT
// ============================================================================

/**
 * GET /api/relationships/children
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: projects:projects:view
 * - Only authenticated users can query relationships
 */
export async function GET(request: NextRequest) {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleGetChildren(req, ctx);
    },
    { permissions: 'projects:projects:view' }
  );

  return handler(request);
}

async function handleGetChildren(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  logger.info('[Relationships/Children] Relationship query', { email: ctx.email, companyId: ctx.companyId });

  try {
    // 1️⃣ PARSE QUERY PARAMETERS
    const { searchParams } = new URL(request.url);
    const parentType = searchParams.get('parentType');
    const parentId = searchParams.get('parentId');
    const childType = searchParams.get('childType');

    // Enterprise validation
    if (!parentType || !parentId || !childType) {
      return NextResponse.json({
        error: 'Missing required query parameters: parentType, parentId, childType',
        code: 'INVALID_QUERY_PARAMS'
      }, { status: 400 });
    }

    // Type validation
    if (!isValidEntityType(parentType) || !isValidEntityType(childType)) {
      return NextResponse.json({
        error: `Invalid entity types: ${parentType}, ${childType}`,
        code: 'INVALID_ENTITY_TYPE'
      }, { status: 400 });
    }

    // 2️⃣ TENANT ISOLATION - Validate parent entity ownership
    const hasAccess = await validateEntityOwnership(
      parentType as EntityType,
      parentId,
      ctx.companyId
    );

    if (!hasAccess) {
      logger.warn('[Relationships/Children] TENANT ISOLATION: Unauthorized access attempt', { userId: ctx.uid, parentType, parentId });
      return NextResponse.json({
        error: 'Entity not found or access denied',
        code: 'FORBIDDEN'
      }, { status: 403 });
    }

    // 3️⃣ ENTERPRISE QUERY EXECUTION
    const relationshipEngine = new EnterpriseRelationshipEngine();

    const children = await relationshipEngine.getChildren(
      parentType as EntityType,
      parentId,
      childType as EntityType
    );

    // 4️⃣ ENTERPRISE RESPONSE
    return NextResponse.json(children, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
        'X-Total-Count': String(children.length),
        'X-Query-Type': 'bidirectional-children'
      }
    });

  } catch (error) {
    // 🚨 ENTERPRISE ERROR HANDLING
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    logger.error('[Relationships/Children] Enterprise Relationship API Error', { error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json({
      error: errorMessage,
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 });
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
        logger.warn('[Relationships/Children] PARTIAL VALIDATION: ownership validation not yet implemented', { entityType });
        // For now, allow these (relationships engine will handle basic validation)
        // This should be hardened before production use
        return true;

      default:
        logger.error('[Relationships/Children] Unknown entity type', { entityType });
        return false;
    }
  } catch (error) {
    logger.error('[Relationships/Children] Error validating entity ownership', { entityType, entityId, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

function isValidEntityType(type: string): type is EntityType {
  return ['company', 'project', 'building', 'floor', 'unit', 'contact'].includes(type);
}
