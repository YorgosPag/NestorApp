/**
 * Η απόκριση του `GET /api/rfqs/from-catalog` (ADR-923 §5.13 Τ6), έξω από το `route.ts` ώστε να ελέγχεται χωρίς `withAuth`.
 *
 * 🔒 **`private, no-store` σε ΚΑΘΕ κλάδο**, και στις αρνήσεις: η απάντηση εξαρτάται από τον χώρο του καλούντα (σχέση, εαυτός),
 *    άρα κανένας ενδιάμεσος δεν την κρατά.
 * 🔒 Άρνηση της δημιουργίας ⇒ ο κωδικός της (`rfqCreateErrorResponse`). **Οτιδήποτε άλλο ⇒ 500 με γενικό μήνυμα**: το ωμό
 *    εσωτερικό κείμενο πάει μόνο στο log.
 *
 * @module app/api/rfqs/_shared/rfq-catalog-draft-response
 */

import 'server-only';

import { NextResponse } from 'next/server';

import type { AuthContext } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import { withPrivateNoStore } from '@/lib/http/cache-control';
import { parseQuoteDraftParam } from '@/lib/navigation/procurement-urls';
import { createModuleLogger } from '@/lib/telemetry';
import { draftRfqFromCatalog } from '@/subapps/procurement/services/rfq-catalog-draft';
import { RfqCreateRefusal } from '@/subapps/procurement/types/rfq-create-refusal';

import { rfqCreateErrorResponse } from './rfq-error-response';

const logger = createModuleLogger('RFQ_CATALOG_DRAFT_API');

export async function rfqCatalogDraftResponse(ctx: AuthContext, rawParam: string | null): Promise<NextResponse> {
  const address = parseQuoteDraftParam(rawParam);
  if (address === null) {
    return withPrivateNoStore(NextResponse.json({ success: false, error: 'Invalid catalog address' }, { status: 400 }));
  }
  try {
    return withPrivateNoStore(NextResponse.json({ success: true, data: await draftRfqFromCatalog(ctx, address) }));
  } catch (error) {
    if (error instanceof RfqCreateRefusal) return withPrivateNoStore(rfqCreateErrorResponse(error));
    logger.error('Catalog draft failed', { error: getErrorMessage(error) });
    return withPrivateNoStore(NextResponse.json({ success: false, error: 'Failed to load the catalog draft' }, { status: 500 }));
  }
}
