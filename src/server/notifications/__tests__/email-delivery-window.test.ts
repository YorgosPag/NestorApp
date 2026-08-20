/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΟΥ ΠΑΡΑΘΥΡΟΥ ΠΑΡΑΔΟΣΗΣ — ADR-777 §8.23
 * =============================================================================
 *
 * **Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ.** Αποδεικνύει ότι το ελάττωμα ήταν πραγματικό: ο παλιός
 * έλεγχος ήταν **μία** σύγκριση, και **τρεις από τις τέσσερις** τιμές συχνότητας
 * ήταν ταυτόσημες γι' αυτόν. Η Μ0 **εκτελεί** τον παλιό κανόνα, δεν τον περιγράφει.
 *
 * ⚠️ Κάθε άγκυρα δίνει το `now` **ρητά**. Ένα test που διαβάζει ρολόι απαντά
 * διαφορετικά ανάλογα με το πότε τρέχει — και περνά 23 στις 24 ώρες, που είναι
 * χειρότερο από το να μην υπάρχει.
 */

import {
  DAILY_WINDOW_HOUR,
  WEEKLY_WINDOW_HOUR,
  decideEmailDelivery,
  resolveTimeZone,
  type EmailDeliveryDecision,
} from '@/server/notifications/email-delivery-window';
import {
  getDefaultNotificationSettings,
  type EmailFrequency,
  type UserNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';

function settingsWith(
  overrides: Partial<UserNotificationSettings> = {},
): UserNotificationSettings {
  return { ...getDefaultNotificationSettings('usr_test'), ...overrides };
}

/** Μια στιγμή δοσμένη σε **τοπική ώρα Ελλάδας**, μετατρεμμένη σε UTC instant. */
function athens(iso: string): Date {
  // Τον Αύγουστο η Ελλάδα είναι UTC+3, τον Ιανουάριο UTC+2. Οι άγκυρες δηλώνουν
  // ρητά ποια εποχή δοκιμάζουν, ώστε η θερινή ώρα να **ελέγχεται**, όχι να τύχει.
  return new Date(iso);
}

/** Η τοπική ώρα μιας στιγμής, για ανάγνωση από άνθρωπο. */
function athensHour(instant: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Athens',
      hour: '2-digit',
      hour12: false,
    }).format(instant),
  ) % 24;
}

function deferredAt(decision: EmailDeliveryDecision): Date {
  if (decision.kind !== 'defer') {
    throw new Error(`αναμενόταν αναβολή, ήρθε "${decision.kind}"`);
  }
  return decision.deliverAt;
}

const MANDATORY = { isMandatory: true } as const;
const ORDINARY = { isMandatory: false } as const;

// =============================================================================
// Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ: Ο ΠΑΛΙΟΣ ΕΛΕΓΧΟΣ ΔΕΝ ΞΕΧΩΡΙΖΕ ΤΙΠΟΤΑ
// =============================================================================

