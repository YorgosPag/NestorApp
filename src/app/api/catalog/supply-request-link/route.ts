/**
 * POST /api/catalog/supply-request-link — ο ανακλητός σύνδεσμος/QR: δημοσίευση · ανανέωση · ανάκληση (ADR-923 §5.12 Σ2 πόρτα β).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { publishSupplyRequestLink, revokeSupplyRequestLink } from '@/server/supply-relationships/supply-request-link.server';
import { supplyRequestLinkBodySchema } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import { catalogActionRoute } from '../_shared/catalog-route';

export const POST = catalogActionRoute({ category: 'STANDARD', authority: 'pricing' }, supplyRequestLinkBodySchema, (auth, body) =>
  (body.action === 'publish' ? publishSupplyRequestLink(auth) : revokeSupplyRequestLink(auth)),
);
