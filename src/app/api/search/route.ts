/**
 * =============================================================================
 * 🔍 GLOBAL SEARCH API GATEWAY
 * =============================================================================
 *
 * Enterprise-grade search API endpoint for Global Search v1.
 * Provides hybrid search (prefix + normalized) with tenant isolation.
 *
 * @module app/api/search/route
 * @enterprise ADR-XXX - Global Search v1 (Non-AI)
 * @compliance Local_Protocol.txt - ZERO any, Security Protocol
 *
 * @see docs/adr/global-search-v1.md
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, FIRESTORE_LIMITS } from '@/config/firestore-collections';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { logAuditEvent } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { normalizeSearchText } from '@/lib/search/search';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  SEARCH_ENTITY_TYPES,
  SEARCH_AUDIENCE,
  SEARCH_CONFIG,
  isSearchEntityType,
  type SearchEntityType,
  type SearchResult,
  type SearchResultStat,
  type SearchDocument,
  type SearchAuditMetadata,
} from '@/types/search';
import { getSearchIndexConfig, extractStats } from '@/config/search-index-config';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Response data type for search API.
 */
interface SearchResponseData {
  results: SearchResult[];
  query: {
    normalized: string;
    types?: SearchEntityType[];
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse entity types from query parameter.
 *
 * @param typesParam - Comma-separated types string
 * @returns Array of valid SearchEntityType values
 */
function parseEntityTypes(typesParam: string | null): SearchEntityType[] | undefined {
  if (!typesParam) return undefined;

  const types = typesParam
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(isSearchEntityType);

  return types.length > 0 ? types : undefined;
}

/**
 * Parse limit from query parameter with bounds checking.
 *
 * @param limitParam - Limit string from query
 * @returns Validated limit number
 */
function parseLimit(limitParam: string | null): number {
  if (!limitParam) return SEARCH_CONFIG.DEFAULT_LIMIT;

  const parsed = parseInt(limitParam, 10);
  if (isNaN(parsed) || parsed < 1) return SEARCH_CONFIG.DEFAULT_LIMIT;
  if (parsed > SEARCH_CONFIG.MAX_LIMIT) return SEARCH_CONFIG.MAX_LIMIT;

  return parsed;
}

/**
 * Generate prefix array from normalized text.
 * Used for prefix matching in Firestore array-contains queries.
 *
 * @param text - Normalized text
 * @returns Array of prefixes (3-5 chars each)
 */
function generateSearchPrefixes(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const prefixes: Set<string> = new Set();

  for (const word of words) {
    // Generate prefixes of length 3, 4, 5
    for (let len = 3; len <= Math.min(SEARCH_CONFIG.MAX_PREFIX_LENGTH, word.length); len++) {
      prefixes.add(word.substring(0, len));
    }
  }

  return Array.from(prefixes);
}

/**
 * Transform SearchDocument to SearchResult.
 * 🏢 ENTERPRISE: Includes stats and status for card display
 *
 * @param doc - SearchDocument from Firestore
 * @returns SearchResult for API response
 */
function transformToSearchResult(doc: SearchDocument): SearchResult {
  // 🏢 ENTERPRISE: Extract stats from metadata if available
  let stats: SearchResultStat[] | undefined;

  if (doc.metadata) {
    const config = getSearchIndexConfig(doc.entityType);
    if (config) {
      // Convert metadata to Record<string, unknown> for extractStats
      const metadataRecord: Record<string, unknown> = {
        floor: doc.metadata.floor,
        area: doc.metadata.area,
        price: doc.metadata.price,
        type: doc.metadata.type,
      };
      const extractedStats = extractStats(metadataRecord, config);
      if (extractedStats.length > 0) {
        stats = extractedStats;
      }
    }
  }

  return {
    entityType: doc.entityType,
    entityId: doc.entityId,
    title: doc.title,
    subtitle: doc.subtitle,
    href: doc.links.href,
    status: doc.status, // 🏢 ENTERPRISE: Include status for badge display
    stats,
  };
}

// =============================================================================
// API HANDLER
// =============================================================================

/**
 * GET /api/search
 *
 * Search across all indexed entities with tenant isolation.
 *
 * Query Parameters:
 * - q: Search query (required, min 2 chars)
 * - types: Entity types filter (optional, comma-separated)
 * - limit: Results per type (optional, default 10, max 50)
 *
 * @enterprise
 * - Tenant isolation via companyId
 * - Permission-based filtering
 * - Audit logging (privacy-conscious)
 *
 * @rateLimit HIGH (100 req/min) - Global search endpoint (high traffic expected)
 */
const handleGET = withAuth<ApiSuccessResponse<SearchResponseData>>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    const adminDb = getAdminFirestore();
    if (!adminDb) {
      throw new Error('Database unavailable: Firebase Admin not initialized');
    }

    // === Parse Query Parameters ===
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const typesParam = searchParams.get('types');
    const limitParam = searchParams.get('limit');

    // === Validate Query ===
    if (!query || query.trim().length < SEARCH_CONFIG.MIN_QUERY_LENGTH) {
      return apiSuccess<SearchResponseData>(
        {
          results: [],
          query: { normalized: '' },
        },
        'Query too short'
      );
    }

    // === Normalize & Parse ===
    const normalizedQuery = normalizeSearchText(query);
    const entityTypes = parseEntityTypes(typesParam);
    const limit = parseLimit(limitParam);
    const tenantId = ctx.companyId;

    console.log(`🔍 [Search] Query: "${normalizedQuery}" | Tenant: ${tenantId} | Types: ${entityTypes?.join(',') || 'all'}`);

    // === Generate Search Prefixes ===
    const searchPrefixes = generateSearchPrefixes(normalizedQuery);

    // === Determine Entity Types to Search ===
    const typesToSearch = entityTypes || Object.values(SEARCH_ENTITY_TYPES);

    // === Build Collection Path ===
    // Note: Using root-level searchDocuments collection with tenantId filter
    // Alternative: /tenants/{tenantId}/searchDocuments (subcollection approach)
    const searchCollection = adminDb.collection(COLLECTIONS.SEARCH_DOCUMENTS);

    // === Execute Search Queries (one per entity type) ===
    // 🏢 ENTERPRISE: Optimized Firestore queries with composite indexes
    // Following Google/Microsoft/Salesforce patterns for search at scale
    // Requires: firestore.indexes.json deployed with composite index for searchDocuments
    const allResults: SearchResult[] = [];

    for (const entityType of typesToSearch) {
      try {
        // 🏢 ENTERPRISE: Composite index query
        // Index: tenantId + entityType + audience + search.prefixes (array-contains-any) + updatedAt
        let queryBuilder = searchCollection
          .where('tenantId', '==', tenantId)
          .where('entityType', '==', entityType)
          .where('audience', '==', SEARCH_AUDIENCE.INTERNAL);

        // 🔍 Prefix-based search (Firestore array-contains-any)
        // Limit to 10 prefixes per Firestore constraints
        if (searchPrefixes.length > 0) {
          const limitedPrefixes = searchPrefixes.slice(0, FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS);
          queryBuilder = queryBuilder.where('search.prefixes', 'array-contains-any', limitedPrefixes);
        }

        // Execute with ordering and limit
        const snapshot = await queryBuilder
          .orderBy('updatedAt', 'desc')
          .limit(limit)
          .get();

        // Transform results with secondary normalized text filter
        for (const doc of snapshot.docs) {
          const searchDoc = doc.data() as SearchDocument;

          // Secondary precision filter: verify normalized text contains query
          if (searchDoc.search.normalized.includes(normalizedQuery)) {
            allResults.push(transformToSearchResult(searchDoc));
          }
        }
      } catch (error) {
        // 🚨 Index missing error handling
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('index') || errorMessage.includes('FAILED_PRECONDITION')) {
          console.error(
            `🔍 [Search] Missing Firestore index for ${entityType}. ` +
            `Run: firebase deploy --only firestore:indexes`
          );
        } else {
          console.error(`🔍 [Search] Error searching ${entityType}:`, error);
        }
      }
    }

    console.log(`✅ [Search] Found ${allResults.length} results for tenant ${tenantId}`);

    // === Audit Logging (Privacy-Conscious) ===
    const auditMetadata: SearchAuditMetadata = {
      queryLength: query.length,
      resultCount: allResults.length,
      entityTypes: typesToSearch,
      audience: SEARCH_AUDIENCE.INTERNAL,
    };

    await logAuditEvent(
      ctx,
      'data_accessed',
      'global_search',
      'api',
      {
        previousValue: null,
        newValue: {
          type: 'status' as const,
          value: auditMetadata as unknown as Record<string, unknown>,
        },
        metadata: {
          path: '/api/search',
        },
      }
    );

    // === Return Response ===
    return apiSuccess<SearchResponseData>(
      {
        results: allResults,
        query: {
          normalized: normalizedQuery,
          types: entityTypes,
        },
      },
      `Found ${allResults.length} results`
    );
  },
  {
    permissions: 'search:global:execute',
  }
);

export const GET = withHighRateLimit(handleGET);
