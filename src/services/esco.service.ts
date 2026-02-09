/**
 * ============================================================================
 * ESCO Professional Classification Service (ADR-034)
 * ============================================================================
 *
 * Client-side service for searching and retrieving ESCO occupations
 * from the Firestore cache (system/esco_cache/occupations).
 *
 * Architecture:
 * - Firestore prefix search on pre-computed search tokens
 * - In-memory LRU cache for recent searches (reduces Firestore reads)
 * - Bilingual support (EL/EN) with language-specific token fields
 * - Fallback to ESCO REST API if Firestore cache is empty
 *
 * Usage:
 * ```typescript
 * import { EscoService } from '@/services/esco.service';
 *
 * const results = await EscoService.searchOccupations({
 *   query: 'Μηχαν',
 *   language: 'el',
 *   limit: 10,
 * });
 * ```
 *
 * @module services/esco.service
 * @see src/types/contacts/esco-types.ts
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  EscoOccupation,
  EscoOccupationDocument,
  EscoSearchParams,
  EscoSearchResult,
  EscoSearchResponse,
  EscoLanguage,
  EscoSkill,
  EscoSkillDocument,
  EscoSkillSearchParams,
  EscoSkillSearchResult,
  EscoSkillSearchResponse,
} from '@/types/contacts/esco-types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Firestore collection path for cached ESCO occupations */
const ESCO_COLLECTION = 'system/esco_cache/occupations';

/** Firestore collection path for cached ESCO skills (ADR-132) */
const ESCO_SKILLS_COLLECTION = 'system/esco_cache/skills';

/** Maximum results per search query */
const DEFAULT_SEARCH_LIMIT = 20;

/** Minimum query length to trigger search */
const MIN_QUERY_LENGTH = 2;

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Maximum entries in the in-memory cache */
const CACHE_MAX_ENTRIES = 50;

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

interface CacheEntry<T = EscoSearchResult[]> {
  results: T;
  total: number;
  timestamp: number;
}

/** Simple LRU cache for occupation search results */
const searchCache = new Map<string, CacheEntry<EscoSearchResult[]>>();

/** Simple LRU cache for skill search results (ADR-132) */
const skillSearchCache = new Map<string, CacheEntry<EscoSkillSearchResult[]>>();

/**
 * Generate a cache key from search params.
 */
function getCacheKey(params: EscoSearchParams): string {
  return `${params.language}:${params.query.toLowerCase().trim()}:${params.limit ?? DEFAULT_SEARCH_LIMIT}`;
}

/**
 * Get cached result if not expired.
 */
function getCachedResult(key: string): CacheEntry | null {
  const entry = searchCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }

  return entry;
}

/**
 * Store result in cache, evicting oldest if full.
 */
function setCachedResult(key: string, results: EscoSearchResult[], total: number): void {
  // Evict oldest entries if cache is full
  if (searchCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) {
      searchCache.delete(oldestKey);
    }
  }

  searchCache.set(key, {
    results,
    total,
    timestamp: Date.now(),
  });
}

// ============================================================================
// SEARCH TOKEN UTILITIES
// ============================================================================

/**
 * Normalize text for search: lowercase, remove diacritics.
 * Critical for Greek text where accents vary.
 */
function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Generate search tokens from a query string.
 * Same algorithm as the import script.
 */
function queryToTokens(query: string): string[] {
  const normalized = normalizeForSearch(query);
  return normalized
    .split(/[\s,.\-/()]+/)
    .filter(token => token.length >= MIN_QUERY_LENGTH);
}

// ============================================================================
// ESCO SERVICE
// ============================================================================

