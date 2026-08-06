/**
 * @fileoverview 🔴 **Η άγκυρα που έλειπε** — το κελί ΚΙΝΕΙΤΑΙ (ADR-762 §6).
 *
 * Ο Giorgio άλλαξε **έναν** μελετητή μέσα στο DXF, ξαναπάτησε «Σύνδεση Πινακίδας», και
 * εξαφανίστηκαν **και οι δύο** — χωρίς μήνυμα, με μόνη ένδειξη «7 πεδία → 6 πεδία». Η γνώση
 * υπήρχε: το ίδιο το fixture έγραφε από την πρώτη μέρα ότι ο κωδ. 71 του κελιού 1076 είναι
 * `4 = ML`. **Καμία μηχανή δεν τη διάβαζε** — παρατήρηση σε σχόλιο, όχι πύλη (ADR-587 §6.1).
 *
 * Γι' αυτό εδώ **τίποτα δεν δηλώνεται· όλα εκτελούνται**. Οι ισχυρισμοί μετακινούν πραγματικά
 * το κελί, ξαναδιαβάζουν, και απαιτούν να μη σπάσει τίποτα — και ο τελευταίος **εκτελεί το
 * παλιό κριτήριο** πάνω στα ίδια δεδομένα ώστε να αποδείξει ότι η άγκυρα δεν είναι κενή.
 */

import { readTitleBlocks } from '../title-block-reading';
import { ROW_TOLERANCE_FACTOR } from '../title-block-pairing';
import {
  cellVerticalSpan,
  declaredBlockHeight,
  MTEXT_LINE_BOX_FACTOR,
  verticalGapToSpan,
} from '../title-block-extent';
import type { TitleBlockSourceCell } from '../title-block-reading.types';
import { G753_TITLEBLOCK_ROWS } from './fixtures/g753-titleblock.fixture';

const LAYER = 'PINAKAKI 500';

/** Η ετικέτα `ΜΕΛΕΤΗΤΗΣ` (`TL`) και το πολύγραμμο κελί των μελετητών (`ML`) — το ζεύγος. */
const LABEL = G753_TITLEBLOCK_ROWS.find((r) => r.handle === '1057')!;
const DESIGNERS = G753_TITLEBLOCK_ROWS.find((r) => r.handle === '1076')!;

const asCell = (row: (typeof G753_TITLEBLOCK_ROWS)[number]): TitleBlockSourceCell => row;

/**
 * Το ίδιο κελί με `extraLines` επιπλέον γραμμές — **αυτό ακριβώς κάνει ο χρήστης** όταν
 * προσθέτει μελετητή. Το `\P` είναι η αλλαγή παραγράφου του MTEXT· το κείμενο μπαίνει πριν το
 * κλείσιμο της ομάδας ώστε να μείνει μέσα στην ίδια τυπογραφική στοίβα.
 */
function withExtraLines(extraLines: number): TitleBlockSourceCell {
  const added = '\\PΠΡΟΣΘΕΤΗ ΓΡΑΜΜΗ'.repeat(extraLines);
  return { ...asCell(DESIGNERS), raw: DESIGNERS.raw.replace(/\}$/, `${added}}`) };
}

/** Το ίδιο κελί κομμένο στις πρώτες `keep` γραμμές — ο χρήστης που **αφαιρεί** μελετητή. */
function withFewerLines(keep: number): TitleBlockSourceCell {
  const parts = DESIGNERS.raw.split('\\P');
  return { ...asCell(DESIGNERS), raw: `${parts.slice(0, keep).join('\\P')}}` };
}

/** Η ανάγνωση της αριστερής πινακίδας με το κελί μελετητών αντικατεστημένο. */
function readWith(designersCell: TitleBlockSourceCell) {
  const cells = G753_TITLEBLOCK_ROWS.map((row) =>
    row.handle === '1076' ? designersCell : asCell(row),
  );
  return readTitleBlocks(LAYER, cells)[0];
}

