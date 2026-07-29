/**
 * =============================================================================
 * ΘΕΤΙΚΟΣ ΕΛΕΓΧΟΣ για το audit της ADR-218 §Phase 4
 * =============================================================================
 *
 * Το audit πάνω στο ζωντανό Firestore επέστρεψε **μηδέν** μη αναγνώσιμες
 * στιγμές. Ένα «0» από εργαλείο που δεν έχει δοκιμαστεί σε **γνωστά χαλασμένα**
 * δεδομένα δεν είναι μέτρηση — είναι εικασία. Σε αυτό το repo το «0» έχει ήδη
 * τρεις φορές σημάνει «κανείς δεν κοίταξε» (i18n N.11, ssot-discover N.12).
 *
 * Αυτά τα tests είναι η απόδειξη ότι το εργαλείο **θα έβλεπε** το πρόβλημα αν
 * υπήρχε: κάθε σχήμα που η παραγωγή δέχεται και κάθε σχήμα που απορρίπτει
 * περνά από εδώ, μαζί με τα τρία ζωντανά σενάρια Α/Β/Γ του handoff.
 *
 * @see scripts/audit-unreadable-timestamps.ts
 * @see docs/centralized-systems/reference/adrs/ADR-218-timestamp-conversion-centralization.md
 */

import {
  readInstantField,
  readInstantChain,
  changesBehaviour,
  describeRawType,
} from '../_shared/timestamp-readability';
import { isTemporalFieldName } from '../_shared/timestamp-sweep';

// ─── Test doubles που μιμούνται τα έξι σχήματα του Firestore ────────────────

const REFERENCE_MS = Date.UTC(2026, 6, 29, 10, 0, 0); // 2026-07-29T10:00:00Z

/** Ζωντανός Firestore Timestamp — εκθέτει ΚΑΙ `toDate()` ΚΑΙ `toMillis()`. */
const fullTimestamp = {
  toDate: () => new Date(REFERENCE_MS),
  toMillis: () => REFERENCE_MS,
};

/** Timestamp-like που δηλώνει μόνο `toMillis()` (DXF overlays, BIM openings). */
const millisOnlyTimestamp = { toMillis: () => REFERENCE_MS };

/** Client SDK μετά από `JSON.stringify`. */
const serialisedClient = { seconds: Math.floor(REFERENCE_MS / 1000), nanoseconds: 0 };

/** Admin SDK μετά από `JSON.stringify` — τα ιδιωτικά πεδία διαρρέουν. */
const serialisedAdmin = { _seconds: Math.floor(REFERENCE_MS / 1000), _nanoseconds: 0 };

describe('readInstantField — τα σχήματα που η παραγωγή ΔΙΑΒΑΖΕΙ', () => {
  const readableCases: ReadonlyArray<[string, unknown]> = [
    ['Firestore Timestamp (toDate + toMillis)', fullTimestamp],
    ['Timestamp-like με μόνο toMillis', millisOnlyTimestamp],
    ['JS Date', new Date(REFERENCE_MS)],
    ['serialised client SDK { seconds }', serialisedClient],
    ['serialised admin SDK { _seconds }', serialisedAdmin],
    ['ISO string', new Date(REFERENCE_MS).toISOString()],
    ['epoch number', REFERENCE_MS],
  ];

  it.each(readableCases)('διαβάζει %s', (_label, value) => {
    const reading = readInstantField({ createdAt: value }, 'createdAt');
    expect(reading.readable).toBe(true);
    expect(reading.shape).toBeNull();
    expect(reading.millis).toBe(REFERENCE_MS);
  });
});

describe('readInstantField — τα σχήματα που η παραγωγή ΑΠΟΡΡΙΠΤΕΙ', () => {
  it('πεδίο που λείπει → missing', () => {
    const reading = readInstantField({}, 'createdAt');
    expect(reading.readable).toBe(false);
    expect(reading.present).toBe(false);
    expect(reading.shape).toBe('missing');
  });

  const unreadableCases: ReadonlyArray<[string, unknown, string]> = [
    ['null', null, 'null'],
    ['κενή συμβολοσειρά', '', 'empty-string'],
    ['μηδέν', 0, 'zero'],
    ['σκουπίδι string', 'δεν είναι ημερομηνία', 'garbage-string'],
    ['NaN', Number.NaN, 'garbage-number'],
    ['άγνωστο object', { foo: 1 }, 'unknown-shape'],
  ];

  it.each(unreadableCases)('%s → %s', (_label, value, expectedShape) => {
    const reading = readInstantField({ createdAt: value }, 'createdAt');
    expect(reading.readable).toBe(false);
    expect(reading.millis).toBeNull();
    expect(reading.shape).toBe(expectedShape);
  });

  it('το `0` είναι έγκυρο epoch αλλά ο SSoT το κόβει στο `if (!val)` — τεκμηριωμένο, όχι bug', () => {
    // Αν αυτό ποτέ αλλάξει στο date-local, το audit αλλάζει μαζί του. Το test
    // κλειδώνει τη σημερινή αλήθεια ώστε η αλλαγή να μην περάσει σιωπηλά.
    expect(readInstantField({ t: 0 }, 't').readable).toBe(false);
    expect(readInstantField({ t: 1 }, 't').readable).toBe(true);
  });
});

