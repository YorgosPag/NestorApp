/**
 * POST /api/catalog/derived/recompute — **μία σελίδα** της εργασίας επανυπολογισμού παραγώγων (πληρότητα, facets,
 * περιλήψεις) μετά από αλλαγή οικογένειας ή ρυθμίσεων (ADR-923 §5.10 Δ7). Ιδεμπότητη: γράφει μόνο ό,τι διαφέρει.
 * Ο καλών συνεχίζει με τον `nextCursor` ώσπου να γίνει `null`.
 * Auth: `catalog:products:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { recomputeCatalogDerived } from '@/server/catalog/completeness-recompute.server';
import { recomputeCatalogDerivedBodySchema } from '@/subapps/catalog/schema/zod/product-requests.schema';
import { catalogActionRoute } from '../../_shared/catalog-route';

export const POST = catalogActionRoute({ category: 'STANDARD', authority: 'products' }, recomputeCatalogDerivedBodySchema, (auth, body) => recomputeCatalogDerived(auth, body));
