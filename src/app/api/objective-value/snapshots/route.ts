/**
 * @fileoverview `POST /api/objective-value/snapshots` — **παγώνει** έναν υπολογισμό αντικειμενικής αξίας σε αμετάβλητο
 * στιγμιότυπο (ADR-947 Δ3 · Φ2).
 * @related services/objective-value/objective-value-snapshots.server.ts (η πράξη) ·
 *   lib/objective-value/objective-value-snapshot-request.ts (σύρμα · ο ΕΝΑΣ πίνακας αρνήσεων)
 *
 * Σώμα: `{ subject, draft, zone }` — **ποτέ** ποσό, συντελεστές, ημερομηνία ή προσόν: τα βγάζει ο server.
 * Απάντηση: `201 { snapshot, outcome: 'created' }` · `200 { snapshot, outcome: 'existing' }` (ίδιο περιεχόμενο ξανά —
 *   ιδεμποτές από κατασκευή, και πάνω από αυτό το σύνορο ιδεμποτίας του `withAuth`, CHECK 3.92).
 * Όριο: **sensitive** — κάθε κλήση διαβάζει βιτρίνα + ζώνες και γράφει μόνιμο, αμετάβλητο έγγραφο.
 *
 * ⛔ **Dark launch**: κλειστός διακόπτης `OBJECTIVE_VALUE_PROFESSIONAL_TIERS` ⇒ 404 (η διαδρομή «δεν υπάρχει»).
 * 🔑 Εκδότης = γραφείο με δημοσιευμένη βιτρίνα και προσόν μηχανικού (ADR-947 Δ9). Δικαίωμα οργανισμού:
 *   `reports:reports:create` — το στιγμιότυπο είναι αναφορά που εκδίδει το γραφείο.
 */

import type { NextRequest } from 'next/server';

import { isAppFeatureEnabled } from '@/config/feature-flags';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  objectiveValueSnapshotApiError,
  objectiveValueSnapshotBody,
} from '@/lib/objective-value/objective-value-snapshot-request';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { recordObjectiveValueSnapshot } from '@/services/objective-value/objective-value-snapshots.server';

async function recordSnapshotHandler(request: NextRequest, ctx: AuthContext) {
  if (!isAppFeatureEnabled('OBJECTIVE_VALUE_PROFESSIONAL_TIERS')) throw new ApiError(404, 'Not found', 'NOT_FOUND');
  const parsed = safeParseBody(objectiveValueSnapshotBody, await request.json());
  if (parsed.error) return parsed.error;
  const result = await recordObjectiveValueSnapshot(getAdminFirestore(), { companyId: ctx.companyId, uid: ctx.uid }, parsed.data, new Date());
  if (!result.ok) throw objectiveValueSnapshotApiError(result.refusal, result.missing);
  const payload = { snapshot: result.snapshot, outcome: result.outcome };
  return apiSuccess(payload, undefined, undefined, result.outcome === 'created' ? 201 : 200);
}

export const POST = withSensitiveRateLimit(withAuth(recordSnapshotHandler, { permissions: 'reports:reports:create' }));
