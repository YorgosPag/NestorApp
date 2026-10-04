/**
 * ADR-901 §14.8 — η όψη λέει **πότε** μπαγιατεύει (`freshUntil`): στην αλλαγή της ελληνικής ημέρας, όπου αλλάζουν
 * μόνες τους οι καταστάσεις λήξης. Θερινή ώρα: 23ωρη και 25ωρη ημέρα.
 */

import { conveyanceToday, nextConveyanceDayStart } from '../conveyance-calendar';

describe('nextConveyanceDayStart — η επόμενη ελληνική μεσάνυχτα', () => {
  it.each([
    ['κανονική ημέρα (UTC+3)', '2026-10-04T12:34:56.789Z', '2026-10-04T21:00:00.000Z'],
    ['ένα λεπτό πριν τη μεσάνυχτα', '2026-10-04T20:59:30.000Z', '2026-10-04T21:00:00.000Z'],
    ['ακριβώς στη μεσάνυχτα ⇒ η ΕΠΟΜΕΝΗ', '2026-10-04T21:00:00.000Z', '2026-10-05T21:00:00.000Z'],
    ['χειμώνας (UTC+2)', '2026-12-10T08:00:00.000Z', '2026-12-10T22:00:00.000Z'],
    ['25ωρη ημέρα (αλλαγή σε χειμερινή, 25/10)', '2026-10-25T06:00:00.000Z', '2026-10-25T22:00:00.000Z'],
    ['23ωρη ημέρα (αλλαγή σε θερινή, 29/03)', '2026-03-29T06:00:00.000Z', '2026-03-29T21:00:00.000Z'],
  ])('%s', (_label, now, expected) => {
    const next = nextConveyanceDayStart(new Date(now));
    expect(next.toISOString()).toBe(expected);
    // Ο ορισμός, όχι αριθμητική: εκεί αλλάζει η μέρα, και ένα χιλιοστό πριν ΔΕΝ έχει αλλάξει.
    expect(conveyanceToday(next)).not.toBe(conveyanceToday(new Date(now)));
    expect(conveyanceToday(new Date(next.getTime() - 1))).toBe(conveyanceToday(new Date(now)));
  });
});
