/**
 * =============================================================================
 * POST /api/sales/{propertyId}/appurtenance-sync — Sync parking/storage status
 * =============================================================================
 *
 * Updates commercialStatus and commercial data on linked parking/storage
 * spaces when a unit is reserved, sold, or reverted.
 *
 * Uses Firestore batch writes for atomicity.
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/sales/[propertyId]/appurtenance-sync
 * @see ADR-199 Sales Appurtenances
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';

// =============================================================================
// TYPES
// =============================================================================

type SyncAction = 'reserve' | 'sell' | 'revert';

interface SyncSpacePayload {
  spaceId: string;
  spaceType: 'parking' | 'storage';
  salePrice?: number | null;
}

interface SyncRequestBody {
  action: SyncAction;
  spaces: SyncSpacePayload[];
  /** ADR-244: owners[] SSoT — propagated to linked spaces */
  owners?: Array<{
    contactId: string;
    name: string;
    ownershipPct: number;
    role: string;
    paymentPlanId: string | null;
  }> | null;
  /** ADR-244: Flat contactId array for Firestore array-contains queries */
  ownerContactIds?: string[] | null;
}

const VALID_ACTIONS: readonly SyncAction[] = ['reserve', 'sell', 'revert'];

// =============================================================================
// VALIDATION
// =============================================================================

function validateBody(body: Partial<SyncRequestBody>): string | null {
  if (!body.action || !VALID_ACTIONS.includes(body.action)) {
    return 'action must be one of: reserve, sell, revert';
  }
  if (!Array.isArray(body.spaces) || body.spaces.length === 0) {
    return 'spaces must be a non-empty array';
  }
  for (const space of body.spaces) {
    if (!space.spaceId?.trim()) return 'Each space must have a spaceId';
    if (space.spaceType !== 'parking' && space.spaceType !== 'storage') {
      return 'spaceType must be "parking" or "storage"';
    }
  }
  return null;
}

// =============================================================================
// COLLECTION RESOLVER
// =============================================================================

function getCollectionName(spaceType: 'parking' | 'storage'): string {
  return spaceType === 'parking' ? COLLECTIONS.PARKING_SPACES : COLLECTIONS.STORAGE;
}

// =============================================================================
// POST — Sync appurtenance status
// =============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ propertyId: string }> }
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { propertyId } = await segmentData!.params;
        const body = (await req.json()) as Partial<SyncRequestBody>;

        const validationError = validateBody(body);
        if (validationError) {
          return NextResponse.json(
            { success: false, error: validationError },
            { status: 400 }
          );
        }

        const { action, spaces } = body as SyncRequestBody;

        await safeFirestoreOperation(async (db) => {
          // Validate area > 0 for reserve/sell (not revert)
          if (action !== 'revert') {
            for (const space of spaces) {
              const col = getCollectionName(space.spaceType);
              const spaceDoc = await db.collection(col).doc(space.spaceId).get();
              const spaceArea = (spaceDoc.data()?.area as number) ?? 0;
              if (spaceArea <= 0) {
                throw new Error(
                  `Space ${space.spaceId} has no area (0 sqm) — cannot include in transaction`
                );
              }
            }
          }

          const batch = db.batch();
          const now = new Date().toISOString();

          for (const space of spaces) {
            const collection = getCollectionName(space.spaceType);
            const docRef = db.collection(collection).doc(space.spaceId);

            switch (action) {
              case 'reserve':
                batch.update(docRef, {
                  commercialStatus: 'reserved',
                  'commercial.owners': body.owners ?? null,
                  'commercial.ownerContactIds': body.ownerContactIds ?? null,
                  'commercial.askingPrice': space.salePrice ?? null,
                  'commercial.reservationDate': now,
                  'commercial.linkedPropertyId': propertyId,
                });
                break;

              case 'sell':
                batch.update(docRef, {
                  commercialStatus: 'sold',
                  'commercial.owners': body.owners ?? null,
                  'commercial.ownerContactIds': body.ownerContactIds ?? null,
                  'commercial.finalPrice': space.salePrice ?? null,
                  'commercial.saleDate': now,
                  'commercial.linkedPropertyId': propertyId,
                });
                break;

              case 'revert':
                batch.update(docRef, {
                  commercialStatus: null,
                  'commercial.owners': null,
                  'commercial.ownerContactIds': null,
                  'commercial.askingPrice': null,
                  'commercial.finalPrice': null,
                  'commercial.reservationDeposit': null,
                  'commercial.reservationDate': null,
                  'commercial.saleDate': null,
                  'commercial.linkedPropertyId': null,
                });
                break;
            }
          }

          await batch.commit();
        }, undefined);

        // Audit trail: appurtenance sync
        const actionLabels: Record<SyncAction, string> = {
          reserve: 'Κράτηση',
          sell: 'Πώληση',
          revert: 'Επαναφορά',
        };
        const spaceTypeLabels = { parking: 'Παρκινγκ', storage: 'Αποθήκη' };
        safeFireAndForget(EntityAuditService.recordChange({
          entityType: ENTITY_TYPES.PROPERTY,
          entityId: propertyId,
          entityName: null,
          action: 'updated',
          changes: spaces.map((s) => ({
            field: s.spaceType,
            oldValue: null,
            newValue: `${s.spaceId.slice(0, 8)}… — ${actionLabels[action]}`,
            label: spaceTypeLabels[s.spaceType],
          })),
          performedBy: ctx.uid,
          performedByName: ctx.email ?? null,
          companyId: ctx.companyId,
        }), 'AppurtenanceSync.auditTrail');

        return NextResponse.json({
          success: true,
          message: `Synced ${spaces.length} space(s) with action: ${action}`,
          propertyId,
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to sync appurtenances');
        console.error('[appurtenance-sync] Error:', message);
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
