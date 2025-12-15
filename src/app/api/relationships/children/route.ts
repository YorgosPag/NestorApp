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
import { EnterpriseRelationshipEngine } from '@/services/relationships/enterprise-relationship-engine';
import type { EntityType } from '@/services/relationships/enterprise-relationship-engine.contracts';

// ============================================================================
// GET CHILDREN ENDPOINT
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // 2️⃣ ENTERPRISE QUERY EXECUTION
    const relationshipEngine = new EnterpriseRelationshipEngine();

    const children = await relationshipEngine.getChildren(
      parentType as EntityType,
      parentId,
      childType as EntityType
    );

    // 3️⃣ ENTERPRISE RESPONSE
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

    console.error('🚨 Enterprise Relationship API Error (Children):', error);

    return NextResponse.json({
      error: errorMessage,
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isValidEntityType(type: string): type is EntityType {
  return ['company', 'project', 'building', 'floor', 'unit', 'contact'].includes(type);
}