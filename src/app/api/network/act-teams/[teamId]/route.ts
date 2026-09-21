import 'server-only';

/**
 * @fileoverview **Η ΟΜΑΔΑ ΤΗΣ ΠΡΑΞΗΣ** — `GET` / `PATCH /api/network/act-teams/{teamId}` (ADR-867 Β5).
 * @related services/network-messaging/act-team-change.ts (ο κριτής) · act-team-writer.ts (`changeActTeam`)
 *
 * ⚠️ **ΕΞΩ από το `threads/**`, ΕΠΙΤΗΔΕΣ — ΟΜΑΔΑ ≠ ΝΗΜΑ** (η διάκριση του Β4): η ομάδα γεννιέται με
 * την **πράξη**, και υπάρχει **και χωρίς νήμα** (δρόμος μεσίτη, ιδιοκτήτης χωρίς λογαριασμό §8 #1).
 * Αν η διαδρομή ζούσε κάτω από το νήμα, το γραφείο **δεν θα μπορούσε** να ορίσει ποιος απαντά σε
 * πράξη που δεν έχει ακόμη συνομιλία.
 *
 * 🔑 **`withAuth`, ΟΧΙ η πόρτα του πολίτη**: η ομάδα είναι υπόθεση **γραφείου** — ο ιδιώτης δεν
 * έχει τι να αλλάξει εδώ, άρα το σύνορο μένει **fail-closed** γι' αυτόν (ADR-817 §3). Ο δρων
 * χτίζεται με τον **ίδιο** `networkActorOf`, ώστε το «πραγματικό μέλος» να κρίνεται **μία** φορά.
 *
 * 🔑 **Δύο κριτές, με σειρά** (ADR-801 §3): πρώτα **μέλος** του χώρου-οικοδεσπότη (ADR-787 —
 * `memberWorkspaceId`), μετά **ικανότητα** (`network:act_teams:manage`) — και όποιος δεν την έχει
 * μπορεί ακόμη να αλλάξει **συνεργάτες** αν είναι μέλος της ομάδας (Follow Up Boss). Το τελευταίο
 * το κρίνει ο καθαρός κριτής, μέσα στη συναλλαγή.
 * ⚠️ `If-Match` στο σώμα (`expectedVersion`): δύο διαχειριστές δεν σβήνει ο ένας τον άλλον.
 *
 * Ρυθμός: GET **STANDARD** · PATCH **SENSITIVE** — αλλάζει **ποιος διαβάζει** (ADR-855).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth, type AuthContext, type PermissionCache } from '@/lib/auth';
import type { ErrorResponse } from '@/lib/auth/api-denial';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { listActiveWorkspaceMembers } from '@/lib/auth/workspace-membership';
import { changeActTeam, readActTeamInWorkspace } from '@/services/network-messaging/act-team-writer';
import { canServeOnActTeam } from '@/services/network-messaging/act-team-eligibility';
import { readNetworkPeople } from '@/services/network-messaging/thread-people';
import type { NetworkActTeamChangeResult, NetworkActTeamResult } from '@/types/network-wire';

import {
  isActTeamManager,
  networkActorOf,
  networkRefusal,
  networkServerError,
  type NetworkActor,
} from '../../_shared/network-door';
import { ActTeamChangeBodySchema, readNetworkBody, requireRouteParam } from '../../_shared/network-params';

const logger = createModuleLogger('NetworkActTeamRoute');

type TeamRoute = { readonly params: Promise<{ teamId: string }> };
type TeamResponse = NetworkActTeamResult;
/**
 * ⚠️ Β7: η απάντηση **δεν** κουβαλά πια τις γραμμές ακροατηρίου — η οθόνη διαβάζει το ακροατήριο **ζωντανά**
 * (κανόνας Firestore), και ένα δεύτερο αντίγραφο στο σώμα ήταν φορτίο χωρίς καταναλωτή.
 */
type ChangeResponse = NetworkActTeamChangeResult;

/** Ο δρων, η ομάδα που ζητά, και ο χώρος όπου είναι **πραγματικό** μέλος. */
interface TeamInput {
  readonly actor: NetworkActor;
  readonly teamId: string;
  readonly workspaceId: string;
}

