/**
 * PUT /api/catalog/imports/[id]/supplier — ο προμηθευτής (επαφή) μιας παρτίδας ιδιοτήτων (ADR-923 §5.5.2 Β5 Απόφαση 1): ορισμός ·
 * αλλαγή · αφαίρεση, **χωρίς** νέα ανάγνωση και **χωρίς** εφαρμογή μνήμης στις σελίδες που διαβάστηκαν (Απόφαση 4).
 * Auth: `catalog:products:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { setImportSupplier } from '@/server/catalog/import-supplier.server';
import { setImportSupplierBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, setImportSupplierBodySchema, (auth, id, body) =>
  setImportSupplier(auth, id, body),
);
