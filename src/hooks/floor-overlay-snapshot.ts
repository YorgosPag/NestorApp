/**
 * @fileoverview **«ΑΛΛΑΞΕ ΚΑΤΙ ΣΕ ΑΥΤΟ ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΠΕΡΙΓΡΑΜΜΑΤΩΝ;»** — ο φρουρός ισότητας του `useFloorOverlays`.
 * @related hooks/useFloorOverlays · ADR-040 Phase XVIII (ο λόγος που υπάρχει φρουρός) · ADR-907 §11.3 (το περιστατικό)
 * @module hooks/floor-overlay-snapshot
 *
 * Ο ακροατής παραδίδει και στιγμιότυπα όπου **δεν άλλαξε τίποτα** (μόνο metadata)· αν καθένα γινόταν νέο state, κάθε
 * `useMemo` από κάτω θα ξανάτρεχε. Γι' αυτό υπάρχει φρουρός.
 *
 * 🔴 **Ο φρουρός σύγκρινε ΜΟΝΟ `id` + `status`** — και η πόρτα ενημέρωσης **δεν γράφει** `status`. Άρα κάθε αλλαγή σε
 * `linked`, `label`, `role` ή γεωμετρία ήταν, για τον φρουρό, «τίποτα»: η σύνδεση περιγράμματος με ακίνητο γραφόταν
 * στη βάση και η οθόνη έμενε στο «— Κανένα —» ώσπου να ξαναφορτωθεί η σελίδα (μετρημένο 2026-10-10).
 *
 * 🔑 **Το σήμα «έγινε πραγματική εγγραφή» είναι το `updatedAt`**: κάθε πόρτα το γράφει με `serverTimestamp()`, και ένα
 * στιγμιότυπο μόνο-metadata δεν το αγγίζει. Έτσι ο φρουρός δεν χρειάζεται λίστα πεδίων που θα παλιώσει στο επόμενο.
 *
 * ⚠️ **Καθαρό module** — κανένα React, κανένα Firestore.
 */

import { normalizeToMillisOrNull } from '@/lib/date-local';

/** Ό,τι χρειάζεται ο φρουρός από ένα περίγραμμα. */
export interface OverlaySnapshotRow {
  readonly id: string;
  readonly status?: string;
  readonly updatedAt?: unknown;
}

function sameRow(a: OverlaySnapshotRow, b: OverlaySnapshotRow): boolean {
  return (
    a.id === b.id &&
    a.status === b.status &&
    normalizeToMillisOrNull(a.updatedAt) === normalizeToMillisOrNull(b.updatedAt)
  );
}

/** `true` ⇒ το νέο στιγμιότυπο λέει ό,τι και το προηγούμενο, και το state **δεν** αλλάζει. */
export function isSameOverlaySnapshot(
  previous: ReadonlyArray<OverlaySnapshotRow>,
  next: ReadonlyArray<OverlaySnapshotRow>,
): boolean {
  if (previous.length !== next.length) return false;
  return next.every((row, index) => sameRow(previous[index], row));
}
