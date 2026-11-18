/**
 * ADR-ACC-030 §5.11 — ο ΕΝΑΣ κριτής «ποιο email πληρωτή έχει ο φάκελος»: τον ρωτούν η δημόσια όψη και η έναρξη πληρωμής.
 */

import { invoicePayerEmailOnFile } from '../invoice-payment-link';

const withEmail = (email: string | null) => ({
  customer: {
    contactId: null, name: 'ACME', vatNumber: null, taxOffice: null, address: null, city: null, postalCode: null,
    country: 'GR', email,
  },
});

describe('invoicePayerEmailOnFile', () => {
  it('έγκυρο email ⇒ αυτούσιο, χωρίς τα περιφερειακά κενά', () => {
    expect(invoicePayerEmailOnFile(withEmail('  pelatis@example.gr '))).toBe('pelatis@example.gr');
  });

  it('κενό / άκυρο / απόν ⇒ null (άγνωστο ⇒ η σελίδα ρωτά, όπως το Stripe Checkout)', () => {
    expect(invoicePayerEmailOnFile(withEmail(null))).toBeNull();
    expect(invoicePayerEmailOnFile(withEmail('   '))).toBeNull();
    expect(invoicePayerEmailOnFile(withEmail('not-an-email'))).toBeNull();
  });
});
