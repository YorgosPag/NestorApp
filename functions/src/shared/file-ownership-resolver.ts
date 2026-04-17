/**
 * =============================================================================
 * CLOUD FUNCTIONS: File Ownership Resolver (SSoT)
 * =============================================================================
 *
 * Single Source of Truth for answering: "does this fileId have an owner?"
 *
 * WHY:
 * File ownership is NOT exclusive to the `FILES` collection. Different
 * domains claim ownership in domain-specific collections (e.g. showcase
 * PDFs live only in `FILE_SHARES` per ADR-312). Hardcoding a single
 * collection in orphan cleanup causes legitimate files to be mis-classified
 * as orphans and deleted (incident 2026-04-17: showcase PDF proxy 500s
 * because `onStorageFinalize` was deleting the just-uploaded PDF).
 *
 * DESIGN:
 * - `OWNERSHIP_CLAIM_PROVIDERS` is the SSoT registry of collections that
 *   can claim a fileId. Adding a new owner class = add ONE entry here.
 * - Lookup is short-circuit: the first provider returning a record wins.
 * - Each provider defines how to map `fileId` → `docId` (identity by default).
 *
 * WHEN TO EXTEND:
 * - A new file-producing system that does NOT write to `FILES`? Add a
 *   provider here — do NOT hardcode ownership checks elsewhere. Always go
 *   through `findFileOwner()`.
 *
 * @module functions/shared/file-ownership-resolver
 * @enterprise SSoT for cross-collection file ownership — ADR-031, ADR-312
 */

import * as admin from 'firebase-admin';
import { COLLECTIONS } from '../config/firestore-collections';

export interface FileOwnershipClaim {
  readonly provider: string;
  readonly collection: string;
  readonly docId: string;
}

interface OwnershipProvider {
  readonly name: string;
  readonly collection: string;
  readonly idFrom: (fileId: string) => string;
}

const OWNERSHIP_CLAIM_PROVIDERS: ReadonlyArray<OwnershipProvider> = [
  // PRIMARY: canonical FileRecord (ADR-031 — Canonical File Storage System)
  { name: 'files', collection: COLLECTIONS.FILES, idFrom: (id) => id },
  // SECONDARY: showcase PDF shares — no FileRecord by design (ADR-312)
  { name: 'file_shares', collection: COLLECTIONS.FILE_SHARES, idFrom: (id) => id },
];

export async function findFileOwner(
  db: admin.firestore.Firestore,
  fileId: string
): Promise<FileOwnershipClaim | null> {
  for (const provider of OWNERSHIP_CLAIM_PROVIDERS) {
    const docId = provider.idFrom(fileId);
    const snap = await db.collection(provider.collection).doc(docId).get();
    if (snap.exists) {
      return {
        provider: provider.name,
        collection: provider.collection,
        docId,
      };
    }
  }
  return null;
}
