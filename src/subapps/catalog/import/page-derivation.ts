/**
 * **Έκδοση παραγωγής ανά σελίδα** (ADR-923 §5.5.2 Β3.1): ποια σελίδα κρατά παράγωγα γραμμένα από παλαιότερο παραγωγό.
 *
 * Ένας κριτής για δύο καταναλωτές: ο server τον ρωτά πριν ξαναχτίσει (φρουρός ιδεμποτίας), ο πελάτης για να ξέρει τι να ζητήσει
 * όταν ανοίγει την παρτίδα. Καθαρό: καμία εισαγωγή server ή React.
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

/** Κρίθηκε με την τρέχουσα έκδοση: είτε ξαναχτίστηκε, είτε αρνήθηκε με λόγο. Και στις δύο περιπτώσεις δεν ξαναδοκιμάζεται. */
export const isPageCurrent = (pages: ImportBatchPages, page: number): boolean => pageDerivationOf(pages, page).version >= IMPORT_PAGE_DERIVATION;

/** Οι διαβασμένες σελίδες που κρατούν παράγωγα παλαιότερης έκδοσης, σε αύξουσα σειρά. */
export function stalePages(pages: ImportBatchPages): number[] {
  return [...pages.done].filter((page) => !isPageCurrent(pages, page)).sort((a, b) => a - b);
}

/** Η σφραγίδα που γράφεται όταν κρίνεται μια σελίδα με την τρέχουσα έκδοση. */
export const currentDerivation = (page: number, refusal: ImportPageDerivation['refusal']): ImportPageDerivation => ({ page, version: IMPORT_PAGE_DERIVATION, refusal });