describe('describeRawType — ανίχνευση type drift', () => {
  it('ξεχωρίζει Timestamp από string', () => {
    expect(describeRawType(fullTimestamp)).toBe('Object'); // plain object double
    expect(describeRawType('2026-07-29')).toBe('string');
    expect(describeRawType(new Date())).toBe('Date');
    expect(describeRawType(null)).toBe('null');
    expect(describeRawType(undefined)).toBe('undefined');
    expect(describeRawType([1])).toBe('array');
  });
});

describe('readInstantChain — μιμείται το `updatedAt ?? createdAt`', () => {
  it('προτιμά το πρώτο πεδίο όταν έχει τιμή', () => {
    const reading = readInstantChain(
      { updatedAt: new Date(REFERENCE_MS), createdAt: new Date(0) },
      ['updatedAt', 'createdAt']
    );
    expect(reading.usedField).toBe('updatedAt');
    expect(reading.millis).toBe(REFERENCE_MS);
  });

  it('πέφτει στο δεύτερο όταν το πρώτο είναι null ή λείπει', () => {
    expect(readInstantChain({ updatedAt: null, createdAt: fullTimestamp }, ['updatedAt', 'createdAt']).usedField)
      .toBe('createdAt');
    expect(readInstantChain({ createdAt: fullTimestamp }, ['updatedAt', 'createdAt']).usedField)
      .toBe('createdAt');
  });

  it('ΔΕΝ πέφτει στο δεύτερο για σκουπίδι — το `??` πιάνει μόνο null/undefined', () => {
    const reading = readInstantChain(
      { updatedAt: 'σκουπίδι', createdAt: fullTimestamp },
      ['updatedAt', 'createdAt']
    );
    expect(reading.usedField).toBe('updatedAt');
    expect(reading.readable).toBe(false);
    expect(reading.shape).toBe('garbage-string');
  });

  // ⚠️ ΑΥΤΟ ΤΟ TEST ΓΕΝΝΗΘΗΚΕ ΑΠΟ MUTATION TESTING.
  // Το προηγούμενο test («σκουπίδι δεν ενεργοποιεί fallback») χρησιμοποιεί
  // truthy σκουπίδι, οπότε `??` και `||` δίνουν **το ίδιο** αποτέλεσμα — η
  // μετάλλαξη `??` → `||` περνούσε με 28/28 πράσινα. Η διαφορά των δύο
  // τελεστών φαίνεται **μόνο** σε falsy-αλλά-όχι-null τιμές.
  //
  // Έχει σημασία για τη μέτρηση: η παραγωγή γράφει `task.updatedAt ?? task.createdAt`,
  // άρα ένα `updatedAt: ''` **σταματά εκεί** (`''` δεν είναι null/undefined) και
  // ο φύλακας `if (!blockedSince) continue` παραλείπει την εργασία. Ένα εργαλείο
  // με `||` θα κατέβαινε στο `createdAt`, θα το έβρισκε αναγνώσιμο, και θα
  // **υπο-μετρούσε** τα προβληματικά έγγραφα.
  const falsyNotNullish: ReadonlyArray<[string, unknown, string]> = [
    ['κενή συμβολοσειρά', '', 'empty-string'],
    ['μηδέν', 0, 'zero'],
    ['NaN', Number.NaN, 'garbage-number'],
  ];

  it.each(falsyNotNullish)(
    'σταματά σε %s στο πρώτο πεδίο — το `??` ΔΕΝ είναι `||`',
    (_label, value, expectedShape) => {
      const reading = readInstantChain(
        { updatedAt: value, createdAt: fullTimestamp },
        ['updatedAt', 'createdAt']
      );
      expect(reading.usedField).toBe('updatedAt');
      expect(reading.readable).toBe(false);
      expect(reading.shape).toBe(expectedShape);
    }
  );

  it('όταν λείπουν όλα, αναφέρει το τελευταίο πεδίο της αλυσίδας', () => {
    const reading = readInstantChain({}, ['updatedAt', 'createdAt']);
    expect(reading.usedField).toBe('createdAt');
    expect(reading.shape).toBe('missing');
  });
});

