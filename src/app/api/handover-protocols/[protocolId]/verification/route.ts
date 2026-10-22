/**
 * @fileoverview **Η ΔΗΜΟΣΙΑ ΠΟΡΤΑ ΕΠΑΛΗΘΕΥΣΗΣ ΠΡΩΤΟΚΟΛΛΟΥ ΠΑΡΑΔΟΣΗΣ** (ADR-916 Φ-Γ2 Σ6).
 * @related server/property-handover-verification/handover-protocol-verification.server.ts ·
 *          lib/property-handover/handover-protocol-verification.ts (κρίση + συμβόλαιο) ·
 *          app/(app)/handover-protocol/verify (η σελίδα)
 * @module app/api/handover-protocols/[protocolId]/verification/route
 *
 * 🔴 **ΧΩΡΙΣ `withAuth`, ΕΠΙΤΗΔΕΣ**: τη χτυπά ο τρίτος (συμβολαιογράφος · τράπεζα · επόμενος αγοραστής), που δεν έχει
 *    λογαριασμό. Η ταυτότητα του πρωτοκόλλου (uuid v4) τυπώνεται **μόνο** στο ίδιο το Πρωτόκολλο.
 * 🔑 **`GET`, ποτέ τα bytes**: ο browser στέλνει **μόνο** το sha256 του PDF (`?sha256=`). Το PDF κρατά ονοματεπώνυμο
 *    αγοραστή και λίστα αρχείων — δεν φεύγει από τη συσκευή (το EU DSS ζητά «μην ανεβάζετε ευαίσθητα»· εμείς δεν ζητάμε).
 *    Χωρίς `sha256` ⇒ ερώτηση από **χαρτί** (QR): μόνο όσα τυπώνει ήδη το χαρτί.
 * ⚠️ `withSensitiveRateLimit` (fail-closed): πόρτα χωρίς ταυτότητα. `no-store`: η απάντηση αλλάζει όταν εκδοθεί νεότερη
 *    αναθεώρηση — καμία κρυφή μνήμη δεν επιτρέπεται να πει «τρέχον» για χθες.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { isSha256Hex } from '@/lib/hash/sha256';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import type { HandoverProtocolVerificationResponse } from '@/lib/property-handover/handover-protocol-verification';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { createModuleLogger } from '@/lib/telemetry';
import { readHandoverProtocolRegistryAnswer } from '@/server/property-handover-verification/handover-protocol-verification.server';
import { enterpriseIdFromRequest } from '@/services/enterprise-id-parse';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';

const logger = createModuleLogger('HANDOVER_PROTOCOL_VERIFICATION');

const HEADERS = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } as const;

const reply = (body: HandoverProtocolVerificationResponse, status: number): NextResponse<HandoverProtocolVerificationResponse> =>
  NextResponse.json(body, { status, headers: HEADERS });

/** `?sha256=` απόν ⇒ `null` (χαρτί)· παρόν αλλά άκυρο ⇒ `undefined` (άρνηση — ποτέ σιωπηλή υποβάθμιση σε «χαρτί»). */
function requestedSha256(request: NextRequest): string | null | undefined {
  const raw = request.nextUrl.searchParams.get('sha256');
  if (raw === null) return null;
  return isSha256Hex(raw) ? raw : undefined;
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ protocolId: string }> },
): Promise<NextResponse<HandoverProtocolVerificationResponse>> {
  const { protocolId: raw } = await context.params;
  const protocolId = enterpriseIdFromRequest(decodeRouteParam(raw), ENTERPRISE_ID_PREFIXES.PROPERTY_HANDOVER_PROTOCOL);
  const sha256 = requestedSha256(request);
  if (protocolId === null || sha256 === undefined) return reply({ ok: false, reason: 'request-invalid' }, 400);

  try {
    return reply({ ok: true, registry: await readHandoverProtocolRegistryAnswer(getAdminFirestore(), protocolId, sha256) }, 200);
  } catch (error) {
    logger.error('Η ανάγνωση του μητρώου πρωτοκόλλων απέτυχε', { protocolId, error });
    return reply({ ok: false, reason: 'unavailable' }, 503);
  }
}

export const GET = withSensitiveRateLimit(handler);
