/**
 * ADR-327 §7.5 — το σώμα της δημιουργίας πρόσκλησης (Ε3: όνομα προαιρετικό · Ε1: σημείωμα + ημέρα λήξης).
 */

import { VENDOR_INVITE_NOTE_MAX_LENGTH } from '@/subapps/procurement/config/vendor-invite-policy';
import { CreateInviteSchema } from '../invite-message-schema';

const manual = { manualEmail: 'vendor@example.test', deliveryChannel: 'email' as const };

describe('CreateInviteSchema', () => {
  it('Ε3 — a manual invite WITHOUT a name is valid', () => {
    expect(CreateInviteSchema.safeParse(manual).success).toBe(true);
    expect(CreateInviteSchema.safeParse({ ...manual, manualName: 'Ηλεκτρική' }).success).toBe(true);
  });

  it('exactly one of contact / manual email', () => {
    expect(CreateInviteSchema.safeParse({ deliveryChannel: 'email' }).success).toBe(false);
    expect(CreateInviteSchema.safeParse({ ...manual, vendorContactId: 'cont_1' }).success).toBe(false);
    expect(CreateInviteSchema.safeParse({ vendorContactId: 'cont_1', deliveryChannel: 'email' }).success).toBe(true);
  });

  it('Ε1 — the note is trimmed, blank ⇒ null, over the limit ⇒ rejected', () => {
    const parsed = CreateInviteSchema.safeParse({ ...manual, buyerNote: '  Δείτε τα σχέδια.  ' });
    expect(parsed.success && parsed.data.buyerNote).toBe('Δείτε τα σχέδια.');
    const blank = CreateInviteSchema.safeParse({ ...manual, buyerNote: '   ' });
    expect(blank.success && blank.data.buyerNote).toBeNull();
    expect(CreateInviteSchema.safeParse({ ...manual, buyerNote: 'x'.repeat(VENDOR_INVITE_NOTE_MAX_LENGTH + 1) }).success).toBe(false);
  });

  it('Ε1β — the expiry is a YYYY-MM-DD day (its bounds are judged by the service)', () => {
    expect(CreateInviteSchema.safeParse({ ...manual, expiresOn: '2026-11-20' }).success).toBe(true);
    expect(CreateInviteSchema.safeParse({ ...manual, expiresOn: '20/11/2026' }).success).toBe(false);
  });
});
