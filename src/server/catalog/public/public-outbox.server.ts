import 'server-only';

/**
 * **Το outbox της δημόσιας προβολής** (ADR-923 §5.13 Δ3): ένα έγγραφο ανά `{ companyId, scope }`, γραμμένο **μέσα** στη
 * συναλλαγή της αλλαγής. Αλλαγή χωρίς σημείωση είναι δομικά αδύνατη.
 *
 * 🔑 Ο μόνος καλών είναι η μηχανή (`runCatalogTransaction`), από το `noteWrite`: το βλέπουν και τα `stageDerived`,
 *    `stageCopied`, που το `scope.changes` δεν τα βλέπει.
 * 🔒 Κουβαλά μόνο `{ companyId, scope, revision, changedAt }`. Το `drainedRevision` το γράφει ο αδειαστής.
 *
 * @module server/catalog/public/public-outbox.server
 */

import { FieldValue, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicCatalogPublicOutboxId } from '@/services/enterprise-id.service';
import { publicScopeKey, type PublicScope } from '@/subapps/catalog/public/public-scopes-of-write';

export function publicOutboxRef(db: Firestore, companyId: string, scope: PublicScope): DocumentReference {
  const id = generateDeterministicCatalogPublicOutboxId(companyId, publicScopeKey(scope));
  return db.collection(COLLECTIONS.CATALOG_PUBLIC_OUTBOX).doc(id);
}

/** Μία αύξηση ανά προβολή, **μετά** από όλες τις αναγνώσεις της συναλλαγής (κανόνας Firestore). */
export function signalPublicScopesInTx(tx: Transaction, db: Firestore, companyId: string, scopes: readonly PublicScope[]): void {
  for (const scope of scopes) {
    tx.set(
      publicOutboxRef(db, companyId, scope),
      { companyId, scope: publicScopeKey(scope), revision: FieldValue.increment(1), changedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
}
