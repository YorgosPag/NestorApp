/**
 * @fileoverview Accounting Repository — Λογιστικές περίοδοι ΑΝΑ ΜΙΣΘΩΤΗ (ΕΝΑΣ γραφέας, ΜΙΑ διεύθυνση)
 * @description Κάθε περίοδος ζει στο `generateDeterministicFiscalPeriodId(companyId, κλειδί)` και φέρει `companyId`.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-ACC-010 §2.1.1 Φάση 6, 2026-10-15):
 *   - το id ήταν σκέτο `2026-12` και το `companyId` ΔΕΝ γραφόταν ⇒ το κλείσιμο / κλείδωμα ενός μισθωτή ίσχυε για
 *     ΟΛΟΥΣ (τιμολόγια, Βιβλίο Ε-Ε, τράπεζα, αποσβέσεις)· η λίστα φίλτραρε με `companyId` ⇒ πάντα κενή ⇒ το
 *     «υπάρχει ήδη χρήση;» δεν έπιανε ποτέ και το `batch.set` ξανάγραφε ΚΛΕΙΔΩΜΕΝΕΣ περιόδους ως OPEN·
 *   - η μετάβαση κατάστασης ήταν ανάγνωση ΕΞΩ από συναλλαγή + τυφλό `update`, και το ίχνος γραφόταν ΜΕΤΑ.
 *
 * Συμβόλαιο (SAP OB52 ανά company code · Xero lock date ανά οργανισμό):
 *   - διεύθυνση = (μισθωτής, κλειδί) ⇒ ξένη περίοδος δεν είναι καν προσβάσιμη· `ownedOrNull` = δεύτερη ζώνη·
 *   - η λίστα μιας χρήσης = `getAll` των 13 γνωστών διευθύνσεων — κανένα ερώτημα, κανένας δείκτης·
 *   - η χρήση γεννιέται ΟΛΗ ή ΚΑΘΟΛΟΥ (συναλλαγή + `create`): δεύτερη δημιουργία = `FiscalYearExistsError`, ποτέ
 *     αντικατάσταση·
 *   - μετάβαση = απόφαση πάνω στη ΦΡΕΣΚΙΑ περίοδο + εγγραφή + ίχνος στην ΙΔΙΑ συναλλαγή.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 6)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { DocumentReference, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicFiscalPeriodId } from '@/services/enterprise-id.service';

import type { TenantContext } from '../../types/common';
import type { FiscalPeriod, FiscalPeriodDraft, FiscalPeriodTransitionRequest } from '../../types/fiscal-period';
import { accountingAuditEntryOf } from '../accounting-audit-service';
import { fiscalPeriodKeysOf } from '../fiscal-period-keys';
import { decideFiscalPeriodTransition } from '../fiscal-period-transitions';

import { appendAuditEntryInTransaction } from './accounting-repo-audit';
import { isoNow, sanitizeForFirestore } from './firestore-helpers';

/** Η περίοδος δεν υπάρχει ή ανήκει σε άλλον μισθωτή — ίδιο σφάλμα και για τα δύο (καμία διαρροή ύπαρξης). */
export class FiscalPeriodNotFoundError extends Error {
  readonly code = 'FISCAL_PERIOD_NOT_FOUND';
  constructor(readonly periodId: string) {
    super(`Fiscal period not found: ${periodId}`);
    this.name = 'FiscalPeriodNotFoundError';
  }
}

/** Η μετάβαση δεν επιτρέπεται από την ΤΡΕΧΟΥΣΑ κατάσταση (π.χ. ξανάνοιγμα κλειδωμένης). */
export class FiscalPeriodTransitionError extends Error {
  readonly code = 'FISCAL_PERIOD_INVALID_TRANSITION';
  constructor(readonly periodId: string, readonly action: string, readonly status: string) {
    super(`Cannot ${action} fiscal period ${periodId}: status is ${status}`);
    this.name = 'FiscalPeriodTransitionError';
  }
}

/** Η χρήση έχει ήδη (έστω και μία) περίοδο — καμία δεν ξαναγράφεται. */
export class FiscalYearExistsError extends Error {
  readonly code = 'FISCAL_YEAR_EXISTS';
  constructor(readonly fiscalYear: number) {
    super(`Fiscal year ${fiscalYear} already has periods`);
    this.name = 'FiscalYearExistsError';
  }
}

