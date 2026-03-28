/**
 * GET /api/procurement/public/[token] — Public PO view (no auth)
 *
 * Validates share token, returns PO data without internal notes.
 * No auth wrapper — public endpoint.
 *
 * @see ADR-267 Phase B — Share Link (public access)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { validatePOShare } from '@/services/procurement/po-share-service';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('PO_PUBLIC_API');

export async function GET(
  _request: NextRequest,
  segmentData: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await segmentData.params;

  try {
    if (!token || token.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 400 }
      );
    }

    const result = await validatePOShare(token);

    if (!result.valid || !result.po) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Invalid or expired link' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.po,
    });
  } catch (err) {
    logger.error('Public PO fetch failed', { error: getErrorMessage(err) });
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
