/**
 * =============================================================================
 * SHOWCASE CORE — Public share-token lookup, once
 * =============================================================================
 *
 * Resolving `?token=` to a live share was written **six times** across the
 * public showcase routes (4 payload + 2 PDF): same `shares` query, same field
 * plucking, same null-guards, differing only in an `entityType` string.
 *
 * ## Two query shapes existed — this module picks the indexed one
 *
 * | route family | query |
 * |---|---|
 * | payload (building/project/parking/storage) | `token == ` + `isActive == `, then `entityType` checked in code |
 * | PDF (building/project) | `token == ` + `entityType == ` + `isActive == ` |
 *
 * `firestore.indexes.json` declares **`[token + isActive]`** and **no**
 * `[token + entityType + isActive]`. The PDF variant survives only on
 * Firestore's zigzag merge join for equality-only conjunctions — an
 * optimisation, not a declared guarantee. This module therefore queries the
 * **explicitly indexed** pair and discriminates `entityType` in code, so no
 * public link can ever start answering `FAILED_PRECONDITION` because a merge
 * join was not chosen.
 *
 * ## Why `limit(2)` and not `limit(1)`
 *
 * Both originals took `docs[0]`. With `limit(1)` and no `entityType` filter,
 * the payload routes would hand back the *wrong* share if a token ever
 * resolved to two active shares — a data bug that would surface as one tenant's
 * showcase served under another's link. Fetching two lets us pick by
 * `entityType` **and** log the anomaly instead of silently mis-serving. Tokens
 * are unique in practice, so this costs one extra document read on a path that
 * already reads several.
 *
 * @module services/showcase-core/api/public-share-lookup
 * @enterprise ADR-698 — Public Showcase Token Surface SSoT
 * @see ADR-315 Unified Sharing · ADR-321 Showcase Core
 */

import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { Logger } from '@/lib/telemetry/Logger';

/** A live share resolved from a public token. */
export interface PublicShowcaseShare {
  /** Share document id — needed to increment the access counter. */
  id: string;
  entityId: string;
  companyId: string;
  expiresAt: string;
  /** Present only when the showcase has a generated PDF. */
  pdfStoragePath?: string;
}

export interface LookupPublicShowcaseShareParams {
  token: string;
  /** Share discriminator, e.g. `'building_showcase'`. */
  entityType: string;
  adminDb: Firestore;
  logger: Logger;
  /** When true, a share without `showcaseMeta.pdfStoragePath` resolves to `null`. */
  requirePdfPath?: boolean;
}

/**
 * Resolve a public showcase token to its share, or `null`.
 *
 * `null` covers every "no usable share" case — wrong entity type, missing
 * required field, no match — because all six originals collapsed those into the
 * same 404. Expiry is **not** checked here: the callers answer 410 for that and
 * need the `expiresAt` value to do it.
 */
export async function lookupPublicShowcaseShare({
  token,
  entityType,
  adminDb,
  logger,
  requirePdfPath = false,
}: LookupPublicShowcaseShareParams): Promise<PublicShowcaseShare | null> {
  const snap = await adminDb
    .collection(COLLECTIONS.SHARES)
    .where('token', '==', token)
    .where('isActive', '==', true)
    .limit(2)
    .get();

  if (snap.empty) return null;

  if (snap.size > 1) {
    logger.warn('Public showcase token resolved to more than one active share', {
      token,
      entityType,
      shareIds: snap.docs.map(doc => doc.id),
    });
  }

  const match = snap.docs.find(doc => doc.data().entityType === entityType);
  if (!match) return null;

  const data = match.data() as Record<string, unknown>;
  const entityId = data.entityId as string | undefined;
  const companyId = data.companyId as string | undefined;
  const expiresAt = data.expiresAt as string | undefined;

  if (!entityId || !companyId || !expiresAt) return null;

  const showcaseMeta = (data.showcaseMeta ?? {}) as { pdfStoragePath?: string };
  const pdfStoragePath = showcaseMeta.pdfStoragePath;

  if (requirePdfPath && !pdfStoragePath) return null;

  return { id: match.id, entityId, companyId, expiresAt, pdfStoragePath };
}

/**
 * Bump a unified share's access counter.
 *
 * `FieldValue.increment` rather than read-then-write: the counter is touched
 * from anonymous traffic, so two concurrent viewers must not lose a count.
 * (The property surface keeps its own read-then-write dual-write against the
 * legacy `file_shares` collection — see ADR-698 §4.)
 */
export async function incrementPublicShareAccess(
  shareId: string,
  adminDb: Firestore,
): Promise<void> {
  await adminDb
    .collection(COLLECTIONS.SHARES)
    .doc(shareId)
    .update({ accessCount: FieldValue.increment(1) });
}