describe('🔴 Μ0 — ο παλιός κανόνας έβλεπε ΜΙΑ από τις τέσσερις τιμές', () => {
  /** Ο κανόνας όπως ήταν γραμμένος στον orchestrator, εκτελέσιμος. */
  const legacyEmailEnabled = (s: UserNotificationSettings): boolean =>
    s.globalEnabled && s.emailEnabled && s.emailFrequency !== 'disabled';

  const ALL: readonly EmailFrequency[] = ['realtime', 'daily', 'weekly', 'disabled'];

  it('ο παλιός κανόνας απαντά ΤΑΥΤΟΣΗΜΑ για realtime/daily/weekly', () => {
    const answers = ALL.filter((f) => f !== 'disabled').map((emailFrequency) =>
      legacyEmailEnabled(settingsWith({ emailFrequency })),
    );
    expect(answers).toEqual([true, true, true]);
  });

  it('🔑 και η ΠΡΟΕΠΙΛΟΓΗ είναι `daily` — άρα ΟΛΟΙ έπαιρναν άμεσο email', () => {
    expect(getDefaultNotificationSettings('usr_x').emailFrequency).toBe('daily');
    expect(legacyEmailEnabled(settingsWith())).toBe(true);
  });

  it('🔑 ο νέος κανόνας τις ξεχωρίζει — τρεις ΔΙΑΦΟΡΕΤΙΚΕΣ απαντήσεις', () => {
    const now = athens('2026-08-19T09:00:00+03:00');
    const kinds = ALL.map(
      (emailFrequency) =>
        decideEmailDelivery(settingsWith({ emailFrequency }), { now, ...ORDINARY }).kind,
    );
    expect(kinds).toEqual(['send-now', 'defer', 'defer', 'suppressed']);
  });

  it('⚠️ και ο παλιός κανόνας αγνοούσε ΕΝΤΕΛΩΣ τις ώρες ησυχίας', () => {
    const quiet = settingsWith({
      emailFrequency: 'realtime',
      quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
    });
    // 03:00 τοπικά — μέσα στην ησυχία.
    const now = athens('2026-08-19T03:00:00+03:00');

    expect(legacyEmailEnabled(quiet)).toBe(true); // ο παλιός: «στείλε»
    expect(decideEmailDelivery(quiet, { now, ...ORDINARY }).kind).toBe('defer');
  });
});

// =============================================================================
// Σ — ΣΙΩΠΗ: ΚΑΘΕ ΛΟΓΟΣ ΕΧΕΙ ΑΠΟΔΕΙΞΗ ΖΩΗΣ
// =============================================================================

describe('Σ — σιωπή, κάθε λόγος από πραγματική είσοδο', () => {
  const now = athens('2026-08-19T09:00:00+03:00');

  it('Σ1 — καθολικός διακόπτης', () => {
    const d = decideEmailDelivery(settingsWith({ globalEnabled: false }), { now, ...ORDINARY });
    expect(d).toEqual({ kind: 'suppressed', reason: 'global-disabled' });
  });

  it('Σ2 — διακόπτης καναλιού', () => {
    const d = decideEmailDelivery(settingsWith({ emailEnabled: false }), { now, ...ORDINARY });
    expect(d).toEqual({ kind: 'suppressed', reason: 'email-disabled' });
  });

  it('Σ3 — συχνότητα `disabled`', () => {
    const d = decideEmailDelivery(
      settingsWith({ emailFrequency: 'disabled' }),
      { now, ...ORDINARY },
    );
    expect(d).toEqual({ kind: 'suppressed', reason: 'frequency-disabled' });
  });

  it('Σ4 🔴 — το ΥΠΟΧΡΕΩΤΙΚΟ παρακάμπτει ΚΑΘΕ σιωπή και ΚΑΘΕ αναβολή', () => {
    // Courier: «security alerts skip quiet hours entirely». Και τα τρία μαζί:
    // κλειστός καθολικός διακόπτης, κλειστό email, ησυχία, μέσα στη νύχτα.
    const locked = settingsWith({
      globalEnabled: false,
      emailEnabled: false,
      emailFrequency: 'disabled',
      quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
    });
    const night = athens('2026-08-19T03:00:00+03:00');

    expect(decideEmailDelivery(locked, { now: night, ...MANDATORY })).toEqual({
      kind: 'send-now',
    });
  });
});

// =============================================================================
// Π — ΠΑΡΑΘΥΡΑ ΣΥΧΝΟΤΗΤΑΣ
// =============================================================================

