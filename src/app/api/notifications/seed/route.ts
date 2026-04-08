/**
 * 🔔 NOTIFICATIONS API - SEED SAMPLE DATA
 *
 * Development utility to create sample notifications for testing.
 * Uses Admin SDK (server-only) — client create is blocked in Firestore rules.
 *
 * @module api/notifications/seed
 * @version 3.0.0
 * @updated 2026-04-08 - Migrated to Admin SDK (Ζήτημα 3: server-only notification create)
 * @rateLimit STANDARD (60 req/min) - Sample data seeding
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateNotificationId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('NotificationsSeedRoute');

interface SeedRequestBody {
  userId?: string;
}

type SeedSuccess = {
  success: true;
  message: string;
  userId: string;
  count: number;
};

type SeedError = {
  success: false;
  error: string;
  details?: string;
};

type SeedResponse = SeedSuccess | SeedError;

/** Sample notification templates for testing */
function buildSampleNotifications(userId: string) {
  return [
    {
      tenantId: 'default',
      userId,
      severity: 'info',
      title: 'Welcome to Enterprise Notifications',
      body: 'This is a real notification from Firestore!',
      channel: 'inapp',
      delivery: { state: 'delivered', attempts: 1 },
      source: { service: 'firestore', env: 'dev' },
    },
    {
      tenantId: 'default',
      userId,
      severity: 'success',
      title: 'System Deployed Successfully',
      body: 'Version 2.0 has been deployed to production',
      channel: 'inapp',
      delivery: { state: 'delivered', attempts: 1 },
      source: { service: 'deployment', env: 'prod' },
    },
    {
      tenantId: 'default',
      userId,
      severity: 'warning',
      title: 'High Memory Usage',
      body: 'Server memory usage is above 80%',
      channel: 'inapp',
      delivery: { state: 'delivered', attempts: 1 },
      source: { service: 'monitoring', env: 'prod' },
    },
  ];
}

const basePOST = async (request: NextRequest) => {
  const handler = withAuth<SeedResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<SeedResponse>> => {
      try {
        logger.info('[Notifications/Seed] Starting sample data creation', { userId: ctx.uid, globalRole: ctx.globalRole, companyId: ctx.companyId });

        const body = await req.json() as SeedRequestBody;
        const userId = body.userId;

        if (!userId) {
          return NextResponse.json({
            success: false,
            error: 'userId is required in request body'
          }, { status: 400 });
        }

        const db = getAdminFirestore();
        const samples = buildSampleNotifications(userId);

        for (const notification of samples) {
          const id = generateNotificationId();
          await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).set({
            ...notification,
            id,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        logger.info('[Notifications/Seed] Sample notifications created via Admin SDK', { count: samples.length });

        return NextResponse.json({
          success: true,
          message: `Sample notifications created for ${userId}`,
          userId,
          count: samples.length,
        });
      } catch (error) {
        logger.error('[Notifications/Seed] Error', {
          error: getErrorMessage(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to create sample notifications',
          details: getErrorMessage(error)
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
};

export const POST = withStandardRateLimit(basePOST);
