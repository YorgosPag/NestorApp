/**
 * @fileoverview `POST /api/document-registry/issuance-assignments/messages` — **προεπισκόπηση** και **αποστολή** του μηνύματος
 *   ανάθεσης με σύνδεσμο χωρίς λογαριασμό (ADR-915 §28 Η-Β7).
 * @related server/issuance-invitations/issuance-invitation-send.ts (η πράξη) · ../route.ts (οι καταγραφές του γραφείου)
 *
 * POST { intent: 'preview' | 'send', audience, propertyId, documentKind, expectedStage, note, expectedOwnerContactId, informContactIds }
 *   - `preview` → `{ preview }` — **καμία** εγγραφή· ο ίδιος συνθέτης με την αποστολή (ό,τι βλέπεις είναι ό,τι φεύγει)
 *   - `send`    → `{ stage, delivery }` — ανάθεση + σύνδεσμος σε **μία** συναλλαγή, μετά το email· σύνορο ιδεμποτίας
 *     ADR-872 μέσα στο `withAuth` (ένα πάτημα ⇒ ένα μήνυμα, ακόμη κι αν ο πελάτης ξαναστείλει)
 *   - CAS: `expectedStage` · για την έγκριση και `expectedOwnerContactId` (ο υπεύθυνος που είδε ο άνθρωπος)
 *
 * ⛔ **Ποτέ αυτόματη αποστολή** (§18.5): η διαδρομή εκτελεί μόνο ό,τι πάτησε άνθρωπος.
 * Δικαίωμα: `properties:properties:update` — ίδιο με τις υπόλοιπες πράξεις της ανάθεσης (§27).
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { issuanceSendBody } from '@/lib/document-validity/issuance-request';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { previewIssuanceMessage, sendIssuanceMessage } from '@/server/issuance-invitations/issuance-invitation-send';

import { ISSUANCE_SEND_REFUSAL_STATUS } from './issuance-send-refusals';

const messageBody = issuanceSendBody.extend({ intent: z.enum(['preview', 'send']) });

async function messageHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(messageBody, await request.json());
  if (parsed.error) return parsed.error;
  const { intent, ...body } = parsed.data;
  const sender = { companyId: ctx.companyId, uid: ctx.uid, name: ctx.email };
  const db = getAdminFirestore();
  const result = intent === 'preview'
    ? await previewIssuanceMessage(db, sender, body, new Date())
    : await sendIssuanceMessage(db, sender, body, new Date());
  if (!result.ok) {
    const [status, code] = ISSUANCE_SEND_REFUSAL_STATUS[result.refusal];
    throw new ApiError(status, 'Issuance message refused', code);
  }
  // §29 — ο κωδικός πρόσβασης φεύγει **μόνο** εδώ, μία φορά, προς το γραφείο που θα τον πει τηλεφωνικά.
  return apiSuccess('preview' in result ? { preview: result.preview } : { stage: result.stage, delivery: result.delivery, accessCode: result.accessCode });
}

export const POST = withStandardRateLimit(withAuth(messageHandler, { permissions: 'properties:properties:update' }));
