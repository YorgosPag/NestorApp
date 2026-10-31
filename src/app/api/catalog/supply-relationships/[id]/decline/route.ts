/**
 * POST /api/catalog/supply-relationships/[id]/decline — ο προμηθευτής απορρίπτει αίτημα (ADR-923 §5.12 Σ2).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { declineSupplyRequest } from '@/server/supply-relationships/supply-relationship-writer.server';
import { supplyRelationshipActBodySchema } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, supplyRelationshipActBodySchema, (auth, id, body) =>
  declineSupplyRequest(auth, id, body.expectedRevision),
);
