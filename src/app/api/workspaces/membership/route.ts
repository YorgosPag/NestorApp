import 'server-only';

/**
 * **GET · POST /api/workspaces/membership** — «η ΔΙΚΗ μου θέση σε ΑΥΤΟ το γραφείο» (ADR-892 Φ3, §13).
 *
 * - `GET`  → **προεπισκόπηση** της αποχώρησης: επιτρέπεται; ποιος παίρνει τις ομάδες πράξεων; αποσυνδέονται οι
 *            άλλες συσκευές; — **πριν** το πάτημα (§3.6). Μαζί το όνομα του γραφείου και του κληρονόμου: ο
 *            αποχωρών δεν έχει κατάλογο μελών για να τα βρει μόνος του.
 * - `POST` → **αποχώρηση**. Η θητεία κλείνει (`left`, δεν σβήνεται)· ο λογαριασμός, ο προσωπικός χώρος και τα
 *            άλλα γραφεία **μένουν** (GitHub «Leave» · Notion «Leave workspace»).
 *
 * 🔑 **Ο στόχος είναι ΠΑΝΤΑ ο καλών** (`ctx.uid`) και ο χώρος **ΠΑΝΤΑ** ο ζητούμενος, κριμένος στο σύνορο
 * (`ctx.companyId`, CHECK 3.58) — τίποτα από το σώμα. Γι' αυτό **κανένα** permission: η εξουσία της αποχώρησης
 * είναι «είσαι ο ίδιος», και ό,τι άλλο (τελευταίος διαχειριστής · ζωντανή θητεία) είναι αναλλοίωτη δεδομένων
 * του κριτή (`judgeMemberExit`, ίδια κρίση με την προεπισκόπηση και **μέσα** στη συναλλαγή).
 * 🔑 **Καμία ειδοποίηση στους διαχειριστές** — πρακτική GitHub/Notion/Slack: η αποχώρηση γράφεται στο ίχνος
 * (`workspace_member_left`), και ο ίδιος λαμβάνει επιβεβαίωση (υποχρεωτικό event ασφαλείας).
 *
 * @module api/workspaces/membership
 * @see docs/centralized-systems/reference/adrs/ADR-892-workspace-member-removal.md §13
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { resolveUserDisplayName } from '@/services/entity-audit.service';
import { previewMemberExit, type EndingExitRequest } from '@/server/workspace/member-exit';
import { continueSessionAfterExit } from '@/server/workspace/member-exit-session';
import { actorOf, runEndingExit } from '@/server/workspace/membership-http';

const logger = createModuleLogger('Workspace:Departure');

/** Η αποχώρηση του καλούντος από τον ζητούμενο χώρο — **η μόνη** μορφή αιτήματος αυτής της διαδρομής. */
function departureOf(ctx: AuthContext): EndingExitRequest {
  return { kind: 'departure', companyId: ctx.companyId, targetUid: ctx.uid, actor: actorOf(ctx), reason: null };
}

async function previewHandler(_request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  try {
    const preview = await previewMemberExit(getAdminFirestore(), departureOf(ctx));
    const [workspaceName, heirName] = await Promise.all([
      readWorkspaceName(ctx.companyId),
      preview.heirUid === null ? Promise.resolve(null) : resolveUserDisplayName(preview.heirUid, null),
    ]);
    return NextResponse.json({ preview, workspaceName, heirName } as const);
  } catch (error: unknown) {
    logger.error('Η προεπισκόπηση αποχώρησης απέτυχε', { uid: ctx.uid, companyId: ctx.companyId, error: getErrorMessage(error) });
    return NextResponse.json({ error: 'EXIT_FAILED' } as const, { status: 503 });
  }
}

async function departureHandler(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  // Εκτέλεση · 503 · άρνηση · ίχνος `workspace_member_left` μία φορά — ο **ίδιος** δρόμος με την αφαίρεση.
  const result = await runEndingExit(ctx, departureOf(ctx));
  if (result.kind === 'response') return result.response;
  const session = await continueSessionAfterExit(request, ctx.uid, result.outcome.home);
  return NextResponse.json({ status: 'left', home: result.outcome.home, session } as const);
}

type Handler = (request: NextRequest, ctx: AuthContext) => Promise<NextResponse>;

/** **Ένα** σύνορο για τις δύο μεθόδους: ίδιο όριο ρυθμού, ίδια ταυτότητα — καμία απαίτηση ικανότητας. */
function selfMembershipEndpoint(handler: Handler) {
  return withSensitiveRateLimit(
    withAuth<unknown>(
      async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handler(request, ctx),
    ),
  );
}

export const GET = selfMembershipEndpoint(previewHandler);
export const POST = selfMembershipEndpoint(departureHandler);
