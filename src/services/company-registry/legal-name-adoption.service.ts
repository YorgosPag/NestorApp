/**
 * @fileoverview **«ΥΙΟΘΕΤΗΣΗ ΕΠΩΝΥΜΙΑΣ ΓΕΜΗ»** — η ρητή πράξη του κατόχου (ADR-841 §7 Α23, Φ3.2 Γ).
 * @module services/company-registry/legal-name-adoption.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΡΟΤΥΠΟ STRIPE REMEDIATION — ΚΑΙ ΕΞΥΠΝΟΤΕΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Stripe ζητά από τον κάτοχο να **ξαναγράψει** την επωνυμία και μετά την ξανακρίνει. Εδώ η τιμή
 * έρχεται **από την ίδια την αρχή** (το αποθηκευμένο αντίγραφο ΓΕΜΗ), άρα το «επαληθευμένη» είναι
 * άμεσο — και ο διακομιστής **ξανακρίνει** αντί να εμπιστευτεί την οθόνη:
 *
 * | Κρίση μέσα στη συναλλαγή | Αποτέλεσμα | HTTP |
 * |---|---|---|
 * | ήδη `verified` | `already-adopted` — **καμία** γραφή (ιδεμποτής) | 200 |
 * | κενό ≠ `name-mismatch` (κλειστή, άλλος αριθμός, χωρίς έλεγχο…) | `not-adoptable` | 422 |
 * | η απάντηση ΓΕΜΗ ≠ ό,τι είδε ο άνθρωπος | `registry-changed` — **CAS** (Google AIP-154 `ABORTED`) | 409 |
 * | αλλιώς | `adopted` | 200 |
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΜΙΑ ΣΥΝΑΛΛΑΓΗ: ΑΛΛΑΓΗ ΚΑΙ ΙΧΝΟΣ ΜΑΖΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Προφίλ και αντίγραφο ΓΕΜΗ διαβάζονται με `transaction.get` (ο **ίδιος** αναγνώστης με τη βιτρίνα):
 * μια αποθήκευση προφίλ ή μια νέα επαλήθευση που προλαβαίνει **ξανατρέχει** την κρίση. Η εγγραφή
 * audit μπαίνει **στην ίδια** συναλλαγή — ποτέ επωνυμία που άλλαξε χωρίς ίχνος (το κενό που έκλεισε).
 * Γράφεται **μόνο** `businessName` + `updatedAt` (`update`, ποτέ `set`: μέτοχοι/ΑΦΜ επιζούν).
 *
 * ⚖️ **GDPR**: άρθ. 6(1)(β) — ρητή πράξη του κατόχου στο δικό του προφίλ, με στοιχείο δημόσιου μητρώου
 * που ήδη κρατάμε · audit 6(1)(γ) (ΚΦΔ) + 5(2) λογοδοσία.
 *
 * ⚠️ Οι **συνέπειες** (βιτρίνα, αγγελίες — `propagateCompanyRename`) ανήκουν στη διαδρομή, μετά το commit:
 * παρενέργεια μέσα στο σώμα συναλλαγής θα έφευγε σε κάθε επανάληψη.
 *
 * **Layering**: service — Admin SDK, μία συναλλαγή, καθαρή κρίση.
 */

import 'server-only';

import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { judgeRegistryIdentity } from '@/lib/company/registry-identity-judgment';
import { readLegalIdentityInputs } from '@/services/mandate/showcase-legal-identity-custody';
import { accountingAuditEntryOf } from '@/subapps/accounting/services/accounting-audit-service';
import { legalNameChangeAudit } from '@/subapps/accounting/services/audit/company-legal-name-audit';
import { auditLogDocumentOf } from '@/subapps/accounting/services/repository/accounting-repo-audit';
import type {
  CompanyRegistryDeclaration,
  RegistryCheck,
  RegistryIdentityJudgment,
  RegistryIdentityReport,
} from '@/types/company-registry';

import { NO_REGISTRY_DECLARATION, NOT_ASKED, declaredIdentityOf } from './company-registry-verification.service';

