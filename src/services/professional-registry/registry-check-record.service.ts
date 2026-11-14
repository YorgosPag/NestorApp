/**
 * @fileoverview **Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΜΗΤΡΩΟΥ, ΑΠΟΘΗΚΕΥΜΕΝΗ** — `professional_registry_checks/{contactId}__{licence}`
 * (ADR-915 §40.7 Φ2 · πρότυπο `company-registry-record.service.ts`).
 * @module services/professional-registry/registry-check-record.service
 *
 * 🔑 **Ολική αντικατάσταση**, ποτέ συγχώνευση: κατηγορία που το μητρώο **άλλαξε** δεν επιζεί από την προηγούμενη ερώτηση.
 * 🔴 **Γράφεται ΜΟΝΟ αν αφορά τον αριθμό που κρατά ΤΩΡΑ η επαφή** — ξαναδιαβασμένο **μέσα** στη συναλλαγή (Α23.12): μια
 *    απάντηση για τον **παλιό** αριθμό, που τελειώνει αφού ο άνθρωπος τον άλλαξε, θα ήταν αντίγραφο χωρίς σκοπό.
 * 🔴 **«Δεν υπάρχει» σβήνει μόνο το αντίγραφο ΑΥΤΟΥ του αριθμού** — ποτέ το αντίγραφο άλλου.
 * **Layering**: service — Admin SDK, ανάγνωση/γραφή κατά ταυτότητα, **καμία** σάρωση.
 */

import 'server-only';

import type { DocumentReference, Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  LICENCE_GRADE_SCOPES,
  isLicenceGrade,
  isProfessionalLicence,
  type LicenceGradeScope,
  type ProfessionalLicence,
} from '@/config/professional-licences';
import { isOwnedByCompany, isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { readContactLicences } from '@/lib/contacts/contact-licences';
import type {
  ProfessionalRegistryCheckRecord,
  RegistryGrades,
  RegistryInspectorRow,
  RegistryScopeAnswer,
} from '@/types/professional-registry-check';

const logger = createModuleLogger('registry-check-record.service');

/** Η ταυτότητα του εγγράφου — **μία** απάντηση ανά (επαφή, άδεια): ο ξανα-έλεγχος την αντικαθιστά (ιδεμπότητα). */
export function registryCheckDocId(contactId: string, licence: ProfessionalLicence): string {
  return `${contactId}__${licence}`;
}

function checkRef(adminDb: AdminFirestore, contactId: string, licence: ProfessionalLicence) {
  return adminDb.collection(COLLECTIONS.PROFESSIONAL_REGISTRY_CHECKS).doc(registryCheckDocId(contactId, licence));
}

/** Ο αριθμός της άδειας που κρατά **τώρα** η επαφή — `null` αν δεν την έχει. */
function heldNumberOf(contactData: Record<string, unknown>, licence: ProfessionalLicence): string | null {
  const held = readContactLicences(contactData.licences).find((candidate) => candidate.licence === licence);
  return held === undefined ? null : held.attestation.registration.number.trim();
}

export interface RegistryCheckWrite {
  /**
   * Η επαφή, όπως τη βρήκε ο **φορτωτής ιδιοκτησίας** του καλούντος (`loadOwnedContact`) — η αποθήκη δεν ανοίγει μόνη
   * της τη συλλογή επαφών: εδώ μόνο **ξαναδιαβάζεται** μέσα στη συναλλαγή.
   */
  readonly contactRef: DocumentReference;
  readonly companyId: string;
  readonly contactId: string;
  readonly licence: ProfessionalLicence;
  readonly checkedAt: string;
  readonly checkedBy: string;
}

/** Αποθηκεύει τη γραμμή του μητρώου — `null` αν η επαφή δεν κρατά πια αυτόν τον αριθμό (τίποτα δεν γράφτηκε). */
export function recordRegistryCheck(
  adminDb: AdminFirestore,
  write: RegistryCheckWrite,
  row: RegistryInspectorRow,
): Promise<ProfessionalRegistryCheckRecord | null> {
  const { contactRef, ...identity } = write;
  return adminDb.runTransaction(async (transaction) => {
    const contact = await transaction.get(contactRef);
    const data = (contact.data() ?? {}) as Record<string, unknown>;
    if (!contact.exists || !isPayloadOwnedByCompany(data, write.companyId)) return null;
    if (heldNumberOf(data, write.licence) !== row.number) return null;
    const record: ProfessionalRegistryCheckRecord = {
      ...identity,
      number: row.number,
      surname: row.surname,
      grades: row.grades,
      rowSha256: row.rowSha256,
    };
    transaction.set(checkRef(adminDb, write.contactId, write.licence), record);
    return record;
  });
}

/** «Το μητρώο λέει ότι δεν υπάρχει» ⇒ σβήνει **μόνο** το αντίγραφο αυτού του αριθμού (Α23.12). */
export function forgetAbsentRegistryNumber(
  adminDb: AdminFirestore,
  contactId: string,
  licence: ProfessionalLicence,
  number: string,
): Promise<boolean> {
  const ref = checkRef(adminDb, contactId, licence);
  return adminDb.runTransaction(async (transaction) => {
    const stored = await transaction.get(ref);
    if (!stored.exists || (stored.data() ?? {}).number !== number) return false;
    transaction.delete(ref);
    return true;
  });
}

function readGrades(raw: unknown): RegistryGrades | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const grades: Partial<Record<LicenceGradeScope, RegistryScopeAnswer>> = {};
  for (const scope of LICENCE_GRADE_SCOPES) {
    const answer = row[scope];
    if (answer !== 'none' && !isLicenceGrade(answer)) return null;
    grades[scope] = answer;
  }
  return grades as RegistryGrades;
}