describe('το μοντέλο ύψους — χωρίς γραμματοσειρά, από το ίδιο το αρχείο', () => {
  it('🔴 ο συντελεστής κουτιού γραμμής είναι ΑΚΡΙΒΩΣ 5/3, και το λέει η ίδια η πινακίδα', () => {
    // Η ετικέτα είναι `TL`, το κελί των μελετητών `ML`. Αν ο συντάκτης τα κεντράρισε — και τα
    // κεντράρισε — τότε `y(ετικέτα) − ύψος_κουτιού/2 == y(τιμή)`. Λύνοντας ως προς τον
    // συντελεστή, το αρχείο **δηλώνει** την τιμή του· δεν την επιλέξαμε εμείς.
    const implied = (2 * (LABEL.y - DESIGNERS.y)) / LABEL.height;
    expect(implied).toBeCloseTo(MTEXT_LINE_BOX_FACTOR, 1);
    expect(MTEXT_LINE_BOX_FACTOR).toBe(5 / 3);
  });

  it('🔴 τα κέντρα απέχουν 60 φορές λιγότερο από τις κορυφές — η στοίχιση είναι το ΚΕΝΤΡΟ', () => {
    const label = cellVerticalSpan(asCell(LABEL));
    const value = cellVerticalSpan(asCell(DESIGNERS));
    expect(Math.abs(value.center - label.center)).toBeLessThan(0.02);
    // Και η «προφανής» εναλλακτική, εκτελεσμένη: η σύγκριση κορυφών είναι **δύο τάξεις**
    // χειρότερη — 2,296 έναντι 0,015. Χωρίς αυτή τη γραμμή, το «κορυφή με κορυφή» θα έμοιαζε
    // εξίσου εύλογο για τον επόμενο που θα το διαβάσει.
    expect(Math.abs(value.top - label.top)).toBeGreaterThan(2);
  });

  it('η προσάρτηση αλλάζει ΠΟΥ κάθεται το ίδιο ύψος — TL κορυφή, ML κέντρο, BL βάση', () => {
    const base = { handle: 'H', x: 0, y: 100, height: 3, raw: 'ΕΝΑ' } as const;
    const height = declaredBlockHeight(base);
    expect(cellVerticalSpan({ ...base, attachment: 'TL' }).top).toBe(100);
    expect(cellVerticalSpan({ ...base, attachment: 'ML' }).center).toBeCloseTo(100, 10);
    expect(cellVerticalSpan({ ...base, attachment: 'BL' }).bottom).toBeCloseTo(100, 10);
    // Απούσα προσάρτηση = η προεπιλογή του DXF, όχι δική μας ευκολία.
    expect(cellVerticalSpan(base)).toEqual(cellVerticalSpan({ ...base, attachment: 'TL' }));
    expect(height).toBeCloseTo(3 * MTEXT_LINE_BOX_FACTOR, 10);
  });

  it('κελί χωρίς χρησιμοποιήσιμο ύψος εκφυλίζεται σε ΣΗΜΕΙΟ — δεν παράγει NaN', () => {
    for (const height of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const span = cellVerticalSpan({ handle: 'Z', x: 0, y: 7, height, raw: 'Χ' });
      expect(span).toEqual({ top: 7, bottom: 7, center: 7, height: 0 });
    }
  });
});

describe('🔴 ΜΟΝΟΤΟΝΙΑ — το εύρος μεγαλώνοντας δεν χάνει σημείο που ήδη περιέχει', () => {
  it('η απόσταση της ετικέτας από το εύρος της τιμής ΔΕΝ αυξάνεται ποτέ με το κείμενο', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let extra = 0; extra <= 12; extra++) {
      const gap = verticalGapToSpan(LABEL.y, cellVerticalSpan(withExtraLines(extra)));
      expect(gap).toBeLessThanOrEqual(previous);
      previous = gap;
    }
    expect(previous).toBe(0);
  });
});

