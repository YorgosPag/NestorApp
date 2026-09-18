import 'server-only';

/**
 * @fileoverview **Η ΑΠΟΥΣΙΑ ΜΟΥ** — `GET` / `PUT` / `DELETE /api/network/away` (ADR-867 §4.4 · Β5).
 * @related services/network-messaging/network-away.ts · ADR-834 §5 Β (ε) 🏆
 *
 * 🔑 **Πάντα η ΔΙΚΗ μου**: ο άνθρωπος είναι `actor.uid` — δεν υπάρχει παράμετρος «για ποιον».
 * Κανείς δεν δηλώνει απουσία **άλλου** (αυτό θα ήταν ανάθεση — άλλη πράξη, με ίχνος: η ομάδα).
 * ⚠️ Πόρτα του πολίτη: ο ιδιοκτήτης μπορεί κι αυτός να λείπει — ο μεσίτης το βλέπει στο νήμα.
 * ⚠️ `DELETE` = «γύρισα»: η δήλωση **λήγει τώρα**, δεν σβήνεται (ιδεμποτές).
 *
 * Ρυθμός: **STANDARD** (ADR-855).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  endNetworkAway,
  readOwnAway,
  setNetworkAway,
  type NetworkAway,
} from '@/services/network-messaging/network-away';

import {
  networkBadRequest,
  networkServerError,
  withNetworkDoor,
  type NetworkActor,
} from '../_shared/network-door';
import { AwayBodySchema, readNetworkBody } from '../_shared/network-params';

const logger = createModuleLogger('NetworkAwayRoute');

type AwayView = Pick<NetworkAway, 'startsAt' | 'endsAt'>;
type AwayResponse = { readonly success: true; readonly away: AwayView | null };

const view = (away: NetworkAway | null): AwayView | null =>
  away === null ? null : { startsAt: away.startsAt, endsAt: away.endsAt };

async function getHandler(_request: NextRequest, actor: NetworkActor) {
  try {
    const away = await readOwnAway(getAdminFirestore(), actor.uid, nowISO());
    return NextResponse.json<AwayResponse>({ success: true, away: view(away) });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Η ανάγνωση απουσίας απέτυχε', error, { uid: actor.uid });
  }
}

async function putHandler(request: NextRequest, actor: NetworkActor) {
  const body = await readNetworkBody(request, AwayBodySchema);
  if (!body.ok) return body.response;

  const now = nowISO();
  try {
    const outcome = await setNetworkAway(getAdminFirestore(), {
      uid: actor.uid,
      startsAt: body.value.startsAt ?? now,
      endsAt: body.value.endsAt,
      nowISO: now,
    });
    // ⚠️ Άρνηση **σχήματος ημερομηνιών** ⇒ 400 με τον λόγο: δεν υπάρχει κατάσταση να «συγκρουστεί».
    if (outcome.kind === 'refused') return networkBadRequest({ away: outcome.reason });
    return NextResponse.json<AwayResponse>({ success: true, away: view(outcome.away) });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Η δήλωση απουσίας απέτυχε', error, { uid: actor.uid });
  }
}

async function deleteHandler(_request: NextRequest, actor: NetworkActor) {
  try {
    await endNetworkAway(getAdminFirestore(), actor.uid, nowISO());
    return NextResponse.json<AwayResponse>({ success: true, away: null });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Η λήξη απουσίας απέτυχε', error, { uid: actor.uid });
  }
}

export const GET = withStandardRateLimit(withNetworkDoor<AwayResponse>(getHandler));
export const PUT = withStandardRateLimit(withNetworkDoor<AwayResponse>(putHandler));
export const DELETE = withStandardRateLimit(withNetworkDoor<AwayResponse>(deleteHandler));
