/**
 * Συνδεδεμένοι πράκτορες — προβολή και ανάκληση (ADR-738 §6)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ένας authorization server που μπορεί να **δώσει** πρόσβαση αλλά όχι να την
 * **πάρει πίσω** είναι μισός. Η ανάκληση δεν είναι χαρακτηριστικό ευκολίας:
 * είναι το μοναδικό διαθέσιμο αντίμετρο όταν ένα μηχάνημα χαθεί, ένας πράκτορας
 * συμπεριφερθεί περίεργα, ή απλώς αλλάξει γνώμη ο χρήστης. Χωρίς αυτό, το μόνο
 * που απομένει είναι η αναμονή της λήξης — έως **30 ημέρες** για ένα refresh
 * token.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Η ΣΕΙΡΑ ΤΗΣ ΑΝΑΚΛΗΣΗΣ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * **Πρώτα η συγκατάθεση, μετά τα tokens.** Η συγκατάθεση κόβει κάθε
 * *μελλοντική* έκδοση (το authorize endpoint δεν θα την ξαναβρεί ενεργή)· τα
 * tokens κόβουν την *τρέχουσα* πρόσβαση. Με την αντίστροφη σειρά υπάρχει
 * παράθυρο όπου τα tokens έχουν πεθάνει αλλά η συγκατάθεση ζει ακόμη — και μια
 * ανανέωση που φτάνει εκείνη τη στιγμή γεννά καινούργια.
 *
 * ⚠️ Η ανάγνωση **δεν** περνά από τα Firestore rules: οι συλλογές OAuth είναι
 * deny-all για κάθε client SDK. Εδώ επιστρέφεται **προβολή** — όνομα, scopes,
 * ημερομηνία — χωρίς κανένα κρυπτογραφικό υλικό.
 *
 * @module app/api/oauth/consents
 */

import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { listActiveConsents, revokeConsent } from '@/lib/oauth/oauth-consent-store';
import { revokeTokensForConsent } from '@/lib/oauth/oauth-token-store';

async function handleGet(req: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (_request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const consents = await listActiveConsents(ctx.uid);

      return NextResponse.json({
        success: true,
        data: consents.map((consent) => ({
          consentId: consent.consentId,
          clientId: consent.clientId,
          clientName: consent.clientName,
          scopes: consent.scopes,
          createdAt: consent.createdAt,
        })),
      });
    },
  );

  return handler(req);
}

async function handleDelete(req: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const consentId = request.nextUrl.searchParams.get('consentId');
      if (!consentId) {
        return NextResponse.json({ success: false, error: 'consentId required' }, { status: 400 });
      }

      const revoked = await revokeConsent(consentId, ctx.uid);
      if (!revoked) {
        return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
      }

      const tokensRevoked = await revokeTokensForConsent(consentId);
      return NextResponse.json({ success: true, data: { tokensRevoked } });
    },
  );

  return handler(req);
}

export const GET = withSensitiveRateLimit(handleGet);
export const DELETE = withSensitiveRateLimit(handleDelete);
