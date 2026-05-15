/**
 * =============================================================================
 * GET + PUT /api/org-structure — Tenant Org Structure (L1)
 * =============================================================================
 *
 * GET:  Returns authenticated tenant's OrgStructure.
 * PUT:  Validates + persists OrgStructure for authenticated tenant.
 *
 * Auth: withAuth (any internal user for GET; company_admin for PUT)
 * Rate: withStandardRateLimit (60 req/min)
 * Storage: companies/{companyId}.settings.orgStructure (Admin SDK)
 *
 * @module api/org-structure
 * @enterprise ADR-326 Phase 1 — Server write path L1
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { getOrgStructure, saveOrgStructure } from '@/services/org-structure/org-structure-repository';
import { validateOrgHierarchy } from '@/services/org-structure/utils/validate-org-hierarchy';
import type { OrgStructure } from '@/types/org/org-structure';

// ─── Response types ───────────────────────────────────────────────────────────

interface GetResponse { orgStructure: OrgStructure | null }
interface PutResponse { orgStructure: OrgStructure }

// ─── Validation ───────────────────────────────────────────────────────────────

function validateOrgStructurePayload(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'Body must be an object';
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.departments)) return 'departments must be an array';
  return null;
}

function validateDepartmentsHierarchy(orgStructure: OrgStructure): string[] {
  const allErrors: string[] = [];
  for (const dept of orgStructure.departments) {
    const result = validateOrgHierarchy(dept.members, orgStructure.departments);
    if (!result.valid) allErrors.push(...result.errors.map((e) => `dept[${dept.id}]: ${e}`));
  }
  return allErrors;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

async function handleGet(
  _req: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<GetResponse>> {
  const orgStructure = await getOrgStructure(ctx.companyId);
  return NextResponse.json({ orgStructure });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

async function handlePut(
  req: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<PutResponse | { error: string }>> {
  const isAdmin = ctx.globalRole === 'company_admin' || ctx.globalRole === 'super_admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden — company_admin required' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validationError = validateOrgStructurePayload(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const payload = body as OrgStructure;

  // companyId immutability guard (ADR-326 Phase 1 acceptance criteria)
  if (payload.id && !payload.id.startsWith('org_')) {
    return NextResponse.json({ error: 'id must use org_ prefix' }, { status: 400 });
  }

  const hierarchyErrors = validateDepartmentsHierarchy(payload);
  if (hierarchyErrors.length > 0) {
    return NextResponse.json({ error: hierarchyErrors.join('; ') }, { status: 422 });
  }

  try {
    const saved = await saveOrgStructure(ctx.companyId, payload, ctx.uid);
    return NextResponse.json({ orgStructure: saved });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const GET = withStandardRateLimit(async function GET(request: NextRequest) {
  return withAuth<GetResponse>(handleGet)(request);
});

export const PUT = withStandardRateLimit(async function PUT(request: NextRequest) {
  return withAuth<PutResponse | { error: string }>(handlePut)(request);
});
