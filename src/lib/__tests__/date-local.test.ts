/**
 * date-local — ADR-218 SSoT for instant normalisation.
 *
 * Focus: `normalizeToDate` is the single funnel every other helper here goes
 * through, and it must accept every shape a Firestore instant legitimately
 * arrives in — including the two JSON-serialised ones, which have no methods.
 *
 * @see ADR-663 §4 part 5 — why the serialised shapes reach this helper at all
 */

import {
  normalizeToDate,
  normalizeToISO,
  normalizeToMillisOrNull,
  compareInstantsAsc,
  compareInstantsDesc,
  daysSinceOrNull,
  daysUntilOrNull,
  MS_PER_DAY,
  fieldToISO,
  intervalsOverlap,
  intervalShape,
  INTERVAL_SHAPES,
  utcDateOf,
} from '../date-local';

const ISO = '2026-01-15T10:30:00.000Z';
const MS = Date.parse(ISO);
const SECONDS = MS / 1000;

describe('normalizeToDate', () => {
  it('reads a Timestamp via toDate() (client and admin SDK both expose it)', () => {
    expect(normalizeToDate({ toDate: () => new Date(ISO) })?.toISOString()).toBe(ISO);
  });

  it('passes a Date through', () => {
    expect(normalizeToDate(new Date(ISO))?.toISOString()).toBe(ISO);
  });

  it('parses an ISO string', () => {
    expect(normalizeToDate(ISO)?.toISOString()).toBe(ISO);
  });

  it('parses epoch millis', () => {
    expect(normalizeToDate(MS)?.toISOString()).toBe(ISO);
  });

  // The two method-less shapes: a Timestamp that has been through JSON.
  it('reads a JSON-serialised client Timestamp { seconds, nanoseconds }', () => {
    expect(normalizeToDate({ seconds: SECONDS, nanoseconds: 0 })?.toISOString()).toBe(ISO);
  });

  it('reads a JSON-serialised admin Timestamp { _seconds, _nanoseconds }', () => {
    expect(normalizeToDate({ _seconds: SECONDS, _nanoseconds: 0 })?.toISOString()).toBe(ISO);
  });

  it('prefers toDate() over the raw seconds fields when both are present', () => {
    // A live client Timestamp has BOTH a toDate() and a public `seconds`.
    const live = { seconds: 0, nanoseconds: 0, toDate: () => new Date(ISO) };
    expect(normalizeToDate(live)?.toISOString()).toBe(ISO);
  });

  /**
   * Το σχήμα που ΕΛΕΙΠΕ, και γι' αυτό γράφτηκαν 6 από τους 11 τοπικούς κλώνους:
   * τύποι που δηλώνουν μόνο `{ toMillis(): number }` (DXF overlays, BIM openings).
   * @see ADR-218 §Phase 4
   */
  it('reads a Timestamp-like that exposes only toMillis()', () => {
    expect(normalizeToDate({ toMillis: () => MS })?.toISOString()).toBe(ISO);
  });

  it('prefers toDate() over toMillis() when both are present', () => {
    const live = { toDate: () => new Date(ISO), toMillis: () => 0 };
    expect(normalizeToDate(live)?.toISOString()).toBe(ISO);
  });

  it('rejects a toMillis() that returns a non-finite number', () => {
    expect(normalizeToDate({ toMillis: () => NaN })).toBeNull();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['a non-instant object', { foo: 'bar' }],
    ['a non-numeric seconds field', { _seconds: 'nope' }],
    ['an unparseable string', 'not-a-date'],
  ])('returns null for %s', (_label, input) => {
    expect(normalizeToDate(input)).toBeNull();
  });
});

