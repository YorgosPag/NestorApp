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
import type { XChangeOnRequestReason } from '../vocabulary/etim';

/** Το κοινό των τιμών του αρχείου. */
export type XChangeExportAudience =
  | { readonly kind: 'public' }
  | { readonly kind: 'priceList'; readonly priceListId: string };

/** Η λίστα και η έκδοση από τις οποίες βγήκαν οι τιμές. `null` στην αναφορά ⇒ καμία λίστα δεν ισχύει για το κοινό. */
export interface XChangeExportPriceSource {
  readonly priceListId: string;
  readonly code: string;
  readonly labels: LocalizedText;
  /** `null` ⇒ η λίστα δεν έχει έκδοση σε ισχύ τη στιγμή της εξαγωγής. */
  readonly version: { readonly id: string; readonly number: number; readonly validFrom: string } | null;
}

export interface XChangeExportSummary {
  readonly audience: XChangeExportAudience;
  readonly priceSource: XChangeExportPriceSource | null;
  /** Η στιγμή της κρίσης τιμής και ορατότητας (ISO). */
  readonly at: string;
  readonly fileName: string;
  /** SKU που γράφτηκαν στο αρχείο. */
  readonly exported: number;
  /** Κρυφά για το κοινό (απόφαση Ε2): **δεν** γράφονται. */
  readonly hidden: number;
  /** Ορατά, αλλά χωρίς κωδικό SKU ή με κωδικό μακρύτερο από όσο δέχεται το σχήμα: δεν γράφονται. */
  readonly unfitIdentifier: number;
  /** Γράφτηκαν ως `PriceOnRequest`, ανά αιτία. */
  readonly onRequest: Readonly<Partial<Record<XChangeOnRequestReason, number>>>;
  /** Τι έμεινε εκτός από το περιεχόμενο των SKU που γράφτηκαν. */
  readonly content: XChangeExportReport;
}

/** `GET /api/catalog/xchange-export`: το έγγραφο αυτούσιο και, δίπλα του, η αναφορά. */
export interface XChangeExportWire {
  readonly summary: XChangeExportSummary;
  readonly document: unknown;
}
