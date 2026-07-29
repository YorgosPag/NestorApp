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
  combineDateAndTime,
  splitDateAndTime,
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
 * The form-field pair: the CRM task dialogs hold a date and an "HH:MM" string in
 * two separate controls, and must round-trip them through a single `dueDate`.
 *
 * @see ADR-584 — extracted from 4 copy-pasted call sites
 */
describe('combineDateAndTime', () => {
  it('puts the time onto the date', () => {
    const result = combineDateAndTime(new Date('2026-01-15T00:00:00'), '14:45');
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(45);
  });

  it('zeroes seconds and millis so equal form values compare equal', () => {
    const seeded = new Date('2026-01-15T00:00:00');
    seeded.setSeconds(37, 421);
    const result = combineDateAndTime(seeded, '09:00');
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('does not mutate the date it is given', () => {
    const original = new Date('2026-01-15T08:00:00');
    combineDateAndTime(original, '23:59');
    expect(original.getHours()).toBe(8);
  });

  // A half-typed time field must never produce an Invalid Date the caller then
  // writes to Firestore.
  it('falls back to midnight for an unparseable time instead of Invalid Date', () => {
    const result = combineDateAndTime(new Date('2026-01-15T08:30:00'), '');
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(Number.isNaN(result.getTime())).toBe(false);
  });

  it('treats a missing minutes half as zero', () => {
    const result = combineDateAndTime(new Date('2026-01-15T00:00:00'), '14');
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(0);
  });
});

describe('splitDateAndTime', () => {
  it('round-trips with combineDateAndTime', () => {
    const combined = combineDateAndTime(new Date('2026-01-15T00:00:00'), '14:45');
    expect(splitDateAndTime(combined).time).toBe('14:45');
  });

  it('pads single-digit hours and minutes to the "HH:MM" the input expects', () => {
    const split = splitDateAndTime(new Date('2026-01-15T09:05:00'));
    expect(split.time).toBe('09:05');
  });

  // The reason this helper goes through normalizeToDate rather than checking for
  // toDate() itself — the ad-hoc version it replaced dropped these.
  it('reads a JSON-serialised Timestamp that has no toDate()', () => {
    const at = new Date('2026-01-15T16:20:00');
    const split = splitDateAndTime({ seconds: at.getTime() / 1000, nanoseconds: 0 });
    expect(split.time).toBe('16:20');
  });

  it('uses the fallback time when the value is unreadable', () => {
    expect(splitDateAndTime(null).time).toBe('09:00');
    expect(splitDateAndTime({ foo: 'bar' }, '08:30').time).toBe('08:30');
  });
});
