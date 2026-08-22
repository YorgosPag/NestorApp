/**
 * ΑΓΚΥΡΕΣ ΤΟΥ ΣΚΕΛΕΤΟΥ — UTS #39 (ADR-787 §5.3 δ)
 *
 * ⚠️ **Οι μεταλλάξεις είναι ΣΤΙΣ ΕΙΣΟΔΟΥΣ**, όχι στη συνάρτηση: παραποιείται το
 * κείμενο του `confusables.txt` και ελέγχεται ότι ο **γεννήτορας** το αντανακλά.
 * Μια μετάλλαξη στη συνάρτηση θα αποδείκνυε ότι το test τρέχει· μια μετάλλαξη
 * στην είσοδο αποδεικνύει ότι το test **κοιτάζει το σωστό πράγμα**.
 *
 * ⚠️ Κάθε μετάλλαξη φυλάσσεται από τον έλεγχο *«η μετάλλαξη ΔΕΝ άλλαξε τίποτα»*:
 * ένα regex που δεν ταίριαξε θα άφηνε το test **πράσινο χωρίς να δοκιμάσει
 * τίποτα** — το σχήμα που το CHECK 3.44 πλήρωσε με το μάθημα `Μ11`.
 */

import fs from 'fs';
import { skeleton, looksIdentical, UNICODE_VERSION } from '../skeleton';

const { parseConfusables, SOURCE } = require('../../../../scripts/generate-confusable-skeleton.js');

const GREEK_OMICRON = 'ο'; // ο
const GREEK_NU_CAPITAL = 'Ν'; // Ν
const CYRILLIC_A = 'а'; // а — οπτικά ταυτόσημο με λατινικό a

// =============================================================================
// Μ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η πηγή υπάρχει και είναι αναγνώσιμη
// =============================================================================

