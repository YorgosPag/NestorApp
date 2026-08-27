/**
 * ADR-132 — **Ο ΚΟΙΝΟΣ ΚΟΡΜΟΣ ΤΟΥ ΕΓΓΡΑΦΟΥ ESCO**.
 *
 * 🔑 Επάγγελμα και δεξιότητα διαφέρουν σε **ένα** πράγμα: το επάγγελμα κουβαλά
 * κωδικό ISCO. Ο κορμός — URI, δίγλωσση ετικέτα, tokens αναζήτησης, χρονική
 * σφραγίδα — και **ο κανόνας παράλειψης** *(έννοια χωρίς καμία ετικέτα δεν είναι
 * αναζητήσιμη σε καμία γλώσσα)* είναι ο ίδιος. Γραμμένος δύο φορές, το CHECK 3.28
 * τον μέτρησε ως κλώνο **81 tokens** — μέσα στο ίδιο commit που τον γέννησε.
 *
 * @module scripts/lib/esco/esco-document-base
 */

import { escoIndexTokens } from '../../../src/lib/esco/search-tokens';
import type { EscoSearchResult } from './esco-api';

/** Πόσες έννοιες έμειναν χωρίς ετικέτα, ανά γλώσσα. **Μετριέται, δεν σιωπά.** */
export interface LabelTally {
  missingEl: number;
  missingEn: number;
}

export function createLabelTally(): LabelTally {
  return { missingEl: 0, missingEn: 0 };
}

/** Τα κοινά πεδία κάθε εγγράφου μνήμης ESCO. */
export interface EscoDocumentBase {
  readonly uri: string;
  readonly preferredLabel: { el: string; en: string };
  readonly alternativeLabels: { el: string[]; en: string[] };
  readonly searchTokensEl: string[];
  readonly searchTokensEn: string[];
  readonly updatedAt: Date;
}

/**
 * Ο κορμός του εγγράφου, ή **`null`** αν η έννοια δεν έχει **καμία** ετικέτα.
 *
 * ⚠️ Το `null` σημαίνει «παράλειψη **με λόγο**»: μια έννοια χωρίς ετικέτα δεν
 * μπορεί να βρεθεί σε καμία γλώσσα, οπότε θα ήταν νεκρή εγγραφή. Η παράλειψη
 * φαίνεται στη λογιστική του δρομέα *(δηλωμένα − έγγραφα)*, ποτέ δεν χάνεται.
 *
 * ⚠️ Τα `alternativeLabels` είναι **σκόπιμα κενά**: τα αποτελέσματα αναζήτησης
 * του ESCO δεν τα περιέχουν, και μια κλήση λεπτομέρειας ανά έννοια θα ήταν
 * ~2.942 επιπλέον αιτήματα. Δηλωμένο όριο, όχι παράλειψη.
 */
export function escoDocumentBase(
  concept: EscoSearchResult,
  tally: LabelTally,
): EscoDocumentBase | null {
  const el = concept.preferredLabel?.el ?? '';
  const en = concept.preferredLabel?.en ?? '';
  if (el.length === 0) tally.missingEl += 1;
  if (en.length === 0) tally.missingEn += 1;
  if (el.length === 0 && en.length === 0) return null;

  return {
    uri: concept.uri,
    preferredLabel: { el, en },
    alternativeLabels: { el: [], en: [] },
    searchTokensEl: escoIndexTokens(el),
    searchTokensEn: escoIndexTokens(en),
    updatedAt: new Date(),
  };
}

/** Οι γραμμές λογιστικής των ετικετών — μόνο όσες έχουν τιμή. */
export function labelTallyNotes(tally: LabelTally): string[] {
  const notes: string[] = [];
  if (tally.missingEl > 0) notes.push(`${tally.missingEl} χωρίς ελληνική ετικέτα`);
  if (tally.missingEn > 0) notes.push(`${tally.missingEn} χωρίς αγγλική ετικέτα`);
  return notes;
}
