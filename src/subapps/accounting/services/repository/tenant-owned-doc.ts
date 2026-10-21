/**
 * «Ανήκει αυτό το έγγραφο λογιστικής στην εταιρεία που ρωτά;» — για κάθε πρόσβαση **κατά id**
 *
 * Ο φράχτης των `list*` είναι το `where('companyId', '==', …)`. Η πρόσβαση κατά id δεν έχει φράχτη από
 * τη βάση: το Admin SDK παρακάμπτει τους κανόνες, και το `TenantContext` που περνούσε σε κάθε `get*`/
 * `update*` **δεν διαβαζόταν** (ADR-917 Φ4.0 — ένα id αρκούσε για ανάγνωση **και** επιβεβαίωση
 * παραστατικού άλλης εταιρείας). Εδώ η ερώτηση γίνεται **μία** φορά:
 *
 * - **ανάγνωση** — `ownedOrNull`: ξένο ≡ ανύπαρκτο, δεν μαρτυρά ύπαρξη (ADR-734 §7).
 * - **ενημέρωση / διαγραφή** — ανάγνωση + έλεγχος + εγγραφή σε **μία** συναλλαγή: κανένα παράθυρο
 *   ανάμεσα στον έλεγχο και την εγγραφή· ξένο ή ανύπαρκτο ⇒ {@link OwnedDocumentNotFoundError}, τίποτα δεν γράφεται.
 *
 * @module subapps/accounting/services/repository/tenant-owned-doc
 * @see ADR-917 Φ4.0 · lib/auth/tenant-ownership
 */

import type { Firestore } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { ownedOrNull, type MaybeTenantOwned } from '@/lib/auth/tenant-ownership';

import type { TenantContext } from '../../types/common';

/** Ό,τι χρειάζεται ο φύλακας για να εντοπίσει την απόπειρα στο log */
export interface OwnedDocAddress {
  readonly collection: string;
  readonly id: string;
  /** Ανθρώπινο όνομα πόρου, π.χ. `'expense document'` */
  readonly resource: string;
}

/** Ξένο ή ανύπαρκτο — η ίδια απάντηση, ώστε ο καλών να μη μαθαίνει ποιο από τα δύο */
export class OwnedDocumentNotFoundError extends Error {
  readonly resource: string;
  readonly resourceId: string;

  constructor(address: OwnedDocAddress) {
    super(`${address.resource} not found: ${address.id}`);
    this.name = 'OwnedDocumentNotFoundError';
    this.resource = address.resource;
    this.resourceId = address.id;
  }
}

const subjectOf = (address: OwnedDocAddress) => ({ resource: address.resource, resourceId: address.id, path: 'admin' });

/** Το έγγραφο ως T μόνο αν ανήκει στην εταιρεία· αλλιώς `null` (ίδιο με ανύπαρκτο) */
export function ownedPayload<T extends MaybeTenantOwned>(
  raw: unknown,
  tenant: TenantContext,
  address: OwnedDocAddress,
): T | null {
  if (raw === undefined || raw === null || typeof raw !== 'object') return null;
  return ownedOrNull(raw as T, tenant.companyId, subjectOf(address));
}

/** Ανάγνωση κατά id με φράχτη εταιρείας. Αποτυχία βάσης ⇒ `null` (όπως πριν από τον φράχτη). */
export function readOwnedDoc<T extends MaybeTenantOwned>(
  tenant: TenantContext,
  address: OwnedDocAddress,
): Promise<T | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(address.collection).doc(address.id).get();
    return snap.exists ? ownedPayload<T>(snap.data(), tenant, address) : null;
  }, null);
}

async function mutateOwnedDoc(
  db: Firestore,
  tenant: TenantContext,
  address: OwnedDocAddress,
  mutate: (tx: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference) => void,
): Promise<void> {
  const ref = db.collection(address.collection).doc(address.id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || ownedPayload(snap.data(), tenant, address) === null) {
      throw new OwnedDocumentNotFoundError(address);
    }
    mutate(tx, ref);
  });
}

/** Ενημέρωση κατά id — μόνο αν το έγγραφο ανήκει στην εταιρεία, σε μία συναλλαγή */
export function updateOwnedDoc(
  tenant: TenantContext,
  address: OwnedDocAddress,
  updates: Record<string, unknown>,
): Promise<void> {
  return safeFirestoreOperation(
    (db) => mutateOwnedDoc(db, tenant, address, (tx, ref) => tx.update(ref, updates)),
    undefined,
  );
}

/** Διαγραφή κατά id — μόνο αν το έγγραφο ανήκει στην εταιρεία, σε μία συναλλαγή */
export function deleteOwnedDoc(tenant: TenantContext, address: OwnedDocAddress): Promise<void> {
  return safeFirestoreOperation(
    (db) => mutateOwnedDoc(db, tenant, address, (tx, ref) => tx.delete(ref)),
    undefined,
  );
}
