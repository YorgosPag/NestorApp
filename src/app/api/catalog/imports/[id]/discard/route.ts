/**
 * POST /api/catalog/imports/[id]/discard — εγκατάλειψη παρτίδας + απόσυρση των εκκρεμών προτάσεων της· ό,τι εφαρμόστηκε
 * μένει (ADR-923 §5.5.1 · ADR-934 Ε3). Auth: `catalog:products:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { discardImportBatch } from '@/server/catalog/import-proposal-writer.server';
import { proposalActionBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, proposalActionBodySchema, (auth, id, body) =>
  discardImportBatch(auth, id, body.expectedRevision),
);
