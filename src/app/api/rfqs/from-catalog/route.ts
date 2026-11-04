/**
 * GET /api/rfqs/from-catalog?catalog=<προμηθευτής>.<μοντέλο>.<παραλλαγή> — η προσυμπλήρωση του πρόχειρου «Ζητήστε προσφορά»
 * (ADR-923 §5.13 Ε6ε, Τ6). Αδελφός του `POST /api/rfqs/from-boq`. Μόνο ανάγνωση, άρα `GET`.
 *
 * Η απόκριση (αναλυτής, αρνήσεις, `private, no-store`, 500 χωρίς εσωτερικό κείμενο) ζει στο `rfqCatalogDraftResponse`.
 *
 * Auth: withAuth | Rate: standard
 * @module app/api/rfqs/from-catalog/route
 */

import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';

import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withAuth } from '@/lib/auth/middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { RFQ_CATALOG_PARAM } from '@/lib/navigation/procurement-urls';

import { rfqCatalogDraftResponse } from '../_shared/rfq-catalog-draft-response';

const innerHandler = withAuth(
  (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
    rfqCatalogDraftResponse(ctx, req.nextUrl.searchParams.get(RFQ_CATALOG_PARAM)),
);

export const GET = withStandardRateLimit(innerHandler);
