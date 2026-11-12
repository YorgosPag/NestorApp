/**
 * **Η αδελφή γραμμή** (ADR-923 §5.5.2 Β3 Γ11): μια γραμμή χωρίς πεδίο που διαφέρει από αντιστοιχισμένη γραμμή του **ίδιου πίνακα**
 * σε **μία μόνο λέξη**, με την ίδια μονάδα («ΠΑΡΟΧΗ ΑΕΡΑ · M · m³/h» δίπλα στο «ΠΑΡΟΧΗ ΑΕΡΑ · H · m³/h» → `airflow_h`). Καθαρό.
 *
 * 🔑 Απόδειξη από **τα δεδομένα**, όχι ομοιότητα ονομάτων: η αδελφή είναι ιδιότητα που ο ίδιος πίνακας ήδη γεμίζει. Καμία αδελφή ⇒
 *    `null`, και η οθόνη μένει στη σημερινή πρόταση από τη γραμμή — ποτέ μαντεψιά.
 * 🔑 Ο κωδικός ακολουθεί τη σύμβαση της αδελφής **μόνο** όταν εκείνη τελειώνει στη λέξη που αλλάζει (`airflow_h` → `airflow_l`).
 * @module subapps/catalog/import/line-sibling
 */

import type { LocalizedText } from '@/i18n/localized-text';
import { foldLatinWord } from '@/utils/greek-text';
import type { ImportLineIdentity, ImportLineSibling } from '../types/catalog-import';
import { normalizeUniqueText } from '../values/normalize-unique';
import { suggestCatalogCode } from '../vocabulary/suggest-catalog-code';

/** Λέξεις μιας ετικέτας: κενά και το διαχωριστικό κελιών « · » χωρίζουν. */
const WORD_SPLIT = /[\s·]+/u;

const wordsOf = (text: string): string[] => text.split(WORD_SPLIT).filter((word) => word !== '');
const sameWord = (a: string, b: string): boolean => normalizeUniqueText(a) === normalizeUniqueText(b);

/** Αντιστοιχισμένη γραμμή του πίνακα: τι είναι, και ποια ιδιότητα γεμίζει. */
export interface BoundLineOfTable {
  readonly identity: ImportLineIdentity;
  readonly attributeId: string;
}

/** Η μία λέξη που διαφέρει, ή `null` όταν διαφέρουν καμία ή πάνω από μία, ή όταν αλλάζει το πλήθος των λέξεων. */
function differingWord(target: readonly string[], other: readonly string[]): { readonly from: string; readonly to: string } | null {
  if (target.length !== other.length) return null;
  const at = target.flatMap((word, index) => (sameWord(word, other[index]) ? [] : [index]));
  return at.length === 1 ? { from: other[at[0]], to: target[at[0]] } : null;
}

/**
 * Η αδελφή μιας γραμμής χωρίς πεδίο. **Μία** ακριβώς υποψήφια, αλλιώς `null`: δύο ιδιότητες που ταιριάζουν εξίσου είναι ερώτηση για
 * άνθρωπο, όχι πρόταση.
 */
export function lineSiblingOf(target: ImportLineIdentity, bound: readonly BoundLineOfTable[]): ImportLineSibling | null {
  const words = wordsOf(target.printed);
  if (words.length < 2) return null;
  const found = bound.flatMap((entry) => {
    if (entry.identity.unitCode !== target.unitCode) return [];
    const word = differingWord(words, wordsOf(entry.identity.printed));
    return word ? [{ attributeId: entry.attributeId, ...word }] : [];
  });
  const distinct = new Set(found.map((entry) => entry.attributeId));
  return distinct.size === 1 ? found[0] : null;
}

/** Οι μορφές κωδικού μιας λέξης: όπως μεταγράφεται, και με τα ελληνικά ομοιόμορφα ως λατινικά («Η» → `h`, όχι `i`). */
const codeFormsOf = (word: string): string[] => [...new Set([suggestCatalogCode(foldLatinWord(word)), suggestCatalogCode(word)])].filter((form) => form !== '');

/** `airflow_h` + (H → L) ⇒ `airflow_l`. Η αδελφή δεν τελειώνει στη λέξη ⇒ `null` (ο καλών προτείνει από την ετικέτα). */
export function siblingCodeOf(siblingCode: string, sibling: Pick<ImportLineSibling, 'from' | 'to'>): string | null {
  const fromForms = codeFormsOf(sibling.from);
  const toForms = codeFormsOf(sibling.to);
  for (const [index, form] of fromForms.entries()) {
    const to = toForms[Math.min(index, toForms.length - 1)];
    if (to !== undefined && siblingCode.endsWith(`_${form}`)) return `${siblingCode.slice(0, -form.length)}${to}`;
  }
  return null;
}

/** Η λέξη της αδελφής αντικαθίσταται, **μόνο** αν η ετικέτα τη γράφει ακριβώς μία φορά ως λέξη· αλλιώς `null`. */
export function relabelWord(text: string, sibling: Pick<ImportLineSibling, 'from' | 'to'>): string | null {
  const parts = text.split(/(\s+)/u);
  const hits = parts.flatMap((part, index) => (part.trim() !== '' && sameWord(foldLatinWord(part), foldLatinWord(sibling.from)) ? [index] : []));
  if (hits.length !== 1) return null;
  return parts.map((part, index) => (index === hits[0] ? sibling.to : part)).join('');
}

/** Κάθε γλώσσα της αδελφής με τη λέξη αλλαγμένη· γλώσσα όπου δεν αλλάζει με βεβαιότητα **φεύγει** (καμία λάθος ετικέτα). */
export function relabelText(text: LocalizedText, sibling: Pick<ImportLineSibling, 'from' | 'to'>): LocalizedText {
  return Object.fromEntries(Object.entries(text).flatMap(([language, value]) => {
    const next = typeof value === 'string' ? relabelWord(value, sibling) : null;
    return next === null ? [] : [[language, next]];
  }));
}
