import 'server-only';

/**
 * **POST /api/workspace-invitations/[invitationId]/revoke** — ο χώρος ανακαλεί (ADR-853 Φ4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔒 ΓΙΑΤΙ ΤΟ «ΔΕΝ ΥΠΑΡΧΕΙ» ΚΑΙ ΤΟ «ΔΕΝ ΕΙΝΑΙ ΔΙΚΗ ΣΟΥ» ΑΠΑΝΤΟΥΝ **ΤΑΥΤΟΣΗΜΑ**
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `id` της πρόσκλησης είναι **καθολικά μοναδικό**, άρα ένας διαχειριστής θα μπορούσε να
 * ονομάσει πρόσκληση **ξένου** γραφείου. Η υπηρεσία περνά **και** το `companyId` και κρίνει
 * με τον ΕΝΑ κριτή ιδιοκτησίας (`isPayloadOwnedByCompany`, ADR-742) — και επιστρέφει
 * `absent`, **ποτέ** «υπάρχει αλλά δεν επιτρέπεσαι».
 *
 * ⇒ Εδώ αυτό γίνεται **404 χωρίς λεπτομέρεια**: αλλιώς η διαδρομή γίνεται **όργανο
 *   απαρίθμησης** (ADR-787 Ε-5 §4 #1) — ένας βρόχος σε `winv_*` θα μάθαινε ποια
 *   αναγνωριστικά υπάρχουν στην πλατφόρμα.
 *
 * 🔑 **Ο χώρος ΔΕΝ έρχεται από το σώμα** — έρχεται από το `ctx.companyId`, δηλαδή από
 * υπογεγραμμένο token. Δεν υπάρχει πεδίο να εμπιστευτούμε, άρα κανένα τέταρτο κανάλι χώρου
 * (CHECK 3.58).
 *
 * ⚠️ Το όριο ρυθμού είναι πραγματικά **20/min** μετά το ADR-855 Φ1 — δες την αδελφή πόρτα.
 *
 * @module api/workspace-invitations/[invitationId]/revoke
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §8 Φ4
 */

import { NextResponse, type NextRequest } from 'next/server';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { revokeWorkspaceInvitation } from '@/server/auth/workspace-invitation';
import { EntityAuditService } from '@/services/entity-audit.service';

const logger = createModuleLogger('WORKSPACE_INVITATION_REVOKE');

type RevokeResponse =
  | { readonly status: 'revoked' }
  /** Ήδη κλειστή — **καμία** γραφή. Η κατάσταση ταξιδεύει: η οθόνη λέει τι έγινε. */
  | { readonly error: 'ALREADY_RESOLVED'; readonly state: string }
  /** Ανύπαρκτη **ή ξένη** — αδιάκριτα, επίτηδες. */
  | { readonly error: 'INVITATION_NOT_FOUND' }
  | { readonly error: 'REVOKE_FAILED' };

type Segment = { params: Promise<{ invitationId: string }> };

async function handler(
  ctx: AuthContext,
  invitationId: string,
): Promise<NextResponse<RevokeResponse>> {
  let outcome: Awaited<ReturnType<typeof revokeWorkspaceInvitation>>;
  try {
    outcome = await revokeWorkspaceInvitation({
      invitationId,
      companyId: ctx.companyId,
      revokedByUid: ctx.uid,
    });
  } catch (error: unknown) {
    logger.error('Η ανάκληση απέτυχε', {
      invitationId,
      companyId: ctx.companyId,
      error: getErrorMessage(error),
    });
    return NextResponse.json({ error: 'REVOKE_FAILED' } as const, { status: 503 });
  }

  // ⚠️ Το ίχνος γράφεται **μόνο** όταν κάτι όντως άλλαξε, και **μη μπλοκάρον**: η ανάκληση
  //    έχει ήδη δεσμευτεί· μια αποτυχία καταγραφής δεν επιτρέπεται να την αναιρέσει (ίδια
  //    πειθαρχία με το `claims-handler.ts` και το `grant-membership.ts`).
  if (outcome.kind === 'revoked') {
    await EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.COMPANY,
      entityId: ctx.companyId,
      entityName: null,
      action: 'updated',
      changes: [{ field: 'invitation', oldValue: 'pending', newValue: 'revoked' }],
      performedBy: ctx.uid,
      performedByName: ctx.email ?? null,
      companyId: ctx.companyId,
    }).catch((error: unknown) => {
      logger.warn('Το ίχνος ανάκλησης απέτυχε (μη μπλοκάρον)', { error: getErrorMessage(error) });
    });
  }

  return respond(outcome);
}

/** **Έκβαση → HTTP**, κλειστό σύνολο, **χωρίς `default`** (δες την αδελφή πόρτα). */
export function respond(
  outcome: Awaited<ReturnType<typeof revokeWorkspaceInvitation>>,
): NextResponse<RevokeResponse> {
  switch (outcome.kind) {
    case 'revoked':
      return NextResponse.json({ status: 'revoked' } as const);

    case 'already':
      // 🔑 **409 και η κατάσταση μέσα**: ιδεμποτησία με πληροφορία. Η οθόνη δεν χρειάζεται
      //    δεύτερη κλήση για να μάθει αν ο άνθρωπος πρόλαβε να δεχτεί ή αν κάποιος
      //    συνάδελφος ανακάλεσε πρώτος.
      return NextResponse.json(
        { error: 'ALREADY_RESOLVED', state: outcome.state } as const,
        { status: 409 },
      );

    case 'absent':
      // 🔒 **404 ΧΩΡΙΣ ΛΕΠΤΟΜΕΡΕΙΑ** — δες την κεφαλίδα: ανύπαρκτη και ξένη είναι το ίδιο.
      return NextResponse.json({ error: 'INVITATION_NOT_FOUND' } as const, { status: 404 });
  }
}

export const POST = withSensitiveRateLimit<Segment>(
  withAuth<RevokeResponse, Segment>(
    async (
      _request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
      segment?: Segment,
    ) => {
      // ⚠️ Το `params` είναι **Promise** (Next 15+) και λύνεται **μετά** τον φρουρό: ένας
      //    ανώνυμος καλών δεν πρέπει να μαθαίνει τη διαφορά «κακό id» από «δεν επιτρέπεσαι»
      //    (ίδιο σκεπτικό με το `segmentIdRoute` του ADR-245).
      const { invitationId } = (await segment!.params);
      if (!invitationId || invitationId.trim().length === 0) {
        return NextResponse.json({ error: 'INVITATION_NOT_FOUND' } as const, { status: 404 });
      }
      return handler(ctx, invitationId);
    },
    { permissions: 'users:users:manage' },
  ),
);
