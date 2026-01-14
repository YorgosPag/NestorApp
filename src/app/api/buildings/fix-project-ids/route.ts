import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BUILDING_IDS } from '@/config/building-ids-config';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

/** Response type for fix-project-ids API */
interface FixProjectIdsResponse {
  success: boolean;
  message?: string;
  results?: Array<{
    buildingId: string;
    newProjectId: string;
    status: string;
  }>;
  summary?: {
    totalUpdates: number;
    projectId: string;
    projectName: string;
  };
  error?: string;
  details?: string;
}

export const POST = withAuth<FixProjectIdsResponse>(
  async (_request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    try {
      // 🔒 SUPER_ADMIN ONLY: Migration/fix operations require highest privilege
      if (ctx.globalRole !== 'super_admin') {
        console.warn(`❌ Unauthorized: User ${ctx.uid} attempted fix-project-ids (role: ${ctx.globalRole})`);
        return NextResponse.json({
          success: false,
          error: 'Access denied',
          details: 'This operation requires super_admin role'
        }, { status: 403 });
      }

      console.log(`🔧 [super_admin: ${ctx.uid}] Fixing building project IDs...`);

      // 🏢 ENTERPRISE: Update buildings to use configured project ID
      const updates = [
        {
          buildingId: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_ID || "building_1_default",
          newProjectId: BUILDING_IDS.PROJECT_ID
        },
        {
          buildingId: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_ID || "building_2_default",
          newProjectId: BUILDING_IDS.PROJECT_ID
        }
      ];

      const results: Array<{ buildingId: string; newProjectId: string; status: string }> = [];

      for (const update of updates) {
        console.log(`🔧 Updating building ${update.buildingId} to project ${update.newProjectId}`);

        await updateDoc(doc(db, COLLECTIONS.BUILDINGS, update.buildingId), {
          projectId: update.newProjectId,
          updatedAt: new Date().toISOString()
        });

        console.log(`✅ Successfully updated building ${update.buildingId}`);
        results.push({
          buildingId: update.buildingId,
          newProjectId: update.newProjectId,
          status: 'updated'
        });
      }

      console.log('🎉 All building project IDs have been fixed!');

      return NextResponse.json({
        success: true,
        message: 'Building project IDs fixed successfully',
        results,
        summary: {
          totalUpdates: updates.length,
          projectId: BUILDING_IDS.PROJECT_ID,
          projectName: process.env.NEXT_PUBLIC_PRIMARY_PROJECT_NAME || "Main Project"
        }
      });

    } catch (error) {
      console.error('❌ Error fixing building project IDs:', error);

      return NextResponse.json({
        success: false,
        error: 'Failed to fix building project IDs',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  {} // No specific permission - super_admin check is inside handler
);
