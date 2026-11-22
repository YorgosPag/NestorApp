/**
 * @fileoverview **Ο ΦΡΑΧΤΗΣ «ΟΧΙ ΦΥΣΙΚΟ ΠΡΟΣΩΠΟ»** — κρίνει τη νομική μορφή που είπε το ΓΕΜΗ (ADR-948 §8.3).
 * @module lib/company/registry-legal-person
 *
 * Κρίνει η **απάντηση του μητρώου**, ποτέ η δήλωση του χρήστη. Κάθε δρόμος που δεν καταλήγει
 * σε γραμμή του χάρτη με `subject: 'entity'` είναι **άρνηση** (fail-closed):
 *
 * - `no-legal-form` — το ΓΕΜΗ δεν είπε μορφή.
 * - `unmapped` — κωδικός που δεν υπάρχει στον χάρτη (νέος στον κατάλογο).
 * - `catalog-drift` — ο κωδικός υπάρχει, αλλά η περιγραφή που ήρθε **διαφέρει** από το
 *   στιγμιότυπο ⇒ ο κωδικός μπορεί να άλλαξε νόημα· η κατάταξη δεν ισχύει πια.
 * - `natural-person` · `unclassifiable` — όπως τα λέει ο χάρτης.
 *
 * 🔑 Η ολίσθηση ελέγχεται πάνω στο **ίδιο** το `legalType.descr` της απάντησης εταιρείας —
 * **καμία** δεύτερη κλήση στον κατάλογο (όριο 8 αιτήματα/λεπτό ανά κλειδί, για όλη την πλατφόρμα).
 *
 * **Layering**: καθαρή — καμία εισαγωγή I/O, καμία καταγραφή (ο καλών καταγράφει την ολίσθηση).
 */

import {
  findGemiLegalForm,
  type GemiLegalFormEntry,
} from '@/config/company-registry/gemi-legal-forms';
import type { RegistryCode } from '@/types/company-registry';

export type LegalFormRefusal =
  | 'no-legal-form'
  | 'unmapped'
  | 'catalog-drift'
  | 'natural-person'
  | 'unclassifiable';

export type LegalSubjectVerdict =
  | { readonly kind: 'entity'; readonly entry: GemiLegalFormEntry }
  | { readonly kind: 'refused'; readonly reason: LegalFormRefusal; readonly gemiId: string | null };

/**
 * Ίδια περιγραφή = ίδιο κείμενο μετά από NFC και σύμπτυξη κενών. Τίποτα πιο χαλαρό.
 * Η **μία** κρίση ολίσθησης καταλόγου — τη ρωτά και η σύγκριση κατάστασης (`contact-registry-comparison`).
 */
export function sameDescription(live: string, snapshot: string): boolean {
  const normalize = (value: string): string => value.normalize('NFC').replace(/\s+/g, ' ').trim();
  return normalize(live) === normalize(snapshot);
}

function refused(reason: LegalFormRefusal, gemiId: string | null): LegalSubjectVerdict {
  return { kind: 'refused', reason, gemiId };
}

/** Περνά **μόνο** οντότητα του χάρτη, με την περιγραφή του στιγμιοτύπου. */
export function classifyRegistryLegalForm(legalForm: RegistryCode | null): LegalSubjectVerdict {
  if (legalForm === null) return refused('no-legal-form', null);

  const entry = findGemiLegalForm(legalForm.id);
  if (entry === null) return refused('unmapped', legalForm.id);
  if (!sameDescription(legalForm.label, entry.descr)) return refused('catalog-drift', legalForm.id);
  if (entry.subject === 'natural-person') return refused('natural-person', legalForm.id);
  if (entry.subject === 'unclassifiable') return refused('unclassifiable', legalForm.id);

  return { kind: 'entity', entry };
}
