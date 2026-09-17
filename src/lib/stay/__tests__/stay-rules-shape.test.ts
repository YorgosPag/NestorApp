/** ADR-835 §21 — ο ΕΝΑΣ έλεγχος σχήματος κανόνων, για σώμα αιτήματος ΚΑΙ έγγραφο. */

import { stayCalendarCommandFrom } from '@/lib/stay/stay-calendar-command';
import { stayCalendarHeadFromDocument, stayCalendarMonthFromDocument } from '@/lib/stay/stay-calendar-from-document';
import { stayDayRuleFrom, stayRulesFrom } from '@/lib/stay/stay-rules-shape';
import { STAY_RULES_NONE } from '@/types/stay-rules';

const HEAD = {
  authorUserId: 'user-1', declaredAt: null, version: 3,
  createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
};

describe('stayRulesFrom', () => {
  it('δέχεται τις τιμές της αγοράς και ταξινομεί τις μέρες', () => {
    const rules = { ...STAY_RULES_NONE, arrivalWeekdays: [6, 5], advanceNotice: { days: 0, sameDayCutoffHour: 18 } };
    expect(stayRulesFrom(rules)).toEqual({ ...rules, arrivalWeekdays: [5, 6] });
  });

  it.each([
    ['κενές μέρες άφιξης', { arrivalWeekdays: [] }],
    ['διπλή μέρα', { departureWeekdays: [1, 1] }],
    ['ειδοποίηση 4 ημερών', { advanceNotice: { days: 4, sameDayCutoffHour: null } }],
    ['αποκοπή χωρίς «ίδια μέρα»', { advanceNotice: { days: 1, sameDayCutoffHour: 18 } }],
    ['προετοιμασία 3', { preparationNights: 3 }],
    ['παράθυρο 5 μηνών', { availabilityWindowMonths: 5 }],
    ['ορφανό κενό 4', { orphanGap: { maxNights: 4 } }],
  ])('🔴 %s ⇒ null, ποτέ «διόρθωση»', (_, patch) => {
    expect(stayRulesFrom({ ...STAY_RULES_NONE, ...patch })).toBeNull();
  });
});

describe('stayDayRuleFrom', () => {
  it('κρατά μόνο ό,τι δηλώθηκε', () => {
    expect(stayDayRuleFrom({ closedToArrival: true, nightlyRateMinor: 0 })).toEqual({ closedToArrival: true, nightlyRateMinor: 0 });
  });

  it.each([
    ['άγνωστο πεδίο', { price: 10 }],
    ['ελάχιστες > μέγιστες', { minNights: 5, maxNights: 2 }],
    ['CTA false', { closedToArrival: false }],
    ['τιμή με δεκαδικά λεπτά', { nightlyRateMinor: 12.5 }],
    ['0 νύχτες', { minNights: 0 }],
  ])('🔴 %s ⇒ null', (_, raw) => {
    expect(stayDayRuleFrom(raw)).toBeNull();
  });
});

describe('σύνορα ανάγνωσης', () => {
  it('🔴 κεφαλή ΠΡΙΝ το Στάδιο Β (χωρίς `rules`) ⇒ ρητά κανένας κανόνας· άκυρο `rules` ⇒ χαλασμένη', () => {
    expect(stayCalendarHeadFromDocument(HEAD, 'ownp_a')?.rules).toEqual(STAY_RULES_NONE);
    expect(stayCalendarHeadFromDocument({ ...HEAD, rules: { maxNights: 0 } }, 'ownp_a')).toBeNull();
  });

  it('🔴 μέρα που δεν ανήκει στον μήνα του εγγράφου ⇒ όλο το έγγραφο null', () => {
    const doc = { propertyId: 'ownp_a', authorUserId: 'user-1', month: '2027-10', updatedAt: 'x', days: {} };
    expect(stayCalendarMonthFromDocument({ ...doc, days: { '2027-10-05': { minNights: 2 } } }, 'scmo_1')).not.toBeNull();
    expect(stayCalendarMonthFromDocument({ ...doc, days: { '2027-11-05': { minNights: 2 } } }, 'scmo_1')).toBeNull();
  });
});

describe('πράξεις Σταδίου Β', () => {
  it('restrict: έγκυρο, και απορρίπτει κενή πράξη ή ίδιο πεδίο σε set ΚΑΙ clear', () => {
    const base = { action: 'restrict', from: '2027-10-10', to: '2027-10-12' };
    expect(stayCalendarCommandFrom({ ...base, set: { minNights: 3 } })).toEqual({
      ok: true, command: { ...base, set: { minNights: 3 }, clear: [] },
    });
    expect(stayCalendarCommandFrom({ ...base, set: {}, clear: [] }).ok).toBe(false);
    expect(stayCalendarCommandFrom({ ...base, set: { minNights: 3 }, clear: ['minNights'] }).ok).toBe(false);
  });

  it('book: άγνωστη ή διπλή αποδοχή προειδοποίησης ⇒ malformed', () => {
    const book = { action: 'book', checkIn: '2027-10-10', checkOut: '2027-10-12', guests: 2, guestLabel: 'Α' };
    expect(stayCalendarCommandFrom({ ...book, acknowledgedWarnings: ['preparation'] }).ok).toBe(true);
    expect(stayCalendarCommandFrom({ ...book, acknowledgedWarnings: ['whatever'] }).ok).toBe(false);
    expect(stayCalendarCommandFrom({ ...book, acknowledgedWarnings: ['preparation', 'preparation'] }).ok).toBe(false);
  });
});