describe('🔴 ΤΟ ΚΕΛΙ ΚΙΝΕΙΤΑΙ — και το πεδίο ΜΕΝΕΙ δεμένο', () => {
  const designersOf = (reading: ReturnType<typeof readWith>) =>
    reading.fields.find((f) => f.key === 'designers');

  it('προσθήκη 1..12 γραμμών: το πεδίο ΜΕΛΕΤΗΤΗΣ επιβιώνει σε ΚΑΘΕ πλήθος', () => {
    for (let extra = 0; extra <= 12; extra++) {
      const reading = readWith(withExtraLines(extra));
      expect({ extra, bound: designersOf(reading) !== undefined }).toEqual({ extra, bound: true });
      // Και δεν είναι κενή επιβίωση: τα πρόσωπα εξακολουθούν να βγαίνουν.
      expect(reading.people.map((p) => p.displayName)).toContain('ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ');
    }
  });

  it('αφαίρεση γραμμών — ο χρήστης που ΣΒΗΝΕΙ μελετητή — δεν σπάει ούτε αυτή', () => {
    for (let keep = 1; keep <= 7; keep++) {
      const reading = readWith(withFewerLines(keep));
      expect({ keep, bound: designersOf(reading) !== undefined }).toEqual({ keep, bound: true });
    }
  });

  it('🔴 κανένα ΑΛΛΟ πεδίο δεν παρασύρεται όταν κινείται το κελί των μελετητών', () => {
    const baseline = readWith(asCell(DESIGNERS)).fields.map((f) => f.key).sort();
    expect(baseline).toHaveLength(7);
    for (const extra of [1, 3, 6, 12]) {
      expect(readWith(withExtraLines(extra)).fields.map((f) => f.key).sort()).toEqual(baseline);
    }
  });

  /**
   * Πόσο **κατακόρυφα** αντέχει να μετακινηθεί το κελί πριν χαθεί το πεδίο.
   *
   * ⚠️ **Γιατί μετράμε μετατόπιση και όχι «γραμμές».** Το σημείο εισαγωγής ενός `ML` MTEXT
   * είναι **το ίδιο** το σημείο προσάρτησης: το AutoCAD το κρατά ακίνητο και το μπλοκ μεγαλώνει
   * **γύρω** του. Άρα η αλλαγή περιεχομένου, από μόνη της, **δεν** αλλάζει τον κωδ. 10/20 — και
   * θα ήταν λάθος να το ισχυριστεί αυτή η άγκυρα. Εκείνο που αλλάζει είναι η **έκταση**: το
   * μπλοκ φουσκώνει, βγαίνει από το κελί του πλαισίου, και ο συντάκτης το **σέρνει** για να
   * χωρέσει. Το ζητούμενο, λοιπόν, δεν είναι «πόσες γραμμές» αλλά **πόσο περιθώριο** έχει το
   * ζεύγος — και το παλιό περιθώριο ήταν όσο **μισή γραμμή** εκείνου του κελιού.
   */
  const survivesShift = (rule: (cell: TitleBlockSourceCell) => boolean): number => {
    const STEP = 0.01;
    let shift = 0;
    while (shift < 20 && rule({ ...asCell(DESIGNERS), y: DESIGNERS.y - shift })) shift += STEP;
    return shift;
  };

  it('🔴 η μετατόπιση που αντέχει το ζεύγος ΜΕΓΑΛΩΣΕ — εκτελεσμένο, όχι υπολογισμένο', () => {
    const oldRule = (cell: TitleBlockSourceCell): boolean =>
      Math.abs(cell.y - LABEL.y) <= ROW_TOLERANCE_FACTOR * LABEL.height;
    const newRule = (cell: TitleBlockSourceCell): boolean =>
      readWith(cell).fields.some((f) => f.key === 'designers');

    const oldMargin = survivesShift(oldRule);
    const newMargin = survivesShift(newRule);

    // Το παλιό περιθώριο ήταν **1,52** μονάδες — μία γραμμή ονόματος εκείνου του κελιού (1,50).
    // Ένα σύρσιμο του συντάκτη για να χωρέσει το φουσκωμένο μπλοκ στο κελί του πλαισίου το
    // εξαντλούσε ολόκληρο.
    expect(oldMargin).toBeLessThan(1.05 * DESIGNERS.height * MTEXT_LINE_BOX_FACTOR);
    expect(newMargin).toBeGreaterThan(oldMargin * 1.5);
  });
});

/**
 * 🔑 **Ο πήχης του §Δ.4: κάνε την ΚΛΑΣΗ αδύνατη, όχι το δείγμα πράσινο.**
 *
 * Δεν αρκεί να δουλεύει το `designers` σήμερα. Ζητούμενο είναι η **επόμενη** οριακή περίπτωση
 * να κοκκινίσει **πριν** τη δει χρήστης — γι' αυτό ο ισχυρισμός εδώ δεν αφορά ένα πεδίο αλλά
 * **κάθε** ζεύγος σειράς της πινακίδας.
 */
/**
 * Το `ML` κελί των μελετητών **δεν** ασκεί την περιεκτικότητα: το κέντρο ενός `ML` μπλοκ είναι
 * το ίδιο το σημείο εισαγωγής, άρα η απόκλιση κέντρων είναι ήδη αμετάβλητη. Εκείνο που ασκεί
 * την περιεκτικότητα είναι το **πολύγραμμο `TL`** κελί — εκεί το κέντρο **βυθίζεται** κατά μισό
 * ύψος με κάθε γραμμή που προστίθεται, και χωρίς την περιεκτικότητα το ζεύγος τελικά σπάει.
 *
 * Το `ΘΕΣΗ → ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ…` του πραγματικού αρχείου είναι ακριβώς τέτοιο (`TL`, 2 γραμμές).
 */
