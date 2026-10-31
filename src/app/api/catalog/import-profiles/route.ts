/**
 * GET /api/catalog/import-profiles — οι αποθηκευμένες αντιστοιχίσεις του χώρου (ADR-923 §5.5).
 * POST /api/catalog/import-profiles — νέο προφίλ.
 * Auth: `catalog:products:manage` · Rate: high (GET) · standard (POST) · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createImportProfile } from '@/server/catalog/import-profile-writer.server';
import { listImportProfiles } from '@/server/catalog/import-reads.server';
import { saveImportProfileBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogCreateRoute, catalogReadRoute } from '../_shared/catalog-route';

export const GET = catalogReadRoute({ category: 'HIGH', authority: 'products' }, (auth) => listImportProfiles(auth));

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'products' }, saveImportProfileBodySchema, (auth, body) =>
  createImportProfile(auth, body.definition),
);
