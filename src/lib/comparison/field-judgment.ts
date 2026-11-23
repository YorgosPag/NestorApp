/**
 * @fileoverview **Η ΚΡΙΣΗ ΕΝΟΣ ΠΕΔΙΟΥ** — «η επαφή λέει Χ, η πηγή λέει Ψ: τι βλέπει ο άνθρωπος;» (ADR-948 · ADR-950).
 * @module lib/comparison/field-judgment
 *
 * Ο **ένας** κανόνας των τεσσάρων κρίσεων, κοινός για κάθε εξωτερική πηγή που συγκρίνεται με επαφή:
 * το ΓΕΜΗ (ADR-948, `lib/company/contact-registry-comparison`) και το ανεβασμένο έγγραφο (ADR-950,
 * `lib/contacts/contact-evidence-comparison`). Μετακινήθηκε εδώ από το ADR-948 για να **μην** γραφτεί δεύτερη φορά.
 *
 * - `match` — ίδια τιμή.
 * - `missing` — η επαφή είναι κενή, η πηγή έχει τιμή ⇒ «Συμπλήρωσε».
 * - `differs` — διαφορετικές τιμές ⇒ «Η πηγή λέει άλλο — δέξου / αγνόησε».
 * - `not-comparable` — η πηγή δεν έχει (συγκρίσιμη) τιμή ⇒ καμία πρόταση. **Ποτέ** «διαφορά» ό,τι δεν συγκρίνεται.
 *
 * **Layering**: καθαρή — καμία εισαγωγή.
 */

export type FieldComparisonState = 'match' | 'missing' | 'differs' | 'not-comparable';

/** `S` = η τιμή της πηγής στη γλώσσα της επαφής · `C` = η τιμή της επαφής όπως είναι αποθηκευμένη. */
export interface FieldComparison<S, C = string> {
  readonly state: FieldComparisonState;
  /** `null` = κενή. */
  readonly contact: C | null;
  /** `null` = τίποτα συγκρίσιμο. Το όνομα `registry` κρατιέται από το ADR-948 (πρώτη πηγή). */
  readonly registry: S | null;
}

/** Ισότητα δύο **παρόντων** κειμένων, κατά τον κανόνα του πεδίου. */
export type SameValue = (contact: string, source: string) => boolean;

/** Κενό κείμενο = απουσία. */
export function present(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/** Η πηγή πρώτα: χωρίς δική της τιμή, τίποτα δεν συγκρίνεται. */
export function judge(contact: string | null, source: string | null, same: SameValue): FieldComparisonState {
  if (source === null) return 'not-comparable';
  if (contact === null) return 'missing';
  return same(contact, source) ? 'match' : 'differs';
}
