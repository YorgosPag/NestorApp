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
import { normalizeSearchText, generateSearchPrefixes } from '@/lib/search/search';
import { writeSearchIndexEntry } from '@/lib/search/search-index-write';
import type { CommitVersion } from '@/lib/search/search-index-version';
import {
  getSearchIndexConfig,
  extractTitle,
  extractSubtitle,
  determineAudience,
  extractSearchableText,
  extractStatus,
  buildSearchResultHref,
  generateSearchDocId,
} from '@/config/search-index-config';
import { SEARCH_ENTITY_TYPES, type SearchEntityType } from '@/types/search';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SearchIndexer');

// =============================================================================
// SEARCH DOCUMENT INDEXING
// =============================================================================

interface IndexEntityParams {
  entityType: SearchEntityType;
  entityId: string;
  entityData: Record<string, unknown>;
  tenantId: string;
  /**
   * Η έκδοση commit της οντότητας, από το στιγμιότυπο που τη διάβασε (ADR-873 Φ1).
   *
   * 🔑 Πέρασέ τη **όποτε την έχεις** (`entityCommitVersion(snapshot)`): είναι το ίδιο νούμερο
   * που βλέπει ο trigger, άρα οι δύο δρόμοι προς το ευρετήριο συγκρίνονται αντί να
   * αλληλοσβήνονται. Χωρίς αυτήν η γραφή περνά πάντα — σωστό, αλλά τυφλό.
   */
  sourceUpdateTime?: CommitVersion | null;
}

/**
 * Index a single entity into the searchDocuments collection.
 * Non-fatal: logs errors but never throws (defense-in-depth).
 *
 * @param params - Entity to index
 */
export async function indexEntityForSearch(params: IndexEntityParams): Promise<void> {
  const { entityType, entityId, entityData, tenantId, sourceUpdateTime = null } = params;

  try {
    const config = getSearchIndexConfig(entityType);
    if (!config) {
      logger.warn('No search config for entity type', { entityType });
      return;
    }

    const title = extractTitle(entityData, config);
    const subtitle = extractSubtitle(entityData, config);
    const audience = determineAudience(entityData, config);

    const searchableText = extractSearchableText(entityData, config);

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
      status: extractStatus(entityData, config),
      search: { normalized: normalizedText, prefixes },
      audience,
      requiredPermission: config.requiredPermission,
      links: {
        href: buildSearchResultHref(config, entityId, entityData),
        routeParams: { id: entityId },
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      indexedAt: FieldValue.serverTimestamp(),
    };

    const db = getAdminFirestore();
    const docId = generateSearchDocId(entityType, entityId);
    // ΕΝΑΣ γραφέας, ένας φράχτης: ποτέ ωμό `set()` εδώ — θα έσβηνε το `sourceUpdateTime` και
    // το ευρετήριο θα ξαναγινόταν τυφλό μέχρι την επόμενη εγγραφή οντότητας (ADR-873 §9.1.2).
    const outcome = await writeSearchIndexEntry(db, docId, searchDoc, sourceUpdateTime);

    logger.info('Entity indexed for search', { entityType, entityId, docId, outcome });
  } catch (error) {
    // Non-fatal: search indexing failure should never block entity creation
    logger.error('Failed to index entity for search', {
      entityType,
      entityId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

