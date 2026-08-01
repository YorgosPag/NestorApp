/**
 * @fileoverview Greek Text Normalization — Shared utility
 * @description Centralized accent-stripping and search normalization for Greek text.
 *
 * Promoted from duplicates in:
 *   - src/services/ai-pipeline/shared/greek-text-utils.ts (stripAccents, normalizeGreekText)
 *   - src/components/ui/searchable-combobox.tsx (normalizeGreek)
 *   - src/components/file-manager/FileManagerPageContent.tsx (inline NFD strip)
 *   - src/components/shared/files/EntityFilesManager.tsx (inline NFD strip)
 *
 * @version 1.0.0
 * @created 2026-03-12
 * @see ADR-217 Phase 11
 */

// ============================================================================
// ACCENT NORMALIZATION (NFD strip)
// ============================================================================

/**
 * Remove Unicode diacritics (accents) from text.
 * "Γιώργος" → "Γιωργος", "Σοφία" → "Σοφια"
 */
export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize Greek text: lowercase + accent strip.
 */
export function normalizeGreekText(text: string): string {
  return stripAccents(text.toLowerCase());
}

// ============================================================================
// GREEK → LATIN TRANSLITERATION
// ============================================================================

/** Digraph mappings (checked first, order matters). */
const GREEK_DIGRAPHS: ReadonlyArray<readonly [string, string]> = [
  // Diphthongs
  ['ου', 'ou'],
  ['αι', 'ai'],
  ['ει', 'ei'],
  ['οι', 'oi'],
  ['αυ', 'av'],
  ['ευ', 'ev'],
  // Consonant clusters
  ['μπ', 'b'],
  ['ντ', 'd'],
  ['γκ', 'g'],
  ['γγ', 'ng'],
  ['τσ', 'ts'],
  ['τζ', 'tz'],
];

/** Single-character Greek → Latin mapping. */
const GREEK_TO_LATIN: ReadonlyMap<string, string> = new Map([
  ['α', 'a'], ['β', 'v'], ['γ', 'g'], ['δ', 'd'], ['ε', 'e'],
  ['ζ', 'z'], ['η', 'i'], ['θ', 'th'], ['ι', 'i'], ['κ', 'k'],
  ['λ', 'l'], ['μ', 'm'], ['ν', 'n'], ['ξ', 'x'], ['ο', 'o'],
  ['π', 'p'], ['ρ', 'r'], ['σ', 's'], ['ς', 's'], ['τ', 't'],
  ['υ', 'y'], ['φ', 'f'], ['χ', 'ch'], ['ψ', 'ps'], ['ω', 'o'],
]);

/**
 * Transliterate Greek text to Latin characters.
 * "Γιώργος" → "giorgos", "Σοφία" → "sofia"
 *
 * Steps:
 * 1. Lowercase + strip accents
 * 2. Replace digraphs (ου→ou, μπ→b, etc.)
 * 3. Replace remaining single characters
 *
 * Non-Greek input passes through unchanged (lowercased) — callers may hand it
 * mixed or already-Latin text.
 */
export function transliterateGreekToLatin(text: string): string {
  let normalized = normalizeGreekText(text);

  // Replace digraphs first (longer sequences before single chars)
  for (const [greek, latin] of GREEK_DIGRAPHS) {
    normalized = normalized.split(greek).join(latin);
  }

  // Replace remaining single Greek characters
  let result = '';
  for (const char of normalized) {
    const mapped = GREEK_TO_LATIN.get(char);
    result += mapped ?? char;
  }

  return result;
}

// ============================================================================
// TITLE CASE (proper name casing)
// ============================================================================

/**
 * Convert text to Title Case, respecting Greek characters.
 * Each word: first letter uppercase, rest lowercase.
 * Handles hyphenated names: "ΠΑΠΑ-ΓΕΩΡΓΙΟΥ" → "Παπα-Γεωργίου"
 *
 * @example toGreekTitleCase("ΆχΙλλΕΑΣ") → "Αχιλλεας"
 * @example toGreekTitleCase("ΓΡΑΒΑΝΗΣ") → "Γραβανης"
 * @example toGreekTitleCase("παπα-γεωργίου") → "Παπα-Γεωργίου"
 */
