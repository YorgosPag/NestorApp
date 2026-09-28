/**
 * @fileoverview Άγκυρα ΔΕΔΟΜΕΝΩΝ — τα πραγματικά αρχεία, όχι κατασκευασμένα παραδείγματα — ADR-893.
 *
 * Τρεις ερωτήσεις που κανένα test μονάδας δεν μπορεί να κάνει:
 * - **Δ1** κάθε απόφαση του `admin-display-names.json` είναι έγκυρη **σήμερα** (ίδιες λέξεις με τη γραμμή
 *   του μητρώου, μονοτονικό) — ένας πίνακας γραμμένος με χέρι θα περνούσε αλλιώς ανέλεγκτος·
 * - **Δ2** κάθε απόφαση έχει **εφαρμοστεί** — «έγραψα τον πίνακα αλλά ξέχασα τον μετασχηματιστή»·
 * - **Δ3** τα ονόματα χωρίς απόφαση **μόνο μειώνονται** (ratchet)·
 * - **Δ4** κάθε διόρθωση ονόματος (§7) έχει εφαρμοστεί, και το παλιό όνομα μένει **ψαχνόμενο** — στο μητρώο **και**
 *   στο ευρετήριο της αναζήτησης.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseNameCorrections } from '../apply-name-corrections';
import { isMonotonicWord, sameWrittenWords, wordsOf } from '../greek-orthography';

interface Decision {
  readonly l: number;
  readonly c: string;
  readonly n: string;
  readonly sn: string;
  readonly id?: string;
  readonly an?: readonly string[];
}

const ROOT = process.cwd();
const decisions = JSON.parse(readFileSync(join(ROOT, 'scripts', 'data', 'admin-display-names.json'), 'utf8')) as {
  entries: readonly Decision[];
  unresolved: readonly { l: number; c: string; n: string }[];
};
const hierarchy = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'administrative-hierarchy.json'), 'utf8')) as {
  data: readonly Decision[];
};
const rowByKey = new Map(hierarchy.data.map((row) => [`${row.l}:${row.c}`, row]));

/**
 * 🔒 **Το ταβάνι** — **0** από 2026-09-27 (ADR-893 Φ2): το ekloges.ypes.gr ως τρίτη πηγή + επιμέλεια 30 διαφωνιών με
 * επαληθευμένες επίσημες πηγές + διόρθωση των 3 λαθών γραμμάτων της ΕΛΣΤΑΤ (§7). Ήταν 3.
 * ⛔ ΜΗΝ το ανεβάσεις: ένα όνομα που «έχασε» την απόφασή του σημαίνει ότι άλλαξε η πηγή, και αυτό
 * θέλει απόφαση ανθρώπου, όχι μεγαλύτερο αριθμό.
 */
const UNRESOLVED_CEILING = 0;

describe('ADR-893 — τα ονόματα εμφάνισης πάνω στα πραγματικά αρχεία', () => {
  it('Δ1 · κάθε απόφαση: ίδιες λέξεις με τη γραμμή του μητρώου, και μονοτονικό σε κάθε λέξη', () => {
    const invalid = decisions.entries.filter((entry) => {
      const row = rowByKey.get(`${entry.l}:${entry.c}`);
      return row === undefined || !sameWrittenWords(row.n, entry.n) || !wordsOf(entry.n).every(isMonotonicWord);
    });
    expect(invalid.map((entry) => `${entry.l}:${entry.c} ${entry.n}`)).toEqual([]);
  });

  it('Δ2 · κάθε απόφαση έχει ΕΦΑΡΜΟΣΤΕΙ στο μητρώο (n και sn)', () => {
    const notApplied = decisions.entries.filter((entry) => {
      const row = rowByKey.get(`${entry.l}:${entry.c}`);
      return row?.n !== entry.n || row?.sn !== entry.sn;
    });
    expect(notApplied.map((entry) => `${entry.l}:${entry.c} ${entry.n}`)).toEqual([]);
  });

  it('Δ3 · τα ονόματα χωρίς απόφαση ΜΟΝΟ μειώνονται', () => {
    expect(decisions.unresolved.length).toBeLessThanOrEqual(UNRESOLVED_CEILING);
  });

  it('Δ4 · κάθε διόρθωση ονόματος εφαρμόστηκε, και το ΠΑΛΙΟ όνομα μένει ψαχνόμενο (μητρώο + ευρετήριο)', () => {
    const corrections = parseNameCorrections(JSON.parse(readFileSync(join(ROOT, 'scripts', 'data', 'admin-name-corrections.json'), 'utf8')));
    const index = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'admin-area-index.json'), 'utf8')) as { data: readonly unknown[][] };
    const indexRow = new Map(index.data.map((row) => [row[0], row]));
    const broken = corrections.filter((correction) => {
      const row = rowByKey.get(`${correction.l}:${correction.c}`);
      const alternates = row?.id === undefined ? undefined : indexRow.get(row.id)?.[4];
      return (
        row === undefined ||
        !sameWrittenWords(row.sn, correction.to) ||
        !row.an?.includes(correction.from) ||
        !Array.isArray(alternates) ||
        !alternates.some((name) => typeof name === 'string' && name.endsWith(correction.from))
      );
    });
    expect(broken.map((correction) => `${correction.l}:${correction.c}`)).toEqual([]);
  });
});
