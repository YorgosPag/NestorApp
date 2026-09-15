/**
 * @fileoverview **ΤΟ ΑΝΤΙΓΡΑΦΟ ΓΕΜΗ ΖΕΙ ΟΣΟ ΥΠΗΡΕΤΕΙ ΤΟΝ ΣΚΟΠΟ ΤΟΥ** — διαγραφή υπό συνθήκη, σε συναλλαγή,
 * με ίχνος (ADR-841 §7 Α23.12).
 * @module services/company-registry/company-registry-retention.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚖️ ΔΙΑΤΗΡΗΣΗ ΔΕΜΕΝΗ ΜΕ ΤΟΝ ΣΚΟΠΟ, ΟΧΙ ΜΕ ΡΟΛΟΙ (GDPR άρθ. 5(1)(ε))
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `company_registry_records/{companyId}` υπάρχει **μόνο** για να επαληθεύει τον αριθμό ΓΕΜΗ που δηλώνει
 * **τώρα** το προφίλ. Κανένα αυθαίρετο «Χ μήνες»: το αντίγραφο φεύγει τη **στιγμή** που ο σκοπός του λήγει.
 *
 * | Πότε | Αιτία (`reason`) | Ποιος το κατέχει |
 * |---|---|---|
 * | ο αριθμός του προφίλ άλλαξε ή σβήστηκε | `profile-number-changed` | {@link registryRetentionCompanion} — στην **ίδια** συναλλαγή με το προφίλ |
 * | το ΓΕΜΗ απάντησε «δεν υπάρχει» | `not-in-registry` | {@link forgetAbsentRegistryNumber} — πράξη «Επαλήθευση» |
 * | αίτημα διαγραφής του κατόχου | `erasure-request` | {@link eraseRegistryCopyOnRequest} — `DELETE /api/companies/registry-verification` |
 * | κλείσιμο εταιρείας | — | ⚠️ **ΥΠΟΧΡΕΩΣΗ**: η διαδρομή κλεισίματος, όταν γραφτεί, **οφείλει** να καλεί εδώ (Α23.12) |
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΠΟΤΕ ΤΥΦΛΟ `delete` — ΣΥΝΘΗΚΗ, ΣΥΝΑΛΛΑΓΗ, ΙΧΝΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - **Συνθήκη πάνω σε ό,τι διάβασε η συναλλαγή**: μια ταυτόχρονη «Επαλήθευση» που γράφει το αντίγραφο του
 *   **νέου** αριθμού ακυρώνει τη συναλλαγή ⇒ το σώμα ξανατρέχει, βλέπει το νέο αντίγραφο, και **δεν** το σβήνει.
 * - **Ιδεμποτής**: τίποτα να σβηστεί ⇒ καμία γραφή, **κανένα** δεύτερο ίχνος.
 * - **Ίχνος στην ίδια δέσμευση** (5(2) λογοδοσία): διαγραφή χωρίς ίχνος ή ίχνος χωρίς διαγραφή είναι αδύνατα.
 *   Περιέχει **μόνο** αιτία · αριθμό · ημερομηνία ελέγχου · ενεργούντα — ποτέ επωνυμία ή έδρα (5(1)(γ)).
 *
 * **Layering**: service — Admin SDK. Ο καθαρός κριτής «αφορά αυτόν τον αριθμό;» είναι ο `isAnswerForNumber`.
 */

import 'server-only';

import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { isAnswerForNumber } from '@/lib/company/registry-identity-judgment';
import { accountingAuditEntryOf } from '@/subapps/accounting/services/accounting-audit-service';
import { appendAuditEntryInTransaction } from '@/subapps/accounting/services/repository/accounting-repo-audit';
import type { CompanyProfileTransactionCompanion } from '@/subapps/accounting/types/interfaces';
import type { RegistryCheckRead } from '@/types/company-registry';

import { registryCheckOf, registryRecordRef } from './company-registry-record.service';

export type RegistryCopyErasureReason = 'profile-number-changed' | 'not-in-registry' | 'erasure-request';

/** Η έκβαση ενός αιτήματος διαγραφής — `already-absent` ⇒ τίποτα δεν γράφτηκε (ιδεμποτής). */
export type RegistryCopyErasureOutcome = 'erased' | 'already-absent';

const REASON_LABEL: Readonly<Record<RegistryCopyErasureReason, string>> = {
  'profile-number-changed': 'ο αριθμός ΓΕΜΗ του προφίλ άλλαξε ή σβήστηκε',
  'not-in-registry': 'το ΓΕΜΗ απάντησε ότι ο αριθμός δεν υπάρχει',
  'erasure-request': 'αίτημα διαγραφής του κατόχου',
};

