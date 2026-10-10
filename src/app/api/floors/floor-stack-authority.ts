/**
 * @fileoverview **Η ΑΡΧΗ ΤΗΣ ΣΤΟΙΒΑΣ ΟΡΟΦΩΝ** — το ΕΝΑ σύνορο από το οποίο περνά κάθε αλλαγή που μπορεί να
 * παραβιάσει τη μοναδικότητα ορόφου ανά κτίριο (γέννηση · αριθμός/είδος/όνομα · διαγραφή · επανατοποθέτηση).
 * @module api/floors/floor-stack-authority
 * @see lib/floor/floor-stack-integrity — ο κανόνας (καθαρός)
 * @see ./floor-slot — η άρνηση (`409` με `errorCode`)
 *
 * 🔴 **Η ΒΛΑΒΗ ΠΟΥ ΚΛΕΙΝΕΙ (2026-10-10)**: ο κανόνας μοναδικότητας ήταν «διάβασε τα αδέλφια, μετά γράψε» — δύο
 * βήματα, καμία συναλλαγή. Δύο σχεδόν ταυτόχρονα αιτήματα περνούσαν και τα δύο τον έλεγχο και έγραφαν και τα δύο.
 * Και μια σκέτη συναλλαγή **δεν** αρκεί: το κλείδωμα ενός ερωτήματος στο Firestore καλύπτει μόνο τα έγγραφα που
 * **επέστρεψε** — όχι ένα νέο που αρχίζει να ταιριάζει (phantom).
 *
 * 🔑 **Η ΛΥΣΗ — σειριοποίηση πάνω σε ΕΝΑ έγγραφο σταθερού κλειδιού**: `floor_stack_locks/{buildingId}`. Κάθε αλλαγή
 * το **διαβάζει με id** και το **ξαναγράφει** (`rev + 1`) στην ίδια συναλλαγή με τους ορόφους. Δύο ταυτόχρονες
 * αλλαγές στο ίδιο κτίριο συγκρούονται εκεί ⇒ η μία ξανατρέχει, ξαναδιαβάζει τη στοίβα και κρίνεται εκ νέου.
 *
 * 🏆 **Γιατί κλειδί και όχι «κράτηση θέσης» ανά αριθμό**: οι κρατήσεις είναι παράγωγο αντίγραφο της στοίβας — δεύτερη
 * αλήθεια που αποκλίνει (ένας όροφος γραμμένος απευθείας στη βάση δεν έχει κράτηση, άρα θα ήταν αόρατος). Εδώ
 * κρίνονται οι **πραγματικοί** όροφοι· το κλειδί δεν κρατά τίποτα πέρα από τον μετρητή του.
 *
 * ⚠️ **Καμία παρενέργεια μέσα στο `work`**: μια συναλλαγή ξανατρέχει σε σύγκρουση. Ιστορικό (ADR-195), cache και
 * ειδοποιήσεις γράφονται **μετά** το commit (δόγμα `project-birth.ts`).
 */

import 'server-only';

