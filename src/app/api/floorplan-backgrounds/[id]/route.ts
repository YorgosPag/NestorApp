/**
 * =============================================================================
 * Floorplan Backgrounds API — PATCH (transform | calibration) + DELETE cascade
 * =============================================================================
 *
 * PATCH /api/floorplan-backgrounds/[id]
 *   body: { kind: 'transform', transform?, opacity?, visible?, locked? }
 *      or { kind: 'calibration', oldTransform, newTransform, calibration }
 *      or { kind: 'uncalibrate', oldTransform, newTransform, scale: BackgroundScale | null }  (ADR-929 §6.24: αναίρεση πρώτης βαθμονόμησης)
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
import { CalibrationRemapService, type RemapInput } from '@/services/floorplan-background/calibration-remap.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { BackgroundLockedError } from '@/services/floorplan-background/background-ownership';
import {
  backgroundErrorResponse,
  backgroundNotFoundResponse,
  badRequest,
} from '../_background-error-response';
import type { BackgroundTransform, CalibrationData } from '@/subapps/dxf-viewer/floorplan-background/providers/types';
// ADR-929 Φ5.3γ — ο έλεγχος της εγγραφής βαθμονόμησης ζει σε ΕΝΑ καθαρό module (N αναφορές, προέλευση), με tests.
import { isCalibrationData } from '@/subapps/dxf-viewer/floorplan-background/geometry/calibration-record-guard';
import { logAuditEvent } from '@/lib/auth/audit';
import { isFiniteNumber } from '@/lib/type-guards';
import { isBackgroundScale, type BackgroundScale } from '@/types/floorplan-overlays';

const logger = createModuleLogger('FloorplanBackgroundIdRoute');

const WRITE_ROLES = ['super_admin', 'company_admin', 'internal_user'] as const;

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// HELPERS
// ============================================================================

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
// PATCH — calibration · uncalibrate (ADR-929 Φ5.2γ · §6.24)
// ============================================================================

/**
 * Η εγγραφή βαθμονόμησης όπως ήρθε από το σύρμα, επικυρωμένη. `uncalibrate` = η **αναίρεση** μιας πρώτης βαθμονόμησης
 * (ADR-929 §6.24): ρητή πρόθεση, όχι `calibration: null` κρυμμένο στο ίδιο `kind`.
 */
type CalibrationPatch = {
  readonly kind: 'calibration' | 'uncalibrate';
  readonly oldTransform: BackgroundTransform;
  readonly newTransform: BackgroundTransform;
} & ({ readonly calibration: CalibrationData } | { readonly calibration: null; readonly scale: BackgroundScale | null });

function parseCalibrationPatch(kind: 'calibration' | 'uncalibrate', body: object): CalibrationPatch | string {
  const { oldTransform, newTransform, calibration, scale } = body as {
    oldTransform?: unknown; newTransform?: unknown; calibration?: unknown; scale?: unknown;
  };
  if (!isTransform(oldTransform)) return 'Invalid oldTransform';
  if (!isTransform(newTransform)) return 'Invalid newTransform';
  if (kind === 'calibration') {
    return isCalibrationData(calibration) ? { kind, oldTransform, newTransform, calibration } : 'Invalid calibration data';
  }
  if (scale !== null && !isBackgroundScale(scale)) return 'Invalid scale';
  return { kind, oldTransform, newTransform, calibration: null, scale };
}

const CALIBRATION_AUDIT_REASON: Readonly<Record<CalibrationPatch['kind'], string>> = {
  calibration: 'Background calibration + overlay remap (ADR-929 Φ5.2γ)',
  uncalibrate: 'Background calibration undone — back to uncalibrated + overlay remap (ADR-929 §6.24)',
};

/** Ο στόχος της αναπροσαρμογής, με τη διάκριση «βαθμονόμηση / χωρίς» ρητή (ο τύπος του service τη ζητά). */
function remapInputOf(ctx: AuthContext, id: string, patch: CalibrationPatch): RemapInput {
  const base = {
    companyId: ctx.companyId, backgroundId: id, updatedBy: ctx.uid,
    oldTransform: patch.oldTransform, newTransform: patch.newTransform,
  };
  return patch.calibration === null
    ? { ...base, calibration: null, scale: patch.scale }
    : { ...base, calibration: patch.calibration };
}

async function patchCalibration(ctx: AuthContext, id: string, patch: CalibrationPatch): Promise<NextResponse> {
  const existing = await FloorplanBackgroundService.getById(id, ctx.companyId);
  // `getById` είναι **σιωπηλό** (ADR-742): ξένο ≡ ανύπαρκτο. Άρα εδώ το
  // `null` καλύπτει ήδη και τις δύο περιπτώσεις — μία απόκριση, καμία
  // διαρροή. Το ίδιο σώμα με το `notFound` του catch, από την ίδια πηγή.
  if (!existing) return backgroundNotFoundResponse(id);
  if (existing.locked) {
    const locked = new BackgroundLockedError(id);
    return NextResponse.json({ error: locked.message, code: locked.code }, { status: 409 });
  }
  const remap = await CalibrationRemapService.applyCalibration(remapInputOf(ctx, id, patch));
  await logAuditEvent(ctx, 'data_updated', id, 'api', {
    metadata: { path: `/api/floorplan-backgrounds/${id} (PATCH ${patch.kind})`, reason: CALIBRATION_AUDIT_REASON[patch.kind] },
  });
  const updated = await FloorplanBackgroundService.getById(id, ctx.companyId);
  return NextResponse.json({ background: updated, remap });
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

    if (kind === 'calibration' || kind === 'uncalibrate') {
      const parsed = parseCalibrationPatch(kind, body);
      return typeof parsed === 'string' ? badRequest(parsed) : await patchCalibration(ctx, id, parsed);
    }

    return badRequest('Invalid kind: expected "transform", "calibration" or "uncalibrate"');
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
