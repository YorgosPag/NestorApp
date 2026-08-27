/**
 * ADR-132 — **Η ΑΝΑΖΗΤΗΣΗ ΠΡΟΘΕΜΑΤΟΣ ΣΤΟ ESCO**, μία φορά για επαγγέλματα
 * **και** δεξιότητες.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΡΕΙΣ ΚΛΩΝΟΙ, ΜΕΤΡΗΜΕΝΟΙ ΑΠΟ ΤΟ CHECK 3.28
 *
 * Τα `esco.service.ts` και `esco-skill.service.ts` ήταν **παράλληλα δίδυμα**: το
 * jscpd μέτρησε **τρεις** κλώνους ανάμεσά τους *(65 · 89 · 77 tokens)* — το
 * ερώτημα Firestore, το φιλτράρισμα «όλα τα tokens», η βαθμολόγηση, η ταξινόμηση
 * και η LRU μνήμη, γραμμένα δύο φορές. Ό,τι διέφερε ήταν **τέσσερα πράγματα**:
 * η συλλογή · ο τύπος εγγράφου · η χαρτογράφηση σε τομέα · και ένα **επιπλέον
 * σκαλοπάτι** *(ο κωδικός ISCO, που οι δεξιότητες δεν έχουν)*.
 *
 * Αυτά τα τέσσερα είναι **παράμετροι**, όχι λόγος για δεύτερη υλοποίηση.
 *
 * ⚠️ **ΤΟ ΟΡΙΟ ΤΟΥ FIRESTORE ΠΟΥ ΟΡΙΖΕΙ ΤΗ ΣΧΕΔΙΑΣΗ**: το `array-contains`
 * δέχεται **μία** τιμή ανά ερώτημα. Άρα ρωτάμε με το **πρώτο** token και
 * φιλτράρουμε τα υπόλοιπα **στον πελάτη** — γι' αυτό ζητάμε `limit × 2`
 * έγγραφα. Δεν είναι ατέλεια· είναι το συμβόλαιο του ευρετηρίου.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * @module lib/esco/token-search
 */

import { collection, query, where, getDocs, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import type { EscoLanguage } from '@/types/contacts/esco-types';
import { normalizeEscoText, escoQueryTokens, ESCO_MIN_TOKEN_LENGTH } from './search-tokens';
import { judgeEscoRelevance, type EscoMatchedField } from './relevance';

const logger = createModuleLogger('EscoTokenSearch');

/** Διάρκεια ζωής της μνήμης αναζήτησης. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Πόσες ερωτήσεις κρατά η μνήμη πριν διώξει την παλαιότερη. */
const CACHE_MAX_ENTRIES = 50;

/** Ό,τι **πρέπει** να έχει ένα έγγραφο για να είναι αναζητήσιμο με προθέματα. */
export interface EscoIndexedDocument {
  readonly searchTokensEl: string[];
  readonly searchTokensEn: string[];
  readonly preferredLabel: { readonly el: string; readonly en: string };
  readonly alternativeLabels?: { readonly el?: string[]; readonly en?: string[] };
}

/** Ένα βαθμολογημένο αποτέλεσμα, πριν πάρει το σχήμα του τομέα του. */
export interface EscoScoredHit<TItem> {
  readonly item: TItem;
  readonly score: number;
  readonly matchedField: EscoMatchedField;
}

export interface EscoTokenSearchOutcome<TItem> {
  readonly hits: readonly EscoScoredHit<TItem>[];
  /** Πόσα ταίριαξαν **συνολικά** — όχι πόσα επιστράφηκαν. */
  readonly total: number;
}

export interface EscoTokenSearchRequest<TDoc extends EscoIndexedDocument, TItem> {
  readonly collectionPath: string;
  /** Διακρίνει τις μνήμες των λεξιλογίων μέσα στην **κοινή** LRU. */
  readonly cacheNamespace: string;
  readonly rawQuery: string;
  readonly language: EscoLanguage;
  readonly limit: number;
  readonly toItem: (data: TDoc) => TItem;
  readonly labelOf: (item: TItem, language: EscoLanguage) => string;
  /**
   * Το **δευτερεύον κλειδί** του λεξιλογίου *(στα επαγγέλματα: ο κωδικός ISCO)*.
   * Παραλείπεται όπου δεν υπάρχει — και τότε το σκαλοπάτι απλώς δεν παίζει.
   */
  readonly secondaryKeyMatches?: (data: TDoc, rawQuery: string) => boolean;
}

interface CacheEntry {
  readonly hits: readonly EscoScoredHit<unknown>[];
  readonly total: number;
  readonly timestamp: number;
}

/**
 * **Μία** LRU για όλα τα λεξιλόγια — το `cacheNamespace` τα κρατά χωριστά.
 *
 * ⚠️ Δύο ξεχωριστές μνήμες θα ήταν δύο πολιτικές εξώσεως που θα απέκλιναν με
 * την πρώτη αλλαγή· αυτό ακριβώς είχε ήδη συμβεί *(η μία έκανε έξωση, η άλλη
 * ενσωμάτωνε τον έλεγχο μέσα στη ροή)*.
 */
const searchCache = new Map<string, CacheEntry>();

function cacheKeyOf(namespace: string, language: string, rawQuery: string, limit: number): string {
  // Κανονικοποιημένο κλειδί: «Μηχανικός» και «μηχανικος» δίνουν αποδεδειγμένα
  // ΤΟ ΙΔΙΟ αποτέλεσμα (η αναζήτηση αγνοεί τόνους), οπότε ήταν σπατάλη να
  // κρατούν χωριστές εγγραφές.
  return `${namespace}:${language}:${normalizeEscoText(rawQuery)}:${limit}`;
}

function readCache(key: string): CacheEntry | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return entry;
}

