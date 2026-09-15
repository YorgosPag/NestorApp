/**
 * Άγκυρες της ρίζας του φορέα (ADR-861 Φ1).
 *
 * **Ι** — ιστορικό: «ποιος ήταν ο φορέας εκείνη τη μέρα;»
 * **Ζ** — η μέρα είναι **ελληνική** μέρα
 * **Π** — το πραγματικό ιστορικό (παρονομαστής: υπάρχει, και ξεκινά εκεί που δηλώθηκε)
 *
 * ⚠️ Καμία τιμή του πραγματικού φορέα δεν αντιγράφεται εδώ: ένα test που καρφώνει τον ΑΦΜ θα
 * ήταν **δεύτερη πηγή** του, και θα έπρεπε να αλλάζει σε κάθε μεταβίβαση.
 */

import {
  PLATFORM_OPERATORS,
  calendarDayOf,
  operatorOn,
  type OperatorRecord,
} from '@/constants/platform-operator';

function recordFrom(effectiveFrom: string, fullName: string): OperatorRecord {
  return {
    effectiveFrom,
    identity: { kind: 'natural-person', fullName, tradeName: null },
    seat: { street: 'Οδός', number: '1', postalCode: '10431', city: 'Αθήνα', country: 'GR' },
    vatNumber: '123456783',
    gemiNumber: null,
    contact: { address: 'contact@example.gr', receivingConfirmedOn: '2026-01-01' },
    privacy: { address: 'privacy@example.gr', receivingConfirmedOn: '2026-01-01' },
  };
}

const nameOn = (day: string, history: readonly OperatorRecord[]): string | null => {
  const standing = operatorOn(day, history);
  if (standing.kind === 'pending') return null;
  const { identity } = standing.record;
  return identity.kind === 'natural-person' ? identity.fullName : identity.legalName;
};

describe('Ι — ιστορικό με ημερομηνίες', () => {
  const FIRST = recordFrom('2026-01-01', 'Α');
  const SECOND = recordFrom('2026-10-01', 'Β');

  it('Ι1 — άδειο ιστορικό ⇒ pending, ποτέ πλαστός φορέας', () => {
    expect(operatorOn('2026-09-15', [])).toEqual({ kind: 'pending' });
  });

  it('Ι2 — πριν από την πρώτη γραμμή ⇒ pending', () => {
    expect(nameOn('2025-12-31', [FIRST])).toBeNull();
  });

  it('Ι3 — την ίδια μέρα ισχύει ήδη (effectiveFrom ≤ day)', () => {
    expect(nameOn('2026-01-01', [FIRST])).toBe('Α');
  });

  // 🔑 Η ΜΕΤΑΒΙΒΑΣΗ: η παλιά γραμμή ΜΕΝΕΙ και απαντά για το παρελθόν.
  it('Ι4 — μεταβίβαση: πριν ο παλιός, από τη μέρα της ο νέος', () => {
    const history = [FIRST, SECOND];
    expect(nameOn('2026-09-30', history)).toBe('Α');
    expect(nameOn('2026-10-01', history)).toBe('Β');
    expect(nameOn('2030-01-01', history)).toBe('Β');
  });

  it('Ι5 — δεν υποθέτει σειρά: ανακατεμένο ιστορικό δίνει την ίδια απάντηση', () => {
    expect(nameOn('2026-10-02', [SECOND, FIRST])).toBe('Β');
    expect(nameOn('2026-09-02', [SECOND, FIRST])).toBe('Α');
  });
});

describe('Ζ — η μέρα του φορέα είναι ελληνική μέρα', () => {
  // Σεπτέμβριος = θερινή ώρα, UTC+3.
  it('Ζ1 — 21:30 UTC της 14ης είναι ήδη 15η στην Αθήνα', () => {
    expect(calendarDayOf(new Date('2026-09-14T21:30:00Z'))).toBe('2026-09-15');
  });

  it('Ζ2 — 20:59 UTC της 14ης είναι ακόμα 14η στην Αθήνα', () => {
    expect(calendarDayOf(new Date('2026-09-14T20:59:00Z'))).toBe('2026-09-14');
  });

  it('Ζ3 — η μορφή είναι YYYY-MM-DD (λεξικογραφική σύγκριση = χρονολογική)', () => {
    expect(calendarDayOf(new Date('2027-01-05T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Π — το πραγματικό ιστορικό', () => {
  it('Π1 — υπάρχει τουλάχιστον μία γραμμή', () => {
    expect(PLATFORM_OPERATORS.length).toBeGreaterThanOrEqual(1);
  });

  it('Π2 — πριν από την πρώτη δηλωμένη μέρα ο φορέας είναι pending', () => {
    const [first] = PLATFORM_OPERATORS;
    const dayBefore = calendarDayOf(new Date(Date.parse(`${first.effectiveFrom}T12:00:00Z`) - 86_400_000));
    expect(operatorOn(dayBefore).kind).toBe('pending');
    expect(operatorOn(first.effectiveFrom).kind).toBe('declared');
  });
});
