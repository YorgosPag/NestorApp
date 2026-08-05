/**
 * @fileoverview Η επιμονή των εγκεκριμένων συνδέσεων πινακίδας (ADR-745 Φ3β, Τομέας Γ).
 *
 * **Ο κύκλος ζωής έχει ΕΝΑΝ κάτοχο** (§10 #7): αυτή η υπηρεσία. Καμία άλλη διαδρομή δεν γράφει
 * στο `title_block_bindings`, και καμία εγγραφή δεν γίνεται χωρίς ρητό κλικ ανθρώπου (§5.1).
 *
 * Πρότυπο: `contact-link.service.ts` — ίδιοι φύλακες εισόδου, ίδια τοποθέτηση του `companyId`
 * **πρώτου** στο query. Ο λόγος είναι μετρημένος και όχι στιλιστικός: **τα rules δεν είναι
 * φίλτρα** (§9.5) — ένα list που αφήνει ελεύθερο το πεδίο που διαβάζει ο κανόνας απορρίπτεται
 * **ολόκληρο**, όχι κουτσουρεμένο.
 *
 * @module services/title-block-binding.service
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { titleBlockBindingConverter } from '@/lib/firestore/converters/title-block-binding.converter';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { TitleBlockBinding } from '@/types/title-block-binding';

const logger = createModuleLogger('TitleBlockBindingService');

export type SaveBindingResult =
  | { readonly success: true; readonly bindingId: string; readonly supersededIds: readonly string[] }
  | { readonly success: false; readonly error: string; readonly errorCode: string };

export interface ListBindingsParams {
  readonly companyId: string;
  readonly fileRecordId: string;
  readonly levelId: string;
  readonly status?: TitleBlockBinding['status'];
}

/**
 * Οι ενεργές (και ιστορικές) συνδέσεις ενός σχεδίου.
 *
 * 🔒 Το `companyId` είναι **πρώτο** constraint και **υποχρεωτικό**: η κλήση χωρίς μισθωτή δεν
 * μεταγλωττίζεται, και αν κάποιος τη ζορίσει σκάει εδώ αντί να πάρει permission-denied που
 * μοιάζει με «δεν βρέθηκε τίποτα».
 */
export async function listTitleBlockBindings(
  params: ListBindingsParams,
): Promise<TitleBlockBinding[]> {
  const { companyId, fileRecordId, levelId, status } = params;
  if (!companyId) {
    throw new Error('listTitleBlockBindings: companyId is required for tenant isolation');
  }

  const constraints: QueryConstraint[] = [
    where(FIELDS.COMPANY_ID, '==', companyId),
    where('fileRecordId', '==', fileRecordId),
    where('levelId', '==', levelId),
  ];
  if (status) constraints.push(where(FIELDS.STATUS, '==', status));
  constraints.push(orderBy('confirmedAt', 'desc'));

  // ⚠️ Ο converter μπαίνει στο **αποτέλεσμα** του `query(...)`, όχι στο `collection(...)` — και
  // αυτό ΔΕΝ είναι στιλ. Ο σαρωτής του CHECK 3.35 λύνει τη συλλογή κοιτώντας τα **ορίσματα** του
  // πρώτου ορίσματος (`firestore-tenant-scope-scan.js:269-274`)· τυλιγμένο σε `.withConverter(…)`
  // το `collection(db, COLLECTIONS.X)` μετακομίζει στην *έκφραση* της πρόσβασης ιδιότητας, όπου
  // δεν κοιτάζει κανείς ⇒ κατάταξη **`unanalyzable`**, δηλαδή «η πύλη πέρασε χωρίς να δει».
  // Μετρημένο: με το `contact-link.service.ts:192` ιδίωμα η κατάταξη είναι `unanalyzable`· έτσι
  // γίνεται `ok`. Το ADR-745 §Γ8 το ζητά ρητά — «πέρασε η πύλη» δεν είναι απόδειξη.
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.TITLE_BLOCK_BINDINGS), ...constraints).withConverter(
      titleBlockBindingConverter,
    ),
  );
  return snapshot.docs.map((d) => d.data());
}

