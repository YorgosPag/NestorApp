/** ADR-835 §20 — η αισιόδοξη πρόβλεψη: ποτέ απόφαση, πάντα αναστρέψιμη από το «πριν». */

import { isPendingEntry, optimisticView } from '@/lib/stay/stay-calendar-optimistic';
import type { StayCalendarView } from '@/lib/stay/stay-calendar-view';
import { STAY_RULES_NONE } from '@/types/stay-rules';

const BEFORE: Extract<StayCalendarView, { kind: 'readable' }> = {
  kind: 'readable',
  declaredAt: null,
  version: 4,
  rules: STAY_RULES_NONE,
  days: {},
  entries: [
    { kind: 'block', id: 'sblk_1', from: '2027-10-10', to: '2027-10-12', source: 'owner', note: null },
    {
      kind: 'booking', id: 'stay_1', from: '2027-10-14', to: '2027-10-16', guests: 2,
      guestLabel: 'Μαρία', channel: 'direct', lifecycle: 'confirmed', occupies: true,
    },
  ],
};
const NOW = '2027-09-01T10:00:00.000Z';

describe('optimisticView', () => {
  it('νέο block με προσωρινή ταυτότητα που ΔΕΝ μοιάζει με enterprise id', () => {
    const after = optimisticView(BEFORE, { action: 'block', from: '2027-10-20', to: '2027-10-22', note: null }, 'pending:1', NOW);
    const added = after.entries[after.entries.length - 1];
    expect(added).toMatchObject({ kind: 'block', from: '2027-10-20', to: '2027-10-22' });
    expect(isPendingEntry(added)).toBe(true);
  });

  it('ακύρωση: η κράτηση ΜΕΝΕΙ ορατή αλλά παύει να πιάνει νύχτες', () => {
    const after = optimisticView(BEFORE, { action: 'cancel', bookingId: 'stay_1' }, 'pending:2', NOW);
    expect(after.entries[1]).toMatchObject({ id: 'stay_1', lifecycle: 'cancelled', occupies: false });
  });

  it('άνοιγμα αφαιρεί μόνο το block· δήλωση αλλάζει μόνο το declaredAt', () => {
    expect(optimisticView(BEFORE, { action: 'unblock', blockId: 'sblk_1' }, 'pending:3', NOW).entries).toHaveLength(1);
    const declared = optimisticView(BEFORE, { action: 'declare', declared: true }, 'pending:4', NOW);
    expect(declared).toEqual({ ...BEFORE, declaredAt: NOW });
  });

  it('το «πριν» δεν αλλάζει ποτέ — η επαναφορά σε άρνηση είναι απλώς επιστροφή σε αυτό', () => {
    const snapshot = JSON.stringify(BEFORE);
    optimisticView(BEFORE, { action: 'unblock', blockId: 'sblk_1' }, 'pending:5', NOW);
    expect(JSON.stringify(BEFORE)).toBe(snapshot);
  });

  it('ρύθμιση ημερών: ίδια συγχώνευση με τον διακομιστή — αντίφαση αφήνει τις μέρες ως είχαν', () => {
    const set = optimisticView(BEFORE, { action: 'restrict', from: '2027-10-01', to: '2027-10-03', set: { minNights: 4 }, clear: [] }, 'pending:6', NOW);
    expect(set.days).toEqual({ '2027-10-01': { minNights: 4 }, '2027-10-02': { minNights: 4 } });
    const cleared = optimisticView(set, { action: 'restrict', from: '2027-10-01', to: '2027-10-02', set: {}, clear: ['minNights'] }, 'pending:7', NOW);
    expect(cleared.days).toEqual({ '2027-10-02': { minNights: 4 } });
    const contradictory = optimisticView(set, { action: 'restrict', from: '2027-10-01', to: '2027-10-02', set: { maxNights: 2 }, clear: [] }, 'pending:8', NOW);
    expect(contradictory.days).toBe(set.days);
  });
});
