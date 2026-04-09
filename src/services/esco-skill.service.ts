/**
 * ============================================================================
 * ESCO Skill Search Service (ADR-132)
 * ============================================================================
 *
 * Extracted from esco.service.ts (ADR-065 Phase 6).
 * Client-side service for searching ESCO skills from Firestore cache.
 *
 * @module services/esco-skill.service
 * @see src/types/contacts/esco-types.ts
 */

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('EscoSkillService');

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  EscoSkill,
  EscoSkillDocument,
  EscoSkillSearchParams,
  EscoSkillSearchResult,
  EscoSkillSearchResponse,
} from '@/types/contacts/esco-types';

// ============================================================================
// CONSTANTS
// ============================================================================

// SSoT: Collection name from centralized config
import { COLLECTIONS } from '@/config/firestore-collections';
const ESCO_SKILLS_COLLECTION = COLLECTIONS.ESCO_SKILLS_CACHE;
const DEFAULT_SEARCH_LIMIT = 20;
const MIN_QUERY_LENGTH = 2;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50;

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry {
  results: EscoSkillSearchResult[];
  total: number;
  timestamp: number;
}

const skillSearchCache = new Map<string, CacheEntry>();

// ============================================================================
// SEARCH UTILITIES
// ============================================================================

function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function queryToTokens(searchQuery: string): string[] {
  const normalized = normalizeForSearch(searchQuery);
  return normalized
    .split(/[\s,.\-/()]+/)
    .filter(token => token.length >= MIN_QUERY_LENGTH);
}

// ============================================================================
// ESCO SKILL SERVICE
// ============================================================================

export class EscoSkillService {
  /**
   * Search ESCO skills by text query.
   */
  static async searchSkills(params: EscoSkillSearchParams): Promise<EscoSkillSearchResponse> {
    const { query: searchQuery, language, limit: resultLimit = DEFAULT_SEARCH_LIMIT } = params;

    if (searchQuery.trim().length < MIN_QUERY_LENGTH) {
      return { results: [], total: 0, query: searchQuery, language };
    }

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

        const docTokens = language === 'el' ? data.searchTokensEl : data.searchTokensEn;
        const allTokensMatch = tokens.every(token =>
          docTokens.some(dt => dt.startsWith(token) || dt === token)
        );

        if (!allTokensMatch) return;

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

      results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const labelA = language === 'el' ? a.skill.preferredLabel.el : a.skill.preferredLabel.en;
        const labelB = language === 'el' ? b.skill.preferredLabel.el : b.skill.preferredLabel.en;
        return labelA.localeCompare(labelB, language);
      });

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
      logger.error('Skill search error', { error });
      return { results: [], total: 0, query: searchQuery, language };
    }
  }

  /**
   * Get a single ESCO skill by its URI.
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
      logger.error('Get skill by URI error', { error });
      return null;
    }
  }

  /**
   * Clear the in-memory skill search cache.
   */
  static clearCache(): void {
    skillSearchCache.clear();
  }
}
