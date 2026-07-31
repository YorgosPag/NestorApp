/**
 * =============================================================================
 * isJobDue — η μόνη λογική που μπορεί να είναι λάθος αθόρυβα
 * =============================================================================
 *
 * Ένα off-by-one στο παράθυρο του λεπτού σημαίνει ότι μια εργασία **δεν τρέχει ποτέ**
 * στην ώρα της. Ένα λάθος στη ζώνη ώρας τη μετακινεί τρεις ώρες. Κανένα από τα δύο δεν
 * ρίχνει εξαίρεση — ακριβώς η κατηγορία σφάλματος που γέννησε το ADR-739.
 *
 * Όλες οι στιγμές είναι **σταθερές**: καμία εξάρτηση από την ώρα εκτέλεσης του test.
 *
 * @see ADR-739
 */

import { CATCHUP_GRACE_HOURS, isJobDue } from '@/lib/cron/cron-due';

const ATHENS = 'Europe/Athens';

/** 04:00 ώρα Ελλάδας σε θερινή περίοδο (UTC+3) → 01:00Z. */
const SUMMER_0400_ATHENS = new Date('2026-07-15T01:00:00.000Z');
/** 04:00 ώρα Ελλάδας σε χειμερινή περίοδο (UTC+2) → 02:00Z. */
const WINTER_0400_ATHENS = new Date('2026-01-15T02:00:00.000Z');

describe('isJobDue — κανονική εκτέλεση', () => {
  it('οφείλεται όταν η στιγμή πέφτει μέσα στο τρέχον λεπτό', () => {
    expect(isJobDue('0 4 * * *', ATHENS, SUMMER_0400_ATHENS, null)).toEqual({
      due: true,
      reason: 'scheduled',
    });
  });

  it('οφείλεται και όταν το tick έχει δευτερόλεπτα (ανάλυση λεπτού)', () => {
    // Το ρολόι δεν χτυπά ποτέ ακριβώς στο :00.000 — αν ο έλεγχος απαιτούσε ακρίβεια
    // δευτερολέπτου, καμία εργασία δεν θα έτρεχε ποτέ.
    const tick = new Date('2026-07-15T01:00:37.412Z');
    expect(isJobDue('0 4 * * *', ATHENS, tick, null).due).toBe(true);
  });

  it('ΔΕΝ οφείλεται ένα λεπτό νωρίτερα', () => {
    const tick = new Date('2026-07-15T00:59:00.000Z');
    expect(isJobDue('0 4 * * *', ATHENS, tick, null).reason).not.toBe('scheduled');
  });

  it('το παράθυρο του λεπτού είναι ημιάνοιχτο — δεν αρπάζει τη στιγμή του επόμενου', () => {
    // Στιγμή ακριβώς στο άνω άκρο: πρόγραμμα 12:31, tick 12:30. Η επόμενη εκτέλεση
    // απέχει ακριβώς 60.000ms. Με **συμπεριληπτικό** άνω άκρο θα κρινόταν «κανονική»
    // ένα ολόκληρο λεπτό νωρίτερα — και κάθε εργασία θα έτρεχε πάντα πρόωρα.
    const at1231 = '31 12 * * *';
    const tick1230 = new Date('2026-07-15T09:30:00.000Z'); // 12:30 Αθήνα (θερινή)

    // Πρόσφατη επιτυχία ώστε να μη θολώνει το catch-up.
    const justRan = '2026-07-15T09:29:00.000Z';
    expect(isJobDue(at1231, ATHENS, tick1230, justRan).reason).not.toBe('scheduled');

    // Ένα λεπτό αργότερα, οφείλεται κανονικά.
    const tick1231 = new Date('2026-07-15T09:31:00.000Z');
    expect(isJobDue(at1231, ATHENS, tick1231, justRan).reason).toBe('scheduled');
  });

  it('ΔΕΝ ξανατρέχει ένα λεπτό αργότερα, αν πέτυχε ήδη', () => {
    const tick = new Date('2026-07-15T01:01:00.000Z');
    const lastSuccess = '2026-07-15T01:00:30.000Z';
    expect(isJobDue('0 4 * * *', ATHENS, tick, lastSuccess)).toEqual({
      due: false,
      reason: null,
    });
  });
});