describe('the helpers built on it', () => {
  it('normalizeToISO handles the admin wire shape', () => {
    expect(normalizeToISO({ _seconds: SECONDS, _nanoseconds: 0 })).toBe(ISO);
  });

  it('normalizeToMillisOrNull handles the admin wire shape', () => {
    expect(normalizeToMillisOrNull({ _seconds: SECONDS, _nanoseconds: 0 })).toBe(MS);
  });

  /**
   * Η καρδιά του ADR-218 §Phase 4. Ο προκάτοχος `normalizeToMillis` επέστρεφε `0`
   * εδώ — και το `0` **είναι έγκυρο epoch** (1970-01-01), όχι «δεν ξέρω». Σε
   * comparator περνούσε απαρατήρητο· σε αριθμητική έδινε ~20.600 ημέρες.
   */
  it('normalizeToMillisOrNull returns null — not 0 — for an unreadable value', () => {
    expect(normalizeToMillisOrNull({ foo: 'bar' })).toBeNull();
  });

  it('normalizeToMillisOrNull keeps a real epoch 0 distinguishable from "unknown"', () => {
    expect(normalizeToMillisOrNull(new Date(0))).toBe(0);
    expect(normalizeToMillisOrNull(undefined)).toBeNull();
  });

  it('fieldToISO reads the admin wire shape off a document', () => {
    expect(fieldToISO({ createdAt: { _seconds: SECONDS, _nanoseconds: 0 } }, 'createdAt')).toBe(ISO);
  });

  it('fieldToISO falls back when the field is unreadable', () => {
    expect(fieldToISO({ createdAt: null }, 'createdAt', 'fallback')).toBe('fallback');
  });
});

/**
 * Οι comparators — ADR-218 §Phase 4.
 *
 * Ο λόγος που υπάρχουν: για ταξινόμηση **δεν χρειάζεσαι τον αριθμό, χρειάζεσαι τη
 * σειρά**. Εκθέτοντας μόνο τον comparator, το sentinel δεν διαρρέει ποτέ σε
 * κώδικα χρήστη — δεν υπάρχει `0` ή `NaN` να αρπάξει κανείς κατά λάθος και να το
 * βάλει σε αριθμητική πράξη. Είναι το «make illegal states unrepresentable»
 * εφαρμοσμένο στο συγκεκριμένο σφάλμα.
 */
describe('compareInstantsAsc / compareInstantsDesc', () => {
  const OLD = '2020-01-01T00:00:00.000Z';
  const NEW = '2026-01-15T10:30:00.000Z';

  it('orders oldest→newest ascending', () => {
    expect(compareInstantsAsc(OLD, NEW)).toBeLessThan(0);
    expect(compareInstantsAsc(NEW, OLD)).toBeGreaterThan(0);
  });

  it('orders newest→oldest descending', () => {
    expect(compareInstantsDesc(NEW, OLD)).toBeLessThan(0);
    expect(compareInstantsDesc(OLD, NEW)).toBeGreaterThan(0);
  });

  it('treats equal instants as equal in both directions', () => {
    expect(compareInstantsAsc(NEW, NEW)).toBe(0);
    expect(compareInstantsDesc(NEW, NEW)).toBe(0);
  });

  // NULLS LAST — η σύμβαση της SQL. Μια εγγραφή χωρίς ημερομηνία δεν είναι «η
  // αρχαιότερη», είναι «άγνωστη», και ο χρήστης θέλει πρώτα αυτά που ξέρει.
  it.each([
    ['ascending', compareInstantsAsc],
    ['descending', compareInstantsDesc],
  ])('sorts unknown instants last (%s)', (_label, cmp) => {
    expect(cmp(null, NEW)).toBeGreaterThan(0);
    expect(cmp(NEW, null)).toBeLessThan(0);
    expect(cmp({ foo: 'bar' }, OLD)).toBeGreaterThan(0);
  });

  it('treats two unknowns as equal so the sort stays stable', () => {
    expect(compareInstantsAsc(null, undefined)).toBe(0);
    expect(compareInstantsDesc({ foo: 'bar' }, 'not-a-date')).toBe(0);
  });

  /**
   * Η εγγύηση μη-παλινδρόμησης: τα 5 σημεία που μεταφέρθηκαν από το
   * `normalizeToMillis(b.x) - normalizeToMillis(a.x)` (sentinel `0`) ήταν **όλα**
   * φθίνοντα. Με φθίνουσα σειρά το `0` έστελνε ήδη τα άγνωστα τελευταία, άρα η
   * νέα συμπεριφορά πρέπει να είναι **ταυτόσημη**.
   */
  it('reproduces the old 0-sentinel descending order exactly', () => {
    const rows = [
      { id: 'unknown', createdAt: { foo: 'bar' } },
      { id: 'new', createdAt: NEW },
      { id: 'old', createdAt: OLD },
    ];
    const viaComparator = [...rows]
      .sort((a, b) => compareInstantsDesc(a.createdAt, b.createdAt))
      .map((r) => r.id);
    const viaOldSentinel = [...rows]
      .sort(
        (a, b) =>
          (normalizeToMillisOrNull(b.createdAt) ?? 0) - (normalizeToMillisOrNull(a.createdAt) ?? 0),
      )
      .map((r) => r.id);

    expect(viaComparator).toEqual(['new', 'old', 'unknown']);
    expect(viaComparator).toEqual(viaOldSentinel);
  });
});

