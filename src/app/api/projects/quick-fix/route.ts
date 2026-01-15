/**
 * 🛠️ UTILITY: QUICK FIX PROJECTS
 *
 * Break-glass utility for quick project fixes and creation.
 *
 * @module api/projects/quick-fix
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { EnterpriseConfigurationManager } from '@/core/configuration/enterprise-config-management';
import { COLLECTIONS } from '@/config/firestore-collections';

/**
 * Database-driven company lookup (Admin SDK)
 */
async function getCompanyIdByName(companyName: string): Promise<string | null> {
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.CONTACTS)
      .where('type', '==', 'company')
      .where('companyName', '==', companyName)
      .get();

    if (snapshot.empty) {
      console.warn(`⚠️  Company not found in database: ${companyName}`);
      return null;
    }

    return snapshot.docs[0].id;
  } catch (error) {
    console.error(`🚨 Error loading company ID for ${companyName}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      console.log('🔧 [Projects/QuickFix] Starting quick fix operations...');
      console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole}), Company ${ctx.companyId}`);

      try {

        // ============================================================================
        // STEP 1: LOAD COMPANY IDs FROM DATABASE
        // ============================================================================

        const configManager = EnterpriseConfigurationManager.getInstance();

        const mainCompanyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Main Company';
        const companyNames = (process.env.NEXT_PUBLIC_PARTNER_COMPANIES ||
          'Company A,Company B,Company C,Company D,Company E,Company F'
        ).split(',').map(name => name.trim());

        const pagonisCompanyId = await getCompanyIdByName(mainCompanyName);
        const [alysidaCompanyId, jpAvaxCompanyId, mytilineosCompanyId, ternaCompanyId, aktorCompanyId] =
          await Promise.all(companyNames.slice(0, 5).map(name => getCompanyIdByName(name)));

        if (!pagonisCompanyId) {
          return NextResponse.json({
            error: `Primary company "${mainCompanyName}" not found in database`,
            suggestion: 'Please ensure company data exists in database before running fixes'
          }, { status: 404 });
        }

        // ============================================================================
        // STEP 2: PREPARE FIX OPERATIONS
        // ============================================================================

        const fixes = [
      // Fix existing project 1001 - Database-driven
      {
        projectId: '1001',
        companyId: pagonisCompanyId,
        action: 'update'
      },
      // Fix project 1002 - Database-driven
      {
        projectId: '1002',
        companyId: pagonisCompanyId,
        action: 'update'
      },
      // Fix project 1003 - Database-driven
      {
        projectId: '1003',
        companyId: pagonisCompanyId,
        action: 'update'
      },
      // Create new projects for other companies (if they exist) - Database-driven
      ...(alysidaCompanyId ? [{
        projectId: '1004',
        companyId: alysidaCompanyId,
        companyName: 'ΑΛΥΣΙΔΑ ΑΕ',
        action: 'create'
      }] : []),
      ...(jpAvaxCompanyId ? [{
        projectId: '1005',
        companyId: jpAvaxCompanyId,
        companyName: 'J&P ΑΒΑΞ ΑΕ',
        action: 'create'
      }] : []),
      ...(mytilineosCompanyId ? [{
        projectId: '1006',
        companyId: mytilineosCompanyId,
        companyName: 'ΜΥΤΙΛΗΝΑΙΟΣ ΑΕ',
        action: 'create'
      }] : []),
      ...(ternaCompanyId ? [{
        projectId: '1007',
        companyId: ternaCompanyId,
        companyName: 'ΤΕΡΝΑ ΑΕ',
        action: 'create'
      }] : []),
      ...(aktorCompanyId ? [{
        projectId: '1008',
        companyId: aktorCompanyId,
        companyName: 'ΑΚΤΩΡ ΑΤΕ',
        action: 'create'
      }] : [])
    ];

        console.log(`🏗️ Enterprise fixes prepared: ${fixes.length} database-driven operations`);

        // ============================================================================
        // STEP 3: EXECUTE FIX OPERATIONS (Admin SDK)
        // ============================================================================

        const results = [];

        for (const fix of fixes) {
          try {
            if (fix.action === 'update') {
              // Update existing project (Admin SDK)
              await adminDb
                .collection(COLLECTIONS.PROJECTS)
                .doc(fix.projectId)
                .update({
                  companyId: fix.companyId,
                  updatedAt: new Date().toISOString()
                });

              console.log(`✅ Updated project ${fix.projectId} with companyId ${fix.companyId}`);
              results.push({
                projectId: fix.projectId,
                action: 'updated',
                companyId: fix.companyId
              });

            } else if (fix.action === 'create') {
              // Create new project (Admin SDK)
              const newProject = {
            name: `Εμπορικό Κέντρο ${fix.companyName}`,
            title: `Ανάπτυξη εμπορικού κέντρου - ${fix.companyName}`,
            address: `Κεντρική Λεωφόρος, ${process.env.NEXT_PUBLIC_DEFAULT_CITY || 'Αθήνα'}`,
            city: process.env.NEXT_PUBLIC_DEFAULT_CITY || "Αθήνα",
            company: fix.companyName,
            companyId: fix.companyId,
            status: "planning",
            progress: 10,
            startDate: "2024-02-01",
            completionDate: "2026-06-30",
            totalValue: 1500000,
            totalArea: 2500.5,
            lastUpdate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            buildings: [
              {
                id: "building_1_main",
                name: "ΚΤΙΡΙΟ Α - Κύριο",
                description: "Κύριο κτίριο εμπορικού κέντρου",
                status: "planning",
                totalArea: 2000.5,
                units: 15,
                floors: [
                  { id: "floor_0", name: "Ισόγειο", number: 0, units: 10 },
                  { id: "floor_1", name: "1ος Όροφος", number: 1, units: 5 }
                ]
              },
              {
                id: "building_2_parking",
                name: "ΚΤΙΡΙΟ Β - Πάρκινγκ",
                description: "Υπόγειο πάρκινγκ",
                status: "planning",
                totalArea: 500,
                units: 100,
                floors: [
                  { id: "floor_-1", name: "Υπόγειο", number: -1, units: 100 }
                ]
              }
            ]
          };

              await adminDb
                .collection(COLLECTIONS.PROJECTS)
                .doc(fix.projectId)
                .set(newProject);

              console.log(`✅ Created project ${fix.projectId} for ${fix.companyName}`);
              results.push({
                projectId: fix.projectId,
                action: 'created',
                companyId: fix.companyId,
                companyName: fix.companyName
              });
            }

          } catch (error) {
            console.error(`❌ Failed to process ${fix.action} for project ${fix.projectId}:`, error);
            results.push({
              projectId: fix.projectId,
              action: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        console.log(`✅ [Projects/QuickFix] Complete: Processed ${results.length} operations`);

        return NextResponse.json({
          success: true,
          message: `Processed ${results.length} project fixes`,
          results
        });

      } catch (error) {
        console.error('❌ [Projects/QuickFix] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
}