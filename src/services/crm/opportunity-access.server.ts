/**
 * @fileoverview **Το ΕΝΑ σημείο επιβολής της εξουσίας κατόχου στον server** (ADR-930 §«Εξουσία κατόχου»).
 * @module services/crm/opportunity-access.server
 *
 * Φράχτης μισθωτή (`requireOpportunityInTenant` — ξένο/ανύπαρκτο ⇒ 404) **και μετά** ο κριτής πόρου
 * (`decideOpportunityAccess`). Κάθε route που αγγίζει μια ευκαιρία περνά από εδώ — το φυλά η CHECK 3.114:
 * το `requireOpportunityInTenant` έχει **έναν** καλούντα, αυτό το αρχείο.
 *
 * 🏆 **Πέρα από τους μεγάλους** (ADR-930 §2.4): η άρνηση δεν είναι γενικό «δεν επιτρέπεται» — το 403 λέει **ποιος**
 *    μπορεί (`ownerUid`), ώστε η οθόνη να γράψει «την κινεί ο/η …». Το όνομα το βρίσκει ο πελάτης (ένας επιλυτής
 *    ονομάτων, `useUserDisplayNames`)· ο server δεν διαβάζει προφίλ τρίτων για να συνθέσει μήνυμα.
 */

import 'server-only';

import { ApiError } from '@/lib/api/api-error-types';
import type { AuthContext } from '@/lib/auth';
import { requireOpportunityInTenant, type TenantOpportunity } from '@/lib/auth/tenant-isolation';
import {
  decideOpportunityAccess,
  isOpportunityAccessGranted,
  type OpportunityAccessIntent,
} from './opportunity-access';

/** Ο κωδικός της άρνησης στο σύρμα — τον διαβάζει το `stage-move-api` του πελάτη. */
export const OPPORTUNITY_ACCESS_DENIED_CODE = 'OPPORTUNITY_NOT_OWNER';

export async function requireOpportunityAccess(params: {
  readonly ctx: AuthContext;
  readonly opportunityId: string;
  readonly path: string;
  readonly intent: OpportunityAccessIntent;
}): Promise<TenantOpportunity> {
  const { ctx, opportunityId, path, intent } = params;
  const opportunity = await requireOpportunityInTenant({ ctx, opportunityId, path });
  const decision = decideOpportunityAccess({ subject: ctx, opportunity, intent });
  if (!isOpportunityAccessGranted(decision.verdict)) {
    throw new ApiError(403, 'Only the opportunity owner or a manager can do this', OPPORTUNITY_ACCESS_DENIED_CODE, {
      reason: decision.verdict,
      ownerUid: decision.ownerUid,
    });
  }
  return opportunity;
}
