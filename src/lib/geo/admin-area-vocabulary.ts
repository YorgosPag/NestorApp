/**
 * @fileoverview **ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΟΥ ΕΥΡΕΤΗΡΙΟΥ ΠΕΡΙΟΧΩΝ** — κάθε λέξη μία φορά, κρίνεται μία φορά ανά ερώτηση,
 * με ανοχή ορθογραφίας όταν ζητηθεί («Ξυλούπολη» ⇒ Ξυλόπολη, «Αλεξανρουπολη» ⇒ Αλεξανδρούπολη).
 * @related ADR-883 §5.11 · `admin-area-search.ts` (ο καλών) · `admin-area-words.ts` (κλίση) · `lib/string/edit-distance.ts`
 * @module lib/geo/admin-area-vocabulary
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΟΠΩΣ ΤΟ ΚΑΝΟΥΝ ΟΙ ΜΗΧΑΝΕΣ ΑΝΑΖΗΤΗΣΗΣ (έρευνα 2026-09-25) — ΚΑΙ ΤΙ ΔΙΑΛΕΞΑΜΕ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * | Κανόνας | Πηγή | Εδώ |
 * |---|---|---|
 * | Damerau (μετάθεση = 1 λάθος) | Algolia · Elasticsearch (`transpositions: true`) | ναι |
 * | Λάθη ανά μήκος λέξης | Meilisearch 5/9 · Algolia 4/8 · Typesense 4/7 | **5 / 9** — τα ελληνικά χωριά έχουν πολλά σχεδόν-ομώνυμα |
 * | Πρώτο γράμμα σωστό | Elasticsearch `prefix_length: 1` · Meilisearch (λάθος στο 1ο = 2) | ναι |
 * | Λάθη **μόνο όταν δεν βρέθηκε τίποτα ακριβές** | Typesense `typo_tokens_threshold: 1` · Algolia `min` | ναι — ο καλών |
 * | Κρίση στο **λεξιλόγιο**, όχι σε κάθε εγγραφή | Lucene (αυτόματα Levenshtein) · Algolia · Meilisearch | ναι |
 *
 * 🔑 **Ταχύτητα (μετρημένο)**: η πρώτη εκδοχή ρωτούσε τον ταιριαστή για κάθε λέξη **κάθε** περιοχής
 * (15.248 περιοχές × ~20 λέξεις γενεαλογίας) ⇒ 24 ms ανά πάτημα σε desktop. Εδώ: κάθε λέξη του
 * λεξιλογίου κρίνεται **μία** φορά, μόνο στον κουβά του **πρώτου γράμματος**, και οι περιοχές
 * κρατούν **ακέραιους** δείκτες ⇒ η βαθμολογία είναι αναγνώσεις πίνακα.
 *
 * 🔑 **Τα λάθη που ΑΚΟΥΓΟΝΤΑΙ ίδια δεν κοστίζουν τίποτα**: ο/ω, ι/η/υ/ει/οι, διπλά σύμφωνα
 * ενώνονται ήδη στη **λατινική** μορφή κάθε λέξης (`formsOf`) — «Ξυλούπολη» (βόρειο ιδίωμα ο→ου)
 * είναι **ένα** λάθος.
 *
 * 🔑 **Διόρθωση ΟΛΟΚΛΗΡΗΣ λέξης πάνω από διόρθωση προθέματος**: «Καλαμτα» είναι ένα λάθος από το
 * **θέμα** «Καλαματ-ας» (ολόκληρη λέξη) αλλά και από την **αρχή** του «Καλαμα-ριάς» — νικά η πρώτη.
 */

import { editDistance, prefixEditDistance } from '../string/edit-distance';
import { inflectionStems, wordMatcher } from './admin-area-words';

/** Λάθη ανά μήκος λέξης (Meilisearch): κάτω από 5 γράμματα κανένα, από 5 ένα, από 9 δύο. */
const ONE_TYPO_FROM = 5;
const TWO_TYPOS_FROM = 9;

export function editDistanceBudget(length: number): number {
  if (length >= TWO_TYPOS_FROM) return 2;
  return length >= ONE_TYPO_FROM ? 1 : 0;
}

export interface AdminAreaVocabulary {
  /** Κάθε λέξη (ελληνική ή λατινική μορφή) **μία** φορά — ο δείκτης της είναι η ταυτότητά της. */
  readonly words: readonly string[];
  readonly idOf: ReadonlyMap<string, number>;
  /** Δείκτες ανά πρώτο γράμμα — κάθε κρίση ψάχνει μόνο εκεί. */
  readonly byHead: ReadonlyMap<string, readonly number[]>;
  /** Τα θέματα κάθε λέξης (χωρίς γνωστή κατάληξη) — για τη διόρθωση ολόκληρης λέξης. */
  readonly stems: readonly (readonly string[])[];
  /** Η υπογραφή γραμμάτων κάθε λέξης — το φίλτρο πριν τον πίνακα απόστασης. */
  readonly letters: Uint32Array;
}

/**
 * **Υπογραφή γραμμάτων** (32 bit, ένα ανά κουβά γράμματος). Κάθε διαφορετικό γράμμα του ανθρώπου που
 * **λείπει εντελώς** από τη λέξη της πηγής κοστίζει τουλάχιστον ένα λάθος ⇒ αν λείπουν περισσότερα από
 * όσα επιτρέπονται, η λέξη απορρίπτεται **χωρίς** πίνακα απόστασης. Σύγκρουση κουβάδων κάνει το φίλτρο
 * μόνο πιο χαλαρό — ποτέ δεν χάνει σωστή διόρθωση. (Profiling §5.11: ο πίνακας ήταν το μισό κόστος.)
 */
