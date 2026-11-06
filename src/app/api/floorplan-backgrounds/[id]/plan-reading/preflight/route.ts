/**
 * =============================================================================
 * POST /api/floorplan-backgrounds/[id]/plan-reading/preflight — προέλεγχος ανάγνωσης (ADR-929 Φ5.3α)
 * =============================================================================
 *
 * «Επιτρέπεται, πόσο θα κοστίσει, τι μένει από το όριο του μήνα;» **πριν** πατήσει ο άνθρωπος «Αποστολή» (πρακτική
 * Autodesk Generative Design / Adobe Firefly). Σώμα JSON: μέγεθος της όψης + τμήματα (έως 8.000, γι' αυτό όχι GET).
 * Καμία εικόνα δεν φτάνει εδώ, καμία εγγραφή δεν γίνεται.
 *
 * - Ιδεμποτία: `natural` — μόνο ανάγνωση. Η αναπαραγωγή αποθηκευμένης απάντησης θα έδειχνε **μπαγιάτικο** υπόλοιπο.
 * - Ρυθμός: STANDARD, ρητά (CHECK 3.78): ανάγνωση Firestore, όχι κλήση VLM.
 * - Αποκάλυψη (ADR-742 §3.4): ξένο υπόβαθρο ⇒ `404` πανομοιότυπο με το γνήσιο, όπως η ανάγνωση.
 *
 * @module api/floorplan-backgrounds/[id]/plan-reading/preflight/route
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md §6.6
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { previewPlanReadingForBackground } from '@/server/plan-recognition/plan-reading.service';
import {
  planReadingPreflightRequestSchema,
  type PlanReadingPreflightResponse,
} from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-contract';
import { backgroundErrorResponse, backgroundNotFoundResponse, badRequest } from '../../../_background-error-response';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('FloorplanPlanReadingPreflightRoute');

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function handlePost(request: NextRequest, ctx: AuthContext, routeCtx: RouteContext): Promise<NextResponse> {
  const { id } = await routeCtx.params;
  if (!id) return badRequest('Missing background id', 400);
  if (!ctx.companyId) return badRequest('Missing companyId in auth context', 403);
  try {
    const parsed = planReadingPreflightRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'REQUEST_INVALID', code: 'REQUEST_INVALID' }, { status: 422 });
    const result = await previewPlanReadingForBackground({ companyId: ctx.companyId, backgroundId: id, request: parsed.data });
    const body: PlanReadingPreflightResponse = { success: true, result };
    return NextResponse.json(body);
  } catch (error) {
    logger.error('[PlanReadingPreflight/Post] Error', { backgroundId: id, error: getErrorMessage(error) });
    const mapped = backgroundErrorResponse({ err: error, ctx, notFound: () => backgroundNotFoundResponse(id) });
    return mapped ?? NextResponse.json({ success: false, error: 'Plan reading preflight failed', code: 'INTERNAL' }, { status: 500 });
  }
}

export const POST = withStandardRateLimit(async (request: NextRequest, routeCtx?: RouteContext) => {
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handlePost(request, ctx, routeCtx!),
    {
      permissions: 'dxf:files:upload',
      idempotency: {
        mode: 'natural',
        why: 'Μόνο ανάγνωση (εκτίμηση + όριο), καμία εγγραφή· η αναπαραγωγή θα έδειχνε μπαγιάτικο υπόλοιπο',
      },
    },
  );
  return handler(request);
});
