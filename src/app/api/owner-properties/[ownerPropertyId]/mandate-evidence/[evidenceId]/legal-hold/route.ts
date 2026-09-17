/**
 * @fileoverview **ΔΙΚΑΣΤΙΚΗ ΔΕΣΜΕΥΣΗ ΠΑΓΩΜΕΝΟΥ ΑΠΟΔΕΙΚΤΙΚΟΥ** — τοποθέτηση/αποδέσμευση (ADR-864 §20.7 #3 · §21).
 * @related services/mandate/evidence-retention.service.ts · app/api/files/[fileId]/hold/route.ts
 * @module app/api/owner-properties/[ownerPropertyId]/mandate-evidence/[evidenceId]/legal-hold/route
 *
 * `POST …/legal-hold` · σώμα `{ act: 'place', reason }` ή `{ act: 'release' }`.
 *
 * 🔒 **ΕΝΑ δικαίωμα για κάθε δέσμευση** (`legal:holds:manage`, ADR-801) — το ίδιο με τη δέσμευση
 * αρχείου. Δύο δικαιώματα για την «ίδια πράξη σε άλλη πηγή» θα σήμαιναν ρόλο που φυλά το
 * ένα αποδεικτικό αλλά όχι το άλλο.
 *
 * 🔑 **Μόνο γραφείο, ποτέ πολίτης**: το μητρώο αποδεικτικών ανήκει στο **γραφείο** (`agencyCompanyId`)·
 * άρα `withAuth` (οργανισμός) και όχι η πόρτα του πολίτη. Ο μισθωτής του αιτούντος **είναι** ο
 * άξονας — ξένο γραφείο ή άλλο ακίνητο ⇒ η ίδια απουσία (404).
 *
 * ⚡ `SENSITIVE` ρητά (CHECK 3.78): αλλάζει **τι μπορεί να διατεθεί ποτέ**.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { holdReasonOf } from '@/lib/files/file-hold';
import { getAdminBucket, getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import {
  placeEvidenceLegalHold,
  releaseEvidenceLegalHold,
  type EvidenceHoldScope,
  type LegalHoldOutcome,
} from '@/services/mandate/evidence-retention.service';

type RouteContext = { params: Promise<{ ownerPropertyId: string; evidenceId: string }> };

const STATUS_BY_KIND: Readonly<Record<LegalHoldOutcome['kind'], number>> = {
  placed: 200,
  released: 200,
  absent: 404,
  'already-held': 409,
  failed: 500,
};

function toResponse(outcome: LegalHoldOutcome): NextResponse {
  const status = STATUS_BY_KIND[outcome.kind];
  return NextResponse.json({ success: status === 200, kind: outcome.kind }, { status });
}

async function scopeOf(ctx: AuthContext, routeContext?: RouteContext): Promise<EvidenceHoldScope | null> {
  const params = await routeContext?.params;
  const ownerPropertyId = decodeRouteParam(params?.ownerPropertyId ?? '').trim();
  const evidenceId = decodeRouteParam(params?.evidenceId ?? '').trim();
  if (ownerPropertyId === '' || evidenceId === '') return null;
  return { evidenceId, ownerPropertyId, agencyCompanyId: ctx.companyId };
}

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
  routeContext?: RouteContext,
): Promise<NextResponse> {
  const scope = await scopeOf(ctx, routeContext);
  if (scope === null) return toResponse({ kind: 'absent' });

  const payload = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (payload.act === 'release') {
    return toResponse(await releaseEvidenceLegalHold(getAdminFirestore(), getAdminBucket(), scope));
  }
  const reason = holdReasonOf(payload.reason);
  if (payload.act !== 'place' || reason === null) {
    return NextResponse.json({ error: 'Invalid legal hold command' }, { status: 400 });
  }
  return toResponse(await placeEvidenceLegalHold(getAdminFirestore(), getAdminBucket(), {
    ...scope, placedBy: ctx.uid, reason, nowISO: nowISO(),
  }));
}

export const POST = withSensitiveRateLimit(
  withAuth<unknown, RouteContext>(handlePost, { permissions: 'legal:holds:manage' }),
);
