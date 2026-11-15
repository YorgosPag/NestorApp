/**
 * @fileoverview `POST /api/document-registry/issuance-assignments/delivery-reminder` — **«Υπενθύμιση»** παράδοσης στον
 *   επαγγελματία της αναληφθείσας ανάθεσης (ADR-915 §45 Φ3, μοτίβο DocuSign «Remind»).
 * @related server/issuance-invitations/issuance-delivery-reminder.ts (η πράξη) · ../space-invitation/route.ts (το ίδιο ιδίωμα)
 *
 * POST { propertyId, documentKind } → `{ delivery, at }`
 *   - σύνορο ιδεμποτίας ADR-872 μέσα στο `withAuth` (ένα πάτημα ⇒ ένα email, ακόμη κι αν ο πελάτης ξαναστείλει)
 *   - όχι δύο υπενθυμίσεις την ίδια ημέρα (αυτόματη ή χειροκίνητη) ⇒ `TOO_SOON`
 *   - μόνο σε **αναληφθείσα** και ανοιχτή ανάθεση — αλλιώς ονομασμένη άρνηση
 *
 * Δικαίωμα: `properties:properties:update` — ίδιο με τις υπόλοιπες πράξεις της ανάθεσης (§27).
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { sendManualDeliveryReminder } from '@/server/issuance-invitations/issuance-delivery-reminder';

import { DELIVERY_REMINDER_REFUSAL_STATUS } from './delivery-reminder-refusals';

const deliveryReminderBody = z.object({
  propertyId: z.string().trim().min(1).max(128),
  documentKind: z.enum(DOCUMENT_KINDS),
});

async function deliveryReminderHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(deliveryReminderBody, await request.json());
  if (parsed.error) return parsed.error;
  const result = await sendManualDeliveryReminder(getAdminFirestore(), { companyId: ctx.companyId, uid: ctx.uid }, parsed.data, new Date());
  if (!result.ok) {
    const [status, code] = DELIVERY_REMINDER_REFUSAL_STATUS[result.refusal];
    throw new ApiError(status, 'Delivery reminder refused', code);
  }
  return apiSuccess({ delivery: result.delivery, at: result.at });
}

export const POST = withStandardRateLimit(withAuth(deliveryReminderHandler, { permissions: 'properties:properties:update' }));
