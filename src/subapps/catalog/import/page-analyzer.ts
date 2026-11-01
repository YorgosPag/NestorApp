/**
 * Ο **αναγνώστης σελίδας** ως αφαίρεση (ADR-923 §5.5 · ίδιο σχήμα με το `IQuoteAnalyzer` του ADR-327): υλοποίηση OpenAI +
 * δηλωμένη απουσία όταν δεν υπάρχει κλειδί. Η οθόνη και ο αγωγός δεν ξέρουν ποιο μοντέλο διαβάζει.
 *
 * Δύο ερωτήσεις (§5.5.1): `mapTables` όταν ο διακομιστής ανασύνθεσε τους πίνακες, και `readPage` όταν η σελίδα δεν έχει τίποτα να
 * διαβαστεί χωρίς όραση. Κάθε έκβαση κουβαλά το ακατέργαστο κείμενο (Ε6): μόνο αυτό εξηγεί μια αστοχία χωρίς νέα πληρωμή.
 * @module subapps/catalog/import/page-analyzer
 */

import type { PageTable } from '@/lib/pdf-tables/page-table-types';
import type { ImportPagesUsage } from '../types/catalog-import';
import type { PageAttributeSpec, RawPageExtraction } from './page-extraction';
import type { RawPageMapping } from './page-table-mapping';
import type { PageToken } from './page-tokens';

export interface CatalogPageInput {
  readonly png: Buffer;
  readonly tokens: readonly PageToken[];
  readonly attributes: readonly PageAttributeSpec[];
  /** Τα ευρήματα της προηγούμενης ανάγνωσης, όταν ξαναδιαβάζουμε. */
  readonly feedback: readonly string[];
}

export interface CatalogTableMapInput {
  readonly png: Buffer;
  readonly tables: readonly PageTable[];
  readonly attributes: readonly PageAttributeSpec[];
  readonly feedback: readonly string[];
}

/** Ό,τι μένει για εξήγηση εκ των υστέρων. `model` = αυτό που απάντησε, `rawText: null` = κενή απάντηση. */
export interface CatalogAnswerTrace {
  readonly model: string;
  readonly rawText: string | null;
}

/** `read` = μια απάντηση που διαβάζεται· `failed` = δεν διαβάζεται, και η σελίδα ξαναδοκιμάζεται, αλλά πληρώθηκε. */
export type CatalogAnalyzerAnswer<TValue> =
  | ({ readonly kind: 'read'; readonly value: TValue; readonly usage: ImportPagesUsage } & CatalogAnswerTrace)
  | ({ readonly kind: 'failed'; readonly usage: ImportPagesUsage } & CatalogAnswerTrace)
  /** Δεν υπάρχει αναγνώστης (χωρίς κλειδί). */
  | { readonly kind: 'unavailable' };

export type CatalogPageReading = CatalogAnalyzerAnswer<RawPageExtraction>;
export type CatalogTableMapping = CatalogAnalyzerAnswer<RawPageMapping>;

export interface ICatalogPageAnalyzer {
  readPage(input: CatalogPageInput): Promise<CatalogPageReading>;
  mapTables(input: CatalogTableMapInput): Promise<CatalogTableMapping>;
}

export const NO_USAGE: ImportPagesUsage = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

/** Άγνωστο κόστος μένει άγνωστο: ένα αίτημα χωρίς τιμή κάνει το σύνολο `null`, όχι μικρότερο. */
export function addUsage(left: ImportPagesUsage, right: ImportPagesUsage): ImportPagesUsage {
  return {
    requests: left.requests + right.requests,
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    costUsd: left.costUsd === null || right.costUsd === null ? null : left.costUsd + right.costUsd,
  };
}
