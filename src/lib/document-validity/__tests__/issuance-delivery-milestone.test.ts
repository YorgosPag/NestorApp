/**
 * ADR-915 §45 Φ5 — **τα ορόσημα της προθεσμίας**: αύριο · +1 · +7 (το πιο πρόσφατο που πέρασε) · τίποτα αλλιώς· το
 * `eventId` περιέχει την προθεσμία (νέα προθεσμία ⇒ νέος κύκλος).
 */

import { deliveryMilestoneEventId, deliveryMilestoneOf } from '@/lib/document-validity/issuance-delivery-milestone';

describe('ADR-915 §45 Φ5 — deliveryMilestoneOf', () => {
  it.each([
    ['2026-11-17', '2026-11-16', { milestone: 'due-tomorrow', days: 0 }],
    ['2026-11-15', '2026-11-16', { milestone: 'overdue', days: 1 }],
    ['2026-11-10', '2026-11-16', { milestone: 'overdue', days: 6 }],
    ['2026-11-09', '2026-11-16', { milestone: 'overdue-week', days: 7 }],
    // Η σάρωση ήρθε αργά (ρυθμός υπενθυμίσεων): λέει «εβδομάδα», ποτέ το χαμένο +1.
    ['2026-11-07', '2026-11-16', { milestone: 'overdue-week', days: 9 }],
  ])('προθεσμία %s, σήμερα %s ⇒ %o', (dueOn, today, expected) => {
    expect(deliveryMilestoneOf(dueOn, today)).toEqual(expected);
  });

  it.each([
    ['σήμερα', '2026-11-16'],
    ['μεθαύριο', '2026-11-18'],
    ['σε δύο εβδομάδες', '2026-11-30'],
  ])('🔴 %s ⇒ κανένα ορόσημο', (_label, dueOn) => {
    expect(deliveryMilestoneOf(dueOn, '2026-11-16')).toBeNull();
  });

  it('χωρίς προθεσμία ⇒ κανένα ορόσημο', () => {
    expect(deliveryMilestoneOf(null, '2026-11-16')).toBeNull();
  });

  it('`eventId`: ίδιο ορόσημο + ίδια προθεσμία ⇒ ίδιο · νέα προθεσμία ή άλλος παραλήπτης ⇒ άλλο', () => {
    const id = deliveryMilestoneEventId('diss_1', '2026-11-15', 'overdue', 'uid_a');
    expect(id).toBe(deliveryMilestoneEventId('diss_1', '2026-11-15', 'overdue', 'uid_a'));
    expect(id).not.toBe(deliveryMilestoneEventId('diss_1', '2026-11-20', 'overdue', 'uid_a'));
    expect(id).not.toBe(deliveryMilestoneEventId('diss_1', '2026-11-15', 'overdue', 'uid_b'));
    expect(id).not.toBe(deliveryMilestoneEventId('diss_1', '2026-11-15', 'overdue-week', 'uid_a'));
  });
});
