import 'server-only';

/**
 * **PATCH …/users/[uid]/membership** — παύση / επαναφορά πρόσβασης (ADR-892 Φ2β, §12).
 *
 * 🔑 Ίδια εξουσία με την αφαίρεση (το σύνορο στο `route.ts`)· οι αναλλοίωτες στον κριτή.
 * ⚠️ Ίχνος: οι συνέπειες στο **`newValue`**, ΟΧΙ στο `metadata` (κλειστό σύνολο του `audit-core`, §11.4).
 *
 * @module api/admin/role-management/users/[uid]/membership/access-handler
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { logAuditEvent, type AuthContext } from '@/lib/auth';
import { parseJsonBody } from '@/lib/api/role-management-helpers';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { MEMBER_EXIT_REASON_MAX } from '@/lib/workspace/member-exit-policy';
import { executeAccessPause, type AccessPauseOutcome } from '@/server/workspace/member-exit';
import { executeAccessRestore, type AccessRestoreOutcome } from '@/server/workspace/member-access-restore';

import { actorOf, consequencesAuditValue, reasonOf, refusalResponse } from '@/server/workspace/membership-http';

const logger = createModuleLogger('RoleManagement:MemberAccess');

const Reason = z.string().trim().max(MEMBER_EXIT_REASON_MAX).optional();

/** Η μεταβίβαση ευθύνης είναι **επιλογή** του διαχειριστή (Google Workspace) — απούσα ⇒ όχι. */
const AccessSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pause'), reason: Reason, transferActTeams: z.boolean().optional() }),
  z.object({ action: z.literal('restore'), reason: Reason }),
]);

/** 503 ⇒ η επανάληψη είναι **ασφαλής**: και οι δύο δρόμοι είναι ιδεμποτικοί. */
function failed(ctx: AuthContext, targetUid: string, action: string, error: unknown): NextResponse {
  logger.error('Η αλλαγή πρόσβασης μέλους δεν ολοκληρώθηκε', {
    targetUid, companyId: ctx.companyId, action, error: getErrorMessage(error),
  });
  return NextResponse.json({ error: 'EXIT_FAILED' } as const, { status: 503 });
}

export async function accessHandler(request: NextRequest, ctx: AuthContext, targetUid: string): Promise<NextResponse> {
  const parsed = await parseJsonBody(request, AccessSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  const reason = reasonOf(body.reason);
  return body.action === 'pause'
    ? pause(ctx, targetUid, reason, body.transferActTeams === true)
    : restore(ctx, targetUid, reason);
}

async function pause(ctx: AuthContext, targetUid: string, reason: string | null, transferActTeams: boolean): Promise<NextResponse> {
  let outcome: AccessPauseOutcome;
  try {
    outcome = await executeAccessPause(
      getAdminFirestore(),
      { kind: 'pause', companyId: ctx.companyId, targetUid, actor: actorOf(ctx), reason },
      { transferActTeams },
    );
  } catch (error: unknown) {
    return failed(ctx, targetUid, 'pause', error);
  }
  if (outcome.kind === 'refused') return refusalResponse(outcome.verdict);

  if (!outcome.alreadyPaused) {
    await logAuditEvent(ctx, 'workspace_member_paused', targetUid, 'user', {
      previousValue: { type: 'membership', value: { status: 'active' } },
      newValue: consequencesAuditValue('suspended', outcome),
      metadata: reason === null ? {} : { reason },
    });
  }
  return NextResponse.json({ status: 'paused', outcome } as const);
}

async function restore(ctx: AuthContext, targetUid: string, reason: string | null): Promise<NextResponse> {
  let outcome: AccessRestoreOutcome;
  try {
    outcome = await executeAccessRestore(getAdminFirestore(), { companyId: ctx.companyId, targetUid, actor: actorOf(ctx), reason });
  } catch (error: unknown) {
    return failed(ctx, targetUid, 'restore', error);
  }
  if (outcome.kind === 'refused') return refusalResponse(outcome.verdict);

  if (!outcome.alreadyActive) {
    await logAuditEvent(ctx, 'workspace_member_restored', targetUid, 'user', {
      previousValue: { type: 'membership', value: { status: 'suspended' } },
      newValue: { type: 'membership', value: { status: 'active', home: outcome.home.kind } },
      metadata: reason === null ? {} : { reason },
    });
  }
  return NextResponse.json({ status: 'restored', outcome } as const);
}
