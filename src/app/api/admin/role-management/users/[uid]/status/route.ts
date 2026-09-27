/**
 * =============================================================================
 * PATCH /api/admin/role-management/users/[uid]/status — Suspend/Reactivate User
 * =============================================================================
 *
 * Suspends or reactivates a user by:
 * 1. Firebase Auth: updateUser({ disabled }) — blocks/unblocks sign-in
 * ⚠️ ADR-892 Φ2β: ΔΕΝ γράφει πια το έγγραφο μέλους — η «Παύση πρόσβασης» του γραφείου είναι άλλη πράξη
 *
 * Security:
 * - super_admin only
 * - Self-protection: cannot suspend yourself
 * - Tenant isolation: target must exist in company members
 *
 * Auth: withAuth (super_admin)
 * Rate: withSensitiveRateLimit
 *
 * @module api/admin/role-management/users/[uid]/status
 * @enterprise ADR-244 Role Management Admin Console
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, logAuditEvent } from '@/lib/auth';
import { BYPASS_ROLES } from '@/lib/auth/roles';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import { extractUidFromPath } from '@/lib/api/route-helpers';
import {
  failWithLoggedError,
  parseJsonBody,
  prepareMemberMutation,
} from '@/lib/api/role-management-helpers';
import {
  resolveDepartureHeir,
  transferActTeamsOnDeparture,
} from '@/services/network-messaging/act-team-departure';
import { belongsHere } from '@/types/workspace-membership';

const logger = createModuleLogger('RoleManagement:UserStatus');

// =============================================================================
// VALIDATION
// =============================================================================

const StatusChangeSchema = z.object({
  action: z.enum(['suspend', 'reactivate']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

type StatusChangeInput = z.infer<typeof StatusChangeSchema>;

// =============================================================================
// HELPERS
// =============================================================================

// =============================================================================
// PATCH — Suspend / Reactivate User
// =============================================================================

export const PATCH = withSensitiveRateLimit(
  withAuth(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      const targetUid = extractUidFromPath(request, 'status');

      if (!targetUid) {
        return NextResponse.json(
          { success: false, error: 'Missing target uid in URL path' },
          { status: 400 }
        );
      }

      try {
        // Parse + validate (SSoT: lib/api/role-management-helpers).
        const parsed = await parseJsonBody(request, StatusChangeSchema);
        if (!parsed.ok) return parsed.response;
        const body = parsed.value;

        // Self-protection: cannot suspend yourself + tenant isolation, σε ΕΝΑ βήμα
        // (SSoT: lib/api/role-management-helpers).
        const prepared = await prepareMemberMutation(ctx, targetUid, 'Cannot change your own account status');
        if (!prepared.ok) return prepared.response;
        // Το `member` επιβεβαιώνει μόνο το tenant isolation (υπάρχει εδώ) — δεν γράφεται πια.
        const { auth } = prepared.value;

        const isSuspend = body.action === 'suspend';
        const newStatus = isSuspend ? 'suspended' : 'active';
        // 🔴 ADR-892 Φ2β (§12) — Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ ΕΙΝΑΙ ΤΟ `disabled`, ΟΧΙ ΤΟ ΕΓΓΡΑΦΟ ΜΕΛΟΥΣ.
        //    Μέχρι 2026-09-27 αυτή η πράξη έγραφε ΚΑΙ `workspace_members.status` — ίδια τιμή με την «Παύση
        //    πρόσβασης» του γραφείου: δύο πράξεις αδιάκριτες, και η «Ενεργοποίηση» εδώ θα ήρε σιωπηλά μια
        //    απόφαση του γραφείου. Atlassian: deactivate account ≠ suspend access — δύο καταστάσεις.
        const currentStatus = (await auth.getUser(targetUid)).disabled ? 'suspended' : 'active';

        // Prevent no-op
        if (currentStatus === newStatus) {
          return NextResponse.json(
            { success: false, error: `User is already ${newStatus}` },
            { status: 409 }
          );
        }

        // Firebase Auth: disable/enable sign-in — ο κριτής ανάκλησης κόβει ό,τι ήδη τρέχει (ADR-892 §9.2).
        await auth.updateUser(targetUid, { disabled: isSuspend });

        // 3. 🏆 ADR-867 §4.3 / ADR-834 §5 Β (ε) — **ΚΑΝΕΝΑ ΟΡΦΑΝΟ ΝΗΜΑ, ΠΟΤΕ.**
        //
        // 🔴 Η **αναστολή ΕΙΝΑΙ η αποχώρηση** σε αυτό το σύστημα: κανείς δεν σβήνει
        //    `workspace_members` (μετρημένο, ADR-867 §8 #5). Άρα εδώ — και **μόνο** εδώ —
        //    είναι η στιγμή που ένας υπεύθυνος πράξης παύει να μπορεί να απαντήσει.
        // 🔑 Η ευθύνη **παράγεται ξανά** (επόμενο μέλος, αλλιώς ο διαχειριστής που έκανε
        //    την πράξη) — Salesforce/HubSpot/Zendesk/Follow Up Boss απαιτούν χειροκίνητο
        //    βήμα και μέχρι τότε το νήμα είναι ορφανό.
        // ⚠️ **Δεν ρίχνει την αναστολή**: ο λογαριασμός είναι ήδη κλειδωμένος και αυτό
        //    είναι το επείγον. Αποτυχία εδώ αφήνει ομάδες με ανενεργό υπεύθυνο — ονομαστικά
        //    στο log, και το backfill τις ξαναβρίσκει.
        // 🔴 ADR-867 Β5: ο κληρονόμος **δεν** είναι πια «όποιος έκανε την αναστολή» — η διαδρομή
        //    απαιτεί `BYPASS_ROLES`, άρα σε ξένο γραφείο θα έβαζε τον super_admin να διαβάζει
        //    ιδιωτικά νήματα. Πρότυπο Microsoft 365: άνθρωπος του ΙΔΙΟΥ γραφείου, ή κανείς.
        let transferredTeams = 0;
        let orphanedTeams = 0;
        if (isSuspend) {
          try {
            const db = prepared.value.db;
            const fallbackUid = await resolveDepartureHeir(db, {
              companyId: ctx.companyId,
              departingUid: targetUid,
              actorUid: ctx.uid,
              actorIsMember: belongsHere(ctx.membershipVerdict),
            });
            const transfer = await transferActTeamsOnDeparture(db, {
              companyId: ctx.companyId,
              departingUid: targetUid,
              fallbackUid,
              performedBy: ctx.uid,
              nowISO: nowISO(),
            });
            transferredTeams = transfer.transferred;
            orphanedTeams = transfer.orphaned;
          } catch (error) {
            logger.error('[ACT-TEAM] Η μεταβίβαση ευθύνης απέτυχε — η αναστολή ΕΓΙΝΕ', {
              targetUid,
              companyId: ctx.companyId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Audit logging
        const auditAction = isSuspend ? 'user_suspended' : 'user_activated';
        await logAuditEvent(ctx, auditAction, targetUid, 'user', {
          previousValue: { type: 'status', value: currentStatus },
          newValue: { type: 'status', value: newStatus },
          // ⚠️ ADR-892 §12.5: το `audit-core` πετά σιωπηλά ό,τι δεν είναι στο κλειστό `AuditMetadata` — οι δύο
          //    μετρήσεις φτάνουν στον δρώντα μόνο από την απάντηση (γνωστό όριο, Φ4 όταν μετακομίσει η πράξη).
          metadata: { reason: body.reason, transferredActTeams: transferredTeams, orphanedActTeams: orphanedTeams },
        });

        logger.info('User status changed', {
          targetUid,
          action: body.action,
          newStatus,
          changedBy: ctx.uid,
          companyId: ctx.companyId,
        });

        return NextResponse.json({
          success: true,
          data: {
            uid: targetUid,
            action: body.action,
            previousStatus: currentStatus,
            newStatus,
            // 🔔 ADR-867 Β6 — ο δρων μαθαίνει **εδώ** τι έγινε με τις πράξεις του αποχωρούντος (και
            //    πόσες έμειναν **ορφανές**: γραφείο χωρίς κανέναν ενεργό διαχειριστή) — όχι μόνο στο ίχνος.
            ...(isSuspend ? { transferredActTeams: transferredTeams, orphanedActTeams: orphanedTeams } : {}),
          },
        });
      } catch (error) {
        return failWithLoggedError(logger, 'User status change failed', error, 'Failed to change user status', {
          targetUid,
          companyId: ctx.companyId,
        });
      }
    },
    { requiredGlobalRoles: BYPASS_ROLES }
  )
);
