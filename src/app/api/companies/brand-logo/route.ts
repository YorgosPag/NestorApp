/**
 * GET / PUT / DELETE /api/companies/brand-logo — **το λογότυπο του χώρου** (ADR-ACC-018 §17, ADR-928 §5.11).
 *
 * - `GET`: κάθε μέλος του χώρου — το τρέχον λογότυπο (ή `null`).
 * - `PUT` (multipart, πεδίο `file`): διαχειριστές — κανονικοποίηση + νέο αμετάβλητο asset + δείκτης.
 *   Ίδια bytes με το τρέχον ⇒ το τρέχον, χωρίς νέα εγγραφή (ιδεμποτικό εκ κατασκευής, πάνω από το `Idempotency-Key`).
 * - `DELETE`: διαχειριστές — καθαρίζει μόνο τον δείκτη· τα bytes μένουν για τα παγωμένα παραστατικά.
 *
 * Αρνήσεις εισόδου ⇒ **422** με κατονομασμένο `refusal` (`format` · `size` · `too-small` · `undecodable`) που ο
 * browser μεταφράζει — ποτέ ελεύθερο κείμενο.
 *
 * @module api/companies/brand-logo
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { ADMINISTRATIVE_ROLES, withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { BRAND_LOGO_FORM_FIELD, BRAND_LOGO_MAX_INPUT_BYTES } from '@/lib/company/brand-logo-policy';
import { userPerformer, type AuditPerformer } from '@/lib/audit/audit-performer';
import { withHeavyRateLimit, withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readCompanyBrandLogo } from '@/server/company/brand-logo-read.server';
import { clearCompanyBrandLogo, setCompanyBrandLogo } from '@/server/company/brand-logo-store.server';
import type { CompanyBrandLogoResponse } from '@/types/company-brand';

type BrandLogoError = { readonly error: 'NOT_FOUND' | 'NO_FILE' } | { readonly error: 'REFUSED'; readonly refusal: string };

function performerOf(ctx: AuthContext): AuditPerformer {
  return userPerformer(ctx.uid, ctx.email);
}

async function handleGet(_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) {
  return NextResponse.json<CompanyBrandLogoResponse>({ brandLogo: await readCompanyBrandLogo(ctx.companyId) });
}

/** Το αρχείο του πεδίου `file`, ή `null` (λείπει / δεν είναι αρχείο / ξεπερνά το όριο πριν διαβαστεί). */
async function uploadedBytesOf(req: NextRequest): Promise<Buffer | 'too-large' | null> {
  const form = await req.formData().catch(() => null);
  const file = form?.get(BRAND_LOGO_FORM_FIELD);
  if (!(file instanceof Blob)) return null;
  if (file.size > BRAND_LOGO_MAX_INPUT_BYTES) return 'too-large';
  return Buffer.from(await file.arrayBuffer());
}

async function handlePut(req: NextRequest, ctx: AuthContext, _cache: PermissionCache) {
  const bytes = await uploadedBytesOf(req);
  if (bytes === null) return NextResponse.json<BrandLogoError>({ error: 'NO_FILE' }, { status: 400 });
  if (bytes === 'too-large') {
    return NextResponse.json<BrandLogoError>({ error: 'REFUSED', refusal: 'size' }, { status: 422 });
  }
  const outcome = await setCompanyBrandLogo(ctx.companyId, bytes, performerOf(ctx));
  switch (outcome.kind) {
    case 'set':
      return NextResponse.json<CompanyBrandLogoResponse>({ brandLogo: outcome.brandLogo });
    case 'refused':
      return NextResponse.json<BrandLogoError>({ error: 'REFUSED', refusal: outcome.refusal }, { status: 422 });
    case 'absent':
      return NextResponse.json<BrandLogoError>({ error: 'NOT_FOUND' }, { status: 404 });
  }
}

async function handleDelete(_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) {
  const outcome = await clearCompanyBrandLogo(ctx.companyId, performerOf(ctx));
  if (outcome.kind === 'absent') return NextResponse.json<BrandLogoError>({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json<CompanyBrandLogoResponse>({ brandLogo: null });
}

export const GET = withStandardRateLimit(withAuth(handleGet));

export const PUT = withHeavyRateLimit(withAuth(handlePut, { requiredGlobalRoles: ADMINISTRATIVE_ROLES }));

export const DELETE = withSensitiveRateLimit(withAuth(handleDelete, { requiredGlobalRoles: ADMINISTRATIVE_ROLES }));
