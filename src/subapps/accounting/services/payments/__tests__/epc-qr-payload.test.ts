/**
 * EPC QR payload — κατά γράμμα του EPC069-12 v3.1 §2.2 (επίσημο PDF του EPC, 19/03/2024).
 * @see ADR-ACC-018 §15
 */

import { buildEpcQrPayload, EPC_QR_LIMITS, type EpcQrInput } from '../epc-qr-payload';

/** Έγκυρο ελληνικό IBAN (mod 97) — το παράδειγμα του `validateIBAN`. */
const IBAN = 'GR1601101250000000012300695';

function input(overrides: Partial<EpcQrInput> = {}): EpcQrInput {
  return { beneficiaryName: 'Παγώνης Ενεργειακή ΙΚΕ', iban: IBAN, bic: 'ETHNGRAA', amount: 124, remittance: 'RF18539007547034', ...overrides };
}

function linesOf(payload: string): string[] {
  return payload.split('\n');
}

describe('buildEpcQrPayload', () => {
  it('κεφαλίδα BCD/002/1/SCT, BIC, όνομα, IBAN, ποσό, κενό purpose, structured RF', () => {
    const result = buildEpcQrPayload(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(linesOf(result.payload)).toEqual([
      'BCD', '002', '1', 'SCT', 'ETHNGRAA', 'Παγώνης Ενεργειακή ΙΚΕ', IBAN, 'EUR124', '', 'RF18539007547034',
    ]);
  });

  it('κανένας διαχωριστής μετά το τελευταίο συμπληρωμένο στοιχείο', () => {
    const result = buildEpcQrPayload(input());
    expect(result.ok && result.payload.endsWith('\n')).toBe(false);
  });

  it('ποσό με έως 2 δεκαδικά, τελεία, χωρίς μηδενικά στο τέλος (παράδειγμα «EUR12.3»)', () => {
    const at = (amount: number) => {
      const result = buildEpcQrPayload(input({ amount }));
      return result.ok ? linesOf(result.payload)[7] : null;
    };
    expect(at(12.3)).toBe('EUR12.3');
    expect(at(12.05)).toBe('EUR12.05');
    expect(at(0.01)).toBe('EUR0.01');
  });

  it('μη RF αιτιολογία ⇒ unstructured (12ο στοιχείο), structured κενό — ποτέ και τα δύο', () => {
    const result = buildEpcQrPayload(input({ remittance: 'A-42' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = linesOf(result.payload);
    expect(lines[9]).toBe('');
    expect(lines[10]).toBe('A-42');
  });

  it('χωρίς BIC (προαιρετικό εντός ΕΟΧ στο v002) ⇒ κενή γραμμή BIC', () => {
    const result = buildEpcQrPayload(input({ bic: null }));
    expect(result.ok && linesOf(result.payload)[4]).toBe('');
  });

  it('αρνείται αντί να «διορθώσει»: όνομα > 70, άκυρο IBAN/BIC, ποσό εκτός ορίων', () => {
    expect(buildEpcQrPayload(input({ beneficiaryName: 'Α'.repeat(71) }))).toEqual({ ok: false, reason: 'invalid_name' });
    expect(buildEpcQrPayload(input({ iban: 'GR1601101250000000012300696' }))).toEqual({ ok: false, reason: 'invalid_iban' });
    expect(buildEpcQrPayload(input({ bic: 'ETH' }))).toEqual({ ok: false, reason: 'invalid_bic' });
    expect(buildEpcQrPayload(input({ amount: 0 }))).toEqual({ ok: false, reason: 'invalid_amount' });
    expect(buildEpcQrPayload(input({ amount: EPC_QR_LIMITS.maxAmount + 1 }))).toEqual({ ok: false, reason: 'invalid_amount' });
  });

  it('το όριο είναι 331 BYTES σε UTF-8 — ελληνικά = 2 bytes ανά χαρακτήρα', () => {
    const result = buildEpcQrPayload(input({ beneficiaryName: 'Α'.repeat(70), remittance: 'Ω'.repeat(140) }));
    expect(result).toEqual({ ok: false, reason: 'payload_too_large' });
  });

  it('κάθε επιτυχές payload χωρά στα 331 bytes', () => {
    const result = buildEpcQrPayload(input({ beneficiaryName: 'Α'.repeat(70) }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(new TextEncoder().encode(result.payload).length).toBeLessThanOrEqual(EPC_QR_LIMITS.maxPayloadBytes);
  });
});
