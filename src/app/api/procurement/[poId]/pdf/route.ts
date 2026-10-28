/**
 * GET /api/procurement/[poId]/pdf — Download PO as PDF
 *
 * Auth: withAuth | Rate: standard
 * @see ADR-267 Phase B — PDF Export
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getPO } from '@/services/procurement';
import { ownedPO, poResource } from '../../_shared/po-ownership';
import { generatePurchaseOrderPdf } from '@/services/procurement/po-pdf-generator';
import { resolvePODocumentParties } from '@/services/procurement/po-document-parties';
import { poPdfFilename } from '@/services/procurement/po-format';
import { attachmentDisposition } from '@/lib/http/content-disposition';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('PO_PDF_API');

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ poId: string }> }
) {
  const { poId } = await segmentData!.params;
  const lang = (request.nextUrl.searchParams.get('lang') ?? 'el') as 'el' | 'en';

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        // ADR-742 §7undecies — «δεν υπάρχει» και «δεν είναι δικό σου» ήταν ήδη
        // **μία** απάντηση εδώ· αυτό που έλειπε ήταν η ασφαλής σύγκριση: σκέτο
        // `!==` άφηνε PO με κενό `companyId` να ταιριάξει με χαλασμένο token (§4).
        const po = ownedPO({ po: await getPO(poId), caller: ctx, poId, action: 'pdf' });
        if (!po) {
          return NextResponse.json(
            { success: false, error: poResource.notFoundMessage },
            { status: 404 }
          );
        }

        // ADR-923 §5.11 «3γ» Α11 — τα μέρη του εγγράφου από ΕΝΑ SSoT (κοινό με το email).
        const parties = await resolvePODocumentParties(ctx, po);
        if (!parties.ok) {
          return NextResponse.json(
            { success: false, error: parties.reason },
            { status: 422 }
          );
        }

        const pdfBytes = await generatePurchaseOrderPdf({
          po,
          companyInfo: parties.companyInfo,
          supplierInfo: parties.supplierInfo,
          language: lang,
        });

        return new NextResponse(Buffer.from(pdfBytes), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': attachmentDisposition(poPdfFilename(po.poNumber)),
          },
        });
      } catch (err) {
        logger.error('PDF generation failed', { poId, error: getErrorMessage(err) });
        return NextResponse.json(
          { success: false, error: getErrorMessage(err) },
          { status: 500 }
        );
      }
    }
  );

  return withStandardRateLimit(handler)(request);
}

export { handleGet as GET };
