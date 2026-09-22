import 'server-only';

/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΩΝ ΔΙΑΔΡΟΜΩΝ ΤΟΥ ΔΙΚΤΥΟΥ** — ο δρων, ο χώρος του, και η **μία** μετάφραση
 * «απάντηση γραφέα → HTTP».
 * @related ADR-867 Β5 · ADR-817 §5 (κλειστό σύνολο καταναλωτών) · ADR-787 §5.1 (μέλος) · ADR-801 (ικανότητα)
 * @module app/api/network/_shared/network-door
 *
 * 🔑 **ΓΙΑΤΙ `withPersonalOrOrgAuth` ΚΑΙ ΟΧΙ `withAuth`**: το νήμα έχει **δύο** πλευρές, και η μία
 * είναι συχνά **ιδιώτης χωρίς οργανισμό** (ο ιδιοκτήτης). Με `withAuth` θα έπαιρνε 401 σε κάθε
 * «στείλε» — η βλάβη που περιγράφει η κεφαλίδα του `personal-scope-middleware.ts`. Η πρόσβαση
 * στο νήμα **δεν** είναι εμβέλειας εταιρείας: την κρίνει η **γραμμή ακροατηρίου**, μέσα στη
 * συναλλαγή του γραφέα. Γι' αυτό στις διαδρομές νημάτων ο δρων είναι **μόνο** `uid`.
 *
 * ⚠️ **ΜΙΑ πόρτα, ΚΛΕΙΣΤΟ σύνολο καταναλωτών** (Κ4 του `personal-scope-consumers.test.ts`), όπως
 * η πόρτα αρχείων (ADR-866 §2.6.9): μια νέα διαδρομή δικτύου που δέχεται ιδιώτη **τη βλέπει
 * άνθρωπος**, δεν μπαίνει σιωπηλά.
 *
 * 🔴 **Ο super_admin ΣΕ ΞΕΝΟ ΧΩΡΟ ΔΕΝ ΕΙΝΑΙ ΜΕΛΟΣ ΤΟΥ** (`platform-bypass`). Αν λογιζόταν, θα
 * μπορούσε να **προσθέσει τον εαυτό του** σε ομάδα πράξης και να διαβάζει ιδιωτικά νήματα άλλου
 * γραφείου — ακριβώς ό,τι αρνείται η ζωντανή άγκυρα Ζ2 και το ADR-834 (γ)/(ε) ②.
 */

import { NextResponse, type NextRequest } from 'next/server';

