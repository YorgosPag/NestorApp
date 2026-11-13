/**
 * **Έκδοση παραγωγής ανά σελίδα** (ADR-923 §5.5.2 Β3.1): ποια σελίδα κρατά παράγωγα γραμμένα από παλαιότερο παραγωγό **ή απέναντι σε
 * παλαιότερο σχήμα οικογένειας** (Γ12 — όπως το Figma ξέρει από ποια έκδοση της βιβλιοθήκης βγήκε κάθε στιγμιότυπο) **ή πάνω σε άλλες
 * αποφάσεις γραμμής** (Β3.2 — όπως το κλειδί ενέργειας του Bazel περιέχει το αποτύπωμα των εισόδων).
 *
 * Ένας κριτής για δύο καταναλωτές: ο server τον ρωτά πριν ξαναχτίσει (φρουρός ιδεμποτίας), ο πελάτης για να ξέρει τι να ζητήσει
 * όταν ανοίγει την παρτίδα. Καθαρό: καμία εισαγωγή server ή React.
 *
 * 🔑 `schemaRevision` = η **τρέχουσα** αναθεώρηση της οικογένειας της παρτίδας· `null` = παρτίδα χωρίς οικογένεια (ή οικογένεια που
 *    δεν διαβάστηκε): τότε κρίνει μόνο η έκδοση παραγωγής, όπως πριν.
 * 🔑 Β3.2: τα παράγωγα γράφονται σε **μία** συναλλαγή με τις αποφάσεις τους· το αποτύπωμα είναι το δίχτυ για ό,τι γράφτηκε πριν από
 *    αυτό (live 2026-11-13: απόφαση χωρίς την πρότασή της) — η μπαγιατίλα **αποδεικνύεται**, δεν δηλώνεται.
 * @module subapps/catalog/import/page-derivation
 */

import type { ImportBatchPages, ImportPageDerivation } from '../types/catalog-import';
import { IMPORT_PAGE_DERIVATION } from '../vocabulary/catalog-import';
import { pageDecisionsDigest } from './page-line-overrides';

/** Σελίδα χωρίς σφραγίδα γράφτηκε πριν υπάρξουν σφραγίδες: έκδοση 1. */
const UNSTAMPED_VERSION = 1;

/** Η σφραγίδα μιας σελίδας, ή η σιωπηρή έκδοση 1 όταν λείπει. */
export function pageDerivationOf(pages: ImportBatchPages, page: number): ImportPageDerivation {
  return pages.derivations?.find((entry) => entry.page === page) ?? { page, version: UNSTAMPED_VERSION, refusal: null };
}

/** Τα παράγωγα της σελίδας βγήκαν από τις **τρέχουσες** αποφάσεις της; */
export const matchesDecisions = (pages: ImportBatchPages, page: number): boolean =>
  pageDerivationOf(pages, page).decisionsDigest === pageDecisionsDigest(pages.lineOverrides, page);

/**
 * Κρίθηκε με την τρέχουσα έκδοση, το τρέχον σχήμα **και** τις τρέχουσες αποφάσεις: είτε ξαναχτίστηκε, είτε αρνήθηκε με λόγο. Και στις
 * δύο περιπτώσεις δεν ξαναδοκιμάζεται — μέχρι να αλλάξει ο παραγωγός, η οικογένεια ή μια απόφαση (κάτι από αυτά μπορεί να λύνει την άρνηση).
 */
export function isPageCurrent(pages: ImportBatchPages, page: number, schemaRevision: number | null): boolean {
  const stamp = pageDerivationOf(pages, page);
  return stamp.version >= IMPORT_PAGE_DERIVATION && (schemaRevision === null || stamp.schemaRevision === schemaRevision) && matchesDecisions(pages, page);
}

/** Οι διαβασμένες σελίδες που κρατούν παράγωγα παλαιότερης έκδοσης, σχήματος ή αποφάσεων, σε αύξουσα σειρά. */
export function stalePages(pages: ImportBatchPages, schemaRevision: number | null): number[] {
  return [...pages.done].filter((page) => !isPageCurrent(pages, page, schemaRevision)).sort((a, b) => a - b);
}

/**
 * Η σφραγίδα που γράφεται όταν κρίνεται μια σελίδα με την τρέχουσα έκδοση, απέναντι στο σχήμα που **διαβάστηκε** για την κρίση και στις
 * αποφάσεις πάνω στις οποίες **κρίθηκε** (`decisionsDigest`) — ποτέ στις αποφάσεις της στιγμής της εγγραφής.
 */
export const currentDerivation = (
  page: number,
  refusal: ImportPageDerivation['refusal'],
  schemaRevision: number | null,
  decisionsDigest: string,
): ImportPageDerivation => ({ page, version: IMPORT_PAGE_DERIVATION, refusal, schemaRevision, decisionsDigest });

/**
 * Η σφραγίδα μετά το ξαναχτίσιμο **ενός** πίνακα (§5.5.2 Β3.2). Ο πίνακας ξαναχτίστηκε πάνω στις νέες αποφάσεις, οι άλλοι όχι. Άρα το
 * αποτύπωμα ανανεώνεται **μόνο** αν η σελίδα ήταν ήδη συνεπής με τις αποφάσεις πριν την αλλαγή (`before`)· αλλιώς μένει μπαγιάτικη, και
 * το ξαναχτίζει ολόκληρη η αναβάθμιση. Έκδοση και σχήμα δεν αγγίζονται: τα κρίνει μόνο το ξαναχτίσιμο **σελίδας**. `null` = η σφραγίδα
 * μένει όπως είναι.
 */
export function derivationAfterTable(before: ImportBatchPages, page: number, afterDigest: string): ImportPageDerivation | null {
  return matchesDecisions(before, page) ? { ...pageDerivationOf(before, page), decisionsDigest: afterDigest } : null;
}
