/**
 * POST /api/auth/email-verification — **στείλε μου σύνδεσμο επιβεβαίωσης** (ADR-851 Φ2).
 *
 * Ο καλών είναι **ο ίδιος** ο λογαριασμός (ID token στο `Authorization`)· **δεν** απαιτούνται
 * claims — ο αυτο-εγγεγραμμένος σε αναμονή έγκρισης **δεν έχει**, και είναι ακριβώς αυτός που
 * χρειάζεται επιβεβαίωση. Γι' αυτό **όχι** `withAuth` (που θα απαντούσε 401 σε αυτόν).
 *
 * ⚠️ Εδώ **δεν** υπάρχει απαρίθμηση να προστατευτεί (ο άνθρωπος ρωτά για τον εαυτό του), άρα
 * περιμένουμε την αποστολή και λέμε την αλήθεια: `503` αν δεν έφυγε.
 *
 * @module api/auth/email-verification
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { verifiedBearerUid } from '@/lib/auth/token-credentials';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { sendEmailVerificationMail } from '@/server/auth/auth-action-mail';

const bodySchema = z.object({ language: z.string().max(16).optional() });

async function handler(request: NextRequest): Promise<NextResponse> {
  const uid = await verifiedBearerUid(request);
  if (uid === null) return NextResponse.json({ error: 'UNAUTHENTICATED' } as const, { status: 401 });

  const parsed = await readJsonBody(request, bodySchema);
  if ('rejected' in parsed) return parsed.rejected;

  const outcome = await sendEmailVerificationMail({ uid, requestedLanguage: parsed.data.language });
  if (outcome === 'failed') {
    return NextResponse.json({ error: 'NOT_SENT' } as const, { status: 503 });
  }
  if (outcome === 'throttled') {
    return NextResponse.json({ error: 'TOO_MANY_REQUESTS' } as const, { status: 429 });
  }
  return NextResponse.json({ outcome } as const, { status: 202 });
}

export const POST = withSensitiveRateLimit(handler);