export function toGreekTitleCase(text: string): string {
  if (!text) return '';
  return text
    .split(/(\s+)/)
    .map(segment =>
      segment
        .split('-')
        .map(part =>
          part.length > 0
            ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            : part
        )
        .join('-')
    )
    .join('');
}

// ============================================================================
// HOMOGLYPH NORMALIZATION (Latin letters masquerading as Greek)
// ============================================================================

/**
 * Latin capitals that are visually identical to a Greek capital.
 *
 * Lowercase is deliberately limited to `o`: pairs like `a`/`α`, `v`/`ν` and
 * `k`/`κ` differ in shape in most typefaces, so folding them would corrupt
 * genuinely Latin words instead of repairing Greek ones.
 */
const LATIN_TO_GREEK_HOMOGLYPHS: ReadonlyMap<string, string> = new Map([
  ['A', 'Α'], ['B', 'Β'], ['E', 'Ε'], ['Z', 'Ζ'], ['H', 'Η'],
  ['I', 'Ι'], ['K', 'Κ'], ['M', 'Μ'], ['N', 'Ν'], ['O', 'Ο'],
  ['P', 'Ρ'], ['T', 'Τ'], ['Y', 'Υ'], ['X', 'Χ'],
  ['o', 'ο'],
]);

const GREEK_LETTER = /[Ͱ-Ͽἀ-῿]/;
const LATIN_LETTER = /[A-Za-z]/;

/** A run of letters/digits — the unit at which the Greek-context test is applied. */
const WORD_RUN = /[\p{L}\p{N}]+/gu;

/**
 * Repair Greek words contaminated with visually identical Latin letters.
 *
 * CAD titleblocks, OCR output and text pasted through word processors routinely
 * carry a Latin `H` inside `ΣΥΝΤΑΞΗ` or a Latin `O` inside `ΤΟΠΟΓΡΑΦΟΣ`: the glyph
 * is identical on screen, the code point is not, and every string comparison
 * fails with no visible cause.
 *
 * The fold is applied **per word** and only when the word is unambiguously Greek —
 * it must contain at least one Greek letter, and every Latin letter it contains
 * must be a homoglyph. That guard is what keeps genuinely Latin text intact:
 * `www.nikolaou.com.gr`, `Arial` and `OTE` carry no Greek letter, so they are
 * returned untouched.
 *
 * The reverse direction (a Latin word contaminated with Greek letters) is **not**
 * handled — it needs the opposite guard and has no measured occurrence here.
 *
 * @example normalizeGreekHomoglyphs('ΣΥΝΤΑΞH') → 'ΣΥΝΤΑΞΗ'   // Latin H → Greek Η
 * @example normalizeGreekHomoglyphs('www.nikolaou.com.gr') → unchanged
 * @see ADR-745 §2.3 — measured in `G753_ergasia F.dxf`
 */
export function normalizeGreekHomoglyphs(text: string): string {
  return text.replace(WORD_RUN, word => {
    if (!GREEK_LETTER.test(word)) return word;

    let folded = '';
    for (const char of word) {
      if (!LATIN_LETTER.test(char)) {
        folded += char;
        continue;
      }
      const greek = LATIN_TO_GREEK_HOMOGLYPHS.get(char);
      if (greek === undefined) return word; // a non-homoglyph Latin letter — leave the word alone
      folded += greek;
    }
    return folded;
  });
}

// ============================================================================
// SEARCH NORMALIZATION
// ============================================================================

/**
 * Full normalization for search/filter operations.
 *
 * Applies:
 * 1. Accent stripping (NFD diacritics removal)
 * 2. Lowercase
 * 3. Punctuation removal (`.`, `-`, `_`, `/`, `\`, `(`, `)`)
 *
 * Use-case: matching "Δ.Ο.Υ." against "ΔΟΥ", "Πατρών" against "Πατρων", etc.
 */
