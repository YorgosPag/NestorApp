import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('ContactPropertiesRoute');

// 🏢 ENTERPRISE: Firestore data types (includes legacy fields for backward compatibility)
type FirestoreContactData = Record<string, unknown> & {
  id: string;
  companyId?: string;
};

type FirestorePropertyData = Record<string, unknown> & {
  id: string;
};

/** 🏢 ENTERPRISE: Discriminated union response types */
interface ContactPropertiesSuccessResponse {
  success: true;
  contactId: string;
  properties: unknown[];
  propertiesCount: number;
  totalValue: number;
  averagePropertyValue: number;
  totalArea: number;
  averagePropertyArea: number;
  statistics: {
    byType: Record<string, number>;
    byBuilding: Record<string, number>;
    byProject: Record<string, number>;
    byStatus: Record<string, number>;
  };
  contactInfo: {
    profession: string | null;
    city: string | null;
    lastContactDate: unknown;
  };
  timestamp: string;
  dataSource: string;
}

interface ContactPropertiesErrorResponse {
  success: false;
  error: string;
  errorCategory?: string;
  contactId?: string | null;
  timestamp?: string;
  properties?: unknown[];
  propertiesCount?: number;
  totalValue?: number;
  totalArea?: number;
  statistics?: {
    byType: Record<string, number>;
    byBuilding: Record<string, number>;
    byProject: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

type ContactPropertiesResponse = ContactPropertiesSuccessResponse | ContactPropertiesErrorResponse;

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
 * @security Admin SDK + withAuth + Tenant Isolation (contact + properties)
 * @permission contacts:contacts:view
 * @author Claude AI Assistant
 */

// Dynamic route handler wrapper
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await segmentData.params;

  // Create authenticated handler - using unknown for flexible response types
  const handler = withAuth<unknown>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        logger.info('Loading properties for contact', { contactId });

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
    // VERIFY CONTACT EXISTS (ADMIN SDK)
    // ========================================================================

    logger.info('Verifying contact exists', { contactId });
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
    // TENANT ISOLATION — CONTACT CHECK
    // ========================================================================

    if (contactData.companyId !== ctx.companyId) {
      logger.warn('TENANT ISOLATION VIOLATION: attempted to access contact from another company', { uid: ctx.uid, userCompanyId: ctx.companyId, contactId, contactCompanyId: contactData.companyId });
      return NextResponse.json({
        success: false,
        error: 'Access denied - Contact not found',
        contactId
      }, { status: 403 });
    }

    logger.info('Tenant isolation check passed for contact', { companyId: ctx.companyId });

    // ========================================================================
    // FETCH PROPERTIES OWNED BY CONTACT (ADMIN SDK)
    // ========================================================================

    logger.info('Fetching properties', { soldTo: contactId, companyId: ctx.companyId });

    const propertiesSnapshot = await adminDb
      .collection(COLLECTIONS.PROPERTIES)
      .where('soldTo', '==', contactId)
      .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
      .get();

    const properties = propertiesSnapshot.docs.map(propDoc => ({
      id: propDoc.id,
      ...propDoc.data()
    }) as FirestorePropertyData);

    logger.info('Found properties for contact', { count: properties.length, contactId });
    logger.info('Tenant isolation enforced in properties query', { companyId: ctx.companyId });

    // ========================================================================
    // PROCESS PROPERTIES DATA & CALCULATE STATISTICS
    // ========================================================================

    let totalValue = 0;
    let totalArea = 0;
    const propsByType: Record<string, number> = {};
    const propsByBuilding: Record<string, number> = {};
    const propsByProject: Record<string, number> = {};
    const propsByStatus: Record<string, number> = {};

    const processedProperties = properties.map(prop => {
      // Calculate totals
      const propPrice = typeof prop.price === 'number' ? prop.price : 0;
      const propArea = typeof prop.area === 'number' ? prop.area : 0;

      totalValue += propPrice;
      totalArea += propArea;

      // Count by type - cast to string for safe indexing
      const propType = String(prop.type || prop.propertyType || 'unknown');
      propsByType[propType] = (propsByType[propType] || 0) + 1;

      // Count by building - cast to string for safe indexing
      const buildingId = String(prop.buildingId || 'unknown');
      propsByBuilding[buildingId] = (propsByBuilding[buildingId] || 0) + 1;

      // Count by project - cast to string for safe indexing
      const projectId = String(prop.projectId || 'unknown');
      propsByProject[projectId] = (propsByProject[projectId] || 0) + 1;

      // Count by status - cast to string for safe indexing
      const propStatus = String(prop.status || 'unknown');
      propsByStatus[propStatus] = (propsByStatus[propStatus] || 0) + 1;

      // Return processed property data
      return {
        id: prop.id,
        name: prop.name || prop.title || `Property ${prop.id}`,
        type: propType,
        status: propStatus,
        price: propPrice,
        area: propArea,
        buildingId,
        projectId,

        // Building information (if available)
        buildingName: prop.buildingName || prop.building || null,

        // Project information (if available)
        projectName: prop.projectName || prop.project || null,

        // Location information
        floor: prop.floor || null,
        address: prop.address || null,

        // Metadata
        purchaseDate: prop.purchaseDate || prop.soldDate || null,
        createdAt: prop.createdAt || null,
        updatedAt: prop.updatedAt || null
      };
    });

    // ========================================================================
    // FETCH ADDITIONAL CONTACT INFORMATION
    // ========================================================================

    // Extract additional contact info for extended response - use safe property access
    const profession = contactData.profession as string | null || null;
    const serviceAddress = contactData.serviceAddress as { city?: string } | undefined;
    const city = (contactData['city'] as string | undefined) || serviceAddress?.city || null;
    const lastContactDate = contactData.lastContactDate || contactData.updatedAt || null;

    // ========================================================================
    // ENTERPRISE RESPONSE FORMAT
    // ========================================================================

    const response = {
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

      // Categorized statistics
      statistics: {
        byType: propsByType,
        byBuilding: propsByBuilding,
        byProject: propsByProject,
        byStatus: propsByStatus
      },

      // Additional contact information για extended view
      contactInfo: {
        profession,
        city,
        lastContactDate
      },

      // Metadata
      timestamp: nowISO(),
      dataSource: 'firestore'
    };

    logger.info('Contact properties loaded successfully', { contactId });
    logger.info('Statistics', { propertiesCount: properties.length, totalValue, totalArea });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Error loading contact properties', { error });

    // Enterprise error handling με detailed error information
    const isFirebaseError = error instanceof Error && error.message.includes('Firebase');
    const isNetworkError = error instanceof Error && error.message.includes('network');
    const isAuthError = error instanceof Error && error.message.includes('permission');

    let errorCategory = 'unknown';
    let statusCode = 500;

    if (isFirebaseError) {
      errorCategory = 'database';
      statusCode = 503;
    } else if (isNetworkError) {
      errorCategory = 'network';
      statusCode = 502;
    } else if (isAuthError) {
      errorCategory = 'authentication';
      statusCode = 403;
    }

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error, 'Άγνωστο σφάλμα φόρτωσης ιδιοκτησιών επαφής'),
        errorCategory,
        contactId: contactId || null,
        timestamp: nowISO(),

        // Empty data structure for consistency
        properties: [],
        propertiesCount: 0,
        totalValue: 0,
        totalArea: 0,
        statistics: {
          byType: {},
          byBuilding: {},
          byProject: {},
          byStatus: {}
        }
      },
      { status: statusCode }
    );
      }
    },
    { permissions: 'crm:contacts:view' }
  );

  // Execute authenticated handler
  return handler(request);
}
