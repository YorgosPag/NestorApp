import 'server-only';

/**
 * @fileoverview **ΑΝΑΚΛΗΣΗ ΜΙΑΣ ΣΥΣΚΕΥΗΣ** — `DELETE /api/auth/active-sessions/{sessionId}?reason=user_requested|logout` (ADR-894).
 * @related `../route.ts` · `services/session/session-server.service.ts` (ο ΜΟΝΟΣ γραφέας)
 *
 * 🔑 Το id ψάχνεται **μόνο** κάτω από `users/{actor.ctx.uid}/sessions` ⇒ ξένη συνεδρία δεν εκφράζεται και
 * απαντά **ίδιο** `404` με ανύπαρκτη. Επικύρωση `sess_<uuid v4>` ⇒ κανένα `/` δεν φτιάχνει άλλη διαδρομή.
 * Ιδεμποτική εκ κατασκευής: δεύτερη ανάκληση = ίδια κατάσταση, ίδια απάντηση.
 *
 * Ρυθμός: **SENSITIVE** (ADR-855).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { reissueCallerSession, type SessionContinuation } from '@/server/auth/session-reissue';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { isEnterpriseIdOfPrefix } from '@/services/enterprise-id-parse';
import { SESSION_REVOCATION_REASONS, revokeSession } from '@/services/session/session-server.service';

type SessionRoute = { readonly params: Promise<{ sessionId: string }> };

const reasonSchema = z.enum(SESSION_REVOCATION_REASONS).default('user_requested');

async function handler(request: NextRequest, actor: ApiActor, route?: SessionRoute): Promise<NextResponse> {
  const sessionId = (await route?.params)?.sessionId ?? '';
  if (!isEnterpriseIdOfPrefix(sessionId, ENTERPRISE_ID_PREFIXES.SESSION)) {
    return NextResponse.json({ error: 'NOT_FOUND' } as const, { status: 404 });
  }
  const reason = reasonSchema.safeParse(request.nextUrl.searchParams.get('reason') ?? undefined);
  if (!reason.success) return NextResponse.json({ error: 'INVALID_REASON' } as const, { status: 400 });

  const outcome = await revokeSession(actor.ctx.uid, sessionId, reason.data, actor.ctx.authTimeSec);
  if (!outcome.found) return NextResponse.json({ error: 'NOT_FOUND' } as const, { status: 404 });
  // Σπάνιο: το όριο της λίστας κλιμάκωσε σε ανάκληση ΟΛΩΝ ⇒ και αυτή η συσκευή χρειάζεται νέο κλειδί.
  const session: SessionContinuation = outcome.everySignInEnded
    ? await reissueCallerSession(request, actor.ctx.uid, 'revoke-session-escalated')
    : { kind: 'unchanged' };
  return NextResponse.json({ revokedSessionId: sessionId, session });
}

export const DELETE = withSensitiveRateLimit<SessionRoute>(withPersonalOrOrgAuth<unknown, SessionRoute>(handler));
