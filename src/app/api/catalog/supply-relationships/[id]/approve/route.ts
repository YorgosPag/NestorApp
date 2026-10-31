/**
 * POST /api/catalog/supply-relationships/[id]/approve — ο προμηθευτής εγκρίνει αίτημα, με επαφή και ομάδα (ADR-923 §5.12 Σ2).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { approveSupplyRequest } from '@/server/supply-relationships/supply-relationship-writer.server';
import { approveSupplyRequestBodySchema } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, approveSupplyRequestBodySchema, (auth, id, body) =>
  approveSupplyRequest(auth, id, body),
);