async function teamInput(
  ctx: AuthContext,
  routeContext: TeamRoute | undefined,
): Promise<({ readonly ok: true } & TeamInput) | { readonly ok: false; readonly response: NextResponse<ErrorResponse> }> {
  const actor = networkActorOf({ scope: 'organization', ctx });
  const teamId = await requireRouteParam(routeContext, 'teamId');
  if (!teamId.ok) return teamId;
  // 🔴 super_admin σε ξένο χώρο ⇒ «δεν υπάρχει» — δεν μπαίνει σε ομάδα ξένου γραφείου (Ζ2).
  if (actor.memberWorkspaceId === null) return { ok: false, response: networkRefusal('team-absent') };
  return { ok: true, actor, teamId: teamId.value, workspaceId: actor.memberWorkspaceId };
}

/** Το **ένα** προοίμιο των δύο πράξεων: ταυτότητα → ομάδα → χώρος, ή η έτοιμη άρνηση. */
function teamRoute<T>(
  handler: (request: NextRequest, input: TeamInput, cache: PermissionCache) => Promise<NextResponse<T | ErrorResponse>>,
) {
  return async (request: NextRequest, ctx: AuthContext, cache: PermissionCache, routeContext?: TeamRoute) => {
    const input = await teamInput(ctx, routeContext);
    return input.ok ? handler(request, input, cache) : input.response;
  };
}

async function getHandler(_request: NextRequest, { actor, teamId, workspaceId }: TeamInput, cache: PermissionCache) {

  try {
    const team = await readActTeamInWorkspace(getAdminFirestore(), teamId, workspaceId);
    if (team === null) return networkRefusal('team-absent');
    const { id, actKind, responsibleUid, memberUids, version } = team;
    // 👥 Β7 — από ποιους διαλέγει ο επιλογέας: τα ΕΝΕΡΓΑ μέλη του γραφείου (ο δρων είναι μέλος του — `teamInput`).
    const members = await listActiveWorkspaceMembers(getAdminFirestore(), workspaceId);
    // 🔑 ADR-867 Ε1β — υποψήφιοι = όσοι **μπορούν να αναλάβουν** (ο ΙΔΙΟΣ έλεγχος με τον κριτή του PATCH)·
    //    συν όσοι είναι **ήδη** στην ομάδα, ώστε το όνομά τους να φαίνεται πάντα (ποτέ «Μέλος του γραφείου»).
    const eligible = members.filter((member) => canServeOnActTeam(member.globalRole)).map((member) => member.uid);
    const shown = [...new Set([...eligible, responsibleUid, ...memberUids])];
    const [canManage, candidates] = await Promise.all([
      // 🔑 Η οθόνη δείχνει «άλλαξε υπεύθυνο» μόνο σε όποιον μπορεί — ο κριτής ξαναρωτιέται στο PATCH.
      isActTeamManager(actor, cache),
      readNetworkPeople(getAdminFirestore(), shown),
    ]);
    return NextResponse.json<TeamResponse>({
      success: true,
      team: { id, actKind, responsibleUid, memberUids, version },
      canManage,
      candidates,
    });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Η ανάγνωση ομάδας απέτυχε', error, { teamId });
  }
}

async function patchHandler(request: NextRequest, { actor, teamId, workspaceId }: TeamInput, cache: PermissionCache) {

  const body = await readNetworkBody(request, ActTeamChangeBodySchema);
  if (!body.ok) return body.response;

  try {
    const outcome = await changeActTeam(getAdminFirestore(), {
      teamId,
      change: body.value.change,
      actorUid: actor.uid,
      actorWorkspaceId: workspaceId,
      actorIsManager: await isActTeamManager(actor, cache),
      expectedVersion: body.value.expectedVersion,
      nowISO: nowISO(),
    });
    if (outcome.kind === 'refused') return networkRefusal(outcome.reason, { currentVersion: outcome.currentVersion });
    if (outcome.kind === 'unchanged') return NextResponse.json<ChangeResponse>({ success: true, applied: false });
    return NextResponse.json<ChangeResponse>({
      success: true,
      applied: true,
      team: outcome.team,
    });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Η αλλαγή ομάδας απέτυχε', error, { teamId });
  }
}

export const GET = withStandardRateLimit(withAuth<TeamResponse, TeamRoute>(teamRoute<TeamResponse>(getHandler)));
export const PATCH = withSensitiveRateLimit(withAuth<ChangeResponse, TeamRoute>(teamRoute<ChangeResponse>(patchHandler)));
