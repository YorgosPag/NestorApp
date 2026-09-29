import 'server-only';

/**
 * @fileoverview **ΟΙ ΣΥΣΚΕΥΕΣ ΜΟΥ** — `POST` «αυτός ο browser είναι ενεργός» · `DELETE ?keep=` «αποσύνδεσε όλους τους άλλους» (ADR-894).
 * @related `services/session/session-server.service.ts` (ο ΜΟΝΟΣ γραφέας) · `lib/geo/ip-geolocation.ts`
 *
 * 🔑 **Ό,τι ξέρει το αίτημα, δεν το δηλώνει ο πελάτης**: το `user-agent` και η IP διαβάζονται από τις
 * κεφαλίδες (`clientIpOf`), η τοποθεσία επιλύεται **τοπικά**. Το σώμα φέρει μόνο ό,τι ο server δεν
 * μπορεί να δει (οθόνη, γλώσσα) και το id που θυμάται ο browser. Η IP **δεν** αποθηκεύεται ποτέ.
 *
 * 🔑 `withPersonalOrOrgAuth` και όχι `withAuth`: συσκευές έχει **κάθε** συνδεδεμένος άνθρωπος, και ο
 * ιδιώτης χωρίς οργανισμό (δηλωμένο στο κλειστό σύνολο, `personal-scope-consumers.test.ts`).
 *
 * Ρυθμός: **SENSITIVE** (ADR-855 — ίδιο με τη γραμμή `/api/auth` του πίνακα). Ιδεμποτία: το σύνορο (ADR-872).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { clientIpOf } from '@/lib/http/client-ip';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { reissueCallerSession, type SessionContinuation } from '@/server/auth/session-reissue';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { isEnterpriseIdOfPrefix } from '@/services/enterprise-id-parse';
import { deviceInfoFromUserAgent } from '@/services/session/session-device-detection';
import { revokeOtherSessions, syncActiveSession } from '@/services/session/session-server.service';
import type { SyncActiveSessionResult } from '@/services/session/session.types';

const sessionIdSchema = z.string().refine((value) => isEnterpriseIdOfPrefix(value, ENTERPRISE_ID_PREFIXES.SESSION));

const syncBodySchema = z
  .object({
    sessionId: sessionIdSchema.nullable(),
    loginMethod: z.enum(['email', 'google', 'microsoft', 'apple', 'phone']),
    screenResolution: z.string().regex(/^\d{2,5}x\d{2,5}$/).optional(),
    // BCP 47 — τόσο όσο χρειάζεται για να μη γίνει το πεδίο ελεύθερο κείμενο.
    language: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8}){0,3}$/).optional(),
  })
  .strict();

async function syncHandler(
  request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse> {
  const parsed = await readJsonBody(request, syncBodySchema);
  if ('rejected' in parsed) return parsed.rejected;

  const { sessionId, loginMethod, screenResolution, language } = parsed.data;
  const result = await syncActiveSession({
    uid: actor.ctx.uid,
    sessionId,
    loginMethod,
    deviceInfo: deviceInfoFromUserAgent(request.headers.get('user-agent') ?? '', { screenResolution, language }),
    ip: clientIpOf(request.headers),
    authTimeSec: actor.ctx.authTimeSec,
  });
  return NextResponse.json<SyncActiveSessionResult>(result, { status: result.created ? 201 : 200 });
}

interface RevokeOthersResponse {
  revokedSessionIds: string[];
  /** ADR-894 §10 Β1 — ανακλήθηκαν ΟΛΕΣ οι συνδέσεις· αυτή η συσκευή συνεχίζει με το νέο κλειδί. */
  session: SessionContinuation;
}

async function revokeOthersHandler(
  request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse> {
  const keep = request.nextUrl.searchParams.get('keep');
  const keepParsed = keep === null ? { success: true as const, data: null } : sessionIdSchema.safeParse(keep);
  if (!keepParsed.success) return NextResponse.json({ error: 'INVALID_KEEP' } as const, { status: 400 });

  const revokedSessionIds = await revokeOtherSessions(actor.ctx.uid, keepParsed.data);
  const session = await reissueCallerSession(request, actor.ctx.uid, 'revoke-other-sessions');
  return NextResponse.json<RevokeOthersResponse>({ revokedSessionIds, session });
}

export const POST = withSensitiveRateLimit(withPersonalOrOrgAuth(syncHandler));
export const DELETE = withSensitiveRateLimit(withPersonalOrOrgAuth(revokeOthersHandler));
