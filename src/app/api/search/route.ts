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
import { FIELDS } from '@/config/firestore-field-constants';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { logAuditEvent } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { normalizeSearchText, generateSearchPrefixes } from '@/lib/search/search';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  SEARCH_ENTITY_TYPES,
  SEARCH_AUDIENCE,
  SEARCH_CONFIG,
  type SearchAuditMetadata,
} from '@/types/search';
import { grantedSearchEntityTypes } from '@/lib/search/search-access';
import { createModuleLogger } from '@/lib/telemetry';
import { parseEntityTypes, parseLimit } from './search-query-params';
import { collectSearchResults, type SearchResponseData } from './search-result-transform';

const logger = createModuleLogger('SearchRoute');

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
 * - Per-type permission filter inside the query, not after it (ADR-829 §7)
 * - Audit logging (privacy-conscious)
 *
 * @rateLimit HIGH (100 req/min) - Global search endpoint (high traffic expected)
 */
const handleGET = withAuth<ApiSuccessResponse<SearchResponseData>>(
  async (request: NextRequest, ctx: AuthContext, cache: PermissionCache) => {
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

    logger.info('[Search] Query', { normalizedQuery, tenantId, types: entityTypes?.join(',') || 'all' });

    // === Generate Search Prefixes ===
    const searchPrefixes = generateSearchPrefixes(normalizedQuery);

    // === Determine Entity Types to Search ===
    // ADR-829 §7: ό,τι δεν δικαιούται ο καλών δεν ρωτιέται καν. Το ίδιο σύνολο γράφεται στο audit.
    const typesToSearch = await grantedSearchEntityTypes(
      ctx,
      entityTypes || Object.values(SEARCH_ENTITY_TYPES),
      cache,
    );

    // === Build Collection Path ===
    // Note: Using root-level searchDocuments collection with tenantId filter
    // Alternative: /tenants/{tenantId}/searchDocuments (subcollection approach)
    const searchCollection = adminDb.collection(COLLECTIONS.SEARCH_DOCUMENTS);

    // === Execute Search Queries in parallel (Google pattern: Promise.allSettled) ===
    // All entity type queries fire simultaneously — latency = max(queries), not sum(queries).
    // Graceful degradation: one failing type (e.g. index still building) never kills the rest.
    const limitedPrefixes = searchPrefixes.slice(0, FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS);

    const queryResults = await Promise.allSettled(
      typesToSearch.map(async (entityType) => {
        let queryBuilder = searchCollection
          .where('tenantId', '==', tenantId)
          .where(FIELDS.ENTITY_TYPE, '==', entityType)
          .where('audience', '==', SEARCH_AUDIENCE.INTERNAL);

        if (limitedPrefixes.length > 0) {
          queryBuilder = queryBuilder.where('search.prefixes', 'array-contains-any', limitedPrefixes);
        }

        const snapshot = await queryBuilder
          .orderBy(FIELDS.UPDATED_AT, 'desc')
          .limit(limit)
          .get();

        return { entityType, docs: snapshot.docs };
      })
    );

    const allResults = collectSearchResults(queryResults, typesToSearch, normalizedQuery);

    logger.info('[Search] Found results', { count: allResults.length, tenantId });

    // === Audit Logging (Privacy-Conscious) ===
    const auditMetadata: SearchAuditMetadata = {
      queryLength: query.length,
      resultCount: allResults.length,
      entityTypes: typesToSearch,
      audience: SEARCH_AUDIENCE.INTERNAL,
    };

    // ADR-438 §2.5: ΣΚΟΠΙΜΑ ΧΩΡΙΣ `dedupable` — κάθε αναζήτηση = διακριτό γεγονός· το dedup key είναι σταθερό εδώ.
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
