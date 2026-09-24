/**
 * Ίχνος των πράξεων του γραφείου πάνω σε πρόσκληση προμηθευτή (ADR-876 §5 Σ9).
 *
 * 🔴 **Γιατί υπάρχει**: η ανάκληση και η επαναποστολή περνούσαν **χωρίς ίχνος** — μόνο
 * `logger.info`. Με «ένας σύνδεσμος = ένα διαπιστευτήριο», κάθε έκδοση/ανάκληση συνδέσμου είναι
 * πράξη πρόσβασης σε τρίτο, και το γραφείο πρέπει να μπορεί να απαντήσει «ποιος έδωσε σύνδεσμο,
 * πότε, από πού».
 *
 * ⚠️ **ΠΟΤΕ το token ή το hash** στο ίχνος — μόνο το ID του διαπιστευτηρίου και η προέλευσή του.
 *
 * @module subapps/procurement/services/vendor-invite-audit
 */

import 'server-only';

import { ENTITY_TYPES } from '@/config/domain-constants';
import type { AuthContext } from '@/lib/auth';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';

export function recordVendorInviteAudit(
  ctx: Pick<AuthContext, 'uid' | 'companyId'>,
  inviteId: string,
  action: AuditAction,
  changes: AuditFieldChange[],
): void {
  safeFireAndForget(
    EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.VENDOR_INVITE,
      entityId: inviteId,
      entityName: null,
      action,
      changes,
      performedBy: ctx.uid,
      performedByName: null,
      companyId: ctx.companyId,
    }),
    'vendor-invite-audit',
    { inviteId, action },
  );
}