/**
 * Οι διάρκειες — ADR-218 §Phase 4.
 *
 * `now` είναι παράμετρος ώστε τα tests να μη χρειάζονται fake timers, και το
 * αποτέλεσμα είναι **κλασματικό**: η στρογγυλοποίηση είναι απόφαση πολιτικής του
 * καλούντος, όχι του SSoT.
 */
describe('daysSinceOrNull / daysUntilOrNull', () => {
  const NOW = Date.parse('2026-01-15T00:00:00.000Z');

  it('counts whole days elapsed', () => {
    expect(daysSinceOrNull(NOW - 3 * MS_PER_DAY, NOW)).toBe(3);
  });

  it('counts whole days remaining', () => {
    expect(daysUntilOrNull(NOW + 7 * MS_PER_DAY, NOW)).toBe(7);
  });

  it('keeps the fractional part so the caller owns the rounding', () => {
    expect(daysSinceOrNull(NOW - MS_PER_DAY / 2, NOW)).toBe(0.5);
  });

  it('goes negative for an instant in the other direction', () => {
    expect(daysSinceOrNull(NOW + 2 * MS_PER_DAY, NOW)).toBe(-2);
    expect(daysUntilOrNull(NOW - 2 * MS_PER_DAY, NOW)).toBe(-2);
  });

  /**
   * Η ΚΛΑΣΗ ΣΦΑΛΜΑΤΟΣ ΠΟΥ ΕΚΛΕΙΣΕ. Ο προκάτοχος επέστρεφε `NaN`, και επειδή
   * **κάθε** σύγκριση με `NaN` είναι `false`, οι φύλακες `if (days < 3) continue`
   * **δεν παρέλειπαν** — άφηναν τη ροή να συνεχίσει και εξέπεμπαν ειδοποίηση με
   * κείμενο «για NaN ημέρες». Το `null` **δεν** έχει αυτή τη συμπεριφορά: ο
   * compiler απαιτεί ρητό έλεγχο πριν από κάθε σύγκριση.
   */
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a non-instant object', { foo: 'bar' }],
    ['an unparseable string', 'not-a-date'],
  ])('returns null — never NaN — for %s', (_label, input) => {
    expect(daysSinceOrNull(input, NOW)).toBeNull();
    expect(daysUntilOrNull(input, NOW)).toBeNull();
  });

  it('never yields a value that silently passes a numeric guard', () => {
    const days = daysSinceOrNull('not-a-date', NOW);
    // Με NaN, και οι δύο αυτοί έλεγχοι ήταν `false` ⇒ fail-open.
    expect(days === null).toBe(true);
    expect(Number.isNaN(days as unknown as number)).toBe(false);
  });
});

/**
 * `intervalsOverlap` — half-open `[start, end)`, the `tstzrange` convention.
 *
 * The half-open boundary is not a detail: it is what makes *back-to-back*
 * contracts possible. With closed intervals a mandate expiring at the exact
 * instant the next one begins would collide for one millisecond, and the owner
 * would be forced to leave a gap without ever learning why.
 *
 * @see lib/mandate/mandate-conflict.ts — the caller that depends on this
 */
