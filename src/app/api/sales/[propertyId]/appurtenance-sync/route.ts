/**
 * =============================================================================
 * POST /api/sales/{propertyId}/appurtenance-sync — Sync parking/storage status
 * =============================================================================
 *
 * Updates commercialStatus and commercial data on linked parking/storage
 * spaces when a unit is reserved, sold, or reverted.
 *
 * Uses Firestore batch writes for atomicity.
 *
 * ⚠️ Το **σχήμα της γραφής** —  και το **ίχνος ελέγχου** που είναι αχώριστο από
 * αυτήν (CHECK 3.17) — ζουν στο `./appurtenance-sync-writes` και είναι τυπωμένα
 * επίτηδες: μέχρι τις 2026-08-11 ο κλάδος `revert` έγραφε εδώ
 * `commercialStatus: null`, τιμή **εκτός** του κλειστού συνόλου των επτά.
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/sales/[propertyId]/appurtenance-sync
 * @see ADR-199 Sales Appurtenances · ADR-777 §8.5α (δ)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';

import {
  applyAppurtenanceSync,
  validateSyncBody,
  type SyncRequestBody,
} from './appurtenance-sync-writes';

// =============================================================================
// POST — Sync appurtenance status
// =============================================================================

async function syncAppurtenances(
  req: NextRequest,
  ctx: AuthContext,
  propertyId: string,
): Promise<NextResponse> {
  const body = (await req.json()) as Partial<SyncRequestBody>;

  const validationError = validateSyncBody(body);
  if (validationError) {
    return NextResponse.json({ success: false, error: validationError }, { status: 400 });
  }

  const payload = body as SyncRequestBody;

  // Η καταγραφή του ίχνους ζει ΜΕΣΑ στο `applyAppurtenanceSync` — δες την κεφαλίδα
  // της: το CHECK 3.17 απαιτεί γραφή και ίχνος στο ίδιο αρχείο, και ένας δεύτερος
  // καλών δεν πρέπει να μπορεί να τη «θυμηθεί λάθος».
  await safeFirestoreOperation(
    async (db) => applyAppurtenanceSync(db, payload, propertyId, {
      uid: ctx.uid,
      email: ctx.email ?? null,
      companyId: ctx.companyId,
    }),
    undefined,
  );

  return NextResponse.json({
    success: true,
    message: `Synced ${payload.spaces.length} space(s) with action: ${payload.action}`,
    propertyId,
  });
}

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ propertyId: string }> }
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { propertyId } = await segmentData!.params;
        return await syncAppurtenances(req, ctx, propertyId);
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to sync appurtenances');
        console.error('[appurtenance-sync] Error:', message);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
