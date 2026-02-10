import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getContactDisplayName, getPrimaryPhone } from '@/types/contacts';
import type { Contact } from '@/types/contacts';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ContactRoute');

// 🏢 ENTERPRISE: Firestore contact data type (includes legacy fields for backward compatibility)
type FirestoreContactData = Contact & Record<string, unknown> & {
  id: string;
  companyId?: string;
};

/** 🏢 ENTERPRISE: Discriminated union response types for type-safe API responses */
interface ContactSuccessResponse {
  success: true;
  contact: {
    id: string;
    contactId: string;
    displayName: string;
    firstName: string;
    lastName: string;
    primaryPhone: string | null;
    primaryEmail: string | null;
    status: string;
    profession: string | null;
    city: string | null;
    avatarUrl: string | null;
    companyName: string | null;
    serviceType: string;
    createdAt: unknown;
    updatedAt: unknown;
    lastContactDate: unknown;
  };
  contactId: string;
  timestamp: string;
}

interface ContactErrorResponse {
  success: false;
  error: string;
}

/** Response type for contact API - discriminated union */
type ContactResponse = ContactSuccessResponse | ContactErrorResponse;

// ✅ ENTERPRISE FIX: Force dynamic rendering to prevent static generation errors
export const dynamic = 'force-dynamic';

/**
 * 📇 ENTERPRISE CONTACT API ENDPOINT
 *
 * RESTful API για individual contact information
 * Enterprise-class endpoint με proper error handling, validation και logging
 *
 * @route GET /api/contacts/[contactId]
 * @returns Contact basic information
 * @created 2025-12-14
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection
 * @security Admin SDK + withAuth + Tenant Isolation
 * @permission contacts:contacts:view
 * @author Claude AI Assistant
 */

// Dynamic route handler wrapper — ADR-172: Added withStandardRateLimit
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await segmentData.params;

  // Create authenticated handler with rate limiting
  const handler = withStandardRateLimit(withAuth<unknown>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        logger.info('Loading contact', { contactId });

    // ========================================================================
    // VALIDATION
    // ========================================================================

    if (!contactId) {
      logger.error('No contactId provided');
      return NextResponse.json({
        success: false,
        error: 'Contact ID is required'
      }, { status: 400 });
    }

    if (typeof contactId !== 'string' || contactId.trim().length === 0) {
      logger.error('Invalid contactId format');
      return NextResponse.json({
        success: false,
        error: 'Invalid contact ID format'
      }, { status: 400 });
    }

    // ========================================================================
    // FETCH CONTACT FROM FIRESTORE (ADMIN SDK)
    // ========================================================================

    logger.info('Fetching contact document', { contactId });
    logger.info('Auth Context', { uid: ctx.uid, companyId: ctx.companyId });

    const adminDb = getAdminFirestore();
    if (!adminDb) {
      logger.error('Firebase Admin not initialized');
      return NextResponse.json({
        success: false,
        error: 'Database connection not available - Firebase Admin not initialized',
        contactId
      }, { status: 503 });
    }

    const contactDoc = await adminDb
      .collection(COLLECTIONS.CONTACTS)
      .doc(contactId)
      .get();

    if (!contactDoc.exists) {
      logger.warn('Contact not found', { contactId });
      return NextResponse.json({
        success: false,
        error: 'Contact not found',
        contactId
      }, { status: 404 });
    }

    const contactData = { id: contactDoc.id, ...contactDoc.data() } as FirestoreContactData;

    // ========================================================================
    // TENANT ISOLATION - CRITICAL SECURITY CHECK
    // ========================================================================

    if (contactData.companyId !== ctx.companyId) {
      logger.warn('TENANT ISOLATION VIOLATION: attempted to access contact from another company', { uid: ctx.uid, userCompanyId: ctx.companyId, contactId, contactCompanyId: contactData.companyId });
      return NextResponse.json({
        success: false,
        error: 'Access denied - Contact not found',
        contactId
      }, { status: 403 });
    }

    logger.info('Tenant isolation check passed', { companyId: ctx.companyId });

    // ========================================================================
    // PROCESS CONTACT DATA
    // ========================================================================

    // Extract primary contact information using centralized helpers
    const displayName = getContactDisplayName(contactData);
    const primaryPhone = getPrimaryPhone(contactData) ?? null;

    // Extract primary email using enterprise logic
    let primaryEmail: string | null = null;
    if (contactData.emails && Array.isArray(contactData.emails) && contactData.emails.length > 0) {
      // Find primary email or use first one
      const primaryEmailObj = contactData.emails.find((email: unknown) =>
        typeof email === 'object' && email !== null && (email as { isPrimary?: boolean }).isPrimary
      ) || contactData.emails[0];

      if (primaryEmailObj && typeof primaryEmailObj === 'object' && primaryEmailObj !== null) {
        primaryEmail = (primaryEmailObj as { email?: string }).email || null;
      }
    } else if (contactData.email && typeof contactData.email === 'string') {
      // Fallback to legacy email field
      primaryEmail = contactData.email;
    }

    // Extract other contact information
    const status = contactData.status || 'active';
    const profession = contactData.profession || null;
    const serviceAddress = contactData.serviceAddress;
    const serviceAddressCity = typeof serviceAddress === 'object' && serviceAddress !== null && 'city' in serviceAddress
      ? (serviceAddress as { city?: string }).city
      : undefined;
    const city = (typeof contactData.city === 'string' ? contactData.city : undefined) || serviceAddressCity || null;

    // Extract avatar/photo
    let avatarUrl: string | null = null;
    if (contactData.photoURL) {
      avatarUrl = contactData.photoURL;
    } else if (typeof contactData.avatarUrl === 'string') {
      avatarUrl = contactData.avatarUrl;
    } else if (contactData.multiplePhotoURLs && Array.isArray(contactData.multiplePhotoURLs) && contactData.multiplePhotoURLs.length > 0) {
      avatarUrl = contactData.multiplePhotoURLs[0];
    }

    // ========================================================================
    // ENTERPRISE RESPONSE FORMAT
    // ========================================================================

    const response = {
      success: true,
      contact: {
        // Core identification
        id: contactData.id,
        contactId: contactData.id,

        // Display information
        displayName,
        firstName: contactData.firstName || '',
        lastName: contactData.lastName || '',

        // Primary contact methods
        primaryPhone,
        primaryEmail,

        // Additional information
        status,
        profession,
        city,
        avatarUrl,

        // Company information (if applicable)
        companyName: contactData.companyName || null,
        serviceType: contactData.serviceType || contactData.type || 'individual',

        // Metadata
        createdAt: contactData.createdAt || null,
        updatedAt: contactData.updatedAt || null,
        lastContactDate: contactData.lastContactDate || null
      },
      contactId,
      timestamp: new Date().toISOString()
    };

    logger.info('Contact loaded successfully', { displayName, contactId });
    logger.info('Contact details', { serviceType: response.contact.serviceType, status: response.contact.status });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Error loading contact', { error });

    // Enterprise error handling με proper error categorization
    const isFirebaseError = error instanceof Error && error.message.includes('Firebase');
    const isNetworkError = error instanceof Error && error.message.includes('network');

    let errorCategory = 'unknown';
    let statusCode = 500;

    if (isFirebaseError) {
      errorCategory = 'database';
      statusCode = 503;
    } else if (isNetworkError) {
      errorCategory = 'network';
      statusCode = 502;
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Άγνωστο σφάλμα φόρτωσης επαφής',
        errorCategory,
        contactId: contactId || null,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
    },
    { permissions: 'crm:contacts:view' }
  ));

  // Execute authenticated handler
  return handler(request);
}