describe('intervalsOverlap', () => {
  const A = '2027-01-01T00:00:00.000Z';
  const B = '2027-06-01T00:00:00.000Z';
  const C = '2027-12-01T00:00:00.000Z';

  it('back-to-back intervals do NOT overlap — the half-open boundary', () => {
    expect(intervalsOverlap(A, B, B, C)).toBe(false);
    expect(intervalsOverlap(B, C, A, B)).toBe(false);
  });

  it('a single shared instant IS an overlap', () => {
    expect(intervalsOverlap(A, B, '2027-05-31T23:59:59.999Z', C)).toBe(true);
  });

  it('containment counts, in both directions', () => {
    expect(intervalsOverlap(A, C, B, '2027-07-01T00:00:00.000Z')).toBe(true);
    expect(intervalsOverlap(B, '2027-07-01T00:00:00.000Z', A, C)).toBe(true);
  });

  it('disjoint intervals do not overlap', () => {
    expect(intervalsOverlap(A, B, C, '2028-01-01T00:00:00.000Z')).toBe(false);
  });

  it('a null/undefined end means "open ended", not "unreadable"', () => {
    expect(intervalsOverlap(A, null, C, null)).toBe(true);
    expect(intervalsOverlap(A, undefined, C, undefined)).toBe(true);
    // Open-ended still respects the start: nothing before A can reach it.
    expect(intervalsOverlap(C, null, A, B)).toBe(false);
  });

  it('an unreadable instant yields null — never false (unknown is not "clear")', () => {
    // Returning false here would report "no overlap" for data we could not read,
    // which in the mandate judge would let a second exclusive through.
    expect(intervalsOverlap('not-a-date', B, A, C)).toBeNull();
    expect(intervalsOverlap(A, 'not-a-date', A, C)).toBeNull();
    expect(intervalsOverlap(A, B, null, C)).toBeNull();
  });

  it('a backwards interval yields null — it does not describe a range', () => {
    expect(intervalsOverlap(C, A, A, B)).toBeNull();
    expect(intervalsOverlap(A, B, C, A)).toBeNull();
  });

  it('reads the serialised Firestore shapes, like every other helper here', () => {
    expect(
      intervalsOverlap({ seconds: Date.parse(A) / 1000, nanoseconds: 0 }, B, A, C),
    ).toBe(true);
  });

  /**
   * 🔴 ADR-835 Ε-10 — ΤΟ ΚΕΝΟ ΔΙΑΣΤΗΜΑ ΔΕΝ ΤΕΜΝΕΙ ΤΙΠΟΤΑ, **ΠΑΝΤΟΥ**.
   *
   * Ως 2026-08-31 εδώ ζούσε ο τύπος του Joda-Time, που είναι ακριβής για **γνήσια**
   * διαστήματα και **απροσδιόριστος** για το κενό. Το Joda το τεκμηριώνει κιόλας:
   * `[09:00,10:00) overlaps [09:00,09:00)` = `false` αλλά
   * `[09:00,10:00) overlaps [09:30,09:30)` = **`true`**.
   *
   * 🔑 **Οι τρεις θέσεις μαζί είναι ο κανόνας** — μία μόνη θα περνούσε και με τον παλιό
   * κώδικα. Η μεσαία είναι εκείνη που κοκκίνιζε.
   */
  describe('🔴 το ΚΕΝΟ διάστημα (`από === ως`)', () => {
    const EMPTY = '2027-03-01T00:00:00.000Z';

    it('δεν τέμνει διάστημα που το ΠΕΡΙΕΧΕΙ — η θέση που ήταν ΑΣΥΝΕΠΗΣ', () => {
      expect(intervalsOverlap(EMPTY, EMPTY, A, C)).toBe(false);
      expect(intervalsOverlap(A, C, EMPTY, EMPTY)).toBe(false);
    });

    it('δεν τέμνει ούτε στην ΑΡΧΗ ούτε στο ΤΕΛΟΣ ενός διαστήματος', () => {
      expect(intervalsOverlap(A, A, A, C)).toBe(false);
      expect(intervalsOverlap(C, C, A, C)).toBe(false);
    });

    it('δεν τέμνει ούτε τον ΕΑΥΤΟ του — `∅ ∩ ∅ = ∅`', () => {
      expect(intervalsOverlap(EMPTY, EMPTY, EMPTY, EMPTY)).toBe(false);
    });

    it('🔴 απαντά `false`, ΠΟΤΕ `null` — το κενό διαβάζεται μια χαρά, δεν είναι άγνωστο', () => {
      // Ένα `null` εδώ θα έκανε το **γνωστό** άγνωστο — ο N.12 ανάποδα.
      expect(intervalsOverlap(EMPTY, EMPTY, A, C)).not.toBeNull();
    });

    it('🔑 ο ΠΑΡΟΝΟΜΑΣΤΗΣ: μία στιγμή διάρκειας ΤΕΜΝΕΙ κανονικά', () => {
      // Χωρίς αυτό, υλοποίηση που απαντά «ποτέ» θα περνούσε όλα τα παραπάνω.
      expect(intervalsOverlap(EMPTY, '2027-03-01T00:00:00.001Z', A, C)).toBe(true);
    });
  });
});

