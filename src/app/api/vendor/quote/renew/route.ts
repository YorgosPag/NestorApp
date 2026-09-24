/**
 * POST /api/vendor/quote/renew — «στείλε μου νέο σύνδεσμο» (ADR-876 §5 Φ4).
 *
 * Public, `Authorization: Bearer <link>` — ο σύνδεσμος μπορεί να έχει ΛΗΞΕΙ (σκοπός `renew`).
 * Νέος σύνδεσμος φεύγει **μόνο** στο καταχωρημένο email της πρόσκλησης.
 *
 * 🔑 **ΟΥΔΕΤΕΡΗ ΑΠΑΝΤΗΣΗ, ΠΑΝΤΑ** (202 · ίδιο σώμα): ανακλημένο, άγνωστο, πλαστό, κλειστό RFQ,
 * εξαντλημένη ποσόστωση — όλα φαίνονται ίδια απ' έξω. Διαφορετική απάντηση θα έκανε το endpoint
 * μαντείο απαρίθμησης προσκλήσεων. Η έκβαση πάει μόνο στο log.
 *
 * Φρουροί: `withHeavyRateLimit` (ανά IP) · `withinRecipientQuota` (ανά παραλήπτη) · σύνορο
 * ιδεμποτίας με principal τον σύνδεσμο (`withVendorLinkDoor`).
 *
 * @module api/vendor/quote/renew
 * @enterprise ADR-876 §5
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { clientIpFingerprint, clientIpOf } from '@/lib/http/client-ip';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { withVendorLinkDoor } from '@/server/vendor-portal/vendor-link-door';
import { renewVendorLink } from '@/subapps/procurement/services/vendor-link-renew';

const logger = createModuleLogger('VENDOR_PORTAL_RENEW_API');

function neutral(): NextResponse {
  return NextResponse.json({ success: true, data: { requested: true } }, { status: 202 });
}

async function readLocale(request: NextRequest): Promise<'el' | 'en'> {
  const body: unknown = await request.json().catch(() => null);
  const locale = body && typeof body === 'object' ? (body as { locale?: unknown }).locale : null;
  return locale === 'en' ? 'en' : 'el';
}

const basePOST = withVendorLinkDoor(
  {
    purpose: 'renew',
    onRefusal: (reason) => {
      logger.info('Vendor link renew refused', { reason });
      return neutral();
    },
  },
  async (request, opened) => {
    const outcome = await renewVendorLink({
      invite: opened.invite,
      requesterIpHash: clientIpFingerprint(clientIpOf(request.headers)),
      locale: await readLocale(request),
    });
    logger.info('Vendor link renew', { inviteId: opened.invite.id, outcome });
    return neutral();
  },
);

export const POST = withHeavyRateLimit(basePOST);
