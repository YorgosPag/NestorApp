/**
 * =============================================================================
 * Floorplan Backgrounds API — PATCH (transform | calibration) + DELETE cascade
 * =============================================================================
 *
 * PATCH /api/floorplan-backgrounds/[id]
 *   body: { kind: 'transform', transform?, opacity?, visible?, locked? }
 *      or { kind: 'calibration', oldTransform, newTransform, calibration }
 *
 * DELETE /api/floorplan-backgrounds/[id]
 *   - cascades floorplan_overlays linked to this background
 *   - the doc delete triggers Cloud Function for files/{fileId} ref-count cleanup
 *
 * RBAC (Q9): super_admin, company_admin, internal_user.
 *
 * Αποκάλυψη (ADR-742 §3.4): ξένο υπόβαθρο ⇒ `404` **πανομοιότυπο** με το γνήσιο
 * «δεν βρέθηκε»· bypass ρόλος ⇒ ειλικρινές `403`. Το «κλειδωμένο» είναι
 * **ξεχωριστό** `409` — μαρτυρά ότι ο πόρος υπάρχει και σου ανήκει.
 *
 * @module api/floorplan-backgrounds/[id]/route
 * @enterprise ADR-340 Phase 7
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { FloorplanBackgroundService } from '@/services/floorplan-background/floorplan-background.service';
import { FloorplanCascadeDeleteService } from '@/services/floorplan-background/floorplan-cascade-delete.service';
import { CalibrationRemapService } from '@/services/floorplan-background/calibration-remap.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { BackgroundLockedError } from '@/services/floorplan-background/background-ownership';
import {
  backgroundErrorResponse,
  backgroundNotFoundResponse,
  badRequest,
} from '../_background-error-response';
import type {
  BackgroundTransform,
  CalibrationData,
} from '@/subapps/dxf-viewer/floorplan-background/providers/types';

const logger = createModuleLogger('FloorplanBackgroundIdRoute');

const WRITE_ROLES = ['super_admin', 'company_admin', 'internal_user'] as const;

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// HELPERS
// ============================================================================

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isTransform(v: unknown): v is BackgroundTransform {
  if (!v || typeof v !== 'object') return false;
  const t = v as BackgroundTransform;
  return (
    isFiniteNumber(t.translateX) &&
    isFiniteNumber(t.translateY) &&
    isFiniteNumber(t.scaleX) &&
    isFiniteNumber(t.scaleY) &&
    isFiniteNumber(t.rotation)
  );
}

function isCalibrationData(v: unknown): v is CalibrationData {
  if (!v || typeof v !== 'object') return false;
  const c = v as CalibrationData;
  if (c.method !== 'two-point') return false;
  if (!isFiniteNumber(c.realDistance) || c.realDistance <= 0) return false;
  if (!['m', 'cm', 'mm', 'ft', 'in'].includes(c.unit)) return false;
  if (!c.pointA || !isFiniteNumber(c.pointA.x) || !isFiniteNumber(c.pointA.y)) return false;
  if (!c.pointB || !isFiniteNumber(c.pointB.x) || !isFiniteNumber(c.pointB.y)) return false;
  return true;
}

/**
 * Ό,τι πρέπει να ισχύει **πριν** αγγίξουμε υπόβαθρο: ταυτοποιημένος tenant και
 * id στη διαδρομή. Ήταν αντιγραμμένο σε `handlePatch` και `handleDelete` — τρεις
 * προϋποθέσεις που, αν αποκλίνουν, αποκλίνουν **σιωπηλά**.
 *
 * Διακοσμητής, στο ίδιο πνεύμα με τα `withAuth` / `withStandardRateLimit` που
 * ήδη τυλίγουν αυτά τα routes: εξασφαλίζει τις προϋποθέσεις **μία φορά** και
 * παραδίδει στον χειριστή ένα `id` που είναι ήδη βέβαιο.
 *
 * Έτσι ο χειριστής δεν έχει καν τη δυνατότητα να ξεχάσει έναν έλεγχο — η
 * απουσία του δεν είναι «κάτι που πρέπει να θυμηθείς», είναι αδύνατη.
 */
function withBackgroundTarget(
  handler: (request: NextRequest, ctx: AuthContext, id: string) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    ctx: AuthContext,
    _cache: PermissionCache,
    routeContext?: RouteContext,
  ): Promise<NextResponse> => {
    if (!ctx.companyId) return badRequest('companyId missing on auth context', 403);
    if (!routeContext) return badRequest('Missing route context', 500);
    const { id } = await routeContext.params;
    if (!id) return badRequest('Missing background id');
    return handler(request, ctx, id);
  };
}

// ============================================================================
// PATCH
// ============================================================================

