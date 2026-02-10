/**
 * 🛠️ UTILITY: ADMIN LINK UNITS TO CONTACTS
 *
 * Break-glass utility for creating contacts and linking to sold units.
 *
 * @module api/units/admin-link
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
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UnitsAdminLinkRoute');

// Response types for type-safe withAuth
type AdminLinkSuccess = {
  success: true;
  message: string;
  contactsCreated: number;
  linkedCount: number;
  updates: Array<{
    unitId: string;
    unitName: string;
    contactId: string;
    contactName: string;
  }>;
  createdContacts: Array<{ id: string; name: string }>;
};

type AdminLinkError = {
  success: false;
  error: string;
  details?: string;
  suggestion?: string;
};

type AdminLinkResponse = AdminLinkSuccess | AdminLinkError;

/**
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export async function POST(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth<AdminLinkResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<AdminLinkResponse>> => {
      try {
        logger.info('[Units/AdminLink] Starting Admin SDK operations', { userId: ctx.uid, globalRole: ctx.globalRole, companyId: ctx.companyId });

        const unitsSnapshot = await getAdminFirestore().collection(COLLECTIONS.UNITS).get();

        // Debug: Show all sold units and their soldTo values
        const allSoldUnits = unitsSnapshot.docs
          .map(doc => ({ id: doc.id, data: doc.data() }))
          .filter(unit => unit.data.status === 'sold');

        logger.info('[Units/AdminLink] DEBUG: Found sold units', { count: allSoldUnits.length });

        const soldUnitsToLink = unitsSnapshot.docs
          .map(doc => ({ id: doc.id, data: doc.data() }))
          .filter(unit => {
            const needsLinking = unit.data.status === 'sold' && (
              !unit.data.soldTo ||
              unit.data.soldTo === UNIT_SALE_STATUS.NOT_SOLD ||
              unit.data.soldTo === 'customer...' ||
              typeof unit.data.soldTo === 'string' && unit.data.soldTo.startsWith('customer')
            );
            return needsLinking;
          });

        logger.info('[Units/AdminLink] Units to link', { count: soldUnitsToLink.length });

        if (soldUnitsToLink.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No units need linking',
            contactsCreated: 0,
            linkedCount: 0,
            updates: [],
            createdContacts: []
          });
        }

        // Load real contact IDs from database
        const contactsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.CONTACTS)
          .where('type', '==', 'individual')
          .limit(8)
          .get();

        const realContactIds = contactsSnapshot.docs.map(doc => doc.id);

        if (realContactIds.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No individual contacts found in database',
            suggestion: 'Run /api/contacts/create-sample first to create contacts'
          }, { status: 404 });
        }

        const sampleContactNames = (
          process.env.NEXT_PUBLIC_SAMPLE_CONTACT_NAMES ||
          'Contact 1,Contact 2,Contact 3,Contact 4,Contact 5,Contact 6,Contact 7,Contact 8'
        ).split(',').map(name => name.trim());

        // Create contact records
        const createdContacts = [];
        for (let i = 0; i < sampleContactNames.length; i++) {
          const contactName = sampleContactNames[i];
          const contactId = realContactIds[i];

          try {
            const normalizedName = contactName.replace(/\s/g, '').toLowerCase();
            const emailDomain = process.env.NEXT_PUBLIC_TEST_EMAIL_DOMAIN || 'testcontacts.local';
            const phonePrefix = process.env.NEXT_PUBLIC_TEST_PHONE_PREFIX || '+30 21';

            await getAdminFirestore().collection(COLLECTIONS.CONTACTS).doc(contactId).set({
              firstName: contactName.split(' ')[0],
              lastName: contactName.split(' ')[1] || '',
              displayName: contactName,
              email: `${normalizedName}@${emailDomain}`,
              phone: `${phonePrefix}${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
              type: 'individual',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });

            createdContacts.push({ id: contactId, name: contactName });
          } catch (contactError) {
            logger.error('[Units/AdminLink] Failed to create contact', { contactName, error: contactError instanceof Error ? contactError.message : String(contactError) });
          }
        }

        // Link units to contacts
        let linked = 0;
        const updates = [];

        for (let i = 0; i < soldUnitsToLink.length; i++) {
          const unit = soldUnitsToLink[i];
          const contactId = realContactIds[i % realContactIds.length];
          const contactName = sampleContactNames[i % sampleContactNames.length];

          try {
            await getAdminFirestore().collection(COLLECTIONS.UNITS).doc(unit.id).update({
              soldTo: contactId
            });

            updates.push({
              unitId: unit.id,
              unitName: unit.data.name || 'Unknown Unit',
              contactId: contactId,
              contactName: contactName
            });

            linked++;
          } catch (updateError) {
            logger.error('[Units/AdminLink] Failed to update unit', { unitId: unit.id, error: updateError instanceof Error ? updateError.message : String(updateError) });
          }
        }

        logger.info('[Units/AdminLink] Complete', { linkedCount: linked });

        return NextResponse.json({
          success: true,
          message: `Created ${createdContacts.length} contacts and linked ${linked} units!`,
          contactsCreated: createdContacts.length,
          linkedCount: linked,
          updates: updates,
          createdContacts
        });

      } catch (error) {
        logger.error('[Units/AdminLink] Error', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          details: 'Check server logs for more info'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  ));

  return handler(request);
}
