/**
 * @fileoverview **Η ΠΡΟΤΑΣΗ** — ο χρήστης δεν αλλάζει το κοινό, προτείνει (§14.3).
 * @related ADR-777 · SPEC-777A §14.3 · §14.4 · services/places/public-place-write.service
 * @module app/api/places/[placeId]/attest/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 «ΠΡΟΤΕΙΝΕΙ» ΔΕΝ ΣΗΜΑΙΝΕΙ ΟΥΡΑ ΕΓΚΡΙΣΗΣ — ΣΗΜΑΙΝΕΙ **ΚΑΝΟΝΑΣ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §14.3 λέει: *«Ο χρήστης **δεν αλλάζει** το κοινό — **προτείνει**. […] ανεβαίνει
 * στο Α **μόνο** αν επαληθευτεί από **ισχυρότερη** πηγή.»* Ήταν εύκολο —και λάθος— να
 * διαβαστεί ως «ουρά που εγκρίνει άνθρωπος». Η επαλήθευση **είναι ο κανόνας
 * κατάταξης**, και τρέχει **συγχρόνως**:
 *
 * - `drawn` πάνω σε `osm` ⇒ **δεν περνά** (2 < 3) — ο άνθρωπος δεν σβήνει τον χάρτη
 * - `survey` πάνω σε `osm` ⇒ **περνά** (4 > 3) — το τοπογραφικό είναι το Ευαγγέλιο
 * - `osm` πάνω σε `osm` ⇒ **ισοβαθμία, δεν περνά** — η σύγκρουση μένει **ορατή**
 *
 * 🔑 **Και γι' αυτό η απάντηση είναι πάντα 200 με `merged: []` όταν δεν άλλαξε τίποτα.**
 * Δεν είναι αποτυχία: ο άνθρωπος πρότεινε νόμιμα, και η υπάρχουσα γνώση ήταν
 * ισχυρότερη. Ένα 409 θα του έλεγε ότι έκανε λάθος.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { nowISO } from '@/lib/date-local';
import { placeClaimSchema } from '@/lib/places/place-claim';
import { attestPlace } from '@/services/places/public-place-write.service';
import { placeKindOf } from '@/services/places/public-place-read.service';

import {
  respondToMalformedBody,
  respondToResolution,
  type PlaceApiResponse,
} from '../../_shared/respond';

type RouteContext = { params: Promise<{ placeId: string }> };

/**
 * **Νέα γνώση για τόπο που ήδη ξέρουμε.**
 *
 * ⚠️ Το `placeId` της διαδρομής είναι **η γη**. Το κτίριο ταξιδεύει στο σώμα ως
 * `buildingId`, γιατί η **γη κρατά τη θέση** (Α1) και το κτίριο είναι προαιρετικό: μια
 * πρόταση για το περίγραμμα ενός **οικοπέδου** δεν έχει κτίριο να ονομάσει.
 */
async function handler(
  request: NextRequest,
  _ctx: AuthContext,
  routeContext?: RouteContext,
): Promise<NextResponse<PlaceApiResponse>> {
  const placeId = (await routeContext?.params)?.placeId ?? '';
  if (placeKindOf(placeId) !== 'land') {
    return respondToMalformedBody(['placeId']);
  }

  const body: unknown = await request.json().catch(() => null);
  const claim = placeClaimSchema.safeParse((body as { claim?: unknown } | null)?.claim);
  if (!claim.success) {
    return respondToMalformedBody(
      claim.error.issues.map((issue) => `claim.${issue.path.join('.')}`),
    );
  }

  const rawBuildingId = (body as { buildingId?: unknown } | null)?.buildingId;
  const buildingId = typeof rawBuildingId === 'string' ? rawBuildingId : null;
  if (buildingId !== null && placeKindOf(buildingId) !== 'building') {
    return respondToMalformedBody(['buildingId']);
  }

  return respondToResolution(
    await attestPlace(
      getAdminFirestore(),
      { landId: placeId, buildingId },
      claim.data,
      nowISO(),
    ),
  );
}

export const POST = withStandardRateLimit(
  withAuth<PlaceApiResponse, RouteContext>(handler),
);
