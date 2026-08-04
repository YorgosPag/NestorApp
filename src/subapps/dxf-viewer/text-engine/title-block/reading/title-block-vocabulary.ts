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

import {
  TITLE_BLOCK_FIELD_KEYS,
  type TitleBlockFieldKey,
} from '@/types/title-block-reading';
import {
  matchesWordSequenceAt,
  normalizeForLabelMatch,
  splitIntoWords,
  type TextWord,
} from '@/utils/greek-text';

/**
 * Η κανονικοποίηση σύγκρισης και το σπάσιμο σε λέξεις **ζούσαν εδώ** μέχρι τη Φ2. Προάχθηκαν
 * στο `@/utils/greek-text` γιατί τα χρειάστηκε και το `src/config/profession-bridge.config.ts`:
 * το `src/subapps/dxf-viewer/**` **εξαιρείται** από το root `tsconfig.json`, άρα εισαγωγή προς
 * τα εδώ από `src/config` θα ήταν τυφλή στον έλεγχο τύπων. Επανεξάγονται αυτούσια ώστε οι
 * καταναλωτές της πινακίδας να μη γνωρίζουν τη μετακόμιση (ADR-745 §6.4).
 */
export { normalizeForLabelMatch, splitIntoWords, type TextWord };

// ── Λεξιλόγιο πεδίων (SSoT) ───────────────────────────────────────────────────

/**
 * Τα κανονικά κλειδιά πεδίου **ζούσαν εδώ** μέχρι τη Φ3β και προήχθησαν στο
 * `@/types/title-block-reading` για τον **ίδιο** λόγο με τα παραπάνω: τα διαβάζει ο Λ2 έξω από
 * το subapp, και ένα κλειδί ορισμένο σε εξαιρεμένο αρχείο δεν ελέγχεται από πουθενά.
 * Επανεξάγονται αυτούσια — καμία αλλαγή για τους καταναλωτές του αναγνώστη.
 *
 * Το **γιατί** των `drawnBy`/`signature` (μέτρηση, όχι πληρότητα) ζει πλέον μαζί με τον ορισμό.
 */
export { TITLE_BLOCK_FIELD_KEYS, type TitleBlockFieldKey };

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

/**
 * Όλες οι ετικέτες μέσα σε ένα κείμενο κελιού, από αριστερά προς τα δεξιά.
 *
 * Το ταίριασμα γίνεται σε **επίπεδο λέξης**, όχι υποσυμβολοσειράς — ο λόγος ζει πλέον στο
 * `matchesWordSequenceAt` (`@/utils/greek-text`), που είναι ο ίδιος μηχανισμός με τον οποίο
 * ο αντίστροφος resolver επαγγέλματος αναγνωρίζει «ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ» (ADR-745 §6.4).
 */
export function findLabelOccurrences(
  words: readonly TextWord[],
  profile: CompiledProfile,
): LabelOccurrence[] {
  const found: LabelOccurrence[] = [];
  let i = 0;
  while (i < words.length) {
    const hit = profile.find((label) => matchesWordSequenceAt(words, i, label.words));
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
