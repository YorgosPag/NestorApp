/**
 * @fileoverview **POST /api/spatial-tours/{kind}/{subjectId}/view-session/public** — επίσκεψη **χωρίς** λογαριασμό:
 * δημοσιευμένη περιήγηση `public`, ή προσωπικός σύνδεσμος που άνοιξε ο browser (`link`).
 * @related ADR-884 Κ3β · Φ0.4 · Φ0.12 · `_shared/tour-view-route.ts`
 * @module app/api/spatial-tours/[kind]/[subjectId]/view-session/public/route
 *
 * 🔒 **Δεν ρωτά ποτέ ποιος είσαι** (`actor: null`): δεν ανοίγει καμία πράξη υπευθύνου ή εγκεκριμένου — εκείνες
 * ζουν μόνο στην αυθεντικοποιημένη πόρτα (ADR-817 §5: κλειστό σύνολο πορτών ταυτότητας).
 * Ιδεμποτία **φυσική**: καμία εγγραφή σε αυτή τη διαδρομή (οι βάσεις `public`/`link` δεν μετρούν εδώ).
 */

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

import type { TourSegment } from '../../../../_shared/tour-route';
import { respondTourViewSession, type TourViewSessionResponse } from '../../../../_shared/tour-view-route';

export const dynamic = 'force-dynamic';

function handler(request: NextRequest, _ctx: unknown, _cache: unknown, segment?: TourSegment) {
  return respondTourViewSession(request, segment, null);
}

export const POST = withStandardRateLimit<TourSegment>(
  withAuth<TourViewSessionResponse, TourSegment>(handler, {
    allowUnauthenticated: true,
    idempotency: { mode: 'natural', why: 'Καμία εγγραφή — οι βάσεις public/link δεν μετρούν σε αυτή τη διαδρομή' },
  }),
);