describe('Μ0 — παρονομαστής', () => {
  it('Μ0α: η πηγή του προτύπου ζει στο repo', () => {
    expect(fs.existsSync(SOURCE)).toBe(true);
  });

  it('Μ0β: ο πίνακας παρήχθη από δηλωμένη έκδοση Unicode', () => {
    expect(UNICODE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('Μ0γ: ο πίνακας έχει τάξη μεγέθους προτύπου, όχι δείγματος', () => {
    const { table } = parseConfusables(fs.readFileSync(SOURCE, 'utf8'));
    // Το UTS #39 έχει ~6.500 αντιστοιχίες. Αν πέσει κάτω από 5.000, κάτι έσπασε
    // στην ανάλυση και ο σκελετός θα ήταν σιωπηλά ασθενέστερος.
    expect(Object.keys(table).length).toBeGreaterThan(5000);
  });
});

// =============================================================================
// Κ — ΤΑ ΚΡΙΤΗΡΙΑ
// =============================================================================

describe('Κ — η κρίση «μοιάζουν ίδια;»', () => {
  it('Κ1: ελληνικό ο μέσα σε λατινική λέξη ⇒ ίδιος σκελετός', () => {
    expect(looksIdentical('nestor', `nest${GREEK_OMICRON}r`)).toBe(true);
  });

  it('Κ2: ελληνικό κεφαλαίο Ν στην αρχή ⇒ ίδιος σκελετός', () => {
    expect(looksIdentical('nestor', `${GREEK_NU_CAPITAL}estor`)).toBe(true);
  });

  it('Κ3: κυριλλικό α ⇒ ίδιος σκελετός (δεν είναι μόνο ελληνικό το πρόβλημα)', () => {
    expect(looksIdentical('parking', `p${CYRILLIC_A}rking`)).toBe(true);
  });

  it('Κ4: διαφορετικά ονόματα μένουν διαφορετικά', () => {
    expect(looksIdentical('nestor', 'pagonis')).toBe(false);
    expect(looksIdentical('παγωνης', 'νεστωρ')).toBe(false);
  });

  it('Κ5: ο σκελετός δεν είναι ταυτότητα — κανονικοποιεί', () => {
    expect(skeleton(`nest${GREEK_OMICRON}r`)).not.toBe(`nest${GREEK_OMICRON}r`);
  });

  it('Κ6: χαρακτήρες εκτός BMP δεν κόβονται στη μέση', () => {
    // 𝐧 = MATHEMATICAL BOLD SMALL N (U+1D427) — ζεύγος υποκατάστασης.
    // Με `split('')` θα γινόταν δύο μισοί που δεν αντιστοιχίζονται σε τίποτα.
    const mathBoldN = '\u{1D427}';
    expect([...mathBoldN]).toHaveLength(1);
    expect(skeleton(`${mathBoldN}estor`)).toBe(skeleton('nestor'));
  });
});

// =============================================================================
// Λ — Η ΑΝΤΙ-ΔΙΑΙΣΘΗΤΙΚΗ ΑΠΟΦΑΣΗ: CASE FOLDING **ΜΕΤΑ**
// =============================================================================

describe('Λ — το case folding μπαίνει ΜΕΤΑ τον σκελετό', () => {
  it('Λ1: «nest0r» πιάνεται — αυτό ΔΙΑΦΕΥΓΕΙ αν το lowercase μπει πριν', () => {
    // Ο πίνακας στέλνει το ψηφίο 0 στο ΚΕΦΑΛΑΙΟ O. Με lowercase-πριν, ο σκελετός
    // θα ήταν «nestOr» και δεν θα ταίριαζε με «nestor».
    expect(looksIdentical('nestor', 'nest0r')).toBe(true);
  });

  it('Λ2: ο σκελετός επιστρέφει πάντα πεζά', () => {
    expect(skeleton('NESTOR')).toBe(skeleton('nestor'));
    expect(skeleton('NESTOR')).toEqual(skeleton('NESTOR').toLowerCase());
  });

  it('Λ3: η απόδειξη ότι το lowercase-ΠΡΙΝ θα ήταν ασθενέστερο', () => {
    const { table } = parseConfusables(fs.readFileSync(SOURCE, 'utf8'));
    // Αν αυτή η αντιστοίχιση πάψει να στέλνει σε κεφαλαίο, η αιτιολογία της
    // σειράς πάει — και το σχόλιο του `skeleton.ts` γίνεται ψευδές.
    expect(table['0']).toBe('O');
  });
});

// =============================================================================
// Μ — ΜΕΤΑΛΛΑΞΕΙΣ ΣΤΗΝ ΕΙΣΟΔΟ
// =============================================================================

describe('Μ — μεταλλάξεις στο ΙΔΙΟ το confusables.txt', () => {
  const raw = () => fs.readFileSync(SOURCE, 'utf8');

  /** Μεταλλάσσει, και ΟΥΡΛΙΑΖΕΙ αν η μετάλλαξη δεν άλλαξε τίποτα. */
  function mutate(text: string, find: RegExp, replace: string): string {
    const out = text.replace(find, replace);
    if (out === text) {
      throw new Error(`Η ΜΕΤΑΛΛΑΞΗ ΔΕΝ ΑΛΛΑΞΕ ΤΙΠΟΤΑ: ${find} — το test θα ήταν πράσινο χωρίς να δοκιμάσει τίποτα`);
    }
    return out;
  }

  it('Μ1: αν σβηστεί η γραμμή «ελληνικό ο → λατινικό o», η επίθεση ΔΙΑΦΕΥΓΕΙ', () => {
    const before = parseConfusables(raw()).table;
    expect(before[GREEK_OMICRON]).toBe('o');

    const mutated = mutate(raw(), /^03BF\s*;.*$/m, '# (σβήστηκε από τη μετάλλαξη)');
    const after = parseConfusables(mutated).table;
    expect(after[GREEK_OMICRON]).toBeUndefined();
  });

  it('Μ2: αν αλλάξει ο στόχος, ο σκελετός δείχνει αλλού', () => {
    const mutated = mutate(raw(), /^03BF\s*;\s*006F/m, '03BF ;\t0041');
    expect(parseConfusables(mutated).table[GREEK_OMICRON]).toBe('A');
  });

  it('Μ3: αν χαθεί η δήλωση έκδοσης, ο γεννήτορας ΑΡΝΕΙΤΑΙ', () => {
    const mutated = mutate(raw(), /^# Version:.*$/m, '# (χωρίς έκδοση)');
    expect(() => parseConfusables(mutated)).toThrow(/Version/);
  });

  it('Μ4: αν αδειάσουν τα δεδομένα, ο γεννήτορας ΑΡΝΕΙΤΑΙ (δεν γράφει κενό πίνακα)', () => {
    expect(() => parseConfusables('# Version: 17.0.0\n# Date: κάποτε\n')).toThrow(/μηδέν γραμμές/);
  });

  it('Μ5: τα ΣΧΟΛΙΑ δεν διαβάζονται ως δεδομένα', () => {
    // Το confusables.txt γράφει τους ίδιους τους χαρακτήρες μέσα στο σχόλιο
    // ( ο → o ). Ένας αναλυτής που δεν κόβει το «#» θα διάβαζε παράδειγμα.
    const fake = '# Version: 1.0.0\n# Date: χθες\n0041 ;\t0042 ;\tMA\t# ( 0043 → 0044 ) ΨΕΥΤΙΚΟ\n';
    const { table } = parseConfusables(fake);
    expect(table['A']).toBe('B');
    expect(table['C']).toBeUndefined();
  });

  it('Μ6: στόχος με ΠΟΛΛΟΥΣ κωδικούς διαβάζεται ολόκληρος (m → rn)', () => {
    const { table } = parseConfusables(raw());
    expect(table['m']).toBe('rn');
  });
});

// =============================================================================
// Π — ΒΑΘΜΟΝΟΜΗΣΗ: ΨΕΥΔΩΣ ΘΕΤΙΚΑ ΣΕ ΠΡΑΓΜΑΤΙΚΑ ΟΝΟΜΑΤΑ
// =============================================================================

describe('Π — βαθμονόμηση σε ρεαλιστικά ψευδώνυμα', () => {
  const GREEK_NAMES = [
    'παγωνης', 'νεστωρ', 'σοφια', 'κατασκευες', 'τεχνικη', 'δομικα', 'μελετες',
    'αρχιτεκτονες', 'τοπογραφικο', 'μηχανικοι', 'ακινητα', 'μεσιτικο', 'ενεργειακη',
    'ολυμπια', 'αθηνα', 'θεσσαλονικη', 'πατρα', 'ηρακλειο', 'λαρισα', 'βολος',
    'ιωαννινα', 'καβαλα', 'ροδος', 'κερκυρα', 'χανια', 'σερρες', 'ξανθη', 'κοζανη',
  ];
  const LATIN_NAMES = [
    'pagonis', 'nestor', 'sofia', 'construct', 'techniki', 'domika', 'meletes',
    'architects', 'topografiko', 'engineers', 'realestate', 'mesitiko', 'energy',
    'olympia', 'athens', 'thessaloniki', 'patra', 'heraklion', 'larisa', 'volos',
    'nestor-construct', 'building-group', 'gm-tech', 'a1-domi', 'promax', 'formix',
  ];

  function collisions(names: readonly string[]): string[][] {
    const bySkeleton = new Map<string, string[]>();
    for (const n of names) {
      const key = skeleton(n);
      const bucket = bySkeleton.get(key) ?? [];
      bucket.push(n);
      bySkeleton.set(key, bucket);
    }
    return [...bySkeleton.values()].filter((v) => v.length > 1);
  }

  it('Π1: ΜΗΔΕΝ ψευδώς θετικά σε 28 ελληνικά ψευδώνυμα', () => {
    expect(collisions(GREEK_NAMES)).toEqual([]);
  });

  it('Π2: ΜΗΔΕΝ ψευδώς θετικά σε 26 λατινικά ψευδώνυμα', () => {
    expect(collisions(LATIN_NAMES)).toEqual([]);
  });

  it('Π3: «rn» και «m» ΟΝΤΩΣ συγκρούονται — σωστή σύλληψη, όχι ψευδώς θετικό', () => {
    // Δεν είναι ατύχημα: το `rn` διαβάζεται ως `m` σε πολλές γραμματοσειρές, και
    // ο πίνακας του προτύπου το δηλώνει ρητά. Η άγκυρα υπάρχει ώστε ο επόμενος
    // να μην «διορθώσει» τον πίνακα νομίζοντας ότι είναι θόρυβος.
    expect(looksIdentical('rn-tech', 'm-tech')).toBe(true);
  });

  it('Π4: όλες οι πραγματικές επιθέσεις του σχεδιασμού πιάνονται', () => {
    const attacks: ReadonlyArray<readonly [string, string]> = [
      ['nestor', `nest${GREEK_OMICRON}r`],
      ['pagonis', `pag${GREEK_OMICRON}nis`],
      ['sofia', `s${GREEK_OMICRON}fia`],
      ['olympia', `${GREEK_OMICRON}lympia`],
      ['nestor', 'nest0r'],
      ['domika', `d${GREEK_OMICRON}mika`],
    ];
    const escaped = attacks.filter(([a, b]) => !looksIdentical(a, b));
    expect(escaped).toEqual([]);
  });
});
