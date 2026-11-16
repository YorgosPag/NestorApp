/**
 * @fileoverview `GET /api/document-registry/open-items` — οι ανοιχτές αναθέσεις έκδοσης του γραφείου ως εκκρεμότητες
 *   (ADR-915 §45 Φ4, Procore «My Open Items»): το ημερολόγιο και οι εργασίες του CRM τις δείχνουν **μόνο για ανάγνωση**.
 * @related services/document-registry/issuance-open-items.server.ts · ../route.ts (το ίδιο ιδίωμα: μόνο `ctx.companyId`)
 *
 * ⚠️ Καμία παράμετρος από το δίκτυο δεν αγγίζει την εμβέλεια. Χωρίς `policy`: όποιος βλέπει το μητρώο, βλέπει και αυτό
 *    (ίδια δεδομένα, άλλη προβολή).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type { IssuanceOpenItemsResponse } from '@/lib/document-validity/issuance-open-item';
import { readIssuanceOpenItems } from '@/services/document-registry/issuance-open-items.server';

async function openItemsHandler(_request: NextRequest, ctx: AuthContext): Promise<NextResponse<IssuanceOpenItemsResponse>> {
  return NextResponse.json(await readIssuanceOpenItems(getAdminFirestore(), ctx.companyId, new Date()));
}

export const GET = withStandardRateLimit(withAuth(openItemsHandler));
