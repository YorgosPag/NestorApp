/**
 * PUT    /api/catalog/publication-recipes/[id] — αντικατάσταση (CAS).
 * DELETE /api/catalog/publication-recipes/[id]?expectedRevision=N — soft delete· οι εκδόσεις που έβγαλε μένουν.
 * Auth: `catalog:pricing:manage` · ADR-923 §5.6.
 */

import 'server-only';

import { deletePublicationRecipe, updatePublicationRecipe } from '@/server/catalog/publishing/publication-recipe-writer.server';
import { updatePublicationRecipeBodySchema } from '@/subapps/catalog/schema/zod/publication.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, updatePublicationRecipeBodySchema, (auth, id, body) =>
  updatePublicationRecipe(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD', authority: 'pricing' }, (auth, id, expectedRevision) => deletePublicationRecipe(auth, id, expectedRevision));
