/**
 * @fileoverview Οι τρεις μεταλλάξεις μέλους έργου: ανάθεση / ενημέρωση / αφαίρεση — **ως HTTP**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΕΜΕΙΝΕ ΕΔΩ ΜΕΤΑ ΤΟ Β14 (ADR-862 Φ0)
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι το Β14 αυτό το αρχείο **ήταν** ο γραφέας μελών: ρωτούσε «υπάρχει;» και **μετά**
 * έγραφε, σε δύο κλήσεις — δύο ταυτόχρονα `assign` έγραφαν δύο έγγραφα για τον ίδιο άνθρωπο.
 * Και η γέννηση του έργου χρειαζόταν **δεύτερο** καλούντα.
 *
 * ⇒ Η εγγραφή μετακόμισε στον **ΕΝΑ** γραφέα (`lib/auth/project-member-write.ts`), μέσα σε
 * συναλλαγή. Εδώ μένει **μόνο η μετάφραση**: έκβαση γραφέα → κωδικός HTTP + ίχνος. Κανένα
 * `.set`/`.update`/`.delete` σε αυτό το αρχείο (CHECK 3.88 Κ1).
 *
 * ⚠️ Οι κωδικοί **δεν άλλαξαν**: `already-member` ⇒ 409 · `absent` ⇒ 404 · τίποτα ⇒ 400.
 */

import 'server-only';

import { NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';

import { logAuditEvent } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import {
  enrollProjectMembers,
  removeProjectMember,
  updateProjectMember,
  type ProjectMemberKey,
  type ProjectMemberMutationOutcome,
} from '@/lib/auth/project-member-write';
import type { PostBody } from './types';

const NOT_A_MEMBER_MESSAGE = 'User is not a member of this project';

export interface MutationContext {
  db: Firestore;
  ctx: AuthContext;
  validated: PostBody;
}

/** Ο τριπλός δείκτης — ο μισθωτής από το **token**, ποτέ από το σώμα. */
function memberKeyOf({ ctx, validated }: MutationContext): ProjectMemberKey {
  return { companyId: ctx.companyId, projectId: validated.projectId, uid: validated.uid };
}

/** Η κοινή άρνηση των `update`/`remove` — **ένα** σχήμα, για να μην αποκλίνουν (ADR-742 §7septies). */
function notAMember(): NextResponse {
  return NextResponse.json({ success: false, error: NOT_A_MEMBER_MESSAGE }, { status: 404 });
}

/** Το ίχνος «πριν» — ρόλος και σύνολα, όπως τα κατέγραφε ο προκάτοχος. */
function previousValueOf(
  projectId: string,
  outcome: Extract<ProjectMemberMutationOutcome, { outcome: 'mutated' }>,
) {
  return {
    type: 'project_member',
    value: {
      projectId,
      roleId: outcome.previous.roleId,
      permissionSetIds: outcome.previous.permissionSetIds,
    },
  };
}

/** `assign` — προσθήκη νέου μέλους· 409 αν είναι ήδη μέλος. */
export async function assignMember(mutation: MutationContext): Promise<NextResponse> {
  const { db, ctx, validated } = mutation;
  const { projectId, uid, roleId, permissionSetIds, reason } = validated;

  if (!roleId) {
    return NextResponse.json(
      { success: false, error: 'roleId is required for assign action' },
      { status: 400 },
    );
  }

  const [enrolled] = await enrollProjectMembers(db, [
    {
      ...memberKeyOf(mutation),
      roleId,
      permissionSetIds: permissionSetIds ?? [],
      ...(validated.taskTeamId === undefined ? {} : { taskTeamId: validated.taskTeamId }),
      ...(validated.cdeAudience === undefined ? {} : { cdeAudience: validated.cdeAudience }),
      enrollment: 'manual',
      addedBy: ctx.uid,
    },
  ]);

  if (enrolled.outcome === 'already-member') {
    return NextResponse.json(
      { success: false, error: 'User is already a member of this project' },
      { status: 409 },
    );
  }

  await logAuditEvent(ctx, 'member_added', uid, 'user', {
    newValue: {
      type: 'project_member',
      value: {
        projectId,
        roleId,
        permissionSetIds: permissionSetIds ?? [],
        memberId: enrolled.memberId,
        enrollment: 'manual',
      },
    },
    metadata: { reason },
  });

  return NextResponse.json({
    success: true,
    data: { action: 'assign', projectId, uid, memberId: enrolled.memberId },
  });
}

/** `update` — αλλαγή ρόλου ή/και συνόλων δικαιωμάτων υπάρχοντος μέλους. */
export async function updateMember(mutation: MutationContext): Promise<NextResponse> {
  const { db, ctx, validated } = mutation;
  const { projectId, uid, reason } = validated;
  // 🔑 Η **μετακίνηση ομάδας** είναι πράξη εξουσιοδότησης, άρα περνά από την ίδια πόρτα με
  //    τον ρόλο — και καταγράφεται στο **ίδιο** ίχνος, με `reason`.
  const changes = {
    roleId: validated.roleId,
    permissionSetIds: validated.permissionSetIds,
    taskTeamId: validated.taskTeamId,
    cdeAudience: validated.cdeAudience,
  };

  const outcome = await updateProjectMember(db, memberKeyOf(mutation), changes);
  if (outcome.outcome === 'nothing-to-change') {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }
  if (outcome.outcome === 'absent') return notAMember();

  await logAuditEvent(ctx, 'member_updated', uid, 'user', {
    previousValue: previousValueOf(projectId, outcome),
    // ⚠️ Μόνο τα **δηλωμένα** πεδία: το Firestore απορρίπτει `undefined` στο ίχνος.
    newValue: { type: 'project_member', value: { projectId, ...outcome.applied } },
    metadata: { reason },
  });

  return NextResponse.json({ success: true, data: { action: 'update', projectId, uid } });
}

/** `remove` — αφαίρεση του μέλους. */
export async function removeMember(mutation: MutationContext): Promise<NextResponse> {
  const { db, ctx, validated } = mutation;
  const { projectId, uid, reason } = validated;

  const outcome = await removeProjectMember(db, memberKeyOf(mutation));
  if (outcome.outcome !== 'mutated') return notAMember();

  await logAuditEvent(ctx, 'member_removed', uid, 'user', {
    previousValue: previousValueOf(projectId, outcome),
    metadata: { reason },
  });

  return NextResponse.json({ success: true, data: { action: 'remove', projectId, uid } });
}
