/**
 * POST /api/catalog/import-proposals/[id]/apply — η ανθρώπινη έγκριση: γράφει μέσα από τους υπάρχοντες γραφείς (ADR-923 §5.5).
 * Auth: `catalog:products:manage` (τιμές: και `catalog:pricing:manage`) · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { applyImportProposal } from '@/server/catalog/import-apply.server';
import { proposalActionBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, proposalActionBodySchema, (auth, id, body) =>
  applyImportProposal(auth, id, body.expectedRevision),
);
