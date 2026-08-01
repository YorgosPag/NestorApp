/**
 * @fileoverview Λεξιλόγιο αναγνώρισης πινακίδας — **δεδομένα**, όχι κείμενο διεπαφής.
 *
 * Οι συμβολοσειρές εδώ είναι ό,τι **γράφει ο τοπογράφος μέσα στο DXF**. Δεν εμφανίζονται
 * ποτέ σε οθόνη και δεν μεταφράζονται: αν μεταφράζονταν, η αναγνώριση θα άλλαζε με τη
 * γλώσσα της διεπαφής — δηλαδή το ίδιο αρχείο θα διαβαζόταν αλλιώς σε αγγλικό περιβάλλον.
 * Γι' αυτό **δεν** περνούν από `t()` (ADR-745 §8 κανόνας 7, N.11 εξαίρεση δεδομένων).
 *
 * Η δομή είναι **προφίλ**: ένα άλλο τοπογραφικό γραφείο προστίθεται ως δεδομένα, χωρίς
 * αλλαγή κώδικα (ADR-745 §12 — μετριασμός της ευθραυστότητας του Λ1).
 *
 * @see ADR-745 §6.3 — TitleBlockFieldKey
 */

import { normalizeForSearch, normalizeGreekHomoglyphs } from '@/utils/greek-text';

// ── Λεξιλόγιο πεδίων (SSoT) ───────────────────────────────────────────────────

/**
 * Τα κανονικά κλειδιά πεδίου.
 *
 * Τα `drawnBy` / `signature` **δεν** ήταν στην πρώτη γραφή του ADR. Μπήκαν από μέτρηση:
 * το `ΣΥΝΤΑΞΗ` και το `ΥΠΟΓΡΑΦΗ` του G753 κάθονται σχεδόν στο **ίδιο y**, οπότε αν το
 * δεύτερο δεν αναγνωριζόταν ως **ετικέτα**, θα διαβαζόταν ως η **τιμή** του πρώτου.
 * Η παράλειψη ενός κλειδιού δεν αφήνει απλώς ένα πεδίο κενό — **μολύνει το διπλανό**.
 */
export const TITLE_BLOCK_FIELD_KEYS = [
  'employer',
  'projectTitle',
  'location',
  'designers',
  'studyType',
  'drawingType',
  'drawingNumber',
  'scale',
  'studyDate',
  'drawnBy',
  'signature',
] as const;

export type TitleBlockFieldKey = (typeof TITLE_BLOCK_FIELD_KEYS)[number];

// ── Προφίλ γραφείου ───────────────────────────────────────────────────────────

/** Οι γραφές με τις οποίες εμφανίζεται μία ετικέτα μέσα στο σχέδιο. */
export interface TitleBlockLabelRule {
  readonly key: TitleBlockFieldKey;
  readonly labels: readonly string[];
}

export interface TitleBlockProfile {
  readonly id: string;
  readonly rules: readonly TitleBlockLabelRule[];
  /** Λέξεις που εισάγουν την έδρα του γραφείου (`ΕΔΡΑ ΝΕΟΧΩΡΟΥΔΑ …`). */
  readonly officeSeatMarkers: readonly string[];
  /** Λέξεις-σημαδούρες στοιχείων επικοινωνίας· αφαιρούνται πριν μείνει το υπόλοιπο. */
  readonly contactMarkers: readonly string[];
}

/**
 * Ελληνικό τοπογραφικό γραφείο — το προφίλ που επαληθεύεται στο `G753_ergasia F.dxf`.
 *
 * Οι παραλλαγές δεν είναι υποθετικές συμπληρώσεις: είναι οι γραφές που συναντώνται σε
 * ελληνικά τοπογραφικά (`ΙΔΙΟΚΤΗΤΗΣ` δίπλα στο `ΕΡΓΟΔΟΤΗΣ`, `ΗΜΕΡΟΜΗΝΙΑ` δίπλα στο
 * `ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ`). Ό,τι δεν ταιριάξει καταλήγει στο `unparsed` — ορατό, όχι χαμένο.
 */
export const GREEK_SURVEYOR_PROFILE: TitleBlockProfile = {
  id: 'greek-surveyor',
  rules: [
    { key: 'employer', labels: ['ΕΡΓΟΔΟΤΗΣ', 'ΙΔΙΟΚΤΗΤΗΣ'] },
    { key: 'projectTitle', labels: ['ΕΡΓΟ'] },
    { key: 'location', labels: ['ΘΕΣΗ'] },
    { key: 'designers', labels: ['ΜΕΛΕΤΗΤΗΣ', 'ΜΕΛΕΤΗΤΕΣ'] },
    { key: 'studyType', labels: ['ΜΕΛΕΤΗ'] },
    { key: 'drawingType', labels: ['ΣΧΕΔΙΟ'] },
    { key: 'drawingNumber', labels: ['ΑΡ.ΣΧΕΔΙΟΥ', 'ΑΡΙΘΜΟΣ ΣΧΕΔΙΟΥ'] },
    { key: 'scale', labels: ['ΚΛΙΜΑΚΑ'] },
    { key: 'studyDate', labels: ['ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ', 'ΗΜΕΡΟΜΗΝΙΑ'] },
    { key: 'drawnBy', labels: ['ΣΥΝΤΑΞΗ'] },
    { key: 'signature', labels: ['ΥΠΟΓΡΑΦΗ'] },
  ],
  officeSeatMarkers: ['ΕΔΡΑ'],
  contactMarkers: ['κιν', 'τηλ', 'fax', 'φαξ', 'site', 'e-mail', 'email', 'web'],
};

