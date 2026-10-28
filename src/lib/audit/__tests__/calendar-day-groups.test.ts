/**
 * @fileoverview Η ΜΙΑ ομαδοποίηση ανά ημέρα (ADR-327).
 *
 * Η1 σήμερα/χθες/παλαιότερα/άγνωστο, στη σειρά των εγγραφών ·
 * Η2 🔴 ΤΟΠΙΚΗ ημέρα, όχι UTC: 00:30 τοπικά ανήκει στη ΣΗΜΕΡΙΝΗ ημέρα (το δίδυμο της διαχείρισης ρόλων
 *     χώριζε με `toISOString()` ⇒ στην Ελλάδα την έριχνε στη χθεσινή) ·
 * Η3 η ετικέτα: σχετικές από τον καλούντα, παλαιότερες από τον μορφοποιητή του — καμία γλώσσα μέσα στο SSoT.
 *
 * ⚠️ Μετάλλαξη που ΠΡΕΠΕΙ να κοκκινίζει: `localDateKey` → `d.toISOString().slice(0, 10)` ⇒ Η2 (σε ζώνη ≠ UTC).
 */

import { calendarDayLabel, groupByCalendarDay } from '../calendar-day-groups';

const NOW = new Date(2026, 9, 28, 12, 0, 0); // 28 Οκτ 2026, 12:00 τοπικά
const at = (d: number, h: number, m = 0) => ({ ts: new Date(2026, 9, d, h, m).toISOString() });
const LABELS = { today: 'TODAY', yesterday: 'YESTERDAY', unknown: 'UNKNOWN' };

describe('groupByCalendarDay', () => {
  it('Η1 — είδη ημέρας στη σειρά των εγγραφών', () => {
    const entries = [at(28, 11), at(28, 9), at(27, 20), at(20, 8), { ts: null }];
    const groups = groupByCalendarDay(entries, (e) => e.ts, NOW);
    expect(groups.map((g) => [g.kind, g.entries.length])).toEqual([
      ['today', 2], ['yesterday', 1], ['earlier', 1], ['unknown', 1],
    ]);
  });

  it('Η2 🔴 — 00:30 τοπικά = σήμερα (όχι η χθεσινή της UTC)', () => {
    const [group] = groupByCalendarDay([at(28, 0, 30)], (e) => e.ts, NOW);
    expect(group.kind).toBe('today');
    expect(group.dateKey).toBe('2026-10-28');
  });

  it('Η3 — ετικέτες από τον καλούντα', () => {
    const groups = groupByCalendarDay([at(28, 1), at(20, 1), { ts: 'not-a-date' }], (e) => e.ts, NOW);
    const fmt = (d: Date) => `D${d.getDate()}`;
    expect(groups.map((g) => calendarDayLabel(g, LABELS, fmt))).toEqual(['TODAY', 'D20', 'UNKNOWN']);
  });
});