export function letterSignature(word: string): number {
  let signature = 0;
  for (let i = 0; i < word.length; i += 1) signature |= 1 << (word.charCodeAt(i) % 32);
  return signature >>> 0;
}

function popcount(value: number): number {
  let bits = value >>> 0;
  let count = 0;
  while (bits !== 0) {
    bits &= bits - 1;
    count += 1;
  }
  return count;
}

/** Τουλάχιστον τόσα λάθη χωρίζουν το κομμάτι από τη λέξη — μόνο από τα γράμματα που της λείπουν. */
const missingLetters = (piece: number, known: number): number => popcount(piece & ~known);

export function buildAdminAreaVocabulary(all: Iterable<string>): AdminAreaVocabulary {
  const words = [...new Set(all)];
  const idOf = new Map(words.map((word, id) => [word, id]));
  const byHead = new Map<string, number[]>();
  words.forEach((word, id) => {
    const bucket = byHead.get(word[0]) ?? [];
    bucket.push(id);
    byHead.set(word[0], bucket);
  });
  return { words, idOf, byHead, stems: words.map(inflectionStems), letters: Uint32Array.from(words, letterSignature) };
}

/** Οι δείκτες των λέξεων — κάθε λέξη υπάρχει στο λεξιλόγιο, επειδή από αυτές χτίστηκε. */
export function vocabularyIds(vocabulary: AdminAreaVocabulary, words: readonly string[]): Int32Array {
  return Int32Array.from(words, (word) => vocabulary.idOf.get(word) ?? -1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Βαθμός = `λάθη × 2 + (ολόκληρη λέξη ? 0 : 1)` — μικρότερος καλύτερος, -1 = κανένα ταίρι.
// Ένας ακέραιος ανά λέξη λεξιλογίου: η σύγκριση «καλύτερο» είναι σκέτο `<`.
// ─────────────────────────────────────────────────────────────────────────────

export const NO_GRADE = -1;
export const gradeTypos = (grade: number): number => grade >> 1;
export const gradeIsWhole = (grade: number): boolean => (grade & 1) === 0;
const encode = (typos: number, whole: boolean): number => typos * 2 + (whole ? 0 : 1);

/** Ένα κομμάτι της λέξης του ανθρώπου (ολόκληρη ή θέμα), με το όριο λαθών και την υπογραφή του. */
interface Piece {
  readonly text: string;
  readonly budget: number;
  readonly letters: number;
}

function pieceOf(text: string): Piece {
  return { text, budget: editDistanceBudget(text.length), letters: letterSignature(text) };
}

/** Λάθη ανάμεσα σε κομμάτι και στόχο, με το όριο του κομματιού — `∞` πάνω από το όριο. */
function typosWithin(piece: Piece, target: string, targetLetters: number): number {
  if (piece.budget === 0 || missingLetters(piece.letters, targetLetters) > piece.budget) return Number.POSITIVE_INFINITY;
  const distance = editDistance(piece.text, target, { transpositions: true, max: piece.budget });
  return distance <= piece.budget ? distance : Number.POSITIVE_INFINITY;
}

/**
 * Λάθη **ολόκληρης** λέξης: λέξη↔λέξη, ή θέμα↔θέμα (ίδια λέξη, άλλη κατάληξη: «Ξυλούπολ-η» ↔
 * «Ξυλοπόλ-εως»). Όχι σταυρωτά: θέμα απέναντι σε ολόκληρη λέξη θα «χάριζε» την κατάληξη.
 * Η υπογραφή της **ολόκληρης** λέξης της πηγής περιέχει κάθε θέμα της ⇒ ισχύει και για τα θέματα.
 */
function wholeWordTypos(form: Piece, stems: readonly Piece[], known: string, knownStems: readonly string[], letters: number): number {
  let best = typosWithin(form, known, letters);
  for (const stem of stems) for (const knownStem of knownStems) best = Math.min(best, typosWithin(stem, knownStem, letters));
  return best;
}

function typoGrade(form: Piece, stems: readonly Piece[], known: string, knownStems: readonly string[], letters: number): number {
  const whole = wholeWordTypos(form, stems, known, knownStems, letters);
  if (Number.isFinite(whole)) return encode(whole, true);
  if (form.budget === 0 || missingLetters(form.letters, letters) > form.budget) return NO_GRADE;
  if (known.length < form.text.length - form.budget) return NO_GRADE;
  const prefix = prefixEditDistance(form.text, known, form.budget);
  return prefix <= form.budget ? encode(prefix, false) : NO_GRADE;
}

/**
 * **Ο βαθμός κάθε λέξης του λεξιλογίου απέναντι σε ΜΙΑ λέξη του ανθρώπου** (όλες τις μορφές της).
 * `correct = false`: μόνο ό,τι γράφτηκε (λέξη/κλίση/πρόθεμα). `true`: και διόρθωση λαθών.
 */
export function gradeVocabulary(vocabulary: AdminAreaVocabulary, forms: readonly string[], correct: boolean): Int8Array {
  const grades = new Int8Array(vocabulary.words.length).fill(NO_GRADE);
  for (const form of forms) {
    const match = wordMatcher(form);
    const piece = pieceOf(form);
    const stems = correct ? inflectionStems(form).map(pieceOf) : [];
    for (const id of vocabulary.byHead.get(form[0]) ?? []) {
      const known = vocabulary.words[id];
      const kind = match(known);
      let grade = kind === 'word' ? 0 : kind === 'prefix' ? 1 : NO_GRADE;
      if (grade === NO_GRADE && correct) {
        grade = typoGrade(piece, stems, known, vocabulary.stems[id], vocabulary.letters[id]);
      }
      if (grade !== NO_GRADE && (grades[id] === NO_GRADE || grade < grades[id])) grades[id] = grade;
    }
  }
  return grades;
}
