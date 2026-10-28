/**
 * @fileoverview Ταυτότητα προμηθευτή μιας προσφοράς (ADR-327 §8.5 Γ).
 *
 * Κ1 σειρά πηγών: επαφή → στιγμιότυπο πρόσκλησης → σάρωση → `null` (ποτέ ωμό id) · κενά κείμενα δεν μετρούν ·
 * Κ2 ενεργός στο ιστορικό: `vendor:{contactId}` ή, χωρίς επαφή, `vendor:invite:{inviteId}` — ποτέ σκέτο `vendor:` ·
 * Κ3 στιγμιότυπο από την πρόσκληση: όνομα → (χωρίς όνομα) email · ποτέ `undefined`.
 * Κ4 ετικέτα οθόνης: όνομα, αλλιώς «άγνωστος» (+ αριθμός προσφοράς όταν δοθεί) — ποτέ κενό, ποτέ ωμό id ·
 * Κ5 προσφώνηση email: όνομα, αλλιώς ουδέτερη — ποτέ «άγνωστος» ούτε αριθμός · Κ6 email: πρόσκληση → σάρωση.
 */

import type { TFunction } from 'i18next';
import type { Quote } from '../../types/quote';
import {
  quoteLacksVendorContact,
  quoteVendorAddressee,
  quoteVendorDisplayName,
  quoteVendorEmail,
  quoteVendorLabel,
  quoteVendorLabelsById,
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

/** Ο stub επιστρέφει «κλειδί» ή «κλειδί|αριθμός» — η δοκιμή βλέπει ΠΟΙΟ κλειδί ζητήθηκε και με ΤΙ. */
const t = ((key: string, opts?: { quote?: string }) => (opts?.quote ? `${key}|${opts.quote}` : key)) as unknown as TFunction;

describe('quoteVendorLabel', () => {
  it('Κ4 — όνομα, αλλιώς «άγνωστος» με/χωρίς αριθμό· ποτέ κενό', () => {
    expect(quoteVendorLabel(' Άλφα ', t, 'QT-0001')).toBe('Άλφα');
    expect(quoteVendorLabel(null, t, 'QT-0001')).toBe('quotes.vendorUnknownWithQuote|QT-0001');
    expect(quoteVendorLabel('  ', t, 'QT-0001')).toBe('quotes.vendorUnknownWithQuote|QT-0001');
    expect(quoteVendorLabel(undefined, t)).toBe('quotes.vendorUnknown');
    expect(quoteVendorLabel(null, t, ' ')).toBe('quotes.vendorUnknown');
  });
});

describe('quoteVendorAddressee', () => {
  it('Κ5 — όνομα, αλλιώς ουδέτερη προσφώνηση', () => {
    expect(quoteVendorAddressee('Άλφα', t)).toBe('Άλφα');
    expect(quoteVendorAddressee(null, t)).toBe('quotes.vendorAddresseeFallback');
  });
});

describe('quoteVendorEmail', () => {
  const emails = (list: string[]) => ({ vendorEmails: { value: list, confidence: 90 } }) as unknown as Quote['extractedData'];
  it('Κ6 — πρόσκληση → σάρωση → null', () => {
    expect(quoteVendorEmail({ vendorSnapshot: snapshot, extractedData: emails(['scan@x.gr']) })).toBe('b@example.invalid');
    expect(quoteVendorEmail({ vendorSnapshot: null, extractedData: emails(['scan@x.gr']) })).toBe('scan@x.gr');
    expect(quoteVendorEmail({ vendorSnapshot: { ...snapshot, email: null }, extractedData: null })).toBeNull();
  });
});

describe('quoteVendorLabelsById (§8.5.4 — ετικέτες μοναδικές μέσα στη σύγκριση)', () => {
  const tt = ((key: string, o?: { vendor?: string; quote?: string }) =>
    [key, o?.vendor, o?.quote].filter(Boolean).join('|')) as unknown as TFunction;

  it('ίδιο όνομα σε δύο προσφορές ⇒ + αριθμός · μοναδικό όνομα ⇒ σκέτο · άγνωστος ⇒ ο κανόνας του quoteVendorLabel', () => {
    const labels = quoteVendorLabelsById([
      { quoteId: 'a', vendorName: 'Προμηθευτής Β', displayNumber: 'QT-0002' },
      { quoteId: 'b', vendorName: ' Προμηθευτής Β ', displayNumber: 'QT-0003' },
      { quoteId: 'c', vendorName: 'Άλφα', displayNumber: 'QT-0004' },
      { quoteId: 'd', vendorName: null, displayNumber: 'QT-0001' },
    ], tt);
    expect(labels.get('a')).toBe('quotes.vendorWithQuote|Προμηθευτής Β|QT-0002');
    expect(labels.get('b')).toBe('quotes.vendorWithQuote|Προμηθευτής Β|QT-0003');
    expect(labels.get('c')).toBe('Άλφα');
    expect(labels.get('d')).toBe('quotes.vendorUnknownWithQuote|QT-0001');
    expect(new Set(labels.values()).size).toBe(4);
  });
});