/**
 * `intervalShape` — το **όνομα** του ζεύγους, ώστε ο τομέας να μη ρωτά με `boolean`.
 *
 * Τέσσερα σχήματα, **τέσσερις θεραπείες**: `proper` (τίποτα) · `empty` (πρόσθεσε
 * διάρκεια) · `reversed` (αντίστρεψε τα άκρα) · `unreadable` (διόρθωσε τη μορφή).
 */
describe('intervalShape', () => {
  const A = '2027-01-01T00:00:00.000Z';
  const B = '2027-06-01T00:00:00.000Z';

  it('γνήσιο διάστημα ⇒ `proper`', () => {
    expect(intervalShape(A, B)).toBe('proper');
  });

  it('ΑΝΟΙΧΤΟ τέλος είναι `proper`, όχι βλάβη — «δεν λήγει» είναι έγκυρη σύμβαση', () => {
    expect(intervalShape(A, null)).toBe('proper');
    expect(intervalShape(A, undefined)).toBe('proper');
  });

  it('ίδια άκρα ⇒ `empty`', () => {
    expect(intervalShape(A, A)).toBe('empty');
  });

  it('λήξη πριν την έναρξη ⇒ `reversed`', () => {
    expect(intervalShape(B, A)).toBe('reversed');
  });

  it('μη αναγνώσιμο άκρο ⇒ `unreadable`, από ΟΠΟΙΑ πλευρά κι αν είναι', () => {
    expect(intervalShape('όχι-ημερομηνία', B)).toBe('unreadable');
    expect(intervalShape(A, 'όχι-ημερομηνία')).toBe('unreadable');
    expect(intervalShape('', B)).toBe('unreadable');
  });

  it('🔑 ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ, εκτελεσμένο: κάθε απάντηση είναι δηλωμένο όνομα (CHECK 3.54)', () => {
    // Ο τύπος το εγγυάται ήδη· αυτό υπάρχει ώστε η εγγύηση να μπορεί να ΚΟΚΚΙΝΙΣΕΙ.
    const answers = [
      intervalShape(A, B),
      intervalShape(A, null),
      intervalShape(A, A),
      intervalShape(B, A),
      intervalShape('σκουπίδι', B),
    ];

    for (const answer of answers) {
      expect(INTERVAL_SHAPES).toContain(answer);
    }
    // …και τα ΤΕΣΣΕΡΑ ονόματα είναι ΠΡΟΣΙΤΑ — αλλιώς κάποιο θα ήταν αδρανής φρουρός.
    expect(new Set(answers)).toEqual(new Set(INTERVAL_SHAPES));
  });

  it('🔑 συμφωνεί με τον τελεστή: ΜΟΝΟ το `proper` μπορεί να τέμνει', () => {
    // Ο τελεστής χτίζεται πάνω στο ΙΔΙΟ ανάγνωσμα — αυτό το κρατά αληθές.
    expect(intervalsOverlap(A, A, A, B)).toBe(false); // empty
    expect(intervalsOverlap(B, A, A, B)).toBeNull(); // reversed
    expect(intervalsOverlap('χ', A, A, B)).toBeNull(); // unreadable
    expect(intervalsOverlap(A, B, A, B)).toBe(true); // proper
  });
});

// =============================================================================
// utcDateOf — Η ΑΝΤΙΣΤΡΟΦΗ, ΟΧΙ ΜΟΡΦΟΠΟΙΗΣΗ (ADR-835 Φ3)
// =============================================================================

