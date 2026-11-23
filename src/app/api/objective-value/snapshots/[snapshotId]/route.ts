/**
 * @fileoverview `GET /api/objective-value/snapshots/{snapshotId}` — ένα στιγμιότυπο του χώρου του δρώντος, **με τη
 * ζωντανή απόκλιση** (ADR-947 Δ3 · Φ2).
 * @related services/objective-value/objective-value-snapshots.server.ts · lib/objective-value/objective-value-divergence.ts
 *
 * Απάντηση: `{ snapshot, divergence }`. Η απόκλιση υπολογίζεται **τώρα** (μηχανή → πίνακας ζωνών → χρόνος), ποτέ δεν
 * αποθηκεύεται (ADR-889 §10.2) — άρα καμία προσωρινή μνήμη στην απάντηση.
 * Όριο: **standard** — ανάγνωση ενός εγγράφου και των ζωνών μίας θέσης.
 *
 * ⛔ **Dark launch**: κλειστός διακόπτης `OBJECTIVE_VALUE_PROFESSIONAL_TIERS` ⇒ 404.
 * 🔒 Στιγμιότυπο άλλου χώρου, άκυρο id ή αλλοιωμένο αποτύπωμα ≡ ανύπαρκτο (404, ποτέ 403).
 */

import type { NextRequest } from 'next/server';

import { isAppFeatureEnabled } from '@/config/feature-flags';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { objectiveValueSnapshotApiError } from '@/lib/objective-value/objective-value-snapshot-request';
import { readObjectiveValueSnapshot } from '@/services/objective-value/objective-value-snapshots.server';

interface SnapshotRouteContext {
  readonly params: Promise<{ snapshotId: string }>;
}

async function readSnapshotHandler(_request: NextRequest, ctx: AuthContext, snapshotId: string) {
  if (!isAppFeatureEnabled('OBJECTIVE_VALUE_PROFESSIONAL_TIERS')) throw new ApiError(404, 'Not found', 'NOT_FOUND');
  const result = await readObjectiveValueSnapshot(getAdminFirestore(), { companyId: ctx.companyId, uid: ctx.uid }, snapshotId, new Date());
  if (!result.ok) throw objectiveValueSnapshotApiError(result.refusal, result.missing);
  return apiSuccess({ snapshot: result.snapshot, divergence: result.divergence });
}

export async function GET(request: NextRequest, segmentData: SnapshotRouteContext) {
  const { snapshotId } = await segmentData.params;
  const handler = withStandardRateLimit(
    withAuth((req: NextRequest, ctx: AuthContext) => readSnapshotHandler(req, ctx, snapshotId), { permissions: 'reports:reports:view' }),
  );
  return handler(request);
}
