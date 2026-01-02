import { NextRequest, NextResponse } from 'next/server';
import { firebaseServer } from '@/lib/firebase-server';
import { getContactDisplayName, getPrimaryPhone } from '@/types/contacts/helpers';
import { COLLECTIONS } from '@/config/firestore-collections';

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
 * @author Claude AI Assistant
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    console.log(`📇 API: Loading contact for contactId: ${contactId}`);

    // ========================================================================
    // VALIDATION
    // ========================================================================

    if (!contactId) {
      console.error('❌ No contactId provided');
      return NextResponse.json({
        success: false,
        error: 'Contact ID is required'
      }, { status: 400 });
    }

    if (typeof contactId !== 'string' || contactId.trim().length === 0) {
      console.error('❌ Invalid contactId format');
      return NextResponse.json({
        success: false,
        error: 'Invalid contact ID format'
      }, { status: 400 });
    }

    // ========================================================================
    // FIREBASE CONNECTION CHECK
    // ========================================================================

    if (!firebaseServer.getFirestore()) {
      console.error('❌ Firebase not initialized properly');
      return NextResponse.json({
        success: false,
        error: 'Database connection not available - Firebase not initialized',
        contactId
      }, { status: 503 });
    }

    // ========================================================================
    // FETCH CONTACT FROM FIRESTORE
    // ========================================================================

    console.log(`🔍 Fetching contact document: ${contactId}`);

    const contactDoc = await firebaseServer.getDoc(COLLECTIONS.CONTACTS, contactId);

    if (!contactDoc.exists()) {
      console.log(`⚠️ Contact not found: ${contactId}`);
      return NextResponse.json({
        success: false,
        error: 'Contact not found',
        contactId
      }, { status: 404 });
    }

    const contactData = { id: contactDoc.id, ...contactDoc.data() };

    // ========================================================================
    // PROCESS CONTACT DATA
    // ========================================================================

    // Extract primary contact information using centralized helpers
    const displayName = getContactDisplayName(contactData);
    const primaryPhone = getPrimaryPhone(contactData);

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
    const city = contactData.city || contactData.serviceAddress?.city || null;

    // Extract avatar/photo
    let avatarUrl: string | null = null;
    if (contactData.photoURL) {
      avatarUrl = contactData.photoURL;
    } else if (contactData.avatarUrl) {
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

    console.log(`✅ Contact loaded successfully: ${displayName} (${contactId})`);
    console.log(`📊 Contact type: ${response.contact.serviceType}, Status: ${response.contact.status}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ API: Error loading contact:', error);

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
        contactId: (await params).contactId || null,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}