export async function getTitleBlockBindingById(id: string): Promise<TitleBlockBinding | null> {
  const ref = doc(db, COLLECTIONS.TITLE_BLOCK_BINDINGS, id).withConverter(titleBlockBindingConverter);
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? snapshot.data() : null;
}

/**
 * Ποια ενεργά bindings καταλαμβάνουν **την ίδια θέση** με αυτό που γράφεται τώρα.
 *
 * 🔴 Η εμβέλεια είναι το **slot**, όχι το κελί. Ένα κελί δίνει πολλές νόμιμες συνδέσεις (δύο
 * μελετητές, τρεις ενότητες θέσης)· εμβέλεια κελιού θα μαρκάριζε `superseded` τον μελετητή #1
 * μόλις εγκρινόταν ο #2.
 *
 * Το φιλτράρισμα γίνεται **στη μνήμη** πάνω στη λίστα του σχεδίου, που η παλέτα ήδη χρειάζεται:
 * ένα δεύτερο composite index για ένα ερώτημα που εξυπηρετείται από δεδομένα ήδη στο χέρι θα
 * κόστιζε σε **κάθε** εγγραφή της συλλογής.
 */
function sameSlotActive(
  existing: readonly TitleBlockBinding[],
  binding: TitleBlockBinding,
): TitleBlockBinding[] {
  return existing.filter(
    (b) =>
      b.status === 'active' &&
      b.id !== binding.id &&
      b.slot === binding.slot &&
      b.fieldKey === binding.fieldKey &&
      b.sourceHandle === binding.sourceHandle,
  );
}

/**
 * Γράφει την έγκριση και **αποσύρει** ό,τι κατείχε την ίδια θέση.
 *
 * `superseded` αντί για διαγραφή: μια λάθος έγκριση είναι **γεγονός που συνέβη**, και η βάση
 * οφείλει να μπορεί να εξηγήσει γιατί κάποια στιγμή έλεγε κάτι άλλο. Ίδια αρχή με το `withdrawn`
 * της Φ3α.
 *
 * ⚠️ Η απόσυρση γίνεται **μετά** την επιτυχή εγγραφή του νέου. Ανάποδα, μια αποτυχία θα άφηνε τη
 * θέση **κενή** — δηλαδή θα έσβηνε provenance χωρίς να τη αντικαταστήσει.
 */
export async function saveTitleBlockBinding(
  binding: TitleBlockBinding,
  existingForDrawing: readonly TitleBlockBinding[],
): Promise<SaveBindingResult> {
  try {
    // 🔒 Fail εδώ, όχι στα rules: ο κανόνας CREATE απαιτεί και τα δύο, και μια σιωπηλή κενή τιμή
    // θα επέστρεφε permission-denied που μοιάζει με σφάλμα δικτύου (ADR-745 §13(ι)).
    if (!binding.companyId) {
      return { success: false, error: 'companyId is required', errorCode: 'MISSING_TENANT' };
    }
    if (!binding.confirmedBy) {
      return { success: false, error: 'confirmedBy is required', errorCode: 'MISSING_CREATOR' };
    }

    const ref = doc(db, COLLECTIONS.TITLE_BLOCK_BINDINGS, binding.id).withConverter(
      titleBlockBindingConverter,
    );
    await setDoc(ref, binding);

    const superseded = sameSlotActive(existingForDrawing, binding);
    for (const stale of superseded) {
      await updateDoc(doc(db, COLLECTIONS.TITLE_BLOCK_BINDINGS, stale.id), {
        status: 'superseded',
      });
    }

    logger.info(`Saved title-block binding ${binding.id}`, { superseded: superseded.length });
    return { success: true, bindingId: binding.id, supersededIds: superseded.map((b) => b.id) };
  } catch (error) {
    logger.error('Failed to save title-block binding:', error);
    return { success: false, error: getErrorMessage(error), errorCode: 'SAVE_BINDING_FAILED' };
  }
}
