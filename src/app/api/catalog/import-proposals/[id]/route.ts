/**
 * PUT /api/catalog/import-proposals/[id] — αποφάσεις και διορθώσεις ανθρώπου· η πρόταση ξανακρίνεται απέναντι στα ζωντανά (ADR-923 §5.5).
 * Auth: `catalog:products:manage` (τιμές: και `catalog:pricing:manage`) · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { updateImportProposal } from '@/server/catalog/import-proposal-writer.server';
import { updateImportProposalBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, updateImportProposalBodySchema, (auth, id, body) =>
  updateImportProposal(auth, id, body),
);
