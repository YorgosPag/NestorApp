/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΗΣ ΔΗΛΩΣΗΣ ΟΡΟΦΟΥ** — `POST` υπογράφει, `DELETE` αίρει (ADR-907 §11.7).
 * @related services/listings/floor-plate-declaration.service (ο ΕΝΑΣ γραφέας) · services/listings/listing-media-refresh
 * @module app/api/floors/[floorId]/floor-plate/route
 *
 * ```
 * κηδεμονία ορόφου → δικαίωμα δημοσίευσης → κρίση (ο αναγνώστης) → υπογραφή + ιστορικό → ΕΠΑΝΑΠΡΟΒΟΛΗ των αγγελιών του ορόφου
 * ```
 *
 * 🔴 **ΑΔΕΛΦΗ ΠΟΡΤΑ, ΟΧΙ ΓΕΝΙΚΕΥΣΗ ΤΟΥ `publishPropertyMaterial`**: εκείνος ο κορμός γεννά **αρχείο** για **ένα ακίνητο**
 * (κηδεμονία ακινήτου, διαδοχή, bytes). Εδώ δεν γεννιέται αρχείο και δεν υπάρχει ένα ακίνητο — υπογράφεται μια πρόταση
 * για **όροφο**. Κοινό έχουν μόνο το τέλος: η επαναπροβολή είναι **τελευταία** και awaited (Ο-35).
 *
 * 🔒 Η υπογραφή **είναι** δημοσίευση — ρωτιέται ο ΕΝΑΣ τόπος (`mayChangePublication`), πριν από κάθε ανάγνωση.
 * ⚠️ Η άρνηση της κρίσης επιστρέφει `409` με `why` και `overlayId`: ο άνθρωπος μαθαίνει **τι** να διορθώσει (ADR-844 §1).
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { extractNestedIdFromUrl } from '@/lib/api/route-helpers';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FLOOR_PLATE_REFUSED_CODE, type FloorPlateDeclaration } from '@/lib/listings/floor-plate/floor-plate-declaration';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { mayChangePublication } from '@/services/file-record/file-classification.service';
import {
  declareFloorPlate,
  withdrawFloorPlate,
  type FloorPlateDeclarationOutcome,
} from '@/services/listings/floor-plate-declaration.service';
import { refreshListingsOfFloor, type ListingRefreshReport } from '@/services/listings/listing-media-refresh';
import { loadFloorInTenant } from '@/app/api/floors/floors.shared';

export const dynamic = 'force-dynamic';

interface FloorPlateDeclarationResponse {
  readonly floorId: string;
  readonly state: 'declared' | 'already' | 'withdrawn' | 'absent';
  /** Η δήλωση που ισχύει μετά την πράξη — `null` όταν ο όροφος δεν έχει. */
  readonly declaration: FloorPlateDeclaration | null;
  /** Τι έγινε στην αγγελία κάθε δημοσιευμένης μονάδας του ορόφου. */
  readonly listings: readonly ListingRefreshReport[];
}

type DoorResponse = NextResponse<ApiSuccessResponse<FloorPlateDeclarationResponse>>;

/** Κηδεμονία και δικαίωμα — πριν διαβαστεί το σώμα. Ξένος όροφος = ανύπαρκτος (η απάντηση είναι του `loadFloorInTenant`). */
async function enterDoor(request: NextRequest, ctx: AuthContext): Promise<{ floorId: string } | NextResponse> {
  if (!ctx.companyId) throw new ApiError(403, 'Missing company context');
  const floorId = extractNestedIdFromUrl(request.url, 'floors');
  if (!floorId) throw new ApiError(400, 'Floor ID is required');

  const floor = await loadFloorInTenant(getAdminFirestore(), floorId, ctx);
  if (floor instanceof NextResponse) return floor;

  const subject = { globalRole: ctx.globalRole, permissions: ctx.permissions, companyId: ctx.companyId };
  if (!mayChangePublication(subject)) throw new ApiError(403, 'Publication not permitted', 'FLOOR_PLATE_NOT_CAPABLE');
  return { floorId };
}

/** Η έκβαση του γραφέα ως απάντηση — κάθε άρνηση με τον **δικό της** κωδικό. */
async function respond(floorId: string, companyId: string, outcome: FloorPlateDeclarationOutcome): Promise<DoorResponse> {
  if (outcome.state === 'refused') {
    const { why, overlayId } = outcome;
    throw new ApiError(409, `Floor plate refused: ${why}`, FLOOR_PLATE_REFUSED_CODE, { why, overlayId });
  }
  if (outcome.state === 'failed') throw new ApiError(500, 'Floor plate declaration failed', 'FLOOR_PLATE_FAILED');

  // 🔴 **Η επαναπροβολή είναι ΤΕΛΕΥΤΑΙΑ και awaited** (Ο-35): όποιος πάτησε και είδε επιτυχία δικαιούται οι αγγελίες
  //    του ορόφου να έχουν ήδη αλλάξει. Τρέχει και στο `already`/`absent` — ιδεμποτική, και κλείνει ό,τι είχε μείνει πίσω.
  const listings = await refreshListingsOfFloor(getAdminFirestore(), floorId, companyId);
  const declaration = 'declaration' in outcome ? outcome.declaration : null;
  return apiSuccess<FloorPlateDeclarationResponse>({ floorId, state: outcome.state, declaration, listings });
}

async function fileIdOf(request: NextRequest): Promise<string> {
  const body: unknown = await request.json().catch(() => null);
  const fileId = typeof body === 'object' && body !== null ? (body as { fileId?: unknown }).fileId : undefined;
  if (typeof fileId !== 'string' || fileId.trim() === '') throw new ApiError(400, 'fileId is required', 'FLOOR_PLATE_FILE_REQUIRED');
  return fileId;
}

async function handlePost(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const door = await enterDoor(request, ctx);
  if (door instanceof NextResponse) return door;

  const fileId = await fileIdOf(request);
  const actor = { floorId: door.floorId, companyId: ctx.companyId, performedBy: ctx.uid };
  return respond(door.floorId, ctx.companyId, await declareFloorPlate(getAdminFirestore(), { ...actor, fileId }));
}

async function handleDelete(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const door = await enterDoor(request, ctx);
  if (door instanceof NextResponse) return door;

  const actor = { floorId: door.floorId, companyId: ctx.companyId, performedBy: ctx.uid };
  return respond(door.floorId, ctx.companyId, await withdrawFloorPlate(getAdminFirestore(), actor));
}

export const POST = withStandardRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handlePost(request, ctx),
    { permissions: 'projects:floors:view' },
  ),
);

export const DELETE = withStandardRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handleDelete(request, ctx),
    { permissions: 'projects:floors:view' },
  ),
);
