import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import { checkContactAccess } from '../../_shared/contact-ownership';
import { contactNotFoundResponse } from '../../_shared/contact-not-found-response';
import { summarizeProperties } from './contact-properties-stats';
import { contactPropertiesErrorResponse } from './contact-properties-error';
import type {
  FirestoreContactData,
  FirestorePropertyData,
  ContactPropertiesSuccessResponse,
} from './types';

const logger = createModuleLogger('ContactPropertiesRoute');

/**
 * 🏠 ENTERPRISE CONTACT PROPERTIES API ENDPOINT
 *
 * RESTful API για properties που ανήκουν σε συγκεκριμένο contact
 * Enterprise-class endpoint με aggregated data και statistics
 *
 * @route GET /api/contacts/[contactId]/properties
 * @returns Contact's properties information με statistics
 * @created 2025-12-14
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection
 * @updated 2026-08-01 - Split σε types/stats/error (N.7.1: 357 γρ. > όριο 300)
 * @security Admin SDK + withAuth + Tenant Isolation (contact + properties)
 * @permission contacts:contacts:view
 * @author Claude AI Assistant
 */

/** Οι δύο ελέγχοι σχήματος του αναγνωριστικού, πριν αγγίξουμε τη βάση. */
function invalidContactIdResponse(contactId: string): NextResponse | null {
  if (!contactId) {
    logger.error('No contactId provided');
    return NextResponse.json({ success: false, error: 'Contact ID is required' }, { status: 400 });
  }

  if (typeof contactId !== 'string' || contactId.trim().length === 0) {
    logger.error('Invalid contactId format');
    return NextResponse.json(
      { success: false, error: 'Invalid contact ID format' },
      { status: 400 },
    );
  }

  return null;
}

async function loadContactProperties(
  ctx: AuthContext,
  contactId: string,
): Promise<NextResponse> {
  const invalid = invalidContactIdResponse(contactId);
  if (invalid) return invalid;

  logger.info('Verifying contact exists', { contactId });
  logger.info('Auth Context', { uid: ctx.uid, companyId: ctx.companyId });

  const adminDb = getAdminFirestore();
  if (!adminDb) {
    logger.error('Firebase Admin not initialized');
    return NextResponse.json(
      {
        success: false,
        error: 'Database connection not available - Firebase Admin not initialized',
        contactId,
      },
      { status: 503 },
    );
  }

  const contactDoc = await adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId).get();

  if (!contactDoc.exists) {
    logger.warn('Contact not found', { contactId });
    return contactNotFoundResponse(contactId);
  }

  const rawContactData = contactDoc.data();

  // ==========================================================================
  // TENANT ISOLATION — CONTACT CHECK (ADR-742 §7octies)
  // ==========================================================================
  // Η καταγραφή της απόπειρας γίνεται **μέσα** στον φύλακα, μία φορά για όλες
  // τις διαδρομές του πόρου. Το «δεν βρέθηκε» είναι **πανομοιότυπο** με τον
  // γνήσιο κλάδο από πάνω — ίδιο εργοστάσιο, ίδιος κωδικός, ίδιο σώμα.

  if (
    checkContactAccess({
      contactData: rawContactData,
      caller: ctx,
      contactId,
      action: 'properties',
    }) === 'denied'
  ) {
    return contactNotFoundResponse(contactId);
  }

  const contactData = { id: contactDoc.id, ...rawContactData } as FirestoreContactData;

  logger.info('Fetching properties', { soldTo: contactId, companyId: ctx.companyId });

  const propertiesSnapshot = await adminDb
    .collection(COLLECTIONS.PROPERTIES)
    .where('soldTo', '==', contactId)
    .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
    .get();

  const properties = propertiesSnapshot.docs.map(
    propDoc => ({ id: propDoc.id, ...propDoc.data() }) as FirestorePropertyData,
  );

  logger.info('Found properties for contact', { count: properties.length, contactId });
  logger.info('Tenant isolation enforced in properties query', { companyId: ctx.companyId });

  const { processedProperties, totalValue, totalArea, statistics } =
    summarizeProperties(properties);

  // Extract additional contact info for extended response - use safe property access
  const profession = (contactData.profession as string | null) || null;
  const serviceAddress = contactData.serviceAddress as { city?: string } | undefined;
  const city = (contactData['city'] as string | undefined) || serviceAddress?.city || null;
  const lastContactDate = contactData.lastContactDate || contactData.updatedAt || null;

  const response: ContactPropertiesSuccessResponse = {
    success: true,
    contactId,

    // Properties data
    properties: processedProperties,
    propertiesCount: properties.length,

    // Financial statistics
    totalValue,
    averagePropertyValue: properties.length > 0 ? totalValue / properties.length : 0,

    // Area statistics
    totalArea,
    averagePropertyArea: properties.length > 0 ? totalArea / properties.length : 0,

    statistics,

    // Additional contact information για extended view
    contactInfo: { profession, city, lastContactDate },

    // Metadata
    timestamp: nowISO(),
    dataSource: 'firestore',
  };

  logger.info('Contact properties loaded successfully', { contactId });
  logger.info('Statistics', { propertiesCount: properties.length, totalValue, totalArea });

  return NextResponse.json(response);
}

// Dynamic route handler wrapper
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ contactId: string }> },
) {
  const { contactId } = await segmentData.params;

  // Create authenticated handler - using unknown for flexible response types
  const handler = withAuth<unknown>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        logger.info('Loading properties for contact', { contactId });
        return await loadContactProperties(ctx, contactId);
      } catch (error) {
        logger.error('Error loading contact properties', { error });
        return contactPropertiesErrorResponse(error, contactId || null);
      }
    },
    { permissions: 'crm:contacts:view' },
  );

  // Execute authenticated handler
  return handler(request);
}