import { FieldValue, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { floorStackQuery, toFloorStack, type FloorStack } from './_shared/floor-stack-rows';

/** Ποιανού στοίβα: το κτίριο και ο ενοικιαστής **του κτιρίου** (όχι του καλούντος — ο υπερδιαχειριστής γράφει σε ξένο). */
export interface FloorStackOwner {
  readonly buildingId: string;
  readonly companyId: string;
}

/** Το `errorCode` της άρνησης όταν ένας όροφος δεν έχει κτίριο ή ενοικιαστή — δεν υπάρχει στοίβα να κριθεί. */
export const FLOOR_OWNER_MISSING = 'FLOOR_OWNER_MISSING';

/** Ο κάτοχος της στοίβας από ένα έγγραφο ορόφου, ή `null` όταν το έγγραφο δεν τον δηλώνει. */
export function floorStackOwnerOf(floor: Readonly<Record<string, unknown>>): FloorStackOwner | null {
  const { buildingId, companyId } = floor;
  if (typeof buildingId !== 'string' || buildingId === '') return null;
  if (typeof companyId !== 'string' || companyId === '') return null;
  return { buildingId, companyId };
}

/**
 * Ο κάτοχος, ή **ρητή άρνηση**. Ως τις 2026-10-10 η δημιουργία έλεγε `if (typeof ownerCompanyId === 'string')` και,
 * όταν το κτίριο δεν είχε ενοικιαστή, **παρέλειπε σιωπηλά** τον κανόνα μοναδικότητας και έγραφε.
 *
 * @throws {ApiError} 422 `FLOOR_OWNER_MISSING`
 */
export function requireFloorStackOwner(floor: Readonly<Record<string, unknown>>): FloorStackOwner {
  const owner = floorStackOwnerOf(floor);
  if (owner === null) {
    throw new ApiError(422, 'Floor has no owning building or company — its stack cannot be judged', FLOOR_OWNER_MISSING);
  }
  return owner;
}

/** Η στοίβα όπως διαβάστηκε **μέσα** στη συναλλαγή, μαζί με τη σφράγιση του κλειδιού της. */
export interface OpenFloorStack extends FloorStack {
  /** Ανεβάζει το `rev` του κλειδιού. Καλείται **μία** φορά, μαζί με τις εγγραφές — χωρίς αυτό δεν υπάρχει κλείδωμα. */
  seal(transaction: Transaction): void;
}

/** Το κλειδί της στοίβας ενός κτιρίου — σταθερό id, όχι οντότητα (βλ. `COLLECTIONS.FLOOR_STACK_LOCKS`). */
export function floorStackLockRef(db: Firestore, buildingId: string): DocumentReference {
  return db.collection(COLLECTIONS.FLOOR_STACK_LOCKS).doc(buildingId);
}

/**
 * Ανοίγει τη στοίβα **μέσα σε υπάρχουσα συναλλαγή**: κλειδί (με id) → όροφοι (ερώτημα). Για όποιον έχει ήδη δική του
 * συναλλαγή (ο συνοδός του `withVersionCheck`)· όλοι οι άλλοι καλούν το {@link withFloorStack}.
 *
 * ⚠️ Όλες οι αναγνώσεις του καλούντος πρέπει να έχουν γίνει **πριν** από την πρώτη εγγραφή (κανόνας Firestore).
 */
export async function openFloorStack(
  transaction: Transaction,
  db: Firestore,
  owner: FloorStackOwner,
  userId: string,
): Promise<OpenFloorStack> {
  const lockRef = floorStackLockRef(db, owner.buildingId);
  const lock = await transaction.get(lockRef);
  const stack = toFloorStack(await transaction.get(floorStackQuery(db, owner.buildingId, owner.companyId)));
  const rev: unknown = lock.data()?.rev;
  const nextRev = (typeof rev === 'number' ? rev : 0) + 1;
  return {
    ...stack,
    seal: (writeTransaction) => {
      writeTransaction.set(lockRef, {
        buildingId: owner.buildingId,
        companyId: owner.companyId,
        rev: nextRev,
        updatedBy: userId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    },
  };
}

/**
 * **Μία αλλαγή της στοίβας, ατομικά**: το `work` βλέπει τους πραγματικούς ορόφους, κρίνει και γράφει· το κλειδί
 * σφραγίζεται μαζί. Αν το `work` ρίξει (π.χ. `409`), δεν γράφεται τίποτα.
 */
export function withFloorStack<T>(
  db: Firestore,
  owner: FloorStackOwner,
  userId: string,
  work: (transaction: Transaction, stack: FloorStack) => T | Promise<T>,
): Promise<T> {
  return db.runTransaction(async (transaction) => {
    const stack = await openFloorStack(transaction, db, owner, userId);
    const result = await work(transaction, stack);
    stack.seal(transaction);
    return result;
  });
}