describe('isJobDue — ζώνη ώρας', () => {
  it('το ίδιο cron πέφτει σε διαφορετική UTC ώρα χειμώνα και καλοκαίρι', () => {
    // Αυτό είναι ολόκληρο το νόημα του `Europe/Athens`: το `0 4 * * *` παραμένει
    // 04:00 τοπική ώρα και τους δώδεκα μήνες, ενώ η UTC στιγμή μετακινείται.
    expect(isJobDue('0 4 * * *', ATHENS, SUMMER_0400_ATHENS, null).due).toBe(true);
    expect(isJobDue('0 4 * * *', ATHENS, WINTER_0400_ATHENS, null).due).toBe(true);
  });

  it('σε UTC το ίδιο cron ΔΕΝ οφείλεται στις ίδιες στιγμές', () => {
    // Δικλείδα κατά ψευδώς θετικού: αν το `timezone` αγνοούνταν, τα δύο παραπάνω
    // θα περνούσαν ούτως ή άλλως και το test δεν θα απεδείκνυε τίποτα.
    expect(isJobDue('0 4 * * *', 'UTC', SUMMER_0400_ATHENS, null).reason).not.toBe('scheduled');
    expect(isJobDue('0 4 * * *', 'UTC', WINTER_0400_ATHENS, null).reason).not.toBe('scheduled');
  });
});

describe('isJobDue — catch-up (χαμένη εκτέλεση)', () => {
  it('οφείλεται αν η ώρα πέρασε και δεν υπάρχει καμία επιτυχία', () => {
    // Ο container ήταν κάτω στις 04:00· σηκώθηκε στις 06:00.
    const tick = new Date('2026-07-15T03:00:00.000Z');
    expect(isJobDue('0 4 * * *', ATHENS, tick, null)).toEqual({
      due: true,
      reason: 'catch-up',
    });
  });

  it('οφείλεται αν η τελευταία επιτυχία είναι ΠΡΙΝ την χαμένη στιγμή', () => {
    const tick = new Date('2026-07-15T03:00:00.000Z');
    const yesterday = '2026-07-14T01:00:05.000Z';
    expect(isJobDue('0 4 * * *', ATHENS, tick, yesterday).reason).toBe('catch-up');
  });

  it('ΔΕΝ οφείλεται αν η επιτυχία είναι ΜΕΤΑ την στιγμή', () => {
    const tick = new Date('2026-07-15T03:00:00.000Z');
    const today = '2026-07-15T01:00:05.000Z';
    expect(isJobDue('0 4 * * *', ATHENS, tick, today).due).toBe(false);
  });

  it('μετά από πολυήμερη διακοπή τρέχει ΜΙΑ φορά, όχι μία ανά χαμένη ημέρα', () => {
    // Container εκτός λειτουργίας τρεις εβδομάδες. Το ζητούμενο δεν είναι «τρέξε 21
    // φορές» — είναι «τρέξε». Ο έλεγχος επιστρέφει μία ετυμηγορία, και μόλις πετύχει,
    // το `lastSuccessAt` κλείνει το παράθυρο.
    const tick = new Date('2026-07-22T12:00:00.000Z');
    const veryOld = '2026-07-01T00:00:00.000Z';

    expect(isJobDue('0 4 * * *', ATHENS, tick, veryOld).reason).toBe('catch-up');

    // Μετά την επιτυχία της σημερινής εκτέλεσης, σιωπή μέχρι αύριο.
    const justRan = '2026-07-22T09:05:00.000Z';
    expect(isJobDue('0 4 * * *', ATHENS, tick, justRan).due).toBe(false);
  });

  it('το παράθυρο χάριτος καλύπτει έναν πλήρη ημερήσιο κύκλο', () => {
    // Αν το παράθυρο ήταν <24h, μια χαμένη ημερήσια εκτέλεση δεν θα καλυπτόταν ποτέ.
    expect(CATCHUP_GRACE_HOURS).toBeGreaterThan(24);
  });

  it('αραιό πρόγραμμα: εντός χάριτος οφείλεται, εκτός σιωπά', () => {
    // Εβδομαδιαίο (Δευτέρα 04:00) — απομονώνει το παράθυρο χάριτος, γιατί σε ημερήσιο
    // πρόγραμμα υπάρχει πάντα μια πρόσφατη στιγμή που θα το έκρυβε.
    const weekly = '0 4 * * 1';
    const mondayRun = Date.parse('2026-07-13T01:00:00.000Z'); // Δευτέρα 04:00 Αθήνα

    const withinGrace = new Date(mondayRun + 3 * 3_600_000);
    expect(isJobDue(weekly, ATHENS, withinGrace, null).reason).toBe('catch-up');

    const beyondGrace = new Date(mondayRun + (CATCHUP_GRACE_HOURS + 2) * 3_600_000);
    expect(isJobDue(weekly, ATHENS, beyondGrace, null).due).toBe(false);
  });
});
