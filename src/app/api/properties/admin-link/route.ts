/**
 * 🛠️ UTILITY: ADMIN LINK UNITS TO CONTACTS
 *
 * Break-glass utility for creating contacts and linking to sold properties.
 *
 * @module api/properties/admin-link
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
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PropertiesAdminLinkRoute');

// Response types for type-safe withAuth
type AdminLinkSuccess = {
  success: true;
  message: string;
  contactsCreated: number;
  linkedCount: number;
  updates: Array<{
    propertyId: string;
    propertyName: string;
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
        logger.info('[Properties/AdminLink] Starting Admin SDK operations', { userId: ctx.uid, globalRole: ctx.globalRole, companyId: ctx.companyId });

        const propertiesSnapshot = await getAdminFirestore().collection(COLLECTIONS.PROPERTIES).get();

        // Debug: Show all sold properties and their soldTo values
        const allSoldProperties = propertiesSnapshot.docs
          .map(doc => ({ id: doc.id, data: doc.data() }))
          .filter(property => property.data.status === 'sold');

        logger.info('[Properties/AdminLink] DEBUG: Found sold properties', { count: allSoldProperties.length });

        const soldPropertiesToLink = propertiesSnapshot.docs
          .map(doc => ({ id: doc.id, data: doc.data() }))
          .filter(property => {
            const needsLinking = property.data.status === 'sold' && (
              !property.data.soldTo ||
              property.data.soldTo === UNIT_SALE_STATUS.NOT_SOLD ||
              property.data.soldTo === 'customer...' ||
              typeof property.data.soldTo === 'string' && property.data.soldTo.startsWith('customer')
            );
            return needsLinking;
          });

        logger.info('[Properties/AdminLink] Properties to link', { count: soldPropertiesToLink.length });

        if (soldPropertiesToLink.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No properties need linking',
            contactsCreated: 0,
            linkedCount: 0,
            updates: [],
            createdContacts: []
          });
        }

        // Load real contact IDs from database
        const contactsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.CONTACTS)
          .where(FIELDS.TYPE, '==', 'individual')
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
            logger.error('[Properties/AdminLink] Failed to create contact', { contactName, error: getErrorMessage(contactError) });
          }
        }

        // Link properties to contacts
        let linked = 0;
        const updates = [];

        for (let i = 0; i < soldPropertiesToLink.length; i++) {
          const property = soldPropertiesToLink[i];
          const contactId = realContactIds[i % realContactIds.length];
          const contactName = sampleContactNames[i % sampleContactNames.length];

          try {
            await getAdminFirestore().collection(COLLECTIONS.PROPERTIES).doc(property.id).update({
              soldTo: contactId
            });

            updates.push({
              propertyId: property.id,
              propertyName: property.data.name || 'Unknown Property',
              contactId: contactId,
              contactName: contactName
            });

            linked++;
          } catch (updateError) {
            logger.error('[Properties/AdminLink] Failed to update property', { propertyId: property.id, error: getErrorMessage(updateError) });
          }
        }

        logger.info('[Properties/AdminLink] Complete', { linkedCount: linked });

        return NextResponse.json({
          success: true,
          message: `Created ${createdContacts.length} contacts and linked ${linked} properties!`,
          contactsCreated: createdContacts.length,
          linkedCount: linked,
          updates: updates,
          createdContacts
        });

      } catch (error) {
        logger.error('[Properties/AdminLink] Error', {
          error: getErrorMessage(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: getErrorMessage(error),
          details: 'Check server logs for more info'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  ));

  return handler(request);
}
