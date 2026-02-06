/**
 * 🛠️ UTILITY: REAL DATABASE UPDATE
 *
 * Creates real contacts and links sold units to them.
 *
 * @module api/units/real-update
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 *
 * @rateLimit STANDARD (60 req/min) - Real database update utility
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { UNIT_SALE_STATUS } from '@/constants/property-statuses-enterprise';
import { BUILDING_IDS } from '@/config/building-ids-config';
import { CONTACT_INFO, ContactInfoUtils } from '@/config/contact-info-config';
import { COLLECTIONS } from '@/config/firestore-collections';

// Response types for type-safe withAuth
type RealUpdateSuccess = {
  success: true;
  message: string;
  linkedUnits: number;
  updates: Array<{
    unitId: string;
    unitName: string;
    contactId: string;
    contactName: string;
  }>;
  contactsCreated: number;
  attempted: number;
};

type RealUpdateError = {
  success: false;
  error: string;
  details?: string;
};

type RealUpdateResponse = RealUpdateSuccess | RealUpdateError;

const postHandler = async (request: NextRequest) => {
  const handler = withAuth<RealUpdateResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<RealUpdateResponse>> => {
      try {
        console.log('🔥 [Units/RealUpdate] Starting Admin SDK operations...');
        console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole}), Company ${ctx.companyId}`);

        // ============================================================================
        // STEP 1: FIND SOLD UNITS WITHOUT CUSTOMERS (Admin SDK)
        // ============================================================================

        console.log('🔍 Finding sold units without customers...');
        const unitsSnapshot = await getAdminFirestore().collection(COLLECTIONS.UNITS).get();

        const soldUnitsToUpdate: Array<{ id: string; name: string }> = [];
        unitsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const status = data.status;
          const soldTo = data.soldTo;
          const name = data.name;

          if (status === 'sold' && (!soldTo || soldTo === UNIT_SALE_STATUS.NOT_SOLD)) {
            soldUnitsToUpdate.push({
              id: doc.id,
              name: name || 'Unknown Unit'
            });
          }
        });

        console.log(`🎯 Found ${soldUnitsToUpdate.length} sold units to update`);

        if (soldUnitsToUpdate.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No units need update',
            linkedUnits: 0,
            updates: [],
            contactsCreated: 0,
            attempted: 0
          });
        }

        // ============================================================================
        // STEP 2: GENERATE AND CREATE CONTACTS (Admin SDK)
        // ============================================================================

        console.log('👥 Creating real contacts in database...');
        const contacts = ContactInfoUtils.generateSampleContacts(8).map((contact, index) => ({
          id: `real_contact_${index + 1}`,
          name: contact.fullName,
          email: contact.email
        }));

        const createdContacts = [];

        for (const contact of contacts) {
          try {
            await getAdminFirestore().collection(COLLECTIONS.CONTACTS).doc(contact.id).set({
              firstName: contact.name.split(' ')[0],
              lastName: contact.name.split(' ').slice(1).join(' '),
              email: contact.email,
              phone: CONTACT_INFO.DEMO_PHONE_MOBILE,
              createdAt: new Date().toISOString(),
              projectId: BUILDING_IDS.PROJECT_ID.toString(),
              type: 'customer'
            });

            createdContacts.push(contact);
            console.log(`✅ Contact created: ${contact.name}`);

          } catch (error) {
            // If contact already exists (409), that's OK
            if (error && typeof error === 'object' && 'code' in error && error.code === 6) {
              createdContacts.push(contact);
              console.log(`✅ Contact already exists: ${contact.name}`);
            } else {
              console.error(`❌ Error creating contact ${contact.name}:`, error);
            }
          }
        }

        console.log(`✅ Created/verified ${createdContacts.length} contacts`);

        // ============================================================================
        // STEP 3: UPDATE UNITS WITH CONTACT IDS (Admin SDK)
        // ============================================================================

        console.log('🏠 Updating units with real contact IDs...');
        const updatedUnits = [];

        for (let i = 0; i < soldUnitsToUpdate.length; i++) {
          const unit = soldUnitsToUpdate[i];
          const contact = createdContacts[i % createdContacts.length];

          if (!contact) continue;

          try {
            await getAdminFirestore().collection(COLLECTIONS.UNITS).doc(unit.id).update({
              soldTo: contact.id
            });

            updatedUnits.push({
              unitId: unit.id,
              unitName: unit.name,
              contactId: contact.id,
              contactName: contact.name
            });

            console.log(`✅ REAL UPDATE: Unit "${unit.name}" → Contact "${contact.name}"`);

          } catch (error) {
            console.error(`❌ Error updating unit ${unit.name}:`, error);
          }
        }

        console.log(`✅ [Units/RealUpdate] Complete: Updated ${updatedUnits.length} units`);

        return NextResponse.json({
          success: true,
          message: `REAL DATABASE UPDATE: Successfully linked ${updatedUnits.length} units to contacts!`,
          linkedUnits: updatedUnits.length,
          updates: updatedUnits,
          contactsCreated: createdContacts.length,
          attempted: soldUnitsToUpdate.length
        });

      } catch (error) {
        console.error('❌ [Units/RealUpdate] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to perform real database update',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
};

export const POST = withStandardRateLimit(postHandler);
