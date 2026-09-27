import 'server-only';

/**
 * **GET · POST · PATCH /api/admin/role-management/users/[uid]/membership** — έξοδος και πρόσβαση μέλους (ADR-892).
 *
 * - `GET`   → **προεπισκόπηση**: τι θα γίνει (κληρονόμος · πράξεις που μεταβιβάζονται · αποσύνδεση ή όχι)
 *             και αν επιτρέπεται — **πριν** το πάτημα (§3.6). `?intent=pause` ⇒ η κρίση της **παύσης**.
 * - `POST`  → **αφαίρεση από το γραφείο**. Η θητεία κλείνει (δεν σβήνεται)· ο λογαριασμός **μένει** —
 *             προσωπικός χώρος και άλλα γραφεία ανέγγιχτα (GitHub/Slack/Atlassian/Figma, §2).
 * - `PATCH` → **παύση** / **επαναφορά** πρόσβασης (Φ2β, §12): ο άνθρωπος **μένει μέλος** (Atlassian
 *             «Suspend access»). Η μεταβίβαση ευθύνης στην παύση είναι **επιλογή** (Google Workspace).
 *
 * 🔑 **Εξουσία**: `users:users:manage` — η **ίδια** με την πρόσκληση (όποιος βάζει, βγάζει · ADR-801,
 * CHECK 3.68). Οι αναλλοίωτες δεδομένων (εαυτός · ανώτερος · τελευταίος διαχειριστής) ζουν στο
 * `member-exit-policy` — **καμία** κρίση ρόλου εδώ.
 * 🔑 **Ο χώρος** έρχεται από το `ctx.companyId` (υπογεγραμμένο token), ποτέ από το σώμα (CHECK 3.58).
 * ⛔ **Δεν** καλεί `auth.updateUser({ disabled })` — αυτό είναι η «Αναστολή λογαριασμού» (§1.2), άλλη
 * πράξη, πλατφόρμας, που **δεν** αγγίζει πια το έγγραφο μέλους (§12).
 *
 * @module api/admin/role-management/users/[uid]/membership
 * @see docs/centralized-systems/reference/adrs/ADR-892-workspace-member-removal.md
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { parseJsonBody } from '@/lib/api/role-management-helpers';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  MEMBER_EXIT_REASON_MAX,
  MEMBER_MANAGEMENT_PERMISSION,
  type MemberExitKind,
} from '@/lib/workspace/member-exit-policy';
import { previewMemberExit, type MemberExitRequest } from '@/server/workspace/member-exit';

import { accessHandler } from './access-handler';
import { actorOf, reasonOf, runEndingExit } from '@/server/workspace/membership-http';

const logger = createModuleLogger('RoleManagement:MemberExit');

const RemovalSchema = z.object({ reason: z.string().trim().max(MEMBER_EXIT_REASON_MAX).optional() });

/** `?intent=` ⇒ ποια κρίση δείχνει η προεπισκόπηση — κλειστό σύνολο, άγνωστη τιμή ⇒ αφαίρεση. */
const PREVIEW_INTENTS: Readonly<Record<string, Exclude<MemberExitKind, 'departure'>>> = {
  removal: 'removal',
  pause: 'pause',
};

type Segment = { params: Promise<{ uid: string }> };

function requestFor<K extends MemberExitKind>(
  ctx: AuthContext,
  targetUid: string,
  reason: string | null,
  kind: K,
): MemberExitRequest & { readonly kind: K } {
  return { kind, companyId: ctx.companyId, targetUid, actor: actorOf(ctx), reason };
}

async function targetOf(segment: Segment | undefined): Promise<string | null> {
  const uid = segment === undefined ? '' : (await segment.params).uid;
  return uid.trim() === '' ? null : uid;
}

async function previewHandler(request: NextRequest, ctx: AuthContext, targetUid: string): Promise<NextResponse> {
  const kind = PREVIEW_INTENTS[request.nextUrl.searchParams.get('intent') ?? ''] ?? 'removal';
  try {
    const preview = await previewMemberExit(getAdminFirestore(), requestFor(ctx, targetUid, null, kind));
    return NextResponse.json({ preview } as const);
  } catch (error: unknown) {
    logger.error('Η προεπισκόπηση εξόδου απέτυχε', { targetUid, companyId: ctx.companyId, error: getErrorMessage(error) });
    return NextResponse.json({ error: 'EXIT_FAILED' } as const, { status: 503 });
  }
}

async function removalHandler(request: NextRequest, ctx: AuthContext, targetUid: string): Promise<NextResponse> {
  const parsed = await parseJsonBody(request, RemovalSchema);
  if (!parsed.ok) return parsed.response;
  const reason = reasonOf(parsed.value.reason);

  // Εκτέλεση · 503 · άρνηση · ίχνος μία φορά — ο **ίδιος** δρόμος με την αποχώρηση (`runEndingExit`).
  const result = await runEndingExit(ctx, requestFor(ctx, targetUid, reason, 'removal'));
  if (result.kind === 'response') return result.response;
  return NextResponse.json({ status: 'removed', outcome: result.outcome } as const);
}

type MembershipHandler = (request: NextRequest, ctx: AuthContext, targetUid: string) => Promise<NextResponse>;

/**
 * **Ένα** σύνορο για τις τρεις μεθόδους: ίδιο όριο ρυθμού, ίδια εξουσία (`users:users:manage`), ίδιος
 * χειρισμός άδειου `uid` — τρία αντίγραφα θα απέκλιναν στην πρώτη αλλαγή (CHECK 3.28).
 */
function membershipEndpoint(handler: MembershipHandler) {
  return withSensitiveRateLimit<Segment>(
    withAuth<unknown, Segment>(
      async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache, segment?: Segment) => {
        const targetUid = await targetOf(segment);
        if (targetUid === null) return NextResponse.json({ error: 'MEMBER_NOT_FOUND' } as const, { status: 404 });
        return handler(request, ctx, targetUid);
      },
      { permissions: MEMBER_MANAGEMENT_PERMISSION },
    ),
  );
}

export const GET = membershipEndpoint(previewHandler);
export const POST = membershipEndpoint(removalHandler);
export const PATCH = membershipEndpoint(accessHandler);
