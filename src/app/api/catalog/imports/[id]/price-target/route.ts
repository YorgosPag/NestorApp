/**
 * PUT /api/catalog/imports/[id]/price-target — η πρόχειρη έκδοση τιμοκαταλόγου μιας παρτίδας ιδιοτήτων (ADR-923 §5.5.2 Β4 Δ1):
 * ορισμός · αλλαγή · αφαίρεση, **χωρίς** νέα ανάγνωση· οι εκκρεμείς προτάσεις τιμών ξανασχεδιάζονται.
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { setImportPriceTarget } from '@/server/catalog/import-price-target.server';
import { setImportPriceTargetBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, setImportPriceTargetBodySchema, (auth, id, body) =>
  setImportPriceTarget(auth, id, body),
);