describe('utcDateOf — στιγμή → ημερολογιακή ημέρα, σε UTC', () => {
  it('ΕΙΝΑΙ ΑΝΤΙΣΤΡΟΦΗ: ό,τι διαβάστηκε ως ημέρα, γυρνά ΙΔΙΟ', () => {
    for (const day of ['2026-08-12', '2026-01-01', '2026-12-31', '2024-02-29']) {
      expect(utcDateOf(Date.parse(day))).toBe(day);
    }
  });

  /**
   * 🔴 **ΑΥΤΗ Η ΑΓΚΥΡΑ ΓΡΑΦΤΗΚΕ ΕΠΕΙΔΗ Η ΠΡΟΗΓΟΥΜΕΝΗ ΑΠΕΤΥΧΕ ΣΕ ΔΟΚΙΜΗ ΜΕΤΑΛΛΑΞΗΣ**
   * (ADR-835 Φ3, 2026-08-31). Η μετάλλαξη `getUTCDate()` → `getDate()` **ΕΠΕΖΗΣΕ**:
   * η μηχανή δοκιμών τρέχει σε **UTC+3**, όπου το `Date.parse('2026-08-12')` (UTC
   * μεσάνυχτα) πέφτει στις **03:00 τοπικά** — **ίδια μέρα**. Δηλαδή η δοκιμή
   * επιβεβαίωνε τη σωστή απάντηση **χωρίς να μπορεί να δει τη λάθος**.
   *
   * 🔑 **Η θεραπεία είναι ΔΥΟ στιγμές, μία εκατέρωθεν των μεσανυχτών UTC**: η
   * `23:30Z` αλλάζει μέρα σε **κάθε θετική** μετατόπιση (ανατολικά), η `00:30Z` σε
   * **κάθε αρνητική** (δυτικά). Μαζί καλύπτουν **κάθε** ζώνη εκτός του ίδιου του UTC.
   *
   * ⚠️ **ΔΗΛΩΝΕΤΑΙ ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ**: σε μηχανή που τρέχει **ακριβώς σε UTC** η
   * μετάλλαξη είναι **ισοδύναμη** και καμία δοκιμή δεν μπορεί να τη σκοτώσει. Ο
   * ισχυρισμός παρακάτω το λέει **δυνατά** αντί να σιωπήσει — μια πράσινη γραμμή που
   * σημαίνει «δεν κοίταξα» είναι ακριβώς το σχήμα που το έργο κυνηγά (N.12).
   */
  it('🔴 ΔΙΑΒΑΖΕΙ UTC, ΟΧΙ ΤΟΠΙΚΗ ΩΡΑ — και η άγκυρα το ΒΛΕΠΕΙ', () => {
    // Και οι δύο είναι **12 Αυγούστου σε UTC**, ό,τι κι αν λέει το ρολόι του μηχανήματος.
    expect(utcDateOf(Date.parse('2026-08-12T23:30:00Z'))).toBe('2026-08-12');
    expect(utcDateOf(Date.parse('2026-08-12T00:30:00Z'))).toBe('2026-08-12');

    // 🔑 Ο αυτοέλεγχος της άγκυρας: δηλώνει αν αυτή η μηχανή μπορεί να διακρίνει.
    const offsetMinutes = new Date(Date.parse('2026-08-12')).getTimezoneOffset();
    if (offsetMinutes === 0) {
      // Ειλικρινής δήλωση αντί για ψευδές πράσινο. Δεν αποτυγχάνει: η μηχανή απλώς
      // δεν έχει τη διάκριση να παρατηρήσει, και αυτό είναι γεγονός του περιβάλλοντος.
      expect(offsetMinutes).toBe(0);
      return;
    }
    // Σε κάθε ΑΛΛΗ ζώνη, τουλάχιστον μία από τις δύο στιγμές πέφτει σε άλλη τοπική
    // μέρα — άρα μια τοπική υλοποίηση θα είχε ήδη κοκκινίσει παραπάνω.
    const east = new Date(Date.parse('2026-08-12T23:30:00Z'));
    const west = new Date(Date.parse('2026-08-12T00:30:00Z'));
    expect(
      east.getDate() !== east.getUTCDate() || west.getDate() !== west.getUTCDate(),
    ).toBe(true);
  });

  it('συμπληρώνει μηδενικά σε μήνα και μέρα', () => {
    expect(utcDateOf(Date.parse('2026-03-05'))).toBe('2026-03-05');
  });

  it('🔴 μη πεπερασμένη τιμή ⇒ `null`, ΠΟΤΕ «Invalid Date» που ταξιδεύει', () => {
    expect(utcDateOf(Number.NaN)).toBeNull();
    expect(utcDateOf(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