function writeCache(key: string, hits: readonly EscoScoredHit<unknown>[], total: number): void {
  if (searchCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(key, { hits, total, timestamp: Date.now() });
}

/** Καθαρίζει τη μνήμη. Υπάρχει **για τις άγκυρες** — καμία παραγωγική κλήση. */
export function clearEscoSearchCache(): void {
  searchCache.clear();
}

/** Τα tokens ενός εγγράφου στη γλώσσα του ερωτήματος. */
function documentTokens(data: EscoIndexedDocument, language: EscoLanguage): string[] {
  return language === 'el' ? data.searchTokensEl : data.searchTokensEn;
}

/** Τα συνώνυμα ενός εγγράφου στη γλώσσα του ερωτήματος. */
function documentAlternatives(data: EscoIndexedDocument, language: EscoLanguage): string[] {
  return (language === 'el' ? data.alternativeLabels?.el : data.alternativeLabels?.en) ?? [];
}

/**
 * Αναζήτηση προθέματος με ταξινόμηση κατά συνάφεια — **κοινή** για κάθε
 * λεξιλόγιο ESCO.
 *
 * ⚠️ Ποτέ δεν πετά: σφάλμα Firestore καταγράφεται και επιστρέφεται **άδειο**
 * αποτέλεσμα, όπως και πριν — η αναζήτηση είναι βοήθημα, όχι κρίσιμη διαδρομή.
 */
export async function searchEscoByTokens<TDoc extends EscoIndexedDocument, TItem>(
  request: EscoTokenSearchRequest<TDoc, TItem>,
): Promise<EscoTokenSearchOutcome<TItem>> {
  const { rawQuery, language, limit } = request;
  if (rawQuery.trim().length < ESCO_MIN_TOKEN_LENGTH) return { hits: [], total: 0 };

  const tokens = escoQueryTokens(rawQuery);
  if (tokens.length === 0) return { hits: [], total: 0 };

  const key = cacheKeyOf(request.cacheNamespace, language, rawQuery, limit);
  const cached = readCache(key);
  if (cached) {
    return { hits: cached.hits.slice(0, limit) as EscoScoredHit<TItem>[], total: cached.total };
  }

  try {
    const snapshot = await getDocs(
      query(
        // companyId: N/A — δημόσια ταξινομία της ΕΕ (system/esco_cache/**),
        // κοινή σε όλους τους ενοικιαστές.
        collection(db, request.collectionPath),
        where(language === 'el' ? 'searchTokensEl' : 'searchTokensEn', 'array-contains', tokens[0]),
        firestoreLimit(limit * 2),
      ),
    );

    const hits = scoreSnapshot(snapshot.docs.map((d) => d.data() as TDoc), tokens, request);
    writeCache(key, hits, hits.length);
    return { hits: hits.slice(0, limit), total: hits.length };
  } catch (error) {
    logger.error('ESCO token search failed', { collection: request.collectionPath, error });
    return { hits: [], total: 0 };
  }
}

/** Φιλτράρει *(όλα τα tokens)*, βαθμολογεί και ταξινομεί. */
function scoreSnapshot<TDoc extends EscoIndexedDocument, TItem>(
  documents: readonly TDoc[],
  tokens: readonly string[],
  request: EscoTokenSearchRequest<TDoc, TItem>,
): EscoScoredHit<TItem>[] {
  const { language, rawQuery } = request;
  const normalizedQuery = normalizeEscoText(rawQuery);
  const hits: EscoScoredHit<TItem>[] = [];

  for (const data of documents) {
    const docTokens = documentTokens(data, language);
    const allTokensMatch = tokens.every((token) =>
      docTokens.some((docToken) => docToken.startsWith(token)),
    );
    if (!allTokensMatch) continue;

    const item = request.toItem(data);
    const verdict = judgeEscoRelevance({
      normalizedLabel: normalizeEscoText(request.labelOf(item, language)),
      normalizedQuery,
      alternatives: documentAlternatives(data, language),
      secondaryKeyMatches: request.secondaryKeyMatches?.(data, rawQuery) ?? false,
    });
    hits.push({ item, score: verdict.score, matchedField: verdict.matchedField });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return request
      .labelOf(a.item, language)
      .localeCompare(request.labelOf(b.item, language), language);
  });
  return hits;
}
