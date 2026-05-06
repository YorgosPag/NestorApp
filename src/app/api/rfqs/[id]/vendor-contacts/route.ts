/**
 * GET /api/rfqs/[id]/vendor-contacts — List companyId-scoped contacts with supplierPersona
 *
 * Returns minimal vendor contact snapshots for the invite picker.
 * RFQ id is unused — exists for route consistency; tenant isolation via ctx.companyId.
 *
 * Auth: withAuth | Rate: standard
 * @see ADR-327 §7 — Phase P3.b Admin Invite UI
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { getErrorMessage } from '@/lib/error-utils';
import { compareByLocale } from '@/lib/intl-utils';
import { getContactEmail } from '@/services/contacts/contact-name-resolver-types';
import { pickContactDisplayName } from '@/subapps/procurement/services/vendor-name-resolver';

interface VendorContactOption {
  id: string;
  displayName: string;
  email: string | null;
}

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  void segmentData; // RFQ id intentionally unused
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const db = getAdminFirestore();
        if (!db) {
          return NextResponse.json({ success: false, error: 'DB unavailable' }, { status: 503 });
        }
        const snap = await db
          .collection(COLLECTIONS.CONTACTS)
          .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
          .get();

        const vendors: VendorContactOption[] = [];
        for (const doc of snap.docs) {
          const data = doc.data();
          const isSupplier =
            (Array.isArray(data.personaTypes) && (data.personaTypes as string[]).includes('supplier')) ||
            Boolean(data.supplierPersona);
          if (!isSupplier) continue;
          const resolvedName = pickContactDisplayName(data);
          if (!resolvedName) continue;
          vendors.push({
            id: doc.id,
            displayName: resolvedName,
            email: getContactEmail(data as Parameters<typeof getContactEmail>[0]),
          });
        }
        vendors.sort((a, b) => compareByLocale(a.displayName, b.displayName));
        return NextResponse.json({ success: true, data: vendors });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 400 },
        );
      }
    },
  );
  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