interface ErasureSubject {
  readonly companyId: string;
  readonly actorUid: string;
  readonly reason: RegistryCopyErasureReason;
}

/**
 * Το αντίγραφο **όπως το είδε η συναλλαγή**: `absent` = δεν υπάρχει · `unavailable` = υπάρχει αλλά δεν περνά
 * τον φρουρό (αποτυχία ανάγνωσης **πετά** — ο καλών αποτυγχάνει ολόκληρος, ποτέ «δεν υπάρχει»).
 */
async function heldCopyIn(
  adminDb: AdminFirestore,
  transaction: Transaction,
  companyId: string,
): Promise<RegistryCheckRead> {
  return registryCheckOf(await transaction.get(registryRecordRef(adminDb, companyId)), companyId);
}

/** Διαγραφή **και** ίχνος, στην ίδια συναλλαγή. */
function eraseInTransaction(
  adminDb: AdminFirestore,
  transaction: Transaction,
  subject: ErasureSubject,
  held: RegistryCheckRead,
): void {
  transaction.delete(registryRecordRef(adminDb, subject.companyId));
  const check = held.kind === 'present' ? held.check : null;
  const entry = accountingAuditEntryOf({
    eventType: 'COMPANY_REGISTRY_COPY_ERASED',
    entityType: 'company_profile',
    entityId: subject.companyId,
    userId: subject.actorUid,
    details: `Διαγραφή αντιγράφου ΓΕΜΗ: ${REASON_LABEL[subject.reason]}`,
    metadata: {
      reason: subject.reason,
      registrationNumber: check?.record.registrationNumber ?? null,
      registryCheckedAt: check?.checkedAt ?? null,
    },
  });
  appendAuditEntryInTransaction(adminDb, transaction, { companyId: subject.companyId }, entry);
}

/**
 * **Ο σύντροφος της αποθήκευσης προφίλ**: αντίγραφο που **δεν** αφορά τον αριθμό που γράφεται ⇒ σβήνεται στην
 * ίδια δέσμευση. Ό,τι δεν περνά τον φρουρό δεν αφορά κανέναν αριθμό ⇒ σβήνεται κι αυτό.
 */
export function registryRetentionCompanion(
  adminDb: AdminFirestore,
  companyId: string,
  actorUid: string,
): CompanyProfileTransactionCompanion {
  return async (transaction) => {
    const held = await heldCopyIn(adminDb, transaction, companyId);
    return (_before, after) => {
      if (held.kind === 'absent') return;
      if (held.kind === 'present' && isAnswerForNumber(after.gemiNumber, held.check.record)) return;
      eraseInTransaction(adminDb, transaction, { companyId, actorUid, reason: 'profile-number-changed' }, held);
    };
  };
}

/**
 * **Το ΓΕΜΗ απάντησε «δεν υπάρχει» για `askedNumber`** ⇒ σβήνεται **μόνο** αντίγραφο αυτού του αριθμού.
 *
 * 🔴 Όχι τυφλό `delete`: μια αργή απάντηση για τον **παλιό** αριθμό θα έσβηνε το αντίγραφο του **νέου**, που
 * μια δεύτερη επαλήθευση μόλις έγραψε.
 */
export async function forgetAbsentRegistryNumber(
  adminDb: AdminFirestore,
  companyId: string,
  askedNumber: string,
  actorUid: string,
): Promise<void> {
  await adminDb.runTransaction(async (transaction) => {
    const held = await heldCopyIn(adminDb, transaction, companyId);
    if (held.kind === 'absent') return;
    if (held.kind === 'present' && held.check.record.registrationNumber !== askedNumber) return;
    eraseInTransaction(adminDb, transaction, { companyId, actorUid, reason: 'not-in-registry' }, held);
  });
}

/** **Αίτημα διαγραφής του κατόχου** (GDPR άρθ. 17 · 21) — ιδεμποτές. */
export async function eraseRegistryCopyOnRequest(
  adminDb: AdminFirestore,
  companyId: string,
  actorUid: string,
): Promise<RegistryCopyErasureOutcome> {
  return adminDb.runTransaction(async (transaction): Promise<RegistryCopyErasureOutcome> => {
    const held = await heldCopyIn(adminDb, transaction, companyId);
    if (held.kind === 'absent') return 'already-absent';
    eraseInTransaction(adminDb, transaction, { companyId, actorUid, reason: 'erasure-request' }, held);
    return 'erased';
  });
}