describe('Π — τα παράθυρα πέφτουν στη σωστή ΤΟΠΙΚΗ ώρα', () => {
  const noQuiet = { enabled: false, startTime: '22:00', endTime: '08:00' };

  it('Π1 — `realtime` μέρα ⇒ τώρα', () => {
    const now = athens('2026-08-19T11:00:00+03:00');
    const d = decideEmailDelivery(
      settingsWith({ emailFrequency: 'realtime', quietHours: noQuiet }),
      { now, ...ORDINARY },
    );
    expect(d).toEqual({ kind: 'send-now' });
  });

  it('Π2 — `daily` πρωί ⇒ σήμερα στις 20:00 τοπικά', () => {
    const now = athens('2026-08-19T11:00:00+03:00');
    const at = deferredAt(
      decideEmailDelivery(
        settingsWith({ emailFrequency: 'daily', quietHours: noQuiet }),
        { now, ...ORDINARY },
      ),
    );
    expect(athensHour(at)).toBe(DAILY_WINDOW_HOUR);
    expect(at.getTime()).toBeGreaterThan(now.getTime());
  });

  it('Π3 🔴 — `daily` ΜΕΤΑ το παράθυρο ⇒ ΑΥΡΙΟ, όχι σε παρελθόντα χρόνο', () => {
    // Η κλασική αστοχία: 21:00 και το «σημερινό» παράθυρο έχει περάσει. Ένα
    // `scheduledAt` στο παρελθόν σημαίνει «στείλε αμέσως» — δηλαδή η ρύθμιση
    // «ημερησίως» θα κατέληγε άμεσο email, σιωπηλά.
    const now = athens('2026-08-19T21:00:00+03:00');
    const at = deferredAt(
      decideEmailDelivery(
        settingsWith({ emailFrequency: 'daily', quietHours: noQuiet }),
        { now, ...ORDINARY },
      ),
    );
    expect(at.getTime()).toBeGreaterThan(now.getTime());
    expect(athensHour(at)).toBe(DAILY_WINDOW_HOUR);
  });

  it('Π4 — `weekly` ⇒ Δευτέρα πρωί, πάντα στο μέλλον', () => {
    // 2026-08-19 είναι Τετάρτη.
    const now = athens('2026-08-19T11:00:00+03:00');
    const at = deferredAt(
      decideEmailDelivery(
        settingsWith({ emailFrequency: 'weekly', quietHours: noQuiet }),
        { now, ...ORDINARY },
      ),
    );
    expect(athensHour(at)).toBe(WEEKLY_WINDOW_HOUR);
    expect(at.getTime()).toBeGreaterThan(now.getTime());
    expect(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Athens',
        weekday: 'short',
      }).format(at),
    ).toBe('Mon');
  });

  it('Π5 — `weekly` Δευτέρα ΜΕΤΑ το παράθυρο ⇒ επόμενη Δευτέρα', () => {
    // 2026-08-17 είναι Δευτέρα· 11:00 > 09:00.
    const now = athens('2026-08-17T11:00:00+03:00');
    const at = deferredAt(
      decideEmailDelivery(
        settingsWith({ emailFrequency: 'weekly', quietHours: noQuiet }),
        { now, ...ORDINARY },
      ),
    );
    const daysAhead = (at.getTime() - now.getTime()) / 86_400_000;
    expect(daysAhead).toBeGreaterThan(6);
    expect(daysAhead).toBeLessThan(8);
  });
});

// =============================================================================
// Η — ΩΡΕΣ ΗΣΥΧΙΑΣ
// =============================================================================

