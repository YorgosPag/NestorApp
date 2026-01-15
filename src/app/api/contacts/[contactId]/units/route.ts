import { NextRequest, NextResponse } from 'next/server';
import { db as getAdminDb } from '@/lib/firebase-admin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: Firestore data types (includes legacy fields for backward compatibility)
type FirestoreContactData = Record<string, any> & {
  id: string;
  companyId?: string;
};

type FirestoreUnitData = Record<string, any> & {
  id: string;
};

/**
 * 🏠 ENTERPRISE CONTACT UNITS API ENDPOINT
 *
 * RESTful API για units που ανήκουν σε συγκεκριμένο contact
 * Enterprise-class endpoint με aggregated data και statistics
 *
 * @route GET /api/contacts/[contactId]/units
 * @returns Contact's units information με statistics
 * @created 2025-12-14
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection
 * @security Admin SDK + withAuth + Tenant Isolation (contact + units)
 * @permission contacts:contacts:view
 * @author Claude AI Assistant
 */

// Dynamic route handler wrapper
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await segmentData.params;

  // Create authenticated handler
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        console.log(`🏠 API: Loading units for contactId: ${contactId}`);

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
    // VERIFY CONTACT EXISTS (ADMIN SDK)
    // ========================================================================

    console.log(`🔍 Verifying contact exists: ${contactId}`);
    console.log(`🔒 Auth Context: User ${ctx.uid}, Company ${ctx.companyId}`);

    const adminDb = getAdminDb();
    if (!adminDb) {
      console.error('❌ Firebase Admin not initialized');
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
      console.log(`⚠️ Contact not found: ${contactId}`);
      return NextResponse.json({
        success: false,
        error: 'Contact not found',
        contactId
      }, { status: 404 });
    }

    const contactData = { id: contactDoc.id, ...contactDoc.data() } as FirestoreContactData;

    // ========================================================================
    // TENANT ISOLATION - CONTACT CHECK
    // ========================================================================

    if (contactData.companyId !== ctx.companyId) {
      console.warn(`🚫 TENANT ISOLATION VIOLATION: User ${ctx.uid} (company ${ctx.companyId}) attempted to access contact ${contactId} (company ${contactData.companyId})`);
      return NextResponse.json({
        success: false,
        error: 'Access denied - Contact not found',
        contactId
      }, { status: 403 });
    }

    console.log(`✅ Tenant isolation check passed for contact: contact.companyId === ctx.companyId (${ctx.companyId})`);

    // ========================================================================
    // FETCH UNITS OWNED BY CONTACT (ADMIN SDK)
    // ========================================================================

    console.log(`🏠 Fetching units where soldTo === ${contactId} AND companyId === ${ctx.companyId}`);

    const unitsSnapshot = await adminDb
      .collection(COLLECTIONS.UNITS)
      .where('soldTo', '==', contactId)
      .where('companyId', '==', ctx.companyId)
      .get();

    const units = unitsSnapshot.docs.map(unitDoc => ({
      id: unitDoc.id,
      ...unitDoc.data()
    }) as FirestoreUnitData);

    console.log(`🏠 Found ${units.length} units for contact ${contactId}`);
    console.log(`✅ Tenant isolation enforced in units query: all units.companyId === ${ctx.companyId}`);

    // ========================================================================
    // PROCESS UNITS DATA & CALCULATE STATISTICS
    // ========================================================================

    let totalValue = 0;
    let totalArea = 0;
    const unitsByType: Record<string, number> = {};
    const unitsByBuilding: Record<string, number> = {};
    const unitsByProject: Record<string, number> = {};
    const unitsByStatus: Record<string, number> = {};

    const processedUnits = units.map(unit => {
      // Calculate totals
      const unitPrice = typeof unit.price === 'number' ? unit.price : 0;
      const unitArea = typeof unit.area === 'number' ? unit.area : 0;

      totalValue += unitPrice;
      totalArea += unitArea;

      // Count by type
      const unitType = unit.type || unit.propertyType || 'unknown';
      unitsByType[unitType] = (unitsByType[unitType] || 0) + 1;

      // Count by building
      const buildingId = unit.buildingId || 'unknown';
      unitsByBuilding[buildingId] = (unitsByBuilding[buildingId] || 0) + 1;

      // Count by project
      const projectId = unit.projectId || 'unknown';
      unitsByProject[projectId] = (unitsByProject[projectId] || 0) + 1;

      // Count by status
      const unitStatus = unit.status || 'unknown';
      unitsByStatus[unitStatus] = (unitsByStatus[unitStatus] || 0) + 1;

      // Return processed unit data
      return {
        id: unit.id,
        name: unit.name || unit.title || `Unit ${unit.id}`,
        type: unitType,
        status: unitStatus,
        price: unitPrice,
        area: unitArea,
        buildingId,
        projectId,

        // Building information (if available)
        buildingName: unit.buildingName || unit.building || null,

        // Project information (if available)
        projectName: unit.projectName || unit.project || null,

        // Location information
        floor: unit.floor || null,
        address: unit.address || null,

        // Metadata
        purchaseDate: unit.purchaseDate || unit.soldDate || null,
        createdAt: unit.createdAt || null,
        updatedAt: unit.updatedAt || null
      };
    });

    // ========================================================================
    // FETCH ADDITIONAL CONTACT INFORMATION
    // ========================================================================

    // Extract additional contact info for extended response
    const profession = contactData.profession || null;
    const city = contactData.city || contactData.serviceAddress?.city || null;
    const lastContactDate = contactData.lastContactDate || contactData.updatedAt || null;

    // ========================================================================
    // ENTERPRISE RESPONSE FORMAT
    // ========================================================================

    const response = {
      success: true,
      contactId,

      // Units data
      units: processedUnits,
      unitsCount: units.length,

      // Financial statistics
      totalValue,
      averageUnitValue: units.length > 0 ? totalValue / units.length : 0,

      // Area statistics
      totalArea,
      averageUnitArea: units.length > 0 ? totalArea / units.length : 0,

      // Categorized statistics
      statistics: {
        byType: unitsByType,
        byBuilding: unitsByBuilding,
        byProject: unitsByProject,
        byStatus: unitsByStatus
      },

      // Additional contact information για extended view
      contactInfo: {
        profession,
        city,
        lastContactDate
      },

      // Metadata
      timestamp: new Date().toISOString(),
      dataSource: 'firestore'
    };

    console.log(`✅ Contact units loaded successfully for: ${contactId}`);
    console.log(`📊 Statistics: ${units.length} units, €${totalValue.toLocaleString()} total value, ${totalArea}m² total area`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ API: Error loading contact units:', error);

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
        error: error instanceof Error ? error.message : 'Άγνωστο σφάλμα φόρτωσης μονάδων επαφής',
        errorCategory,
        contactId: contactId || null,
        timestamp: new Date().toISOString(),

        // Empty data structure for consistency
        units: [],
        unitsCount: 0,
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
    { permissions: 'contacts:contacts:view' }
  );

  // Execute authenticated handler
  return handler(request);
}