import type { ErrorResponse } from '@/lib/auth/api-denial';
import { hasPermission, type PermissionCache } from '@/lib/auth/permissions';
import {
  withPersonalOrOrgAuth, type PersonalOrOrgAuthOptions,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import type { AuthContext } from '@/lib/auth/types';
import type { NetworkRefusalCode } from '@/types/network-thread';
import { belongsHere } from '@/types/workspace-membership';

/** Ο δρων όπως τον χρειάζονται οι γραφείς του δικτύου — **τίποτα** από το σώμα του αιτήματος. */
export interface NetworkActor {
  readonly uid: string;
  /**
   * Ο χώρος όπου ο δρων είναι **πραγματικό** μέλος (`home` · `member`) — `null` για ιδιώτη
   * **και** για super_admin που μπήκε σε ξένο χώρο με παράκαμψη.
   */
  readonly memberWorkspaceId: string | null;
  /** Το εταιρικό context, για τον **έναν** κριτή ικανότητας — `null` για ιδιώτη. */
  readonly organization: AuthContext | null;
}

export function networkActorOf(actor: ApiActor): NetworkActor {
  if (actor.scope === 'personal') {
    return { uid: actor.ctx.uid, memberWorkspaceId: null, organization: null };
  }
  const { ctx } = actor;
  return {
    uid: ctx.uid,
    // 🔑 **«Ανήκει εδώ»**, όχι «επιτρέπεται εδώ» — το SSoT στο `types/workspace-membership.ts`.
    memberWorkspaceId: belongsHere(ctx.membershipVerdict) ? ctx.companyId : null,
    organization: ctx,
  };
}

/** Handler διαδρομής δικτύου — παίρνει **έτοιμο** δρώντα. */
export type NetworkHandler<T, R> = (
  request: NextRequest,
  actor: NetworkActor,
  routeContext?: R,
) => Promise<NextResponse<T | ErrorResponse>>;

/**
 * **Η πόρτα** — ο **μόνος** καταναλωτής του `withPersonalOrOrgAuth` στο `app/api/network/**`.
 *
 * @example
 * export const POST = withStandardRateLimit(withNetworkDoor<SendResponse, ThreadRoute>(handler));
 */
export function withNetworkDoor<T = unknown, R = unknown>(handler: NetworkHandler<T, R>, options: PersonalOrOrgAuthOptions = {}) {
  return withPersonalOrOrgAuth<T, R>(
    (request, actor, routeContext) => handler(request, networkActorOf(actor), routeContext),
    options,
  );
}

/**
 * **Διαχειριστής χώρου για την ομάδα πράξης;** — ο **ένας** server PDP (`hasPermission`,
 * ADR-801), **μόνο** για πραγματικό μέλος. Ποτέ λίστα ρόλων εδώ (CHECK 3.68).
 */
export async function isActTeamManager(actor: NetworkActor, cache?: PermissionCache): Promise<boolean> {
  if (actor.organization === null || actor.memberWorkspaceId === null) return false;
  return hasPermission(actor.organization, 'network:act_teams:manage', {}, cache);
}

// =============================================================================
// Η ΜΙΑ ΜΕΤΑΦΡΑΣΗ «ΑΡΝΗΣΗ ΓΡΑΦΕΑ → HTTP»
// =============================================================================

/**
 * **Κάθε** λόγος άρνησης των γραφέων του δικτύου, με **έναν** κωδικό HTTP.
 *
 * 🔴 **`thread-absent` και `not-audience` ⇒ ΤΟ ΙΔΙΟ 404, ΕΠΙΤΗΔΕΣ** (ADR-742 · ADR-787 Ε-5 §4 #1):
 * αλλιώς η διαδρομή απαντά σε όποιον δεν διαβάζει *«υπάρχει αυτό το νήμα»* — όργανο απαρίθμησης
 * συνομιλιών άλλων. Ίδιο δόγμα με το `team-absent` (ξένη ή ανύπαρκτη ομάδα).
 *
 * ⚠️ Ο πελάτης παίρνει **κωδικό μηχανής** (`error`), ποτέ κείμενο (N.11): η οθόνη τον μεταφράζει.
 * Ένας πίνακας `Record` σημαίνει ότι νέος λόγος άρνησης **δεν μεταγλωττίζεται** χωρίς γραμμή εδώ.
 */
export const NETWORK_REFUSAL_STATUS = {
  'thread-absent': 404,
  'not-audience': 404,
  'team-absent': 404,
  'message-absent': 404,
  'thread-closed': 409,
  'already-retracted': 409,
  'stale-version': 409,
  'window-expired': 409,
  'not-sender': 403,
  'not-permitted': 403,
  'empty-text': 422,
  'too-long': 422,
  'target-not-in-workspace': 422,
  'target-cannot-serve': 422,
  'target-is-counterpart': 422,
  'responsible-not-removable': 422,
} as const satisfies Record<NetworkRefusalCode, 403 | 404 | 409 | 422>;

/** = το κοινό κλειστό σύνολο (`types/network-thread.ts`) — η οθόνη μεταφράζει **τα ίδια** ονόματα. */
export type NetworkRefusal = NetworkRefusalCode;

/** Το σώμα κάθε άρνησης — **ένα** σχήμα για όλες τις πόρτες. */
export interface NetworkRefusalBody {
  readonly success: false;
  readonly error: NetworkRefusal;
  readonly currentVersion?: number;
}

export function networkRefusal(
  reason: NetworkRefusal,
  extra: { readonly currentVersion?: number | null } = {},
): NextResponse<NetworkRefusalBody> {
  const body: NetworkRefusalBody =
    typeof extra.currentVersion === 'number'
      ? { success: false, error: reason, currentVersion: extra.currentVersion }
      : { success: false, error: reason };
  return NextResponse.json(body, { status: NETWORK_REFUSAL_STATUS[reason] });
}

/** Ο ελάχιστος καταγραφέας που χρειάζεται η {@link networkServerError}. */
interface NetworkRouteLogger {
  error(message: string, meta: Record<string, unknown>): void;
}

/**
 * **Απρόβλεπτο σφάλμα** — καταγράφεται **ολόκληρο** στο log, φεύγει προς τα έξω **μόνο** ως κωδικός.
 *
 * ⚠️ Ξεχωριστό από το `failWithLoggedError` (`lib/api/role-management-helpers.ts`) **επίτηδες**:
 * εκείνο επιστρέφει στον πελάτη το **κείμενο** του σφάλματος — αποδεκτό σε κονσόλα διαχειριστή,
 * **όχι** σε πόρτα που δέχεται ιδιώτες από άλλον χώρο (ένα μήνυμα Firestore μπορεί να περιέχει
 * μονοπάτι εγγράφου, δηλαδή id νήματος ή ομάδας).
 */
export function networkServerError(
  logger: NetworkRouteLogger,
  message: string,
  error: unknown,
  meta: Record<string, unknown>,
): NextResponse<ErrorResponse> {
  logger.error(message, { ...meta, error: error instanceof Error ? error.message : String(error) });
  return NextResponse.json({ error: 'internal-error' }, { status: 500 });
}

/** Κακό αίτημα (σχήμα σώματος / παράμετρος) — **πριν** φτάσει σε γραφέα. */
export function networkBadRequest(issues: Record<string, unknown>): NextResponse<ErrorResponse> {
  return NextResponse.json({ error: 'invalid-request', details: issues }, { status: 400 });
}