export interface LegalNameAdoptionRequest {
  readonly companyId: string;
  readonly actorUid: string;
  /** Η επωνυμία ΓΕΜΗ **όπως την είδε** ο άνθρωπος στην προεπισκόπηση — ακριβής σύγκριση. */
  readonly expectedLegalName: string;
}

export type LegalNameAdoptionKind = 'adopted' | 'already-adopted' | 'not-adoptable' | 'registry-changed';

/** Κάθε έκβαση κουβαλά τη **νέα** αναφορά: η οθόνη δείχνει πάντα την τρέχουσα αλήθεια. */
export interface LegalNameAdoption {
  readonly kind: LegalNameAdoptionKind;
  readonly report: RegistryIdentityReport;
}

type NextStep =
  | { readonly kind: Exclude<LegalNameAdoptionKind, 'adopted'> }
  | { readonly kind: 'adopt'; readonly check: RegistryCheck };

/** **Η απόφαση** — μόνο από την κρίση και από ό,τι είδε ο άνθρωπος. */
function nextStepOf(judgment: RegistryIdentityJudgment, expectedLegalName: string): NextStep {
  if (judgment.state === 'verified') return { kind: 'already-adopted' };
  if (judgment.gap !== 'name-mismatch' || judgment.check === null) return { kind: 'not-adoptable' };
  if (judgment.check.record.legalName !== expectedLegalName) return { kind: 'registry-changed' };
  return { kind: 'adopt', check: judgment.check };
}

function reportOf(declaration: CompanyRegistryDeclaration, judgment: RegistryIdentityJudgment): RegistryIdentityReport {
  return { declaration, judgment, freshness: NOT_ASKED };
}

/** Επωνυμία + ίχνος, στην **ίδια** συναλλαγή. Επιστρέφει την αναφορά μετά την υιοθέτηση. */
function writeAdoption(
  adminDb: AdminFirestore,
  transaction: Transaction,
  request: LegalNameAdoptionRequest,
  declaration: CompanyRegistryDeclaration,
  check: RegistryCheck,
): RegistryIdentityReport {
  const legalName = check.record.legalName;
  const profileRef = adminDb.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(request.companyId);
  transaction.update(profileRef, { businessName: legalName, updatedAt: nowISO() });

  const audit = legalNameChangeAudit({
    from: declaration.businessName,
    to: legalName,
    source: 'gemi-adoption',
    registry: { registrationNumber: check.record.registrationNumber, checkedAt: check.checkedAt },
  });
  if (audit !== null) {
    const entry = accountingAuditEntryOf({
      eventType: 'COMPANY_LEGAL_NAME_CHANGED',
      entityType: 'company_profile',
      entityId: request.companyId,
      userId: request.actorUid,
      ...audit,
    });
    const auditRef = adminDb.collection(COLLECTIONS.ACCOUNTING_AUDIT_LOG).doc(entry.auditId);
    transaction.set(auditRef, auditLogDocumentOf({ companyId: request.companyId }, entry));
  }

  const adopted: CompanyRegistryDeclaration = { ...declaration, businessName: legalName };
  return reportOf(adopted, judgeRegistryIdentity(declaredIdentityOf(adopted), { kind: 'present', check }));
}

/**
 * **Η πράξη.** Αποτυχία ανάγνωσης **πετά** (ο καλών απαντά 5xx «ξαναδοκίμασε») — ένα «χωρίς προφίλ»
 * σε βλάβη θα αρνιόταν με λάθος λόγο.
 */
export async function adoptRegistryLegalName(
  adminDb: AdminFirestore,
  request: LegalNameAdoptionRequest,
): Promise<LegalNameAdoption> {
  return adminDb.runTransaction(async (transaction) => {
    const inputs = await readLegalIdentityInputs(adminDb, transaction, request.companyId, []);
    const declaration = inputs.declaration ?? NO_REGISTRY_DECLARATION;
    const judgment = judgeRegistryIdentity(declaredIdentityOf(declaration), inputs.stored);
    const step = nextStepOf(judgment, request.expectedLegalName);
    if (step.kind !== 'adopt') return { kind: step.kind, report: reportOf(declaration, judgment) };
    return { kind: 'adopted', report: writeAdoption(adminDb, transaction, request, declaration, step.check) };
  });
}
