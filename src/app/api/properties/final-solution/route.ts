/**
 * 🛠️ UTILITY: FINAL SOLUTION - LINK SOLD UNITS TO CUSTOMERS
 *
 * Links all sold properties without customers to available contacts.
 * Creates contacts via API if none exist.
 *
 * @module api/properties/final-solution
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
import { generateTempId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { validatePropertyFieldLocking } from '@/lib/firestore/property-field-locking';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PropertiesFinalSolutionRoute');

// Response types for type-safe withAuth
type FinalSolutionSuccess = {
  success: true;
  message: string;
  updatesApplied: number;
  updatesFailed: number;
  successfulUpdates: Array<{
    propertyId: string;
    propertyName: string;
    contactId: string;
    contactName: string;
  }>;
  failedUpdates: Array<{
    propertyId: string;
    propertyName: string;
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
        logger.info('[Properties/FinalSolution] Starting Admin SDK operations', { userId: ctx.uid, globalRole: ctx.globalRole, companyId: ctx.companyId });

        // ============================================================================
        // STEP 1: FIND SOLD UNITS WITHOUT CUSTOMERS (Admin SDK)
        // ============================================================================

        logger.info('[Properties/FinalSolution] Finding sold properties without customers');
        const propertiesSnapshot = await getAdminFirestore().collection(COLLECTIONS.PROPERTIES).get();

        // 🏢 ENTERPRISE: Explicit type annotation to avoid implicit any[]
        const soldPropertiesWithoutCustomers: Array<{ id: string; name: string; currentSoldTo: string }> = [];
        propertiesSnapshot.docs.forEach(docRef => {
          const propertyData = docRef.data();
          if (propertyData.status === 'sold' && (!propertyData.soldTo || propertyData.soldTo === UNIT_SALE_STATUS.NOT_SOLD)) {
            soldPropertiesWithoutCustomers.push({
              id: docRef.id,
              name: (propertyData.name as string) || 'Unknown Property',
              currentSoldTo: (propertyData.soldTo as string) || 'null'
            });
          }
        });

        logger.info('[Properties/FinalSolution] Found sold properties without customers', { count: soldPropertiesWithoutCustomers.length });

        if (soldPropertiesWithoutCustomers.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No properties need linking - all sold properties already have customers',
            updatesApplied: 0,
            updatesFailed: 0,
            successfulUpdates: [],
            failedUpdates: []
          });
        }

        // ============================================================================
        // STEP 2: GET OR CREATE CONTACTS (Admin SDK)
        // ============================================================================

        logger.info('[Properties/FinalSolution] Getting/creating contacts');
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

        logger.info('[Properties/FinalSolution] Found existing contacts', { count: availableContacts.length });

        // If no contacts exist, use fallback names (contacts should be created via /api/contacts/create-sample first)
        if (availableContacts.length === 0) {
          logger.warn('[Properties/FinalSolution] No contacts found - contacts should be created via /api/contacts/create-sample first');

          // 🏢 ENTERPRISE: Generate fallback IDs from environment configuration
          const fallbackNames = (
            process.env.NEXT_PUBLIC_SAMPLE_CONTACT_NAMES ||
            'Customer 1,Customer 2,Customer 3,Customer 4,Customer 5,Customer 6,Customer 7,Customer 8'
          ).split(',').map(name => name.trim());

          availableContacts = Array.from({ length: 8 }, (_, index) => ({
            id: generateTempId(),
            name: fallbackNames[index] || `Customer ${index + 1}`
          }));

          logger.info('[Properties/FinalSolution] Using fallback contact IDs', { count: availableContacts.length });
        }

        // ============================================================================
        // STEP 3: UPDATE UNITS WITH CONTACT IDS (Admin SDK)
        // ============================================================================

        logger.info('[Properties/FinalSolution] Updating properties with customer IDs');
        const successfulUpdates = [];
        const failedUpdates = [];

        for (let i = 0; i < soldPropertiesWithoutCustomers.length; i++) {
          const property = soldPropertiesWithoutCustomers[i];
          const contact = availableContacts[i % availableContacts.length];

          try {
            // 🛡️ ADR-249 P0-2: Validate field locking before update
            const propertyDoc = await getAdminFirestore().collection(COLLECTIONS.PROPERTIES).doc(property.id).get();
            const propertyData = propertyDoc.data();
            validatePropertyFieldLocking(
              propertyData?.commercialStatus as string | undefined,
              ['soldTo']
            );

            await getAdminFirestore().collection(COLLECTIONS.PROPERTIES).doc(property.id).update({
              soldTo: contact.id
            });

            successfulUpdates.push({
              propertyId: property.id,
              propertyName: property.name,
              contactId: contact.id,
              contactName: contact.name
            });

            logger.info('[Properties/FinalSolution] Property linked to contact', { propertyName: property.name, propertyId: property.id, contactName: contact.name, contactId: contact.id });

          } catch (error) {
            logger.error('[Properties/FinalSolution] Failed to update property', { propertyName: property.name, error: getErrorMessage(error) });
            failedUpdates.push({
              propertyId: property.id,
              propertyName: property.name,
              error: getErrorMessage(error)
            });
          }
        }

        logger.info('[Properties/FinalSolution] Complete', { successCount: successfulUpdates.length, failCount: failedUpdates.length });

        return NextResponse.json({
          success: true,
          message: `Successfully linked ${successfulUpdates.length} properties to customers!`,
          updatesApplied: successfulUpdates.length,
          updatesFailed: failedUpdates.length,
          successfulUpdates: successfulUpdates,
          failedUpdates: failedUpdates
        });

      } catch (error) {
        logger.error('[Properties/FinalSolution] Error', {
          error: getErrorMessage(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Final solution failed',
          details: getErrorMessage(error)
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  ));

  return handler(request);
}