export class EscoService {
  /**
   * Search ESCO occupations by text query.
   *
   * Uses Firestore `array-contains` on pre-computed search tokens
   * for efficient prefix matching.
   *
   * @param params - Search parameters
   * @returns Search response with matched occupations
   */
  static async searchOccupations(params: EscoSearchParams): Promise<EscoSearchResponse> {
    const { query: searchQuery, language, limit: resultLimit = DEFAULT_SEARCH_LIMIT } = params;

    // Validate query length
    if (searchQuery.trim().length < MIN_QUERY_LENGTH) {
      return {
        results: [],
        total: 0,
        query: searchQuery,
        language,
      };
    }

    // Check in-memory cache
    const cacheKey = getCacheKey(params);
    const cached = getCachedResult(cacheKey);
    if (cached) {
      return {
        results: cached.results.slice(0, resultLimit),
        total: cached.total,
        query: searchQuery,
        language,
      };
    }

    // Generate search tokens
    const tokens = queryToTokens(searchQuery);
    if (tokens.length === 0) {
      return {
        results: [],
        total: 0,
        query: searchQuery,
        language,
      };
    }

    // Query Firestore using the first token (most selective)
    // Firestore `array-contains` only supports one value per query
    const primaryToken = tokens[0];
    const tokenField = language === 'el' ? 'searchTokensEl' : 'searchTokensEn';

    try {
      const collectionRef = collection(db, ESCO_COLLECTION);
      const q = query(
        collectionRef,
        where(tokenField, 'array-contains', primaryToken),
        firestoreLimit(resultLimit * 2) // Fetch extra for client-side filtering
      );

      const snapshot = await getDocs(q);

      // Convert to EscoOccupation and score results
      const results: EscoSearchResult[] = [];
      const normalizedQuery = normalizeForSearch(searchQuery);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as EscoOccupationDocument;

        // Client-side filtering: check if ALL tokens are present
        const docTokens = language === 'el' ? data.searchTokensEl : data.searchTokensEn;
        const allTokensMatch = tokens.every(token =>
          docTokens.some(dt => dt.startsWith(token) || dt === token)
        );

        if (!allTokensMatch) return;

        // Calculate relevance score
        const label = language === 'el'
          ? data.preferredLabel.el
          : data.preferredLabel.en;

        const normalizedLabel = normalizeForSearch(label);
        let score = 0;
        let matchedField: 'preferredLabel' | 'alternativeLabel' | 'iscoCode' = 'preferredLabel';

        // Exact match = highest score
        if (normalizedLabel === normalizedQuery) {
          score = 1.0;
        }
        // Starts with query = high score
        else if (normalizedLabel.startsWith(normalizedQuery)) {
          score = 0.9;
        }
        // Contains query = medium score
        else if (normalizedLabel.includes(normalizedQuery)) {
          score = 0.7;
        }
        // ISCO code match
        else if (data.iscoCode.startsWith(searchQuery)) {
          score = 0.8;
          matchedField = 'iscoCode';
        }
        // Token match = base score
        else {
          score = 0.5;

          // Check alternative labels for better match
          const altLabels = language === 'el'
            ? (data.alternativeLabels?.el ?? [])
            : (data.alternativeLabels?.en ?? []);

          for (const alt of altLabels) {
            const normalizedAlt = normalizeForSearch(alt);
            if (normalizedAlt.includes(normalizedQuery)) {
              score = 0.6;
              matchedField = 'alternativeLabel';
              break;
            }
          }
        }

        const occupation: EscoOccupation = {
          uri: data.uri,
          iscoCode: data.iscoCode,
          iscoGroup: data.iscoGroup,
          preferredLabel: data.preferredLabel,
          alternativeLabels: data.alternativeLabels
            ? { el: data.alternativeLabels.el ?? [], en: data.alternativeLabels.en ?? [] }
            : undefined,
        };

        results.push({ occupation, score, matchedField });
      });