describe('🔴 το ΠΟΛΥΓΡΑΜΜΟ TL κελί — εκεί δουλεύει η περιεκτικότητα', () => {
  const LOCATION = G753_TITLEBLOCK_ROWS.find((r) => r.handle === '103E')!;
  const LOCATION_LABEL = G753_TITLEBLOCK_ROWS.find((r) => r.handle === '1054')!;

  const grownLocation = (extraLines: number): TitleBlockSourceCell => ({
    ...asCell(LOCATION),
    raw: LOCATION.raw.replace(/\}$/, `${'\\PΠΡΟΣΘΕΤΗ ΓΡΑΜΜΗ'.repeat(extraLines)}}`),
  });

  const readLocation = (cell: TitleBlockSourceCell) =>
    readTitleBlocks(LAYER, G753_TITLEBLOCK_ROWS.map((r) => (r.handle === '103E' ? cell : asCell(r))))[0];

  it('η απόκλιση κέντρων ΞΕΠΕΡΝΑ την ανοχή καθώς μεγαλώνει — άρα κάτι άλλο κρατά το ζεύγος', () => {
    const labelCenter = cellVerticalSpan(asCell(LOCATION_LABEL)).center;
    const tolerance = ROW_TOLERANCE_FACTOR * LOCATION_LABEL.height;
    const offCenterAt = (extra: number) =>
      Math.abs(cellVerticalSpan(grownLocation(extra)).center - labelCenter);

    expect(offCenterAt(0)).toBeLessThan(tolerance);
    // Με αρκετές γραμμές, το κέντρο έχει βυθιστεί πέρα από κάθε ανοχή. Αν η αποδοχή κρεμόταν
    // **μόνο** από τα κέντρα, εδώ θα χανόταν το `location` — σιωπηλά, όπως χάθηκε ο ΜΕΛΕΤΗΤΗΣ.
    expect(offCenterAt(12)).toBeGreaterThan(tolerance);
  });

  it('🔴 και όμως το πεδίο ΘΕΣΗ επιβιώνει σε 0..12 γραμμές — η περιεκτικότητα το κρατά', () => {
    for (let extra = 0; extra <= 12; extra++) {
      const bound = readLocation(grownLocation(extra)).fields.some((f) => f.key === 'location');
      expect({ extra, bound }).toEqual({ extra, bound: true });
    }
  });
});

/**
 * Το **βάθος** της στοίχισης στήλης μετριέται από τη **βάση** της ετικέτας ως την **κορυφή** της
 * τιμής — όχι από σημείο εισαγωγής σε σημείο εισαγωγής. Με σκέτα `y`, το βάθος περιλάμβανε το
 * ύψος της ίδιας της ετικέτας, οπότε μια ψηλή ή `ML`-προσαρτημένη ετικέτα «απομακρυνόταν» από
 * την τιμή που κάθεται ακριβώς από κάτω της.
 */
describe('🔴 στοίχιση στήλης κάτω από ΨΗΛΗ ετικέτα', () => {
  const cell = (
    handle: string,
    y: number,
    raw: string,
    attachment: 'TL' | 'ML',
    height = 1,
  ): TitleBlockSourceCell => ({ handle, x: 0, y, height, raw, attachment });

  it('ετικέτα ML με εννιά γραμμές βρίσκει την τιμή που κάθεται ΑΚΡΙΒΩΣ από κάτω της', () => {
    // Η ετικέτα είναι `ML` και πολύγραμμη: το `y` της είναι το ΚΕΝΤΡΟ, άρα η βάση της πέφτει
    // πολύ χαμηλότερα. Με ωμά `y` το βάθος μετριέται από το κέντρο και βγαίνει **μεγαλύτερο**
    // από το πραγματικό — η τιμή φαίνεται πιο μακριά απ' ό,τι είναι.
    // Οι γραμμές γεμίσματος είναι **τελείες οδηγοί** — όπως στη φόρμα υπογραφής του πραγματικού
    // αρχείου. Κείμενο εκεί θα γινόταν `inlineValue` και το κελί θα έκλεινε ως `same-cell`,
    // δηλαδή δεν θα ασκούσε καθόλου τη στοίχιση στήλης που εξετάζεται εδώ.
    //
    // 🔑 Τα νούμερα είναι διαλεγμένα ώστε οι δύο γραφές να **διαφωνούν**:
    // · ωμά `y`: βάθος = 0 − (−9) = **9** > 6 ύψη ⇒ απορρίπτεται, το πεδίο χάνεται·
    // · με εύρος: η βάση της ετικέτας είναι στο −7,5, άρα βάθος = **1,5** ⇒ σωστά δεκτό.
    const label = cell('L1', 0, `ΑΡ.ΣΧΕΔΙΟΥ${'\\P...'.repeat(8)}`, 'ML');
    const value = cell('V1', -9, 'Τ7', 'TL');
    const [reading] = readTitleBlocks(LAYER, [label, value]);
    expect(reading.fields.map((f) => [f.key, f.rawValue, f.matchedBy])).toEqual([
      ['drawingNumber', 'Τ7', 'column-alignment'],
    ]);
  });
});

