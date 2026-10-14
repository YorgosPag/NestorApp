/**
 * @fileoverview Matching Reference — αριθμοί παραστατικών μέσα στο κείμενο της τράπεζας
 * @description Το δεύτερο κανάλι ανάκτησης υποψηφίων, δίπλα στη ζώνη ποσού. Όταν ο πελάτης γράφει «ΤΠΥ-Α 123»
 *   στην αιτιολογία, το τιμολόγιο Α-123 είναι υποψήφιο ΑΚΟΜΗ ΚΑΙ αν πλήρωσε μέρος του ή αν η τράπεζα κράτησε
 *   προμήθεια — περιπτώσεις που η ζώνη ποσού δεν πιάνει. (Οι χρήστες του Xero ζητούν ακριβώς αυτό εδώ και χρόνια.)
 *
 * Καθαρή συνάρτηση: κανένα I/O. Ψευδώς θετικό = ένα παραπάνω υποψήφιο που η βαθμολόγηση θα κρίνει· ποτέ αυτόματη
 * αντιστοίχιση μόνο από αυτό.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 2 — στένεμα υποψηφίων)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { InvoiceReference } from '../../types/bank';
import type { InvoiceSeries } from '../../types/invoice';
import { normalizeGreek } from './matching-scoring';

/**
 * Ελληνικά κεφαλαία που μοιάζουν με λατινικά. Η σειρά «A» γράφεται συχνά με ελληνικό «Α» στις αιτιολογίες —
 * χωρίς αναδίπλωση, «Α-123» ≠ «A-123» και το τιμολόγιο χάνεται.
 */
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  α: 'a', β: 'b', ε: 'e', ζ: 'z', η: 'h', ι: 'i', κ: 'k', μ: 'm', ν: 'n', ο: 'o', ρ: 'p', τ: 't', υ: 'y', χ: 'x',
};

/** Αφαίρεση τόνων, πεζά, αναδίπλωση ομόγλυφων — ίδια κανονικοποίηση για κείμενο και ψευδώνυμα σειράς. */
export function foldReferenceText(text: string): string {
  return [...normalizeGreek(text)].map((ch) => HOMOGLYPHS[ch] ?? ch).join('');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Τα ονόματα με τα οποία μια σειρά εμφανίζεται σε κείμενο: ο κωδικός της και το πρόθεμά της. */
function seriesAliases(series: InvoiceSeries): string[] {
  return [series.code, series.prefix]
    .map((alias) => foldReferenceText(alias ?? ''))
    .filter((alias) => alias.length > 0);
}

/**
 * Κάθε (σειρά, αριθμός) που αναγράφεται στα κείμενα. Αναγνωρίζει «Α-123», «A 123», «ΤΠΥ-Α/0123», «A#123»·
 * ΔΕΝ δέχεται το ψευδώνυμο μέσα σε λέξη ή τον αριθμό μέσα σε μεγαλύτερο αριθμό.
 */
export function extractInvoiceReferences(
  texts: ReadonlyArray<string | null | undefined>,
  seriesList: readonly InvoiceSeries[]
): InvoiceReference[] {
  const haystack = texts.filter((text): text is string => Boolean(text)).map(foldReferenceText).join(' \n ');
  if (!haystack) return [];

  const found = new Map<string, InvoiceReference>();
  for (const series of seriesList) {
    for (const alias of seriesAliases(series)) {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}\\s*[-/#.:]?\\s*(\\d{1,9})(?!\\p{N})`,
        'gu'
      );
      for (const match of haystack.matchAll(pattern)) {
        const number = Number.parseInt(match[1] ?? '', 10);
        if (!Number.isSafeInteger(number) || number <= 0) continue;
        found.set(`${series.code}#${number}`, { series: series.code, number });
      }
    }
  }
  return [...found.values()];
}
