/**
 * POST /api/catalog/publication-recipes — νέα συνταγή έκδοσης (ADR-923 §5.6).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createPublicationRecipe } from '@/server/catalog/publishing/publication-recipe-writer.server';
import { createPublicationRecipeBodySchema } from '@/subapps/catalog/schema/zod/publication.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'pricing' }, createPublicationRecipeBodySchema, (auth, body) =>
  createPublicationRecipe(auth, body.definition),
);