describe('Η — η ησυχία καθυστερεί, ΠΟΤΕ δεν πετά και ΠΟΤΕ δεν φέρνει νωρίτερα', () => {
  const quiet = { enabled: true, startTime: '22:00', endTime: '08:00' };

  it('Η1 🔴 — το παράθυρο ΠΕΡΝΑ ΤΑ ΜΕΣΑΝΥΧΤΑ και αναγνωρίζεται', () => {
    // ⚠️ Ο αφελής έλεγχος `start <= now && now < end` είναι ΠΑΝΤΑ ψευδής όταν
    // start=22:00 > end=08:00 — δηλαδή θα απαντούσε «ποτέ ησυχία» ακριβώς στη
    // ρύθμιση που είναι η ΠΡΟΕΠΙΛΟΓΗ όλων.
    const at = deferredAt(
      decideEmailDelivery(
        settingsWith({ emailFrequency: 'realtime', quietHours: quiet }),
        { now: athens('2026-08-19T03:00:00+03:00'), ...ORDINARY },
      ),
    );
    expect(athensHour(at)).toBe(8);
  });

  it('Η2 — και στις 23:00 (πριν τα μεσάνυχτα) ⇒ αύριο 08:00', () => {
    const now = athens('2026-08-19T23:00:00+03:00');
    const d = decideEmailDelivery(
      settingsWith({ emailFrequency: 'realtime', quietHours: quiet }),
      { now, ...ORDINARY },
    );
    const at = deferredAt(d);
    expect(d.kind === 'defer' && d.reason).toBe('quiet-hours');
    expect(athensHour(at)).toBe(8);
    expect(at.getTime()).toBeGreaterThan(now.getTime());
  });

  it('Η3 — έξω από την ησυχία, το `realtime` μένει άμεσο', () => {
    const d = decideEmailDelivery(
      settingsWith({ emailFrequency: 'realtime', quietHours: quiet }),
      { now: athens('2026-08-19T12:00:00+03:00'), ...ORDINARY },
    );
    expect(d).toEqual({ kind: 'send-now' });
  });

  it('Η4 🔑 — το ημερήσιο παράθυρο (20:00) ΔΕΝ πειράζεται από ησυχία 22:00–08:00', () => {
    // Η ησυχία εφαρμόζεται στη **στιγμή παράδοσης**, όχι στη στιγμή γέννησης.
    const d = decideEmailDelivery(
      settingsWith({ emailFrequency: 'daily', quietHours: quiet }),
      { now: athens('2026-08-19T03:00:00+03:00'), ...ORDINARY },
    );
    expect(d.kind === 'defer' && d.reason).toBe('daily-window');
    expect(athensHour(deferredAt(d))).toBe(DAILY_WINDOW_HOUR);
  });

  it('Η5 🔴 — ΣΑΡΩΣΗ: η ησυχία ΜΟΝΟ καθυστερεί, σε κάθε ώρα και κάθε συχνότητα', () => {
    // ⚠️ **Αυτή η άγκυρα γεννήθηκε από μετάλλαξη που ΕΠΕΖΗΣΕ.** Η προηγούμενη
    // εκδοχή της έλεγχε ΜΙΑ είσοδο, και εκείνη η είσοδος δεν έμπαινε καν στον
    // κλάδο της ησυχίας — οπότε ο φρουρός που υποτίθεται ότι φύλαγε ήταν
    // ανέφικτος και **κανείς δεν το ήξερε**. Πλέον η ιδιότητα **σαρώνεται**:
    // για κάθε ώρα του 24ώρου, η στιγμή παράδοσης ΜΕ ησυχία δεν είναι ποτέ
    // νωρίτερα από τη στιγμή ΧΩΡΙΣ ησυχία.
    const frequencies: readonly EmailFrequency[] = ['realtime', 'daily', 'weekly'];
    const windows = [
      { startTime: '22:00', endTime: '08:00' }, // περνά τα μεσάνυχτα (προεπιλογή)
      { startTime: '10:00', endTime: '12:00' }, // μέσα στη μέρα
      { startTime: '19:00', endTime: '21:00' }, // αγκαλιάζει το ημερήσιο παράθυρο
    ];

    let compared = 0;

    for (const emailFrequency of frequencies) {
      for (const window of windows) {
        for (let hour = 0; hour < 24; hour += 1) {
          const now = athens(
            `2026-08-19T${String(hour).padStart(2, '0')}:30:00+03:00`,
          );

          const without = decideEmailDelivery(
            settingsWith({
              emailFrequency,
              quietHours: { enabled: false, ...window },
            }),
            { now, ...ORDINARY },
          );
          const withQuiet = decideEmailDelivery(
            settingsWith({
              emailFrequency,
              quietHours: { enabled: true, ...window },
            }),
            { now, ...ORDINARY },
          );

          const at = (d: EmailDeliveryDecision): number =>
            d.kind === 'defer' ? d.deliverAt.getTime() : now.getTime();

          expect(at(withQuiet)).toBeGreaterThanOrEqual(at(without));
          compared += 1;
        }
      }
    }

    // 🔴 Ο παρονομαστής: χωρίς αυτόν, ένας βρόχος που δεν έτρεξε ποτέ θα ήταν
    // πράσινος — ακριβώς το «0 = κανείς δεν κοίταξε» που κυνηγά όλο το ADR.
    expect(compared).toBe(frequencies.length * windows.length * 24);
  });

  it('Η5β 🔴 — και η σάρωση ΟΝΤΩΣ περνά από τον κλάδο της ησυχίας', () => {
    // Χωρίς αυτό, η Η5 θα μπορούσε να είναι πράσινη επειδή **καμία** είσοδος δεν
    // ενεργοποίησε ποτέ ησυχία — δηλαδή να συγκρίνει το τίποτα με το τίποτα.
    let quietTriggered = 0;
    for (let hour = 0; hour < 24; hour += 1) {
      const now = athens(`2026-08-19T${String(hour).padStart(2, '0')}:30:00+03:00`);
      const d = decideEmailDelivery(
        settingsWith({
          emailFrequency: 'realtime',
          quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
        }),
        { now, ...ORDINARY },
      );
      if (d.kind === 'defer' && d.reason === 'quiet-hours') quietTriggered += 1;
    }
    // 22:00→08:00 = 10 ώρες· τα δείγματα πέφτουν στο :30 κάθε ώρας.
    expect(quietTriggered).toBe(10);
  });

  it('Η6 — άκυρη μορφή ώρας ⇒ ΚΑΜΙΑ ησυχία, όχι μόνιμη σιωπή', () => {
    // Fail-open **επίτηδες**: μια κακογραμμένη ρύθμιση δεν επιτρέπεται να
    // αποκλείσει σιωπηλά κάθε email για πάντα.
    const d = decideEmailDelivery(
      settingsWith({
        emailFrequency: 'realtime',
        quietHours: { enabled: true, startTime: 'όχι ώρα', endTime: '08:00' },
      }),
      { now: athens('2026-08-19T03:00:00+03:00'), ...ORDINARY },
    );
    expect(d).toEqual({ kind: 'send-now' });
  });

  it('Η7 — ησυχία με λεπτά (08:30) δεν στρογγυλοποιείται σιωπηλά', () => {
    const at = deferredAt(
      decideEmailDelivery(
        settingsWith({
          emailFrequency: 'realtime',
          quietHours: { enabled: true, startTime: '22:00', endTime: '08:30' },
        }),
        { now: athens('2026-08-19T03:00:00+03:00'), ...ORDINARY },
      ),
    );
    const minute = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Athens',
      minute: '2-digit',
    }).format(at);
    expect(athensHour(at)).toBe(8);
    expect(Number(minute)).toBe(30);
  });
});

