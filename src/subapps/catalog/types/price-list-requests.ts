/**
 * Τα **συμβόλαια** των αιτημάτων τιμολόγησης που μοιράζονται οθόνη και διακομιστής (ADR-923 §5.11 «3β») — **ένας**
 * ορισμός για το σύρμα, όπως το `product-requests`. Ο zod τους ζει στο `schema/zod/price-list-requests.schema.ts`.
 *
 * @module subapps/catalog/types/price-list-requests
 */

import type { SelectionTraceEntry } from '@/lib/pricing/select-condition';
import type { PriceVersionDiff } from '../pricing/diff-price-versions';
import type { PriceQuote } from '../pricing/resolve-catalog-price';
import type { PriceVersionBasis } from '../vocabulary/pricing';
import type { PriceAudience, PriceLineSubject, PriceListLineDefinition } from './price-list';

/** Μία γραμμή της δέσμης — η έκδοση έρχεται από τη διαδρομή, ποτέ από το σώμα. */
export type PriceLineInput = Omit<PriceListLineDefinition, 'versionId'>;

/** Η δέσμη `PUT …/price-list-versions/[id]/lines`: CAS στο `linesRevision` της έκδοσης· διαγραφή ανά υποκείμενο. */
export interface PriceLineBatch {
  readonly expectedLinesRevision: number;
  readonly upserts: readonly PriceLineInput[];
  readonly deletes: readonly PriceLineSubject[];
}

export interface PriceLineBatchResult {
  readonly versionId: string;
  /** Το νέο `linesRevision` — ό,τι στέλνει ο πελάτης στην επόμενη δέσμη ή στη δημοσίευση. */
  readonly linesRevision: number;
  /** Πόσες γραμμές γράφτηκαν (οι αμετάβλητες δεν ξαναγράφονται). */
  readonly written: number;
}

/** `POST …/price-lists/[id]/versions` — νέα πρόχειρη έκδοση, κενή ή «από την τρέχουσα δημοσιευμένη». */
export interface CreatePriceVersionRequest {
  readonly validFrom: string | null;
  readonly basedOn: PriceVersionBasis;
}

/** `PUT …/price-list-versions/[id]` — μόνο σε πρόχειρη: από πότε ισχύει. */
export interface UpdatePriceVersionRequest {
  readonly expectedRevision: number;
  readonly validFrom: string | null;
}

/** Η προεπισκόπηση της δημοσίευσης: η διαφορά από την τρέχουσα δημοσιευμένη + ό,τι πρέπει να επιβεβαιωθεί. */
export interface PricePublicationPreview {
  readonly versionId: string;
  readonly previousVersionId: string | null;
  readonly linesRevision: number;
  readonly fenceBp: number;
  readonly diff: PriceVersionDiff;
  /** Αποτύπωμα της **φραγμένης** διαφοράς — `null` αν καμία γραμμή δεν πέρασε τον φράχτη. */
  readonly diffDigest: string | null;
  /**
   * Ο κωδικός SKU κάθε ζωντανής παραλλαγής της διαφοράς (και των **αφαιρεμένων**, που υπάρχουν μόνο στην προηγούμενη
   * έκδοση), κατά `variantId` — ο άνθρωπος επιβεβαιώνει **κωδικούς**, όχι εσωτερικά id. Ίδιο `expand` με την όψη γραμμών.
   */
  readonly skuIdentifiers: Readonly<Record<string, string>>;
}

/** `POST …/price-list-versions/[id]/publish` — CAS στην έκδοση **και** στις γραμμές, και επιβεβαίωση ό,τι είδες. */
export interface PublishPriceVersionRequest {
  readonly expectedRevision: number;
  readonly expectedLinesRevision: number;
  readonly confirmedDiffDigest: string | null;
}

/**
 * Ως ποιον ρωτάμε την τιμή (§12 «δες σαν τον Χ») — **ένα κοινό**, ο ΙΔΙΟΣ τύπος με το κοινό συνθήκης και λίστας (ρίζα
 * `AUDIENCE_KINDS`, CHECK 3.73: δεύτερη απαρίθμηση κοινών θα απέκλινε στο πρώτο νέο κοινό). Ο διακομιστής **χτίζει** τον
 * θεατή από **αποθηκευμένες** εγγραφές: ομάδα πελάτη που υπάρχει · συμβαλλόμενος που υπάρχει (+ η ανάθεσή του).
 */
export type PriceQuoteViewAs = PriceAudience;

/** `POST /api/catalog/price-quote` — εσωτερική προεπισκόπηση τιμής (3β απόφαση Δ). */
export interface PriceQuoteRequest {
  readonly viewAs: PriceQuoteViewAs;
  readonly subject: PriceLineSubject;
  readonly quantity: number;
  /** Η στιγμή της τιμής (ISO)· `null` = τώρα. */
  readonly at: string | null;
  /** Ρητή λίστα (π.χ. `cost`)· `null` = η λίστα πώλησης του ειδικότερου κοινού που καλύπτει τον θεατή. */
  readonly priceListId: string | null;
}

/** Γιατί δεν βγήκε τιμή — ή η τιμή, με το ίχνος της επιλογής λίστας. */
export type PriceQuoteResult =
  | { readonly kind: 'noPriceList'; readonly audienceTrace: readonly SelectionTraceEntry<'audienceMismatch'>[] }
  | { readonly kind: 'ambiguousPriceList'; readonly tiedPriceListIds: readonly string[] }
  | { readonly kind: 'invalidQuantity' }
  | { readonly kind: 'noVersion'; readonly priceListId: string }
  | { readonly kind: 'noLine'; readonly priceListId: string; readonly priceListVersionId: string }
  | { readonly kind: 'ambiguousDiscount'; readonly priceListId: string; readonly tiedConditionIds: readonly string[] }
  | { readonly kind: 'priced'; readonly quote: PriceQuote; readonly priceListAudience: PriceAudience | null };
