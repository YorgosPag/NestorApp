/**
 * POST /api/catalog/suppliers/[id]/revoke — ανάκληση από τον αγοραστή (ADR-923 §5.12 Σ7).
 * 🔑 Ο ίδιος γραφέας με την πλευρά του προμηθευτή: η πλευρά δηλώνεται εδώ και ο γραφέας τη συγκρίνει με το `ctx.companyId`.
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { endSupplyRelationship } from '@/server/supply-relationships/supply-relationship-writer.server';
import { supplyRelationshipActBodySchema } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, supplyRelationshipActBodySchema, (auth, id, body) =>
  endSupplyRelationship(auth, id, { side: 'buyer', expectedRevision: body.expectedRevision }),
);
