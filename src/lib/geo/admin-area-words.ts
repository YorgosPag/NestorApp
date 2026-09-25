/**
 * @fileoverview **ΛΕΞΕΙΣ ΟΝΟΜΑΤΩΝ ΠΕΡΙΟΧΩΝ** — κανονικοποίηση, κλίση, greeklish, «ίδια λέξη».
 * @related ADR-883 §5.5 · §5.10 · `admin-area-search.ts` (αναζήτηση) · `scripts/lib/admin-boundaries/settlement-points.ts` (γεννήτορας)
 * @module lib/geo/admin-area-words
 *
 * 🔑 **ΓΙΑΤΙ ΕΞΗΧΘΗ (ADR-883 §5.10)**: η ερώτηση *«είναι αυτές οι δύο γραφές το ΙΔΙΟ όνομα;»*
 * τίθεται πλέον από **δύο** πλευρές — από την αναζήτηση (ο άνθρωπος γράφει «Εύοσμος», η πηγή
 * «Ευόσμου») **και** από τον γεννήτορα, που ταιριάζει τα σημεία της ΕΛΣΤΑΤ («Δορκάς,η») με τους
 * οικισμούς της ιεραρχίας («Δορκάδα»). Δύο υλοποιήσεις θα έδιναν δύο απαντήσεις: ο γεννήτορας
 * θα έβαζε ψευδώνυμο που η αναζήτηση δεν αναγνωρίζει, ή το αντίστροφο.
 *
 * ⚠️ **Φύλλο με ΣΧΕΤΙΚΕΣ εισαγωγές, χωρίς `@/` σε χρόνο εκτέλεσης** — το διαβάζει και ο
 * γεννήτορας (`tsx`, χωρίς ρύθμιση alias). Το `greek-text` δεν έχει καμία εισαγωγή.
 */

import { normalizeForSearch, transliterateGreekToLatin } from '../../utils/greek-text';

/**
 * Λέξεις που **ονομάζουν βαθμίδα**, όχι τόπο — ποτέ δεν ψάχνονται ως όνομα.
 * Η τιμή είναι η βαθμίδα που υπονοούν (`null` = μέρος σύνθετου όρου, χωρίς δική του).
 */
export const LEVEL_WORDS: ReadonlyMap<string, number | null> = new Map([
  ['περιφερεια', 3], ['περιφερειασ', 3], ['perifereia', 3], ['region', 3],
  ['περιφερειακη', 4], ['νομοσ', 4], ['νομου', 4], ['πε', 4], ['nomos', 4],
  ['δημοσ', 5], ['δημου', 5], ['dimos', 5], ['dhmos', 5], ['municipality', 5],
  ['δημοτικη', 6], ['δε', 6], ['ενοτητα', null], ['ενοτητασ', null],
  ['κοινοτητα', 7], ['τοπικη', 7], ['κοινοτητασ', 7], ['koinotita', 7],
  // ADR-883 §5.10 — ⚠️ ΟΧΙ «χωριό»: υπάρχει οικισμός με αυτό το όνομα (Χωριό Καλύμνου), και λέξη
  //    βαθμίδας δεν ψάχνεται ποτέ ως όνομα ⇒ θα γινόταν αόρατος.
  ['οικισμοσ', 8], ['οικισμου', 8], ['oikismos', 8], ['village', 8], ['settlement', 8],
]);

/**
 * Ελληνικό κείμενο → λέξεις σύγκρισης: χωρίς τόνους, πεζά, `ς`→`σ`, χωρίς στίξη.
 * ⚠️ Η παύλα **χωρίζει** λέξεις *πριν* την κανονικοποίηση — το `normalizeForSearch` τη
 * σβήνει, και το «ΕΛΕΥΘΕΡΙΟΥ-ΚΟΡΔΕΛΙΟΥ» θα γινόταν **μία** λέξη που δεν ταιριάζει ποτέ.
 */
export function greekWords(text: string): string[] {
  return normalizeForSearch(text.replace(/[-–—/]/g, ' '))
    .replace(/ς/g, 'σ')
    .split(/[\s,·]+/)
    .filter((word) => word.length > 0);
}

/**
 * **Φωνητικό δίπλωμα λατινικών** — δύο διαφορετικές γραφές του ίδιου ήχου γίνονται ίδιες.
 * ⚠️ Εφαρμόζεται **και στις δύο πλευρές**: η μεταγραφή της πηγής και το greeklish του
 * ανθρώπου διπλώνονται με τον **ίδιο** κανόνα, αλλιώς δεν συναντιούνται ποτέ.
 */
function foldLatin(word: string): string {
  return word
    .replace(/ch/g, 'h')
    .replace(/ph/g, 'f')
    .replace(/ks/g, 'x')
    .replace(/ou/g, 'u')
    .replace(/e[uf]/g, 'ev')
    .replace(/a[uf]/g, 'av')
    .replace(/[eo]i/g, 'i')
    .replace(/ai/g, 'e')
    .replace(/y/g, 'i')
    .replace(/w/g, 'o')
    .replace(/(.)\1/g, '$1');
}

/** Όλες οι μορφές μιας λέξης που αξίζει να συγκριθούν: η ελληνική και η λατινική της. */
export function formsOf(word: string): string[] {
  const latin = foldLatin(transliterateGreekToLatin(word));
  return latin === word ? [word] : [word, latin];
}

/** Οι λέξεις **τόπου** ενός ονόματος (χωρίς λέξεις βαθμίδας), η καθεμία με τις μορφές της. */
export function nameWordForms(name: string): string[][] {
  return greekWords(name)
    .filter((word) => !LEVEL_WORDS.has(word))
    .map(formsOf);
}

export function nameWords(name: string): string[] {
  return nameWordForms(name).flat();
}

/** Ταιριάζει η λέξη του ανθρώπου σε λέξη της πηγής; Πρόθεμα, ή πρόθεμα **θέματος** (κλίση). */
export function wordMatches(asked: string, known: string): boolean {
  if (known.startsWith(asked)) return true;
  return asked.length >= 5 && known.startsWith(asked.slice(0, -2));
}

/**
 * **Ίδια λέξη**, όχι πρόθεμα: ίση, ή ίδιο θέμα με διαφορά κατάληξης ≤ 2 γράμματα
 * (Θεσσαλονίκη↔Θεσσαλονίκης, Κορδελιό↔Κορδελιού, Δορκάς↔Δορκάδα). Το «Θεσ» **δεν** είναι Θεσσαλονίκη.
 */
export function sameWord(asked: string, known: string): boolean {
  if (asked === known) return true;
  return asked.length >= 5 && Math.abs(known.length - asked.length) <= 2 && known.startsWith(asked.slice(0, -2));
}

export function sameWordAny(asked: readonly string[], known: readonly string[]): boolean {
  return asked.some((form) => known.some((word) => sameWord(form, word)));
}

/**
 * **Είναι οι δύο γραφές το ΙΔΙΟ όνομα;** — ίδιο πλήθος λέξεων τόπου, και κάθε λέξη ίδια με
 * την αντίστοιχη (με κλίση). «Δορκάς» = «Δορκάδα» · «Τοπική Κοινότητα Καρτερών» = «Καρτερές».
 * Κενό όνομα (μόνο λέξεις βαθμίδας) δεν είναι ποτέ ίδιο με τίποτα.
 */
export function sameAdminName(a: string, b: string): boolean {
  const left = nameWordForms(a);
  const right = nameWordForms(b);
  if (left.length === 0 || left.length !== right.length) return false;
  return left.every((forms, index) => sameWordAny(forms, right[index]));
}
