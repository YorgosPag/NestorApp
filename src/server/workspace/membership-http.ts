import 'server-only';

/**
 * Τα κοινά **HTTP** κομμάτια κάθε διαδρομής θέσης μέλους (ADR-892): η διαχειριστική
 * `…/admin/role-management/users/[uid]/membership` (αφαίρεση · παύση · επαναφορά) **και** η διαδρομή του ίδιου
 * `…/workspaces/membership` (αποχώρηση, Φ3). Ζει εδώ και όχι δίπλα σε μία από τις δύο: ένα route αρχείο του
 * Next.js εξάγει **μόνο** μεθόδους HTTP, και δεύτερο αντίγραφο θα απέκλινε (CHECK 3.28).
 *
 * @module server/workspace/membership-http
 */

import { NextResponse } from 'next/server';

import { logAuditEvent, type AuditAction, type AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import {
  ENDING_BY_EXIT_KIND,
  type AccessRestoreVerdict,
  type EndingExitKind,
  type MemberExitVerdict,
} from '@/lib/workspace/member-exit-policy';
import {
  executeMemberExit,
  type EndingExitRequest,
  type MemberExitActor,
  type MemberExitOutcome,
} from '@/server/workspace/member-exit';
import { belongsHere } from '@/types/workspace-membership';

const logger = createModuleLogger('membership-http');

/** Ο δρων — από το υπογεγραμμένο context, ποτέ από το σώμα. */
export function actorOf(ctx: AuthContext): MemberExitActor {
  return { uid: ctx.uid, role: ctx.globalRole ?? null, name: ctx.email ?? null, isMember: belongsHere(ctx.membershipVerdict) };
}

/** Κάθε άρνηση των δύο κριτών (έξοδος · επαναφορά). */
export type MembershipRefusal =
  | Exclude<MemberExitVerdict, { readonly kind: 'allowed' }>
  | Exclude<AccessRestoreVerdict, { readonly kind: 'allowed' } | { readonly kind: 'not-paused' }>;

/** Ο προαιρετικός λόγος του σώματος → `null` όταν λείπει ή είναι κενός (ποτέ `''` στο ίχνος). */
export function reasonOf(raw: string | undefined): string | null {
  return raw === undefined || raw === '' ? null : raw;
}

/** Οι συνέπειες μιας εξόδου/παύσης όπως τις μετρά ο ενορχηστρωτής. */
interface ExitConsequencesView {
  readonly home: { readonly kind: string };
  readonly heirUid: string | null;
  readonly transferredActTeams: number;
  readonly orphanedActTeams: number;
}

/**
 * Το `newValue` του ίχνους — **ένα** σχήμα για αφαίρεση, αποχώρηση και παύση.
 * ⚠️ Οι συνέπειες ζουν στο `newValue`, ΟΧΙ στο `metadata`: εκείνο είναι κλειστό σύνολο
 * (`ipAddress`/`userAgent`/`path`/`reason`) και το `audit-core` πετά σιωπηλά κάθε άλλο πεδίο —
 * μετρημένο ζωντανά 2026-09-27 (ADR-892 §11.4).
 */
export function consequencesAuditValue(status: 'removed' | 'left' | 'suspended', outcome: ExitConsequencesView) {
  return {
    type: 'membership' as const,
    value: {
      status,
      home: outcome.home.kind,
      heirUid: outcome.heirUid,
      transferredActTeams: outcome.transferredActTeams,
      orphanedActTeams: outcome.orphanedActTeams,
    },
  };
}

/** Η ενέργεια ιστορικού ανά δρόμο λήξης — διακριτές, ώστε ο έλεγχος να ξεχωρίζει «τον έβγαλαν» από «έφυγε». */
const AUDIT_ACTION_BY_ENDING: Readonly<Record<EndingExitKind, AuditAction>> = {
  removal: 'workspace_member_removed',
  departure: 'workspace_member_left',
};

type EndedOutcome = Extract<MemberExitOutcome, { readonly kind: 'ended' }>;

/** Είτε έτοιμη απάντηση (αποτυχία · άρνηση), είτε η θητεία έκλεισε και ο καλών συνεχίζει με τις συνέπειες. */
export type EndingExitResult =
  | { readonly kind: 'response'; readonly response: NextResponse }
  | { readonly kind: 'ended'; readonly outcome: EndedOutcome };

/**
 * **Η λήξη θητείας μέσα από HTTP** — **ένας** δρόμος για την αφαίρεση (διαχειριστής) και την αποχώρηση (ο ίδιος):
 * εκτέλεση · 503 σε σφάλμα (η επανάληψη επισκευάζει — ιδεμποτικό) · άρνηση με όνομα · ίχνος **μία** φορά ανά θητεία.
 * Ήταν δύο αντίγραφα και τα έπιασε το CHECK 3.28 τη μέρα που γεννήθηκε το δεύτερο (ADR-892 §13).
 */
export async function runEndingExit(ctx: AuthContext, request: EndingExitRequest): Promise<EndingExitResult> {
  let outcome: MemberExitOutcome;
  try {
    outcome = await executeMemberExit(getAdminFirestore(), request);
  } catch (error: unknown) {
    // ⚠️ Η θητεία μπορεί να **έχει** κλείσει και να απέτυχε το claim: 503 ⇒ η επανάληψη επισκευάζει.
    logger.error('Η λήξη θητείας δεν ολοκληρώθηκε', {
      kind: request.kind, targetUid: request.targetUid, companyId: request.companyId, error: getErrorMessage(error),
    });
    return { kind: 'response', response: NextResponse.json({ error: 'EXIT_FAILED' } as const, { status: 503 }) };
  }
  if (outcome.kind === 'refused') return { kind: 'response', response: refusalResponse(outcome.verdict) };
  if (!outcome.alreadyEnded) {
    await logAuditEvent(ctx, AUDIT_ACTION_BY_ENDING[request.kind], request.targetUid, 'user', {
      newValue: consequencesAuditValue(ENDING_BY_EXIT_KIND[request.kind], outcome),
      metadata: request.reason === null ? {} : { reason: request.reason },
    });
  }
  return { kind: 'ended', outcome };
}

/** **Άρνηση → HTTP**, κλειστό σύνολο: `not-a-member` ⇒ 404, κάθε άλλη ⇒ 409 με **όνομα** (η οθόνη λέει γιατί). */
export function refusalResponse(verdict: MembershipRefusal): NextResponse {
  if (verdict.kind === 'not-a-member') {
    return NextResponse.json({ error: 'MEMBER_NOT_FOUND' } as const, { status: 404 });
  }
  return NextResponse.json({ error: 'EXIT_REFUSED', reason: verdict.kind } as const, { status: 409 });
}
