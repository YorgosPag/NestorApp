/**
 * `lib/firestore/doc-id` — ποια ταυτότητα μπορεί να διευθυνσιοδοτήσει έγγραφο.
 *
 * @module lib/firestore/__tests__/doc-id
 */

import { isAddressableDocId } from '../doc-id';
import { DRAFT_ENTITY_ID } from '@/lib/draft-entity-id';

describe('isAddressableDocId', () => {
  it.each(['proj_abc123', 'a', 'comp_9f.x-1', 'Έργο-1', '__half', 'half__'])('«%s» ⇒ έγκυρη', (id) => {
    expect(isAddressableDocId(id)).toBe(true);
  });

  it.each(['', '.', '..', 'a/b', '/', '__new__', '__name__', '____'])('«%s» ⇒ άκυρη', (id) => {
    expect(isAddressableDocId(id)).toBe(false);
  });

  it.each([null, undefined, 42, {}])('μη αλφαριθμητικό (%p) ⇒ άκυρο', (id) => {
    expect(isAddressableDocId(id)).toBe(false);
  });

  it('το όριο είναι 1.500 BYTES, όχι χαρακτήρες', () => {
    expect(isAddressableDocId('a'.repeat(1500))).toBe(true);
    expect(isAddressableDocId('a'.repeat(1501))).toBe(false);
    // 751 ελληνικά γράμματα = 1.502 bytes UTF-8.
    expect(isAddressableDocId('α'.repeat(751))).toBe(false);
  });

  it('🔴 η ψευδο-ταυτότητα του «Fill then Create» ΔΕΝ είναι ποτέ διευθυνσιοδοτήσιμη', () => {
    // Αν αλλάξει κάποτε η σταθερά σε μη δεσμευμένη μορφή, ο server θα έπαυε να την αρνείται.
    expect(isAddressableDocId(DRAFT_ENTITY_ID)).toBe(false);
  });
});
