/**
 * @fileoverview **ΟΙ ΟΡΟΙ ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — «με ποιο κείμενο εκδίδεται σήμερα, και επιτρέπεται;» (ADR-916 Φ-Γ2 Σ4 · ADR-861 §7.3β).
 * @related lib/legal/legal-document-versions.ts (οι παγωμένες εκδόσεις) · lib/legal/legal-clauses.ts (τα ids των ρητρών)
 * @module lib/property-handover/handover-protocol-terms
 *
 * 🔑 **Το κείμενο σε ισχύ την ημέρα έκδοσης**, ποτέ το «τελευταίο»: έκδοση με μελλοντική ισχύ δεν τυπώνεται πριν την ώρα
 *    της, και το PDF κρατά **έκδοση + αποτύπωμα** ώστε ο τρίτος να συγκρίνει με τη δημόσια σελίδα της έκδοσης.
 * 🔒 **Άρνηση, όχι σιωπή**: έκδοση χωρίς μία από τις υποχρεωτικές ρήτρες ⇒ `missing-clauses` με **ποιες** λείπουν. Ένα
 *    Πρωτόκολλο χωρίς «δεν αποτελεί παραλαβή» θα μπορούσε να διαβαστεί ως παραλαβή του ακινήτου (ΑΚ 541 · 555).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις πάνω στο μητρώο εκδόσεων.
 */

import { calendarDayOf, type CalendarDay } from '@/constants/platform-operator';
import { clauseIdsOf } from '@/lib/legal/legal-clauses';
import type { FrozenLegalDocument } from '@/lib/legal/frozen-legal-document';
import { legalDocumentInForce, type LegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import { legalDocumentVersionHref } from '@/lib/routes/legalRoutes';

/** Το έγγραφο ADR-861 που κρατά τις ρήτρες του Πρωτοκόλλου. */
export const HANDOVER_PROTOCOL_LEGAL_DOCUMENT = 'handover-protocol' as const;

/**
 * **Οι ρήτρες χωρίς τις οποίες δεν εκδίδεται Πρωτόκολλο** (ADR-916 §5.11). Η ΜΙΑ λίστα: τη ρωτά ο γραφέας και την εισάγει
 * το test του παγωμένου κειμένου (Γ24–Γ29) — ποτέ δεύτερη στο test.
 */
export const HANDOVER_PROTOCOL_REQUIRED_CLAUSES = [
  'digitalFilesOnly',
  'notPropertyDelivery',
  'noWaiver',
  'contentNotCertified',
] as const;

export type HandoverProtocolRequiredClause = (typeof HANDOVER_PROTOCOL_REQUIRED_CLAUSES)[number];

/**
 * ADR-916 §5.23 Φ-Δ.7γ — **η ρήτρα που επιτρέπει γραμμές χωρίς πλήρες αποτύπωμα**. Πίνακας με κλεισμένη γραμμή εκδίδεται
 * **μόνο** με κείμενο που τη φέρει: το v1 υπόσχεται «δεν έχουν αλλάξει από τότε» για **κάθε** αρχείο, άρα θα έλεγε ψέμα.
 */
export const HANDOVER_PROTOCOL_CLOSURE_CLAUSE = 'closedLines' as const;

/** Φέρει το κείμενο τη ρήτρα των κλεισμένων γραμμών; — η ΜΙΑ ερώτηση του γραφέα (δίχτυ `legal-text-lacks-closures`). */
export function declaresClosedLines(frozen: FrozenLegalDocument): boolean {
  return clauseIdsOf(frozen).includes(HANDOVER_PROTOCOL_CLOSURE_CLAUSE);
}

export type HandoverProtocolTerms =
  | { readonly kind: 'in-force'; readonly version: LegalDocumentVersion }
  /** Καμία έκδοση σε ισχύ εκείνη την ημέρα — το Πρωτόκολλο περιμένει, δεν εφευρίσκει κείμενο. */
  | { readonly kind: 'none-in-force' }
  | { readonly kind: 'missing-clauses'; readonly version: LegalDocumentVersion; readonly missing: readonly HandoverProtocolRequiredClause[] };

/** Ποιες υποχρεωτικές ρήτρες **λείπουν** από ένα παγωμένο κείμενο. */
export function missingHandoverProtocolClauses(frozen: FrozenLegalDocument): readonly HandoverProtocolRequiredClause[] {
  const present = new Set(clauseIdsOf(frozen));
  return HANDOVER_PROTOCOL_REQUIRED_CLAUSES.filter((id) => !present.has(id));
}

/** **Οι όροι μιας ημέρας έκδοσης.** */
export function handoverProtocolTermsOn(day: CalendarDay): HandoverProtocolTerms {
  const lookup = legalDocumentInForce(HANDOVER_PROTOCOL_LEGAL_DOCUMENT, day);
  if (lookup.kind !== 'in-force') return { kind: 'none-in-force' };
  const missing = missingHandoverProtocolClauses(lookup.version.frozen);
  return missing.length === 0 ? { kind: 'in-force', version: lookup.version } : { kind: 'missing-clauses', version: lookup.version, missing };
}

/**
 * **Η μέρα έκδοσης ενός Πρωτοκόλλου** (ADR-916 Σ5) — ελληνική μέρα της στιγμής `issuedAt`, ποτέ η UTC. Ο ΕΝΑΣ κανόνας:
 * τον ρωτά ο γραφέας για το κείμενο που **τυπώνει** και η όψη για το κείμενο που **δείχνει** — αν διέφεραν, ένα
 * πρωτόκολλο εκδομένο λίγο μετά τα μεσάνυχτα θα παρέπεμπε στο UI σε άλλη έκδοση από αυτήν του PDF.
 */
export function handoverProtocolIssueDayOf(issuedAt: string): CalendarDay {
  return calendarDayOf(new Date(issuedAt));
}

/** Η δημόσια σελίδα μιας έκδοσης του κειμένου — ίδια διαδρομή στο QR του PDF και στον σύνδεσμο του UI. */
export function handoverProtocolLegalTextHref(version: number): string {
  return legalDocumentVersionHref(HANDOVER_PROTOCOL_LEGAL_DOCUMENT, version);
}
