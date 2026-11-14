/**
 * @fileoverview **«ΕΛΕΓΧΟΣ ΣΤΟ ΜΗΤΡΩΟ» ΓΙΑ ΤΗΝ ΑΔΕΙΑ ΜΙΑΣ ΕΠΑΦΗΣ** — ανάγνωση και πράξη (ADR-915 §40.7 Φ2 ·
 * πρότυπο `company-registry-verification.service.ts`, ADR-841 §7 Α23).
 * @module services/professional-registry/registry-check.service
 *
 * | Είσοδος | Ρωτά το μητρώο; | Πότε |
 * |---|---|---|
 * | {@link readRegistryCheckReport} | ❌ | κάθε άνοιγμα της επαφής — κρίνει το **αποθηκευμένο** ζεύγος |
 * | {@link runRegistryCheck} | ✅ | **πράξη** ανθρώπου («Έλεγχος στο μητρώο») |
 *
 * | Ετυμηγορία | Τι γράφεται |
 * |---|---|
 * | `found` | η γραμμή **αντικαθιστά** το αντίγραφο — μόνο αν ο αριθμός είναι ακόμη της επαφής · γραμμή Ιστορικού |
 * | `absent` | σβήνεται **μόνο** το αντίγραφο αυτού του αριθμού |
 * | `ambiguous` · `layout-changed` · `unavailable` | **τίποτα** — η παλιά γνώση δεν ακυρώνεται από άγνοια |
 *
 * ⛔ Κανένα cron, κανένα trigger: κάθε κλήση στο μητρώο = μία ανθρώπινη χειρονομία (Α1.6).
 * **Layering**: service — συνθέτει επαφή, μητρώο, αποθήκη, καθαρή κρίση. Ό,τι έρχεται από έξω είναι εγχεόμενο.
 */

import 'server-only';

import type { DocumentReference, Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { ProfessionalLicence } from '@/config/professional-licences';
import { nowISO } from '@/lib/date-local';
import { judgeRegistryCheck, type RegistryCheckSubject } from '@/lib/professional/registry-check-judgment';
import type {
  ProfessionalRegistryCheckRecord,
  RegistryCheckAttempt,
  RegistryCheckReport,
  RegistryLookupVerdict,
} from '@/types/professional-registry-check';

import { isBuildingcertLookupEnabled, lookupEnergyInspector } from './buildingcert.client';
import { forgetAbsentRegistryNumber, readRegistryCheckRecord, recordRegistryCheck } from './registry-check-record.service';

/** Ποιες άδειες έχουν **αυτόματο** έλεγχο — νέο μητρώο = νέα γραμμή (ο ηλεκτρολόγος δεν έχει δημόσια αναζήτηση, §34). */
type RegistryLookup = (registrationNumber: string) => Promise<RegistryLookupVerdict>;
const REGISTRY_LOOKUPS: Readonly<Partial<Record<ProfessionalLicence, { lookup: RegistryLookup; enabled: () => boolean }>>> = {
  'energy-inspector': { lookup: (number) => lookupEnergyInspector(number), enabled: () => isBuildingcertLookupEnabled() },
};

/** Έχει αυτή η άδεια αυτόματο έλεγχο; (ο φρουρός της διαδρομής). */
export function hasRegistryLookup(licence: ProfessionalLicence): boolean {
  return REGISTRY_LOOKUPS[licence] !== undefined;
}

export interface RegistryCheckTarget {
  /** Η επαφή από τον φορτωτή ιδιοκτησίας του καλούντος — ξαναδιαβάζεται μέσα στη συναλλαγή της εγγραφής. */
  readonly contactRef: DocumentReference;
  readonly companyId: string;
  readonly contactId: string;
  readonly licence: ProfessionalLicence;
}


function reportOf(
  subject: RegistryCheckSubject,
  record: ProfessionalRegistryCheckRecord | null,
  attempt: RegistryCheckAttempt,
): RegistryCheckReport {
  return {
    judgment: judgeRegistryCheck(subject, record),
    attempt,
    lookupEnabled: REGISTRY_LOOKUPS[subject.licence]?.enabled() ?? false,
  };
}

/** **Ανάγνωση**: η κρίση από τα αποθηκευμένα. Καμία κλήση στο μητρώο. */
export async function readRegistryCheckReport(
  adminDb: AdminFirestore,
  target: RegistryCheckTarget,
  subject: RegistryCheckSubject,
): Promise<RegistryCheckReport> {
  const record = await readRegistryCheckRecord(adminDb, target.companyId, target.contactId, target.licence);
  return reportOf(subject, record, { kind: 'not-asked' });
}

/** Η ετυμηγορία ⇒ τι έμαθε η ερώτηση (η οθόνη τη λέει με λέξεις). */
function attemptOf(verdict: RegistryLookupVerdict, recorded: boolean): RegistryCheckAttempt {
  switch (verdict.kind) {
    case 'found':
      // Η επαφή άλλαξε αριθμό όσο ρωτούσαμε ⇒ η απάντηση δεν την αφορά πια (σαν να μη ρωτήθηκε).
      return recorded ? { kind: 'asked' } : { kind: 'not-asked' };
    case 'absent':
      return { kind: 'absent' };
    case 'ambiguous':
      return { kind: 'ambiguous' };
    case 'layout-changed':
      return { kind: 'layout-changed' };
    case 'unavailable':
      return { kind: 'unavailable', reason: verdict.reason };
  }
}

export interface RegistryCheckRun {
  readonly report: RegistryCheckReport;
  /** Ό,τι γράφτηκε — για τη γραμμή Ιστορικού του καλούντος. `null` ⇒ καμία νέα γνώση. */
  readonly recorded: ProfessionalRegistryCheckRecord | null;
}

/**
 * **Πράξη**: ρώτα το μητρώο για τον αριθμό που κρατά **τώρα** η επαφή. Άδεια χωρίς αυτόματο έλεγχο ή επαφή χωρίς την
 * άδεια ⇒ ο καλών έχει ήδη αρνηθεί (φρουροί της διαδρομής).
 */
export async function runRegistryCheck(
  adminDb: AdminFirestore,
  target: RegistryCheckTarget,
  subject: RegistryCheckSubject & { readonly held: NonNullable<RegistryCheckSubject['held']> },
  actorUid: string,
): Promise<RegistryCheckRun> {
  const registry = REGISTRY_LOOKUPS[target.licence];
  const number = subject.held.attestation.registration.number.trim();
  const verdict: RegistryLookupVerdict = registry === undefined ? { kind: 'unavailable', reason: 'disabled' } : await registry.lookup(number);
  let recorded: ProfessionalRegistryCheckRecord | null = null;
  if (verdict.kind === 'found') {
    recorded = await recordRegistryCheck(adminDb, { ...target, checkedAt: nowISO(), checkedBy: actorUid }, verdict.row);
  } else if (verdict.kind === 'absent') {
    await forgetAbsentRegistryNumber(adminDb, target.contactId, target.licence, number);
  }
  const record = recorded ?? (await readRegistryCheckRecord(adminDb, target.companyId, target.contactId, target.licence));
  return { report: reportOf(subject, record, attemptOf(verdict, recorded !== null)), recorded };
}
