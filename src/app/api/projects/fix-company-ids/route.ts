/**
 * 🛠️ UTILITY: FIX PROJECT COMPANY IDs
 *
 * Break-glass utility for correcting project companyId references.
 *
 * @module api/projects/fix-company-ids
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection
 * @rateLimit STANDARD (60 req/min) - CRUD
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

// Response types for type-safe withAuth
type FixCompanyIdsSuccess = {
  success: true;
  message: string;
  companyMapping: Record<string, string>;
  updates: Array<{
    projectId: string;
    projectName: string;
    companyName: string;
    oldCompanyId: string;
    newCompanyId: string;
  }>;
  finalProjects: Array<{
    id: string;
    name?: unknown;
    company?: unknown;
    companyId?: unknown;
  }>;
  stats: {
    companiesFound: number;
    projectsFound: number;
    projectsUpdated: number;
  };
};

type FixCompanyIdsError = {
  success: false;
  error: string;
};

type FixCompanyIdsResponse = FixCompanyIdsSuccess | FixCompanyIdsError;

export const POST = withStandardRateLimit(async (request: NextRequest) => {
  const handler = withAuth<FixCompanyIdsResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<FixCompanyIdsResponse>> => {
      console.log('🔧 [Projects/FixCompanyIds] Starting company ID correction...');
      console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole}), Company ${ctx.companyId}`);

      try {
        // ============================================================================
        // STEP 1: GET ALL COMPANIES FROM CONTACTS (Admin SDK)
        // ============================================================================

        const contactsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.CONTACTS)
          .where('type', '==', 'company')
          .where('status', '==', 'active')
          .get();

        console.log(`📁 Found ${contactsSnapshot.docs.length} companies`);

        const companyMapping: Record<string, string> = {};
        contactsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log(`🏢 Company: ${data.companyName} -> ID: ${doc.id}`);
          companyMapping[data.companyName] = doc.id;
        });

        // ============================================================================
        // STEP 2: GET ALL PROJECTS (Admin SDK)
        // ============================================================================

        const projectsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.PROJECTS)
          .get();

        console.log(`🏗️ Found ${projectsSnapshot.docs.length} projects`);

        // ============================================================================
        // STEP 3: FIX COMPANY IDs WITH BATCH UPDATE (Admin SDK)
        // ============================================================================

        const batch = getAdminFirestore().batch();
        let updatedCount = 0;
        const updates: Array<{
          projectId: string;
          projectName: string;
          companyName: string;
          oldCompanyId: string;
          newCompanyId: string;
        }> = [];

        for (const projectDoc of projectsSnapshot.docs) {
          const projectData = projectDoc.data();
          const companyName = projectData.company;
          const currentCompanyId = projectData.companyId;
          const correctCompanyId = companyMapping[companyName];

          if (correctCompanyId && currentCompanyId !== correctCompanyId) {
            console.log(`🔄 Updating project "${projectData.name}"`);
            console.log(`   Company: ${companyName}`);
            console.log(`   Old companyId: ${currentCompanyId}`);
            console.log(`   New companyId: ${correctCompanyId}`);

            const projectRef = getAdminFirestore().collection(COLLECTIONS.PROJECTS).doc(projectDoc.id);
            batch.update(projectRef, {
              companyId: correctCompanyId,
              updatedAt: new Date().toISOString()
            });

            updates.push({
              projectId: projectDoc.id,
              projectName: projectData.name,
              companyName,
              oldCompanyId: currentCompanyId,
              newCompanyId: correctCompanyId
            });

            updatedCount++;
          } else if (!correctCompanyId) {
            console.log(`⚠️ No matching company found for: ${companyName}`);
          } else {
            console.log(`✅ Project "${projectData.name}" already has correct companyId`);
          }
        }

        if (updatedCount > 0) {
          await batch.commit();
          console.log(`✅ [Projects/FixCompanyIds] Batch committed: ${updatedCount} projects updated`);
        }

        // ============================================================================
        // STEP 4: VERIFICATION
        // ============================================================================

        console.log('📊 Verification...');
        const finalProjectsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.PROJECTS)
          .get();

        const finalProjects = finalProjectsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            company: data.company,
            companyId: data.companyId
          };
        });

        console.log(`✅ [Projects/FixCompanyIds] Complete: Fixed ${updatedCount} project company IDs`);

        return NextResponse.json({
          success: true,
          message: `Fixed ${updatedCount} project company IDs`,
          companyMapping,
          updates,
          finalProjects,
          stats: {
            companiesFound: contactsSnapshot.docs.length,
            projectsFound: projectsSnapshot.docs.length,
            projectsUpdated: updatedCount
          }
        });

      } catch (error) {
        console.error('❌ [Projects/FixCompanyIds] Error:', {
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
});
