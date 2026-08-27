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
import { compareByLocale } from '@/lib/intl-formatting';
import { normalizeEscoText, escoQueryTokens } from '@/lib/esco/search-tokens';
import { judgeEscoRelevance } from '@/lib/esco/relevance';

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
// TEXT NORMALIZATION — ΔΕΝ ΖΕΙ ΕΔΩ (ADR-132)
// ============================================================================

/*
 * 🔑 Ήταν το **πέμπτο** αντίγραφο του τοκενιστή ESCO, και το σχόλιό του έγραφε
 * «Same algorithm as client-side esco.service.ts» — σχόλιο εκεί που έπρεπε να
 * υπάρχει module. Ο αλγόριθμος ζει πλέον στο `@/lib/esco/search-tokens`, μαζί
 * με την **πλευρά γραφής** του εισαγωγέα: αν οι δύο πλευρές αποκλίνουν, το
 * `array-contains` επιστρέφει άδεια λίστα **χωρίς κανένα σφάλμα**.
 *
 * Τα ονόματα διατηρούνται ως **επανεξαγωγές**: το
 * `__tests__/esco-search-utils.test.ts` τα εκτελεί, και η άγκυρα πρέπει να
 * συνεχίσει να τρέχει πάνω στη ΝΕΑ διαδρομή.
 */
export {
  normalizeEscoText as normalizeEsco,
  escoQueryTokens as queryToTokens,
} from '@/lib/esco/search-tokens';


// ============================================================================
// MULTI-TOKEN FIRESTORE SEARCH (shared helper)
// ============================================================================

/**
 * Query Firestore trying each token until results are found.
 *
 * Firestore `array-contains` supports only 1 value per query.
 * Old approach: used only tokens[0] → missed results when the first
 * word didn't exist in any document (e.g. "τεχνίτης κρεάτων" — "τεχνιτης"
 * has 0 hits, but "κρεατ" would match "κρεοπώλης").
 *
 * New approach: try tokens in order; stop at the first token that returns
 * results. Client-side filter then enforces ALL tokens match.
 * If no single token yields results → return empty.
 */
async function queryWithTokenFallback(
  collection: string,
  tokens: string[],
  perQueryLimit = 40
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const db = getAdminFirestore();

  for (const token of tokens) {
    const snap = await db
      .collection(collection)
      .where('searchTokensEl', 'array-contains', token)
      .limit(perQueryLimit)
      .get();

    if (!snap.empty) return snap.docs;
  }

  return [];
}

// ============================================================================
// ΒΑΘΜΟΛΟΓΗΣΗ + ΧΑΡΤΟΓΡΑΦΗΣΗ — ΜΙΑ ΦΟΡΑ ΓΙΑ ΤΑ ΔΥΟ ΛΕΞΙΛΟΓΙΑ
// ============================================================================

/**
 * Φιλτράρει *(όλα τα tokens)*, βαθμολογεί με την **κοινή** κλίμακα και ταξινομεί.
 *
 * 🔴 Ήταν γραμμένο **δύο φορές** μέσα σε αυτό το αρχείο *(επαγγέλματα +
 * δεξιότητες, 57 tokens κλώνος, CHECK 3.28)* και η κλίμακά του είχε **αποκλίνει**
 * από την πλευρά του πελάτη: εδώ έλειπε το σκαλοπάτι των **συνωνύμων**, δηλαδή ο
 * διακομιστής επέβαλλε *«διάλεξε από τη λίστα»* με **άλλη κατάταξη** από αυτήν
 * που έβλεπε ο άνθρωπος. Πλέον η κλίμακα ζει στο `@/lib/esco/relevance`.
 */
function scoreEscoDocuments<TMatch extends { labelEl: string; score: number }>(
  documents: readonly FirebaseFirestore.DocumentData[],
  tokens: readonly string[],
  normalizedQuery: string,
  toMatch: (data: FirebaseFirestore.DocumentData, score: number) => TMatch,
  limit: number,
): TMatch[] {
  return documents
    .filter((data) => {
      const documentTokens = (data.searchTokensEl as string[]) ?? [];
      return tokens.every((token) => documentTokens.some((st) => st.startsWith(token)));
    })
    .map((data) => {
      const label = data.preferredLabel as Record<string, string> | undefined;
      const alternatives = (data.alternativeLabels as Record<string, string[]> | undefined)?.el;
      const verdict = judgeEscoRelevance({
        normalizedLabel: normalizeEscoText(label?.el ?? ''),
        normalizedQuery,
        alternatives,
      });
      return toMatch(data, verdict.score);
    })
    .sort((a, b) => b.score - a.score || compareByLocale(a.labelEl, b.labelEl))
    .slice(0, limit);
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Search ESCO occupations by query string.
 * Tries each token against Firestore until results are found,
 * then filters client-side to ensure ALL tokens match.
 */
export async function searchEscoOccupations(
  query: string,
  limit = 10
): Promise<EscoOccupationMatch[]> {
  const tokens = escoQueryTokens(query);
  if (tokens.length === 0) return [];

  const docs = await queryWithTokenFallback(COLLECTIONS.ESCO_CACHE, tokens);

  return scoreEscoDocuments(
    docs.map((d) => d.data()),
    tokens,
    normalizeEscoText(query),
    (occupation, score) => {
      const label = occupation.preferredLabel as Record<string, string> | undefined;
      return {
        labelEl: label?.el ?? '',
        labelEn: label?.en ?? '',
        iscoCode: String(occupation.iscoCode ?? ''),
        uri: String(occupation.uri ?? ''),
        score,
      };
    },
    limit,
  );
}

/**
 * Search ESCO skills by query string.
 * Tries each token against Firestore until results are found,
 * then filters client-side to ensure ALL tokens match.
 */
export async function searchEscoSkills(
  query: string,
  limit = 10
): Promise<EscoSkillMatch[]> {
  const tokens = escoQueryTokens(query);
  if (tokens.length === 0) return [];

  const docs = await queryWithTokenFallback(COLLECTIONS.ESCO_SKILLS_CACHE, tokens);

  return scoreEscoDocuments(
    docs.map((d) => d.data()),
    tokens,
    normalizeEscoText(query),
    (skill, score) => {
      const label = skill.preferredLabel as Record<string, string> | undefined;
      return {
        labelEl: label?.el ?? '',
        labelEn: label?.en ?? '',
        uri: String(skill.uri ?? ''),
        score,
      };
    },
    limit,
  );
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
  // 0-1 matches = unambiguous (free-text or single match)
  if (matches.length <= 1) return { allowed: true };

  // >1 matches = ambiguous → requires user disambiguation
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
