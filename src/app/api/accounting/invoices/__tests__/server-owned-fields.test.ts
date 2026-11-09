/**
 * ADR-ACC-003 §22 — η κατάσταση myDATA έχει ΕΝΑΝ γραφέα (τον διακομιστή).
 * Τα schemas είναι `.passthrough()`: χωρίς ρητό κόψιμο, ο πελάτης μπορούσε να δηλώσει `accepted`.
 */

import { UpdateInvoiceSchema, stripServerOwnedInvoiceFields } from '../invoice-schemas';

describe('stripServerOwnedInvoiceFields', () => {
  it('κόβει το mydata, κρατά τα υπόλοιπα', () => {
    const body = { notes: 'x', mydata: { status: 'accepted', mark: '400000000000001' } };
    expect(stripServerOwnedInvoiceFields(body)).toEqual({ notes: 'x' });
  });

  it('δεν αλλάζει το αρχικό αντικείμενο', () => {
    const body = { notes: 'x', mydata: { status: 'accepted' } };
    stripServerOwnedInvoiceFields(body);
    expect(body.mydata).toEqual({ status: 'accepted' });
  });

  it('το passthrough schema ΑΦΗΝΕΙ το mydata να περάσει — γι\' αυτό χρειάζεται το ρητό κόψιμο', () => {
    const parsed = UpdateInvoiceSchema.parse({ notes: 'x', mydata: { status: 'accepted' } });
    expect(parsed).toHaveProperty('mydata');
    expect(stripServerOwnedInvoiceFields(parsed)).not.toHaveProperty('mydata');
  });
});
