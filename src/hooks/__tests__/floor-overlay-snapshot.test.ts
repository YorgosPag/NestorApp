/**
 * @fileoverview **Ο ΦΡΟΥΡΟΣ ΙΣΟΤΗΤΑΣ ΤΩΝ ΠΕΡΙΓΡΑΜΜΑΤΩΝ** — δεν καταπίνει πραγματική εγγραφή (ADR-907 §11.3).
 * @related hooks/floor-overlay-snapshot · hooks/useFloorOverlays
 *
 *   Φ1 — ίδιο στιγμιότυπο (μόνο metadata) ⇒ «ίδιο», το state δεν αλλάζει;
 *   Φ2 — σύνδεση με ακίνητο: ίδιο `id`, ίδιο (απόν) `status`, νέο `updatedAt` ⇒ «άλλαξε»;
 *   Φ3 — προσθήκη, αφαίρεση, αλλαγή σειράς, αλλαγή `status` ⇒ «άλλαξε»;
 *   Φ4 — το `updatedAt` συγκρίνεται ως **στιγμή**, όχι ως ταυτότητα αντικειμένου;
 *
 * ⛔ **ΜΕΤΑΛΛΑΞΗ** *(προβλεπόμενη)*: αφαίρεση της σύγκρισης `updatedAt` από το `sameRow` ⇒ Φ2 κοκκινίζει — είναι
 *   ακριβώς το ελάττωμα που έκρυβε τη σύνδεση περιγράμματος από την οθόνη.
 */

import { isSameOverlaySnapshot, type OverlaySnapshotRow } from '@/hooks/floor-overlay-snapshot';

/** Στιγμή όπως τη δίνει ο Firestore client: αντικείμενο με `toDate()`, νέο σε κάθε στιγμιότυπο. */
const stamp = (seconds: number) => ({ seconds, nanoseconds: 0, toDate: () => new Date(seconds * 1000) });

const row = (id: string, updatedAtSeconds: number, status?: string): OverlaySnapshotRow => ({
  id,
  status,
  updatedAt: stamp(updatedAtSeconds),
});

describe('isSameOverlaySnapshot', () => {
  it('Φ1: ίδια περιγράμματα, ίδιες στιγμές ⇒ ίδιο', () => {
    expect(isSameOverlaySnapshot([row('a', 10), row('b', 20)], [row('a', 10), row('b', 20)])).toBe(true);
    expect(isSameOverlaySnapshot([], [])).toBe(true);
  });

  it('Φ2: σύνδεση με ακίνητο (μόνο το updatedAt προχώρησε) ⇒ άλλαξε', () => {
    expect(isSameOverlaySnapshot([row('a', 10), row('b', 20)], [row('a', 10), row('b', 21)])).toBe(false);
  });

  it('Φ3: προσθήκη · αφαίρεση · σειρά · status ⇒ άλλαξε', () => {
    const base = [row('a', 10), row('b', 20)];
    expect(isSameOverlaySnapshot(base, [...base, row('c', 30)])).toBe(false);
    expect(isSameOverlaySnapshot(base, [row('a', 10)])).toBe(false);
    expect(isSameOverlaySnapshot(base, [row('b', 20), row('a', 10)])).toBe(false);
    expect(isSameOverlaySnapshot(base, [row('a', 10), row('b', 20, 'sold')])).toBe(false);
  });

  it('Φ4: η στιγμή συγκρίνεται ως τιμή — και η απουσία της με απουσία', () => {
    expect(isSameOverlaySnapshot([{ id: 'a' }], [{ id: 'a' }])).toBe(true);
    expect(isSameOverlaySnapshot([{ id: 'a' }], [row('a', 10)])).toBe(false);
    expect(isSameOverlaySnapshot([{ id: 'a', updatedAt: 0 }], [{ id: 'a', updatedAt: 0 }])).toBe(true);
  });
});
