import 'server-only';

/**
 * @fileoverview **Η ΕΞΟΔΟΣ ΜΕΛΟΥΣ ΑΠΟ ΓΡΑΦΕΙΟ** — ο ενορχηστρωτής (ADR-892 §3.2). Αφαίρεση · αποχώρηση ·
 * **παύση πρόσβασης** (Φ2β, §12: ο ίδιος δρόμος, άλλος γραφέας — ο άνθρωπος μένει μέλος).
 * @related lib/workspace/member-exit-policy (η κρίση) · lib/workspace/end-membership (ο γραφέας λήξης)
 * @related lib/workspace/membership-access (ο γραφέας παύσης/επαναφοράς) · server/workspace/member-access-restore
 * @related server/workspace/member-exit-claims (οικείος χώρος + συνεδρίες) · act-team-departure (κληρονόμος)
 * @module server/workspace/member-exit
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΣΕΙΡΑ (ADR-867 Ε1 «το έγγραφο πριν από το claim», αντεστραμμένη)
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. **Προεπισκόπηση** — μόνο αναγνώσεις ({@link previewMemberExit}). Η **ίδια** κρίση με την πράξη.
 *   2. **Συναλλαγή** — ξαναδιαβάζει θέση + ενεργά μέλη και **ξανακρίνει** μέσα της: δύο διαχειριστές που
 *      αφαιρούν ταυτόχρονα ο ένας τον άλλον σειριοποιούνται, και ο δεύτερος παίρνει `last-manager`.
 *   3. **Μετά το commit** — οικείος χώρος (claim + ανάκληση συνεδριών) · μεταβίβαση πράξεων · ίχνος.
 *
 * ⚠️ **Ιδεμποτικό**: σε ήδη κλειστή θητεία (ή ήδη σε παύση) τα βήματα 3 ξανατρέχουν (επισκευή claim που
 * έμεινε πίσω) χωρίς δεύτερο ίχνος — «καλώντας δύο φορές = ίδιο αποτέλεσμα» (N.7.2 #3).
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { listActiveWorkspaceMembers, normalizeMembership } from '@/lib/auth/workspace-membership';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { endWorkspaceMembershipInTx, recordMembershipEndAudit } from '@/lib/workspace/end-membership';
import { pauseWorkspaceAccessInTx, recordAccessChangeAudit } from '@/lib/workspace/membership-access';
import {
  ENDING_BY_EXIT_KIND,
  judgeMemberExit,
  type EndingExitKind,
  type MemberExitKind,
  type MemberExitVerdict,
} from '@/lib/workspace/member-exit-policy';
import { workspaceMemberRef, workspaceMembersCollection } from '@/lib/workspace/workspace-member-ref';
import {
  countActTeamsHeldBy,
  resolveDepartureHeir,
  transferActTeamsOnDeparture,
} from '@/services/network-messaging/act-team-departure';
import { isTenureEnded, type WorkspaceMembership } from '@/types/workspace-membership';

import { releaseHomeWorkspace, type HomeAfterExit } from './member-exit-claims';
import { announceMemberExit } from './member-exit-notifier';

const logger = createModuleLogger('member-exit');

/** Ο δρων — ρητά, όχι ολόκληρο `AuthContext` (ίδιο ιδίωμα με τους γραφείς). */
export interface MemberExitActor {
  readonly uid: string;
  /** Ο ρόλος του **σε αυτόν τον χώρο** (`null` = απών). */
  readonly role: string | null;
  readonly name: string | null;
  /** Ανήκει εδώ (`home`/`member`) — ο κληρονόμος δεν είναι ποτέ ξένος (ADR-867 Β5). */
  readonly isMember: boolean;
}

export interface MemberExitRequest {
  readonly kind: MemberExitKind;
  readonly companyId: string;
  readonly targetUid: string;
  readonly actor: MemberExitActor;
  readonly reason: string | null;
}

/** Λήξη θητείας (αφαίρεση · αποχώρηση) — ο τύπος απαγορεύει να περάσει παύση από εδώ. */
export type EndingExitRequest = MemberExitRequest & { readonly kind: EndingExitKind };

/** Παύση πρόσβασης (Φ2β). */
export type AccessPauseRequest = MemberExitRequest & { readonly kind: 'pause' };

/** Τι **θα** γίνει — ο διαχειριστής το βλέπει **πριν** πατήσει (§3.6 · «ξεπερνάμε τους μεγάλους»). */
export interface MemberExitPreview {
  readonly verdict: MemberExitVerdict;
  readonly heirUid: string | null;
  readonly actTeams: number;
  /** Ήταν αυτό το γραφείο ο οικείος χώρος του; ⇒ θα αποσυνδεθεί από τις συσκευές του. */
  readonly isHomeWorkspace: boolean;
}

