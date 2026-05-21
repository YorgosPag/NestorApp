/**
 * POST /api/alerts/dismiss
 *
 * Dismiss a single construction alert — ADR-266 §5.8 / Phase D.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { dismissAlert } from '@/services/construction-alert.service';

type DismissResponse = { success: boolean; error?: string };

export async function POST(request: NextRequest) {
  const handler = withStandardRateLimit(
    withAuth<DismissResponse>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        let body: { alertId?: string };
        try {
          body = (await req.json()) as { alertId?: string };
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid request body' },
            { status: 400 },
          );
        }

        if (!body.alertId) {
          return NextResponse.json(
            { success: false, error: 'alertId required' },
            { status: 400 },
          );
        }

        await dismissAlert(body.alertId, ctx.uid);

        return NextResponse.json({ success: true });
      },
    ),
  );

  return handler(request);
}
