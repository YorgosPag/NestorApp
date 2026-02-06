/**
 * 🛠️ UTILITY: FORCE UPDATE UNITS
 *
 * Force updates sold units without customers by linking them to available contacts.
 *
 * @module api/units/force-update
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
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

// Response types for type-safe withAuth
type ForceUpdateSuccess = {
  success: true;
  message: string;
  updatesApplied: number;
  updatesFailed: number;
  successfulUpdates: Array<{
    unitId: string;
    unitName: string;
    contactId: string;
    previousSoldTo: string;
  }>;
  failedUpdates: Array<{
    unitId: string;
    unitName: string;
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
        console.log('💥 [Units/ForceUpdate] Starting Admin SDK operations...');
        console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole}), Company ${ctx.companyId}`);

        // ============================================================================
        // STEP 1: FIND SOLD UNITS THAT NEED UPDATE (Admin SDK)
        // ============================================================================

        console.log('🔍 Finding sold units without customers...');
        const unitsSnapshot = await getAdminFirestore().collection(COLLECTIONS.UNITS).get();

        // 🏢 ENTERPRISE: Explicit type annotation to avoid implicit any[]
        const unitsToUpdate: Array<{ id: string; name: string; currentSoldTo: string }> = [];
        unitsSnapshot.docs.forEach((doc, index) => {
          const fields = doc.data();
          const status = fields.status;
          const soldTo = fields.soldTo;
          const name = fields.name;

          if (status === 'sold' && (!soldTo || soldTo === UNIT_SALE_STATUS.NOT_SOLD)) {
            unitsToUpdate.push({
              id: doc.id,
              name: (name as string) || `Unit ${index + 1}`,
              currentSoldTo: (soldTo as string) || 'null'
            });
          }
        });

        console.log(`🎯 Found ${unitsToUpdate.length} units to update`);

        if (unitsToUpdate.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No units need update',
            updatesApplied: 0,
            updatesFailed: 0,
            successfulUpdates: [],
            failedUpdates: []
          });
        }

        // ============================================================================
        // STEP 2: LOAD AVAILABLE CONTACT IDS (Admin SDK)
        // ============================================================================

        console.log('🔍 Loading available contact IDs from database...');
        const contactsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.CONTACTS)
          .where('type', '==', 'individual')
          .limit(8)
          .get();

        if (contactsSnapshot.empty) {
          return NextResponse.json({
            success: false,
            error: 'No individual contacts found in database',
            suggestion: 'Create contacts before linking units'
          }, { status: 404 });
        }

        const contactIds = contactsSnapshot.docs.map(doc => doc.id);
        console.log(`✅ Loaded ${contactIds.length} contact IDs from database`);

        // ============================================================================
        // STEP 3: UPDATE UNITS ONE BY ONE (Admin SDK)
        // ============================================================================

        const successfulUpdates = [];
        const failedUpdates = [];

        for (let i = 0; i < unitsToUpdate.length; i++) {
          const unit = unitsToUpdate[i];
          const contactId = contactIds[i % contactIds.length];

          try {
            console.log(`🔄 Updating unit ${unit.name} (${unit.id}) → ${contactId}`);

            await getAdminFirestore().collection(COLLECTIONS.UNITS).doc(unit.id).update({
              soldTo: contactId
            });

            successfulUpdates.push({
              unitId: unit.id,
              unitName: unit.name,
              contactId: contactId,
              previousSoldTo: unit.currentSoldTo
            });

            console.log(`✅ SUCCESS: Unit ${unit.name} updated successfully!`);

          } catch (error) {
            console.error(`❌ ERROR updating unit ${unit.name}:`, error);
            failedUpdates.push({
              unitId: unit.id,
              unitName: unit.name,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        console.log(`✅ [Units/ForceUpdate] Complete: ${successfulUpdates.length} successful, ${failedUpdates.length} failed`);

        return NextResponse.json({
          success: true,
          message: `FORCE UPDATE: ${successfulUpdates.length} units updated successfully!`,
          updatesApplied: successfulUpdates.length,
          updatesFailed: failedUpdates.length,
          successfulUpdates: successfulUpdates,
          failedUpdates: failedUpdates
        });

      } catch (error) {
        console.error('❌ [Units/ForceUpdate] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Force update failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  ));

  return handler(request);
}