// =============================================================================
// Ω — ΖΩΝΗ ΩΡΑΣ: Η ΘΕΡΙΝΗ ΩΡΑ ΕΛΕΓΧΕΤΑΙ, ΔΕΝ ΤΥΧΑΙΝΕΙ
// =============================================================================

describe('Ω — τα παράθυρα κρατούν ΤΟΠΙΚΗ ώρα και τον χειμώνα', () => {
  const noQuiet = { enabled: false, startTime: '22:00', endTime: '08:00' };

  it('Ω1 🔴 — Ιανουάριος (UTC+2): το ημερήσιο παράθυρο μένει 20:00 ΤΟΠΙΚΑ', () => {
    // ⚠️ Ένας υπολογισμός με `getHours()` θα απαντούσε στη ζώνη του container
    // (UTC) — και θα ήταν λάθος **διαφορετικά** χειμώνα και καλοκαίρι.
    const now = athens('2026-01-15T11:00:00+02:00');
    const at = deferredAt(
      decideEmailDelivery(
        settingsWith({ emailFrequency: 'daily', quietHours: noQuiet }),
        { now, ...ORDINARY },
      ),
    );
    expect(athensHour(at)).toBe(DAILY_WINDOW_HOUR);
  });

  it('Ω2 — Αύγουστος (UTC+3): το ίδιο παράθυρο, άλλη απόκλιση UTC', () => {
    const at = deferredAt(
      decideEmailDelivery(
        settingsWith({ emailFrequency: 'daily', quietHours: noQuiet }),
        { now: athens('2026-08-19T11:00:00+03:00'), ...ORDINARY },
      ),
    );
    expect(athensHour(at)).toBe(DAILY_WINDOW_HOUR);
  });

  it('Ω3 🔴 — η ημέρα αλλαγής ώρας δεν σπάει το παράθυρο', () => {
    // Τελευταία Κυριακή Μαρτίου 2026 = 29/03, όταν η τοπική ώρα πηδά 03:00→04:00.
    const at = deferredAt(
      decideEmailDelivery(
        settingsWith({ emailFrequency: 'daily', quietHours: noQuiet }),
        { now: athens('2026-03-29T10:00:00+03:00'), ...ORDINARY },
      ),
    );
    expect(athensHour(at)).toBe(DAILY_WINDOW_HOUR);
  });

  it('Ω4 — και την ημέρα επιστροφής στη χειμερινή (Οκτώβριος)', () => {
    // Τελευταία Κυριακή Οκτωβρίου 2026 = 25/10, όταν η τοπική ώρα πάει 04:00→03:00.
    const at = deferredAt(
      decideEmailDelivery(
        settingsWith({ emailFrequency: 'daily', quietHours: noQuiet }),
        { now: athens('2026-10-25T10:00:00+02:00'), ...ORDINARY },
      ),
    );
    expect(athensHour(at)).toBe(DAILY_WINDOW_HOUR);
  });
});

