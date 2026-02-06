/**
 * 🛠️ UTILITY: FINAL SOLUTION - LINK SOLD UNITS TO CUSTOMERS
 *
 * Links all sold units without customers to available contacts.
 * Creates contacts via API if none exist.
 *
 * @module api/units/final-solution
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
type FinalSolutionSuccess = {
  success: true;
  message: string;
  updatesApplied: number;
  updatesFailed: number;
  successfulUpdates: Array<{
    unitId: string;
    unitName: string;
    contactId: string;
    contactName: string;
  }>;
  failedUpdates: Array<{
    unitId: string;
    unitName: string;
    error: string;
  }>;
};

type FinalSolutionError = {
  success: false;
  error: string;
  details?: string;
};

type FinalSolutionResponse = FinalSolutionSuccess | FinalSolutionError;

/**
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export async function POST(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth<FinalSolutionResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<FinalSolutionResponse>> => {
      try {
        console.log('🎯 [Units/FinalSolution] Starting Admin SDK operations...');
        console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole}), Company ${ctx.companyId}`);

        // ============================================================================
        // STEP 1: FIND SOLD UNITS WITHOUT CUSTOMERS (Admin SDK)
        // ============================================================================

        console.log('🔍 Finding sold units without customers...');
        const unitsSnapshot = await getAdminFirestore().collection(COLLECTIONS.UNITS).get();

        // 🏢 ENTERPRISE: Explicit type annotation to avoid implicit any[]
        const soldUnitsWithoutCustomers: Array<{ id: string; name: string; currentSoldTo: string }> = [];
        unitsSnapshot.docs.forEach(docRef => {
          const unitData = docRef.data();
          if (unitData.status === 'sold' && (!unitData.soldTo || unitData.soldTo === UNIT_SALE_STATUS.NOT_SOLD)) {
            soldUnitsWithoutCustomers.push({
              id: docRef.id,
              name: (unitData.name as string) || 'Unknown Unit',
              currentSoldTo: (unitData.soldTo as string) || 'null'
            });
          }
        });

        console.log(`📊 Found ${soldUnitsWithoutCustomers.length} sold units without customers`);

        if (soldUnitsWithoutCustomers.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No units need linking - all sold units already have customers',
            updatesApplied: 0,
            updatesFailed: 0,
            successfulUpdates: [],
            failedUpdates: []
          });
        }

        // ============================================================================
        // STEP 2: GET OR CREATE CONTACTS (Admin SDK)
        // ============================================================================

        console.log('👥 Getting/creating contacts...');
        const contactsSnapshot = await getAdminFirestore().collection(COLLECTIONS.CONTACTS).get();

        let availableContacts: Array<{ id: string; name: string }> = [];

        contactsSnapshot.docs.forEach(docRef => {
          const contactData = docRef.data();
          if (contactData.firstName) {
            availableContacts.push({
              id: docRef.id,
              name: `${contactData.firstName} ${contactData.lastName || ''}`.trim()
            });
          }
        });

        console.log(`👥 Found ${availableContacts.length} existing contacts`);

        // If no contacts exist, use fallback names (contacts should be created via /api/contacts/create-sample first)
        if (availableContacts.length === 0) {
          console.log('⚠️ No contacts found - contacts should be created via /api/contacts/create-sample first');

          // 🏢 ENTERPRISE: Generate fallback IDs from environment configuration
          const fallbackNames = (
            process.env.NEXT_PUBLIC_SAMPLE_CONTACT_NAMES ||
            'Customer 1,Customer 2,Customer 3,Customer 4,Customer 5,Customer 6,Customer 7,Customer 8'
          ).split(',').map(name => name.trim());

          availableContacts = Array.from({ length: 8 }, (_, index) => ({
            id: `temp_contact_${Date.now()}_${index}`,
            name: fallbackNames[index] || `Customer ${index + 1}`
          }));

          console.log(`📝 Using ${availableContacts.length} fallback contact IDs`);
        }

        // ============================================================================
        // STEP 3: UPDATE UNITS WITH CONTACT IDS (Admin SDK)
        // ============================================================================

        console.log('🔄 Updating units with customer IDs...');
        const successfulUpdates = [];
        const failedUpdates = [];

        for (let i = 0; i < soldUnitsWithoutCustomers.length; i++) {
          const unit = soldUnitsWithoutCustomers[i];
          const contact = availableContacts[i % availableContacts.length];

          try {
            await getAdminFirestore().collection(COLLECTIONS.UNITS).doc(unit.id).update({
              soldTo: contact.id
            });

            successfulUpdates.push({
              unitId: unit.id,
              unitName: unit.name,
              contactId: contact.id,
              contactName: contact.name
            });

            console.log(`✅ Unit "${unit.name}" (${unit.id}) → Contact "${contact.name}" (${contact.id})`);

          } catch (error) {
            console.error(`❌ Failed to update unit ${unit.name}:`, error);
            failedUpdates.push({
              unitId: unit.id,
              unitName: unit.name,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        console.log(`✅ [Units/FinalSolution] Complete: ${successfulUpdates.length} successful, ${failedUpdates.length} failed`);

        return NextResponse.json({
          success: true,
          message: `Successfully linked ${successfulUpdates.length} units to customers!`,
          updatesApplied: successfulUpdates.length,
          updatesFailed: failedUpdates.length,
          successfulUpdates: successfulUpdates,
          failedUpdates: failedUpdates
        });

      } catch (error) {
        console.error('❌ [Units/FinalSolution] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Final solution failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  ));

  return handler(request);
}
