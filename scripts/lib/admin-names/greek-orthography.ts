/**
 * @fileoverview **Η ΟΡΘΟΓΡΑΦΙΑ ΤΩΝ ΟΝΟΜΑΤΩΝ ΕΜΦΑΝΙΣΗΣ** — ADR-893.
 * @related `src/utils/greek-text.ts` (δίπλωμα, ομοιόγλυφα) · `resolve-display-names.ts` (καταναλωτής)
 *
 * Τρεις ερωτήσεις, καμία μαντεψιά:
 * 1. **Ίδιο όνομα;** — χωρίς τόνους και πεζοκεφαλαία, λέξη προς λέξη ({@link sameWrittenWords}).
 * 2. **Σωστά τονισμένη λέξη;** — ο κανόνας του μονοτονικού: κάθε **πολυσύλλαβη** λέξη έχει
 *    **ακριβώς έναν** τόνο, κάθε μονοσύλλαβη κανέναν ({@link isMonotonicWord}).
 * 3. **Πώς γράφεται;** — η γραφή (πεζά/τόνοι) μεταφέρεται από τον υποψήφιο, η **στίξη** μένει του
 *    επίσημου ονόματος ({@link transferWriting}).
 *
 * 🔴 **ΓΙΑΤΙ Ο ΕΛΕΓΧΟΣ 2 ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ — ΜΕΤΡΗΜΕΝΟ 2026-09-27**: το κείμενο του ν. 3852/2010
 * στη Βικιθήκη είναι OCR του ΦΕΚ και **χάνει τόνους** (`Ακτιου`, `Μενελαϊδας`). Χωρίς τον κανόνα,
 * ένας χαμένος τόνος γίνεται «επίσημο όνομα» — δηλαδή το μισοτονισμένο όνομα που η απόφαση της
 * 2026-09-25 (`admin-area-index-file.ts`) έκρινε **χειρότερο από το κεφαλαίο**.
 */

import { normalizeGreekHomoglyphs, stripAccents } from '../../../src/utils/greek-text';

/** Μια λέξη: συνεχόμενα γράμματα. Ό,τι άλλο (κενό, παύλα, κόμμα, παρένθεση) είναι στίξη. */
const WORD = /\p{L}+/gu;

/** Οι λέξεις που **δεν** παίρνουν κεφαλαίο αρχικό μέσα σε όνομα τόπου. */
const LOWERCASE_PARTICLES: ReadonlySet<string> = new Set(['και']);

/** Το δίπλωμα σύγκρισης: χωρίς τόνους/διαλυτικά, κεφαλαία. */
export function foldWord(word: string): string {
  return stripAccents(word).normalize('NFC').toUpperCase();
}

export function wordsOf(text: string): readonly string[] {
  return text.match(WORD) ?? [];
}

/** Ίδιες λέξεις, με την ίδια σειρά, όταν αγνοηθούν τόνοι, πεζοκεφαλαία και στίξη. */
export function sameWrittenWords(a: string, b: string): boolean {
  const left = wordsOf(a);
  const right = wordsOf(b);
  return left.length === right.length && left.every((word, i) => foldWord(word) === foldWord(right[i]));
}

/**
 * **Καθάρισμα OCR** — ό,τι το ΦΕΚ έγραφε σωστά και η σάρωση χάλασε.
 *
 * Μετρημένα στη Βικιθήκη: `µ` (U+00B5, σύμβολο micro) αντί για `μ` · `∆` (U+2206, τελεστής) αντί
 * για `Δ` · λατινικά ομοιόγλυφα μέσα σε ελληνική λέξη (`Nότιας`, `Boιών`). Το NFKC διορθώνει
 * το `µ`· το `∆` **δεν** είναι συμβατό ισοδύναμο, γι' αυτό ρητά.
 */
export function cleanOcrText(text: string): string {
  return normalizeGreekHomoglyphs(text.normalize('NFKC').replace(/∆/g, 'Δ'));
}

const VOWELS = 'αεηιουω';
const DIPHTHONGS: ReadonlySet<string> = new Set(['αι', 'ει', 'οι', 'υι', 'ου', 'αυ', 'ευ', 'ηυ']);
const ACUTE = /[́]/u;
const DIAERESIS = /[̈]/u;

/** Τα γράμματα μιας λέξης ως `{ base, acute, diaeresis }` — η NFD χωρίζει τη βάση από τα σημάδια. */
function letters(word: string): readonly { base: string; acute: boolean; diaeresis: boolean }[] {
  return [...word.toLowerCase().normalize('NFC')].map((char) => {
    const decomposed = char.normalize('NFD');
    return { base: decomposed[0], acute: ACUTE.test(decomposed), diaeresis: DIAERESIS.test(decomposed) };
  });
}

/**
 * Πόσες συλλαβές (φωνηεντικοί πυρήνες) έχει η λέξη.
 *
 * Δίφθογγος = δύο φωνήεντα του πίνακα, **εκτός** αν το πρώτο τονίζεται (`Μάιος`) ή το δεύτερο
 * έχει διαλυτικά (`Χαϊδαρίου`). Ο τόνος στο **δεύτερο** φωνήεν δεν σπάει τη δίφθογγο (`Αίγινα`).
 */
export function syllableCount(word: string): number {
  const chars = letters(word);
  let count = 0;
  for (let i = 0; i < chars.length; i += 1) {
    if (!VOWELS.includes(chars[i].base)) continue;
    count += 1;
    const next = chars[i + 1];
    const joins = next !== undefined && DIPHTHONGS.has(chars[i].base + next.base) && !chars[i].acute && !next.diaeresis;
    if (joins) i += 1;
  }
  return count;
}

/** Ο κανόνας του μονοτονικού — **και** ότι η λέξη είναι γραμμένη με πεζά (όχι `ΒΕΡΟΙΑΣ`). */
export function isMonotonicWord(word: string): boolean {
  const tail = [...word].slice(1).join('');
  if (tail !== tail.toLowerCase()) return false;
  const accents = letters(word).filter((letter) => letter.acute).length;
  // Μονοσύλλαβη ⇒ **κανένας** τόνος (το `<= 1` που ήταν εδώ διαφωνούσε με την τεκμηρίωση και άφηνε
  // να περάσει το `Φρέ` του ekloges — ο Δήμος Αποκορώνου γράφει `Φρε`, μετρημένο 5/0, ADR-893 Φ2).
  return syllableCount(word) >= 2 ? accents === 1 : accents === 0;
}

function capitalise(word: string): string {
  const lower = word.toLowerCase();
  if (LOWERCASE_PARTICLES.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Γιατί ένας υποψήφιος απορρίφθηκε — ρητά, για την αναφορά. */
export type WritingRejection = 'different-words' | 'not-monotonic';

export type WritingResult = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: WritingRejection };

/**
 * Γράφει το **επίσημο** όνομα με τη γραφή του υποψηφίου: οι λέξεις παίρνουν πεζά/τόνους από
 * τον υποψήφιο, η στίξη και η σειρά μένουν του επίσημου. Αρνείται αν οι λέξεις δεν είναι οι
 * ίδιες ή αν κάποια λέξη του υποψηφίου παραβιάζει το μονοτονικό.
 */
export function transferWriting(official: string, candidate: string): WritingResult {
  if (!sameWrittenWords(official, candidate)) return { ok: false, reason: 'different-words' };
  const source = wordsOf(candidate);
  if (!source.every(isMonotonicWord)) return { ok: false, reason: 'not-monotonic' };
  let index = 0;
  return { ok: true, text: official.replace(WORD, () => capitalise(source[index++])) };
}
