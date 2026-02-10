import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UpdateExistingContactsRoute');

// 🏢 ENTERPRISE: Type-safe interface for contact assignments
interface ContactAssignment {
  tags: string[];
  role: string;
}

/** 🏢 ENTERPRISE: Discriminated union response types */
interface UpdateContactsSuccessResponse {
  success: true;
  message: string;
  updatedContacts: string[];
  contactsCount: number;
  requestedCount: number;
  errors?: { contactId: string; error: string }[];
  tenantId: string;
}

interface UpdateContactsErrorResponse {
  success: false;
  error: string;
  details?: string;
}

type UpdateContactsResponse = UpdateContactsSuccessResponse | UpdateContactsErrorResponse;

/**
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection + tenant isolation
 * @security Admin SDK + withAuth + requiredGlobalRoles: super_admin + Tenant Isolation
 * @permission GLOBAL: super_admin only (bulk update utility)
 * @rateLimit STANDARD (60 req/min) - CRUD
 */

export const POST = withStandardRateLimit(
  withAuth<UpdateContactsResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        const { contactAssignments } = await req.json();

        logger.info('Starting existing contacts update via API');
        logger.info('Processing contacts', { count: Object.keys(contactAssignments).length });
        logger.info('Auth Context', { uid: ctx.uid, globalRole: ctx.globalRole || 'none', companyId: ctx.companyId });

    if (!getAdminFirestore()) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin SDK not initialized'
      }, { status: 500 });
    }

    const updatedContacts: string[] = [];
    const errors: { contactId: string; error: string }[] = [];

    for (const [contactId, assignment] of Object.entries(contactAssignments)) {
      try {
        // 🔒 TENANT ISOLATION: Verify contact belongs to user's company
        const contactDoc = await getAdminFirestore().collection(COLLECTIONS.CONTACTS).doc(contactId).get();

        if (!contactDoc.exists) {
          throw new Error('Contact not found');
        }

        const contactData = contactDoc.data();
        if (contactData?.companyId !== ctx.companyId) {
          logger.warn('TENANT ISOLATION VIOLATION: attempted to update contact from another company', { uid: ctx.uid, userCompanyId: ctx.companyId, contactId, contactCompanyId: contactData?.companyId });
          throw new Error('Access denied - Contact not found');
        }

        // 🏢 ENTERPRISE: Type-safe assignment access
        const typedAssignment = assignment as ContactAssignment;
        const updateData = {
          tags: typedAssignment.tags,
          role: typedAssignment.role,
          updatedAt: new Date()
        };

        await getAdminFirestore().collection(COLLECTIONS.CONTACTS).doc(contactId).update(updateData);
        updatedContacts.push(contactId);

        logger.info('Updated contact', { contactId, role: typedAssignment.role, tags: typedAssignment.tags });

      } catch (contactError) {
        const errorMessage = contactError instanceof Error ? contactError.message : 'Unknown error';
        logger.error(`Error updating contact ${contactId}`, { error: errorMessage });

        errors.push({
          contactId,
          error: errorMessage
        });
      }
    }

    logger.info('Successfully updated contacts', { updated: updatedContacts.length, total: Object.keys(contactAssignments).length });
    logger.info('Tenant isolation enforced', { companyId: ctx.companyId });

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedContacts.length} existing contacts`,
      updatedContacts,
      contactsCount: updatedContacts.length,
      requestedCount: Object.keys(contactAssignments).length,
      errors: errors.length > 0 ? errors : undefined,
      tenantId: ctx.companyId
    });

      } catch (error) {
        logger.error('Error in update-existing API', { error });
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          details: 'Failed to update existing contacts'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  )
);
