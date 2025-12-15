/**
 * 🏢 ENTERPRISE RELATIONSHIP API - CREATE ENDPOINT
 *
 * Production-grade API για relationship creation
 * με validation, error handling, και audit logging
 *
 * @enterprise AutoCAD/SolidWorks-class API design
 * @author Enterprise Development Team
 * @date 2025-12-15
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnterpriseRelationshipEngine } from '@/services/relationships/enterprise-relationship-engine';
import type {
  EntityType,
  CreateRelationshipOptions,
  RelationshipOperationResult
} from '@/services/relationships/enterprise-relationship-engine.contracts';

// ============================================================================
// CREATE RELATIONSHIP ENDPOINT
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<RelationshipOperationResult>> {
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

    // 2️⃣ ENTERPRISE RELATIONSHIP CREATION
    const relationshipEngine = new EnterpriseRelationshipEngine();

    const result = await relationshipEngine.createRelationship(
      parentType as EntityType,
      parentId,
      childType as EntityType,
      childId,
      options as CreateRelationshipOptions || {}
    );

    // 3️⃣ RETURN RESULT
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
        entityType: 'unknown',
        entityId: 'unknown'
      }]
    };

    console.error('🚨 Enterprise Relationship API Error:', error);
    return NextResponse.json(errorResult, { status: 500 });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isValidEntityType(type: string): type is EntityType {
  return ['company', 'project', 'building', 'floor', 'unit', 'contact'].includes(type);
}