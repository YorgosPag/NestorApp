import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AddRealContactsRoute');

/** 🏢 ENTERPRISE: Discriminated union response types */
interface AddContactsSuccessResponse {
  success: true;
  message: string;
  addedContactIds: string[];
  contactsCount: number;
  requestedCount: number;
  tenantId: string;
}

interface AddContactsErrorResponse {
  success: false;
  error: string;
  details?: string;
}

type AddContactsResponse = AddContactsSuccessResponse | AddContactsErrorResponse;

/**
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection + tenant isolation
 * @security Admin SDK + withAuth + requiredGlobalRoles: super_admin + Tenant Isolation
 * @permission GLOBAL: super_admin only (bulk import utility)
 * @rateLimit STANDARD (60 req/min) - CRUD
 */

export const POST = withStandardRateLimit(
  withAuth<AddContactsResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        const { contacts } = await req.json();

        logger.info('Starting real contacts addition via API');
        logger.info('Processing contacts', { count: contacts.length });
        logger.info('Auth Context', { uid: ctx.uid, globalRole: ctx.globalRole || 'none', companyId: ctx.companyId });

    if (!getAdminFirestore()) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin SDK not initialized'
      }, { status: 500 });
    }

    const addedContactIds: string[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      try {
        // 🔒 TENANT ISOLATION: Enforce ctx.companyId on all new contacts
        const contactData = {
          ...contact,
          companyId: ctx.companyId, // CRITICAL: Always use authenticated user's companyId
          createdAt: new Date(),
          updatedAt: new Date(),
          status: contact.status || 'active',
          isFavorite: contact.isFavorite || false,
          serviceType: contact.type,

          // Βεβαιωνόμαστε ότι έχουμε όλα τα απαραίτητα fields
          firstName: contact.firstName || '',
          lastName: contact.lastName || '',
          companyName: contact.companyName || '',
          profession: contact.profession || '',
          industry: contact.industry || '',

          // Phone formatting
          phones: contact.phones ? contact.phones.map((phone: { countryCode?: string; phone?: string; number?: string; type?: string; isPrimary?: boolean }) => ({
            countryCode: phone.countryCode || '+30',
            number: phone.phone ? phone.phone.replace(/[\s+()-]/g, '') : phone.number?.replace(/[\s+()-]/g, '') || '',
            type: phone.type || 'mobile',
            label: 'Προσωπικό',
            isPrimary: phone.isPrimary || true
          })) : [],

          // Email formatting
          emails: contact.emails ? contact.emails.map((email: { email?: string; type?: string; isPrimary?: boolean }) => ({
            email: email.email || '',
            type: email.type || 'personal',
            label: 'Προσωπικό',
            isPrimary: email.isPrimary || true
          })) : [],

          // Address fields
          serviceAddress: contact.serviceAddress || {
            city: '',
            street: '',
            number: '',
            postalCode: ''
          },
          workAddress: contact.workAddress || '',

          // Company fields
          companyVatNumber: contact.vatNumber || '',
          vatNumber: contact.vatNumber || '',

          // Personal fields
          amka: contact.amka || '',
          birthDate: contact.birthDate || '',
          fatherName: contact.fatherName || '',
          motherName: contact.motherName || '',

          // Additional fields
          tags: contact.tags || [],
          role: contact.role || '',
          notes: contact.notes || '',

          // Media fields
          documents: contact.documents || {},
          multiplePhotos: contact.multiplePhotos || [],
          multiplePhotoURLs: contact.multiplePhotoURLs || [],
          socialMedia: contact.socialMedia || {
            facebook: '',
            instagram: '',
            linkedin: '',
            twitter: ''
          },
          websites: contact.websites || []
        };

        // 🏗️ ADR-210: Enterprise ID for contacts
        const { generateContactId } = await import('@/services/enterprise-id.service');
        const contactId = generateContactId();
        await getAdminFirestore().collection(COLLECTIONS.CONTACTS).doc(contactId).set(contactData);
        addedContactIds.push(contactId);

        logger.info('Added contact', { name: contact.firstName || contact.companyName, id: contactId });

      } catch (contactError) {
        logger.error(`Error adding contact ${i + 1}`, { error: contactError });
        // Συνεχίζουμε με τις επόμενες επαφές ακόμα κι αν μία αποτύχει
      }
    }

    logger.info('Successfully added contacts', { added: addedContactIds.length, total: contacts.length });
    logger.info('Tenant isolation enforced', { companyId: ctx.companyId });

    return NextResponse.json({
      success: true,
      message: `Successfully added ${addedContactIds.length} real contacts`,
      addedContactIds,
      contactsCount: addedContactIds.length,
      requestedCount: contacts.length,
      tenantId: ctx.companyId
    });

      } catch (error) {
        logger.error('Error in add-real-contacts API', { error });
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          details: 'Failed to add contacts to database'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  )
);
