/**
 * =============================================================================
 * 🔍 SEARCH INDEXER — Shared utility for creating searchDocuments entries
 * =============================================================================
 *
 * Provides reusable search document creation for both:
 * - Admin backfill (POST /api/admin/search-backfill)
 * - Server-side entity creation (AI pipeline, API routes)
 *
 * @module lib/search/search-indexer
 * @enterprise ADR-029 - Global Search v1
 * @see FIND-K: AI-created contacts must be searchable
 */

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { normalizeSearchText } from '@/lib/search/search';
import {
  getSearchIndexConfig,
  extractTitle,
  extractSubtitle,
  determineAudience,
  buildSearchResultHref,
} from '@/config/search-index-config';
import { SEARCH_ENTITY_TYPES, type SearchEntityType } from '@/types/search';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SearchIndexer');

// =============================================================================
// PREFIX GENERATION (same algorithm as search-backfill + /api/search)
// =============================================================================

const MAX_PREFIX_LENGTH = 5;

/**
 * Generate search prefixes (3-5 char) from normalized text.
 * Each word produces prefixes of length 3, 4, 5 for Firestore array-contains-any.
 */
export function generateSearchPrefixes(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const prefixes: Set<string> = new Set();
  for (const word of words) {
    for (let len = 3; len <= Math.min(MAX_PREFIX_LENGTH, word.length); len++) {
      prefixes.add(word.substring(0, len));
    }
  }
  return Array.from(prefixes);
}

// =============================================================================
// SEARCH DOCUMENT INDEXING
// =============================================================================

interface IndexEntityParams {
  entityType: SearchEntityType;
  entityId: string;
  entityData: Record<string, unknown>;
  tenantId: string;
}

/**
 * Index a single entity into the searchDocuments collection.
 * Non-fatal: logs errors but never throws (defense-in-depth).
 *
 * @param params - Entity to index
 */
export async function indexEntityForSearch(params: IndexEntityParams): Promise<void> {
  const { entityType, entityId, entityData, tenantId } = params;

  try {
    const config = getSearchIndexConfig(entityType);
    if (!config) {
      logger.warn('No search config for entity type', { entityType });
      return;
    }

    const title = extractTitle(entityData, config);
    const subtitle = extractSubtitle(entityData, config);
    const audience = determineAudience(entityData, config);

    // Build searchable text from configured fields
    const searchableText = config.searchableFields
      .map(field => {
        const value = entityData[field];
        return typeof value === 'string' && value.trim() ? value : '';
      })
      .filter(Boolean)
      .join(' ');

    const normalizedText = normalizeSearchText(searchableText);
    const prefixes = generateSearchPrefixes(normalizedText);

    if (!normalizedText || prefixes.length === 0) {
      logger.warn('Empty search text for entity', { entityType, entityId });
      return;
    }

    const searchDoc = {
      tenantId,
      entityType,
      entityId,
      title,
      subtitle,
      status: (entityData[config.statusField] as string) ?? 'active',
      search: { normalized: normalizedText, prefixes },
      audience,
      requiredPermission: config.requiredPermission,
      links: {
        href: buildSearchResultHref(config, entityId),
        routeParams: { id: entityId },
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      indexedAt: FieldValue.serverTimestamp(),
    };

    const db = getAdminFirestore();
    const docId = `${entityType}_${entityId}`;
    await db.collection(COLLECTIONS.SEARCH_DOCUMENTS).doc(docId).set(searchDoc);

    logger.info('Entity indexed for search', { entityType, entityId, docId });
  } catch (error) {
    // Non-fatal: search indexing failure should never block entity creation
    logger.error('Failed to index entity for search', {
      entityType,
      entityId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Convenience: Index a contact for search.
 * Used by createContactServerSide (FIND-K fix).
 */
export async function indexContactForSearch(
  contactId: string,
  contactData: Record<string, unknown>,
  companyId: string
): Promise<void> {
  return indexEntityForSearch({
    entityType: SEARCH_ENTITY_TYPES.CONTACT,
    entityId: contactId,
    entityData: contactData,
    tenantId: companyId,
  });
}
