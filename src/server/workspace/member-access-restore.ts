import 'server-only';

/**
 * @fileoverview **Η ΕΠΑΝΑΦΟΡΑ ΠΡΟΣΒΑΣΗΣ** — `suspended → active` που **κρατά** την προέλευση (ADR-892 Φ2β, §12).
 * @related lib/workspace/membership-access (ο γραφέας) · lib/workspace/member-exit-policy (`judgeAccessRestore`)
 * @related server/workspace/member-exit (η παύση — ο αντίστροφος δρόμος) · member-exit-claims (`adoptHomeWorkspace`)
 * @module server/workspace/member-access-restore
 *
 * 🔑 **Σειρά κατοπτρική της παύσης**: θέση → οικείος χώρος → ίχνος → ειδοποίηση.
 * 🔴 **Ο ΟΙΚΕΙΟΣ ΧΩΡΟΣ ΕΠΙΣΤΡΕΦΕΙ ΟΤΑΝ ΛΕΙΠΕΙ** (§12.4, διόρθωση 27/09): η παύση σε οικείο χώρο άφησε
 *    claim **χωρίς** γραφείο, και ταυτότητα χωρίς γραφείο παίρνει 401 **πριν** ο κριτής διαβάσει το βιβλίο.
 *    Η παλιά υπόθεση («ξένος χώρος ⇒ ο κριτής διαβάζει το βιβλίο ⇒ αρκεί το `active`») ήταν **ψευδής** για
 *    αυτόν τον άνθρωπο. Άνθρωπος με **άλλον** οικείο χώρο μένει εκεί (Atlassian: η επαναφορά δίνει πίσω
 *    ρόλους, δεν μετακινεί κανέναν). **Καμία** ανάκληση συνεδριών — προσθέτουμε πρόσβαση.
 * 🔑 **Ιδεμποτική**: ήδη ενεργός ⇒ `alreadyActive`, χωρίς γραφή, ίχνος ή ειδοποίηση — αλλά **με** επισκευή
 *    του οικείου χώρου (αν μια προηγούμενη προσπάθεια έγραψε τη θέση και απέτυχε στο claim, η επανάληψη
 *    ολοκληρώνει· κατοπτρικό του «ήδη σε παύση ⇒ μόνο επισκευή»).
 * ⛔ **Ποτέ** `grantWorkspaceMembership` — θα έγραφε νέα θητεία (`joinedAt`/`enrollment`/`addedBy`).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { isValidGlobalRole } from '@/lib/auth';
import { normalizeMembership } from '@/lib/auth/workspace-membership';
import { nowISO } from '@/lib/date-local';
import { recordAccessChangeAudit, restoreWorkspaceAccessInTx } from '@/lib/workspace/membership-access';
import { judgeAccessRestore, type AccessRestoreVerdict } from '@/lib/workspace/member-exit-policy';
import { workspaceMemberRef } from '@/lib/workspace/workspace-member-ref';
import { createModuleLogger } from '@/lib/telemetry';

import type { MemberExitActor } from './member-exit';
import { adoptHomeWorkspace, type HomeAfterRestore } from './member-exit-claims';
import { announceMemberExit } from './member-exit-notifier';

const logger = createModuleLogger('member-access-restore');

export interface AccessRestoreRequest {
  readonly companyId: string;
  readonly targetUid: string;
  readonly actor: MemberExitActor;
  readonly reason: string | null;
}

export type AccessRestoreRefusal = Exclude<AccessRestoreVerdict, { readonly kind: 'allowed' } | { readonly kind: 'not-paused' }>;

export type AccessRestoreOutcome =
  | { readonly kind: 'refused'; readonly verdict: AccessRestoreRefusal }
  | { readonly kind: 'restored'; readonly alreadyActive: boolean; readonly home: HomeAfterRestore };

type CommittedRestore =
  | { readonly kind: 'refused'; readonly verdict: AccessRestoreRefusal }
  | { readonly kind: 'committed'; readonly alreadyActive: boolean; readonly seatRole: string };

/** **Η πράξη.** Κρίση **μέσα** στη συναλλαγή — δύο διαχειριστές ταυτόχρονα ⇒ ο δεύτερος βρίσκει `active`. */
export async function executeAccessRestore(db: Firestore, request: AccessRestoreRequest): Promise<AccessRestoreOutcome> {
  const committed = await commitRestore(db, request);
  if (committed.kind === 'refused') return committed;

  // ⚠️ Σφάλμα εδώ **ρίχνει** ⇒ 503 ⇒ η επανάληψη βρίσκει `active` και ολοκληρώνει το claim.
  const home = await restoreHome(request, committed.seatRole);
  if (!committed.alreadyActive) await recordAndAnnounce(request);
  return { kind: 'restored', alreadyActive: committed.alreadyActive, home };
}

function commitRestore(db: Firestore, request: AccessRestoreRequest): Promise<CommittedRestore> {
  return db.runTransaction(async (tx): Promise<CommittedRestore> => {
    const snapshot = await tx.get(workspaceMemberRef(db, request.companyId, request.targetUid));
    const target = snapshot.exists ? normalizeMembership(request.targetUid, snapshot.data()) : null;
    const verdict = judgeAccessRestore({
      actorUid: request.actor.uid,
      actorRole: request.actor.role,
      targetUid: request.targetUid,
      target,
    });
    if (verdict.kind === 'not-paused') return { kind: 'committed', alreadyActive: true, seatRole: target?.globalRole ?? '' };
    if (verdict.kind !== 'allowed') return { kind: 'refused', verdict };

    restoreWorkspaceAccessInTx(tx, {
      uid: request.targetUid, companyId: request.companyId, actorUid: request.actor.uid, reason: request.reason,
    });
    return { kind: 'committed', alreadyActive: false, seatRole: target?.globalRole ?? '' };
  });
}

/** Ρόλος εκτός λεξιλογίου ⇒ **κανένα** claim (δεν εφευρίσκουμε ρόλο)· η θέση μένει ενεργή, με ίχνος στο log. */
async function restoreHome(request: AccessRestoreRequest, seatRole: string): Promise<HomeAfterRestore> {
  if (!isValidGlobalRole(seatRole)) {
    logger.warn('Θέση με ρόλο εκτός λεξιλογίου — ο οικείος χώρος δεν επανήλθε', {
      uid: request.targetUid, companyId: request.companyId, seatRole,
    });
    return { kind: 'untouched' };
  }
  return adoptHomeWorkspace(request.targetUid, request.companyId, seatRole);
}

async function recordAndAnnounce(request: AccessRestoreRequest): Promise<void> {
  await recordAccessChangeAudit({
    uid: request.targetUid, companyId: request.companyId, actorUid: request.actor.uid,
    actorName: request.actor.name, reason: request.reason, direction: 'restore',
  });
  await announceMemberExit({
    kind: 'restore', companyId: request.companyId, uid: request.targetUid, occurredAtISO: nowISO(),
  });
}
