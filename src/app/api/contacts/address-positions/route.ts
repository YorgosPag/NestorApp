/**
 * POST /api/contacts/address-positions — **λύνει** τις θέσεις των διευθύνσεων μιας **νέας**
 * επαφής, πριν γραφτεί (ADR-332 D27 Βήμα Β-ΙΙ).
 *
 * Δεν υπάρχει ακόμη έγγραφο, άρα ούτε αποθηκευμένες διευθύνσεις ούτε φύλακας ιδιοκτησίας:
 * το μόνο που γίνεται εδώ είναι γεωκωδικοποίηση **για λογαριασμό του καλούντος** — γι' αυτό
 * απαιτείται `crm:contacts:create` και ρυθμός. Ίδιος πυρήνας με τη διαδρομή της υπάρχουσας
 * επαφής· η μόνη διαφορά είναι `stored = []`.
 *
 * Πρακτική: Salesforce Geocode Data Integration Rules — θέση και στη **δημιουργία**.
 *
 * @module api/contacts/address-positions
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import {
  contactAddressPositionsRequestSchema,
  resolveContactAddressPositions,
} from '../_shared/contact-address-positions';

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const parsed = safeParseBody(contactAddressPositionsRequestSchema, await req.json());
      if (parsed.error) return parsed.error;
      return apiSuccess(await resolveContactAddressPositions([], parsed.data));
    },
    { permissions: 'crm:contacts:create' },
  );
  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