// =============================================================================
// Ζ — ΖΩΝΗ ΩΡΑΣ ΑΝΑ ΧΡΗΣΤΗ (ADR-777 §8.28)
// =============================================================================

/** Η τοπική ώρα μιας στιγμής σε **οποιαδήποτε** ζώνη. */
function hourIn(instant: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hour12: false })
      .format(instant),
  ) % 24;
}

describe('Ζ — το «22:00» κάθε ανθρώπου είναι το ΔΙΚΟ ΤΟΥ 22:00', () => {
  const noQuiet = { enabled: false, startTime: '22:00', endTime: '08:00' };

  it('Ζ1 🔑 — ΤΟ ΚΕΝΤΡΙΚΟ: δύο ζώνες ⇒ ΔΙΑΦΟΡΕΤΙΚΗ στιγμή παράδοσης', () => {
    // ⚠️ Χωρίς αυτή την άγκυρα η παράμετρος ζώνης θα ήταν **αδρανής**: κάθε άλλο
    // test περνά με μία και μόνη ζώνη, άρα θα έμενε πράσινο ακόμη κι αν η τιμή του
    // χρήστη αγνοούνταν εντελώς.
    const now = new Date('2026-08-19T10:00:00Z');

    const athensAt = deferredAt(decideEmailDelivery(
      settingsWith({ emailFrequency: 'daily', quietHours: noQuiet, timezone: 'Europe/Athens' }),
      { now, ...ORDINARY },
    ));
    const berlinAt = deferredAt(decideEmailDelivery(
      settingsWith({ emailFrequency: 'daily', quietHours: noQuiet, timezone: 'Europe/Berlin' }),
      { now, ...ORDINARY },
    ));

    // Καθένας παίρνει το email στις 20:00 **της δικής του** ώρας…
    expect(hourIn(athensAt, 'Europe/Athens')).toBe(DAILY_WINDOW_HOUR);
    expect(hourIn(berlinAt, 'Europe/Berlin')).toBe(DAILY_WINDOW_HOUR);
    // …και οι δύο στιγμές **δεν** συμπίπτουν: το Βερολίνο είναι μία ώρα πίσω.
    expect(berlinAt.getTime() - athensAt.getTime()).toBe(60 * 60 * 1000);
  });

  it('Ζ2 🔑 — οι ώρες ησυχίας ερμηνεύονται στη ζώνη του χρήστη', () => {
    // 23:30 Αθήνας = 22:30 Βερολίνου. Και οι δύο έχουν ησυχία 22:00–08:00, άρα και
    // οι δύο αναβάλλονται — αλλά ο καθένας μέχρι το **δικό του** 08:00.
    const now = new Date('2026-08-19T20:30:00Z'); // 23:30 Αθήνα, 22:30 Βερολίνο
    const quiet = { enabled: true, startTime: '22:00', endTime: '08:00' };

    const athensAt = deferredAt(decideEmailDelivery(
      settingsWith({ emailFrequency: 'realtime', quietHours: quiet, timezone: 'Europe/Athens' }),
      { now, ...ORDINARY },
    ));
    const berlinAt = deferredAt(decideEmailDelivery(
      settingsWith({ emailFrequency: 'realtime', quietHours: quiet, timezone: 'Europe/Berlin' }),
      { now, ...ORDINARY },
    ));

    expect(hourIn(athensAt, 'Europe/Athens')).toBe(8);
    expect(hourIn(berlinAt, 'Europe/Berlin')).toBe(8);
    expect(berlinAt.getTime()).toBeGreaterThan(athensAt.getTime());
  });

  it('Ζ3 🔴 — ζώνη ΕΚΤΟΣ Ευρώπης δεν είναι ειδική περίπτωση', () => {
    // Το Τόκιο είναι UTC+9 **χωρίς θερινή ώρα** — δηλαδή σπάει και την υπόθεση
    // «όλοι αλλάζουν ώρα μαζί μας», που είναι η σιωπηλή παραδοχή του παλιού κώδικα.
    const at = deferredAt(decideEmailDelivery(
      settingsWith({ emailFrequency: 'daily', quietHours: noQuiet, timezone: 'Asia/Tokyo' }),
      { now: new Date('2026-08-19T10:00:00Z'), ...ORDINARY },
    ));
    expect(hourIn(at, 'Asia/Tokyo')).toBe(DAILY_WINDOW_HOUR);
  });

  it('Ζ4 🔴 — ΑΚΥΡΗ ζώνη ⇒ προεπιλογή, ΠΟΤΕ κατάρρευση', () => {
    // ⚠️ Το `Intl` πετά `RangeError` σε άγνωστο identifier, και το πεδίο έρχεται από
    // **έγγραφο Firestore**. Ένα κακογραμμένο "Europe/Athina" σε ΕΝΑΝ χρήστη θα
    // σταματούσε την παράδοση αλληλογραφίας για **όλους**.
    const at = deferredAt(decideEmailDelivery(
      settingsWith({ emailFrequency: 'daily', quietHours: noQuiet, timezone: 'Europe/Athina' }),
      { now: new Date('2026-08-19T10:00:00Z'), ...ORDINARY },
    ));
    expect(hourIn(at, 'Europe/Athens')).toBe(DAILY_WINDOW_HOUR);
  });

  it('Ζ5 — έγγραφο ΧΩΡΙΣ το πεδίο (προ §8.28) ⇒ προεπιλογή', () => {
    // Τα υπάρχοντα έγγραφα δεν έχουν `timezone`. Η συμπεριφορά τους πρέπει να μείνει
    // **ακριβώς** η προηγούμενη, αλλιώς η προσθήκη πεδίου θα ήταν σιωπηλή μετανάστευση.
    const withoutField = settingsWith({ emailFrequency: 'daily', quietHours: noQuiet });
    delete (withoutField as { timezone?: string }).timezone;

    const at = deferredAt(decideEmailDelivery(withoutField, {
      now: new Date('2026-08-19T10:00:00Z'), ...ORDINARY,
    }));
    expect(hourIn(at, 'Europe/Athens')).toBe(DAILY_WINDOW_HOUR);
  });

  it('Ζ6 — ο επιλυτής ζώνης είναι ρητός και δοκιμάσιμος', () => {
    expect(resolveTimeZone('Europe/Berlin')).toBe('Europe/Berlin');
    expect(resolveTimeZone('Δεν/Υπάρχει')).toBe('Europe/Athens');
    expect(resolveTimeZone(undefined)).toBe('Europe/Athens');
    expect(resolveTimeZone('')).toBe('Europe/Athens');
  });
});
