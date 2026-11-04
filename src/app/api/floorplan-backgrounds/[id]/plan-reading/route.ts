/**
 * =============================================================================
 * POST /api/floorplan-backgrounds/[id]/plan-reading — ανάγνωση κάτοψης (ADR-929 Φ3, Δ11)
 * =============================================================================
 *
 * multipart: `image` (η όψη που επιβεβαίωσε ο άνθρωπος, χωρίς πινακίδα — Δ15 #4) + `request` (όψη + τμήματα της Φ2).
 * Απάντηση: ανάγνωση σε `view-‰`, ή **ρητός λόγος** που δεν υπάρχει (Δ15 #1, Δ16 #4). Ποτέ εγγραφή στη σκηνή.
 *
 * - Ιδεμποτία: από το `withAuth` (CHECK 3.92). Το «τρέχει ήδη» απαντά **503** + `Retry-After`, ώστε το σύνορο να
 *   ελευθερώσει το κλειδί και ο πελάτης να ξαναρωτήσει με το **ίδιο** κλειδί (συμβόλαιο «τίποτα δεν άλλαξε»).
 * - Ρυθμός: HEAVY, ρητά (CHECK 3.78): κάθε κλήση είναι κλήση VLM.
 * - Αποκάλυψη (ADR-742 §3.4): ξένο υπόβαθρο ⇒ `404` πανομοιότυπο με το γνήσιο.
 *
 * @module api/floorplan-backgrounds/[id]/plan-reading/route
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md §6.4
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { readPlanForBackground } from '@/server/plan-recognition/plan-reading.service';
import type { PlanReadingRouteResponse } from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-contract';
import { backgroundErrorResponse, backgroundNotFoundResponse, badRequest } from '../../_background-error-response';
import { readPlanReadingMultipart } from './_plan-reading-multipart';

export const dynamic = 'force-dynamic';
/** Δ11: μία ανάγνωση VLM μιας πυκνής σάρωσης μετρήθηκε έως ~60″ (§6.4)· η μίσθωση της μίας-πτήσης είναι 150″. */
export const maxDuration = 120;

const logger = createModuleLogger('FloorplanPlanReadingRoute');
/** Δευτερόλεπτα ως την επόμενη ερώτηση όταν η ίδια ανάγνωση τρέχει ήδη. */
const IN_PROGRESS_RETRY_AFTER_S = 5;

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function handlePost(request: NextRequest, ctx: AuthContext, routeCtx: RouteContext): Promise<NextResponse> {
  const { id } = await routeCtx.params;
  if (!id) return badRequest('Missing background id', 400);
  if (!ctx.companyId) return badRequest('Missing companyId in auth context', 403);
  try {
    const decoded = await readPlanReadingMultipart(await request.formData());
    if (!decoded.ok) return NextResponse.json({ error: decoded.code, code: decoded.code }, { status: decoded.status });
    const result = await readPlanForBackground({ companyId: ctx.companyId, uid: ctx.uid, backgroundId: id, image: decoded.image, request: decoded.request });
    const body: PlanReadingRouteResponse = { success: true, result };
    if (result.status === 'unavailable' && result.reason === 'reading-in-progress') {
      return NextResponse.json(body, { status: 503, headers: { 'Retry-After': String(IN_PROGRESS_RETRY_AFTER_S) } });
    }
    if (result.status === 'unavailable') logger.warn('Plan reading unavailable', { backgroundId: id, reason: result.reason });
    return NextResponse.json(body);
  } catch (error) {
    logger.error('[PlanReading/Post] Error', { backgroundId: id, error: getErrorMessage(error) });
    const mapped = backgroundErrorResponse({ err: error, ctx, notFound: () => backgroundNotFoundResponse(id) });
    return mapped ?? NextResponse.json({ success: false, error: 'Plan reading failed', code: 'INTERNAL' }, { status: 500 });
  }
}

export const POST = withHeavyRateLimit(async (request: NextRequest, routeCtx?: RouteContext) => {
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handlePost(request, ctx, routeCtx!),
    { permissions: 'dxf:files:upload' },
  );
  return handler(request);
});
