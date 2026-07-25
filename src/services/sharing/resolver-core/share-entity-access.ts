/**
 * =============================================================================
 * SHARE ENTITY ACCESS — the one Firestore read every resolver performs (ADR-699)
 * =============================================================================
 *
 * Two document reads were retyped in all seven resolvers:
 *
 *   - `resolve` loads the shared entity to build its public summary, and warns
 *     (rather than throws) when the share outlives its entity.
 *   - `canShare` loads it again to check the caller's company owns it.
 *
 * ## Why this does NOT use `lib/auth/tenant-isolation` (ADR-255)
 *
 * That module answers the same question — *does this document belong to the
 * caller's tenant?* — but on the other side of the wire: Admin SDK,
 * `AuthContext`, audit events, and it **throws**. Resolvers run in the browser
 * against the client SDK with an `AuthorizedUser`, and their contract is a
 * `Promise<boolean>` feeding a disabled/enabled share button.
 *
 * Merging the two would mean either dragging `firebase-admin` into a client
 * bundle or weakening the server guard to a boolean. They are two doctrines on
 * purpose — the same distinction `tenant-scope.ts` draws against
 * `super-admin-scope.ts`. Keep them apart.
 *
 * @module services/sharing/resolver-core/share-entity-access
 * @see adrs/ADR-699-share-resolver-declarations.md
 * @see lib/auth/tenant-isolation — server-side equivalent (ADR-255), do not merge
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Logger } from '@/lib/telemetry/Logger';
import type { AuthorizedUser, ShareRecord } from '@/types/sharing';

/**
 * Load the entity a share points at.
 *
 * Returns `null` instead of throwing when the document is gone: a share whose
 * entity was deleted must still render (expired/empty state), and the public
 * route has no user to show an error to. The warning is the signal.
 */
export async function loadSharedEntityDoc(params: {
  collection: string;
  share: ShareRecord;
  logger: Logger;
  /** Warning emitted when the entity is missing — kept per-surface for log greps. */
  missingMessage: string;
}): Promise<Record<string, unknown> | null> {
  const { collection, share, logger, missingMessage } = params;

  const snap = await getDoc(doc(db, collection, share.entityId));
  if (!snap.exists()) {
    logger.warn(missingMessage, {
      shareId: share.id,
      entityType: share.entityType,
      entityId: share.entityId,
    });
    return null;
  }
  return snap.data() as Record<string, unknown>;
}

/**
 * Build the `canShare` guard for a collection: the caller may share an entity
 * only while authenticated *and* in the entity's own company.
 *
 * An absent document answers `false` — you cannot share what does not exist,
 * and returning `false` (not "not found") keeps the endpoint from confirming
 * another tenant's ids.
 */
export function createTenantOwnershipGuard(
  collection: string,
): (user: AuthorizedUser, entityId: string) => Promise<boolean> {
  return async function canShare(user, entityId) {
    if (!user?.uid || !user?.companyId) return false;
    const snap = await getDoc(doc(db, collection, entityId));
    if (!snap.exists()) return false;
    return (snap.data() as { companyId?: string }).companyId === user.companyId;
  };
}
