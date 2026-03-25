/**
 * =============================================================================
 * ESCO SEARCH UTILITIES — Shared ESCO search logic
 * =============================================================================
 *
 * Extracted from utility-handler.ts to allow reuse in contact-handler.ts
 * (server-side ESCO enforcement) without duplication.
 *
 * @module services/ai-pipeline/tools/esco-search-utils
 * @see ADR-132 (ESCO Integration)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// TYPES
// ============================================================================

export interface EscoOccupationMatch {
  labelEl: string;
  labelEn: string;
  iscoCode: string;
  uri: string;
  score: number;
}

export interface EscoSkillMatch {
  labelEl: string;
  labelEn: string;
  uri: string;
  score: number;
}

// ============================================================================
// TEXT NORMALIZATION
// ============================================================================

/**
 * Normalize Greek text: lowercase + strip diacritics.
 * Same algorithm as client-side esco.service.ts.
 */
export function normalizeEsco(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Extract search tokens from query (min 2 chars per word).
 */
export function queryToTokens(query: string): string[] {
  return normalizeEsco(query)
    .split(/[\s,.\-/()]+/)
    .filter(t => t.length >= 2);
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Search ESCO occupations by query string.
 * Returns scored results sorted by relevance.
 */
export async function searchEscoOccupations(
  query: string,
  limit = 10
): Promise<EscoOccupationMatch[]> {
  const tokens = queryToTokens(query);
  if (tokens.length === 0) return [];

  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.ESCO_CACHE)
    .where('searchTokensEl', 'array-contains', tokens[0])
    .limit(40)
    .get();

  const normalizedQuery = normalizeEsco(query);

  return snap.docs
    .map(d => d.data())
    .filter(occ => {
      const allTokens = (occ.searchTokensEl as string[]) ?? [];
      return tokens.every(t => allTokens.some(st => st.startsWith(t)));
    })
    .map(occ => {
      const label = occ.preferredLabel as Record<string, string>;
      const normalizedLabel = normalizeEsco(label.el ?? '');
      const score = normalizedLabel === normalizedQuery ? 1.0
        : normalizedLabel.startsWith(normalizedQuery) ? 0.9
        : normalizedLabel.includes(normalizedQuery) ? 0.7
        : 0.5;
      return {
        labelEl: label.el ?? '',
        labelEn: label.en ?? '',
        iscoCode: String(occ.iscoCode ?? ''),
        uri: String(occ.uri ?? ''),
        score,
      };
    })
    .sort((a, b) => b.score - a.score || a.labelEl.localeCompare(b.labelEl))
    .slice(0, limit);
}

/**
 * Search ESCO skills by query string.
 * Returns scored results sorted by relevance.
 */
export async function searchEscoSkills(
  query: string,
  limit = 10
): Promise<EscoSkillMatch[]> {
  const tokens = queryToTokens(query);
  if (tokens.length === 0) return [];

  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.ESCO_SKILLS_CACHE)
    .where('searchTokensEl', 'array-contains', tokens[0])
    .limit(40)
    .get();

  const normalizedQuery = normalizeEsco(query);

  return snap.docs
    .map(d => d.data())
    .filter(skill => {
      const allTokens = (skill.searchTokensEl as string[]) ?? [];
      return tokens.every(t => allTokens.some(st => st.startsWith(t)));
    })
    .map(skill => {
      const label = skill.preferredLabel as Record<string, string>;
      const normalizedLabel = normalizeEsco(label.el ?? '');
      const score = normalizedLabel === normalizedQuery ? 1.0
        : normalizedLabel.startsWith(normalizedQuery) ? 0.9
        : normalizedLabel.includes(normalizedQuery) ? 0.7
        : 0.5;
      return {
        labelEl: label.el ?? '',
        labelEn: label.en ?? '',
        uri: String(skill.uri ?? ''),
        score,
      };
    })
    .sort((a, b) => b.score - a.score || a.labelEl.localeCompare(b.labelEl))
    .slice(0, limit);
}

// ============================================================================
// ENFORCEMENT HELPERS
// ============================================================================

export interface EscoEnforcementResult {
  allowed: boolean;
  matches?: Array<{ labelEl: string; labelEn: string; iscoCode?: string; uri: string }>;
}

/**
 * Server-side ESCO occupation enforcement.
 * If profession text matches ESCO entries → REJECT (force user to choose).
 * If no matches → ALLOW (free-text OK).
 */
export async function enforceEscoOccupation(
  profession: string
): Promise<EscoEnforcementResult> {
  const matches = await searchEscoOccupations(profession, 10);
  if (matches.length === 0) return { allowed: true };

  return {
    allowed: false,
    matches: matches.map(m => ({
      labelEl: m.labelEl,
      labelEn: m.labelEn,
      iscoCode: m.iscoCode,
      uri: m.uri,
    })),
  };
}

/**
 * Server-side ESCO skill enforcement.
 * If skill label matches multiple ESCO entries → REJECT (force user to choose).
 * If 0-1 matches → ALLOW.
 */
export async function enforceEscoSkill(
  skillLabel: string
): Promise<EscoEnforcementResult> {
  const matches = await searchEscoSkills(skillLabel, 10);
  if (matches.length <= 1) return { allowed: true };

  return {
    allowed: false,
    matches: matches.map(m => ({
      labelEl: m.labelEl,
      labelEn: m.labelEn,
      uri: m.uri,
    })),
  };
}
