/**
 * POST /api/catalog/price-list-versions/[id]/diff — η διαφορά από την τρέχουσα δημοσιευμένη, ο φράχτης της λίστας και
 * το αποτύπωμα (`diffDigest`) που θα επιβεβαιώσει ο άνθρωπος. Δεν γράφει τίποτα.
 * Auth: `catalog:pricing:manage` · Rate: standard.
 */

import 'server-only';

import { previewPublication } from '@/server/catalog/price-publication.server';
import { emptyBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, emptyBodySchema, (auth, id) =>
  previewPublication(auth, id),
);