describe('changesBehaviour — «μη αναγνώσιμο» ΔΕΝ σημαίνει «αλλάζει το αποτέλεσμα»', () => {
  it('always: κάθε μη αναγνώσιμη μορφή αλλάζει συμπεριφορά', () => {
    expect(changesBehaviour('always', 'missing')).toBe(true);
    expect(changesBehaviour('always', 'garbage-string')).toBe(true);
  });

  it('only-truthy: falsy μορφές τις έκοβε ΚΑΙ πριν ο `if (!value)` φύλακας', () => {
    expect(changesBehaviour('only-truthy', 'missing')).toBe(false);
    expect(changesBehaviour('only-truthy', 'null')).toBe(false);
    expect(changesBehaviour('only-truthy', 'empty-string')).toBe(false);
    expect(changesBehaviour('only-truthy', 'zero')).toBe(false);
    expect(changesBehaviour('only-truthy', 'garbage-string')).toBe(true);
    expect(changesBehaviour('only-truthy', 'unknown-shape')).toBe(true);
  });
});

describe('isTemporalFieldName — η ευρετική ανακάλυψης του sweep', () => {
  it('δέχεται τα πραγματικά χρονικά πεδία του μοντέλου', () => {
    for (const field of [
      'createdAt', 'updatedAt', 'validFrom', 'validUntil', 'plannedEndDate',
      'issueDate', 'submittedAt', 'lastOrderDate', 'date', 'dueDate',
    ]) {
      expect(isTemporalFieldName(field)).toBe(true);
    }
  });

  it('απορρίπτει τα ψευδή θετικά που παρήγαγε η πρώτη, case-insensitive εκδοχή', () => {
    // Αυτά τα τρία βρέθηκαν ΖΩΝΤΑΝΑ στο Firestore από την πρώτη εκδοχή του
    // sweep: με `/i`, το `[A-Z]` ταιριάζει και πεζά, οπότε το «όριο λέξης»
    // εξαφανιζόταν — `elev(at)ion`, `preload(On)Idle`, `nameAutoGener(at)ed`.
    for (const field of ['elevation', 'preloadOnIdle', 'nameAutoGenerated', 'name', 'status']) {
      expect(isTemporalFieldName(field)).toBe(false);
    }
  });
});

// ─── Τα τρία ζωντανά σενάρια του handoff, end-to-end σε επίπεδο λογικής ──────

describe('σενάρια αλλαγής συμπεριφοράς (Α/Β/Γ του handoff)', () => {
  it('Α — συμφωνία-πλαίσιο με σκουπίδι στο validUntil ανιχνεύεται ΚΑΙ μετράει ως αλλαγή', () => {
    const agreement = { validFrom: fullTimestamp, validUntil: 'not-a-date', status: 'active' };
    const from = readInstantChain(agreement, ['validFrom']);
    const until = readInstantChain(agreement, ['validUntil']);

    expect(from.readable).toBe(true);
    expect(until.readable).toBe(false);
    expect(changesBehaviour('always', until.shape ?? 'unknown-shape')).toBe(true);
  });

  it('Β — μπλοκαρισμένη εργασία χωρίς καθόλου ημερομηνίες ΔΕΝ αλλάζει συμπεριφορά', () => {
    // `blockedSince = updatedAt ?? createdAt; if (!blockedSince) continue;`
    // Η εργασία παραλειπόταν και ΠΡΙΝ την Phase 4 — καμία νέα σιωπή.
    const task = { status: 'blocked' };
    const reading = readInstantChain(task, ['updatedAt', 'createdAt']);
    expect(reading.readable).toBe(false);
    expect(changesBehaviour('only-truthy', reading.shape ?? 'unknown-shape')).toBe(false);
  });

  it('Β — μπλοκαρισμένη εργασία με σκουπίδι στο updatedAt ΑΛΛΑΖΕΙ συμπεριφορά', () => {
    const task = { status: 'blocked', updatedAt: '15/03/2026', createdAt: fullTimestamp };
    const reading = readInstantChain(task, ['updatedAt', 'createdAt']);
    expect(reading.usedField).toBe('updatedAt');
    expect(reading.readable).toBe(false);
    expect(changesBehaviour('only-truthy', reading.shape ?? 'unknown-shape')).toBe(true);
  });

  it('Γ — κτήριο χωρίς createdAt πάει ΤΕΛΕΥΤΑΙΟ, όχι πρώτο', () => {
    const reading = readInstantChain({ name: 'Κτήριο Α' }, ['createdAt']);
    expect(reading.millis).toBeNull(); // ΟΧΙ 0 — το 0 θα το έστελνε πρώτο
    expect(reading.shape).toBe('missing');
  });
});
