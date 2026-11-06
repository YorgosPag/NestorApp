/**
 * ADR-930 §3.8 — ο κανόνας μεταβίβασης κατόχου `planOwnerTransfer` (καθαρός πυρήνας).
 */

import {
  normalizeTransferNote,
  OWNER_OWNED_FIELDS,
  OWNER_TRANSFER_NOTE_MAX,
  planOwnerTransfer,
} from '../opportunity-owner-transfer';

const owned = { companyId: 'c', createdBy: 'u-author', assignedTo: 'u-seller' };

describe('planOwnerTransfer', () => {
  it('εφαρμογή: ο κάτοχος που είδε ο άνθρωπος είναι ο τρέχων', () => {
    expect(planOwnerTransfer(owned, { expectedOwnerUid: 'u-seller', newOwnerUid: 'u-next', note: '  καλεί Τρίτη  ' }))
      .toEqual({ kind: 'apply', previousOwnerUid: 'u-seller', newOwnerUid: 'u-next', note: 'καλεί Τρίτη' });
  });

  it('χωρίς ανατεθειμένο, κάτοχος είναι ο δημιουργός', () => {
    const plan = planOwnerTransfer({ ...owned, assignedTo: '' }, { expectedOwnerUid: 'u-author', newOwnerUid: 'u-next' });
    expect(plan).toEqual({ kind: 'apply', previousOwnerUid: 'u-author', newOwnerUid: 'u-next', note: null });
  });

  it('CAS: την άλλαξε κάποιος στο μεταξύ ⇒ σύγκρουση με τον ΤΡΕΧΟΝΤΑ κάτοχο', () => {
    expect(planOwnerTransfer(owned, { expectedOwnerUid: 'u-author', newOwnerUid: 'u-next' }))
      .toEqual({ kind: 'conflict', currentOwnerUid: 'u-seller' });
  });

  it('η σύγκρουση κρίνεται ΠΡΙΝ την ιδεμπότητα — παλιά εικόνα δεν λέγεται «έγινε»', () => {
    expect(planOwnerTransfer(owned, { expectedOwnerUid: 'u-author', newOwnerUid: 'u-seller' }).kind).toBe('conflict');
  });

  it('ιδεμπότητα: ίδιος στόχος ⇒ unchanged', () => {
    expect(planOwnerTransfer(owned, { expectedOwnerUid: 'u-seller', newOwnerUid: 'u-seller' }))
      .toEqual({ kind: 'unchanged', ownerUid: 'u-seller' });
  });

  it('έγγραφο χωρίς κάτοχο: αναμενόμενος `null` (ή κενό) ταιριάζει', () => {
    const none = { companyId: 'c' };
    expect(planOwnerTransfer(none, { expectedOwnerUid: null, newOwnerUid: 'u-next' }).kind).toBe('apply');
    expect(planOwnerTransfer(none, { expectedOwnerUid: '', newOwnerUid: 'u-next' }).kind).toBe('apply');
  });

  it('άκυρα αιτήματα', () => {
    expect(planOwnerTransfer(owned, { expectedOwnerUid: 'u-seller', newOwnerUid: '  ' }))
      .toEqual({ kind: 'invalid', reason: 'owner_required' });
    const long = 'α'.repeat(OWNER_TRANSFER_NOTE_MAX + 1);
    expect(planOwnerTransfer(owned, { expectedOwnerUid: 'u-seller', newOwnerUid: 'u-next', note: long }))
      .toEqual({ kind: 'invalid', reason: 'note_too_long' });
  });

  it('σημείωμα: κενό ή μόνο κενά ⇒ `null`', () => {
    expect(normalizeTransferNote('   ')).toBeNull();
    expect(normalizeTransferNote(undefined)).toBeNull();
  });

  it('τα πεδία ιδιοκτησίας: κάτοχος · δημιουργός · σημείωμα παράδοσης', () => {
    expect([...OWNER_OWNED_FIELDS].sort()).toEqual(['assignedTo', 'createdBy', 'ownerHandoffNote']);
  });
});
