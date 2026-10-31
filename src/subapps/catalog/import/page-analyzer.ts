/**
 * Ο **αναγνώστης σελίδας** ως αφαίρεση (ADR-923 §5.5 · ίδιο σχήμα με το `IQuoteAnalyzer` του ADR-327): υλοποίηση OpenAI +
 * δηλωμένη απουσία όταν δεν υπάρχει κλειδί. Η οθόνη και ο αγωγός δεν ξέρουν ποιο μοντέλο διαβάζει.
 * @module subapps/catalog/import/page-analyzer
 */

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
  | { readonly kind: 'read'; readonly extraction: RawPageExtraction }
  /** Το μοντέλο απάντησε κάτι που δεν διαβάζεται: η σελίδα μετρά ως αποτυχημένη και ξαναδοκιμάζεται. */
  | { readonly kind: 'failed' }
  /** Δεν υπάρχει αναγνώστης (χωρίς κλειδί). */
  | { readonly kind: 'unavailable' };

export interface ICatalogPageAnalyzer {
  readPage(input: CatalogPageInput): Promise<CatalogPageReading>;
}