type Refusal = { readonly kind: 'refused'; readonly verdict: Exclude<MemberExitVerdict, { readonly kind: 'allowed' }> };

/** Οι συνέπειες μετά το commit — οικείος χώρος + κατοχή. */
interface ExitConsequences {
  readonly home: HomeAfterExit;
  readonly heirUid: string | null;
  readonly transferredActTeams: number;
  readonly orphanedActTeams: number;
}

export type MemberExitOutcome =
  | Refusal
  | ({ readonly kind: 'ended'; readonly alreadyEnded: boolean } & ExitConsequences);

export type AccessPauseOutcome =
  | Refusal
  | ({ readonly kind: 'paused'; readonly alreadyPaused: boolean } & ExitConsequences);

/** Η μεταβίβαση στην παύση είναι **απόφαση του διαχειριστή**, όχι αυτόματη (Google Workspace, §12). */
export interface AccessPauseOptions {
  readonly transferActTeams: boolean;
}

const NO_TRANSFER = { heirUid: null, transferredActTeams: 0, orphanedActTeams: 0 } as const;

/** **Προεπισκόπηση** — καμία γραφή. Ίδια για λήξη και παύση (ο `kind` αλλάζει μόνο την κρίση). */
export async function previewMemberExit(db: Firestore, request: MemberExitRequest): Promise<MemberExitPreview> {
  const [targetSnap, activeMembers] = await Promise.all([
    workspaceMemberRef(db, request.companyId, request.targetUid).get(),
    listActiveWorkspaceMembers(db, request.companyId),
  ]);
  const target = targetSnap.exists ? normalizeMembership(request.targetUid, targetSnap.data()) : null;
  const verdict = judgeMemberExit(queryFor(request, target, activeMembers));
  const [heirUid, actTeams, isHomeWorkspace] = await Promise.all([
    resolveHeir(db, request),
    countActTeamsHeldBy(db, request.companyId, request.targetUid),
    isHomeOf(request.targetUid, request.companyId),
  ]);
  return { verdict, heirUid, actTeams, isHomeWorkspace };
}

/** **Η πράξη** — λήξη θητείας. */
export async function executeMemberExit(db: Firestore, request: EndingExitRequest): Promise<MemberExitOutcome> {
  const committed = await commitSeatTransition(db, request, {
    isDone: (target) => isTenureEnded(target.status),
    write: (tx) => endWorkspaceMembershipInTx(tx, {
      uid: request.targetUid,
      companyId: request.companyId,
      ending: ENDING_BY_EXIT_KIND[request.kind],
      endedByUid: request.actor.uid,
      reason: request.reason,
    }),
  });
  if (committed.kind === 'refused') return committed;

  const home = await releaseHomeWorkspace(request.targetUid, request.companyId);
  const transfer = await transferOwnership(db, request);
  // Ίχνος + ειδοποίηση **μία** φορά ανά θητεία — η επισκευή (ήδη κλειστή) δεν τα ξαναγράφει.
  if (!committed.alreadyDone) await recordAndAnnounce(request);
  return { kind: 'ended', alreadyEnded: committed.alreadyDone, home, ...transfer };
}

/**
 * **Η παύση πρόσβασης** (Φ2β, §12). Ίδια σειρά με τη λήξη: κρίση μέσα στη συναλλαγή → οικείος χώρος
 * (`releaseHomeWorkspace` — αλλιώς το token λέει `home` και η παύση **δεν ισχύει**, §8.1) → ίχνος.
 * 🔑 Ιδεμποτική: ήδη σε παύση ⇒ ξανατρέχει **μόνο** η επισκευή του οικείου χώρου, χωρίς 2ο ίχνος.
 */
export async function executeAccessPause(
  db: Firestore,
  request: AccessPauseRequest,
  options: AccessPauseOptions,
): Promise<AccessPauseOutcome> {
  const committed = await commitSeatTransition(db, request, {
    isDone: (target) => target.status === 'suspended',
    write: (tx) => pauseWorkspaceAccessInTx(tx, {
      uid: request.targetUid, companyId: request.companyId, actorUid: request.actor.uid, reason: request.reason,
    }),
  });
  if (committed.kind === 'refused') return committed;

  const home = await releaseHomeWorkspace(request.targetUid, request.companyId);
  if (committed.alreadyDone) return { kind: 'paused', alreadyPaused: true, home, ...NO_TRANSFER };

  const transfer = options.transferActTeams ? await transferOwnership(db, request) : NO_TRANSFER;
  await recordAccessChangeAudit({
    uid: request.targetUid, companyId: request.companyId, actorUid: request.actor.uid,
    actorName: request.actor.name, reason: request.reason, direction: 'pause',
  });
  await announceMemberExit({ kind: 'pause', companyId: request.companyId, uid: request.targetUid, occurredAtISO: nowISO() });
  return { kind: 'paused', alreadyPaused: false, home, ...transfer };
}

