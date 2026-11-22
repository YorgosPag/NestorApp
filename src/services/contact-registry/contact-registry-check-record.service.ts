/**
 * @fileoverview **Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΓΕΜΗ ΓΙΑ ΜΙΑ ΕΠΑΦΗ, ΑΠΟΘΗΚΕΥΜΕΝΗ** — `contact_registry_checks/{contactId}`
 * (ADR-948 §8 Βήμα 4 · πρότυπο `company-registry-record.service.ts` και `registry-check-record.service.ts`).
 * @module services/contact-registry/contact-registry-check-record.service
 *
 * 🔑 **Ολική αντικατάσταση**, ποτέ συγχώνευση: πεδίο που το μητρώο έπαψε να δίνει δεν επιζεί από την προηγούμενη ερώτηση.
 * 🔴 **Γράφεται ΜΟΝΟ αν η επαφή ρωτά ακόμη το ίδιο** (ίδιος Αρ. ΓΕΜΗ ή ίδιο ΑΦΜ) — ξαναδιαβασμένο **μέσα** στη
 *    συναλλαγή (ADR-841 §7 Α23.12): απάντηση για τον **παλιό** αριθμό, που τελειώνει αφού ο άνθρωπος τον άλλαξε, θα
 *    ήταν αντίγραφο χωρίς σκοπό.
 * 🔴 **«Δεν υπάρχει» σβήνει μόνο το αντίγραφο ΑΥΤΟΥ του αριθμού** — ποτέ το αντίγραφο άλλου.
 * **Layering**: service — Admin SDK, ανάγνωση/γραφή κατά ταυτότητα, **καμία** σάρωση.
 */

import 'server-only';

import type { DocumentReference, Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isOwnedByCompany, isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { contactRegistryQueryOf, sameRegistryQuery } from '@/lib/contacts/contact-registry-subject';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { parseStoredRegistryRecord } from '@/services/company-registry/gemi-opendata-parse';
import type { RegistryCompanyRecord } from '@/types/company-registry';
import type { ContactRegistryCheckRecord, ContactRegistryQuery } from '@/types/contact-registry-check';

const logger = createModuleLogger('contact-registry-check-record.service');

function checkRef(adminDb: AdminFirestore, contactId: string) {
  return adminDb.collection(COLLECTIONS.CONTACT_REGISTRY_CHECKS).doc(contactId);
}

export interface ContactRegistryCheckWrite {
  /**
   * Η επαφή, όπως τη βρήκε ο **φορτωτής ιδιοκτησίας** του καλούντος (`loadOwnedContact`) — εδώ μόνο
   * **ξαναδιαβάζεται** μέσα στη συναλλαγή.
   */
  readonly contactRef: DocumentReference;
  readonly companyId: string;
  readonly contactId: string;
  /** Το ερώτημα με το οποίο ρωτήθηκε το ΓΕΜΗ — πρέπει να ισχύει ακόμη για την επαφή. */
  readonly query: ContactRegistryQuery;
  readonly checkedAt: string;
  readonly checkedBy: string;
}

/** Αποθηκεύει την απάντηση — `null` αν η επαφή δεν ρωτά πια το ίδιο ή δεν ανήκει στον χώρο (τίποτα δεν γράφτηκε). */
export function recordContactRegistryCheck(
  adminDb: AdminFirestore,
  write: ContactRegistryCheckWrite,
  record: RegistryCompanyRecord,
): Promise<ContactRegistryCheckRecord | null> {
  const { contactRef, query, ...identity } = write;
  return adminDb.runTransaction(async (transaction) => {
    const contact = await transaction.get(contactRef);
    const data = (contact.data() ?? {}) as Record<string, unknown>;
    if (!contact.exists || !isPayloadOwnedByCompany(data, write.companyId)) return null;
    if (!sameRegistryQuery(contactRegistryQueryOf(data), query)) return null;
    const stored: ContactRegistryCheckRecord = { ...identity, record };
    transaction.set(checkRef(adminDb, write.contactId), stored);
    return stored;
  });
}

/** «Το ΓΕΜΗ λέει ότι δεν υπάρχει» ⇒ σβήνει **μόνο** το αντίγραφο αυτού του αριθμού (Α23.12). */
export function forgetAbsentContactRegistryNumber(
  adminDb: AdminFirestore,
  companyId: string,
  contactId: string,
  registrationNumber: string,
): Promise<boolean> {
  const ref = checkRef(adminDb, contactId);
  return adminDb.runTransaction(async (transaction) => {
    const stored = await transaction.get(ref);
    const check = stored.exists ? contactRegistryCheckOf(stored.data()) : null;
    if (check === null || !isOwnedByCompany(check, companyId)) return false;
    if (check.record.registrationNumber !== registrationNumber) return false;
    transaction.delete(ref);
    return true;
  });
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** Ο φρουρός του αποθηκευμένου ελέγχου — σκουπίδι ⇒ `null`, ποτέ μαντεψιά. */
export function contactRegistryCheckOf(raw: unknown): ContactRegistryCheckRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const record = parseStoredRegistryRecord(row.record);
  const companyId = nonEmptyText(row.companyId);
  const contactId = nonEmptyText(row.contactId);
  const checkedAt = nonEmptyText(row.checkedAt);
  const checkedBy = nonEmptyText(row.checkedBy);
  if (record === null || companyId === null || contactId === null || checkedAt === null || checkedBy === null) return null;
  return { companyId, contactId, checkedAt, checkedBy, record };
}

/**
 * Ο αποθηκευμένος έλεγχος — μόνο αν ανήκει σε **αυτόν** τον χώρο. Λείπει ⇒ `null`. Σκουπίδι ή αποτυχία ανάγνωσης
 * ⇒ `null` **με καταγραφή**: η οθόνη δείχνει «χωρίς έλεγχο», ποτέ ψεύτικο «επαληθευμένο».
 */
export async function readContactRegistryCheck(
  adminDb: AdminFirestore,
  companyId: string,
  contactId: string,
): Promise<ContactRegistryCheckRecord | null> {
  try {
    const snapshot = await checkRef(adminDb, contactId).get();
    if (!snapshot.exists) return null;
    const check = contactRegistryCheckOf(snapshot.data());
    if (check === null) logger.error('Έλεγχος ΓΕΜΗ επαφής που δεν περνά τον φρουρό', { data: { contactId } });
    return check !== null && isOwnedByCompany(check, companyId) ? check : null;
  } catch (error) {
    logger.error('Ο έλεγχος ΓΕΜΗ επαφής δεν διαβάστηκε', { data: { contactId }, error: getErrorMessage(error) });
    return null;
  }
}
