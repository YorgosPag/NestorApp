/**
 * =============================================================================
 * GET + POST /api/onboarding/organization — ADR-326 Phase 8
 * =============================================================================
 *
 * GET:  Returns onboarding state for the authenticated company_admin.
 *       Non-admins receive { state: null } — banner skipped.
 *
 * POST: Handles two actions:
 *   action='complete' — builds embryonic OrgStructure (Accounting + Sales default,
 *                       Engineering + Legal optional) and marks onboarding complete.
 *   action='skip'     — marks onboarding skipped; triggers 7-day banner / cron reminder.
 *
 * Auth:   withAuth — company_admin required for POST
 * Rate:   withStandardRateLimit
 * Store:  companies/{companyId}.settings.onboarding  (Admin SDK)
 *
 * @module api/onboarding/organization
 * @enterprise ADR-326 Phase 8
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { DEPARTMENT_CODES } from '@/config/department-codes';
import { generateOrgDepartmentId } from '@/services/enterprise-id.service';
import { saveOrgStructure } from '@/services/org-structure/org-structure-repository';
import {
  getOnboardingState,
  markSkipped,
  markCompleted,
} from '@/services/onboarding/onboarding-state-service';
import type { OrgDepartment } from '@/types/org/org-structure';
import type { DepartmentCode } from '@/config/department-codes';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeptSelection = 'accounting' | 'sales' | 'engineering' | 'legal';

interface CompleteBody {
  action: 'complete';
  selectedDepts: DeptSelection[];
}

interface SkipBody {
  action: 'skip';
}

type PostBody = CompleteBody | SkipBody;

const DEPT_CODE_MAP: Record<DeptSelection, DepartmentCode> = {
  accounting: DEPARTMENT_CODES.ACCOUNTING,
  sales:      DEPARTMENT_CODES.SALES,
  engineering: DEPARTMENT_CODES.ENGINEERING,
  legal:      DEPARTMENT_CODES.LEGAL,
};

// ─── GET ──────────────────────────────────────────────────────────────────────

async function handleGet(
  _req: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  const isAdmin = ctx.globalRole === 'company_admin' || ctx.globalRole === 'super_admin';
  if (!isAdmin) return NextResponse.json({ state: null });

  const state = await getOnboardingState(ctx.companyId);
  return NextResponse.json({ state });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

async function handlePost(
  req: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  const isAdmin = ctx.globalRole === 'company_admin' || ctx.globalRole === 'super_admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden — company_admin required' }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    if (body.action === 'skip') {
      await markSkipped(ctx.companyId, ctx.uid);
      return NextResponse.json({ ok: true, action: 'skip' });
    }

    if (body.action === 'complete') {
      const selected = body.selectedDepts ?? ['accounting', 'sales'];

      if (!Array.isArray(selected) || selected.length === 0) {
        return NextResponse.json({ error: 'At least one department required' }, { status: 400 });
      }

      const departments: OrgDepartment[] = selected.map((key): OrgDepartment => ({
        id: generateOrgDepartmentId(),
        code: DEPT_CODE_MAP[key] ?? DEPARTMENT_CODES.CUSTOM,
        members: [],
        status: 'active',
        createdAt: new Date(),
      }));

      await saveOrgStructure(
        ctx.companyId,
        { departments },
        ctx.uid,
      );

      await markCompleted(ctx.companyId, ctx.uid);
      return NextResponse.json({ ok: true, action: 'complete' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const GET = withStandardRateLimit(async function GET(request: NextRequest) {
  return withAuth(handleGet)(request);
});

export const POST = withStandardRateLimit(async function POST(request: NextRequest) {
  return withAuth(handlePost)(request);
});
