/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΜΕΤΑΦΡΑΣΗΣ RFC 7396 → Firestore** — `null` ⇒ `FieldValue.delete()` (ADR-249 §7.8).
 * @related lib/firestore/merge-patch-deletes · api/properties/[id]/property-patch-helpers ·
 *   lib/common-spaces/common-space-drawn-area.server
 *
 * 🔴 Με τον **πραγματικό** sentinel του Admin SDK, όχι ψεύτικο: ένα mock θα περνούσε και με λάθος σύμβολο (π.χ.
 * `serverTimestamp()`), και η εγγραφή θα έγραφε ώρα αντί να σβήσει.
 */

import { FieldValue } from 'firebase-admin/firestore';

import { documentAfterMergePatch, withMergePatchDeletes } from '../merge-patch-deletes';

const isDeleteSentinel = (value: unknown): boolean =>
  value instanceof FieldValue && value.isEqual(FieldValue.delete());

const onlyDescription = (field: string): boolean => field === 'description';

describe('Μ1 — `withMergePatchDeletes`', () => {
  it('χωρίς κριτή ⇒ ΚΑΘΕ `null` γίνεται διαγραφή (patch μόνο από πεδία-δηλώσεις)', () => {
    const written = withMergePatchDeletes({ drawnArea: null, area: null });
    expect(isDeleteSentinel(written.drawnArea)).toBe(true);
    expect(isDeleteSentinel(written.area)).toBe(true);
  });

  it('🔴 με κριτή ⇒ σβήνει ΜΟΝΟ ό,τι δηλώνει σβήσιμο· τα άλλα `null` μένουν αποθηκευμένα', () => {
    const written = withMergePatchDeletes({ description: null, floorId: null }, onlyDescription);
    expect(isDeleteSentinel(written.description)).toBe(true);
    expect(written.floorId).toBeNull();
  });

  it('τιμές περνούν αυτούσιες — `0`, `""`, `false`, `[]` ΔΕΝ είναι `null`', () => {
    const patch = { a: 0, b: '', c: false, d: [], e: { x: 1 } };
    expect(withMergePatchDeletes(patch)).toEqual(patch);
  });

  it('`undefined` δεν είναι «σβήσε» (RFC 7396: μόνο το `null`)', () => {
    expect(withMergePatchDeletes({ a: undefined })).toEqual({ a: undefined });
  });

  it('δεν αγγίζει την είσοδο', () => {
    const patch = { drawnArea: null };
    withMergePatchDeletes(patch);
    expect(patch).toEqual({ drawnArea: null });
  });
});

describe('Μ2 — `documentAfterMergePatch`: ίδια απόφαση με την εγγραφή', () => {
  const EXISTING = { description: 'Παλιά', floorId: 'flr_1', name: 'Δ1' };

  it('🔴 τα σβησμένα ΛΕΙΠΟΥΝ — όπως στο Firestore μετά το `FieldValue.delete()`', () => {
    const after = documentAfterMergePatch(EXISTING, { description: null }, onlyDescription);
    expect(after).toEqual({ floorId: 'flr_1', name: 'Δ1' });
  });

  it('`null` εκτός κριτή μένει `null` — ίδιο με την εγγραφή', () => {
    expect(documentAfterMergePatch(EXISTING, { floorId: null }, onlyDescription)).toMatchObject({ floorId: null });
  });

  it('συγχώνευση: νέα τιμή κερδίζει, ό,τι δεν στάλθηκε μένει, το αποθηκευμένο δεν αλλάζει', () => {
    const snapshot = { ...EXISTING };
    expect(documentAfterMergePatch(EXISTING, { name: 'Δ2' })).toEqual({ ...EXISTING, name: 'Δ2' });
    expect(EXISTING).toEqual(snapshot);
  });
});
