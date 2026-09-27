/**
 * @fileoverview **Η ΕΦΑΡΜΟΓΗ ΤΩΝ ΟΝΟΜΑΤΩΝ ΕΜΦΑΝΙΣΗΣ** στο μητρώο — ADR-893.
 * @related `build-administrative-hierarchy.ts` (καλεί) · `build-admin-display-names.ts` (γράφει τον πίνακα)
 *
 * 🔒 **ΤΟ ΣΥΜΒΟΛΑΙΟ: ΑΛΛΑΖΕΙ ΜΟΝΟ Η ΓΡΑΦΗ, ΠΟΤΕ Η ΤΑΥΤΟΤΗΤΑ.** Κάθε όνομα εφαρμόζεται μόνο αν
 * έχει τις **ίδιες λέξεις** με αυτό που αντικαθιστά. Όλες οι συγκρίσεις της εφαρμογής γίνονται σε
 * διπλωμένη μορφή (`foldPlaceIdentity`, `normalizeGreekText`) — μετρημένο: **καμία** σύγκριση του
 * ωμού ονόματος — άρα «ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ» → «Δήμος Αθηναίων» δεν αλλάζει κανένα ταίριασμα.
 *
 * ⚠️ Το `nn` **δεν** αγγίζεται: είναι ήδη εσωτερικά ασυνεπές (`ς`/`σ`, `place-name.ts`) και κανείς
 * δεν πρέπει να κλειδώνει σε αυτό· αν το ξαναγράφαμε εδώ, θα άλλαζε **ταυτότητα** σε 1.300 γραμμές
 * με πρόσχημα την ορθογραφία.
 *
 * 🔴 **Μπαγιάτικος πίνακας = σφάλμα, όχι σιωπή**: γραμμή του πίνακα χωρίς γραμμή μητρώου, ή με
 * άλλες λέξεις, σημαίνει ότι το μητρώο άλλαξε μετά τη γέννηση του πίνακα. Τότε ο μετασχηματιστής
 * **δεν γράφει** — ξανατρέχει πρώτα το `build:admin-display-names`.
 */

import { sameWrittenWords } from './greek-orthography';

export interface DisplayNameRecord {
  readonly l: number;
  readonly c: string;
  readonly n: string;
  readonly sn: string;
}

export interface WritableNamedRow {
  n: string;
  sn: string;
  readonly l: number;
  readonly c: string;
}

export interface DisplayNamesOutcome {
  readonly applied: number;
  readonly problems: readonly string[];
}

export function applyDisplayNames(rows: readonly WritableNamedRow[], records: readonly DisplayNameRecord[]): DisplayNamesOutcome {
  const byKey = new Map(rows.map((row) => [`${row.l}:${row.c}`, row]));
  const problems: string[] = [];
  let applied = 0;
  for (const record of records) {
    const row = byKey.get(`${record.l}:${record.c}`);
    if (row === undefined) {
      problems.push(`όνομα εμφάνισης χωρίς γραμμή μητρώου: ${record.l}:${record.c} «${record.n}»`);
      continue;
    }
    if (!sameWrittenWords(row.n, record.n) || !sameWrittenWords(row.sn, record.sn)) {
      problems.push(`όνομα εμφάνισης με άλλες λέξεις: ${record.l}:${record.c} «${row.n}» ≠ «${record.n}»`);
      continue;
    }
    row.n = record.n;
    row.sn = record.sn;
    applied += 1;
  }
  return { applied, problems };
}
