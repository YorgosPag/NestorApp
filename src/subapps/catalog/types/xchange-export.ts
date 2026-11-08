/**
 * Η **εξαγωγή ETIM xChange** (ADR-923 §5.14 · κενό α): το κοινό που διαλέγει ο προμηθευτής και η αναφορά που συνοδεύει το
 * έγγραφο. Κοινός τύπος πελάτη και διακομιστή.
 *
 * 🔑 **Ένα κοινό ανά αρχείο** (απόφαση Ε1): η δημόσια τιμή καταλόγου (ο ανώνυμος θεατής, BMEcat `net_list`) ή **μία** λίστα
 *    πελάτη (`net_customer`). Ποτέ τιμές δύο κοινών στο ίδιο αρχείο.
 * 🔑 **Καμία σιωπηλή απώλεια** (Ζ5): ό,τι δεν μπήκε στο αρχείο ή μπήκε χωρίς τιμή μετριέται εδώ, ανά αιτία.
 * @module subapps/catalog/types/xchange-export
 */

import type { LocalizedText } from '@/i18n/localized-text';
import type { XChangeExportReport } from '../interop/etim/catalog-to-xchange';
import type { CatalogIssue } from '../schema/catalog-issues';
import type { XChangeEmptyCause, XChangeOnRequestReason } from '../vocabulary/etim';

/** Το κοινό των τιμών του αρχείου. */
export type XChangeExportAudience =
  | { readonly kind: 'public' }
  | { readonly kind: 'priceList'; readonly priceListId: string };

/**
 * Γιατί ένα ορατό SKU **δεν** γράφεται από έλλειψη ταυτότητας (ADR-934 Σ1γ Δ1). Το σχήμα 2.0 θέλει υποχρεωτικά `ManufacturerName`
 * και `ManufacturerProductNumber`· ψευδής κατασκευαστής ή επινοημένο MPN δεν γράφεται ποτέ.
 *   - `brandMissing`: καμία μάρκα στη ρίζα του·
 *   - `mpnMissing`: κανένα MPN, και ο χώρος **δεν** κατέχει τη μάρκα ως κατασκευαστής (αλλιώς ο κωδικός του **είναι** το MPN)·
 *   - `mpnTooLong`: MPN μακρύτερο από όσο δέχεται το σχήμα — ποτέ κομμένο, θα ήταν άλλο προϊόν.
 */
export interface XChangeTradeIdentityGaps {
  readonly brandMissing: number;
  readonly mpnMissing: number;
  readonly mpnTooLong: number;
}

/** Η λίστα και η έκδοση από τις οποίες βγήκαν οι τιμές. `null` στην αναφορά ⇒ καμία λίστα δεν ισχύει για το κοινό. */
export interface XChangeExportPriceSource {
  readonly priceListId: string;
  readonly code: string;
  readonly labels: LocalizedText;
  /** `null` ⇒ η λίστα δεν έχει έκδοση σε ισχύ τη στιγμή της εξαγωγής. */
  readonly version: { readonly id: string; readonly number: number; readonly validFrom: string } | null;
}

/**
 * Η κρίση του κοινού πάνω στον κατάλογο: **μία** μέτρηση, που τη μοιράζονται ο προέλεγχος και η αναφορά εξαγωγής (ADR-923
 * §5.14.1 · Ε3). Βγαίνει από την ίδια συναρμολόγηση με το αρχείο.
 */
export interface XChangeExportCounts {
  readonly audience: XChangeExportAudience;
  readonly priceSource: XChangeExportPriceSource | null;
  /** Η στιγμή της κρίσης τιμής και ορατότητας (ISO). */
  readonly at: string;
  /** SKU που γράφονται (ή γράφτηκαν) στο αρχείο. */
  readonly exported: number;
  /** Κρυφά για το κοινό (απόφαση Ε2): **δεν** γράφονται. */
  readonly hidden: number;
  /** Ορατά, αλλά χωρίς κωδικό SKU ή με κωδικό μακρύτερο από όσο δέχεται το σχήμα: δεν γράφονται. */
  readonly unfitIdentifier: number;
  /** Ορατά, με κωδικό, αλλά χωρίς την ταυτότητα που το σχήμα θέλει υποχρεωτική (ADR-934 Σ1γ Δ1): δεν γράφονται. */
  readonly tradeIdentity: XChangeTradeIdentityGaps;
  /** Γράφονται ως `PriceOnRequest`, ανά αιτία. */
  readonly onRequest: Readonly<Partial<Record<XChangeOnRequestReason, number>>>;
}

export interface XChangeExportSummary extends XChangeExportCounts {
  readonly fileName: string;
  /** Τι έμεινε εκτός από το περιεχόμενο των SKU που γράφτηκαν. */
  readonly content: XChangeExportReport;
}

/**
 * `GET /api/catalog/xchange-export/preview`: τι **θα** έβγαινε, πριν τη λήψη (ADR-923 §5.14.1 · Ε3). Χωρίς έγγραφο.
 * `emptyCause !== null` ⇔ `exported === 0`: η εξαγωγή θα αρνιόταν. `blockers`: ό,τι θα την έκανε να αρνηθεί για άλλο λόγο
 * (π.χ. χωρίς επωνυμία), ώστε να φαίνεται **πριν** το κλικ.
 */
export interface XChangeExportPreview extends XChangeExportCounts {
  readonly emptyCause: XChangeEmptyCause | null;
  readonly blockers: readonly CatalogIssue[];
}

/** `GET /api/catalog/xchange-export`: το έγγραφο αυτούσιο και, δίπλα του, η αναφορά. */
export interface XChangeExportWire {
  readonly summary: XChangeExportSummary;
  readonly document: unknown;
}
