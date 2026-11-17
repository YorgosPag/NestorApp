/**
 * GET /api/contacts/[contactId]/professional-link — **ο λογαριασμός πίσω από την επαφή** (ADR-915 §40).
 *
 * Τι ανέλαβε ο άνθρωπος αυτής της επαφής με **δικό του** λογαριασμό, και τι δήλωσε ο ίδιος — **παραγόμενο** από τις
 * συμμετοχές (`origin.contactId`), καμία εγγραφή. Ρυθμός (ρητός, CHECK 3.78) → `crm:contacts:view` → φόρτωση + φύλακας
 * ιδιοκτησίας (`loadOwnedContact`: ξένη ≡ ανύπαρκτη, ίδιο 404) → ανάγνωση με τον μισθωτή **του token**.
 * «Δεν μπόρεσα να ρωτήσω» ⇒ 503, ποτέ «δεν είναι συνδεδεμένος».
 * ADR-915 §40.8: και **με ποιο όνομα** αποδέχτηκε — μόνο το όνομα. Η σύγκριση με την επαφή γίνεται στον πελάτη, πάνω
 * στη ζωντανή επαφή (§40.10), ώστε να μην παλιώνει όταν αλλάξει το όνομα της επαφής.
 *
 * @module api/contacts/[contactId]/professional-link
 */

import type { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { readContactProfessionalLink } from '@/server/engagements/contact-engagement-link.server';
import type { ContactProfessionalLink } from '@/types/contact-professional-link';
import { loadOwnedContact } from '../../_shared/contact-owned-doc';

type SegmentData = { params: Promise<{ contactId: string }> };

async function professionalLinkOf(ctx: AuthContext, contactId: string): Promise<ContactProfessionalLink> {
  const db = getAdminFirestore();
  if (!db) throw new ApiError(503, 'Database not available');
  // Φύλακας ιδιοκτησίας: ξένη επαφή ≡ ανύπαρκτη (404) — πριν από κάθε ανάγνωση συμμετοχών.
  await loadOwnedContact({ contactId, caller: ctx, action: 'professional-link', db });
  const read = await readContactProfessionalLink(db, ctx.companyId, contactId, Date.now(), { read: true });
  if (read.outcome === 'unknown') throw new ApiError(503, 'Professional link unavailable');
  return read.link;
}

export const GET = withStandardRateLimit(async function handle(
  request: NextRequest,
  segmentData?: SegmentData,
): Promise<NextResponse> {
  const { contactId } = await segmentData!.params;
  const handler = withAuth<ApiSuccessResponse<ContactProfessionalLink>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => apiSuccess(await professionalLinkOf(ctx, contactId)),
    { permissions: 'crm:contacts:view' },
  );
  return handler(request);
});
