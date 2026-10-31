/**
 * POST /api/catalog/publications/[id]/legal-hold — τοποθέτηση ή άρση δικαστικής δέσμευσης στα PDF μιας έκδοσης (ADR-923 §5.6.1).
 * Auth: `legal:holds:manage`, το **ένα** δικαίωμα για κάθε δέσμευση της πλατφόρμας (ADR-864 §21) · Rate: sensitive, γιατί αλλάζει
 * τι μπορεί να διατεθεί ποτέ.
 */

import 'server-only';

import { placePublicationLegalHold, releasePublicationLegalHold } from '@/server/catalog/publishing/publication-retention.server';
import { publicationLegalHoldBodySchema } from '@/subapps/catalog/schema/zod/publication.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'SENSITIVE', authority: 'legalHolds' }, publicationLegalHoldBodySchema, (auth, id, body) =>
  (body.act === 'place' ? placePublicationLegalHold(auth, id, body.reason) : releasePublicationLegalHold(auth, id)),
);