export function normalizeForSearch(text: string): string {
  return normalizeGreekText(text).replace(/[.\-_/\\()]/g, '');
}

// ============================================================================
// WORD-SEQUENCE MATCHING (label / phrase recognition)
// ============================================================================

/**
 * The form in which labels are **compared** — never the form that gets stored.
 *
 * Two steps, in this order: homoglyphs are folded first (the `ΣΥΝΤΑΞΗ` written into a
 * CAD titleblock ends in a **Latin** `H`), then accents, case and punctuation drop.
 * The reverse order does not work: `normalizeForSearch` has already lowercased the
 * Latin `H` into `h`, which is the homoglyph of no Greek lowercase letter in the table
 * above — the damage becomes irreversible (ADR-745 §2.3 Γ).
 *
 * @see ADR-745 §6.4 — promoted here from the titleblock reader so that `src/config`
 *      can reach it: `src/subapps/dxf-viewer/**` is excluded from the root
 *      `tsconfig.json`, so an import in the other direction would be type-unchecked.
 */
export function normalizeForLabelMatch(text: string): string {
  return normalizeForSearch(normalizeGreekHomoglyphs(text));
}

/** A word part: letters, digits and the punctuation `normalizeForSearch` discards anyway. */
const PHRASE_WORD_RUN = /[\p{L}\p{N}.\-_/\\()+]+/gu;

/** One word of a text together with its position in the **original** string. */
export interface TextWord {
  readonly raw: string;
  readonly normalized: string;
  readonly start: number;
  readonly end: number;
}

/**
 * Split text into words with their positions — the positions are what make slicing possible.
 *
 * Runs that degenerate to the empty string after normalization (a lone `-`, `()`) are not
 * words but separators, and are dropped: that is what lets `ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ` be
 * compared without a third pass, and what makes `ΠΟΛΙΤΙΚΟΣ - ΜΗΧΑΝΙΚΟΣ` adjacent.
 */
export function splitIntoWords(text: string): TextWord[] {
  const words: TextWord[] = [];
  for (const match of text.matchAll(PHRASE_WORD_RUN)) {
    const raw = match[0];
    const normalized = normalizeForLabelMatch(raw);
    if (normalized.length === 0) continue;
    words.push({ raw, normalized, start: match.index, end: match.index + raw.length });
  }
  return words;
}

/**
 * True when `phrase` sits exactly on the words that start at `from`.
 *
 * Matching is done word by word, never on substrings: `ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ` must not be read
 * as containing `ΜΕΛΕΤΗ`, because `μελετη` ends in the middle of `μελετης`. Without the
 * word boundary every prefix label poisons the longer one that contains it.
 *
 * Both sides must already be in `normalizeForLabelMatch` form.
 */
export function matchesWordSequenceAt(
  words: readonly TextWord[],
  from: number,
  phrase: readonly string[],
): boolean {
  if (from + phrase.length > words.length) return false;
  return phrase.every((word, k) => words[from + k].normalized === word);
}

/**
 * True when `phrase` occurs as a **contiguous** run of words anywhere in `words`.
 *
 * Contiguity is the point. Plain set containment would read `ΠΟΛΙΤΙΚΟΣ ΥΠΑΛΛΗΛΟΣ ΚΑΙ
 * ΜΗΧΑΝΙΚΟΣ ΑΥΤΟΚΙΝΗΤΩΝ` as «πολιτικός μηχανικός», because both words are present —
 * just not next to each other.
 *
 * An empty phrase matches nothing: it is a compilation accident, not a wildcard.
 */
export function containsWordSequence(
  words: readonly TextWord[],
  phrase: readonly string[],
): boolean {
  if (phrase.length === 0) return false;
  for (let i = 0; i + phrase.length <= words.length; i += 1) {
    if (matchesWordSequenceAt(words, i, phrase)) return true;
  }
  return false;
}
