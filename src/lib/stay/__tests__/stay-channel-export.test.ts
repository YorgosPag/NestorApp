/**
 * **ΤΙ ΔΗΜΟΣΙΕΥΟΥΜΕ ΣΤΑ ΚΑΝΑΛΙΑ** — ADR-835 §22.
 *
 * Οι τέσσερις ερωτήσεις: *ποιες νύχτες φεύγουν;* · *φεύγει η προετοιμασία;* · *φεύγει
 * πίσω στο κανάλι ό,τι ήρθε από εκείνο;* · *φεύγει ποτέ άνθρωπος;*
 */

import { STAY_BOOKING_LIFECYCLES, STAY_LIFECYCLE_OCCUPIES, type StayBookingLifecycle } from '@/types/stay-booking';
import type { StayCalendarEntry } from '@/types/stay-calendar';
import { STAY_RULES_NONE, type StayRules } from '@/types/stay-rules';
import {
  stayExportCalendar,
  stayExportEvents,
  STAY_ICAL_SUMMARY,
  STAY_ICAL_UID_DOMAIN,
} from '../stay-channel-export';
import { blockEntry, bookingEntry, FEED, requestEntry } from './stay-rules-fixtures';

const rules = (preparationNights: StayRules['preparationNights'] = 0): StayRules =>
  ({ ...STAY_RULES_NONE, preparationNights });

/** Η στιγμή της λήψης του feed στις άγκυρες — 1/9/2026, πριν από κάθε ζωντανή προθεσμία. */
const NOW = '2026-09-01T07:00:00.000Z';

const withLifecycle = (entry: StayCalendarEntry, lifecycle: StayBookingLifecycle): StayCalendarEntry =>
  entry.kind === 'booking' ? { kind: 'booking', booking: { ...entry.booking, lifecycle } } : entry;

