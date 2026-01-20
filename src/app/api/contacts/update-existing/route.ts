import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';

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
 */

export async function POST(request: NextRequest) {
  const handler = withAuth<UpdateContactsResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        const { contactAssignments } = await req.json();

        console.log('🔄 Starting existing contacts update via API...');
        console.log(`📝 Processing ${Object.keys(contactAssignments).length} contacts`);
        console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole || 'none'}), Company ${ctx.companyId}`);

    if (!adminDb) {
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
        const contactDoc = await adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId).get();

        if (!contactDoc.exists) {
          throw new Error('Contact not found');
        }

        const contactData = contactDoc.data();
        if (contactData?.companyId !== ctx.companyId) {
          console.warn(`🚫 TENANT ISOLATION VIOLATION: User ${ctx.uid} (company ${ctx.companyId}) attempted to update contact ${contactId} (company ${contactData?.companyId})`);
          throw new Error('Access denied - Contact not found');
        }

        // 🏢 ENTERPRISE: Type-safe assignment access
        const typedAssignment = assignment as ContactAssignment;
        const updateData = {
          tags: typedAssignment.tags,
          role: typedAssignment.role,
          updatedAt: new Date()
        };

        await adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId).update(updateData);
        updatedContacts.push(contactId);

        console.log(`✅ Updated contact: ${contactId} → ${typedAssignment.role} (${typedAssignment.tags.join(', ')})`);

      } catch (contactError) {
        const errorMessage = contactError instanceof Error ? contactError.message : 'Unknown error';
        console.error(`❌ Error updating contact ${contactId}:`, errorMessage);

        errors.push({
          contactId,
          error: errorMessage
        });
      }
    }

    console.log(`✅ Successfully updated ${updatedContacts.length}/${Object.keys(contactAssignments).length} contacts`);
    console.log(`✅ Tenant isolation enforced: all updated contacts verified to belong to company ${ctx.companyId}`);

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
        console.error('❌ Error in update-existing API:', error);
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          details: 'Failed to update existing contacts'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
}