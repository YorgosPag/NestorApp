/**
 * GET /api/auth/workspace-access-request — **τι απέγινε το δικό μου αίτημα ένταξης;** (ADR-660 §6).
 *
 * Ο καλών είναι **ο ίδιος** ο αιτών (ID token). **Όχι** `withAuth`: ο αιτών **δεν έχει** claims —
 * αυτός ακριβώς είναι ο λόγος που περιμένει. Επιστρέφει **μόνο** τη δική του κατάσταση· κανένα
 * όνομα διαχειριστή, καμία ημερομηνία που δεν χρειάζεται η οθόνη.
 *
 * @module api/auth/workspace-access-request
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { getCompanyId } from '@/config/tenant';
import { verifiedBearerUid } from '@/lib/auth/token-credentials';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readOwnAccessState } from '@/server/auth/workspace-access-request';

async function handler(request: NextRequest): Promise<NextResponse> {
  const uid = await verifiedBearerUid(request);
  if (uid === null) return NextResponse.json({ error: 'UNAUTHENTICATED' } as const, { status: 401 });
  return NextResponse.json({ state: await readOwnAccessState(getCompanyId(), uid) } as const);
}

export const GET = withStandardRateLimit(handler);
