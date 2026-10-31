/**
 * PUT · DELETE /api/catalog/import-profiles/[id] — αλλαγή/διαγραφή προφίλ, με CAS (ADR-923 §5.5).
 * Auth: `catalog:products:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { deleteImportProfile, updateImportProfile } from '@/server/catalog/import-profile-writer.server';
import { updateImportProfileBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, updateImportProfileBodySchema, (auth, id, body) =>
  updateImportProfile(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD', authority: 'products' }, deleteImportProfile);
