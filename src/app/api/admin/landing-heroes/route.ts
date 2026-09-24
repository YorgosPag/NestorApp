/**
 * =============================================================================
 * ΕΙΚΟΝΕΣ ΗΡΩΑ — ΚΑΤΑΣΤΑΣΗ + ΝΕΑ ΕΚΔΟΣΗ (ADR-881 §5.1)
 * =============================================================================
 * - `GET`  = ποια έκδοση είναι ζωντανή ανά σελίδα + ιστορικό (νεότερη πρώτη). Καμία εγγραφή.
 * - `POST` = νέα **πρόχειρη** έκδοση: `upload` (νέα αρχεία) ή `refocus` (ίδιες εικόνες, άλλο σημείο).
 *            Δεν δημοσιεύει — αυτό είναι το `./publish`.
 *
 * 🔒 SECURITY: `super_admin` + ικανότητα `platform_landing_heroes:heroes:publish` + withSensitiveRateLimit.
 *    Επιφάνεια **πλατφόρμας**, όχι μισθωτή (ADR-881 §4.1). Ιδεμποτία από το `withAuth` (ADR-872).
 *
 * 🔑 Λεπτή διαδρομή: σύρμα → υπηρεσία. Ο κύκλος ζωής ζει στο `landing-hero-publication` (N.7.2 #7).
 * @module api/admin/landing-heroes
 */

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { BYPASS_ROLES } from '@/lib/auth/roles';
import { readJsonBody } from '@/lib/api/json-body';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  createLandingHeroRevisionBodySchema,
  type CreateLandingHeroRevisionBody,
  type LandingHeroesStateResponse,
} from '@/lib/landing/landing-hero-api';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  createLandingHeroRevision,
  deriveLandingHeroRevision,
  type LandingHeroRejection,
  type LandingHeroRevisionResult,
} from '@/services/landing-hero/landing-hero-publication';
import { listLandingHeroRevisionDocs, readLandingHeroPointersDoc } from '@/services/landing-hero/landing-hero-store';

const GUARD = {
  requiredGlobalRoles: BYPASS_ROLES,
  permissions: 'platform_landing_heroes:heroes:publish',
} as const;

async function getState(): Promise<NextResponse> {
  const db = getAdminFirestore();
  const [pointers, revisions] = await Promise.all([readLandingHeroPointersDoc(db), listLandingHeroRevisionDocs(db)]);
  const body: LandingHeroesStateResponse = { pointers, revisions };
  return NextResponse.json(body);
}

function runCreate(ctx: AuthContext, body: CreateLandingHeroRevisionBody) {
  const db = getAdminFirestore();
  if (body.kind === 'refocus') return deriveLandingHeroRevision(db, ctx, body.baseRevisionId, body.focalPoint);
  return createLandingHeroRevision(db, ctx, {
    page: body.page,
    dayPath: body.dayPath,
    duskPath: body.duskPath,
    focalPoint: body.focalPoint,
  });
}

/** Κάθε λόγος απόρριψης → HTTP. Νέος λόγος ⇒ ο μεταγλωττιστής ζητά γραμμή εδώ. */
const REJECTION_STATUS: Readonly<Record<LandingHeroRejection, number>> = {
  'foreign-source': 403,
  'shelf-failed': 502,
  'unreadable-image': 422,
  'dimensions-rejected': 422,
};

/** Αποτέλεσμα → HTTP. Ο λόγος ταξιδεύει ως **κλειδί** (`LANDING_HERO_API_ERRORS`), ποτέ ως κείμενο. */
function toResponse(result: LandingHeroRevisionResult | 'not-found'): NextResponse {
  if (result === 'not-found') return NextResponse.json({ error: 'revision-not-found' }, { status: 404 });
  if (result.outcome === 'rejected') {
    return NextResponse.json({ error: result.reason }, { status: REJECTION_STATUS[result.reason] });
  }
  return NextResponse.json({ revision: result.revision }, { status: 201 });
}

async function create(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const parsed = await readJsonBody(request, createLandingHeroRevisionBodySchema);
  if ('rejected' in parsed) return parsed.rejected;
  return toResponse(await runCreate(ctx, parsed.data));
}

export const GET = withSensitiveRateLimit(
  withAuth(async (_request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => getState(), GUARD),
);

export const POST = withSensitiveRateLimit(
  withAuth(async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => create(request, ctx), GUARD),
);
