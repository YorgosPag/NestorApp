/**
 * ADR-841 §7 Α21.21 Φάση Β — η απάντηση του email γίνεται ειδική μέρα με τον ΙΔΙΟ κριτή της φόρμας:
 * η φόρμα κερδίζει · ταβάνι 30 · κλάδεμα · κατάστημα που σβήστηκε · διπλή απάντηση.
 */

import { addDaysToDateKey } from '@/lib/calendar/date-key';
import type { HoursOfLocation } from '@/lib/calendar/holiday-question';
import type { SpecialDay } from '@/lib/calendar/special-hours';
import type { WeeklyHours } from '@/lib/calendar/weekly-hours';

import { applyHolidayAnswers } from '../showcase-holiday-answers';

const MON_SAT: WeeklyHours = {
  1: [{ opens: '09:00', closes: '17:00' }],
  2: [{ opens: '09:00', closes: '17:00' }],
  3: [{ opens: '09:00', closes: '17:00' }],
  4: [{ opens: '09:00', closes: '17:00' }],
  5: [{ opens: '09:00', closes: '17:00' }],
  6: [{ opens: '09:00', closes: '14:00' }],
  7: [],
};

/** 10:00 ώρα Ελλάδας, Παρασκευή 4/12/2026 — 21 ημέρες πριν από τα Χριστούγεννα. */
const NOW = new Date('2026-12-04T08:00:00Z');

const shop = (overrides: Partial<HoursOfLocation> = {}): HoursOfLocation => ({
  id: 'sloc_a', hours: MON_SAT, specialHours: [], ...overrides,
});

function applied(result: ReturnType<typeof applyHolidayAnswers<HoursOfLocation>>) {
  if (result.kind !== 'applied') throw new Error(`αναμενόταν εφαρμογή, ήρθε ${result.reason}`);
  return result;
}

describe('applyHolidayAnswers', () => {
  it('🔑 «Κλειστά» και «Κανονικά» γίνονται ειδικές μέρες', () => {
    const result = applied(applyHolidayAnswers([shop()], [
      { locationId: 'sloc_a', date: '2026-12-26', kind: 'regular' },
      { locationId: 'sloc_a', date: '2026-12-25', kind: 'closed' },
    ], NOW));
    expect(result.locations[0]?.specialHours).toEqual([
      { date: '2026-12-25', kind: 'closed' },
      { date: '2026-12-26', kind: 'regular' },
    ]);
    expect(result.outcomes.map(({ outcome }) => outcome)).toEqual(['applied', 'applied']);
  });

  it('🔴 Η ΦΟΡΜΑ ΚΕΡΔΙΖΕΙ: μέρα ήδη δηλωμένη ΔΕΝ πατιέται από το email', () => {
    const custom: SpecialDay = { date: '2026-12-25', kind: 'custom', intervals: [{ opens: '10:00', closes: '13:00' }] };
    const result = applied(applyHolidayAnswers([shop({ specialHours: [custom] })], [
      { locationId: 'sloc_a', date: '2026-12-25', kind: 'closed' },
    ], NOW));
    expect(result.outcomes[0]?.outcome).toBe('already-answered');
    expect(result.locations[0]?.specialHours).toEqual([custom]);
  });

  it('🔴 διπλή απάντηση για την ίδια μέρα ⇒ ΜΙΑ εγγραφή, η δεύτερη «ήδη απαντημένη»', () => {
    const result = applied(applyHolidayAnswers([shop()], [
      { locationId: 'sloc_a', date: '2026-12-25', kind: 'closed' },
      { locationId: 'sloc_a', date: '2026-12-25', kind: 'regular' },
    ], NOW));
    expect(result.outcomes.map(({ outcome }) => outcome)).toEqual(['applied', 'already-answered']);
    expect(result.locations[0]?.specialHours).toEqual([{ date: '2026-12-25', kind: 'closed' }]);
  });

  it('χωρίς εβδομαδιαίο ωράριο · μη-αργία · σβησμένο κατάστημα ⇒ ονομασμένα, τίποτα δεν γράφεται', () => {
    const result = applied(applyHolidayAnswers([shop({ hours: null }), shop({ id: 'sloc_b' })], [
      { locationId: 'sloc_a', date: '2026-12-25', kind: 'closed' },
      { locationId: 'sloc_b', date: '2026-12-10', kind: 'closed' },
      { locationId: 'sloc_gone', date: '2026-12-25', kind: 'closed' },
    ], NOW));
    expect(result.outcomes.map(({ outcome }) => outcome)).toEqual(['no-longer-needed', 'no-longer-needed', 'location-gone']);
    expect(result.locations.map(({ specialHours }) => specialHours)).toEqual([[], []]);
  });

  it('οι περασμένες κλαδεύονται — ίδια κανονικοποίηση με τη φόρμα', () => {
    const result = applied(applyHolidayAnswers([shop({ specialHours: [{ date: '2026-11-01', kind: 'closed' }] })], [
      { locationId: 'sloc_a', date: '2026-12-25', kind: 'closed' },
    ], NOW));
    expect(result.locations[0]?.specialHours).toEqual([{ date: '2026-12-25', kind: 'closed' }]);
  });

  it('🔴 ταβάνι 30: η 31η μέρα ⇒ ονομασμένη άρνηση του ΙΔΙΟΥ κριτή, τίποτα δεν αλλάζει', () => {
    const full: SpecialDay[] = Array.from({ length: 30 }, (_, index) => ({
      date: addDaysToDateKey('2027-02-01', index) ?? '', kind: 'closed' as const,
    }));
    const result = applyHolidayAnswers([shop({ specialHours: full })], [
      { locationId: 'sloc_a', date: '2026-12-25', kind: 'closed' },
    ], NOW);
    expect(result).toEqual({ kind: 'rejected', reason: 'agency-profile-card-special-hours-invalid' });
  });
});