/** Η ΜΙΑ διεύθυνση μιας περιόδου του μισθωτή — και για τον γραφέα αποσβέσεων. */
export function fiscalPeriodRef(db: Firestore, tenant: Pick<TenantContext, 'companyId'>, periodId: string): DocumentReference {
  return db.collection(COLLECTIONS.ACCOUNTING_FISCAL_PERIODS)
    .doc(generateDeterministicFiscalPeriodId(tenant.companyId, periodId));
}

/** Το στιγμιότυπο ως περίοδος του μισθωτή — ανύπαρκτη ή ξένη ⇒ `null`. */
export function ownedFiscalPeriodOf(
  snap: DocumentSnapshot,
  tenant: Pick<TenantContext, 'companyId'>,
  periodId: string
): FiscalPeriod | null {
  return ownedOrNull(snap.exists ? (snap.data() as FiscalPeriod) : null, tenant.companyId, {
    resource: 'fiscal period',
    resourceId: periodId,
  });
}

/** Μία περίοδος του μισθωτή (κλειδί `YYYY-MM`). Σφάλμα = σφάλμα — ποτέ «καμία περίοδος». */
export async function getFiscalPeriod(tenant: TenantContext, periodId: string): Promise<FiscalPeriod | null> {
  return safeFirestoreOperation(async (db) =>
    ownedFiscalPeriodOf(await fiscalPeriodRef(db, tenant, periodId).get(), tenant, periodId));
}

/** Οι περίοδοι μιας χρήσης, με τη σειρά — ανάγνωση με ΤΑΥΤΟΤΗΤΑ, χωρίς ερώτημα ή δείκτη. */
export async function listFiscalPeriods(tenant: TenantContext, fiscalYear: number): Promise<FiscalPeriod[]> {
  return safeFirestoreOperation(async (db) => {
    const keys = fiscalPeriodKeysOf(fiscalYear);
    const snaps = await db.getAll(...keys.map((key) => fiscalPeriodRef(db, tenant, key)));
    return snaps
      .map((snap, i) => ownedFiscalPeriodOf(snap, tenant, keys[i]))
      .filter((period): period is FiscalPeriod => period !== null);
  });
}

/** Γεννά τις περιόδους μιας χρήσης — ΟΛΕΣ ή ΚΑΜΙΑ· ο μισθωτής μπαίνει ΕΔΩ, από το `TenantContext`. */
export async function createFiscalPeriods(
  tenant: TenantContext,
  fiscalYear: number,
  periods: readonly FiscalPeriodDraft[]
): Promise<void> {
  await safeFirestoreOperation((db) => db.runTransaction(async (transaction) => {
    const refs = periods.map((period) => fiscalPeriodRef(db, tenant, period.periodId));
    const existing = refs.length === 0 ? [] : await transaction.getAll(...refs);
    if (existing.some((snap) => snap.exists)) throw new FiscalYearExistsError(fiscalYear);
    periods.forEach((period, i) => {
      const doc: FiscalPeriod = { ...period, companyId: tenant.companyId };
      transaction.create(refs[i], sanitizeForFirestore(doc as unknown as Record<string, unknown>));
    });
  }));
}

/**
 * Μεταβαίνει η περίοδος (κλείσιμο / κλείδωμα / ξανάνοιγμα): απόφαση πάνω στη ΦΡΕΣΚΙΑ περίοδο, εγγραφή και ίχνος
 * `PERIOD_*` στην ΙΔΙΑ συναλλαγή. Επιστρέφει την περίοδο όπως γράφτηκε.
 */
export async function transitionFiscalPeriod(
  tenant: TenantContext,
  periodId: string,
  request: FiscalPeriodTransitionRequest
): Promise<FiscalPeriod> {
  return safeFirestoreOperation((db) => db.runTransaction(async (transaction) => {
    const ref = fiscalPeriodRef(db, tenant, periodId);
    const period = ownedFiscalPeriodOf(await transaction.get(ref), tenant, periodId);
    if (period === null) throw new FiscalPeriodNotFoundError(periodId);

    const decision = decideFiscalPeriodTransition(period, request, isoNow());
    if (decision.kind === 'refused') throw new FiscalPeriodTransitionError(periodId, request.action, period.status);

    transaction.update(ref, sanitizeForFirestore({ ...decision.updates } as Record<string, unknown>));
    appendAuditEntryInTransaction(db, transaction, tenant, accountingAuditEntryOf({
      eventType: decision.event,
      entityType: 'period',
      entityId: periodId,
      userId: request.userId,
      details: `Αλλαγή κατάστασης περιόδου → ${decision.to}`,
      metadata: { from: period.status, to: decision.to, reason: request.reason },
    }));
    return { ...period, ...decision.updates };
  }));
}
