import 'server-only';

/**
 * **POST /api/shares/download** — λήψη αρχείου από σύνδεσμο κοινοποίησης (ADR-884 Φ0.12).
 *
 * Απαντά με **V4 υπογεγραμμένο URL 15′** — ποτέ με το μόνιμο `downloadUrl` του αρχείου.
 * Ο κωδικός **δεν** γίνεται δεκτός εδώ: σύνδεσμος με κωδικό χρειάζεται το κουπόνι που
 * εξέδωσε το `/api/shares/resolve` (cookie `HttpOnly`). Κάθε λήψη καταγράφεται σε
 * συναλλαγή, με το όριο λήψεων να **επιβάλλεται**.
 *
 * @module api/shares/download
 * @see src/server/sharing/share-download.ts
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { requestHasShareAccessGrant } from '@/server/sharing/share-access-grant';
import { issueShareDownload } from '@/server/sharing/share-download';
import { readShareRequestBody } from '@/server/sharing/share-request-body';
import type { ShareDownloadOutcome } from '@/services/sharing/share-resolve-contract';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

async function handler(request: NextRequest): Promise<NextResponse<ShareDownloadOutcome>> {
  const body = await readShareRequestBody(request);
  if (body === null) {
    return NextResponse.json({ status: 'refused', reason: 'not-found' }, { status: 404, headers: NO_STORE });
  }

  const outcome = await issueShareDownload({
    adminDb: getAdminFirestore(),
    token: body.token,
    hasGrant: (shareId) => requestHasShareAccessGrant(request, shareId),
  });
  return NextResponse.json(outcome, { status: 200, headers: NO_STORE });
}

export const POST = withSensitiveRateLimit(withAuth<ShareDownloadOutcome>(handler, { allowUnauthenticated: true }));