async function recordAndAnnounce(request: EndingExitRequest): Promise<void> {
  await recordMembershipEndAudit({
    uid: request.targetUid,
    companyId: request.companyId,
    ending: ENDING_BY_EXIT_KIND[request.kind],
    endedByUid: request.actor.uid,
    endedByName: request.actor.name,
    reason: request.reason,
  });
  await announceMemberExit({
    kind: request.kind, companyId: request.companyId, uid: request.targetUid, occurredAtISO: nowISO(),
  });
}

type CommitResult = { readonly kind: 'committed'; readonly alreadyDone: boolean } | Refusal;

/** Η μετάβαση της θέσης: «έχει ήδη γίνει;» (ιδεμποτία) + ο **ένας** γραφέας του δρόμου. */
interface SeatTransition {
  readonly isDone: (target: WorkspaceMembership) => boolean;
  readonly write: (tx: Transaction) => void;
}

/**
 * Το βήμα 2 — ανάγνωση **και** κρίση μέσα στη συναλλαγή, γραφή μόνο αν επιτρέπεται. **Ένας** δρόμος για
 * λήξη και παύση: δύο διαχειριστές που δρουν ταυτόχρονα σειριοποιούνται και ο δεύτερος ξανακρίνεται.
 */
async function commitSeatTransition(
  db: Firestore,
  request: MemberExitRequest,
  transition: SeatTransition,
): Promise<CommitResult> {
  return db.runTransaction(async (tx) => {
    const targetRef = workspaceMemberRef(db, request.companyId, request.targetUid);
    const [targetSnap, activeSnap] = await Promise.all([
      tx.get(targetRef),
      tx.get(workspaceMembersCollection(db, request.companyId).where('status', '==', 'active')),
    ]);
    const target = targetSnap.exists ? normalizeMembership(request.targetUid, targetSnap.data()) : null;
    if (target !== null && transition.isDone(target)) return { kind: 'committed', alreadyDone: true } as const;

    const activeMembers = activeSnap.docs.map((doc) => normalizeMembership(doc.id, doc.data()));
    const verdict = judgeMemberExit(queryFor(request, target, activeMembers));
    if (verdict.kind !== 'allowed') return { kind: 'refused', verdict } as const;

    transition.write(tx);
    return { kind: 'committed', alreadyDone: false } as const;
  });
}

/**
 * Το βήμα 3β — η δουλειά **μένει στο γραφείο** (§3.4). Σήμερα: ομάδες πράξεων (ο υπάρχων μηχανισμός).
 * ⚠️ **Μη μπλοκάρον**: η θητεία έκλεισε και η πρόσβαση κόπηκε — αυτό είναι το επείγον. Αποτυχία αφήνει
 * ομάδες με ανενεργό υπεύθυνο, ονομαστικά στο log· η επανάληψη της πράξης τις ξαναβρίσκει.
 */
async function transferOwnership(
  db: Firestore,
  request: MemberExitRequest,
): Promise<{ readonly heirUid: string | null; readonly transferredActTeams: number; readonly orphanedActTeams: number }> {
  try {
    const heirUid = await resolveHeir(db, request);
    const transfer = await transferActTeamsOnDeparture(db, {
      companyId: request.companyId,
      departingUid: request.targetUid,
      fallbackUid: heirUid,
      performedBy: request.actor.uid,
      nowISO: nowISO(),
    });
    return { heirUid, transferredActTeams: transfer.transferred, orphanedActTeams: transfer.orphaned };
  } catch (error: unknown) {
    logger.error('[MEMBER-EXIT] Η μεταβίβαση κατοχής απέτυχε — η έξοδος ΕΓΙΝΕ', {
      companyId: request.companyId, targetUid: request.targetUid, error: getErrorMessage(error),
    });
    return { heirUid: null, transferredActTeams: 0, orphanedActTeams: 0 };
  }
}

function resolveHeir(db: Firestore, request: MemberExitRequest): Promise<string | null> {
  return resolveDepartureHeir(db, {
    companyId: request.companyId,
    departingUid: request.targetUid,
    actorUid: request.actor.uid,
    actorIsMember: request.actor.isMember,
  });
}

function queryFor(
  request: MemberExitRequest,
  target: WorkspaceMembership | null,
  activeMembers: readonly WorkspaceMembership[],
) {
  return {
    kind: request.kind,
    actorUid: request.actor.uid,
    actorRole: request.actor.role,
    targetUid: request.targetUid,
    target,
    activeMembers,
  };
}

async function isHomeOf(uid: string, companyId: string): Promise<boolean> {
  const claims = (await getAdminAuth().getUser(uid)).customClaims ?? {};
  return claims.companyId === companyId;
}
