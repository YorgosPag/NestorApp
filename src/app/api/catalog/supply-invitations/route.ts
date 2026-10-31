/**
 * POST /api/catalog/supply-invitations — πρόσκληση πελάτη από επαφή (ADR-923 §5.12 Σ2 πόρτα α). Επαναποστολή = νέα έκδοση.
 * Το email στέλνεται **αφού** γραφτεί το έγγραφο και ποτέ δεν ρίχνει την πράξη: η έκβαση ταξιδεύει ονομασμένη.
 * Auth: `catalog:pricing:manage` · Rate: sensitive (στέλνει email) · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { issueSupplyInvitation } from '@/server/supply-relationships/supply-invitation-issue.server';
import { notifySupplyInvitation } from '@/server/supply-relationships/supply-invitation-notice.server';
import { issueSupplyInvitationBodySchema } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'SENSITIVE', authority: 'pricing' }, issueSupplyInvitationBodySchema, async (auth, body) => {
  const issued = await issueSupplyInvitation(auth, body);
  return { invitationId: issued.invitation.id, delivery: await notifySupplyInvitation(issued) };
});
