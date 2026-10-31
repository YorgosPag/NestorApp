/**
 * POST /api/catalog/import-proposals/[id]/reject — απόρριψη ολόκληρης πρότασης· τίποτα δεν γράφεται (ADR-923 §5.5).
 * Auth: `catalog:products:manage` (τιμές: και `catalog:pricing:manage`) · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { rejectImportProposal } from '@/server/catalog/import-proposal-writer.server';
import { proposalActionBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, proposalActionBodySchema, (auth, id, body) =>
  rejectImportProposal(auth, id, body.expectedRevision),
);
