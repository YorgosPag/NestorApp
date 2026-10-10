/**
 * @fileoverview **Ο συνοδός της επεξεργασίας ορόφου** — η κρίση μοναδικότητας μέσα στη συναλλαγή του `withVersionCheck`.
 * @module api/floors/floor-slot-companion
 * @see ./floor-stack-authority — το σύνορο · @see services/building-spaces/space-placement.server — το ίδιο πρότυπο συνοδού
 *
 * 🔑 Ο όροφος και το κλειδί της στοίβας γράφονται **μαζί** ή **καθόλου**: ο έλεγχος έκδοσης, η κρίση και η εγγραφή
 * είναι μία συναλλαγή. Ως τις 2026-10-10 η κρίση γινόταν **πριν** από τη συναλλαγή, σε χωριστή ανάγνωση.
 *
 * 🔑 Κρίνεται **μόνο ό,τι αλλάζει** (απέναντι στο φρέσκο έγγραφο): αλλαγή ύψους σε όροφο που ήδη μετέχει σε παλαιά
 * σύγκρουση δεν μπλοκάρεται — αλλιώς ένα κτίριο με διπλότυπο θα πάγωνε ολόκληρο. Και όταν δεν αλλάζει ούτε θέση
 * ούτε όνομα, ο συνοδός **δεν αγγίζει** το κλειδί: η αυτόματη αποθήκευση δεν σειριοποιεί το κτίριο χωρίς λόγο.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import {
  normalizeFloorName,
  type FloorSlotCandidate,
  type FloorSlotChecks,
} from '@/lib/floor/floor-stack-integrity';
import type { VersionedCompanion } from '@/types/versioning';
import { isFloorKind } from '@/utils/floor-naming';
import { assertFloorSlotFree } from './floor-slot';
import { openFloorStack, requireFloorStackOwner } from './floor-stack-authority';

type FloorRecord = Readonly<Record<string, unknown>>;

/** Ποιες όψεις της θέσης αλλάζουν **όντως** — η ίδια τιμή ξανασταλμένη δεν είναι αλλαγή. */
export function changedSlotChecks(before: FloorRecord, updates: FloorRecord): FloorSlotChecks {
  const differs = (field: 'number' | 'kind') => updates[field] !== undefined && updates[field] !== before[field];
  return {
    slot: differs('number') || differs('kind'),
    name: updates.name !== undefined && normalizeFloorName(updates.name) !== normalizeFloorName(before.name),
  };
}

/** Ο όροφος όπως **θα είναι** μετά την εγγραφή. `null` ⇒ δεν έχει αριθμό, άρα δεν πιάνει θέση. */
function candidateAfter(before: FloorRecord, updates: FloorRecord): FloorSlotCandidate | null {
  const after = { ...before, ...updates };
  if (typeof after.number !== 'number') return null;
  return {
    number: after.number,
    kind: isFloorKind(after.kind) ? after.kind : undefined,
    name: typeof after.name === 'string' ? after.name : null,
  };
}

/**
 * Ο συνοδός για το `withVersionCheck` του `PATCH /api/floors`.
 *
 * @throws {ApiError} 409 `FLOOR_*_TAKEN` (μέσα στη συναλλαγή ⇒ δεν γράφεται τίποτα) · 422 `FLOOR_OWNER_MISSING`
 */
export function floorSlotCompanion(
  db: Firestore,
  floorId: string,
  updates: FloorRecord,
  userId: string,
): VersionedCompanion {
  return async (transaction, before) => {
    const checks = changedSlotChecks(before, updates);
    const candidate = checks.slot || checks.name ? candidateAfter(before, updates) : null;
    if (candidate === null) return () => undefined;

    const owner = requireFloorStackOwner(before);
    const stack = await openFloorStack(transaction, db, owner, userId);
    assertFloorSlotFree(stack.rows, candidate, owner.buildingId, checks, floorId);
    return (writeTransaction) => stack.seal(writeTransaction);
  };
}
