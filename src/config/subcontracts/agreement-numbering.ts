/**
 * Η **αρίθμηση** των εγγράφων υπεργολαβίας (ADR-928 Φ2 απόφαση 7) — δεδομένα, όχι κείμενο οθόνης: το πρόθεμα τυπώνεται
 * στο ίδιο το έγγραφο και μένει όπως εκδόθηκε, σε όποια γλώσσα κι αν το δει κάποιος αργότερα.
 *
 * Ξεχωριστή ακολουθία ανά **είδος εγγράφου** και **έτος** (Ελλάδα), ανά χώρο: «ΠΡΟΣ-2026-007» · «ΣΥΜ-2026-014».
 * Στον Τρόπο Β (§5.5) η προσφορά και το συμφωνητικό είναι δύο χαρτιά ⇒ δύο αριθμοί.
 * @module config/subcontracts/agreement-numbering
 */

import type { AgreementDocumentRole } from '@/subapps/procurement/subcontracts/types/agreement';

export const AGREEMENT_NUMBER_PREFIX: Readonly<Record<AgreementDocumentRole, string>> = {
  offer: 'ΠΡΟΣ',
  agreement: 'ΣΥΜ',
};

/** Ελάχιστα ψηφία του αύξοντα αριθμού (014). Περισσότερα έγγραφα στο έτος ⇒ απλώς μακρύτερος αριθμός. */
export const AGREEMENT_NUMBER_MIN_DIGITS = 3;