describe('stayExportEvents — η γραμμή: φυσική κατάληψη ΝΑΙ, πολιτική κράτησης ΟΧΙ', () => {
  it('κράτηση + block ιδιοκτήτη + block άλλου καναλιού, με τα ημι-ανοιχτά διαστήματα αυτούσια', () => {
    const entries = [
      bookingEntry('stay_1', '2026-10-10', '2026-10-14'),
      blockEntry('sblk_own', '2026-11-01', '2026-11-03'),
      blockEntry('sblk_ext', '2026-12-20', '2026-12-22', 'external'),
    ];
    expect(stayExportEvents(entries, rules(), { kind: 'all' }, NOW)).toEqual([
      { uid: `stay_1@${STAY_ICAL_UID_DOMAIN}`, from: '2026-10-10', to: '2026-10-14', summary: STAY_ICAL_SUMMARY.booking, status: 'CONFIRMED', updatedAt: expect.any(String) },
      { uid: `sblk_own@${STAY_ICAL_UID_DOMAIN}`, from: '2026-11-01', to: '2026-11-03', summary: STAY_ICAL_SUMMARY.blocked, status: 'CONFIRMED', updatedAt: expect.any(String) },
      { uid: `sblk_ext@${STAY_ICAL_UID_DOMAIN}`, from: '2026-12-20', to: '2026-12-22', summary: STAY_ICAL_SUMMARY.blocked, status: 'CONFIRMED', updatedAt: expect.any(String) },
    ]);
  });

  it('🔴 οι νύχτες προετοιμασίας ΕΞΑΓΟΝΤΑΙ (όπως η Airbnb) — δύο γεγονότα γύρω από την κράτηση', () => {
    const events = stayExportEvents([bookingEntry('stay_1', '2026-10-10', '2026-10-14')], rules(1), { kind: 'all' }, NOW);
    expect(events.map((e) => [e.from, e.to, e.summary])).toEqual([
      ['2026-10-09', '2026-10-10', STAY_ICAL_SUMMARY.preparation],
      ['2026-10-10', '2026-10-14', STAY_ICAL_SUMMARY.booking],
      ['2026-10-14', '2026-10-15', STAY_ICAL_SUMMARY.preparation],
    ]);
  });

  it('η προετοιμασία ΔΕΝ μπαίνει γύρω από block του ιδιοκτήτη (δεν είναι επισκέπτης)', () => {
    const events = stayExportEvents([blockEntry('sblk_own', '2026-11-01', '2026-11-03')], rules(2), { kind: 'all' }, NOW);
    expect(events).toHaveLength(1);
  });

  it('🏆 ο σύνδεσμος ΕΝΟΣ καναλιού δεν περιέχει ό,τι ήρθε από ΕΚΕΙΝΟ (ούτε την προετοιμασία του)', () => {
    const entries = [
      bookingEntry('stay_1', '2026-10-10', '2026-10-14'),
      blockEntry('sblk_a', '2026-12-20', '2026-12-22', 'external', FEED),
      blockEntry('sblk_b', '2027-01-05', '2027-01-07', 'external', 'schf_other'),
    ];
    const uids = stayExportEvents(entries, rules(1), { kind: 'feed', feedId: FEED }, NOW).map((e) => e.uid);
    expect(uids.some((uid) => uid.includes('sblk_a'))).toBe(false);
    expect(uids.some((uid) => uid.includes('sblk_b'))).toBe(true);
    // Η κράτησή μας και η προετοιμασία της μένουν — αλλιώς το κανάλι θα έδινε τις ίδιες νύχτες.
    expect(uids.filter((uid) => uid.includes('stay_1'))).toHaveLength(3);
  });

  // 🔑 Εξάγεται ΑΚΡΙΒΩΣ ό,τι καταλαμβάνει **τη στιγμή της λήψης** — η απάντηση είναι του
  //    `STAY_LIFECYCLE_OCCUPIES`. Στο Στάδιο Δ ο κανόνας έγινε τριτιμος: το `requested` εξάγεται
  //    **μόνο** όσο ζει η προθεσμία του (§23.2). Η αναμενόμενη τιμή βγαίνει από τον **πίνακα**, όχι
  //    από τη συνάρτηση υπό έλεγχο — αλλιώς η άγκυρα θα ήταν ταυτολογία.
  const HOLD_LIVE = '2026-10-01T12:00:00.000Z';
  const HOLD_DEAD = '2026-09-01T06:00:00.000Z';
  it.each(STAY_BOOKING_LIFECYCLES.flatMap((lifecycle) => [
    { lifecycle, expiresAt: HOLD_LIVE, alive: true },
    { lifecycle, expiresAt: HOLD_DEAD, alive: false },
  ]))('$lifecycle με hold ζωντανό=$alive ⇒ εξάγεται μόνο αν καταλαμβάνει', ({ lifecycle, expiresAt, alive }) => {
    const request = requestEntry('stay_1', '2026-10-10', '2026-10-14', expiresAt);
    const entry = withLifecycle(request, lifecycle);
    const rule = STAY_LIFECYCLE_OCCUPIES[lifecycle];
    const expected = rule === 'always' || (rule === 'while-hold-lives' && alive) ? 1 : 0;
    expect(stayExportEvents([entry], rules(), { kind: 'all' }, NOW)).toHaveLength(expected);
  });

  it('ζωντανό αίτημα ⇒ `TENTATIVE` — και η προετοιμασία γύρω του επίσης', () => {
    const events = stayExportEvents([requestEntry('stay_1', '2026-10-10', '2026-10-14', HOLD_LIVE)], rules(1), { kind: 'all' }, NOW);
    expect(events).toHaveLength(3);
    expect(events.every((event) => event.status === 'TENTATIVE')).toBe(true);
  });

  it('🔴 ΚΑΝΕΝΑ ΠΡΟΣΩΠΟ: ούτε όνομα, ούτε σημείωση, ούτε άτομα σε κανένα byte', () => {
    const booking = bookingEntry('stay_1', '2026-10-10', '2026-10-14');
    const named: StayCalendarEntry = booking.kind === 'booking'
      ? { kind: 'booking', booking: { ...booking.booking, holder: { kind: 'offline', label: 'Παπαδόπουλος' }, guests: 3 } }
      : booking;
    const block = blockEntry('sblk_own', '2026-11-01', '2026-11-03');
    const noted: StayCalendarEntry = block.kind === 'block'
      ? { kind: 'block', block: { ...block.block, note: 'ανακαίνιση μπάνιου' } }
      : block;
    const output = stayExportCalendar([named, noted], rules(1), { kind: 'all' }, 'Κατάλυμα', NOW);
    expect(output).not.toContain('Παπαδόπουλος');
    expect(output).not.toContain('ανακαίνιση');
    expect(output).not.toMatch(/GUESTS|ATTENDEE|DESCRIPTION/);
  });

  it('η πολιτική κράτησης (ειδοποίηση · παράθυρο · CTA/CTD · ελάχ. νύχτες) ΔΕΝ ταξιδεύει', () => {
    const strict: StayRules = {
      ...STAY_RULES_NONE,
      advanceNotice: { days: 7, sameDayCutoffHour: null },
      availabilityWindowMonths: 3,
      maxNights: 5,
      arrivalWeekdays: [5],
      departureWeekdays: [1],
      orphanGap: { maxNights: 3 },
    };
    const events = stayExportEvents([bookingEntry('stay_1', '2026-10-10', '2026-10-12')], strict, { kind: 'all' }, NOW);
    expect(events).toHaveLength(1);
  });
});
