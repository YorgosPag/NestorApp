/**
 * PUT /api/catalog/product-models/[id]/variants — η **δέσμη** παραλλαγών (επικόλληση TSV, ADR-923 §5.10 Θωράκιση 5):
 * **μία** συναλλαγή, CAS **ανά** παραλλαγή, κρίση όλου του συνόλου (κανόνες, άξονες, κρατήσεις) μία φορά — ή όλες ή καμία.
 * Auth: `catalog:products:manage` · Rate: standard · ιδεμποτία μέσω `withAuth` (η επανάληψη δεν διπλασιάζει παραλλαγές).
 */

import 'server-only';

import { saveCatalogVariants } from '@/server/catalog/product-writer.server';
import { variantBatchBodySchema } from '@/subapps/catalog/schema/zod/product-requests.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, variantBatchBodySchema, (auth, id, body) => saveCatalogVariants(auth, id, body));
