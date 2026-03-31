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
import { generatePurchaseOrderPdf } from '@/services/procurement/po-pdf-generator';
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
        const po = await getPO(poId);
        if (!po || po.companyId !== ctx.companyId) {
          return NextResponse.json(
            { success: false, error: 'PO not found' },
            { status: 404 }
          );
        }

        const pdfBytes = await generatePurchaseOrderPdf({
          po,
          companyInfo: {
            name: 'Pagonis Construction', // TODO: Load from company profile
            vatNumber: '',
            address: '',
            phone: '',
            email: '',
          },
          supplierInfo: {
            name: po.supplierId, // TODO: Resolve from contacts
          },
          language: lang,
        });

        const filename = `${po.poNumber}.pdf`;

        return new NextResponse(Buffer.from(pdfBytes), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
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