// ── Κανονικοποίηση σύγκρισης ──────────────────────────────────────────────────

/**
 * Η μορφή με την οποία συγκρίνονται ετικέτες — **ποτέ** η μορφή που αποθηκεύεται.
 *
 * Δύο βήματα, με αυτή τη σειρά: πρώτα διπλώνονται τα ομόγλυφα (το `ΣΥΝΤΑΞΗ` του αρχείου
 * τελειώνει σε **λατινικό** `H`), μετά πέφτουν τόνοι/πεζά/στίξη. Ανάποδα δεν δουλεύει: το
 * `normalizeForSearch` έχει ήδη πεζώσει το λατινικό `H` σε `h`, που **δεν** είναι ομόγλυφο
 * κανενός ελληνικού πεζού στον πίνακα — η βλάβη γίνεται μη αναστρέψιμη (ADR-745 §2.3 Γ).
 */
export function normalizeForLabelMatch(text: string): string {
  return normalizeForSearch(text);
}

/** Μέρος λέξης: γράμματα, ψηφία και η στίξη που το `normalizeForSearch` έτσι κι αλλιώς ρίχνει. */
const WORD_RUN = /[\p{L}\p{N}.\-_/\\()+]+/gu;

/** Μία λέξη του κειμένου με τη θέση της στο **πρωτότυπο** — η θέση είναι που επιτρέπει την κοπή. */
export interface TextWord {
  readonly raw: string;
  readonly normalized: string;
  readonly start: number;
  readonly end: number;
}

/**
 * Σπάει κείμενο σε λέξεις με θέσεις. Οι «λέξεις» που εκφυλίζονται σε κενό μετά την
 * κανονικοποίηση (σκέτο `-`, `()`) δεν είναι λέξεις — είναι διαχωριστικά, και πετιούνται
 * ώστε ένα `ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ` να μη χρειάζεται τρίτο βήμα για να συγκριθεί.
 */
export function splitIntoWords(text: string): TextWord[] {
  const words: TextWord[] = [];
  for (const match of text.matchAll(WORD_RUN)) {
    const raw = match[0];
    const normalized = normalizeForLabelMatch(raw);
    if (normalized.length === 0) continue;
    words.push({ raw, normalized, start: match.index, end: match.index + raw.length });
  }
  return words;
}

// ── Αναγνώριση ετικέτας ───────────────────────────────────────────────────────

/** Μία ετικέτα σε κανονική μορφή, μαζί με το πόσες λέξεις πιάνει. */
interface CompiledLabel {
  readonly key: TitleBlockFieldKey;
  readonly words: readonly string[];
}

/** Το προφίλ σε μορφή έτοιμη για σύγκριση — μεγαλύτερες ετικέτες πρώτα (§ «longest match»). */
export type CompiledProfile = readonly CompiledLabel[];

/**
 * Μεταγλωττίζει ένα προφίλ **μία φορά**.
 *
 * Η σειρά είναι φθίνουσα κατά πλήθος λέξεων: το `ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ` πρέπει να δοκιμαστεί πριν
 * το `ΜΕΛΕΤΗ`, αλλιώς η μακρύτερη ετικέτα δεν εντοπίζεται ποτέ.
 */
export function compileProfile(profile: TitleBlockProfile): CompiledProfile {
  const compiled: CompiledLabel[] = [];
  for (const rule of profile.rules) {
    for (const label of rule.labels) {
      const words = splitIntoWords(label).map((w) => w.normalized);
      if (words.length > 0) compiled.push({ key: rule.key, words });
    }
  }
  return compiled.sort((a, b) => b.words.length - a.words.length);
}

/** Μία ετικέτα που βρέθηκε μέσα σε κελί, με τα όριά της στο πρωτότυπο κείμενο. */
export interface LabelOccurrence {
  readonly key: TitleBlockFieldKey;
  /** Δείκτης της πρώτης λέξης — `0` σημαίνει «το κελί ΞΕΚΙΝΑ με ετικέτα». */
  readonly wordIndex: number;
  readonly start: number;
  readonly end: number;
}

/** Ταιριάζει μια μεταγλωττισμένη ετικέτα ακριβώς πάνω στις λέξεις που ξεκινούν στο `from`. */
function labelMatchesAt(words: readonly TextWord[], from: number, label: CompiledLabel): boolean {
  if (from + label.words.length > words.length) return false;
  return label.words.every((w, k) => words[from + k].normalized === w);
}

/**
 * Όλες οι ετικέτες μέσα σε ένα κείμενο κελιού, από αριστερά προς τα δεξιά.
 *
 * Το ταίριασμα γίνεται σε **επίπεδο λέξης**, όχι υποσυμβολοσειράς: το `ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ`
 * δεν επιτρέπεται να θεωρηθεί ότι περιέχει το `ΜΕΛΕΤΗ`, γιατί το `μελετη` τελειώνει στη
 * μέση του `μελετης`. Χωρίς όριο λέξης, κάθε ετικέτα-πρόθεμα δηλητηριάζει τη μακρύτερή της.
 */
export function findLabelOccurrences(
  words: readonly TextWord[],
  profile: CompiledProfile,
): LabelOccurrence[] {
  const found: LabelOccurrence[] = [];
  let i = 0;
  while (i < words.length) {
    const hit = profile.find((label) => labelMatchesAt(words, i, label));
    if (!hit) {
      i += 1;
      continue;
    }
    const last = words[i + hit.words.length - 1];
    found.push({ key: hit.key, wordIndex: i, start: words[i].start, end: last.end });
    i += hit.words.length;
  }
  return found;
}