      // Sort by score (descending), then by label (alphabetical)
      results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const labelA = language === 'el'
          ? a.occupation.preferredLabel.el
          : a.occupation.preferredLabel.en;
        const labelB = language === 'el'
          ? b.occupation.preferredLabel.el
          : b.occupation.preferredLabel.en;
        return labelA.localeCompare(labelB, language);
      });

      // Cache results
      setCachedResult(cacheKey, results, results.length);

      return {
        results: results.slice(0, resultLimit),
        total: results.length,
        query: searchQuery,
        language,
      };
    } catch (error) {
      console.error('[EscoService] Search error:', error);
      return {
        results: [],
        total: 0,
        query: searchQuery,
        language,
      };
    }
  }

  /**
   * Get a single ESCO occupation by its URI.
   *
   * @param uri - Full ESCO occupation URI
   * @returns The occupation or null if not found
   */
  static async getOccupationByUri(uri: string): Promise<EscoOccupation | null> {
    if (!uri) return null;

    try {
      // Extract document ID from URI
      const match = uri.match(/\/([a-f0-9-]+)$/i);
      if (!match) return null;

      const docId = match[1];
      const docRef = doc(db, ESCO_COLLECTION, docId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data() as EscoOccupationDocument;
      return {
        uri: data.uri,
        iscoCode: data.iscoCode,
        iscoGroup: data.iscoGroup,
        preferredLabel: data.preferredLabel,
        alternativeLabels: data.alternativeLabels
          ? { el: data.alternativeLabels.el ?? [], en: data.alternativeLabels.en ?? [] }
          : undefined,
        description: data.description,
      };
    } catch (error) {
      console.error('[EscoService] Get by URI error:', error);
      return null;
    }
  }

  /**
   * Get all ESCO occupations in a specific ISCO group.
   *
   * @param iscoGroup - 3-digit ISCO minor group code (e.g., "214")
   * @param language - Display language
   * @returns Array of occupations in the group
   */
  static async getOccupationsByIscoGroup(
    iscoGroup: string,
    language: EscoLanguage = 'el'
  ): Promise<EscoOccupation[]> {
    if (!iscoGroup || iscoGroup.length < 2) return [];

    try {
      const collectionRef = collection(db, ESCO_COLLECTION);
      const q = query(
        collectionRef,
        where('iscoGroup', '==', iscoGroup),
        orderBy(`preferredLabel.${language}`),
        firestoreLimit(100)
      );

      const snapshot = await getDocs(q);
      const occupations: EscoOccupation[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as EscoOccupationDocument;
        occupations.push({
          uri: data.uri,
          iscoCode: data.iscoCode,
          iscoGroup: data.iscoGroup,
          preferredLabel: data.preferredLabel,
          alternativeLabels: data.alternativeLabels
            ? { el: data.alternativeLabels.el ?? [], en: data.alternativeLabels.en ?? [] }
            : undefined,
        });
      });

      return occupations;
    } catch (error) {
      console.error('[EscoService] Get by ISCO group error:', error);
      return [];
    }
  }

  // ========================================================================
  // ESCO SKILLS (ADR-132)
  // ========================================================================

  /**
   * Search ESCO skills by text query.
   *
   * Uses Firestore `array-contains` on pre-computed search tokens
   * for efficient prefix matching. Same pattern as occupation search.
   *
   * @param params - Search parameters
   * @returns Search response with matched skills
   */
  static async searchSkills(params: EscoSkillSearchParams): Promise<EscoSkillSearchResponse> {
    const { query: searchQuery, language, limit: resultLimit = DEFAULT_SEARCH_LIMIT } = params;

    // Validate query length
    if (searchQuery.trim().length < MIN_QUERY_LENGTH) {
      return { results: [], total: 0, query: searchQuery, language };
    }

    // Check in-memory cache
    const cacheKey = `skill:${language}:${searchQuery.toLowerCase().trim()}:${resultLimit}`;
    const cached = skillSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp <= CACHE_TTL_MS) {
      return {
        results: cached.results.slice(0, resultLimit),
        total: cached.total,
        query: searchQuery,
        language,
      };
    }

    // Generate search tokens
    const tokens = queryToTokens(searchQuery);
    if (tokens.length === 0) {
      return { results: [], total: 0, query: searchQuery, language };
    }

    const primaryToken = tokens[0];
    const tokenField = language === 'el' ? 'searchTokensEl' : 'searchTokensEn';

    try {
      const collectionRef = collection(db, ESCO_SKILLS_COLLECTION);
      const q = query(
        collectionRef,
        where(tokenField, 'array-contains', primaryToken),
        firestoreLimit(resultLimit * 2)
      );

      const snapshot = await getDocs(q);
      const results: EscoSkillSearchResult[] = [];
      const normalizedQuery = normalizeForSearch(searchQuery);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as EscoSkillDocument;

        // Client-side filtering: check if ALL tokens are present
        const docTokens = language === 'el' ? data.searchTokensEl : data.searchTokensEn;
        const allTokensMatch = tokens.every(token =>
          docTokens.some(dt => dt.startsWith(token) || dt === token)
        );

        if (!allTokensMatch) return;

        // Calculate relevance score
        const label = language === 'el'
          ? data.preferredLabel.el
          : data.preferredLabel.en;

        const normalizedLabel = normalizeForSearch(label);
        let score = 0;
        let matchedField: 'preferredLabel' | 'alternativeLabel' = 'preferredLabel';

        if (normalizedLabel === normalizedQuery) {
          score = 1.0;
        } else if (normalizedLabel.startsWith(normalizedQuery)) {
          score = 0.9;
        } else if (normalizedLabel.includes(normalizedQuery)) {
          score = 0.7;
        } else {
          score = 0.5;

          // Check alternative labels
          const altLabels = language === 'el'
            ? (data.alternativeLabels?.el ?? [])
            : (data.alternativeLabels?.en ?? []);

          for (const alt of altLabels) {
            const normalizedAlt = normalizeForSearch(alt);
            if (normalizedAlt.includes(normalizedQuery)) {
              score = 0.6;
              matchedField = 'alternativeLabel';
              break;
            }
          }
        }

        const skill: EscoSkill = {
          uri: data.uri,
          preferredLabel: data.preferredLabel,
          alternativeLabels: data.alternativeLabels
            ? { el: data.alternativeLabels.el ?? [], en: data.alternativeLabels.en ?? [] }
            : undefined,
        };

        results.push({ skill, score, matchedField });
      });

      // Sort by score (descending), then alphabetically
      results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const labelA = language === 'el' ? a.skill.preferredLabel.el : a.skill.preferredLabel.en;
        const labelB = language === 'el' ? b.skill.preferredLabel.el : b.skill.preferredLabel.en;
        return labelA.localeCompare(labelB, language);
      });

      // Cache results
      if (skillSearchCache.size >= CACHE_MAX_ENTRIES) {
        const oldestKey = skillSearchCache.keys().next().value;
        if (oldestKey !== undefined) {
          skillSearchCache.delete(oldestKey);
        }
      }
      skillSearchCache.set(cacheKey, { results, total: results.length, timestamp: Date.now() });

      return {
        results: results.slice(0, resultLimit),
        total: results.length,
        query: searchQuery,
        language,
      };
    } catch (error) {
      console.error('[EscoService] Skill search error:', error);
      return { results: [], total: 0, query: searchQuery, language };
    }
  }

  /**
   * Get a single ESCO skill by its URI.
   *
   * @param uri - Full ESCO skill URI
   * @returns The skill or null if not found
   */
  static async getSkillByUri(uri: string): Promise<EscoSkill | null> {
    if (!uri) return null;

    try {
      const match = uri.match(/\/([a-f0-9-]+)$/i);
      if (!match) return null;

      const docId = match[1];
      const docRef = doc(db, ESCO_SKILLS_COLLECTION, docId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data() as EscoSkillDocument;
      return {
        uri: data.uri,
        preferredLabel: data.preferredLabel,
        alternativeLabels: data.alternativeLabels
          ? { el: data.alternativeLabels.el ?? [], en: data.alternativeLabels.en ?? [] }
          : undefined,
      };
    } catch (error) {
      console.error('[EscoService] Get skill by URI error:', error);
      return null;
    }
  }

  /**
   * Clear the in-memory search cache (occupations + skills).
   * Useful when the Firestore cache is updated.
   */
  static clearCache(): void {
    searchCache.clear();
    skillSearchCache.clear();
  }
}
