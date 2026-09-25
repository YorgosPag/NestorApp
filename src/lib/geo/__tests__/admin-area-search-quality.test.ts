/**
 * @fileoverview **ΠΥΛΗ ΠΟΙΟΤΗΤΑΣ ΑΝΑΖΗΤΗΣΗΣ** (ADR-883 §5.11) — offline αξιολόγηση συνάφειας, όπως τη
 * κάνουν οι ομάδες αναζήτησης: ερωτήσεις **παραγόμενες από το ίδιο το ευρετήριο**, ανά είδος
 * (όπως γράφει ο κόσμος), και μέτρηση «βρέθηκε η σωστή περιοχή στις 5 πρώτες;».
 *
 * 🔑 Οι άγκυρες-παραδείγματα λένε «αυτή η ερώτηση δουλεύει»· αυτή η πύλη λέει «**καμία αλλαγή δεν
 * έκανε τη χώρα χειρότερη**». Ένα καλό αποτέλεσμα στο «Ξυλοπ» που χαλάει 40 άλλα χωριά κοκκινίζει εδώ.
 *
 * ⚠️ **RATCHET**: τα όρια είναι ~1 μονάδα κάτω από το μετρημένο (2026-09-25). Βελτίωση ⇒ ανέβασέ τα·
 *    ΠΟΤΕ μην τα κατεβάσεις για να περάσει αλλαγή — βρες ποιες ερωτήσεις χάθηκαν.
 * Ομώνυμο (ίδιο όνομα, άλλη περιοχή) μετρά ως επιτυχία: καμία ερώτηση δεν τα ξεχωρίζει.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ADMIN_AREA_INDEX_FILE, readAdminAreaIndex, type AdminArea } from '../admin-area-index-file';
import { buildAdminAreaIndex, searchAdminAreas } from '../admin-area-search';
import { LEVEL_WORDS, formsOf, greekWords } from '../admin-area-words';

const index = buildAdminAreaIndex(
  readAdminAreaIndex(JSON.parse(readFileSync(join(process.cwd(), 'public', ADMIN_AREA_INDEX_FILE), 'utf8'))),
);

/** Ντετερμινιστικό δείγμα: μία περιοχή στις 50, με σειρά ταυτότητας — ίδιο σε κάθε εκτέλεση. */
const SAMPLE_EVERY = 50;
const sample = [...index.areas.values()]
  .sort((a, b) => a.id.localeCompare(b.id))
  .filter((_, position) => position % SAMPLE_EVERY === 0)
  .map((area) => ({ area, words: greekWords(area.name).filter((word) => !LEVEL_WORDS.has(word)) }))
  .filter(({ words }) => words.length > 0);

/** Ένα λάθος αντικατάστασης στη μέση της πρώτης λέξης — ντετερμινιστικά (το επόμενο γράμμα του αλφαβήτου). */
const ALPHABET = 'αβγδεζηθικλμνξοπρστυφχψω';
function withTypo(word: string): string {
  const at = Math.floor(word.length / 2);
  const next = ALPHABET[(ALPHABET.indexOf(word[at]) + 1) % ALPHABET.length];
  return word.slice(0, at) + next + word.slice(at + 1);
}

type Case = { readonly query: string; readonly target: AdminArea };

const CASES: Readonly<Record<string, readonly Case[]>> = {
  'πλήρες όνομα': sample.map(({ area, words }) => ({ query: words.join(' '), target: area })),
  greeklish: sample.map(({ area, words }) => ({ query: words.map((word) => formsOf(word).at(-1)).join(' '), target: area })),
  'πρόθεμα 5 γραμμάτων': sample
    .filter(({ words }) => words[0].length >= 6)
    .map(({ area, words }) => ({ query: words[0].slice(0, 5), target: area })),
  'ένα λάθος': sample
    .filter(({ words }) => words[0].length >= 6)
    .map(({ area, words }) => ({ query: [withTypo(words[0]), ...words.slice(1)].join(' '), target: area })),
};

/**
 * Recall@5 (%) — μετρημένο 2026-09-25 στο ευρετήριο της Φάσης 7. Για σύγκριση, ο ΠΡΟΗΓΟΥΜΕΝΟΣ ταιριαστής
 * στο ΙΔΙΟ δείγμα: πλήρες όνομα 80,0 · greeklish 80,3 · πρόθεμα 31,0 · ένα λάθος 6,3 (ADR-883 §7).
 */
const FLOOR: Readonly<Record<string, number>> = {
  'πλήρες όνομα': 88.5, // μετρημένο 89,7
  greeklish: 89, // μετρημένο 90,3
  'πρόθεμα 5 γραμμάτων': 58, // μετρημένο 59,0
  'ένα λάθος': 83.5, // μετρημένο 84,5
};

function recallAt5(cases: readonly Case[]): number {
  const found = cases.filter(({ query, target }) =>
    searchAdminAreas(index, query, 5).some((area) => area.id === target.id || area.name === target.name),
  );
  return (100 * found.length) / cases.length;
}

describe('ποιότητα αναζήτησης — Recall@5 ανά είδος ερώτησης (ratchet)', () => {
  it.each(Object.keys(CASES))('%s', (kind) => {
    const recall = recallAt5(CASES[kind]);
    // eslint-disable-next-line no-console -- η μέτρηση ΕΙΝΑΙ το προϊόν αυτής της πύλης
    console.log(`Recall@5 ${kind}: ${recall.toFixed(1)}% (${CASES[kind].length} ερωτήσεις)`);
    expect(recall).toBeGreaterThanOrEqual(FLOOR[kind]);
  });
});
