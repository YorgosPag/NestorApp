/**
 * Ο **αναγνώστης σελίδας** ως αφαίρεση (ADR-923 §5.5 · ίδιο σχήμα με το `IQuoteAnalyzer` του ADR-327): υλοποίηση OpenAI +
 * δηλωμένη απουσία όταν δεν υπάρχει κλειδί. Η οθόνη και ο αγωγός δεν ξέρουν ποιο μοντέλο διαβάζει.
 * @module subapps/catalog/import/page-analyzer
 */

import type { ImportPagesUsage } from '../types/catalog-import';
import type { PageAttributeSpec, RawPageExtraction } from './page-extraction';
import type { PageToken } from './page-tokens';

export interface CatalogPageInput {
  readonly png: Buffer;
  readonly tokens: readonly PageToken[];
  readonly attributes: readonly PageAttributeSpec[];
  /** Τα ευρήματα της προηγούμενης ανάγνωσης, όταν ξαναδιαβάζουμε. */
  readonly feedback: readonly string[];
}

export type CatalogPageReading =
  | { readonly kind: 'read'; readonly extraction: RawPageExtraction; readonly usage: ImportPagesUsage }
  /** Το μοντέλο απάντησε κάτι που δεν διαβάζεται: η σελίδα μετρά ως αποτυχημένη και ξαναδοκιμάζεται. Πληρώθηκε όμως. */
  | { readonly kind: 'failed'; readonly usage: ImportPagesUsage }
  /** Δεν υπάρχει αναγνώστης (χωρίς κλειδί). */
  | { readonly kind: 'unavailable' };

export interface ICatalogPageAnalyzer {
  readPage(input: CatalogPageInput): Promise<CatalogPageReading>;
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
