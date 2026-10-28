/**
 * @fileoverview Ταυτότητα προμηθευτή μιας προσφοράς (ADR-327 §8.5 Γ).
 *
 * Κ1 σειρά πηγών: επαφή → στιγμιότυπο πρόσκλησης → σάρωση → `null` (ποτέ ωμό id) · κενά κείμενα δεν μετρούν ·
 * Κ2 ενεργός στο ιστορικό: `vendor:{contactId}` ή, χωρίς επαφή, `vendor:invite:{inviteId}` — ποτέ σκέτο `vendor:` ·
 * Κ3 στιγμιότυπο από την πρόσκληση: όνομα → (χωρίς όνομα) email · ποτέ `undefined`.
 */

import type { Quote } from '../../types/quote';
import {
  quoteLacksVendorContact,
  quoteVendorDisplayName,
  vendorActorId,
  vendorSnapshotFromInvite,
} from '../quote-vendor-identity';

type Facts = Pick<Quote, 'vendorContactId' | 'vendorSnapshot' | 'extractedData'>;

const facts = (partial: Partial<Facts>): Facts => ({ vendorContactId: '', vendorSnapshot: null, extractedData: null, ...partial });
const scanned = (name: string | null) => ({ vendorName: { value: name, confidence: 90 } }) as unknown as Quote['extractedData'];
const snapshot = { name: 'Δοκιμαστικός Β', email: 'b@example.invalid', inviteId: 'vi_1' };

describe('quoteVendorDisplayName', () => {
  it('Κ1 — επαφή → στιγμιότυπο → σάρωση → null', () => {
    const all = facts({ vendorContactId: 'c1', vendorSnapshot: snapshot, extractedData: scanned('Από PDF') });
    expect(quoteVendorDisplayName(all, 'Επαφή ΑΕ')).toBe('Επαφή ΑΕ');
    expect(quoteVendorDisplayName(all)).toBe('Δοκιμαστικός Β');
    expect(quoteVendorDisplayName(facts({ extractedData: scanned('Από PDF') }))).toBe('Από PDF');
    expect(quoteVendorDisplayName(facts({ vendorContactId: 'cont_raw' }))).toBeNull();
    expect(quoteVendorDisplayName(facts({ vendorSnapshot: { ...snapshot, name: '  ' }, extractedData: scanned('') }), ' ')).toBeNull();
  });

  it('χωρίς επαφή ⇒ «λείπει επαφή»', () => {
    expect(quoteLacksVendorContact({ vendorContactId: '' })).toBe(true);
    expect(quoteLacksVendorContact({ vendorContactId: 'c1' })).toBe(false);
  });
});

describe('vendorActorId', () => {
  it('Κ2 — επαφή ή πρόσκληση, ποτέ σκέτο «vendor:»', () => {
    expect(vendorActorId({ vendorContactId: 'c1', inviteId: 'vi_1' })).toBe('vendor:c1');
    expect(vendorActorId({ vendorContactId: '', inviteId: 'vi_1' })).toBe('vendor:invite:vi_1');
    expect(vendorActorId({ vendorContactId: '  ', inviteId: 'vi_1' })).toBe('vendor:invite:vi_1');
  });
});

describe('vendorSnapshotFromInvite', () => {
  it('Κ3 — όνομα, αλλιώς email', () => {
    expect(vendorSnapshotFromInvite({ id: 'vi_1', recipientName: 'Όνομα', recipientEmail: ' a@b.gr ' }))
      .toEqual({ name: 'Όνομα', email: 'a@b.gr', inviteId: 'vi_1' });
    expect(vendorSnapshotFromInvite({ id: 'vi_2', recipientName: null, recipientEmail: 'a@b.gr' }))
      .toEqual({ name: 'a@b.gr', email: 'a@b.gr', inviteId: 'vi_2' });
    expect(vendorSnapshotFromInvite({ id: 'vi_3', recipientName: null, recipientEmail: null }))
      .toEqual({ name: '', email: null, inviteId: 'vi_3' });
  });
});