describe('🔴 ΚΑΝΕΝΑ ζεύγος σειράς δεν κάθεται στο χείλος της ανοχής του', () => {
  const cellOf = (handle: string) =>
    asCell(G753_TITLEBLOCK_ROWS.find((r) => r.handle === handle)!);

  /** Πόσο από την ανοχή του καταναλώνει ένα ζεύγος, με το ΝΕΟ μέτρο (απόκλιση κέντρων). */
  const consumption = (labelHandle: string, valueHandle: string): number => {
    const label = cellOf(labelHandle);
    const offCenter = Math.abs(
      cellVerticalSpan(cellOf(valueHandle)).center - cellVerticalSpan(label).center,
    );
    return offCenter / (ROW_TOLERANCE_FACTOR * label.height);
  };

  const rowPairs = readWith(asCell(DESIGNERS)).fields.filter((f) => f.matchedBy === 'row-alignment');

  it('το δείγμα δεν είναι κενό — πέντε ζεύγη σειράς στο πραγματικό αρχείο', () => {
    expect(rowPairs).toHaveLength(5);
  });

  it('κάθε ζεύγος μένει κάτω από το 25% της ανοχής του', () => {
    const measured = Object.fromEntries(
      rowPairs.map((f) => [f.key, Number(consumption(f.labelHandle, f.sourceHandle).toFixed(3))]),
    );
    for (const [key, used] of Object.entries(measured)) {
      expect({ key, overBudget: used > 0.25 }).toEqual({ key, overBudget: false });
    }
  });

  it('🔴 και ο ΙΔΙΟΣ φύλακας θα είχε ΧΤΥΠΗΣΕΙ στον κώδικα που παραδόθηκε', () => {
    // Το παλιό μέτρο ήταν η ωμή απόσταση σημείων εισαγωγής. Με αυτό, το `designers` κατανάλωνε
    // **41%** — πάνω από το διπλάσιο του ορίου — ενώ κανένα άλλο ζεύγος δεν ξεπερνούσε το 16%.
    // Αν αυτός ο φύλακας υπήρχε, ο Giorgio δεν θα είχε δει ποτέ «7 πεδία → 6 πεδία».
    const oldConsumption = (labelHandle: string, valueHandle: string): number => {
      const label = cellOf(labelHandle);
      return Math.abs(cellOf(valueHandle).y - label.y) / (ROW_TOLERANCE_FACTOR * label.height);
    };
    const worst = rowPairs
      .map((f) => ({ key: f.key, used: oldConsumption(f.labelHandle, f.sourceHandle) }))
      .sort((a, b) => b.used - a.used)[0];

    expect(worst.key).toBe('designers');
    expect(worst.used).toBeGreaterThan(0.4);
    // …και με το νέο μέτρο το ίδιο ζεύγος είναι το **καλύτερο** της πινακίδας, όχι το χειρότερο.
    expect(consumption('1057', '1076')).toBeLessThan(0.01);
  });
});

