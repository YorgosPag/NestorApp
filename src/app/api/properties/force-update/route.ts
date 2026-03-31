/**
 * 🛠️ UTILITY: FORCE UPDATE UNITS
 *
 * Force updates sold properties without customers by linking them to available contacts.
 *
 * @module api/properties/force-update
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { UNIT_SALE_STATUS } from '@/constants/property-statuses-enterprise';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { processAdminBatch, BATCH_SIZE_WRITE } from '@/lib/admin-batch-utils';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PropertiesForceUpdateRoute');

// Response types for type-safe withAuth
type ForceUpdateSuccess = {
  success: true;
  message: string;
  updatesApplied: number;
  updatesFailed: number;
  successfulUpdates: Array<{
    propertyId: string;
    propertyName: string;
    contactId: string;
    previousSoldTo: string;
  }>;
  failedUpdates: Array<{
    propertyId: string;
    propertyName: string;
    error: string;
  }>;
};

type ForceUpdateError = {
  success: false;
  error: string;
  details?: string;
  suggestion?: string;
};

type ForceUpdateResponse = ForceUpdateSuccess | ForceUpdateError;

/**
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export async function POST(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth<ForceUpdateResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<ForceUpdateResponse>> => {
      try {
        logger.info('[Properties/ForceUpdate] Starting Admin SDK operations', { userId: ctx.uid, globalRole: ctx.globalRole, companyId: ctx.companyId });

        // ============================================================================
        // STEP 1: FIND SOLD UNITS THAT NEED UPDATE (Admin SDK)
        // ============================================================================

        // ADR-214 Phase 8: Batch processing to prevent unbounded reads
        logger.info('[Properties/ForceUpdate] Finding sold properties without customers');
        const propertiesToUpdate: Array<{ id: string; name: string; currentSoldTo: string }> = [];
        let docIndex = 0;

        await processAdminBatch(
          getAdminFirestore().collection(COLLECTIONS.PROPERTIES),
          BATCH_SIZE_WRITE,
          (docs) => {
            for (const docSnap of docs) {
              const fields = docSnap.data();
              const status = fields.status;
              const soldTo = fields.soldTo;
              const name = fields.name;

              if (status === 'sold' && (!soldTo || soldTo === UNIT_SALE_STATUS.NOT_SOLD)) {
                propertiesToUpdate.push({
                  id: docSnap.id,
                  name: (name as string) || `Property ${docIndex + 1}`,
                  currentSoldTo: (soldTo as string) || 'null'
                });
              }
              docIndex++;
            }
          },
        );

        logger.info('[Properties/ForceUpdate] Found properties to update', { count: propertiesToUpdate.length });

        if (propertiesToUpdate.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No properties need update',
            updatesApplied: 0,
            updatesFailed: 0,
            successfulUpdates: [],
            failedUpdates: []
          });
        }

        // ============================================================================
        // STEP 2: LOAD AVAILABLE CONTACT IDS (Admin SDK)
        // ============================================================================

        logger.info('[Properties/ForceUpdate] Loading available contact IDs from database');
        const contactsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.CONTACTS)
          .where(FIELDS.TYPE, '==', 'individual')
          .limit(8)
          .get();

        if (contactsSnapshot.empty) {
          return NextResponse.json({
            success: false,
            error: 'No individual contacts found in database',
            suggestion: 'Create contacts before linking properties'
          }, { status: 404 });
        }

        const contactIds = contactsSnapshot.docs.map(doc => doc.id);
        logger.info('[Properties/ForceUpdate] Loaded contact IDs', { count: contactIds.length });

        // ============================================================================
        // STEP 3: UPDATE UNITS ONE BY ONE (Admin SDK)
        // ============================================================================

        const successfulUpdates = [];
        const failedUpdates = [];

        for (let i = 0; i < propertiesToUpdate.length; i++) {
          const property = propertiesToUpdate[i];
          const contactId = contactIds[i % contactIds.length];

          try {
            logger.info('[Properties/ForceUpdate] Updating property', { propertyName: property.name, propertyId: property.id, contactId });

            await getAdminFirestore().collection(COLLECTIONS.PROPERTIES).doc(property.id).update({
              soldTo: contactId
            });

            successfulUpdates.push({
              propertyId: property.id,
              propertyName: property.name,
              contactId: contactId,
              previousSoldTo: property.currentSoldTo
            });

            logger.info('[Properties/ForceUpdate] Property updated successfully', { propertyName: property.name });

          } catch (error) {
            logger.error('[Properties/ForceUpdate] Error updating property', { propertyName: property.name, error: getErrorMessage(error) });
            failedUpdates.push({
              propertyId: property.id,
              propertyName: property.name,
              error: getErrorMessage(error)
            });
          }
        }

        logger.info('[Properties/ForceUpdate] Complete', { successCount: successfulUpdates.length, failCount: failedUpdates.length });

        return NextResponse.json({
          success: true,
          message: `FORCE UPDATE: ${successfulUpdates.length} properties updated successfully!`,
          updatesApplied: successfulUpdates.length,
          updatesFailed: failedUpdates.length,
          successfulUpdates: successfulUpdates,
          failedUpdates: failedUpdates
        });

      } catch (error) {
        logger.error('[Properties/ForceUpdate] Error', {
          error: getErrorMessage(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Force update failed',
          details: getErrorMessage(error)
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  ));

  return handler(request);
}
