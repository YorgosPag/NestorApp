/**
 * @fileoverview ⚖️ **Η ΤΑΜΠΕΛΑ ΟΠΩΣ ΤΗ ΔΙΑΒΑΖΕΙ Ο ΑΝΘΡΩΠΟΣ** — άγκυρες παρουσίασης του φορέα (ADR-861 Φ2).
 * @related lib/platform-operator/operator-presentation.ts · lib/platform-operator/operator-readiness.ts
 *
 * Σ = σελίδα (τι δημοσιεύεται) · Ε = email (τι δεν επιτρέπεται να φανεί) · Σ/Κ = συμφωνία με την άρνηση ανοίγματος.
 */

import { PLATFORM_OPERATORS, type OperatorRecord } from '@/constants/platform-operator';
import {
  operatorSeatLine,
  operatorStatementOn,
  publishedAddress,
} from '@/lib/platform-operator/operator-presentation';
import { operatorRecordDefects } from '@/lib/platform-operator/operator-readiness';

function record(overrides: Partial<OperatorRecord> = {}): OperatorRecord {
  return {
    effectiveFrom: '2026-01-01',
    identity: { kind: 'natural-person', fullName: 'Δοκιμαστικό Πρόσωπο', tradeName: null },
    seat: { street: 'Εγνατίας', number: '1', postalCode: '54624', city: 'Θεσσαλονίκη', country: 'GR' },
    vatNumber: '094014201',
    gemiNumber: null,
    contact: { address: 'c@example.gr', receivingConfirmedOn: '2026-01-01' },
    privacy: { address: 'p@example.gr', receivingConfirmedOn: '2026-01-01' },
    ...overrides,
  };
}

describe('Σ — τι δημοσιεύεται', () => {
  it('Σ1 — χωρίς φορέα ⇒ pending, ποτέ πλαστά στοιχεία', () => {
    expect(operatorStatementOn('2026-09-16', [])).toEqual({ kind: 'pending' });
  });

  it('Σ2 — η έδρα σε μία γραμμή, Τ.Κ. στη μορφή ΕΛΤΑ (ίδια μορφή με τη βιτρίνα)', () => {
    expect(operatorSeatLine(record().seat)).toBe('Εγνατίας 1, 546 24 Θεσσαλονίκη');
  });

  it('Σ3 — φυσικό πρόσωπο με διακριτικό τίτλο ⇒ ο τίτλος ως χαρακτηρισμός', () => {
    const history = [record({ identity: { kind: 'natural-person', fullName: 'Α Β', tradeName: 'Τίτλος' } })];
    const statement = operatorStatementOn('2026-02-01', history);
    expect(statement.kind === 'declared' && statement.view.qualifier).toEqual({ kind: 'trade-name', text: 'Τίτλος' });
  });

  it('🔑 Σ4 — μεταβίβαση: η ταμπέλα δείχνει τον φορέα που ισχύει ΕΚΕΙΝΗ τη μέρα', () => {
    const company = record({
      effectiveFrom: '2026-10-01',
      identity: { kind: 'legal-entity', legalName: 'Εταιρεία', legalForm: 'ΙΚΕ' },
    });
    const history = [record(), company];
    const before = operatorStatementOn('2026-09-30', history);
    const after = operatorStatementOn('2026-10-01', history);
    expect(before.kind === 'declared' && before.view.name).toBe('Δοκιμαστικό Πρόσωπο');
    expect(after.kind === 'declared' && after.view.qualifier).toEqual({ kind: 'legal-form', text: 'ΙΚΕ' });
  });

  it('Σ5 — ο πραγματικός φορέας σήμερα αποδίδεται δηλωμένος, με τη χώρα ως κωδικό (η γλώσσα τη μεταφράζει)', () => {
    const statement = operatorStatementOn('2026-09-16', PLATFORM_OPERATORS);
    expect(statement.kind).toBe('declared');
    expect(statement.kind === 'declared' && statement.view.countryCode).toBe('GR');
  });
});

describe('Ε — email που δεν διαβάζεται ΔΕΝ φαίνεται ως λειτουργικό', () => {
  it('🔴 Ε1 — ανεπιβεβαίωτο ⇒ null', () => {
    expect(publishedAddress({ address: 'p@example.gr', receivingConfirmedOn: null }, '2026-09-16')).toBeNull();
  });

  it('🔴 Ε2 — επιβεβαίωση «από το μέλλον» ⇒ null', () => {
    expect(publishedAddress({ address: 'p@example.gr', receivingConfirmedOn: '2026-09-17' }, '2026-09-16')).toBeNull();
  });

  it('🔴 Ε3 — άκυρη διεύθυνση, ακόμα και με ημερομηνία ⇒ null', () => {
    expect(publishedAddress({ address: 'όχι-email', receivingConfirmedOn: '2026-01-01' }, '2026-09-16')).toBeNull();
  });

  it('Ε4 — θετικός μάρτυρας: επιβεβαιωμένη από την ίδια μέρα ⇒ η διεύθυνση', () => {
    expect(publishedAddress({ address: 'p@example.gr', receivingConfirmedOn: '2026-09-16' }, '2026-09-16')).toBe('p@example.gr');
  });

  it('Ε5 — οι δύο ρόλοι κρίνονται χωριστά', () => {
    const history = [record({ contact: { address: 'c@example.gr', receivingConfirmedOn: null } })];
    const statement = operatorStatementOn('2026-02-01', history);
    expect(statement.kind === 'declared' && [statement.view.contactEmail, statement.view.privacyEmail]).toEqual([
      null,
      'p@example.gr',
    ]);
  });
});

describe('Κ — η σελίδα και η άρνηση δημόσιου ανοίγματος ΔΕΝ διαφωνούν', () => {
  const MAILBOXES = [
    { address: 'p@example.gr', receivingConfirmedOn: null },
    { address: 'p@example.gr', receivingConfirmedOn: '2026-01-01' },
    { address: 'p@example.gr', receivingConfirmedOn: '2099-01-01' },
    { address: 'p@example.gr', receivingConfirmedOn: '2026-02-30' },
    { address: 'όχι-email', receivingConfirmedOn: '2026-01-01' },
  ];

  it.each(MAILBOXES)('Κ1 — %o: «φαίνεται» ⇔ «κανένα ελάττωμα απορρήτου»', (privacy) => {
    const day = '2026-09-16';
    const defects = operatorRecordDefects(record({ privacy }), day);
    const clean = !defects.includes('privacy-email-invalid') && !defects.includes('privacy-mailbox-unconfirmed');
    expect(publishedAddress(privacy, day) !== null).toBe(clean);
  });
});
