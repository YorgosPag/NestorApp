/**
 * =============================================================================
 * LEGAL ROUTES — οι δημόσιες νομικές οθόνες, ΜΙΑ φορά (ADR-861 Φ2)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει**: οι τρεις διευθύνσεις ζούσαν ως ωμά `href="/privacy-policy"` μέσα στο
 * `app-sidebar.tsx` — και **μόνο** εκεί. Ο επισκέπτης χωρίς λογαριασμό (οθόνες σύνδεσης) δεν
 * έβλεπε **κανέναν** νομικό σύνδεσμο. Δεύτερος καταναλωτής με ωμές συμβολοσειρές θα ήταν δίδυμο
 * που αποκλίνει στην πρώτη μετονομασία.
 *
 * ⚠️ **Όλες ζουν ΕΚΤΟΣ χώρου** (`OUTSIDE_WORKSPACE` στο `lib/workspace/workspace-scope.ts`):
 * τις ανοίγει οποιοσδήποτε χωρίς σύνδεση. Τη συμφωνία δίσκου ⇄ κριτή τη φυλά η άγκυρα
 * `route-catalogue-anchor.test.ts`.
 *
 * @module lib/routes/legalRoutes
 * @see ADR-861 — ο φορέας της πλατφόρμας και τα νομικά έγγραφα
 */

import type { LegalDocumentId } from '@/constants/legal-documents';

export const LEGAL_ROUTES = {
  /** Πολιτική απορρήτου (ΓΚΠΔ άρθ. 13). */
  privacyPolicy: '/privacy-policy',
  /** Όροι χρήσης. */
  terms: '/terms',
  /** Οδηγίες διαγραφής δεδομένων (απαίτηση πλατφορμών μηνυμάτων). */
  dataDeletion: '/data-deletion',
  /** Νομικά στοιχεία του φορέα (Π.Δ. 131/2003 άρθ. 4). */
  legalNotice: '/legal-notice',
  /**
   * Απόδοση αδειών του ανοιχτού κώδικα που ενσωματώνεται (ADR-863 Φ3).
   *
   * ⚠️ **ΕΠΙΠΕΔΗ, ΟΠΩΣ ΚΑΙ ΟΙ ΤΕΣΣΕΡΙΣ ΑΔΕΛΦΕΣ** — απόφαση Giorgio 2026-09-16, ρητή
   * απόκλιση από το handoff που έγραφε `/legal/open-source`. Ένα εμφωλευμένο τμήμα θα
   * έδινε στη **ίδια** οικογένεια δύο σχήματα διεύθυνσης, και η δεύτερη μορφή είναι
   * ακριβώς ο τρόπος με τον οποίο ένα λεξιλόγιο αρχίζει να αποκλίνει.
   */
  openSource: '/open-source',
  /**
   * Η ενημέρωση που συναινεί ο πωλητής πριν από κλειστή διάθεση (ADR-864 Φ3). Δημόσια — ο ιδιοκτήτης
   * τη διαβάζει **πριν** από τον σύνδεσμο συναίνεσης, και ο μεσίτης την εκτυπώνει για υπογραφή.
   * Στο μενού **τελευταία**: δεν δεσμεύει κάθε αναγνώστη, μόνο όποιον της ζητηθεί — αλλά είναι δημόσιο
   * νομικό κείμενο και ο πωλητής πρέπει να το βρίσκει **πριν** του ζητηθεί (άγκυρα Σ1: κάθε διαδρομή = σύνδεσμος).
   */
  privateMarketingDisclosure: '/private-marketing-disclosure',
} as const;

export type LegalRouteId = keyof typeof LEGAL_ROUTES;

/**
 * **Ποια σελίδα αποδίδει την έκδοση σε ισχύ** κάθε εγγράφου με εκδόσεις (ADR-861 Φ3).
 * Εξαντλητικό πάνω στο λεξιλόγιο: νέο έγγραφο χωρίς σελίδα **δεν** μεταγλωττίζεται.
 */
export const LEGAL_DOCUMENT_ROUTES: { readonly [Id in LegalDocumentId]: string } = {
  'privacy-policy': LEGAL_ROUTES.privacyPolicy,
  'terms-of-service': LEGAL_ROUTES.terms,
  'data-deletion': LEGAL_ROUTES.dataDeletion,
  'private-marketing-disclosure': LEGAL_ROUTES.privateMarketingDisclosure,
};

/**
 * Το **αρχείο εκδόσεων** — **κάτω από τη σελίδα του ίδιου του εγγράφου** (`/privacy-policy/versions`).
 *
 * ⚠️ **ΟΧΙ `/legal/<έγγραφο>/versions`**: η οικογένεια είναι επίπεδη με απόφαση Giorgio
 * (2026-09-16, `openSource` παραπάνω) — ένα πρόθεμα `/legal` θα της έδινε δεύτερο σχήμα
 * διεύθυνσης. Ως υποδιαδρομή κληρονομεί και την εγγραφή «εκτός χώρου» της σελίδας.
 */
export const legalDocumentVersionsHref = (document: LegalDocumentId): string =>
  `${LEGAL_DOCUMENT_ROUTES[document]}/versions`;

export const legalDocumentVersionHref = (document: LegalDocumentId, version: number): string =>
  `${legalDocumentVersionsHref(document)}/${version}`;

/**
 * **Η σειρά των συνδέσμων** — ίδια σε κάθε επιφάνεια (μενού · οθόνες σύνδεσης · σελίδα νομικών
 * στοιχείων). Οι ετικέτες ζουν στο UI (`components/legal/LegalLinksNav.tsx`), όχι εδώ: αυτό το
 * αρχείο είναι διαδρομές μόνο, όπως τα αδέλφια του.
 */
export const LEGAL_LINK_ORDER: readonly LegalRouteId[] = [
  'privacyPolicy',
  'terms',
  'dataDeletion',
  'legalNotice',
  // ⚖️ ΤΕΛΕΥΤΑΙΑ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ: οι τέσσερις από πάνω δεσμεύουν τον **αναγνώστη**
  //    (τι κάνουμε με τα δεδομένα του, τι συμφωνεί μαζί μας). Η απόδοση αδειών δεσμεύει
  //    **εμάς** απέναντι σε τρίτους εκδότες — άλλο ακροατήριο, χαμηλότερη προτεραιότητα
  //    ανάγνωσης, και καμία σχέση με τη συγκατάθεση που ζητούν οι από πάνω.
  'openSource',
  // ADR-864 Φ3 — η ενημέρωση κλειστής διάθεσης: αφορά μόνο πωλητή με εντολή, άρα μετά από όλα.
  'privateMarketingDisclosure',
];
