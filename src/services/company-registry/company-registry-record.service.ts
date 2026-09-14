/**
 * @fileoverview **Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΓΕΜΗ, ΑΠΟΘΗΚΕΥΜΕΝΗ** — `company_registry_records/{companyId}` (ADR-841 §7 Α23).
 * @module services/company-registry/company-registry-record.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΣΥΛΛΟΓΗ ΚΑΙ ΟΧΙ ΤΟ ΠΡΟΦΙΛ ΤΗΣ ΕΤΑΙΡΕΙΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το προφίλ (`accounting_settings/{companyId}`, ADR-439) είναι η **δήλωση** του οργανισμού και
 * το γράφει ο **πελάτης** (company admin). Η απάντηση της **αρχής** εκεί θα ήταν αυτο-επαλήθευση:
 * ένα `setDoc` από τον browser και η βιτρίνα θα έγραφε «επαληθευμένη από ΓΕΜΗ». Εδώ γράφει
 * **μόνο** ο διακομιστής (`firestore.rules`: `deny_all`).
 *
 * 🔑 **Δήλωση ≠ απάντηση**, όπως στο Stripe (`company.name` που δηλώνεις ≠ αυτό που βρήκε ο
 * έλεγχος). Το «επαληθευμένη;» **δεν αποθηκεύεται**: κρίνεται στην ανάγνωση από το ζεύγος.
 *
 * ⚠️ **Δικαίωμα διαγραφής** (GDPR άρθ. 17): {@link forgetRegistryCheck}. Το αντίγραφο δεν έχει
 * άλλο λόγο ύπαρξης πέρα από την επαλήθευση της βιτρίνας.
 *
 * **Layering**: service — Admin SDK, ανάγνωση/γραφή κατά ταυτότητα, **καμία** σάρωση.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  RegistryCheck,
  RegistryCheckRead,
  RegistryCompanyRecord,
} from '@/types/company-registry';

import { parseStoredRegistryRecord } from './gemi-opendata-parse';

const logger = createModuleLogger('company-registry-record.service');

function recordRef(adminDb: AdminFirestore, companyId: string) {
  return adminDb.collection(COLLECTIONS.COMPANY_REGISTRY_RECORDS).doc(companyId);
}

/**
 * Αποθηκεύει την απάντηση — **ολόκληρη αντικατάσταση**, ποτέ συγχώνευση: πεδίο που το μητρώο
 * **έπαψε** να δίνει (π.χ. αφαιρέθηκε διακριτικός τίτλος) δεν επιτρέπεται να επιζήσει από την
 * προηγούμενη ερώτηση.
 */
export async function recordRegistryCheck(
  adminDb: AdminFirestore,
  companyId: string,
  record: RegistryCompanyRecord,
  checkedAt: string = nowISO(),
): Promise<RegistryCheck> {
  await recordRef(adminDb, companyId).set({ companyId, checkedAt, record });
  return { record, checkedAt };
}

/** Το έγγραφο του αντιγράφου — εκτεθειμένο ώστε η βιτρίνα να το διαβάζει **μέσα** σε συναλλαγή. */
export function registryRecordRef(adminDb: AdminFirestore, companyId: string) {
  return recordRef(adminDb, companyId);
}

/**
 * **Ο φρουρός του αποθηκευμένου αντιγράφου**, πάνω σε ήδη διαβασμένο στιγμιότυπο — ένας αναγνώστης
 * για την απλή ανάγνωση **και** για τη συναλλαγή της βιτρίνας (ADR-841 §7 Α23).
 *
 * ⚠️ Σκουπίδι ⇒ `unavailable`, **ποτέ** `absent`: «δεν ρωτήθηκε» θα έλεγε στον άνθρωπο να ξαναρωτήσει
 * κάτι που το σύστημα έχει, και θα έριχνε σιωπηλά ένα σήμα.
 */
export function registryCheckOf(
  snapshot: { readonly exists: boolean; data: () => unknown },
  companyId: string,
): RegistryCheckRead {
  if (!snapshot.exists) return { kind: 'absent' };
  const data: unknown = snapshot.data();
  const loose = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const record = parseStoredRegistryRecord(loose.record);
  const checkedAt = typeof loose.checkedAt === 'string' ? loose.checkedAt : null;
  if (record === null || checkedAt === null) {
    logger.error('Αντίγραφο ΓΕΜΗ που δεν περνά τον φρουρό', { data: { companyId } });
    return { kind: 'unavailable' };
  }
  return { kind: 'present', check: { record, checkedAt } };
}

export async function readRegistryCheck(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<RegistryCheckRead> {
  try {
    return registryCheckOf(await recordRef(adminDb, companyId).get(), companyId);
  } catch (error) {
    logger.error('Το αντίγραφο ΓΕΜΗ δεν διαβάστηκε', { data: { companyId }, error: getErrorMessage(error) });
    return { kind: 'unavailable' };
  }
}

/** Σβήνει το αντίγραφο — όταν το μητρώο απάντησε «δεν υπάρχει», ή σε αίτημα διαγραφής. */
export async function forgetRegistryCheck(adminDb: AdminFirestore, companyId: string): Promise<void> {
  await recordRef(adminDb, companyId).delete();
}
