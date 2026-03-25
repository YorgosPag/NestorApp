/**
 * SEARCH TEXT HANDLER — Scored multi-word text search across Firestore collections
 *
 * Extracted from firestore-handler.ts for SRP compliance.
 * Supports Greek ↔ Latin transliteration, stemming, and prefix matching.
 * ALL search words must match for a result to be included (not just any).
 * Results are scored: exact word = 3pts, stem/latin = 2pts, prefix = 1pt.
 *
 * @module services/ai-pipeline/tools/handlers/search-text-handler
 * @see ADR-171 (Autonomous AI Agent)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { greekToLatin, stripDiacritics, stemGreekWord } from '../../shared/greek-nlp';
import {
  type AgenticContext,
  type ToolResult,
  redactSensitiveFields,
  redactRoleBlockedFields,
  ALLOWED_READ_COLLECTIONS,
} from '../executor-shared';
import { filterContactByTab, resolveContactType } from '../contact-tab-filter';

// ============================================================================
// CONSTANTS
// ============================================================================

const SEARCH_FIELDS = [
  'name', 'displayName', 'title', 'description',
  'firstName', 'lastName', 'tradeName',
] as const;

const MAX_FIRESTORE_SCAN = 100;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

// Match quality scores
const SCORE_EXACT = 3;
const SCORE_STEM_LATIN = 2;
const SCORE_PREFIX = 1;

// ============================================================================
// MAIN
// ============================================================================

/**
 * Execute scored text search across one or more Firestore collections.
 *
 * For multi-word queries (e.g. "Αλέξανδρο Δοκιμόπουλο"), ALL words must
 * match via at least one variant (exact, stem, latin, prefix). Results are
 * ranked by match quality so exact matches appear first.
 */
export async function executeSearchText(
  args: Record<string, unknown>,
  ctx: AgenticContext
): Promise<ToolResult> {
  const searchTerm = stripDiacritics(String(args.searchTerm ?? '').toLowerCase());
  const words = searchTerm.split(/\s+/).filter(w => w.length >= 2);

  const collections = Array.isArray(args.collections)
    ? (args.collections as string[]).filter(c => ALLOWED_READ_COLLECTIONS.has(c))
    : [];
  const limit = Math.min(
    typeof args.limit === 'number' ? args.limit : DEFAULT_LIMIT,
    MAX_LIMIT
  );

  if (!searchTerm || collections.length === 0) {
    return { success: false, error: 'searchTerm and collections are required' };
  }

  // Build per-word variant groups (preserves index correspondence)
  const wordVariants = buildWordVariants(words);

  const db = getAdminFirestore();
  const allResults: Record<string, Array<Record<string, unknown>>> = {};
  let totalCount = 0;

  for (const collection of collections) {
    const snap = await db
      .collection(collection)
      .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
      .limit(MAX_FIRESTORE_SCAN)
      .get();

    const tabFilter = typeof args.tabFilter === 'string' ? args.tabFilter : null;

    const scored = snap.docs
      .map(doc => ({ doc, score: scoreDocument(doc.data(), wordVariants) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const matches = scored.map(({ doc }) => {
      let result: Record<string, unknown> = {
        id: doc.id,
        ...redactRoleBlockedFields(redactSensitiveFields(doc.data()), ctx),
      };
      if (tabFilter && collection === COLLECTIONS.CONTACTS) {
        const contactType = resolveContactType(result);
        result = filterContactByTab(result, contactType, tabFilter);
      }
      return result;
    });

    if (matches.length > 0) {
      allResults[collection] = matches;
      totalCount += matches.length;
    }
  }

  return { success: true, data: allResults, count: totalCount };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build variant groups per word: [exact, latin, stem, prefixes].
 * Index correspondence is preserved so we can require ALL words to match.
 */
function buildWordVariants(words: string[]): string[][] {
  return words.map(word => {
    const latin = greekToLatin(word) || '';
    const stem = stemGreekWord(word) || '';
    const variants = [word];
    if (latin) variants.push(latin);
    if (stem.length >= 2 && stem !== word) variants.push(stem);
    if (word.length >= 4) {
      const prefix = word.substring(0, 4);
      if (!variants.includes(prefix)) variants.push(prefix);
    }
    if (latin.length >= 4) {
      const lp = latin.substring(0, 4);
      if (!variants.includes(lp)) variants.push(lp);
    }
    return variants;
  });
}

/**
 * Score a document against all word variant groups.
 * Returns 0 if ANY word has no match (doc is rejected).
 */
function scoreDocument(
  data: Record<string, unknown>,
  wordVariants: string[][]
): number {
  const docText = buildDocSearchText(data);
  let total = 0;

  for (const variants of wordVariants) {
    const exact = docText.includes(variants[0]);
    const stemOrLatin = !exact
      && variants.slice(1, 3).some(v => v && docText.includes(v));
    const prefix = !exact && !stemOrLatin
      && variants.slice(3).some(v => v && docText.includes(v));

    if (exact) total += SCORE_EXACT;
    else if (stemOrLatin) total += SCORE_STEM_LATIN;
    else if (prefix) total += SCORE_PREFIX;
    else return 0; // word not found → reject document
  }

  return total;
}

/**
 * Build a single searchable string from all text fields of a document.
 * Includes normalized, transliterated, and stemmed forms.
 */
function buildDocSearchText(data: Record<string, unknown>): string {
  return SEARCH_FIELDS
    .map(field => {
      const val = data[field];
      if (typeof val !== 'string') return '';
      const norm = stripDiacritics(val.toLowerCase());
      const latin = greekToLatin(norm) || '';
      const stem = stemGreekWord(norm) || '';
      return [norm, latin, stem].filter(Boolean).join(' ');
    })
    .filter(Boolean)
    .join(' ');
}
