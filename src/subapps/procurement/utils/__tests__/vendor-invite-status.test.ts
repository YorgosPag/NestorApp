/**
 * @fileoverview Η κατάσταση πρόσκλησης — αποθηκευμένη και ΠΑΡΑΓΩΓΗ (ADR-876 §5 Σ5).
 *
 * Κ1 η λήξη είναι παράγωγη, μόνο για ζωντανή πρόσκληση · Κ2 `revoked` ≠ `expired` ·
 * Κ3 άγνωστη τιμή (και το παράγωγο `expired` αν αποθηκευτεί) ⇒ κλειστό (`revoked`) · Κ4 άγνωστη λήξη ⇒ ΟΧΙ «έληξε».
 */

import {
  isLiveInviteStatus,
  normalizeInviteStatus,
  VENDOR_QUOTE_EDIT_WINDOW_HOURS,
  vendorInviteDisplayStatus,
  vendorQuoteEditWindowEnd,
} from '../vendor-invite-status';

const NOW = Date.parse('2026-09-24T10:00:00.000Z');
const past = new Date(NOW - 1);
const future = new Date(NOW + 60_000);

describe('vendor invite status', () => {
  it('Κ1 — ζωντανή πρόσκληση με περασμένη λήξη = «έληξε»· με μελλοντική = όπως είναι', () => {
    expect(vendorInviteDisplayStatus({ status: 'sent', expiresAt: past }, NOW)).toBe('expired');
    expect(vendorInviteDisplayStatus({ status: 'opened', expiresAt: future }, NOW)).toBe('opened');
  });

  it('Κ1 — υποβεβλημένη/αρνημένη ΔΕΝ «λήγουν»', () => {
    expect(vendorInviteDisplayStatus({ status: 'submitted', expiresAt: past }, NOW)).toBe('submitted');
    expect(vendorInviteDisplayStatus({ status: 'declined', expiresAt: past }, NOW)).toBe('declined');
  });

  it('Κ2 — η ανάκληση μένει ανάκληση, όποια κι αν είναι η λήξη', () => {
    expect(vendorInviteDisplayStatus({ status: 'revoked', expiresAt: past }, NOW)).toBe('revoked');
    expect(vendorInviteDisplayStatus({ status: 'revoked', expiresAt: future }, NOW)).toBe('revoked');
  });

  it("Κ3 — αποθηκευμένο 'expired' (τιμή ΜΟΝΟ οθόνης) και άγνωστες τιμές ⇒ revoked (κλειστό εξ ορισμού)", () => {
    expect(normalizeInviteStatus('expired')).toBe('revoked');
    expect(normalizeInviteStatus('whatever')).toBe('revoked');
    expect(isLiveInviteStatus(normalizeInviteStatus('expired'))).toBe(false);
  });

  it('Κ4 — άγνωστη λήξη ⇒ ΔΕΝ δηλώνεται «έληξε»', () => {
    expect(vendorInviteDisplayStatus({ status: 'sent', expiresAt: null }, NOW)).toBe('sent');
  });

  it('ζωντανές = pending · sent · opened', () => {
    expect(['pending', 'sent', 'opened', 'submitted', 'declined', 'revoked'].map((s) => isLiveInviteStatus(normalizeInviteStatus(s))))
      .toEqual([true, true, true, false, false, false]);
  });

  it('Κ5 — ΕΝΑ παράθυρο επεξεργασίας (ADR-327 Q8 · ADR-876 §5 Σ17): 72 ώρες από τη ΔΟΣΜΕΝΗ στιγμή', () => {
    expect(VENDOR_QUOTE_EDIT_WINDOW_HOURS).toBe(72);
    expect(vendorQuoteEditWindowEnd(NOW).getTime() - NOW).toBe(72 * 60 * 60 * 1000);
  });
});
