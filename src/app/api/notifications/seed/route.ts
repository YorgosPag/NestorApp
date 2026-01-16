/**
 * 🔔 NOTIFICATIONS API - SEED SAMPLE DATA
 *
 * Development utility to create sample notifications for testing.
 *
 * @module api/notifications/seed
 * @version 2.0.0
 * @updated 2026-01-16 - AUTHZ PHASE 2: Added super_admin protection
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { createSampleNotifications } from '@/services/notificationService';

interface SeedRequestBody {
  userId?: string;
}

// Response types for type-safe withAuth
type SeedSuccess = {
  success: true;
  message: string;
  userId: string;
  count?: number;
};

type SeedError = {
  success: false;
  error: string;
  details?: string;
};

type SeedResponse = SeedSuccess | SeedError;

export async function POST(request: NextRequest) {
  const handler = withAuth<SeedResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<SeedResponse>> => {
      try {
        console.log(`🔔 [Notifications/Seed] Starting sample data creation...`);
        console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole}), Company ${ctx.companyId}`);

        // Get user ID from request body (Firebase Auth UID)
        const body = await req.json() as SeedRequestBody;
        const userId = body.userId;

        if (!userId) {
          return NextResponse.json({
            success: false,
            error: 'userId is required in request body'
          }, { status: 400 });
        }

        console.log(`🌱 Creating sample notifications for user: ${userId}`);

        await createSampleNotifications(userId);

        console.log(`✅ [Notifications/Seed] Sample notifications created successfully`);

        return NextResponse.json({
          success: true,
          message: `Sample notifications created for ${userId}`,
          userId
        });
      } catch (error) {
        console.error('❌ [Notifications/Seed] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to create sample notifications',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
}
