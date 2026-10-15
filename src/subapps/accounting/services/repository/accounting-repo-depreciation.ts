/**
 * @fileoverview Accounting Repository — Καταχώριση απόσβεσης (ΕΝΑΣ γραφέας, ατομικός, ιδεμπότητος)
 * @description Η εγγραφή απόσβεσης ΜΙΑΣ χρήσης για ΕΝΑ πάγιο, η προβολή του παγίου και το ίχνος ελέγχου γράφονται
 *   στην ΙΔΙΑ συναλλαγή — μαζί ή καθόλου.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-15, ADR-ACC-010 §2.1.1 Φάση 4): το `createDepreciationRecord` (τυχαίο id) + `updateFixedAsset`
 *   (`accumulatedDepreciation += …`) ήταν δύο ανεξάρτητες εγγραφές: δεύτερη εκτέλεση ⇒ διπλή απόσβεση· σφάλμα ανάμεσα ⇒
 *   εγγραφή χωρίς πάγιο ή πάγιο χωρίς εγγραφή.
 *
 * Συμβόλαιο:
 *   - id = ντετερμινιστικό (μισθωτής, πάγιο, χρήση) ⇒ ΜΙΑ εγγραφή ανά (πάγιο, χρήση) από κατασκευής· δεύτερη φορά =
 *     `already_posted` χωρίς εγγραφή (SAP: η επανεκτέλεση του depreciation run δεν ξαναπερνά ό,τι πέρασε)·
 *   - `create` και όχι `set`: αν δύο εκτελέσεις τρέξουν ταυτόχρονα, η δεύτερη ΑΠΟΡΡΙΠΤΕΤΑΙ — ποτέ αντικατάσταση·
 *   - ο υπολογισμός τρέχει μέσα στη συναλλαγή πάνω στο ΦΡΕΣΚΟ πάγιο·
 *   - η προβολή του παγίου γράφεται μόνο για χρήση ≥ της νεότερης καταχωρημένης (παλιά χρήση δεν γυρίζει πίσω την εικόνα).
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 4) · ADR-ACC-007
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicDepreciationRecordId } from '@/services/enterprise-id.service';

import type {
  DepreciationPostingOutcome,
  DepreciationPostingRequest,
  DepreciationRecord,
  FixedAsset,
} from '../../types/assets';
import type { TenantContext } from '../../types/common';

import { appendAuditEntryInTransaction } from './accounting-repo-audit';
import { isoNow, sanitizeForFirestore } from './firestore-helpers';

/** Το πάγιο δεν υπάρχει ή ανήκει σε άλλον μισθωτή — ίδιο σφάλμα και για τα δύο (καμία διαρροή ύπαρξης). */
export class DepreciationAssetNotFoundError extends Error {
  constructor(readonly assetId: string) {
    super(`Fixed asset not found: ${assetId}`);
    this.name = 'DepreciationAssetNotFoundError';
  }
}

/** Η προβολή του παγίου μένει στη νεότερη χρήση: παλαιότερη καταχώριση δεν τη γυρίζει πίσω. */
function projectsAsset(asset: FixedAsset, fiscalYear: number): boolean {
  const last = asset.lastDepreciatedFiscalYear ?? null;
  return last === null || fiscalYear >= last;
}

async function readTenantAsset(
  transaction: Transaction,
  db: Firestore,
  tenant: TenantContext,
  assetId: string
): Promise<FixedAsset> {
  const snap = await transaction.get(db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS).doc(assetId));
  // Σιωπηλή πολιτική του SSoT: ξένο πάγιο = ανύπαρκτο (καμία διαρροή ύπαρξης· κενό companyId ≠ tenant).
  const asset = ownedOrNull(snap.exists ? (snap.data() as FixedAsset) : null, tenant.companyId, {
    resource: 'fixed asset',
    resourceId: assetId,
  });
  if (asset === null) throw new DepreciationAssetNotFoundError(assetId);
  return asset;
}

async function postInTransaction(
  db: Firestore,
  transaction: Transaction,
  tenant: TenantContext,
  request: DepreciationPostingRequest
): Promise<DepreciationPostingOutcome> {
  const recordId = generateDeterministicDepreciationRecordId(tenant.companyId, request.assetId, request.fiscalYear);
  const recordRef = db.collection(COLLECTIONS.ACCOUNTING_DEPRECIATION_RECORDS).doc(recordId);
  // Όλες οι αναγνώσεις ΠΡΙΝ από κάθε εγγραφή (κανόνας συναλλαγών Firestore).
  const existing = await transaction.get(recordRef);
  const asset = await readTenantAsset(transaction, db, tenant, request.assetId);
  if (existing.exists) return { kind: 'already_posted', record: existing.data() as DepreciationRecord };

  const posting = request.compute(asset);
  if (posting === null) return { kind: 'nothing_to_post' };

  const record: DepreciationRecord = { ...posting.record, recordId, companyId: tenant.companyId, createdBy: tenant.userId };
  transaction.create(recordRef, sanitizeForFirestore(record as unknown as Record<string, unknown>));
  if (projectsAsset(asset, request.fiscalYear)) {
    transaction.update(db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS).doc(request.assetId), sanitizeForFirestore({
      ...posting.assetProjection,
      lastDepreciatedFiscalYear: request.fiscalYear,
      updatedAt: isoNow(),
    } as Record<string, unknown>));
  }
  for (const entry of request.auditOf?.(record) ?? []) appendAuditEntryInTransaction(db, transaction, tenant, entry);
  return { kind: 'posted', record };
}

/** Καταχωρεί την απόσβεση μιας χρήσης για ένα πάγιο — ατομικά, ιδεμπότητα. Σφάλμα = σφάλμα, ποτέ fallback. */
export async function postDepreciation(
  tenant: TenantContext,
  request: DepreciationPostingRequest
): Promise<DepreciationPostingOutcome> {
  return safeFirestoreOperation((db) =>
    db.runTransaction((transaction) => postInTransaction(db, transaction, tenant, request))
  );
}
