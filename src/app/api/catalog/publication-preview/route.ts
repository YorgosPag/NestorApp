/**
 * POST /api/catalog/publication-preview — μία σελίδα όπως θα τυπωθεί (ADR-923 §5.6). POST που **δεν** γράφει.
 * 🔒 Χωρίς τιμές: η δικαιοδοσία είναι `products`, άρα ούτε η προεπισκόπηση δείχνει ποτέ τιμή.
 * Rate: high (CPU, αλλά ο χρήστης το πατά ένα-ένα).
 */

import 'server-only';

import { renderPublicationEntryPreview } from '@/server/catalog/publishing/publication-preview.server';
import { publicationPreviewBodySchema } from '@/subapps/catalog/schema/zod/publication.schema';
import { catalogActionRoute } from '../_shared/catalog-route';

export const POST = catalogActionRoute({ category: 'HIGH', authority: 'products' }, publicationPreviewBodySchema, (auth, body) =>
  renderPublicationEntryPreview(auth, body),
);
