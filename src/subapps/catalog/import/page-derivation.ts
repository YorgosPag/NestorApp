/**
 * **Έκδοση παραγωγής ανά σελίδα** (ADR-923 §5.5.2 Β3.1): ποια σελίδα κρατά παράγωγα γραμμένα από παλαιότερο παραγωγό **ή απέναντι σε
 * παλαιότερο σχήμα οικογένειας** (Γ12 — όπως το Figma ξέρει από ποια έκδοση της βιβλιοθήκης βγήκε κάθε στιγμιότυπο).
 *
 * Ένας κριτής για δύο καταναλωτές: ο server τον ρωτά πριν ξαναχτίσει (φρουρός ιδεμποτίας), ο πελάτης για να ξέρει τι να ζητήσει
 * όταν ανοίγει την παρτίδα. Καθαρό: καμία εισαγωγή server ή React.
 *
 * 🔑 `schemaRevision` = η **τρέχουσα** αναθεώρηση της οικογένειας της παρτίδας· `null` = παρτίδα χωρίς οικογένεια (ή οικογένεια που
 *    δεν διαβάστηκε): τότε κρίνει μόνο η έκδοση παραγωγής, όπως πριν.
 * @module subapps/catalog/import/page-derivation
 */

import type { ImportBatchPages, ImportPageDerivation } from '../types/catalog-import';
import { IMPORT_PAGE_DERIVATION } from '../vocabulary/catalog-import';

/** Σελίδα χωρίς σφραγίδα γράφτηκε πριν υπάρξουν σφραγίδες: έκδοση 1. */
const UNSTAMPED_VERSION = 1;

/** Η σφραγίδα μιας σελίδας, ή η σιωπηρή έκδοση 1 όταν λείπει. */
export function pageDerivationOf(pages: ImportBatchPages, page: number): ImportPageDerivation {
  return pages.derivations?.find((entry) => entry.page === page) ?? { page, version: UNSTAMPED_VERSION, refusal: null };
}

/**
 * Κρίθηκε με την τρέχουσα έκδοση **και** το τρέχον σχήμα: είτε ξαναχτίστηκε, είτε αρνήθηκε με λόγο. Και στις δύο περιπτώσεις δεν
 * ξαναδοκιμάζεται — μέχρι να αλλάξει ο παραγωγός ή η οικογένεια (νέο σχήμα μπορεί να λύνει την άρνηση).
 */
export function isPageCurrent(pages: ImportBatchPages, page: number, schemaRevision: number | null): boolean {
  const stamp = pageDerivationOf(pages, page);
  return stamp.version >= IMPORT_PAGE_DERIVATION && (schemaRevision === null || stamp.schemaRevision === schemaRevision);
}

/** Οι διαβασμένες σελίδες που κρατούν παράγωγα παλαιότερης έκδοσης ή σχήματος, σε αύξουσα σειρά. */
export function stalePages(pages: ImportBatchPages, schemaRevision: number | null): number[] {
  return [...pages.done].filter((page) => !isPageCurrent(pages, page, schemaRevision)).sort((a, b) => a - b);
}

/** Η σφραγίδα που γράφεται όταν κρίνεται μια σελίδα με την τρέχουσα έκδοση, απέναντι στο σχήμα που **διαβάστηκε** για την κρίση. */
export const currentDerivation = (
  page: number,
  refusal: ImportPageDerivation['refusal'],
  schemaRevision: number | null,
): ImportPageDerivation => ({ page, version: IMPORT_PAGE_DERIVATION, refusal, schemaRevision });
