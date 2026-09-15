/**
 * Άγκυρες της κρίσης «είναι γραμμένη η ταμπέλα;» (ADR-861 Φ1).
 *
 * **Κ** — κάθε ελάττωμα περιεχομένου ονομάζεται (θετικός μάρτυρας: η έγκυρη γραμμή είναι `ready`)
 * **Χ** — ο χρόνος: τρέχων + μελλοντικοί κρίνονται, οι παλιοί μόνο για σειρά
 * **Π** — το πραγματικό ιστορικό: ό,τι μπορεί να ελεγχθεί από κώδικα είναι έγκυρο
 */

import { PLATFORM_OPERATORS, calendarDayOf, type OperatorRecord } from '@/constants/platform-operator';
import {
  describeReadiness,
  judgeLaunchReadiness,
  operatorRecordDefects,
} from '@/lib/platform-operator/operator-readiness';

const NOW = new Date('2026-09-15T10:00:00Z');

function valid(overrides: Partial<OperatorRecord> = {}): OperatorRecord {
  return {
    effectiveFrom: '2026-01-01',
    identity: { kind: 'natural-person', fullName: 'Δοκιμαστικό Πρόσωπο', tradeName: null },
    seat: { street: 'Οδός', number: '1', postalCode: '10431', city: 'Αθήνα', country: 'GR' },
    vatNumber: '123456783',
    gemiNumber: null,
    contact: { address: 'contact@example.gr', receivingConfirmedOn: '2026-02-01' },
    privacy: { address: 'privacy@example.gr', receivingConfirmedOn: '2026-02-01' },
    ...overrides,
  };
}

const defectsOf = (record: OperatorRecord): readonly string[] => operatorRecordDefects(record, '2026-09-15');

describe('Κ — κάθε ελάττωμα έχει όνομα', () => {
  it('Κ0 — θετικός μάρτυρας: έγκυρη γραμμή ⇒ ready, καμία περιγραφή', () => {
    const readiness = judgeLaunchReadiness(NOW, [valid()]);
    expect(readiness.status).toBe('ready');
    expect(describeReadiness(readiness)).toEqual([]);
  });

  it('Κ1 — άδειο ιστορικό ⇒ pending, με τη μέρα στην περιγραφή', () => {
    const readiness = judgeLaunchReadiness(NOW, []);
    expect(readiness).toEqual({ status: 'pending', day: '2026-09-15' });
    expect(describeReadiness(readiness)[0]).toContain('2026-09-15');
  });

  it.each([
    ['vat-invalid', valid({ vatNumber: '123456789' })],
    ['gemi-invalid', valid({ gemiNumber: 'όχι αριθμός' })],
    ['postal-code-invalid', valid({ seat: { ...valid().seat, postalCode: '0123' } })],
    ['seat-incomplete', valid({ seat: { ...valid().seat, street: ' ' } })],
    ['seat-country-unsupported', valid({ seat: { ...valid().seat, country: 'CY' } })],
    ['name-missing', valid({ identity: { kind: 'natural-person', fullName: '', tradeName: null } })],
    ['legal-form-missing', valid({ identity: { kind: 'legal-entity', legalName: 'Εταιρεία', legalForm: '' } })],
    ['contact-email-invalid', valid({ contact: { address: 'όχι-email', receivingConfirmedOn: '2026-02-01' } })],
    ['privacy-mailbox-unconfirmed', valid({ privacy: { address: 'p@example.gr', receivingConfirmedOn: null } })],
    ['contact-mailbox-unconfirmed', valid({ contact: { address: 'c@example.gr', receivingConfirmedOn: '2027-01-01' } })],
    ['effective-date-malformed', valid({ effectiveFrom: '2026-02-30' })],
  ])('Κ2 — %s', (defect, record) => {
    expect(defectsOf(record)).toContain(defect);
  });

  it('Κ3 — έγκυρος ΓΕΜΗ περνά (null δεν είναι ελάττωμα, αριθμός επίσης)', () => {
    expect(defectsOf(valid({ gemiNumber: '123401000' }))).toEqual([]);
  });

  it('Κ4 — η περιγραφή κουβαλά ονόματα ελαττωμάτων, ποτέ τιμές', () => {
    const readiness = judgeLaunchReadiness(NOW, [valid({ vatNumber: '123456789' })]);
    const [line] = describeReadiness(readiness);
    expect(line).toContain('vat-invalid');
    expect(line).not.toContain('123456789');
  });
});

describe('Χ — ποιες γραμμές κρίνονται', () => {
  it('Χ1 — προγραμματισμένη μεταβίβαση με ελάττωμα μπλοκάρει ΣΗΜΕΡΑ', () => {
    const history = [valid(), valid({ effectiveFrom: '2026-12-01', vatNumber: '123456789' })];
    const readiness = judgeLaunchReadiness(NOW, history);
    expect(readiness.status).toBe('incomplete');
    expect(describeReadiness(readiness)[0]).toContain('2026-12-01');
  });

  it('Χ2 — παλιά γραμμή δεν κρίνεται για περιεχόμενο (είναι ό,τι δημοσιεύτηκε)', () => {
    const history = [valid({ vatNumber: '123456789' }), valid({ effectiveFrom: '2026-06-01' })];
    expect(judgeLaunchReadiness(NOW, history).status).toBe('ready');
  });

  it('Χ3 — ιστορικό εκτός σειράς ⇒ history-out-of-order, και για παλιά γραμμή', () => {
    const history = [valid({ effectiveFrom: '2026-06-01' }), valid({ effectiveFrom: '2026-03-01' })];
    const readiness = judgeLaunchReadiness(NOW, history);
    expect(readiness.status).toBe('incomplete');
    expect(describeReadiness(readiness).join()).toContain('history-out-of-order');
  });

  it('Χ4 — μελλοντικός μόνο φορέας ⇒ pending σήμερα', () => {
    expect(judgeLaunchReadiness(NOW, [valid({ effectiveFrom: '2027-01-01' })]).status).toBe('pending');
  });
});

describe('Π — το πραγματικό ιστορικό', () => {
  // Ό,τι ΔΕΝ μπορεί να αποδείξει κώδικας είναι η επιβεβαίωση παραλαβής (την κάνει άνθρωπος).
  // Όλα τα υπόλοιπα —ΑΦΜ, Τ.Κ., μορφή email, σειρά— οφείλουν να είναι έγκυρα ΗΔΗ.
  const HUMAN_ONLY = new Set(['contact-mailbox-unconfirmed', 'privacy-mailbox-unconfirmed']);

  it('Π1 — κάθε γραμμή είναι έγκυρη σε ό,τι ελέγχει ο κώδικας', () => {
    const today = calendarDayOf(new Date());
    const machineDefects = PLATFORM_OPERATORS.flatMap((record) =>
      operatorRecordDefects(record, today).filter((d) => !HUMAN_ONLY.has(d)).map((d) => `${record.effectiveFrom}: ${d}`),
    );
    expect(machineDefects).toEqual([]);
  });

  it('Π2 — το πραγματικό ιστορικό είναι αυστηρά αύξον', () => {
    const days = PLATFORM_OPERATORS.map((r) => r.effectiveFrom);
    expect([...days].sort()).toEqual(days);
    expect(new Set(days).size).toBe(days.length);
  });
});