const handlePatch = withBackgroundTarget(async (request, ctx, id) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }
  if (!body || typeof body !== 'object') return badRequest('Body must be an object');

  const kind = (body as { kind?: unknown }).kind;

  try {
    if (kind === 'transform') {
      const { transform, opacity, visible, locked } = body as {
        transform?: Partial<BackgroundTransform>;
        opacity?: number;
        visible?: boolean;
        locked?: boolean;
      };
      const updated = await FloorplanBackgroundService.patchTransform(id, {
        companyId: ctx.companyId,
        transform: transform ?? {},
        opacity,
        visible,
        locked,
        updatedBy: ctx.uid,
      });
      return NextResponse.json({ background: updated });
    }

    if (kind === 'calibration') {
      const { oldTransform, newTransform, calibration } = body as {
        oldTransform?: BackgroundTransform;
        newTransform?: BackgroundTransform;
        calibration?: CalibrationData;
      };
      if (!isTransform(oldTransform)) return badRequest('Invalid oldTransform');
      if (!isTransform(newTransform)) return badRequest('Invalid newTransform');
      if (!isCalibrationData(calibration)) return badRequest('Invalid calibration data');

      const existing = await FloorplanBackgroundService.getById(id, ctx.companyId);
      // `getById` είναι **σιωπηλό** (ADR-742): ξένο ≡ ανύπαρκτο. Άρα εδώ το
      // `null` καλύπτει ήδη και τις δύο περιπτώσεις — μία απόκριση, καμία
      // διαρροή. Το ίδιο σώμα με το `notFound` του catch, από την ίδια πηγή.
      if (!existing) return backgroundNotFoundResponse(id);
      if (existing.locked) {
        const locked = new BackgroundLockedError(id);
        return NextResponse.json({ error: locked.message, code: locked.code }, { status: 409 });
      }

      const remap = await CalibrationRemapService.applyCalibration({
        companyId: ctx.companyId,
        backgroundId: id,
        oldTransform,
        newTransform,
        calibration,
        updatedBy: ctx.uid,
      });
      const updated = await FloorplanBackgroundService.getById(id, ctx.companyId);
      return NextResponse.json({ background: updated, remap });
    }

    return badRequest('Invalid kind: expected "transform" or "calibration"');
  } catch (err) {
    const msg = getErrorMessage(err);
    // Το log κρατά **την αλήθεια** ακέραιη — τη μεταμφίεση τη βλέπει μόνο το σύρμα.
    logger.error('PATCH failed', { id, kind, error: msg });
    const mapped = backgroundErrorResponse({
      err,
      ctx,
      notFound: () => backgroundNotFoundResponse(id),
    });
    if (mapped) return mapped;
    return NextResponse.json({ error: msg, code: 'PATCH_FAILED' }, { status: 500 });
  }
});

// ============================================================================
// DELETE
// ============================================================================

const handleDelete = withBackgroundTarget(async (_request, ctx, id) => {
  // Το «δεν βρέθηκε» του DELETE έχει **δικό του** σχήμα (το συμβόλαιο της
  // διαδρομής). Ορίζεται μία φορά και εξυπηρετεί **και** το γνήσιο **και** το
  // μεταμφιεσμένο — δεν υπάρχει τρόπος να αποκλίνουν (ADR-742 §3.4).
  const notFound = () => NextResponse.json({ deleted: false }, { status: 404 });

  try {
    const existing = await FloorplanBackgroundService.getById(id, ctx.companyId);
    if (!existing) return notFound();

    const overlaysDeleted = await FloorplanCascadeDeleteService.cascadeOverlaysForBackground(
      ctx.companyId,
      id,
    );

    await FloorplanBackgroundService.deleteById(id, ctx.companyId);

    logger.info('Background deleted via API', { id, overlaysDeleted });
    return NextResponse.json({ deleted: true, overlaysDeleted });
  } catch (err) {
    const msg = getErrorMessage(err);
    logger.error('DELETE failed', { id, error: msg });
    // Άμυνα σε βάθος: σήμερα το σιωπηλό `getById` παραπάνω κόβει το ξένο id
    // **πριν** φτάσει εδώ, οπότε αυτός ο κλάδος δεν εκτελείται. Αν αύριο
    // αλλάξει η σειρά, η άρνηση του `deleteById` πρέπει να βγει από το ίδιο
    // σύνορο — όχι ως `500` που μαρτυρά «κάτι συνέβη εκεί».
    const mapped = backgroundErrorResponse({ err, ctx, notFound });
    if (mapped) return mapped;
    return NextResponse.json({ error: msg, code: 'DELETE_FAILED' }, { status: 500 });
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

export const PATCH = withStandardRateLimit(
  withAuth(handlePatch, { requiredGlobalRoles: [...WRITE_ROLES] }),
);

export const DELETE = withStandardRateLimit(
  withAuth(handleDelete, { requiredGlobalRoles: [...WRITE_ROLES] }),
);
