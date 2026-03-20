/**
 * =============================================================================
 * CLEAN PROJECT CREATION - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Creates clean projects with proper structure for development
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification System-level operation (data seeding)
 *
 * This endpoint uses Firebase Admin SDK to create fresh normalized projects
 * with proper companyIds, buildings, and floors structure.
 *
 * @method GET - System information
 * @method POST - Execute clean project creation
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:direct:operations permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDirectOperation)
 *   - Layer 4: Firebase Admin SDK (elevated permissions)
 *
 * @technology Firebase Admin SDK (bypasses Firestore rules)
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDirectOperation, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('CreateCleanProjectsRoute');

/**
 * POST - Execute Clean Project Creation (withAuth protected)
 * Creates clean projects with proper structure using Firebase Admin SDK.
 *
 * @security withAuth + super_admin check + audit logging + admin:direct:operations permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleCreateCleanProjectsExecute(req, ctx);
  },
  { permissions: 'admin:direct:operations' }
));

/**
 * Internal handler for POST (clean project creation).
 */
async function handleCreateCleanProjectsExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted clean project creation', { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  try {
    const adminDb = getAdminFirestore();

    logger.info('CREATING CLEAN PROJECTS FOR DEVELOPMENT', { startedAt: new Date().toISOString() });

    // 🏢 ENTERPRISE: Load company ID from environment configuration
    const correctCompanyId = process.env.NEXT_PUBLIC_MAIN_COMPANY_ID || 'default-company-id';

    // Define clean projects with proper structure
    const cleanProjects = [
      {
        id: '2001',
        name: process.env.NEXT_PUBLIC_PRIMARY_PROJECT_NAME || 'Main Project',
        title: process.env.NEXT_PUBLIC_PRIMARY_PROJECT_TITLE || 'Modern Building Construction Project',
        company: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company',
        companyId: correctCompanyId,
        address: process.env.NEXT_PUBLIC_PRIMARY_PROJECT_ADDRESS || 'Main Street 15, City',
        city: process.env.NEXT_PUBLIC_DEFAULT_CITY || 'Θεσσαλονίκη',
        status: 'in_progress',
        progress: 75,
        startDate: '2023-03-15',
        completionDate: '2025-08-30',
        totalArea: 1250.5,
        totalValue: 850000,
        buildings: [
          {
            id: 'building_1_palaiologou',
            name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου',
            description: 'Κύριο κτίριο της πολυκατοικίας με 8 διαμερίσματα υψηλών προδιαγραφών',
            status: 'active',
            totalArea: 1850.5,
            units: 8,
            floors: [
              { id: 'floor_0', name: 'Ισόγειο', number: 0, units: 1 },
              { id: 'floor_1', name: '1ος Όροφος', number: 1, units: 2 },
              { id: 'floor_2', name: '2ος Όροφος', number: 2, units: 2 },
              { id: 'floor_3', name: '3ος Όροφος', number: 3, units: 2 },
              { id: 'floor_4', name: '4ος Όροφος', number: 4, units: 1 }
            ]
          },
          {
            id: 'building_2_palaiologou',
            name: 'ΚΤΙΡΙΟ Β - Βοηθητικές Εγκαταστάσεις',
            description: 'Βοηθητικό κτίριο με αποθήκες και χώρους κοινής ωφέλειας',
            status: 'construction',
            totalArea: 450.75,
            units: 6,
            floors: [
              { id: 'floor_-1', name: 'Υπόγειο', number: -1, units: 3 },
              { id: 'floor_0', name: 'Ισόγειο', number: 0, units: 3 }
            ]
          }
        ]
      },
      {
        id: '2002',
        name: 'Μεγάλου Αλεξάνδρου Συγκρότημα',
        title: 'Σύγχρονο εμπορικό και κατοικιακό συγκρότημα',
        company: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company',
        companyId: correctCompanyId,
        address: 'Μεγάλου Αλεξάνδρου 45, Κέντρο',
        city: process.env.NEXT_PUBLIC_DEFAULT_CITY || 'Θεσσαλονίκη',
        status: 'planning',
        progress: 25,
        startDate: '2024-01-10',
        completionDate: '2026-12-15',
        totalArea: 2500.0,
        totalValue: 1500000,
        buildings: []
      },
      {
        id: '2003',
        name: 'Τσιμισκή Εμπορικό Κέντρο',
        title: 'Πολυλειτουργικό εμπορικό κέντρο στην καρδιά της πόλης',
        company: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company',
        companyId: correctCompanyId,
        address: 'Τσιμισκή 120, Κέντρο',
        city: process.env.NEXT_PUBLIC_DEFAULT_CITY || 'Θεσσαλονίκη',
        status: 'completed',
        progress: 100,
        startDate: '2022-05-01',
        completionDate: '2024-03-30',
        totalArea: 3200.0,
        totalValue: 2200000,
        buildings: []
      }
    ];

    logger.info('Creating clean projects', { count: cleanProjects.length });

    const results = [];
    for (const project of cleanProjects) {
      logger.info('Creating project', { projectName: project.name });

      const projectData = {
        ...project,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastUpdate: new Date().toISOString()
      };

      // Remove buildings from main project document for normalization
      const { buildings, ...projectWithoutBuildings } = projectData;

      await adminDb.collection(COLLECTIONS.PROJECTS).doc(project.id).set(projectWithoutBuildings);

      // Create buildings if they exist
      for (const building of buildings || []) {
        const buildingData = {
          ...building,
          projectId: project.id,
          projectName: project.name,
          companyId: project.companyId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Remove floors from main building document for normalization
        const { floors, ...buildingWithoutFloors } = buildingData;

        await adminDb.collection(COLLECTIONS.BUILDINGS).doc(building.id).set(buildingWithoutFloors);

        // Create floors if they exist
        for (const floor of floors || []) {
          const floorData = {
            ...floor,
            projectId: project.id,
            buildingId: building.id,
            projectName: project.name,
            buildingName: building.name,
            companyId: project.companyId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await adminDb.collection(COLLECTIONS.FLOORS).doc(`${building.id}_${floor.id}`).set(floorData);
          logger.info('Created floor', { floorName: floor.name, buildingName: building.name });
        }

        logger.info('Created building', { buildingName: building.name, floorsCount: floors?.length || 0 });
      }

      results.push({
        projectId: project.id,
        projectName: project.name,
        companyId: project.companyId,
        buildingsCreated: buildings?.length || 0,
        floorsCreated: buildings?.reduce((total, b) => total + (b.floors?.length || 0), 0) || 0,
        status: 'SUCCESS'
      });

      logger.info('Successfully created project', { projectId: project.id, projectName: project.name });
    }

    // ADR-214 Phase 8: Use .count() instead of .get() for verification (no need to fetch full docs)
    logger.info('Verifying created documents...');
    const [projectsCount, buildingsCount, floorsCount] = await Promise.all([
      adminDb.collection(COLLECTIONS.PROJECTS).count().get(),
      adminDb.collection(COLLECTIONS.BUILDINGS).count().get(),
      adminDb.collection(COLLECTIONS.FLOORS).count().get()
    ]);

    const totalExecutionTime = Date.now() - startTime;

    const response = {
      success: true,
      summary: {
        projectsCreated: results.length,
        buildingsCreated: results.reduce((total, r) => total + r.buildingsCreated, 0),
        floorsCreated: results.reduce((total, r) => total + r.floorsCreated, 0),
        totalProjectsInDb: projectsCount.data().count,
        totalBuildingsInDb: buildingsCount.data().count,
        totalFloorsInDb: floorsCount.data().count
      },
      execution: {
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        executionTimeMs: totalExecutionTime,
        mode: 'CLEAN_CREATION_ADMIN_SDK'
      },
      target: {
        correctCompanyId,
        companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company'
      },
      results,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Clean Project Creation'
      }
    };

    logger.info('CLEAN PROJECT CREATION COMPLETED', { projectsCreated: response.summary.projectsCreated, buildingsCreated: response.summary.buildingsCreated, floorsCreated: response.summary.floorsCreated, executionTimeMs: totalExecutionTime });

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDirectOperation(
      ctx,
      'create_clean_projects',
      {
        operation: 'create-clean-projects',
        projectsCreated: results.length,
        buildingsCreated: response.summary.buildingsCreated,
        floorsCreated: response.summary.floorsCreated,
        targetCompanyId: correctCompanyId,
        createdProjects: results.map(r => ({
          projectId: r.projectId,
          projectName: r.projectName,
          buildings: r.buildingsCreated,
          floors: r.floorsCreated,
        })),
        executionTimeMs: totalExecutionTime,
        result: 'success',
        metadata,
      },
      `Clean projects creation by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.warn('Audit logging failed (non-blocking)', { error: err });
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error: unknown) {
    const totalExecutionTime = Date.now() - startTime;
    const errorMessage = getErrorMessage(error);

    logger.error('CLEAN PROJECT CREATION ERROR', { error: errorMessage });

    return NextResponse.json({
      success: false,
      error: errorMessage,
      execution: {
        startedAt: new Date(startTime).toISOString(),
        failedAt: new Date().toISOString(),
        totalTimeMs: totalExecutionTime,
        mode: 'CLEAN_CREATION_ADMIN_SDK'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Clean Project Creation'
      }
    }, { status: 500 });
  }
}

/**
 * GET - System Information (withAuth protected)
 * Returns endpoint information and capabilities.
 *
 * @security withAuth + admin:direct:operations permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleCreateCleanProjectsInfo(req, ctx);
  },
  { permissions: 'admin:direct:operations' }
));

/**
 * Internal handler for GET (system info).
 */
async function handleCreateCleanProjectsInfo(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const correctCompanyId = process.env.NEXT_PUBLIC_MAIN_COMPANY_ID || 'default-company-id';

  return NextResponse.json({
    success: true,
    system: {
      name: 'Clean Project Creation',
      version: '1.0.0',
      description: 'Creates fresh projects with proper structure for development',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    },
    usage: {
      endpoint: 'POST /api/admin/create-clean-projects',
      method: 'Firebase Admin SDK creation',
      target: `Create clean normalized projects with companyId: ${correctCompanyId}`,
      features: ['Normalized structure', 'Buildings & Floors', 'Clean IDs']
    },
    requester: {
      email: ctx.email,
      globalRole: ctx.globalRole,
      hasAccess: ctx.globalRole === 'super_admin'
    }
  });
}