const TEXT_FIELDS = ['companyId', 'contactId', 'number', 'surname', 'rowSha256', 'checkedAt', 'checkedBy'] as const;
type TextField = (typeof TEXT_FIELDS)[number];

/** Τα κειμενικά πεδία — **όλα** μη κενά, αλλιώς `null`. */
function readTexts(row: Record<string, unknown>): Readonly<Record<TextField, string>> | null {
  const texts: Partial<Record<TextField, string>> = {};
  for (const field of TEXT_FIELDS) {
    const value = row[field];
    if (typeof value !== 'string' || value === '') return null;
    texts[field] = value;
  }
  return texts as Record<TextField, string>;
}

/** Ο φρουρός του αποθηκευμένου ελέγχου — σκουπίδι ⇒ `null` (με καταγραφή), ποτέ μαντεψιά. */
export function registryCheckRecordOf(raw: unknown): ProfessionalRegistryCheckRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const texts = readTexts(row);
  const grades = readGrades(row.grades);
  if (texts === null || grades === null || !isProfessionalLicence(row.licence)) return null;
  return { ...texts, licence: row.licence, grades };
}

/** Ένα ζεύγος (επαφή, άδεια) που ζητείται στην ομαδική ανάγνωση. */
export interface RegistryCheckKey {
  readonly contactId: string;
  readonly licence: ProfessionalLicence;
}

/**
 * ADR-915 §40.7 Φ3 — **πολλοί έλεγχοι με ΕΝΑ `getAll`** (μητρώο λήξεων: επαγγελματίες + υποψήφιοι μιας σελίδας). Ο καλών
 * χωρίζει σε ομάδες. Κλειδί = `registryCheckDocId`. Ίδιος φρουρός και ίδιος έλεγχος μισθωτή με το {@link readRegistryCheckRecord}·
 * αποτυχία ⇒ άδειος χάρτης + καταγραφή: η οθόνη πέφτει στη **δήλωση**, ποτέ σε ψεύτικο «επαληθευμένο».
 */
export async function readRegistryCheckRecords(
  adminDb: AdminFirestore,
  companyId: string,
  keys: readonly RegistryCheckKey[],
): Promise<Map<string, ProfessionalRegistryCheckRecord>> {
  const records = new Map<string, ProfessionalRegistryCheckRecord>();
  if (keys.length === 0) return records;
  try {
    const snapshots = await adminDb.getAll(...keys.map((key) => checkRef(adminDb, key.contactId, key.licence)));
    for (const snapshot of snapshots) {
      if (!snapshot.exists) continue;
      const record = registryCheckRecordOf(snapshot.data());
      if (record === null) logger.error('Έλεγχος μητρώου που δεν περνά τον φρουρό', { data: { docId: snapshot.id } });
      if (record !== null && isOwnedByCompany(record, companyId)) records.set(snapshot.id, record);
    }
  } catch (error) {
    logger.error('Οι έλεγχοι μητρώου δεν διαβάστηκαν', { data: { keys: keys.length }, error: getErrorMessage(error) });
  }
  return records;
}

/** Ο αποθηκευμένος έλεγχος — μόνο αν ανήκει σε **αυτόν** τον οργανισμό. Αποτυχία ανάγνωσης ⇒ `null` + καταγραφή. */
export async function readRegistryCheckRecord(
  adminDb: AdminFirestore,
  companyId: string,
  contactId: string,
  licence: ProfessionalLicence,
): Promise<ProfessionalRegistryCheckRecord | null> {
  try {
    const snapshot = await checkRef(adminDb, contactId, licence).get();
    if (!snapshot.exists) return null;
    const record = registryCheckRecordOf(snapshot.data());
    if (record === null) logger.error('Έλεγχος μητρώου που δεν περνά τον φρουρό', { data: { contactId, licence } });
    return record !== null && isOwnedByCompany(record, companyId) ? record : null;
  } catch (error) {
    logger.error('Ο έλεγχος μητρώου δεν διαβάστηκε', { data: { contactId, licence }, error: getErrorMessage(error) });
    return null;
  }
}
