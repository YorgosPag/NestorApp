/**
 * 🛠️ UTILITY: REAL DATABASE UPDATE
 *
 * Creates real contacts and links sold properties to them.
 *
 * @module api/properties/real-update
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
import { generateContactId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { validatePropertyFieldLocking } from '@/lib/firestore/property-field-locking';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PropertiesRealUpdateRoute');

// Response types for type-safe withAuth
type RealUpdateSuccess = {
  success: true;
  message: string;
  linkedUnits: number;
  updates: Array<{
    propertyId: string;
    propertyName: string;
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
        logger.info('[Properties/RealUpdate] Starting Admin SDK operations', { userId: ctx.uid, globalRole: ctx.globalRole, companyId: ctx.companyId });

        // ============================================================================
        // STEP 1: FIND SOLD UNITS WITHOUT CUSTOMERS (Admin SDK)
        // ============================================================================

        logger.info('[Properties/RealUpdate] Finding sold properties without customers');
        const propertiesSnapshot = await getAdminFirestore().collection(COLLECTIONS.PROPERTIES).get();

        const soldPropertiesToUpdate: Array<{ id: string; name: string }> = [];
        propertiesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const status = data.status;
          const soldTo = data.soldTo;
          const name = data.name;

          if (status === 'sold' && (!soldTo || soldTo === UNIT_SALE_STATUS.NOT_SOLD)) {
            soldPropertiesToUpdate.push({
              id: doc.id,
              name: name || 'Unknown Property'
            });
          }
        });

        logger.info('[Properties/RealUpdate] Found sold properties to update', { count: soldPropertiesToUpdate.length });

        if (soldPropertiesToUpdate.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No properties need update',
            linkedUnits: 0,
            updates: [],
            contactsCreated: 0,
            attempted: 0
          });
        }

        // ============================================================================
        // STEP 2: GENERATE AND CREATE CONTACTS (Admin SDK)
        // ============================================================================

        logger.info('[Properties/RealUpdate] Creating real contacts in database');
        const contacts = ContactInfoUtils.generateSampleContacts(8).map((contact) => ({
          id: generateContactId(),
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
            logger.info('[Properties/RealUpdate] Contact created', { contactName: contact.name });

          } catch (error) {
            // If contact already exists (409), that's OK
            if (error && typeof error === 'object' && 'code' in error && error.code === 6) {
              createdContacts.push(contact);
              logger.info('[Properties/RealUpdate] Contact already exists', { contactName: contact.name });
            } else {
              logger.error('[Properties/RealUpdate] Error creating contact', { contactName: contact.name, error: getErrorMessage(error) });
            }
          }
        }

        logger.info('[Properties/RealUpdate] Created/verified contacts', { count: createdContacts.length });

        // ============================================================================
        // STEP 3: UPDATE UNITS WITH CONTACT IDS (Admin SDK)
        // ============================================================================

        logger.info('[Properties/RealUpdate] Updating properties with real contact IDs');
        const updatedProperties = [];

        for (let i = 0; i < soldPropertiesToUpdate.length; i++) {
          const property = soldPropertiesToUpdate[i];
          const contact = createdContacts[i % createdContacts.length];

          if (!contact) continue;

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

            updatedProperties.push({
              propertyId: property.id,
              propertyName: property.name,
              contactId: contact.id,
              contactName: contact.name
            });

            logger.info('[Properties/RealUpdate] Property linked to contact', { propertyName: property.name, contactName: contact.name });

          } catch (error) {
            logger.error('[Properties/RealUpdate] Error updating property', { propertyName: property.name, error: getErrorMessage(error) });
          }
        }

        logger.info('[Properties/RealUpdate] Complete', { updatedCount: updatedProperties.length });

        return NextResponse.json({
          success: true,
          message: `REAL DATABASE UPDATE: Successfully linked ${updatedProperties.length} properties to contacts!`,
          linkedUnits: updatedProperties.length,
          updates: updatedProperties,
          contactsCreated: createdContacts.length,
          attempted: soldPropertiesToUpdate.length
        });

      } catch (error) {
        logger.error('[Properties/RealUpdate] Error', {
          error: getErrorMessage(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to perform real database update',
          details: getErrorMessage(error)
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
};

export const POST = withStandardRateLimit(postHandler);