/**
 * 🔴 **Γιατί το κόστος είναι απόκλιση ΚΕΝΤΡΩΝ και όχι ωμή απόσταση σημείων εισαγωγής.**
 *
 * Η περιεκτικότητα απαντά «είναι στην ίδια σειρά;» — αλλά όταν **δύο** ετικέτες βρίσκονται μέσα
 * στο ίδιο ψηλό μπλοκ, κάποιος πρέπει να πει ποια το **κατέχει**. Το αρχείο το λέει: ο συντάκτης
 * κεντράρει την τιμή απέναντι στην ετικέτα της (μετρημένο υπόλοιπο **0,0153** στο ζεύγος
 * `ΜΕΛΕΤΗΤΗΣ`). Η ωμή απόσταση σημείων εισαγωγής θα έδινε το μπλοκ σε όποια ετικέτα τυχαίνει να
 * είναι κοντά στην **κορυφή** του — δηλαδή σε ό,τι στοιχίζεται με τη **γραμμή 1**, όχι με το πεδίο.
 */
describe('🔴 ΔΥΟ ετικέτες μέσα στο ίδιο ψηλό μπλοκ — ποια το κατέχει;', () => {
  it('κερδίζει η ΚΕΝΤΡΑΡΙΣΜΕΝΗ, όχι αυτή που είναι πιο κοντά στην κορυφή', () => {
    const label = (handle: string, y: number, raw: string): TitleBlockSourceCell => ({
      handle, x: 0, y, height: 1, raw, attachment: 'TL',
    });
    // Το ψηλό `ML` μπλοκ: κέντρο στο 0, έξι γραμμές ⇒ εύρος [−5, +5]. **Και οι δύο** ετικέτες
    // πέφτουν μέσα, άρα η περιεκτικότητα από μόνη της είναι ισοπαλία.
    const value: TitleBlockSourceCell = {
      handle: 'V', x: 6, y: 0, height: 1, attachment: 'ML',
      raw: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΝΙΚΟΣ\PΑΓΡΟΝΟΜΟΣ\PΓΑΜΜΑ\PΔΕΛΤΑ\PΕΨΙΛΟΝ\PΖΗΤΑ',
    };
    //  ωμό |Δy|:  ΚΛΙΜΑΚΑ 0,200 · ΜΕΛΕΤΗΤΗΣ 0,833  ⇒ θα κέρδιζε το ΚΛΙΜΑΚΑ — λάθος
    //  κέντρα:    ΚΛΙΜΑΚΑ 0,633 · ΜΕΛΕΤΗΤΗΣ 0,000  ⇒ κερδίζει το ΜΕΛΕΤΗΤΗΣ — σωστό
    const [reading] = readTitleBlocks(LAYER, [
      label('A', 0.2, 'ΚΛΙΜΑΚΑ'),
      label('B', 5 / 6, 'ΜΕΛΕΤΗΤΗΣ'),
      value,
    ]);
    expect(reading.fields.map((f) => f.key)).toEqual(['designers']);
    expect(reading.unmatchedLabels.map((l) => l.key)).toEqual(['scale']);
  });
});

/**
 * Το **δεύτερο** κλειδί ταξινόμησης. Δύο τιμές στο ίδιο ακριβώς ύψος και ίδιο ύψος κειμένου
 * δίνουν **ταυτόσημο** κόστος κέντρων· χωρίς δεύτερο κλειδί η επιλογή θα κρινόταν από τη
 * **λαβή**, δηλαδή από τυχαία δεκαεξαδικά του αρχείου.
 */
describe('🔴 ισοπαλία κόστους — κερδίζει η ΔΙΠΛΑΝΗ, όχι η αλφαβητικά πρώτη λαβή', () => {
  it('η οριζόντια εγγύτητα σπάει την ισοπαλία, όχι η λαβή', () => {
    const at = (handle: string, x: number, raw: string): TitleBlockSourceCell => ({
      handle, x, y: 0, height: 1, raw, attachment: 'TL',
    });
    // 🔑 Η **μακρινή** τιμή έχει τη λαβή που ταξινομείται ΠΡΩΤΗ. Αν οι λαβές αποφάσιζαν, θα
    // κέρδιζε αυτή — και η πινακίδα θα διαβαζόταν σωστά ή λάθος ανάλογα με το ποιο αντικείμενο
    // σχεδίασε πρώτος ο τοπογράφος.
    const [reading] = readTitleBlocks(LAYER, [
      at('A_LABEL', 0, 'ΚΛΙΜΑΚΑ'),
      at('B_FAR', 7, '1:5000'),
      at('C_NEAR', 4, '1:200'),
    ]);
    expect(reading.fields.map((f) => [f.key, f.rawValue])).toEqual([['scale', '1:200']]);
    expect(reading.unparsed).toEqual(['1:5000']);
  });
});
