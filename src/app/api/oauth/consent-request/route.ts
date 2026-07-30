/**
 * Στοιχεία εκκρεμούς αιτήματος για την οθόνη συγκατάθεσης (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΕΠΙΣΤΡΕΦΕΙ ΚΑΙ ΤΙ ΟΧΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Επιστρέφει **μόνο** ό,τι πρέπει να δει ο άνθρωπος για να αποφασίσει: ποιος
 * ζητά, τι ζητά, πού επιστρέφει, και τις δύο προειδοποιήσεις που το πρότυπο
 * ζητά ρητά (άγνωστο domain, loopback redirect).
 *
 * ⚠️ **Ποτέ** το `code_challenge`, το `state` ή το `uid`. Δεν είναι κρυπτογραφικά
 * μυστικά με τη στενή έννοια, αλλά δεν έχουν καμία δουλειά στον browser: κάθε
 * πεδίο που φτάνει στο UI είναι πεδίο που κάποιος μπορεί να πειράξει και να
 * ξαναστείλει. Η απόφαση επιστρέφει **μόνο** το handle· τα υπόλοιπα μένουν
 * παγωμένα στον server (βλ. `authorize-request-store`).
 *
 * @module app/api/oauth/consent-request
 * @see ADR-738 §4
 */

import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { peekPendingRequest } from '@/lib/oauth/authorize-request-store';

async function handleGet(req: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse> => {
      const handle = request.nextUrl.searchParams.get('request');
      if (!handle) {
        return NextResponse.json({ success: false, reason: 'not_found' }, { status: 400 });
      }

      const pending = await peekPendingRequest(handle, ctx.uid);
      if (!pending.ok) {
        return NextResponse.json(
          { success: false, reason: pending.rejection },
          { status: 400 },
        );
      }

      const { request: found } = pending;
      return NextResponse.json({
        success: true,
        data: {
          clientName: found.clientName,
          clientId: found.clientId,
          clientUri: found.clientUri,
          redirectUri: found.redirectUri,
          scopes: found.scopes,
          isLoopbackRedirect: found.isLoopbackRedirect,
          isFamiliarClient: found.isFamiliarClient,
        },
      });
    },
  );

  return handler(req);
}

export const GET = withSensitiveRateLimit(handleGet);
