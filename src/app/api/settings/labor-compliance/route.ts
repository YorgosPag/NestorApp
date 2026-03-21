/**
 * GET /api/settings/labor-compliance
 *
 * Server-side endpoint for reading labor compliance configuration.
 * Replaces client-side Firestore query that was blocked by security rules.
 *
 * @security withAuth (any authenticated user can read settings)
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('LaborComplianceSettingsRoute');

const baseGET = async (request: NextRequest) => {
  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
      }

      try {
        const docRef = adminDb.collection(COLLECTIONS.SETTINGS).doc(SYSTEM_DOCS.LABOR_COMPLIANCE_SETTINGS);
        const snapshot = await docRef.get();

        if (!snapshot.exists) {
          return NextResponse.json({ success: true, config: null });
        }

        const data = snapshot.data();
        return NextResponse.json({
          success: true,
          config: {
            insuranceClasses: data?.insuranceClasses ?? null,
            contributionRates: data?.contributionRates ?? null,
            lastUpdated: data?.lastUpdated ?? null,
          },
        });
      } catch (error) {
        logger.error('Failed to read labor compliance settings', {
          error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ success: false, error: 'Failed to read settings' }, { status: 500 });
      }
    }
  );

  return handler(request);
};

export const GET = withStandardRateLimit(baseGET);
